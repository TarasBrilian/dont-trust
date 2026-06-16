import type { ReactNode } from "react";

export const metadata = {
  title: "zk-pob — Proof of Backing",
  description: "Zero-knowledge proof that an RWA token is fully backed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#0b0d12",
          color: "#e8eaed",
        }}
      >
        {children}
      </body>
    </html>
  );
}
