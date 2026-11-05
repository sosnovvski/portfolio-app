import { cache } from "react";
import type { AppLocale } from "@/i18n/routing";
import type { PublicContent } from "./types";

const TIMEOUT_MS = 5000;

/** Fetches on every request, once per render, so generateMetadata and the page share one call. */
export const getContent = cache(async (locale: AppLocale): Promise<PublicContent> => {
  const base = process.env["API_INTERNAL_URL"];
  if (!base) {
    throw new Error("API_INTERNAL_URL is not set");
  }

  const response = await fetch(`${base}/api/public/content/${locale}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Content API answered ${response.status}`);
  }
  return (await response.json()) as PublicContent;
});
