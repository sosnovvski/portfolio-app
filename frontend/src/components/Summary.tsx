import { useTranslations } from "next-intl";

export function Summary({ text }: { text: string }) {
  const t = useTranslations("summary");
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section id="about" aria-labelledby="about-h">
      <h2 id="about-h">{t("heading")}</h2>
      <div className="summary">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
