import { expect, test } from "@playwright/test";
import { watchCspViolations } from "./helpers";

// The stack serves a fixture of a failed run, so these prove a failure can never look like a pass.

test("a failed run shows as failed, with its evidence", async ({ page }) => {
  const violations = watchCspViolations(page);
  await page.goto("/en");

  const section = page.locator("#ci");
  await expect(section).toContainText("How this site is tested");
  await expect(section).toContainText("FAIL");
  await expect(section).not.toContainText("PASS");
  await expect(section).toContainText("21 passed, 1 failed");
  await expect(section.getByRole("link", { name: "View run abc1234 on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/example/portfolio/actions/runs/1",
  );
  await expect(section.locator("time")).toHaveAttribute("datetime", /2026-11-01/);
  expect(violations).toEqual([]);
});

test("the Polish page shows the same result", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.locator("#ci")).toContainText("FAIL");
  await expect(page.locator("#ci")).toContainText("1 nieudany");
});

test("the result is cached by the non-root, read-only frontend container", async ({ request }) => {
  const first = await request.get("/en");
  expect(first.status()).toBe(200);

  const started = Date.now();
  const second = await request.get("/en");
  expect(second.status()).toBe(200);
  expect(await second.text()).toContain("abc1234");
  expect(Date.now() - started).toBeLessThan(1500);
});

test("the career statuses stay separate from the failed run", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#experience")).not.toContainText("FAIL");
});
