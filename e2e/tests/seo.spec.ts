import { expect, test } from "@playwright/test";

const SITE = "http://localhost:8088";
const CRAWLER = { "User-Agent": "LinkedInBot/1.0 (compatible; Mozilla/5.0)" };

function tag(html: string, pattern: RegExp): string | undefined {
  return pattern.exec(html)?.[1];
}

for (const [locale, other, headline] of [
  ["en", "pl", "Fixture headline in English"],
  ["pl", "en", "Testowy nagłówek po polsku"],
] as const) {
  test(`/${locale} gives a crawler its metadata in the initial HTML`, async ({ request }) => {
    const response = await request.get(`/${locale}`, { headers: CRAWLER });
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(tag(html, /<title>([^<]*)<\/title>/)).toContain("Test Person");
    expect(tag(html, /<link rel="canonical" href="([^"]+)"/)).toBe(`${SITE}/${locale}`);
    expect(tag(html, /<meta property="og:title" content="([^"]+)"/)).toContain("Test Person");
    expect(tag(html, /<meta property="og:url" content="([^"]+)"/)).toBe(`${SITE}/${locale}`);
    expect(tag(html, /<meta property="og:image" content="([^"]+)"/)).toContain(`${SITE}/${locale}/opengraph-image`);
    expect(html).toContain(`hrefLang="${other}"`);
    expect(html).toContain('hrefLang="x-default"');
    expect(html).toContain(headline);
  });

  test(`/${locale} has a preview image`, async ({ request }) => {
    const response = await request.get(`/${locale}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(1000);
  });
}

test("structured data names the person and holds no private contact details", async ({ page }) => {
  await page.goto("/en");
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  const person = JSON.parse(raw ?? "{}") as Record<string, unknown>;

  expect(person["@type"]).toBe("Person");
  expect(person.name).toBe("Test Person");
  expect(person.sameAs).toContain("https://example.test/in/test-person");
  expect(raw).not.toContain("telephone");
  expect(raw).not.toContain("person@example.test");
});

test("sitemap and robots point at the configured site and hide the panel", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/en", "/pl", "/en/privacy", "/pl/privacy"]) {
    expect(sitemap).toContain(`<loc>${SITE}${path}</loc>`);
  }
  expect(sitemap).not.toContain("/admin");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /api");
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("the admin panel asks not to be indexed", async ({ request }) => {
  const html = await (await request.get("/admin")).text();
  expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
});

test("icons load", async ({ request }) => {
  for (const path of ["/favicon.ico", "/icon.svg"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
