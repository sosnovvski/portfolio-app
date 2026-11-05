import { expect, test } from "@playwright/test";
import { logIn, watchCspViolations } from "./helpers";

const PAGES = ["/en", "/pl", "/en/privacy", "/pl/privacy", "/en/does-not-exist", "/admin"];

for (const path of PAGES) {
  test(`${path} has a strict CSP, a nonce on every script and no violations`, async ({ page, request }) => {
    const violations = watchCspViolations(page);

    const raw = await request.get(path);
    const csp = raw.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();

    const html = await raw.text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script).toContain(`nonce="${nonce}"`);
    }
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle="/);

    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
}

test("the logged-in admin screens cause no violations", async ({ page }) => {
  const violations = watchCspViolations(page);
  await logIn(page);
  for (const screen of ["experiences", "skills", "credentials", "projects", "messages", "profile"]) {
    await page.goto(`/admin#${screen}`);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("the proxy adds its security headers to pages and API responses", async ({ request }) => {
  for (const path of ["/en", "/api/public/content/en"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["server"], path).toBeUndefined();
  }
});
