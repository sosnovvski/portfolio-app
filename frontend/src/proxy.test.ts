import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp } from "./lib/csp";
import { config, proxy } from "./proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
const OVERRIDE = "x-middleware-request-";

function run(path: string) {
  return proxy(new NextRequest(`http://localhost${path}`));
}

function nonceOf(csp: string | null): string | undefined {
  return /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("matcher", () => {
  it.each(["/", "/en", "/pl/privacy", "/xx", "/admin", "/admin/messages", "/administrator", "/apiary", "/x.png"])(
    "runs on %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each(["/api", "/api/public/contact", "/_next/static/a.js", "/favicon.ico", "/icon.svg", "/robots.txt", "/sitemap.xml", "/en/opengraph-image", "/pl/opengraph-image"])("leaves %s alone", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe("locale routing", () => {
  it("redirects the root to the default locale", () => {
    const response = run("/");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en");
  });

  it("sets the locale for a locale path", () => {
    expect(run("/pl").headers.get(`${OVERRIDE}x-next-intl-locale`)).toBe("pl");
  });

  it("never captures the admin area", () => {
    for (const path of ["/admin", "/admin/x", "/admin/x.png"]) {
      expect(run(path).headers.get("location")).toBeNull();
      expect(run(path).headers.get(`${OVERRIDE}x-next-intl-locale`)).toBeNull();
    }
  });

  it("sends a stray file address to a locale, where our not-found page has the nonce", () => {
    expect(run("/x.png").headers.get("location")).toBe("http://localhost/en/x.png");
    expect(run("/pl/x.png").headers.get(`${OVERRIDE}x-next-intl-locale`)).toBe("pl");
  });

  it("still routes a path that only starts like admin", () => {
    expect(run("/administrator").headers.get("location")).toBe("http://localhost/en/administrator");
  });

  it("sets no cookie", () => {
    expect(run("/en").headers.get("set-cookie")).toBeNull();
    expect(run("/").headers.get("set-cookie")).toBeNull();
  });
});

describe("content security policy", () => {
  it.each(["/en", "/pl/privacy", "/admin", "/admin/anything"])("reaches both the render and the browser on %s", (path) => {
    const response = run(path);
    const sent = response.headers.get("Content-Security-Policy");
    expect(nonceOf(sent)).toBeTruthy();
    expect(response.headers.get(`${OVERRIDE}content-security-policy`)).toBe(sent);
    expect(response.headers.get(`${OVERRIDE}x-nonce`)).toBe(nonceOf(sent));
  });

  it("uses a new nonce per request", () => {
    const first = nonceOf(run("/en").headers.get("Content-Security-Policy"));
    const second = nonceOf(run("/en").headers.get("Content-Security-Policy"));
    expect(first).not.toBe(second);
  });

  it("adds the upgrade only for an https site, read at request time", () => {
    vi.stubEnv("SITE_URL", "http://localhost");
    expect(run("/en").headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    vi.stubEnv("SITE_URL", "https://example.com");
    expect(run("/en").headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
  });

  it("matches the agreed policy exactly in production", () => {
    expect(buildCsp({ nonce: "X", siteUrl: undefined, development: false })).toBe(
      "default-src 'self'; script-src 'self' 'nonce-X' 'strict-dynamic'; style-src 'self' 'nonce-X'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; " +
        "form-action 'self'; frame-ancestors 'none'",
    );
  });

  it("relaxes only for development", () => {
    const csp = buildCsp({ nonce: "X", siteUrl: undefined, development: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});
