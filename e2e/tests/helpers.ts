import { expect, type Page } from "@playwright/test";

export const PASSWORD = "test-admin-password";

export async function logIn(page: Page, password = PASSWORD): Promise<void> {
  await page.goto("/admin");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  if (password === PASSWORD) {
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  }
}

/** Fails the test on any Content Security Policy report, or on a resource blocked by one. */
export function watchCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) {
      violations.push(`${page.url()}: ${message.text()}`);
    }
  });
  return violations;
}
