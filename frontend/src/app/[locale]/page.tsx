import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContent } from "@/api/content";
import { HomePage } from "@/components/HomePage";
import { PersonJsonLd } from "@/components/PersonJsonLd";
import { routing, type AppLocale } from "@/i18n/routing";
import { currentYearMonth } from "@/lib/dates";
import { fetchQualityReport } from "@/lib/quality";
import { homeMetadata, siteUrl } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

async function resolveLocale(params: Props["params"]): Promise<AppLocale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  try {
    const { profile } = await getContent(locale);
    return homeMetadata(profile, locale);
  } catch {
    // The page itself reports the failure. Metadata must not hide it behind a second error.
    const t = await getTranslations({ locale, namespace: "metadata" });
    return { title: t("unavailableTitle") };
  }
}

export default async function Page({ params }: Props) {
  const locale = await resolveLocale(params);
  // Side by side, so a slow report adds no more than its own timeout, and never fails the page.
  const [content, report] = await Promise.all([getContent(locale), fetchQualityReport()]);
  const today = new Date();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <PersonJsonLd profile={content.profile} locale={locale} base={siteUrl()} nonce={nonce} />
      <HomePage
        content={content}
        now={currentYearMonth(today)}
        quality={report && { report, now: today }}
      />
    </>
  );
}
