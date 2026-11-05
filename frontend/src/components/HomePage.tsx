import type { PublicContent } from "@/api/types";
import { newestFirst } from "@/lib/career";
import type { YearMonth } from "@/lib/dates";
import type { QualityReport } from "@/lib/quality";
import { ContactSection } from "./ContactSection";
import { ExperienceSection } from "./ExperienceSection";
import { Hero } from "./Hero";
import { PageShell, type VisibleSections } from "./PageShell";
import { ProjectsSection } from "./ProjectsSection";
import { QualitySection } from "./QualitySection";
import { SkillsSection } from "./SkillsSection";
import { Summary } from "./Summary";

export function visibleSections(content: PublicContent): VisibleSections {
  return {
    experience: content.experiences.length > 0,
    skills: content.skillGroups.length > 0 || content.credentials.length > 0,
    projects: content.projects.length > 0,
  };
}

export function HomePage({
  content,
  now,
  quality,
}: {
  content: PublicContent;
  now: YearMonth;
  /** Null when no report is available: the section is then simply absent. */
  quality: { report: QualityReport; now: Date } | null;
}) {
  const experiences = newestFirst(content.experiences);
  const sections = visibleSections(content);

  return (
    <PageShell path="" profile={content.profile} sections={sections}>
      <Hero profile={content.profile} experiences={experiences} now={now} />
      <Summary text={content.profile.summary} />
      {sections.experience && <ExperienceSection experiences={experiences} now={now} />}
      {sections.skills && <SkillsSection skillGroups={content.skillGroups} credentials={content.credentials} />}
      <ProjectsSection projects={content.projects} />
      {quality && <QualitySection report={quality.report} now={quality.now} />}
      <ContactSection profile={content.profile} />
    </PageShell>
  );
}
