import { useLocale } from "next-intl";
import type { ReactNode } from "react";

/** PASS, RUNNING and FAIL stay English on the Polish pages, so screen readers need to know. */
export function EnglishTerm({ className, children }: { className?: string; children: ReactNode }) {
  const locale = useLocale();
  return (
    <span {...(className ? { className } : {})} {...(locale === "en" ? {} : { lang: "en" })}>
      {children}
    </span>
  );
}
