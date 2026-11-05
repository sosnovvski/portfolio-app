import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { buildCsp, createNonce } from "./lib/csp";

const intlMiddleware = createMiddleware(routing);

function isAdmin(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    siteUrl: process.env["SITE_URL"],
    development: process.env.NODE_ENV === "development",
  });

  // Next reads the nonce from the request's CSP header and puts it on its own scripts.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  // next-intl copies these headers into its own response, so they reach the render. It reads only the
  // address and headers of this request, which is why the body is not passed on.
  const response = isAdmin(request.nextUrl.pathname)
    ? NextResponse.next({ request: { headers } })
    : intlMiddleware(new NextRequest(request.url, { headers }));

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Never the API, which Caddy routes away from Next, Next's own files, or the file routes in app/, which would
  // otherwise be redirected to a locale. Anything else, including /x.png, goes to a locale, so it gets our not-found
  // page and not Next's default, whose inline styles the CSP blocks. A file added to public/ must be listed here too.
  matcher: ["/((?!api(?:/|$)|_next/|favicon\\.ico$|icon\\.svg$|robots\\.txt$|sitemap\\.xml$|[^/]+/opengraph-image$).*)"],
};
