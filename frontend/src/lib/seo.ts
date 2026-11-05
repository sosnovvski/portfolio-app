import type { Metadata, MetadataRoute } from "next";
import type { Profile } from "@/api/types";
import { routing, type AppLocale } from "@/i18n/routing";
import { safeHttpsUrl } from "./links";

const OG_LOCALES: Record<AppLocale, string> = { en: "en_US", pl: "pl_PL" };
const DESCRIPTION_LIMIT = 160;
const FALLBACK_SITE_URL = "http://localhost";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

type PagePath = "" | "/privacy";

/** Read at request time, never at build, so one image can run on any domain. */
export function siteUrl(value: string | undefined = process.env["SITE_URL"]): URL {
  try {
    return new URL(value || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

function absolute(base: URL, path: string): string {
  return new URL(path, base).toString();
}

/** The only source of hreflang: next-intl's alternateLinks stays off. */
function languageAlternates(path: PagePath): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `/${locale}${path}`;
  }
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return languages;
}

export function firstSentence(summary: string): string {
  const paragraph = summary.split(/\r?\n\s*\r?\n/)[0]?.trim() ?? "";
  const sentence = paragraph.split(/(?<=[.!?])\s/)[0] ?? "";
  if (sentence.length <= DESCRIPTION_LIMIT) {
    return sentence;
  }
  return `${sentence.slice(0, DESCRIPTION_LIMIT).replace(/\s+\S*$/, "")}…`;
}

interface PageMetadataInput {
  locale: AppLocale;
  path: PagePath;
  title: string;
  description: string;
  siteName: string;
  imageAlt: string;
  ogType: "profile" | "website";
}

function pageMetadata({ locale, path, title, description, siteName, imageAlt, ogType }: PageMetadataInput): Metadata {
  const url = `/${locale}${path}`;
  const image = { url: `/${locale}/opengraph-image`, ...OG_IMAGE_SIZE, alt: imageAlt };

  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: ogType,
      title,
      description,
      url,
      siteName,
      locale: OG_LOCALES[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALES[other]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function homeMetadata(profile: Profile, locale: AppLocale): Metadata {
  const title = `${profile.fullName}: ${profile.headline}`;
  return pageMetadata({
    locale,
    path: "",
    title,
    description: firstSentence(profile.summary),
    siteName: profile.fullName,
    imageAlt: title,
    ogType: "profile",
  });
}

export function privacyMetadata(
  profile: Profile,
  locale: AppLocale,
  text: { title: string; description: string },
): Metadata {
  return pageMetadata({
    locale,
    path: "/privacy",
    title: `${text.title}: ${profile.fullName}`,
    description: text.description,
    siteName: profile.fullName,
    imageAlt: `${profile.fullName}: ${profile.headline}`,
    ogType: "website",
  });
}

/** Only public facts. Phone and email never go in, even when an email is set for the page itself. */
export function personJsonLd(profile: Profile, locale: AppLocale, base: URL) {
  const sameAs = [safeHttpsUrl(profile.linkedinUrl), safeHttpsUrl(profile.githubUrl)].filter(
    (url): url is string => url !== null,
  );
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.fullName,
    jobTitle: profile.headline,
    url: absolute(base, `/${locale}`),
    address: { "@type": "PostalAddress", addressLocality: profile.location },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** With every `<` escaped, a value such as `</script>` cannot end the script element. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function sitemapEntries(base: URL): MetadataRoute.Sitemap {
  const paths: PagePath[] = ["", "/privacy"];
  return paths.flatMap((path) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(path)).map(([language, url]) => [language, absolute(base, url)]),
    );
    return routing.locales.map((locale) => ({
      url: absolute(base, `/${locale}${path}`),
      alternates: { languages },
    }));
  });
}

export function robotsRules(base: URL): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: absolute(base, "/sitemap.xml"),
  };
}

/** Long names must still fit the 1200 px card. */
export function ogNameFontSize(name: string): number {
  if (name.length <= 18) return 120;
  if (name.length <= 30) return 92;
  return 68;
}
