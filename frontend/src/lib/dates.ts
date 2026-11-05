export interface YearMonth {
  year: number;
  month: number;
}

export function parseYearMonth(value: string): YearMonth {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) {
    throw new Error(`Not a year and month: ${value}`);
  }
  return { year, month };
}

export function currentYearMonth(date: Date): YearMonth {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + month - 1;
}

/** Whole months between two dates, not counting the end month. */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  return monthIndex(to) - monthIndex(from);
}

/** Counts both the first and the last month, as the CV does: Feb 2021 to Apr 2021 is 3 months. */
export function monthsInclusive(start: YearMonth, end: YearMonth): number {
  return monthsBetween(start, end) + 1;
}

export function formatMonth(value: YearMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(value.year, value.month - 1, 1)),
  );
}

export type DurationTranslator = (key: "years" | "months", values: { count: number }) => string;

export function formatDuration(totalMonths: number, t: DurationTranslator): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(t("years", { count: years }));
  }
  if (months > 0 || years === 0) {
    parts.push(t("months", { count: months }));
  }
  return parts.join(" ");
}
