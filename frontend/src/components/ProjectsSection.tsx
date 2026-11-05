import { useTranslations } from "next-intl";
import type { Project } from "@/api/types";
import { safeHttpsUrl } from "@/lib/links";
import { ExternalLink } from "./ExternalLink";

/** Plain words: PASS and RUNNING belong to career entries, and the key under Experience defines them that way. */
const STATUS_TEXT = { PLANNED: "planned", IN_DEVELOPMENT: "inDevelopment", LIVE: "live" } as const;

function ProjectRecord({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const repoUrl = safeHttpsUrl(project.repoUrl);
  const liveUrl = safeHttpsUrl(project.liveUrl);

  return (
    <article className="suite" id={`project-${project.slug}`}>
      <h3>{project.name}</h3>
      <div className="status">{t(STATUS_TEXT[project.status])}</div>
      {project.tech.length > 0 && <p className="meta">{project.tech.join(", ")}</p>}
      <p className="project-summary">{project.summary}</p>
      {(repoUrl || liveUrl) && (
        <p className="project-links">
          {liveUrl && <ExternalLink href={liveUrl}>{t("site", { name: project.name })}</ExternalLink>}
          {repoUrl && <ExternalLink href={repoUrl}>{t("repo", { name: project.name })}</ExternalLink>}
        </p>
      )}
    </article>
  );
}

export function ProjectsSection({ projects }: { projects: readonly Project[] }) {
  const t = useTranslations("projects");

  if (projects.length === 0) {
    return null;
  }
  return (
    <section id="projects" aria-labelledby="projects-h">
      <h2 id="projects-h">{t("heading")}</h2>
      {projects.map((project) => (
        <ProjectRecord key={project.slug} project={project} />
      ))}
    </section>
  );
}
