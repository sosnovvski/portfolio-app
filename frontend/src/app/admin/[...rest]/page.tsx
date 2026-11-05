import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** Same title as not-found.tsx, because after hydration the browser's title comes from this page. */
export const metadata: Metadata = {
  title: "Page not found: admin",
  robots: { index: false, follow: false },
};

/** Keeps unknown admin addresses inside this layout, instead of Next's default page and its inline styles. */
export default function CatchAll() {
  notFound();
}
