import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Never streams metadata, so OpenGraph tags are in the initial HTML for every crawler.
  htmlLimitedBots: /.*/,
  // Pinned, so server.js lands directly in .next/standalone wherever the folder is built.
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
};

export default withNextIntl(nextConfig);
