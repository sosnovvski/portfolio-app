import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchQualityReport,
  isOldRun,
  isQualityReport,
  passedCount,
  type QualityReport,
  qualityStatus,
} from "./quality";

const PASSING: QualityReport = {
  commit: "abc1234def",
  runUrl: "https://github.com/owner/repo/actions/runs/123",
  finishedAt: "2026-11-05T09:00:00Z",
  conclusion: "success",
  suites: [
    { name: "backend", tests: 128, failed: 0, skipped: 0 },
    { name: "frontend", tests: 194, failed: 0, skipped: 0 },
    { name: "browser", tests: 63, failed: 0, skipped: 0 },
  ],
  accessibility: { tests: 42, failed: 0 },
  coverage: { backendLines: 93.6, frontendLines: 89.2 },
};

describe("isQualityReport", () => {
  it("accepts the documented shape, and null coverage", () => {
    expect(isQualityReport(PASSING)).toBe(true);
    expect(isQualityReport({ ...PASSING, coverage: { backendLines: null, frontendLines: null } })).toBe(true);
  });

  it("accepts a failed run, including a failure with no tests run", () => {
    const suites = [{ name: "backend", tests: 0, failed: 1, skipped: 0 }];
    expect(isQualityReport({ ...PASSING, conclusion: "failure", suites })).toBe(true);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "report"],
    ["an array", []],
    ["an empty object", {}],
    ["an unknown conclusion", { ...PASSING, conclusion: "cancelled" }],
    ["a missing conclusion", { ...PASSING, conclusion: undefined }],
    ["a commit that is not hex", { ...PASSING, commit: "abc123z" }],
    ["a commit that is too short", { ...PASSING, commit: "abc123" }],
    ["a commit that is too long", { ...PASSING, commit: "a".repeat(41) }],
    ["a commit carrying markup", { ...PASSING, commit: "<b>abc1234</b>" }],
    ["a run address on another host", { ...PASSING, runUrl: "https://example.com/owner/repo" }],
    ["a look-alike host", { ...PASSING, runUrl: "https://github.com.evil.test/x" }],
    ["a host with no path slash", { ...PASSING, runUrl: "https://github.com" }],
    ["plain http", { ...PASSING, runUrl: "http://github.com/owner" }],
    ["a script address", { ...PASSING, runUrl: "javascript:alert(1)" }],
    ["a space in the address", { ...PASSING, runUrl: "https://github.com/a b" }],
    ["an unparseable date", { ...PASSING, finishedAt: "yesterday" }],
    ["a date that only Date.parse likes", { ...PASSING, finishedAt: "1" }],
    ["an impossible date", { ...PASSING, finishedAt: "2026-13-45T09:00:00Z" }],
    ["a numeric date", { ...PASSING, finishedAt: 1700000000000 }],
    ["no suites", { ...PASSING, suites: [] }],
    ["suites that are not a list", { ...PASSING, suites: {} }],
    ["a suite with no name", { ...PASSING, suites: [{ tests: 1, failed: 0, skipped: 0 }] }],
    ["a negative count", { ...PASSING, suites: [{ name: "backend", tests: -1, failed: 0, skipped: 0 }] }],
    ["a fractional count", { ...PASSING, suites: [{ name: "backend", tests: 1.5, failed: 0, skipped: 0 }] }],
    ["a count as text", { ...PASSING, suites: [{ name: "backend", tests: "1", failed: 0, skipped: 0 }] }],
    ["a missing skipped count", { ...PASSING, suites: [{ name: "backend", tests: 1, failed: 0 }] }],
    ["negative accessibility", { ...PASSING, accessibility: { tests: 1, failed: -1 } }],
    ["no accessibility", { ...PASSING, accessibility: undefined }],
    ["coverage as text", { ...PASSING, coverage: { backendLines: "93", frontendLines: null } }],
    ["coverage over 100", { ...PASSING, coverage: { backendLines: 101, frontendLines: null } }],
    ["a missing coverage value", { ...PASSING, coverage: { backendLines: 90 } }],
    ["no coverage", { ...PASSING, coverage: undefined }],
  ])("rejects %s", (_name, value) => {
    expect(isQualityReport(value)).toBe(false);
  });
});

describe("qualityStatus", () => {
  it("is PASS only for success with nothing failed", () => {
    expect(qualityStatus(PASSING)).toBe("PASS");
  });

  it("is FAIL by conclusion, even with every count at 0", () => {
    expect(qualityStatus({ ...PASSING, conclusion: "failure" })).toBe("FAIL");
  });

  it("is FAIL by a suite count, despite a success conclusion", () => {
    const suites = [PASSING.suites[0]!, { name: "frontend", tests: 194, failed: 1, skipped: 0 }];
    expect(qualityStatus({ ...PASSING, suites })).toBe("FAIL");
  });

  it("is FAIL by the accessibility count, despite a success conclusion", () => {
    expect(qualityStatus({ ...PASSING, accessibility: { tests: 42, failed: 2 } })).toBe("FAIL");
  });

  it("is not changed by skipped tests", () => {
    const suites = [{ name: "backend", tests: 10, failed: 0, skipped: 3 }];
    expect(qualityStatus({ ...PASSING, suites })).toBe("PASS");
  });
});

describe("passedCount", () => {
  it("leaves out failed and skipped tests", () => {
    expect(passedCount({ tests: 10, failed: 2, skipped: 3 })).toBe(5);
    expect(passedCount({ tests: 10, failed: 2 })).toBe(8);
  });

  it("never goes below 0", () => {
    expect(passedCount({ tests: 0, failed: 1, skipped: 0 })).toBe(0);
  });
});

describe("isOldRun", () => {
  const finishedAt = "2026-08-01T00:00:00Z";

  it("is false at exactly 90 days and true after", () => {
    expect(isOldRun({ finishedAt }, new Date("2026-10-30T00:00:00Z"))).toBe(false);
    expect(isOldRun({ finishedAt }, new Date("2026-10-30T00:00:01Z"))).toBe(true);
  });
});

describe("fetchQualityReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function withUrl() {
    vi.stubEnv("QUALITY_JSON_URL", "http://reports.test/quality.json");
  }

  it("makes no request when the URL is unset or empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("QUALITY_JSON_URL", undefined as unknown as string);
    await expect(fetchQualityReport()).resolves.toBeNull();
    vi.stubEnv("QUALITY_JSON_URL", "");
    await expect(fetchQualityReport()).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a valid report, read from the runtime URL with the agreed caching and timeout", async () => {
    withUrl();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue(Response.json(PASSING));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQualityReport()).resolves.toEqual(PASSING);

    expect(timeout).toHaveBeenCalledWith(2000);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next: { revalidate: number } }];
    expect(url).toBe("http://reports.test/quality.json");
    expect(init.next.revalidate).toBe(900);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("is null on a fetch error", async () => {
    withUrl();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(fetchQualityReport()).resolves.toBeNull();
  });

  it("is null when the request times out", async () => {
    withUrl();
    // A short real timeout, standing in for the 2 seconds, and a fetch that only ends when aborted.
    const shortTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => shortTimeout(10));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );
    await expect(fetchQualityReport()).resolves.toBeNull();
  });

  it("is null when the body hangs past the timeout", async () => {
    withUrl();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new DOMException("The operation timed out", "TimeoutError")),
    }));
    await expect(fetchQualityReport()).resolves.toBeNull();
  });

  it("is null on an error status, invalid JSON or an invalid shape", async () => {
    withUrl();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(fetchQualityReport()).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{not json")));
    await expect(fetchQualityReport()).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...PASSING, commit: "nope" })));
    await expect(fetchQualityReport()).resolves.toBeNull();
  });
});
