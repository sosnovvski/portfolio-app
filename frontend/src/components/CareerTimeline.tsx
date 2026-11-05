import { useTranslations } from "next-intl";
import type { Experience } from "@/api/types";
import { barGeometry, careerCounts, roleStatus, timelineAxis, type TimelineAxis } from "@/lib/career";
import type { YearMonth } from "@/lib/dates";
import { roleAnchor } from "@/lib/links";
import { DateRange } from "./DateRange";

function AxisTicks({ axis }: { axis: TimelineAxis }) {
  return (
    <div className="axis" aria-hidden="true">
      <span />
      <svg className="ticks" width="100%" height="18">
        {axis.ticks.map((tick) => (
          <text key={tick.year} x={`${tick.percent}%`} y="13">
            {tick.year}
          </text>
        ))}
      </svg>
    </div>
  );
}

function RoleBar({ experience, axis, now }: { experience: Experience; axis: TimelineAxis; now: YearMonth }) {
  const { x, width } = barGeometry(experience, axis, now);
  const statusClass = roleStatus(experience) === "RUNNING" ? "bar-running" : "bar-pass";

  return (
    <svg className="track" viewBox={`0 0 ${axis.totalMonths} 10`} preserveAspectRatio="none" aria-hidden="true">
      {axis.ticks.map((tick) => (
        <line
          key={tick.year}
          className="gridline"
          x1={tick.months}
          x2={tick.months}
          y1="0"
          y2="10"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <rect className={`bar ${statusClass}`} x={x} y="1" width={width} height="8" />
    </svg>
  );
}

export function CareerTimeline({ experiences, now }: { experiences: readonly Experience[]; now: YearMonth }) {
  const t = useTranslations("timeline");
  const axis = timelineAxis(experiences, now);
  const counts = careerCounts(experiences);

  return (
    <div className="run">
      <h2>{t("heading", { year: axis.firstYear })}</h2>
      <p className="run-sum">
        {t("counts", {
          roles: t("roles", { count: counts.roles }),
          workplaces: t("workplaces", { count: counts.workplaces }),
          current: t("current", { count: counts.current }),
        })}
      </p>
      <div className="timeline">
        <AxisTicks axis={axis} />
        <ol className="timeline" role="list">
          {experiences.map((experience) => (
            <li key={experience.id}>
              <a className="row" href={`#${roleAnchor(experience.id)}`}>
                <div className="who">
                  <strong>{experience.role}</strong>
                  <span>
                    {experience.client ? (
                      t.rich("employerAtClient", {
                        employer: experience.employer,
                        client: experience.client,
                        org: (chunks) => <span className="org">{chunks}</span>,
                      })
                    ) : (
                      <span className="org">{experience.employer}</span>
                    )}
                    , <DateRange start={experience.start} end={experience.end} />
                  </span>
                </div>
                <RoleBar experience={experience} axis={axis} now={now} />
              </a>
            </li>
          ))}
        </ol>
      </div>
      <p className="legend">{t("legend")}</p>
    </div>
  );
}
