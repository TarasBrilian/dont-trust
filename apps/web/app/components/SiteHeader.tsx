"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NETWORK } from "../../src/lib/mock";
import { ShieldIcon } from "../../src/lib/icons";

export default function SiteHeader() {
  const path = usePathname() ?? "/";
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="zk-pob home">
          <span className="brand-mark" aria-hidden>
            <ShieldIcon width={19} height={19} />
          </span>
          <span>
            <span className="brand-name">zk-pob</span>
            <span className="brand-sub">Proof of Backing</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Primary">
          <Link className={`nav-link ${active("/") ? "active" : ""}`} href="/">
            Dashboard
          </Link>
          <Link
            className={`nav-link ${active("/requests") ? "active" : ""}`}
            href="/requests"
          >
            Review queue
          </Link>
          <span className="net-pill">
            <span className="dot" aria-hidden />
            {NETWORK}
          </span>
          <Link className="btn nav-cta" href="/request">
            Request verification
          </Link>
        </nav>
      </div>
    </header>
  );
}
