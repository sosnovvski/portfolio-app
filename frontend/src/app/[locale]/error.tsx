"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { NoticePage } from "@/components/NoticePage";

/** Shown when the content API fails. The link does a full reload, which fetches the content again. */
export default function ErrorPage() {
  const t = useTranslations("error");
  const pathname = usePathname();

  return (
    <NoticePage title={t("title")}>
      <p>{t("body")}</p>
      <p>
        <a href={pathname}>{t("retry")}</a>
      </p>
    </NoticePage>
  );
}
