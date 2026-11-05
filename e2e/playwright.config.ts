import { defineConfig, devices } from "@playwright/test";

const channel = process.env.E2E_BROWSER_CHANNEL;

export default defineConfig({
  testDir: "./tests",
  // Tests share one database and one rate limit budget, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }], ["junit", { outputFile: "results/junit.xml" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8088",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    ...(channel ? { channel } : {}),
  },
});
