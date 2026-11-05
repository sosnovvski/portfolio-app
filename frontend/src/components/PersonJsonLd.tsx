import type { Profile } from "@/api/types";
import type { AppLocale } from "@/i18n/routing";
import { personJsonLd, serializeJsonLd } from "@/lib/seo";

/**
 * The one use of dangerouslySetInnerHTML on the site: React would escape the JSON otherwise.
 * serializeJsonLd escapes every `<`, so no value can close the script element.
 */
export function PersonJsonLd({
  profile,
  locale,
  base,
  nonce,
}: {
  profile: Profile;
  locale: AppLocale;
  base: URL;
  nonce: string | undefined;
}) {
  return (
    <script
      type="application/ld+json"
      {...(nonce ? { nonce } : {})}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd(profile, locale, base)) }}
    />
  );
}
