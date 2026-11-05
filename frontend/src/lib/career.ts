import type { Experience } from "@/api/types";
import { monthsBetween, monthsInclusive, parseYearMonth, type YearMonth } from "./dates";

export type RoleStatus = "PASS" | "RUNNING";

/** Career entries are PASS or RUNNING only. The API may send `end` as null or leave it out. */
export function roleStatus(experience: Pick<Experience, "end">): RoleStatus {
  return experience.end ? "PASS" : "RUNNING";
}

export function newestFirst(experiences: readonly Experience[]): Experience[] {
  return [...experiences].sort((a, b) => b.start.localeCompare(a.start));
}

export function roleEnd(experience: Pick<Experience, "end">, now: YearMonth): YearMonth {
  return experience.end ? parseYearMonth(experience.end) : now;
}

export function roleMonths(experience: Pick<Experience, "start" | "end">, now: YearMonth): number {
  return monthsInclusive(parseYearMonth(experience.start), roleEnd(experience, now));
}

export interface CareerCounts {
  roles: number;
  workplaces: number;
  current: number;
}

export function careerCounts(experiences: readonly Experience[]): CareerCounts {
  return {
    roles: experiences.length,
    workplaces: new Set(experiences.map((experience) => experience.employer)).size,
    current: experiences.filter((experience) => roleStatus(experience) === "RUNNING").length,
  };
}

export interface TimelineAxis {
  firstYear: number;
  totalMonths: number;
  ticks: { year: number; months: number; percent: number }[];
}

function tickStep(years: number): number {
  if (years <= 6) return 1;
  if (years <= 12) return 2;
  if (years <= 30) return 5;
  return 10;
}

/** Runs from January of the earliest start year to the end of the current year. */
export function timelineAxis(experiences: readonly Experience[], now: YearMonth): TimelineAxis {
  const firstYear = Math.min(...experiences.map((experience) => parseYearMonth(experience.start).year));
  const years = now.year - firstYear + 1;
  const totalMonths = years * 12;
  const step = tickStep(years);

  const ticks: TimelineAxis["ticks"] = [];
  for (let offset = 0; offset < years; offset += step) {
    const months = offset * 12;
    ticks.push({ year: firstYear + offset, months, percent: (months / totalMonths) * 100 });
  }
  return { firstYear, totalMonths, ticks };
}

export function barGeometry(
  experience: Pick<Experience, "start" | "end">,
  axis: Pick<TimelineAxis, "firstYear">,
  now: YearMonth,
): { x: number; width: number } {
  return {
    x: monthsBetween({ year: axis.firstYear, month: 1 }, parseYearMonth(experience.start)),
    width: roleMonths(experience, now),
  };
}
