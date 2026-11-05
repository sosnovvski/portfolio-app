import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
  alternateLinks: false,
  // The privacy notice promises no cookies for visitors, and with detection off nothing would read it.
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];
