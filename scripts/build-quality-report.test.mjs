// Run with: node --test "scripts/*.test.mjs"
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessibilityCounts,
  backendLineCoverage,
  buildReport,
  countsFromJunit,
  frontendLineCoverage,
} from "./build-quality-report.mjs";

const passing = {
  suites: [
    { name: "backend", tests: 10, failed: 0, skipped: 0 },
    { name: "frontend", tests: 5, failed: 0, skipped: 0 },
    { name: "browser", tests: 3, failed: 0, skipped: 0 },
  ],
  accessibility: { tests: 2, failed: 0 },
  coverage: { backendLines: 90, frontendLines: 85 },
  jobResults: ["success", "success", "success"],
  commit: "abc1234",
  runUrl: "https://github.com/o/r/actions/runs/1",
  finishedAt: "2026-11-05T09:00:00Z",
};

test("reads totals from the root tag", () => {
  const xml = '<testsuites tests="7" failures="1" errors="1" skipped="2"><testsuite tests="99"></testsuite></testsuites>';
  assert.deepEqual(countsFromJunit(xml), { tests: 7, failed: 2, skipped: 2 });
});

test("reads a Surefire file that has a single testsuite", () => {
  const xml = '<?xml version="1.0"?><testsuite name="x" tests="3" errors="0" skipped="1" failures="0">';
  assert.deepEqual(countsFromJunit(xml), { tests: 3, failed: 0, skipped: 1 });
});

test("counts only the accessibility spec", () => {
  const xml = `<testsuites tests="9">
    <testsuite name="tests/accessibility.spec.ts" tests="4" failures="1" errors="0">
    <testsuite name="tests/admin.spec.ts" tests="5" failures="3" errors="0">
  </testsuites>`;
  assert.deepEqual(accessibilityCounts(xml), { tests: 4, failed: 1 });
});

test("computes line coverage from the JaCoCo columns", () => {
  const csv = "GROUP,PACKAGE,CLASS,IM,IC,BM,BC,LINE_MISSED,LINE_COVERED,CM,CC,MM,MC\na,b,C,0,0,0,0,1,3,0,0,0,0\na,b,D,0,0,0,0,0,4,0,0,0,0\n";
  assert.equal(backendLineCoverage(csv), 87.5);
});

test("a damaged frontend coverage summary gives no figure", () => {
  assert.equal(frontendLineCoverage('{"total":{"lines":{"pct":82.5}}}'), 82.5);
  assert.equal(frontendLineCoverage('{"total":{"lines":{"pct":"Unknown"}}}'), null);
  assert.equal(frontendLineCoverage('{"total":'), null);
});

test("a clean run is a success", () => {
  assert.equal(buildReport(passing).conclusion, "success");
});

test("a failed test is a failure", () => {
  const suites = passing.suites.map((suite, i) => (i === 1 ? { ...suite, failed: 1 } : suite));
  assert.equal(buildReport({ ...passing, suites }).conclusion, "failure");
});

test("a failed accessibility check is a failure", () => {
  assert.equal(buildReport({ ...passing, accessibility: { tests: 2, failed: 1 } }).conclusion, "failure");
});

test("a failed job is a failure even when every report looks clean", () => {
  assert.equal(buildReport({ ...passing, jobResults: ["success", "failure", "success"] }).conclusion, "failure");
});

test("a cancelled or skipped job is a failure", () => {
  assert.equal(buildReport({ ...passing, jobResults: ["success", "skipped"] }).conclusion, "failure");
  assert.equal(buildReport({ ...passing, jobResults: ["cancelled"] }).conclusion, "failure");
});

test("a missing report is a failure, not an empty pass", () => {
  const suites = passing.suites.map((suite, i) => (i === 2 ? { ...suite, tests: 0 } : suite));
  assert.equal(buildReport({ ...passing, suites }).conclusion, "failure");
  assert.equal(buildReport({ ...passing, accessibility: { tests: 0, failed: 0 } }).conclusion, "failure");
  assert.equal(buildReport({ ...passing, jobResults: [] }).conclusion, "failure");
});
