"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProjects,
  getHistory,
  NETWORK,
  type RwaProject,
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
  LinkIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
} from "../../src/lib/icons";

/** Animated count-up for a small headline figure. */
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
  const [projects, setProjects] = useState<RwaProject[]>([]);
  const [history, setHistory] = useState<VerificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([getProjects(), getHistory()]);
    setProjects(p);
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

  const { total, backedCount, attention } = useMemo(() => {
    const t = projects.length;
    const b = projects.filter((p) => p.backed).length;
    return { total: t, backedCount: b, attention: t - b };
  }, [projects]);

  const animatedBacked = useCountUp(backedCount);
  const loaded = total > 0;
  const allBacked = loaded && attention === 0;

  const overviewGlow = {
    ["--glow" as string]: allBacked
      ? "rgba(16,185,129,0.14)"
      : "rgba(251,191,36,0.13)",
  } as React.CSSProperties;

  return (
    <main className="container">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <ShieldIcon width={19} height={19} />
          </span>
          <div>
            <div className="brand-name">zk-pob</div>
            <div className="brand-sub">Proof of Backing · RWA registry</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="net-pill">
            <span className="dot" aria-hidden />
            {NETWORK}
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

      {/* PORTFOLIO OVERVIEW */}
      <section className="hero rise d1" aria-label="Backing overview">
        <div className="eyebrow">Backing overview</div>
        <div className="status-panel" style={overviewGlow}>
          <div className="overview-main">
            <div className="overview-figure">
              <span className="amount mono">{loaded ? animatedBacked : "—"}</span>
              <span className="of">/ {loaded ? total : "—"}</span>
            </div>
            <div className="overview-label">RWA projects fully backed</div>
          </div>

          <div className="overview-stats">
            <div className="item">
              <div className="k">Projects</div>
              <div className="v mono">{loaded ? total : "—"}</div>
            </div>
            <div className="item">
              <div className="k">Fully backed</div>
              <div className="v mono ok">{loaded ? backedCount : "—"}</div>
            </div>
            <div className="item">
              <div className="k">Attention</div>
              <div className={`v mono ${attention > 0 ? "warn" : ""}`}>
                {loaded ? attention : "—"}
              </div>
            </div>
          </div>

          <div
            className={`badge ${!loaded ? "idle" : allBacked ? "ok" : "warn"}`}
            role="status"
            aria-live="polite"
          >
            <span className="ring" aria-hidden />
            {!loaded ? (
              <>Checking on-chain…</>
            ) : allBacked ? (
              <>
                <CheckIcon width={18} height={18} /> All systems backed
              </>
            ) : (
              <>
                {attention} need{attention === 1 ? "s" : ""} attention
              </>
            )}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="section rise d2" aria-label="RWA projects">
        <div className="section-head">
          <h2 className="section-title">RWA projects</h2>
          <span className="section-note">Each verified independently on-chain</span>
        </div>
        <div className="projects-grid">
          {projects.map((p) => (
            <article key={p.id} className={`project ${p.backed ? "" : "attn"}`}>
              <div className="project-head">
                <span className="tag">{p.category}</span>
                <span className={`pill ${p.backed ? "ok" : "fail"}`}>
                  <span className="ring" aria-hidden />
                  {p.backed ? "Backed" : "Under-backed"}
                </span>
              </div>

              <div className="project-name">
                <span className="sym">{p.symbol}</span>
                <span className="full">{p.name}</span>
              </div>

              <div className="project-supply">
                <span className="amount mono">{formatAmount(p.supply)}</span>
                <span className="unit">{p.unit}</span>
              </div>

              <div className="project-meta">
                <div className="item">
                  <span className="k">Verified</span>
                  <span className="v mono">{formatLedger(p.verifiedLedger)}</span>
                </div>
                <div className="item">
                  <span className="k">Checked</span>
                  <span className="v">{relativeTime(p.verifiedAt)}</span>
                </div>
                <div className="item">
                  <span className="k">Accounts</span>
                  <span className="v mono">{p.reserveAccounts}</span>
                </div>
              </div>

              <div className="project-foot">
                <span className="hash mono">{truncateMiddle(p.commitment, 8, 6)}</span>
                <button
                  className="icon-btn"
                  onClick={() => copy(p.commitment, `${p.symbol} commitment`)}
                  aria-label={`Copy ${p.symbol} commitment`}
                >
                  <CopyIcon width={15} height={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PRIVACY */}
      <section className="section rise d3" aria-label="Privacy">
        <div className="section-head">
          <h2 className="section-title">
            What every proof reveals — and what stays private
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
                Bound to the token and a freshness deadline.
              </li>
            </ul>
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
          <span className="section-note">Across all projects · last {history.length} checks</span>
        </div>
        <div className="table-wrap">
          <table className="history">
            <thead>
              <tr>
                <th>Asset</th>
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
                  <td className="mono">{row.asset}</td>
                  <td title={formatDateTime(row.at)}>{relativeTime(row.at)}</td>
                  <td className="hide-sm mono">{formatLedger(row.ledger)}</td>
                  <td className="num mono">
                    {formatAmount(row.supply)}{" "}
                    <span style={{ color: "var(--text-faint)" }}>{row.unit}</span>
                  </td>
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
