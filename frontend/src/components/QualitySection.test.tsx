import { screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { CONTENT, NOW, renderIn } from "@/test/render";
import type { QualityReport } from "@/lib/quality";
import pl from "../../messages/pl.json";
import { HomePage } from "./HomePage";
import { QualitySection } from "./QualitySection";

const REPORT: QualityReport = {
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

const SOON_AFTER = new Date("2026-11-06T00:00:00Z");

function row(label: string): string | null | undefined {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
}

describe("status", () => {
  it("shows PASS as text and in the pass colour", () => {
    renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(screen.getByText("PASS")).toHaveClass("pass");
    expect(screen.queryByText("FAIL")).toBeNull();
  });

  it("shows FAIL by conclusion, with every count at 0", () => {
    renderIn("en", <QualitySection report={{ ...REPORT, conclusion: "failure" }} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toHaveClass("fail");
    expect(screen.queryByText("PASS")).toBeNull();
  });

  it("shows FAIL by count, despite a success conclusion", () => {
    const suites = [{ name: "backend", tests: 128, failed: 3, skipped: 0 }];
    renderIn("en", <QualitySection report={{ ...REPORT, suites }} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toHaveClass("fail");
    expect(row("Backend tests")).toBe("125 passed, 3 failed");
  });

  it("shows FAIL by the accessibility count", () => {
    const report = { ...REPORT, accessibility: { tests: 42, failed: 1 } };
    renderIn("en", <QualitySection report={report} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(row("Accessibility tests")).toBe("41 passed, 1 failed");
  });
});

describe("the three states", () => {
  it("pass", () => {
    renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText(/Nothing failed in this run\./)).toBeInTheDocument();
  });

  it("a test failed", () => {
    const suites = [{ name: "backend", tests: 10, failed: 1, skipped: 0 }];
    renderIn("en", <QualitySection report={{ ...REPORT, conclusion: "failure", suites }} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText(/This run found a problem\. The full run shows the details\./)).toBeInTheDocument();
  });

  it("all tests passed but another check failed", () => {
    renderIn("en", <QualitySection report={{ ...REPORT, conclusion: "failure" }} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText(/All tests passed, but another automated check failed\./)).toBeInTheDocument();
    expect(screen.queryByText(/found a problem/)).toBeNull();
  });

  it("does not claim all tests passed when a suite ran none", () => {
    const suites = [{ name: "backend", tests: 0, failed: 0, skipped: 0 }];
    renderIn("en", <QualitySection report={{ ...REPORT, conclusion: "failure", suites }} now={SOON_AFTER} />);
    expect(screen.queryByText(/All tests passed/)).toBeNull();
    expect(screen.getByText(/found a problem/)).toBeInTheDocument();
  });

  it("has the agreed Polish wording, with FAIL marked as English", () => {
    renderIn("pl", <QualitySection report={{ ...REPORT, conclusion: "failure" }} now={SOON_AFTER} />);
    expect(screen.getByText("FAIL")).toHaveAttribute("lang", "en");
    expect(
      screen.getByText(/Wszystkie testy przeszły, ale inna automatyczna kontrola się nie powiodła\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz przebieg abc1234 na GitHubie" })).toBeInTheDocument();
    expect(row("Pełny przebieg")).toBe("Zobacz przebieg abc1234 na GitHubie");
  });
});

describe("figures", () => {
  it("labels each suite plainly", () => {
    renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(row("Backend tests")).toBe("128 passed, 0 failed");
    expect(row("Frontend tests")).toBe("194 passed, 0 failed");
    expect(row("Browser tests")).toBe("63 passed, 0 failed");
    expect(row("Accessibility tests")).toBe("42 passed, 0 failed");
  });

  it("mentions skipped only when there are some", () => {
    const suites = [
      { name: "backend", tests: 10, failed: 1, skipped: 2 },
      { name: "frontend", tests: 5, failed: 0, skipped: 0 },
    ];
    const { container } = renderIn("en", <QualitySection report={{ ...REPORT, suites }} now={SOON_AFTER} />);
    expect(row("Backend tests")).toBe("7 passed, 1 failed, 2 skipped");
    expect(row("Frontend tests")).toBe("5 passed, 0 failed");
    expect(container.textContent?.match(/skipped/g)).toHaveLength(1);
  });

  it("shows coverage only where it is not null", () => {
    const report = { ...REPORT, coverage: { backendLines: 93.6, frontendLines: null } };
    renderIn("en", <QualitySection report={report} now={SOON_AFTER} />);
    expect(row("Backend line coverage")).toBe("93.6%");
    expect(screen.queryByText("Frontend line coverage")).toBeNull();
  });

  it("links seven characters of the commit to the run", () => {
    renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    const link = screen.getByRole("link", { name: "View run abc1234 on GitHub" });
    expect(link).toHaveAttribute("href", REPORT.runUrl);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("gives the date in the page's language on a time element", () => {
    const { container, unmount } = renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    const time = container.querySelector("time");
    expect(time).toHaveTextContent("5 November 2026");
    expect(time).toHaveAttribute("datetime", REPORT.finishedAt);
    unmount();

    const polish = renderIn("pl", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(polish.container.querySelector("time")).toHaveTextContent("5 listopada 2026");
  });

  it("opens with a plain sentence before the results, never calls them live or claims a block", () => {
    const { container } = renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("How this site is tested");
    const intro = screen.getByText("Every change to this site runs through automated tests. These are the latest results.");
    expect(intro.compareDocumentPosition(screen.getByText("PASS")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).not.toContain("pipeline");
    const text = container.textContent?.toLowerCase();
    expect(text).not.toContain("live");
    expect(text).not.toContain("block");
    expect(row("Full run")).toBe("View run abc1234 on GitHub");
    expect(screen.queryByText("Commit")).toBeNull();
  });

  it("uses no style attribute", () => {
    const { container } = renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });
});

describe("an old run", () => {
  it("adds a note after 90 days and still shows the result", () => {
    renderIn("en", <QualitySection report={REPORT} now={new Date("2027-03-01T00:00:00Z")} />);
    expect(screen.getByText("This result is from an older run.")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("adds no note for a recent run", () => {
    renderIn("en", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(screen.queryByText("This result is from an older run.")).toBeNull();
  });
});

describe("Polish", () => {
  it("renders natural labels and percent format", () => {
    renderIn("pl", <QualitySection report={REPORT} now={SOON_AFTER} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Jak testowana jest ta strona",
    );
    expect(row("Testy backendu")).toBe("128 zaliczonych, 0 nieudanych");
    expect(row("Pokrycie linii backendu")?.replace(/\s/g, "")).toBe("93,6%");
  });

  const t = createTranslator({ locale: "pl", messages: pl, namespace: "quality" });

  it.each([
    [1, "1 zaliczony"],
    [2, "2 zaliczone"],
    [4, "4 zaliczone"],
    [5, "5 zaliczonych"],
    [12, "12 zaliczonych"],
    [22, "22 zaliczone"],
    [128, "128 zaliczonych"],
    [194, "194 zaliczone"],
  ])("%i passed", (count, expected) => {
    expect(t("passed", { count })).toBe(expected);
  });

  it.each([
    [0, "0 nieudanych"],
    [1, "1 nieudany"],
    [3, "3 nieudane"],
    [5, "5 nieudanych"],
  ])("%i failed", (count, expected) => {
    expect(t("failed", { count })).toBe(expected);
  });

  it.each([
    [1, "1 pominięty"],
    [2, "2 pominięte"],
    [5, "5 pominiętych"],
  ])("%i skipped", (count, expected) => {
    expect(t("skipped", { count })).toBe(expected);
  });
});

describe("on the home page", () => {
  function renderHome(report: QualityReport | null) {
    return renderIn(
      "en",
      <HomePage content={CONTENT} now={NOW} quality={report && { report, now: SOON_AFTER }} />,
    );
  }

  it("is absent when there is no report", () => {
    const { container } = renderHome(null);
    expect(container.querySelector("#ci")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Contact" })).toBeInTheDocument();
  });

  it("comes right before Contact, after Projects when there are any", () => {
    const project = {
      slug: "p",
      name: "P",
      summary: "S",
      status: "LIVE" as const,
      tech: [],
    };
    const { container } = renderIn(
      "en",
      <HomePage
        content={{ ...CONTENT, projects: [project] }}
        now={NOW}
        quality={{ report: REPORT, now: SOON_AFTER }}
      />,
    );
    const ids = Array.from(container.querySelectorAll("main section")).map((section) => section.id);
    expect(ids.slice(-3)).toEqual(["projects", "ci", "contact"]);
  });

  it("adds no link to the navigation", () => {
    renderHome(REPORT);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).queryByRole("link", { name: /test run/i })).toBeNull();
    expect(nav.querySelector('a[href="#ci"]')).toBeNull();
  });
});
