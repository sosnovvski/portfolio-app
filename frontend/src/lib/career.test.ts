import { describe, expect, it } from "vitest";
import type { Experience } from "@/api/types";
import { barGeometry, careerCounts, newestFirst, roleStatus, timelineAxis } from "./career";

const NOW = { year: 2026, month: 11 };

function role(id: number, employer: string, start: string, end?: string): Experience {
  return { id, employer, role: "Engineer", start, achievements: [], ...(end ? { end } : {}) };
}

const CAREER = [
  role(1, "Self-employed", "2022-01"),
  role(2, "EPAM Systems", "2021-04", "2022-01"),
  role(3, "EPAM Systems", "2021-02", "2021-04"),
  role(4, "Jabil", "2017-07", "2017-09"),
];

describe("status", () => {
  it("is RUNNING without an end, otherwise PASS", () => {
    expect(roleStatus({})).toBe("RUNNING");
    expect(roleStatus({ end: null } as unknown as { end?: string })).toBe("RUNNING");
    expect(roleStatus({ end: "2022-01" })).toBe("PASS");
  });
});

describe("counts", () => {
  it("counts distinct employers as workplaces", () => {
    expect(careerCounts(CAREER)).toEqual({ roles: 4, workplaces: 3, current: 1 });
  });
});

describe("ordering", () => {
  it("puts the newest start first", () => {
    const shuffled = [CAREER[3]!, CAREER[0]!, CAREER[2]!, CAREER[1]!];
    expect(newestFirst(shuffled).map((experience) => experience.id)).toEqual([1, 2, 3, 4]);
  });
});

describe("axis", () => {
  const axis = timelineAxis(CAREER, NOW);

  it("spans January of the earliest year to the end of the current year", () => {
    expect(axis.firstYear).toBe(2017);
    expect(axis.totalMonths).toBe(120);
  });

  it("labels ticks from the data, as in the mockup", () => {
    expect(axis.ticks.map((tick) => tick.year)).toEqual([2017, 2019, 2021, 2023, 2025]);
    expect(axis.ticks.map((tick) => tick.percent)).toEqual([0, 20, 40, 60, 80]);
  });

  it("moves with the data and the clock", () => {
    const later = timelineAxis([role(1, "A", "2024-03")], { year: 2027, month: 2 });
    expect(later.firstYear).toBe(2024);
    expect(later.totalMonths).toBe(48);
    expect(later.ticks.map((tick) => tick.year)).toEqual([2024, 2025, 2026, 2027]);
  });
});

describe("bars", () => {
  const axis = timelineAxis(CAREER, NOW);

  it("match the geometry of the approved mockup", () => {
    expect(barGeometry(CAREER[0]!, axis, NOW)).toEqual({ x: 60, width: 59 });
    expect(barGeometry(CAREER[1]!, axis, NOW)).toEqual({ x: 51, width: 10 });
    expect(barGeometry(CAREER[2]!, axis, NOW)).toEqual({ x: 49, width: 3 });
    expect(barGeometry(CAREER[3]!, axis, NOW)).toEqual({ x: 6, width: 3 });
  });
});
