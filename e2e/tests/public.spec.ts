import { expect, test } from "@playwright/test";

test("the root address goes to the English page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Test Person");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every fact is readable in English", async ({ page }) => {
    await page.goto("/en");
    const main = page.locator("main");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(main).toContainText("Fixture headline in English");
    await expect(main).toContainText("Lead Fixture Engineer");
    await expect(main).toContainText("Current Fixture Co");
    await expect(main).toContainText("Older Fixture Co");
    await expect(main).toContainText("Client: Fixture Client");
    await expect(main).toContainText("Apr 2021");
    await expect(main).toContainText("10 months");
    await expect(main).toContainText("Wrote fixture tests");
    await expect(main).toContainText("Fixture certificate");
    await expect(page.locator("#older-fixture-co, article").first()).toBeVisible();
  });

  test("every fact is readable in Polish", async ({ page }) => {
    await page.goto("/pl");
    const main = page.locator("main");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(main).toContainText("Testowy nagłówek po polsku");
    await expect(main).toContainText("Główny inżynier testowy");
    await expect(main).toContainText("Pisanie testów");
    await expect(main).toContainText("Certyfikat testowy");
  });

  test("records are not hidden behind an animation", async ({ page }) => {
    await page.goto("/en");
    for (const article of await page.locator("#experience article").all()) {
      await expect(article).toHaveCSS("opacity", "1");
    }
  });
});

test("unpublished roles and an empty project list stay out of the page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("body")).not.toContainText("Hidden Fixture Co");
  await expect(page.locator("#projects")).toHaveCount(0);
});

test("the language switch keeps a real link to the other language", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Polski" }).click();
  await expect(page).toHaveURL(/\/pl$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.locator("main")).toContainText("Główny inżynier testowy");
});

test("visitors get no cookies, and the API allows no other origin", async ({ page, request }) => {
  await page.goto("/en");
  await page.goto("/en/privacy");
  expect(await page.context().cookies()).toEqual([]);

  const api = await request.get("/api/public/content/en", { headers: { Origin: "https://elsewhere.test" } });
  expect(api.status()).toBe(200);
  expect(api.headers()["set-cookie"]).toBeUndefined();
  expect(api.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("records slide in once as they are scrolled into view", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 500 });
  await page.goto("/en");
  const record = page.locator("#experience article").first();
  await expect(record).toHaveCSS("opacity", "0");

  await record.scrollIntoViewIfNeeded();

  await expect(record).toHaveCSS("opacity", "1");
  await expect(record).toHaveCSS("transform", "none");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBe(0);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("records are never hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 500 });
    await page.goto("/en");
    await expect(page.locator("#experience article").first()).toHaveCSS("opacity", "1");
  });
});

test("an unknown page answers 404 with a way home", async ({ page }) => {
  const response = await page.goto("/en/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
});

test("backend internals are not reachable through the site", async ({ request }) => {
  for (const path of ["/actuator/health", "/actuator/env", "/v3/api-docs"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["content-type"] ?? "", path).not.toContain("application/vnd.spring-boot.actuator");
    expect(await response.text(), path).not.toContain('"openapi"');
  }
});
