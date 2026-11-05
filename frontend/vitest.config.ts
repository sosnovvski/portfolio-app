import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // next-intl imports "next/server" with no extension, which plain Node ESM cannot resolve.
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // Generated types, test helpers and thin Next.js entry files, which the browser tests cover.
      exclude: [
        "src/api/schema.d.ts",
        "src/test/**",
        "src/admin/testServer.ts",
        "src/**/*.test.{ts,tsx}",
        "src/app/**/{layout,page,not-found,error,opengraph-image}.tsx",
      ],
      thresholds: { lines: 80 },
    },
  },
});
