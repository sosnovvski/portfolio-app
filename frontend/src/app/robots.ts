import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { robotsRules, siteUrl } from "@/lib/seo";

/** connection() keeps this out of the build, so it uses the SITE_URL of the running container. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsRules(siteUrl());
}
