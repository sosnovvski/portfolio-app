import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

/**
 * Needs its own title as well as not-found.tsx. The server HTML uses that file's metadata, but after
 * hydration the browser's title comes from this page, the one that threw. Without this it ends up empty.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Sends unknown addresses under a locale to that locale's not-found page. */
export default function CatchAll() {
  notFound();
}
