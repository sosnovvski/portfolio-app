import { useTranslations } from "next-intl";
import type { PublicContent } from "@/api/types";
import { mailtoHref, safeHttpsUrl } from "@/lib/links";
import { ExternalLink } from "./ExternalLink";
import { visibleSections } from "./HomePage";
import { PageShell } from "./PageShell";

const PUODO_URL = "https://uodo.gov.pl";

function ControllerContact({ email, linkedinUrl }: { email: string | null | undefined; linkedinUrl: string | null }) {
  const t = useTranslations("privacy");

  if (email) {
    return (
      <p>
        {t.rich("contactEmail", {
          email,
          link: (chunks) => <a href={mailtoHref(email)}>{chunks}</a>,
        })}
      </p>
    );
  }
  // Art. 13 needs the controller's contact details. Until the owner publishes an email, the gap is stated plainly.
  return (
    <p className="gap">
      {linkedinUrl
        ? t.rich("contactGapLinkedin", {
            link: (chunks) => <ExternalLink href={linkedinUrl}>{chunks}</ExternalLink>,
          })
        : t("contactGap")}
    </p>
  );
}

export function PrivacyPage({ content }: { content: PublicContent }) {
  const t = useTranslations("privacy");
  const { profile } = content;

  return (
    <PageShell path="/privacy" profile={profile} sections={visibleSections(content)}>
      <div className="doc">
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>

        <h2>{t("controllerHeading")}</h2>
        <p>{t("controller", { name: profile.fullName })}</p>
        <ControllerContact email={profile.publicEmail} linkedinUrl={safeHttpsUrl(profile.linkedinUrl)} />

        <h2>{t("purposeHeading")}</h2>
        <p>{t("purpose")}</p>

        <h2>{t("basisHeading")}</h2>
        <p>{t("basis")}</p>
        <p>{t("voluntary")}</p>

        <h2>{t("storedHeading")}</h2>
        <p>{t("stored")}</p>
        <p>{t("notIp")}</p>

        <h2>{t("retentionHeading")}</h2>
        <p>{t("retention")}</p>

        <h2>{t("rightsHeading")}</h2>
        <p>{t("rights")}</p>
        <p>
          {t.rich("complaint", {
            link: (chunks) => <ExternalLink href={PUODO_URL}>{chunks}</ExternalLink>,
          })}
        </p>

        <h2>{t("cookiesHeading")}</h2>
        <p>{t("cookies")}</p>
      </div>
    </PageShell>
  );
}
