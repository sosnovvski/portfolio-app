import { useLocale, useTranslations } from "next-intl";
import { formatMonth, parseYearMonth } from "@/lib/dates";

function MonthTime({ value, locale }: { value: string; locale: string }) {
  return <time dateTime={value}>{formatMonth(parseYearMonth(value), locale)}</time>;
}

/** Dates are always text: a bar never carries the only copy of a date. */
export function DateRange({ start, end }: { start: string; end: string | null | undefined }) {
  const locale = useLocale();
  const t = useTranslations("dates");

  return (
    <span className="date-range">
      <MonthTime value={start} locale={locale} />{" "}
      {end ? (
        <>
          {t("to")} <MonthTime value={end} locale={locale} />
        </>
      ) : (
        <b className="running">{t("toPresent")}</b>
      )}
    </span>
  );
}
