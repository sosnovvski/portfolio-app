import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";

export const sans = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-schibsted",
  display: "swap",
});

export const mono = Martian_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-martian",
  display: "swap",
});
