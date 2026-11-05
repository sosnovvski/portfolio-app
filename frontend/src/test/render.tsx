import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import type { PublicContent } from "@/api/types";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";

export const MESSAGES = { en, pl };

export function renderIn(locale: "en" | "pl", element: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

export const NOW = { year: 2026, month: 11 };

export const CONTENT: PublicContent = {
  profile: {
    fullName: "Kamil Sosnowski",
    headline: "Senior QA Automation / Software Engineer / Test Lead",
    summary: "First paragraph.\n\nSecond paragraph.",
    location: "Gdańsk, Poland",
    linkedinUrl: "https://www.linkedin.com/in/example/",
  },
  experiences: [
    { id: 1, employer: "Self-employed", role: "Senior Test Automation Engineer", start: "2022-01", achievements: [] },
    {
      id: 2,
      employer: "EPAM Systems",
      role: "Software QA Team Lead",
      location: "Gdańsk, Poland",
      start: "2021-04",
      end: "2022-01",
      achievements: [],
    },
    {
      id: 3,
      employer: "EPAM Systems",
      role: "Test Automation Engineer",
      start: "2021-02",
      end: "2021-04",
      achievements: [],
    },
    {
      id: 4,
      employer: "ALTEN",
      client: "Thales",
      role: "Software Validation Engineer",
      location: "Gdańsk, Poland",
      start: "2020-06",
      end: "2021-02",
      achievements: ["Performed code reviews"],
    },
    {
      id: 5,
      employer: "Jabil",
      role: "Junior Test Engineer, internship",
      start: "2017-07",
      end: "2017-09",
      achievements: [],
    },
  ],
  skillGroups: [{ name: "CI/CD", skills: ["Jenkins", "Azure Pipelines"] }],
  credentials: [
    { kind: "CERTIFICATION", title: "Advanced Selenium", issuer: "LinkedIn Learning", startYear: 2021 },
    { kind: "EDUCATION", title: "Engineer's degree", issuer: "Gdynia Maritime University", startYear: 2014, endYear: 2018 },
  ],
  projects: [],
};
