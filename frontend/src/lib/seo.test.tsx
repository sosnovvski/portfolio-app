import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Profile } from "@/api/types";
import { PersonJsonLd } from "@/components/PersonJsonLd";
import {
  firstSentence,
  homeMetadata,
  ogNameFontSize,
  personJsonLd,
  privacyMetadata,
  robotsRules,
  serializeJsonLd,
  sitemapEntries,
  siteUrl,
} from "./seo";

const PROFILE: Profile = {
  fullName: "Kamil Sosnowski",
  headline: "Senior QA Automation",
  summary: "First sentence here. Second sentence.\n\nAnother paragraph.",
  location: "Gdańsk, Poland",
  linkedinUrl: "https://www.linkedin.com/in/example/",
};

const BASE = new URL("https://example.com");

describe("siteUrl", () => {
  it("reads the given value and survives a missing or broken one", () => {
    expect(siteUrl("https://kamil.dev").origin).toBe("https://kamil.dev");
    expect(siteUrl("").origin).toBe("http://localhost");
    expect(siteUrl("not a url").origin).toBe("http://localhost");
  });
});

describe("homeMetadata", () => {
  it("gives the canonical and all hreflang values, with x-default on English", () => {
    const { alternates } = homeMetadata(PROFILE, "pl");
    expect(alternates?.canonical).toBe("/pl");
    expect(alternates?.languages).toEqual({ en: "/en", pl: "/pl", "x-default": "/en" });
  });

  it("describes the page for sharing", () => {
    const metadata = homeMetadata(PROFILE, "pl");
    expect(metadata.title).toBe("Kamil Sosnowski: Senior QA Automation");
    expect(metadata.description).toBe("First sentence here.");
    expect(metadata.openGraph).toMatchObject({
      type: "profile",
      url: "/pl",
      locale: "pl_PL",
      alternateLocale: ["en_US"],
      siteName: "Kamil Sosnowski",
      images: [{ url: "/pl/opengraph-image", width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

describe("privacyMetadata", () => {
  it("points at the privacy page in each language", () => {
    const metadata = privacyMetadata(PROFILE, "en", { title: "Privacy notice", description: "How it works." });
    expect(metadata.title).toBe("Privacy notice: Kamil Sosnowski");
    expect(metadata.alternates?.canonical).toBe("/en/privacy");
    expect(metadata.alternates?.languages).toEqual({
      en: "/en/privacy",
      pl: "/pl/privacy",
      "x-default": "/en/privacy",
    });
    expect(metadata.openGraph).toMatchObject({ type: "website", url: "/en/privacy" });
  });
});

describe("firstSentence", () => {
  it("stops at the first sentence of the first paragraph", () => {
    expect(firstSentence(PROFILE.summary)).toBe("First sentence here.");
  });

  it("cuts a very long sentence at a word", () => {
    const text = firstSentence(`${"word ".repeat(60)}end.`);
    expect(text.length).toBeLessThanOrEqual(161);
    expect(text.endsWith("word…")).toBe(true);
  });
});

describe("personJsonLd", () => {
  it("has the agreed fields", () => {
    expect(personJsonLd(PROFILE, "en", BASE)).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Kamil Sosnowski",
      jobTitle: "Senior QA Automation",
      url: "https://example.com/en",
      address: { "@type": "PostalAddress", addressLocality: "Gdańsk, Poland" },
      sameAs: ["https://www.linkedin.com/in/example/"],
    });
  });

  it("lists only the URLs that are set, including for the nulls the API sends", () => {
    const withGithub = personJsonLd({ ...PROFILE, githubUrl: "https://github.com/x" }, "en", BASE);
    expect(withGithub.sameAs).toEqual(["https://www.linkedin.com/in/example/", "https://github.com/x"]);

    const empty = { ...PROFILE, linkedinUrl: null, githubUrl: null, publicEmail: null } as unknown as Profile;
    expect(personJsonLd(empty, "en", BASE)).not.toHaveProperty("sameAs");
  });

  it("never contains the email", () => {
    const text = JSON.stringify(personJsonLd({ ...PROFILE, publicEmail: "kamil@example.com" }, "en", BASE));
    expect(text).not.toContain("kamil@example.com");
    expect(text).not.toContain("email");
    expect(text).not.toContain("telephone");
  });
});

describe("JSON-LD escaping", () => {
  const hostile = { ...PROFILE, fullName: "</script><script>alert(1)</script>" };

  it("escapes every <, and parses back to the same value", () => {
    const text = serializeJsonLd({ name: hostile.fullName });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: hostile.fullName });
  });

  it("a </script> in a name cannot break out of the element", () => {
    const html = renderToStaticMarkup(<PersonJsonLd profile={hostile} locale="en" base={BASE} nonce="abc" />);

    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html.endsWith("</script>")).toBe(true);

    const body = /<script[^>]*>([\s\S]*)<\/script>/.exec(html)?.[1] ?? "";
    expect((JSON.parse(body) as { name: string }).name).toBe(hostile.fullName);
  });

  it("carries the nonce and the data type", () => {
    const html = renderToStaticMarkup(<PersonJsonLd profile={PROFILE} locale="en" base={BASE} nonce="abc" />);
    expect(html).toContain('nonce="abc"');
    expect(html).toContain('type="application/ld+json"');
  });
});

describe("sitemap", () => {
  const entries = sitemapEntries(BASE);

  it("lists home and privacy in both languages", () => {
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://example.com/en",
      "https://example.com/pl",
      "https://example.com/en/privacy",
      "https://example.com/pl/privacy",
    ]);
  });

  it("gives each entry absolute hreflang alternates", () => {
    expect(entries[3]?.alternates?.languages).toEqual({
      en: "https://example.com/en/privacy",
      pl: "https://example.com/pl/privacy",
      "x-default": "https://example.com/en/privacy",
    });
  });
});

describe("robots", () => {
  it("keeps crawlers out of the admin area and the API and names the sitemap", () => {
    expect(robotsRules(BASE)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
      sitemap: "https://example.com/sitemap.xml",
    });
  });
});

describe("ogNameFontSize", () => {
  it("shrinks for long names", () => {
    expect(ogNameFontSize("Kamil Sosnowski")).toBe(120);
    expect(ogNameFontSize("a".repeat(25))).toBe(92);
    expect(ogNameFontSize("a".repeat(100))).toBe(68);
  });
});
