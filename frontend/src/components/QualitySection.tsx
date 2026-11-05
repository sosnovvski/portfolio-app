import { useLocale, useTranslations } from "next-intl";
import { isOldRun, passedCount, type QualityReport, qualityOutcome, qualityStatus, type QualitySuite } from "@/lib/quality";
import { EnglishTerm } from "./StatusLabel";

const COMMIT_DISPLAY_LENGTH = 7;
const DATE_LOCALES: Record<string, string> = { en: "en-GB", pl: "pl-PL" };
const OUTCOME_TEXT = { pass: "statusPass", testsFailed: "statusFail", otherCheckFailed: "statusOtherCheck" } as const;
const SUITE_LABELS = { backend: "backend", frontend: "frontend", browser: "browser" } as const;

function isKnownSuite(name: string): name is keyof typeof SUITE_LABELS {
  return name in SUITE_LABELS;
}

function formatRunDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
}

function useCountsText() {
  const t = useTranslations("quality");
  return (counts: { tests: number; failed: number; skipped?: number }) =>
    [
      t("passed", { count: passedCount(counts) }),
      t("failed", { count: counts.failed }),
      ...(counts.skipped ? [t("skipped", { count: counts.skipped })] : []),
    ].join(", ");
}

function SuiteRow({ suite }: { suite: QualitySuite }) {
  const t = useTranslations("quality");
  const countsText = useCountsText();

  return (
    <>
      <dt>{isKnownSuite(suite.name) ? t(`suites.${SUITE_LABELS[suite.name]}`) : suite.name}</dt>
      <dd>{countsText(suite)}</dd>
    </>
  );
}

export function QualitySection({ report, now }: { report: QualityReport; now: Date }) {
  const t = useTranslations("quality");
  const locale = useLocale();
  const countsText = useCountsText();
  const status = qualityStatus(report);
  const { backendLines, frontendLines } = report.coverage;

  return (
    <section id="ci" aria-labelledby="ci-h">
      <h2 id="ci-h">{t("heading")}</h2>
      <p className="ci-intro">{t("intro")}</p>
      <div className="ci">
        <p className="ci-status">
          <EnglishTerm className={`mono ${status === "PASS" ? "pass" : "fail"}`}>{status}</EnglishTerm>{" "}
          {t(OUTCOME_TEXT[qualityOutcome(report)])}
        </p>
        <dl>
          {report.suites.map((suite) => (
            <SuiteRow key={suite.name} suite={suite} />
          ))}
          <dt>{t("accessibility")}</dt>
          <dd>{countsText(report.accessibility)}</dd>
          {backendLines !== null && (
            <>
              <dt>{t("coverageBackend")}</dt>
              <dd>{formatPercent(backendLines, locale)}</dd>
            </>
          )}
          {frontendLines !== null && (
            <>
              <dt>{t("coverageFrontend")}</dt>
              <dd>{formatPercent(frontendLines, locale)}</dd>
            </>
          )}
          <dt>{t("date")}</dt>
          <dd>
            <time dateTime={report.finishedAt}>{formatRunDate(report.finishedAt, locale)}</time>
          </dd>
          <dt>{t("fullRun")}</dt>
          <dd>
            <a href={report.runUrl} rel="noopener noreferrer">
              {t("runLink", { commit: report.commit.slice(0, COMMIT_DISPLAY_LENGTH) })}
            </a>
          </dd>
        </dl>
        {isOldRun(report, now) && <p className="ci-old">{t("oldRun")}</p>}
      </div>
    </section>
  );
}
