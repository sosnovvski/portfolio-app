import { useTranslations } from "next-intl";
import type { Credential, SkillGroup } from "@/api/types";
import { safeHttpsUrl } from "@/lib/links";
import { ExternalLink } from "./ExternalLink";

function CredentialTitle({ credential }: { credential: Credential }) {
  const href = safeHttpsUrl(credential.url);
  return href ? <ExternalLink href={href}>{credential.title}</ExternalLink> : <>{credential.title}</>;
}

/** Certifications from one issuer in one year share a heading, as in the mockup. */
function groupCertifications(certifications: readonly Credential[]): { key: string; items: Credential[] }[] {
  const groups = new Map<string, Credential[]>();
  for (const credential of certifications) {
    const key = [credential.issuer, credential.startYear].filter(Boolean).join(", ");
    groups.set(key, [...(groups.get(key) ?? []), credential]);
  }
  return Array.from(groups, ([key, items]) => ({ key, items }));
}

function EducationEntry({ credential }: { credential: Credential }) {
  const t = useTranslations("dates");
  const years =
    credential.startYear && credential.endYear
      ? `${credential.startYear} ${t("to")} ${credential.endYear}`
      : (credential.startYear ?? credential.endYear);

  return (
    <p>
      <CredentialTitle credential={credential} />
      <br />
      {[credential.issuer, years].filter(Boolean).join(", ")}
    </p>
  );
}

export function SkillsSection({
  skillGroups,
  credentials,
}: {
  skillGroups: readonly SkillGroup[];
  credentials: readonly Credential[];
}) {
  const t = useTranslations("skills");
  const certifications = groupCertifications(credentials.filter((credential) => credential.kind === "CERTIFICATION"));
  const education = credentials.filter((credential) => credential.kind === "EDUCATION");

  return (
    <section id="skills" aria-labelledby="skills-h">
      <h2 id="skills-h">{t("heading")}</h2>
      <div className="cols">
        <div>
          {skillGroups.map((group) => (
            <div key={group.name}>
              <h3>{group.name}</h3>
              <p>{group.skills.join(", ")}</p>
            </div>
          ))}
        </div>
        <div>
          {certifications.map((group) => (
            <div key={group.key}>
              <h3>
                {t("certifications")}
                {group.key && `, ${group.key}`}
              </h3>
              <ul>
                {group.items.map((credential) => (
                  <li key={credential.title}>
                    <CredentialTitle credential={credential} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {education.length > 0 && (
            <>
              <h3>{t("education")}</h3>
              {education.map((credential) => (
                <EducationEntry key={credential.title} credential={credential} />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
