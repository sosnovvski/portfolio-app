import { useTranslations } from "next-intl";
import type { Profile } from "@/api/types";
import { mailtoHref, safeHttpsUrl } from "@/lib/links";
import { ContactForm } from "./ContactForm";
import { ExternalLink } from "./ExternalLink";

export function ContactSection({ profile }: { profile: Profile }) {
  const t = useTranslations("contact");
  const linkedinUrl = safeHttpsUrl(profile.linkedinUrl);

  return (
    <section id="contact" aria-labelledby="contact-h">
      <h2 id="contact-h">{t("heading")}</h2>
      <p>
        {linkedinUrl
          ? t.rich("introLinkedin", {
              link: (chunks) => <ExternalLink href={linkedinUrl}>{chunks}</ExternalLink>,
            })
          : t("intro")}
        {profile.publicEmail && (
          <>
            {" "}
            {t.rich("email", {
              email: profile.publicEmail,
              link: (chunks) => <a href={mailtoHref(profile.publicEmail ?? "")}>{chunks}</a>,
            })}
          </>
        )}
      </p>
      <ContactForm />
    </section>
  );
}
