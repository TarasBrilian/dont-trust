"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  getSnapshot,
  getHistory,
  TOKEN,
  type BackingSnapshot,
  type VerificationRow,
} from "../../src/lib/mock";
import {
  formatAmount,
  formatDateTime,
  formatLedger,
  relativeTime,
  truncateMiddle,
} from "../../src/lib/format";
import {
  CheckIcon,
  CopyIcon,
  KeyIcon,
  LayersIcon,
  LinkIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
} from "../../src/lib/icons";

/** Animated count-up for the headline supply figure. */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export default function Dashboard() {
  const [snap, setSnap] = useState<BackingSnapshot | null>(null);
  const [history, setHistory] = useState<VerificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([getSnapshot(), getHistory()]);
    setSnap(s);
    setHistory(h);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const copy = useCallback(
    (text: string, label: string) => {
      void navigator.clipboard?.writeText(text);
      showToast(`${label} copied`);
    },
    [showToast],
  );

  const supply = useCountUp(snap?.supply ?? 0);
  const backed = snap?.backed ?? true;
  const glow: CSSProperties = {
    ["--glow" as string]: backed
      ? "rgba(16,185,129,0.14)"
      : "rgba(239,68,68,0.14)",
  };

  return (
    <main className="container">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <ShieldIcon width={19} height={19} />
          </span>
          <div>
            <div className="brand-name">zk-pob</div>
            <div className="brand-sub">Proof of Backing · {TOKEN.symbol}</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="net-pill">
            <span className="dot" aria-hidden />
            {snap?.network ?? "Stellar Testnet"}
          </span>
          <button
            className="btn"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh status"
          >
            <RefreshIcon className={refreshing ? "spin" : undefined} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* HERO STATUS */}
      <section className="hero rise d1" aria-label="Backing status">
        <div className="eyebrow">Backing status</div>
        <div className="status-panel" style={glow}>
          <div>
            <div className="supply-label">{TOKEN.name} — circulating supply</div>
            <div className="supply-figure">
              <span className="amount mono">{formatAmount(supply)}</span>
              <span className="ticker">{TOKEN.symbol}</span>
            </div>
            <div className="status-meta">
              <div className="item">
                <span className="k">Verified at</span>
                <span className="v mono">
                  {snap ? formatLedger(snap.verifiedLedger) : "—"}
                </span>
              </div>
              <div className="item">
                <span className="k">Last checked</span>
                <span className="v">
                  {snap ? relativeTime(snap.verifiedAt) : "—"}
                </span>
              </div>
              <div className="item">
                <span className="k">Reserve accounts</span>
                <span className="v mono">{snap?.reserveAccounts ?? "—"}</span>
              </div>
            </div>
          </div>

          <div
            className={`badge ${backed ? "ok" : "fail"}`}
            role="status"
            aria-live="polite"
          >
            <span className="ring" aria-hidden />
            {backed ? (
              <>
                <CheckIcon width={18} height={18} /> Fully Backed
              </>
            ) : (
              <>Not Backed</>
            )}
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section className="section rise d2" aria-label="Key metrics">
        <div className="section-head">
          <h2 className="section-title">Key metrics</h2>
          <span className="section-note">Read trustlessly from chain</span>
        </div>
        <div className="metrics">
          <div className="metric">
            <div className="k">
              <LayersIcon width={14} height={14} /> Total supply
            </div>
            <div className="v mono">{formatAmount(snap?.supply ?? 0)}</div>
            <div className="sub">On-chain liability</div>
          </div>
          <div className="metric">
            <div className="k">
              <ShieldIcon width={14} height={14} /> Reserves ≥ supply
            </div>
            <div className={`v ${backed ? "ok" : ""}`}>{backed ? "Yes" : "No"}</div>
            <div className="sub">Proven in zero-knowledge</div>
          </div>
          <div className="metric">
            <div className="k">
              <CheckIcon width={14} height={14} /> Verified ledger
            </div>
            <div className="v mono">
              {snap ? formatLedger(snap.verifiedLedger) : "—"}
            </div>
            <div className="sub">{snap ? relativeTime(snap.verifiedAt) : "—"}</div>
          </div>
          <div className="metric">
            <div className="k">
              <KeyIcon width={14} height={14} /> Active attestors
            </div>
            <div className="v mono">{snap?.attestors ?? "—"}</div>
            <div className="sub">On the allowlist</div>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="section rise d3" aria-label="Privacy">
        <div className="section-head">
          <h2 className="section-title">
            What the proof reveals — and what stays private
          </h2>
        </div>
        <div className="privacy">
          <div className="col reveal">
            <h3>
              <CheckIcon width={15} height={15} /> Publicly proven
            </h3>
            <ul>
              <li>
                <CheckIcon />
                Total reserves are greater than or equal to circulating supply.
              </li>
              <li>
                <CheckIcon />
                An allowlisted attestor signed this exact reserve set.
              </li>
              <li>
                <CheckIcon />
                Bound to this token and a freshness deadline.
              </li>
            </ul>
            <div className="commit-row">
              <span className="k">Reserve commitment</span>
              <span className="hash mono">
                {snap ? truncateMiddle(snap.commitment, 10, 8) : "—"}
              </span>
              {snap && (
                <button
                  className="icon-btn"
                  onClick={() => copy(snap.commitment, "Commitment")}
                  aria-label="Copy commitment"
                >
                  <CopyIcon width={15} height={15} />
                </button>
              )}
            </div>
          </div>
          <div className="col hidden">
            <h3>
              <LockIcon width={15} height={15} /> Never disclosed
            </h3>
            <ul>
              <li>
                <LockIcon />
                Individual account balances.
              </li>
              <li>
                <LockIcon />
                Custodians and counterparties.
              </li>
              <li>
                <LockIcon />
                The reserve book itself — it never touches the chain.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* HISTORY */}
      <section className="section rise d4" aria-label="Verification history">
        <div className="section-head">
          <h2 className="section-title">Verification history</h2>
          <span className="section-note">Last {history.length} checks</span>
        </div>
        <div className="table-wrap">
          <table className="history">
            <thead>
              <tr>
                <th>Time</th>
                <th className="hide-sm">Ledger</th>
                <th className="num">Supply</th>
                <th>Status</th>
                <th className="hide-sm">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td title={formatDateTime(row.at)}>{relativeTime(row.at)}</td>
                  <td className="hide-sm mono">{formatLedger(row.ledger)}</td>
                  <td className="num mono">{formatAmount(row.supply)}</td>
                  <td>
                    <span className={`pill ${row.backed ? "ok" : "fail"}`}>
                      <span className="ring" aria-hidden />
                      {row.backed ? "Backed" : "Failed"}
                    </span>
                  </td>
                  <td className="hide-sm">
                    <a
                      className="txlink mono"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        copy(row.txHash, "Transaction hash");
                      }}
                    >
                      {truncateMiddle(row.txHash)}
                      <LinkIcon width={13} height={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="foot rise d5">
        <span>
          <strong>zk-pob</strong> · Zero-knowledge proof of backing for RWA on
          Stellar.
        </span>
        <span>
          Trust anchors on the attestor&apos;s signature — ZK adds privacy, not a
          new trust assumption.
        </span>
      </footer>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        <CheckIcon width={15} height={15} />
        {toast}
      </div>
    </main>
  );
}
