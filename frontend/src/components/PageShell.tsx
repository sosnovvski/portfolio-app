import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Profile } from "@/api/types";
import { routing } from "@/i18n/routing";
import { safeHttpsUrl } from "@/lib/links";
import { ExternalLink } from "./ExternalLink";

const LANGUAGE_NAMES = { en: "English", pl: "Polski" } as const;

export interface VisibleSections {
  experience: boolean;
  skills: boolean;
  projects: boolean;
}

function SiteHeader({ path, sections }: { path: "" | "/privacy"; sections: VisibleSections }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  // On the home page the anchors stay on the page; from elsewhere they lead back to it.
  const anchorBase = path === "" ? "" : `/${locale}`;

  return (
    <header className="top">
      <nav aria-label={t("sections")}>
        {sections.experience && <a href={`${anchorBase}#experience`}>{t("experience")}</a>}
        {sections.skills && <a href={`${anchorBase}#skills`}>{t("skills")}</a>}
        {sections.projects && <a href={`${anchorBase}#projects`}>{t("projects")}</a>}
        <a href={`${anchorBase}#contact`}>{t("contact")}</a>
      </nav>
      <nav className="lang" aria-label={t("language")}>
        {routing.locales.map((language) => (
          <a
            key={language}
            href={`/${language}${path}`}
            lang={language}
            hrefLang={language}
            {...(language === locale ? { "aria-current": "page" as const } : {})}
          >
            {LANGUAGE_NAMES[language]}
          </a>
        ))}
      </nav>
    </header>
  );
}

function SiteFooter({ profile }: { profile: Profile }) {
  const t = useTranslations("footer");
  const locale = useLocale();
  const linkedinUrl = safeHttpsUrl(profile.linkedinUrl);
  const githubUrl = safeHttpsUrl(profile.githubUrl);

  return (
    <footer>
      <span>{profile.fullName}</span>
      {linkedinUrl && <ExternalLink href={linkedinUrl}>{t("linkedin")}</ExternalLink>}
      {githubUrl && <ExternalLink href={githubUrl}>{t("github")}</ExternalLink>}
      <a href={`/${locale}/privacy`}>{t("privacy")}</a>
    </footer>
  );
}

export function PageShell({
  path,
  profile,
  sections,
  children,
}: {
  path: "" | "/privacy";
  profile: Profile;
  sections: VisibleSections;
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const skipToExperience = path === "" && sections.experience;

  return (
    <>
      <a className="skip" href={skipToExperience ? "#experience" : "#main"}>
        {skipToExperience ? t("skipToExperience") : t("skipToMain")}
      </a>
      <div className="wrap">
        <SiteHeader path={path} sections={sections} />
        <main id="main">{children}</main>
        <SiteFooter profile={profile} />
      </div>
    </>
  );
}
