import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 320, height: 640 },
];

// Reduced motion keeps every record at full opacity, so contrast is measured on final colours.
test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target.join(" ")) })),
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of ["/en", "/pl", "/en/privacy", "/pl/privacy", "/en/does-not-exist", "/admin"]) {
      test(`${path} has no WCAG violations and no sideways scrolling`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoViolations(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBe(0);
      });
    }

    test("contact form errors have no WCAG violations", async ({ page }) => {
      await page.goto("/en#contact");
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
      await expectNoViolations(page);
    });

    for (const screen of ["profile", "experiences", "skills", "credentials", "projects", "messages"]) {
      test(`admin ${screen} has no WCAG violations`, async ({ page }) => {
        await logIn(page);
        await page.goto(`/admin#${screen}`);
        await page.waitForLoadState("networkidle");
        await expectNoViolations(page);
      });
    }

    test("an open admin editor has no WCAG violations", async ({ page }) => {
      await logIn(page);
      await page.goto("/admin#experiences");
      await page.getByRole("button", { name: "New experience" }).click();
      await expectNoViolations(page);
    });
  });
}
