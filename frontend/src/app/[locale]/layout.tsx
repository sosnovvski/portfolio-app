import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";
import { mono, sans } from "../fonts";
import "../globals.css";

/** From the runtime SITE_URL, not a NEXT_PUBLIC_ value, because the same image runs on any domain. */
export function generateMetadata(): Metadata {
  return { metadataBase: siteUrl() };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Everything below renders per request, so the build needs no backend.
  await connection();

  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`} data-scroll-behavior="smooth">
      <body>
        {/* Only what client components need goes to the browser. */}
        <NextIntlClientProvider messages={{ contact: messages.contact, error: messages.error }}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
