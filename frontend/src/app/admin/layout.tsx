import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { sans } from "../fonts";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The CSP nonce exists per request, so a prerendered page would have scripts the browser refuses to run.
  await connection();

  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
