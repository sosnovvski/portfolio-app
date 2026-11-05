import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicContent } from "@/api/types";
import { CONTENT, NOW, renderIn } from "@/test/render";
import { HomePage } from "./HomePage";

function renderHome(locale: "en" | "pl" = "en", content: PublicContent = CONTENT) {
  return renderIn(locale, <HomePage content={content} now={NOW} quality={null} />);
}

describe("hero", () => {
  it("shows the name, headline and location and no invented sentence", () => {
    const { container } = renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kamil Sosnowski");
    expect(screen.getByText(CONTENT.profile.headline)).toBeInTheDocument();
    expect(screen.getByText("Gdańsk, Poland", { selector: ".location" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("I build test frameworks");
  });
});

describe("summary", () => {
  it("renders blank-line separated text as paragraphs", () => {
    const { container } = renderHome();
    const paragraphs = container.querySelectorAll(".summary p");
    expect(Array.from(paragraphs).map((p) => p.textContent)).toEqual(["First paragraph.", "Second paragraph."]);
  });
});

describe("timeline", () => {
  it("is an ordered list of links to role anchors, newest first", () => {
    const { container } = renderHome();
    const items = container.querySelectorAll("ol.timeline > li");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Senior Test Automation Engineer");
    const link = within(items[0] as HTMLElement).getByRole("link");
    expect(link).toHaveAttribute("href", "#role-1");
    expect(container.querySelector("#role-1")).not.toBeNull();
  });

  it("states employer, client and dates as text", () => {
    const { container } = renderHome();
    const items = container.querySelectorAll("ol.timeline > li");
    expect(items[3]).toHaveTextContent("ALTEN at Thales, Jun 2020 to Feb 2021");
    expect(items[0]).toHaveTextContent("Self-employed, Jan 2022 to present");
  });

  it("uses natural Polish", () => {
    const { container } = renderHome("pl");
    const items = container.querySelectorAll("ol.timeline > li");
    expect(items[3]).toHaveTextContent("ALTEN dla Thales, cze 2020 – lut 2021");
    expect(items[0]).toHaveTextContent("Self-employed, sty 2022 – obecnie");
  });

  it("states real counts in both languages", () => {
    renderHome("en");
    expect(screen.getByText("5 roles across 4 workplaces, one current.")).toBeInTheDocument();
  });

  it("states real counts in Polish", () => {
    renderHome("pl");
    expect(screen.getByText("5 stanowisk w 4 miejscach pracy, w tym jedno obecne.")).toBeInTheDocument();
  });

  it("draws bars with attributes and no style attribute", () => {
    const { container } = renderHome();
    const bars = container.querySelectorAll("rect.bar");
    expect(bars[0]).toHaveAttribute("x", "60");
    expect(bars[0]).toHaveAttribute("width", "59");
    expect(bars[0]).toHaveClass("bar-running");
    expect(bars[1]).toHaveClass("bar-pass");
    expect(container.querySelector("svg.track")).toHaveAttribute("viewBox", "0 0 120 10");
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("computes the axis labels", () => {
    const { container } = renderHome();
    const labels = Array.from(container.querySelectorAll(".ticks text")).map((text) => text.textContent);
    expect(labels).toEqual(["2017", "2019", "2021", "2023", "2025"]);
  });
});

describe("experience", () => {
  it("makes each role an article with the h3 first and the status after it", () => {
    const { container } = renderHome();
    const article = container.querySelector("#role-4") as HTMLElement;
    expect(article.tagName).toBe("ARTICLE");
    expect(article.firstElementChild?.tagName).toBe("H3");
    expect(article.firstElementChild).toHaveTextContent("Software Validation Engineer, ALTEN");
    expect(within(article).getByText("PASS")).toBeInTheDocument();
    expect(within(article).getByText("Client: Thales. Gdańsk, Poland")).toBeInTheDocument();
    expect(within(article).getByText("9 months")).toBeInTheDocument();
    expect(within(article).getByText("Performed code reviews")).toBeInTheDocument();
  });

  it("shows RUNNING with the computed duration and never FAIL", () => {
    const { container } = renderHome();
    const current = container.querySelector("#role-1") as HTMLElement;
    expect(within(current).getByText("RUNNING")).toBeInTheDocument();
    expect(within(current).getByText("4 years 11 months")).toBeInTheDocument();
    expect(container.querySelector("#experience")?.textContent).not.toContain("FAIL");
  });

  it("puts machine-readable dates on time elements", () => {
    const { container } = renderHome();
    const times = container.querySelectorAll("#role-2 time");
    expect(times[0]).toHaveAttribute("datetime", "2021-04");
    expect(times[1]).toHaveAttribute("datetime", "2022-01");
    expect(times[0]).toHaveTextContent("Apr 2021");
  });

  it("omits empty fields and lists", () => {
    const { container } = renderHome();
    const article = container.querySelector("#role-1") as HTMLElement;
    expect(article.querySelector(".meta")).toBeNull();
    expect(article.querySelector("ul")).toBeNull();
  });

  it("keeps the key sentence under the heading", () => {
    renderHome();
    const heading = screen.getByRole("heading", { level: 2, name: "Experience" });
    expect(heading.nextElementSibling).toHaveTextContent("PASS: role finished. RUNNING: current role.");
  });

  it("handles the nulls the backend can send", () => {
    const withNulls = {
      ...CONTENT,
      profile: { ...CONTENT.profile, githubUrl: null, publicEmail: null },
      experiences: [{ ...CONTENT.experiences[0], client: null, location: null, end: null }],
    } as unknown as PublicContent;
    const { container } = renderHome("en", withNulls);
    expect(within(container.querySelector("#role-1") as HTMLElement).getByText("RUNNING")).toBeInTheDocument();
    expect(container.textContent).not.toContain("null");
  });
});

describe("English status words on the Polish page", () => {
  it("are marked as English in the records and the key", () => {
    const { container } = renderHome("pl");
    const current = container.querySelector("#role-1") as HTMLElement;
    expect(within(current).getByText("RUNNING")).toHaveAttribute("lang", "en");
    expect(within(container.querySelector("#role-2") as HTMLElement).getByText("PASS")).toHaveAttribute("lang", "en");
    const key = container.querySelector(".key") as HTMLElement;
    expect(key).toHaveTextContent("PASS: stanowisko zakończone. RUNNING: obecne stanowisko.");
    expect(key.querySelectorAll('[lang="en"]')).toHaveLength(2);
  });

  it("need no marking on the English page", () => {
    const { container } = renderHome("en");
    expect(within(container.querySelector("#role-1") as HTMLElement).getByText("RUNNING")).not.toHaveAttribute("lang");
  });

  it("sit beside full-word durations, with the date range kept together", () => {
    const { container } = renderHome("pl");
    const current = container.querySelector("#role-1") as HTMLElement;
    expect(within(current).getByText("4 lata 11 miesięcy")).toBeInTheDocument();
    expect(current.querySelector(".date-range")).toHaveTextContent("sty 2022 – obecnie");
  });
});

describe("contact intro", () => {
  it("uses the plain wording, with and without LinkedIn", () => {
    const { container, unmount } = renderHome();
    expect(container.querySelector("#contact p")).toHaveTextContent("Use the form below, or find me on LinkedIn.");
    unmount();

    const profile = { ...CONTENT.profile };
    delete profile.linkedinUrl;
    const without = renderHome("en", { ...CONTENT, profile });
    expect(without.container.querySelector("#contact p")).toHaveTextContent(/^Use the form below\.$/);
  });

  it("reads naturally in Polish", () => {
    const { container } = renderHome("pl");
    expect(container.querySelector("#contact p")).toHaveTextContent(
      "Napisz do mnie przez formularz albo znajdź mnie na LinkedInie.",
    );
  });
});

describe("skills and credentials", () => {
  it("groups certifications and shows education", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 3, name: "Certifications, LinkedIn Learning, 2021" })).toBeInTheDocument();
    expect(screen.getByText("Jenkins, Azure Pipelines")).toBeInTheDocument();
    expect(screen.getByText(/Gdynia Maritime University, 2014 to 2018/)).toBeInTheDocument();
  });
});

describe("projects", () => {
  it("hides the section when there are none, including its nav link", () => {
    const { container } = renderHome();
    expect(container.querySelector("#projects")).toBeNull();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  });

  it("shows a published project with its status as text", () => {
    const { container } = renderHome("en", {
      ...CONTENT,
      projects: [
        {
          slug: "portfolio",
          name: "This portfolio",
          summary: "The site you are reading.",
          status: "IN_DEVELOPMENT",
          tech: ["Next.js", "Playwright"],
          liveUrl: "https://example.com",
        },
      ],
    });
    const section = container.querySelector("#projects") as HTMLElement;
    expect(section).toHaveTextContent("In development");
    expect(section).not.toHaveTextContent("RUNNING");
    expect(section).not.toHaveTextContent("PASS");
    expect(within(section).getByText("Next.js, Playwright")).toBeInTheDocument();
    expect(within(section).getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
  });
});

describe("contact and footer", () => {
  it("links LinkedIn safely and hides GitHub when not set", () => {
    renderHome();
    const footer = screen.getByRole("contentinfo");
    const linkedin = within(footer).getByRole("link", { name: "LinkedIn" });
    expect(linkedin).toHaveAttribute("href", CONTENT.profile.linkedinUrl);
    expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(footer).queryByRole("link", { name: "GitHub" })).toBeNull();
    expect(within(footer).getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/en/privacy");
  });

  it("shows GitHub and the email only when set", () => {
    renderHome("en", {
      ...CONTENT,
      profile: { ...CONTENT.profile, githubUrl: "https://github.com/example", publicEmail: "a+b@example.com" },
    });
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "a+b@example.com" })).toHaveAttribute(
      "href",
      "mailto:a%2Bb@example.com",
    );
  });
});

describe("page structure", () => {
  it("has landmarks, a skip link and an ordered heading outline", () => {
    const { container } = renderHome();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to experience" })).toHaveAttribute("href", "#experience");

    const levels = Array.from(container.querySelectorAll("h1, h2, h3")).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, index) => {
      expect(level - (levels[index] as number)).toBeLessThanOrEqual(1);
    });
  });

  it("offers real language links", () => {
    renderHome("pl");
    const polish = screen.getByRole("link", { name: "Polski" });
    const english = screen.getByRole("link", { name: "English" });
    expect(polish).toHaveAttribute("href", "/pl");
    expect(polish).toHaveAttribute("hreflang", "pl");
    expect(polish).toHaveAttribute("lang", "pl");
    expect(polish).toHaveAttribute("aria-current", "page");
    expect(english).toHaveAttribute("href", "/en");
    expect(english).not.toHaveAttribute("aria-current");
  });
});
