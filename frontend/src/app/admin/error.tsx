"use client";

export default function AdminError() {
  return (
    <main className="login">
      <h1>Something went wrong</h1>
      <p>The panel stopped because of an error. Unsaved text may be lost.</p>
      <p>
        {/* A full reload on purpose: it starts the panel from a clean state. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin">Reload the admin panel</a>
      </p>
    </main>
  );
}
