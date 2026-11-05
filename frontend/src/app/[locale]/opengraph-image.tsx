import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasLocale } from "next-intl";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getContent } from "@/api/content";
import type { Profile } from "@/api/types";
import { routing } from "@/i18n/routing";
import { OG_IMAGE_SIZE, ogNameFontSize } from "@/lib/seo";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

// Local files, so rendering makes no external request. Satori reads woff but not woff2, so next/font's
// files cannot be reused. Each file has its own family name, with the latin-ext one as an explicit
// fallback: under one shared name Satori mixed weights letter by letter in text with Polish letters.
const NAME_FONT = "SG Name, SG Name Ext";
const TEXT_FONT = "SG Text, SG Text Ext";

function font(name: string) {
  return readFile(join(process.cwd(), "assets/fonts", name));
}

const [regularLatin, regularExt, boldLatin, boldExt] = await Promise.all([
  font("schibsted-grotesk-latin-400-normal.woff"),
  font("schibsted-grotesk-latin-ext-400-normal.woff"),
  font("schibsted-grotesk-latin-800-normal.woff"),
  font("schibsted-grotesk-latin-ext-800-normal.woff"),
]);

/** Inline styles are safe here: this renders to a PNG, never to HTML, so the CSP does not apply. */
function Card({ profile }: { profile: Profile }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        backgroundColor: "#0F2229",
        color: "#EFEADF",
        fontFamily: TEXT_FONT,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: NAME_FONT,
          fontSize: ogNameFontSize(profile.fullName),
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {profile.fullName}
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 400, lineHeight: 1.25, marginTop: 36 }}>
        {profile.headline}
      </div>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 400, color: "#A9B8BA", marginTop: 20 }}>
        {profile.location}
      </div>
      <div style={{ display: "flex", width: 420, height: 18, marginTop: 56, backgroundColor: "#7FE0B0" }} />
    </div>
  );
}

function failure(status: number, text: string): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

/**
 * The name and headline come from the API. If it is down this answers 503 rather than a card with
 * invented or missing facts: the page is unavailable then too, and a crawler can try again.
 */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  await connection();

  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return failure(404, "Not found");
  }

  let profile: Profile;
  try {
    ({ profile } = await getContent(locale));
  } catch {
    return failure(503, "The image is unavailable because the content could not be loaded.");
  }

  return new ImageResponse(<Card profile={profile} />, {
    ...OG_IMAGE_SIZE,
    // ImageResponse would otherwise mark it immutable for a year, and the profile can be edited.
    headers: { "Cache-Control": "public, max-age=3600" },
    fonts: [
      { name: "SG Text", data: regularLatin, weight: 400, style: "normal" },
      { name: "SG Text Ext", data: regularExt, weight: 400, style: "normal" },
      { name: "SG Name", data: boldLatin, weight: 800, style: "normal" },
      { name: "SG Name Ext", data: boldExt, weight: 800, style: "normal" },
    ],
  });
}
