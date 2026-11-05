import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTENT, renderIn } from "@/test/render";
import { PrivacyPage } from "./PrivacyPage";

describe("privacy notice", () => {
  it("states the gap when no public email is set", () => {
    renderIn("en", <PrivacyPage content={CONTENT} />);
    expect(screen.getByText(/has not been published yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
  });

  it("gives the email when it is set", () => {
    const content = { ...CONTENT, profile: { ...CONTENT.profile, publicEmail: "kamil@example.com" } };
    renderIn("en", <PrivacyPage content={content} />);
    expect(screen.queryByText(/has not been published yet/)).toBeNull();
    expect(screen.getByRole("link", { name: "kamil@example.com" })).toHaveAttribute(
      "href",
      "mailto:kamil@example.com",
    );
  });

  it("covers the Article 13 points in English", () => {
    const { container } = renderIn("en", <PrivacyPage content={CONTENT} />);
    const text = container.textContent;
    expect(text).toContain("The data controller is Kamil Sosnowski.");
    expect(text).toContain("Article 6(1)(f)");
    expect(text).toContain("12 months");
    expect(text).toContain("IP address is not stored");
    expect(text).toContain("no cookies");
    expect(screen.getByRole("link", { name: "PUODO" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("covers the Article 13 points in Polish and switches to the same page", () => {
    const { container } = renderIn("pl", <PrivacyPage content={CONTENT} />);
    const text = container.textContent;
    expect(text).toContain("Administratorem danych jest Kamil Sosnowski.");
    expect(text).toContain("art. 6 ust. 1 lit. f RODO");
    expect(text).toContain("12 miesiącach");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/privacy");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Informacja o prywatności");
  });

  it("leads header links back to the home page", () => {
    renderIn("en", <PrivacyPage content={CONTENT} />);
    expect(screen.getByRole("link", { name: "Experience" })).toHaveAttribute("href", "/en#experience");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
  });
});
