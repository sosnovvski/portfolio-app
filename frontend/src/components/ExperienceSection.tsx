import { useTranslations } from "next-intl";
import type { Experience } from "@/api/types";
import { roleMonths, roleStatus } from "@/lib/career";
import { formatDuration, type YearMonth } from "@/lib/dates";
import { roleAnchor } from "@/lib/links";
import { DateRange } from "./DateRange";
import { ExperienceReveal } from "./ExperienceReveal";
import { EnglishTerm } from "./StatusLabel";

function ExperienceRecord({ experience, now }: { experience: Experience; now: YearMonth }) {
  const t = useTranslations("experience");
  const tDuration = useTranslations("duration");
  const status = roleStatus(experience);
  const meta = [experience.client ? t("client", { client: experience.client }) : null, experience.location]
    .filter(Boolean)
    .join(". ");

  return (
    <article className="suite" id={roleAnchor(experience.id)}>
      <h3>
        {experience.role}, {experience.employer}
      </h3>
      <div className="status">
        <EnglishTerm className={`mono ${status === "RUNNING" ? "running" : "pass"}`}>{status}</EnglishTerm>
        <DateRange start={experience.start} end={experience.end} />
        <span className="len">{formatDuration(roleMonths(experience, now), (key, values) => tDuration(key, values))}</span>
      </div>
      {meta && <p className="meta">{meta}</p>}
      {experience.achievements.length > 0 && (
        <ul className="asserts" role="list">
          {experience.achievements.map((achievement) => (
            <li key={achievement}>{achievement}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ExperienceSection({ experiences, now }: { experiences: readonly Experience[]; now: YearMonth }) {
  const t = useTranslations("experience");

  return (
    <section id="experience" aria-labelledby="exp-h">
      <h2 id="exp-h">{t("heading")}</h2>
      <p className="key">{t.rich("key", { term: (chunks) => <EnglishTerm>{chunks}</EnglishTerm> })}</p>
      {experiences.map((experience) => (
        <ExperienceRecord key={experience.id} experience={experience} now={now} />
      ))}
      <ExperienceReveal />
    </section>
  );
}
