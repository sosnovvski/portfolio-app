import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { sitemapEntries, siteUrl } from "@/lib/seo";

/** connection() keeps this out of the build, so it uses the SITE_URL of the running container. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries(siteUrl());
}
