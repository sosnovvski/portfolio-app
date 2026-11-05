const TIMEOUT_MS = 2000;
const REVALIDATE_SECONDS = 900;
const OLD_RUN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface QualitySuite {
  name: string;
  tests: number;
  failed: number;
  skipped: number;
}

/** Written by the CI pipeline and not part of the OpenAPI contract, so its type and guard live here. */
export interface QualityReport {
  commit: string;
  runUrl: string;
  finishedAt: string;
  conclusion: "success" | "failure";
  suites: QualitySuite[];
  accessibility: { tests: number; failed: number };
  coverage: { backendLines: number | null; frontendLines: number | null };
}

export type QualityStatus = "PASS" | "FAIL";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPercentOrNull(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100);
}

/** It renders as a link, so only a real GitHub address gets through. */
function isRunUrl(value: unknown): value is string {
  return typeof value === "string" && !/\s/.test(value) && value.startsWith("https://github.com/") && URL.canParse(value);
}

/** The format check comes first because Date.parse also accepts text such as "1". */
function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function isSuite(value: unknown): value is QualitySuite {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    value["name"].length > 0 &&
    isCount(value["tests"]) &&
    isCount(value["failed"]) &&
    isCount(value["skipped"])
  );
}

export function isQualityReport(value: unknown): value is QualityReport {
  if (!isRecord(value)) {
    return false;
  }
  const { commit, runUrl, finishedAt, conclusion, suites, accessibility, coverage } = value;
  return (
    typeof commit === "string" &&
    /^[0-9a-f]{7,40}$/i.test(commit) &&
    isRunUrl(runUrl) &&
    isTimestamp(finishedAt) &&
    (conclusion === "success" || conclusion === "failure") &&
    Array.isArray(suites) &&
    suites.length > 0 &&
    suites.every(isSuite) &&
    isRecord(accessibility) &&
    isCount(accessibility["tests"]) &&
    isCount(accessibility["failed"]) &&
    isRecord(coverage) &&
    isPercentOrNull(coverage["backendLines"]) &&
    isPercentOrNull(coverage["frontendLines"])
  );
}

/** A failed run must show as failed, even if its conclusion says otherwise. */
export function qualityStatus(report: QualityReport): QualityStatus {
  const nothingFailed = report.suites.every((suite) => suite.failed === 0) && report.accessibility.failed === 0;
  return report.conclusion === "success" && nothingFailed ? "PASS" : "FAIL";
}

export type QualityOutcome = "pass" | "testsFailed" | "otherCheckFailed";

/**
 * "Another check" only when every test really ran and passed, which a failed security job produces.
 * A suite with no tests also fails the run, and "all tests passed" would be untrue for it.
 */
export function qualityOutcome(report: QualityReport): QualityOutcome {
  if (qualityStatus(report) === "PASS") {
    return "pass";
  }
  const nothingFailed = report.suites.every((suite) => suite.failed === 0) && report.accessibility.failed === 0;
  const everythingRan = report.suites.every((suite) => suite.tests > 0) && report.accessibility.tests > 0;
  return nothingFailed && everythingRan ? "otherCheckFailed" : "testsFailed";
}

/**
 * `tests` includes failed and skipped ones. It is floored at 0 and not rejected: a setup error can report
 * a failure with no tests run, and rejecting that report would hide a failed run.
 */
export function passedCount(counts: { tests: number; failed: number; skipped?: number }): number {
  return Math.max(0, counts.tests - counts.failed - (counts.skipped ?? 0));
}

export function isOldRun(report: Pick<QualityReport, "finishedAt">, now: Date): boolean {
  return now.getTime() - Date.parse(report.finishedAt) > OLD_RUN_DAYS * DAY_MS;
}

/**
 * Never throws. With no URL, or a report that fails, is too slow or is malformed, the answer is null and
 * the page renders without the section. A slow report can delay the page by the timeout at most.
 */
export async function fetchQualityReport(): Promise<QualityReport | null> {
  const url = process.env["QUALITY_JSON_URL"];
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return isQualityReport(body) ? body : null;
  } catch {
    return null;
  }
}
