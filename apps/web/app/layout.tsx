import type { ReactNode } from "react";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "zk-pob — Proof of Backing",
  description:
    "Zero-knowledge proof that an RWA token is fully backed by off-chain reserves, without revealing a single balance.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
