export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

interface CspOptions {
  nonce: string;
  /** Read at runtime. Only an https site asks browsers to upgrade, so local http keeps working. */
  siteUrl: string | undefined;
  development: boolean;
}

export function buildCsp({ nonce, siteUrl, development }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // Development needs eval for React's error stacks, inline styles for its overlay and a socket for reloads.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    development ? "connect-src 'self' ws:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (siteUrl?.startsWith("https")) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}
