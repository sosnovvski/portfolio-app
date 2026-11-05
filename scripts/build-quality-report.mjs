#!/usr/bin/env node
// Builds quality.json for the website from the real reports of one CI run. Nothing here is typed in by hand:
// a missing report makes the run count as failed, so an incomplete pipeline can never look like a pass.
//
//   node scripts/build-quality-report.mjs <reports-dir> <output-file>
//
// Environment: COMMIT, RUN_URL, FINISHED_AT, and JOB_RESULTS, the job results joined by commas.
import fs from "node:fs";
import path from "node:path";

function filesUnder(directory, matches) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && matches(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function attribute(tag, name) {
  const value = new RegExp(`\\b${name}="(\\d+)"`).exec(tag)?.[1];
  return value === undefined ? 0 : Number(value);
}

function countsFromTag(tag) {
  return {
    tests: attribute(tag, "tests"),
    failed: attribute(tag, "failures") + attribute(tag, "errors"),
    skipped: attribute(tag, "skipped"),
  };
}

export function add(a, b) {
  return { tests: a.tests + b.tests, failed: a.failed + b.failed, skipped: a.skipped + b.skipped };
}

/** One JUnit file: the root tag has the totals, and Surefire files have a single testsuite. */
export function countsFromJunit(xml) {
  const root = /<testsuites\b[^>]*>/.exec(xml)?.[0] ?? /<testsuite\b[^>]*>/.exec(xml)?.[0];
  return root ? countsFromTag(root) : { tests: 0, failed: 0, skipped: 0 };
}

/** The Playwright file has one testsuite per spec, so the accessibility spec can be counted alone. */
export function accessibilityCounts(xml) {
  const counts = { tests: 0, failed: 0, skipped: 0 };
  for (const [tag] of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    if (/\bname="[^"]*accessibility\.spec[^"]*"/.test(tag)) {
      const suite = countsFromTag(tag);
      counts.tests += suite.tests;
      counts.failed += suite.failed;
    }
  }
  return { tests: counts.tests, failed: counts.failed };
}

function sumJunit(directory) {
  return filesUnder(directory, (name) => /\.xml$/.test(name))
    .map((file) => countsFromJunit(fs.readFileSync(file, "utf8")))
    .reduce(add, { tests: 0, failed: 0, skipped: 0 });
}

export function backendLineCoverage(csv) {
  const totals = csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
    .reduce(([missed, covered], row) => [missed + Number(row[7]), covered + Number(row[8])], [0, 0]);
  const all = totals[0] + totals[1];
  return all === 0 ? null : Math.round((1000 * totals[1]) / all) / 10;
}

/** A damaged or non-numeric summary counts as no figure, and must not stop a failed run being published. */
export function frontendLineCoverage(json) {
  try {
    const pct = JSON.parse(json).total.lines.pct;
    return typeof pct === "number" && pct >= 0 && pct <= 100 ? pct : null;
  } catch {
    return null;
  }
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

export function buildReport({ suites, accessibility, coverage, jobResults, commit, runUrl, finishedAt }) {
  const everySuiteRan = suites.every((suite) => suite.tests > 0) && accessibility.tests > 0;
  const nothingFailed = suites.every((suite) => suite.failed === 0) && accessibility.failed === 0;
  const jobsPassed = jobResults.length > 0 && jobResults.every((result) => result === "success");

  return {
    commit,
    runUrl,
    finishedAt,
    conclusion: everySuiteRan && nothingFailed && jobsPassed ? "success" : "failure",
    suites,
    accessibility,
    coverage,
  };
}

function main([reportsDirectory, outputFile]) {
  const { COMMIT, RUN_URL, FINISHED_AT, JOB_RESULTS } = process.env;
  if (!reportsDirectory || !outputFile || !COMMIT || !RUN_URL || !FINISHED_AT) {
    throw new Error("Usage: build-quality-report.mjs <reports-dir> <output-file>, with COMMIT, RUN_URL and FINISHED_AT set");
  }

  const backend = path.join(reportsDirectory, "backend-reports");
  const frontend = path.join(reportsDirectory, "frontend-reports");
  const browser = path.join(reportsDirectory, "e2e-report");
  const browserXml = readIfExists(path.join(browser, "results", "junit.xml")) ?? "";
  const backendCsv = readIfExists(path.join(backend, "site", "jacoco", "jacoco.csv"));
  const frontendSummary = readIfExists(path.join(frontend, "coverage-summary.json"));

  const report = buildReport({
    suites: [
      { name: "backend", ...sumJunit(backend) },
      { name: "frontend", ...sumJunit(frontend) },
      { name: "browser", ...countsFromJunit(browserXml) },
    ],
    accessibility: accessibilityCounts(browserXml),
    coverage: {
      backendLines: backendCsv ? backendLineCoverage(backendCsv) : null,
      frontendLines: frontendSummary ? frontendLineCoverage(frontendSummary) : null,
    },
    jobResults: (JOB_RESULTS ?? "").split(",").filter(Boolean),
    commit: COMMIT,
    runUrl: RUN_URL,
    finishedAt: FINISHED_AT,
  });

  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.conclusion}: ${outputFile}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main(process.argv.slice(2));
}
