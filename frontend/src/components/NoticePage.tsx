import type { ReactNode } from "react";

/** The plain page for errors and unknown addresses, which must work without any content from the API. */
export function NoticePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="wrap">
      <main id="main" className="doc notice">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
