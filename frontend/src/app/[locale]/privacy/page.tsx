import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getContent } from "@/api/content";
import { PrivacyPage } from "@/components/PrivacyPage";
import { routing, type AppLocale } from "@/i18n/routing";
import { privacyMetadata } from "@/lib/seo";

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
  const t = await getTranslations({ locale, namespace: "privacy" });
  const text = { title: t("title"), description: t("description") };
  try {
    const { profile } = await getContent(locale);
    return privacyMetadata(profile, locale, text);
  } catch {
    return text;
  }
}

export default async function Page({ params }: Props) {
  const locale = await resolveLocale(params);
  const content = await getContent(locale);
  return <PrivacyPage content={content} />;
}
