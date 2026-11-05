import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NoticePage } from "@/components/NoticePage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function NotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale();

  return (
    <NoticePage title={t("title")}>
      <p>{t("body")}</p>
      <p>
        <a href={`/${locale}`}>{t("home")}</a>
      </p>
    </NoticePage>
  );
}
