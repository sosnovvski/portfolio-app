import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import { roleMonths } from "./career";
import { currentYearMonth, formatDuration, formatMonth, monthsInclusive, parseYearMonth } from "./dates";

const NOW = { year: 2026, month: 11 };

function durationText(locale: "en" | "pl", months: number): string {
  const t = createTranslator({
    locale,
    messages: locale === "en" ? en : pl,
    namespace: "duration",
  });
  return formatDuration(months, (key, values) => t(key, values));
}

describe("durations, oracles from the CV as of Nov 2026", () => {
  it.each([
    ["2021-04", "2022-01", "10 months"],
    ["2021-02", "2021-04", "3 months"],
    ["2019-06", "2020-05", "1 year"],
    ["2022-01", undefined, "4 years 11 months"],
    ["2017-07", "2017-09", "3 months"],
  ])("%s to %s is %s", (start, end, expected) => {
    const months = roleMonths(end ? { start, end } : { start }, NOW);
    expect(durationText("en", months)).toBe(expected);
  });

  it("treats a null end, which the backend can send, as still running", () => {
    const fromApi = { start: "2022-01", end: null } as unknown as { start: string };
    expect(roleMonths(fromApi, NOW)).toBe(59);
  });

  it("counts a single month as one", () => {
    expect(monthsInclusive({ year: 2020, month: 3 }, { year: 2020, month: 3 })).toBe(1);
    expect(durationText("en", 1)).toBe("1 month");
  });
});

describe("Polish plurals", () => {
  it.each([
    [12, "1 rok"],
    [24, "2 lata"],
    [48, "4 lata"],
    [60, "5 lat"],
    [144, "12 lat"],
    [264, "22 lata"],
    [1, "1 miesiąc"],
    [3, "3 miesiące"],
    [5, "5 miesięcy"],
    [11, "11 miesięcy"],
    [59, "4 lata 11 miesięcy"],
    [13, "1 rok 1 miesiąc"],
  ])("%i months is %s", (months, expected) => {
    expect(durationText("pl", months)).toBe(expected);
  });
});

describe("month names", () => {
  it("are per locale", () => {
    expect(formatMonth({ year: 2021, month: 4 }, "en")).toBe("Apr 2021");
    expect(formatMonth({ year: 2021, month: 4 }, "pl")).toBe("kwi 2021");
    expect(formatMonth({ year: 2022, month: 1 }, "pl")).toBe("sty 2022");
  });
});

describe("parsing", () => {
  it("reads a year and month", () => {
    expect(parseYearMonth("2021-04")).toEqual({ year: 2021, month: 4 });
  });

  it("rejects anything else", () => {
    expect(() => parseYearMonth("soon")).toThrow();
  });

  it("takes the current month from an injected date", () => {
    expect(currentYearMonth(new Date(Date.UTC(2026, 10, 5)))).toEqual(NOW);
  });
});
