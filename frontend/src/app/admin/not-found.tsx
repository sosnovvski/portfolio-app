import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found: admin",
  robots: { index: false, follow: false },
};

export default function AdminNotFound() {
  return (
    <main className="login">
      <h1>Page not found</h1>
      <p>
        {/* A full reload on purpose: it starts the panel from a clean state. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin">Go to the admin panel</a>
      </p>
    </main>
  );
}
