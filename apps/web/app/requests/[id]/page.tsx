"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  advanceRequest,
  getRequest,
  subscribe,
  STATUS_LABEL,
  type RequestStatus,
  type VerificationRequest,
} from "../../../src/lib/requests";
import {
  formatAmount,
  formatDateTime,
  formatLedger,
  relativeTime,
  truncateMiddle,
} from "../../../src/lib/format";
import { CheckIcon, LayersIcon } from "../../../src/lib/icons";

function statusClass(s: RequestStatus): string {
  return s === "approved"
    ? "ok"
    : s === "rejected"
      ? "fail"
      : s === "review"
        ? "warn"
        : "idle";
}

export default function RequestDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [req, setReq] = useState<VerificationRequest | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setReq(getRequest(id));
    sync();
    setReady(true);
    return subscribe(sync);
  }, [id]);

  function act(status: RequestStatus, note?: string) {
    advanceRequest(id, status, note);
  }

  if (ready && !req) {
    return (
      <main className="container narrow">
        <div className="page-head rise d1">
          <h1 className="page-title">Request not found</h1>
          <p className="page-lead">
            We couldn&apos;t find request <span className="mono">{id}</span>.
          </p>
          <Link className="btn" href="/requests">
            ← Back to queue
          </Link>
        </div>
      </main>
    );
  }

  if (!req) return <main className="container narrow" />;

  const rows: [string, React.ReactNode][] = [
    ["Token contract", <span className="mono">{truncateMiddle(req.tokenContract, 10, 8)}</span>],
    ["Network", req.network],
    ["Symbol", req.symbol],
    ["Claimed supply", `${formatAmount(req.claimedSupply)} ${req.unit}`],
    ["Issuer", req.issuer],
    ["Asset class", req.assetClass],
    ["Jurisdiction", req.jurisdiction],
    ["Attestor key", <span className="mono">{truncateMiddle(req.attestorKey, 8, 6)}</span>],
    ["Reserve accounts (N)", String(req.reserveAccounts)],
    ["Attestation frequency", req.frequency],
    ["Contact", `${req.contactName} · ${req.contactEmail}`],
    [
      "Documents",
      req.documents.length ? req.documents.join(", ") : "None attached",
    ],
  ];

  return (
    <main className="container narrow">
      <div className="detail-top rise d1">
        <Link className="back" href="/requests">
          ← Review queue
        </Link>
        <div className="detail-head">
          <div>
            <div className="detail-id mono">{req.id}</div>
            <h1 className="page-title">
              {req.symbol} <span className="detail-issuer">· {req.issuer}</span>
            </h1>
          </div>
          <span className={`pill big ${statusClass(req.status)}`}>
            <span className="ring" aria-hidden />
            {STATUS_LABEL[req.status]}
          </span>
        </div>
      </div>

      {/* Reviewer actions */}
      <div className="actions-bar rise d2">
        {req.status === "submitted" && (
          <>
            <button
              className="btn run compact"
              onClick={() => act("review", "Assigned to compliance")}
            >
              Move to review
            </button>
            <button className="btn danger" onClick={() => act("rejected", "Rejected by reviewer")}>
              Reject
            </button>
          </>
        )}
        {req.status === "review" && (
          <>
            <button
              className="btn run compact"
              onClick={() => act("approved", "Attestor onboarded, first proof verified")}
            >
              <CheckIcon width={15} height={15} /> Approve &amp; onboard
            </button>
            <button className="btn danger" onClick={() => act("rejected", "Rejected after review")}>
              Reject
            </button>
          </>
        )}
        {req.status === "approved" && (
          <div className="approved-note">
            <CheckIcon width={15} height={15} /> Approved — verified at ledger{" "}
            <span className="mono">{formatLedger(req.verifiedLedger ?? 0)}</span>.
            <Link className="inline-link" href="/">
              <LayersIcon width={13} height={13} /> View on dashboard
            </Link>
          </div>
        )}
        {req.status === "rejected" && (
          <button className="btn" onClick={() => act("submitted", "Reopened")}>
            Reopen request
          </button>
        )}
      </div>

      <div className="detail-grid rise d3">
        <section className="detail-card">
          <h2 className="section-title">Request details</h2>
          <dl className="kv">
            {rows.map(([k, v]) => (
              <div className="kv-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            {req.commitment && (
              <div className="kv-row">
                <dt>Commitment</dt>
                <dd className="mono">{truncateMiddle(req.commitment, 10, 8)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="section-title">Status timeline</h2>
          <ol className="timeline">
            {req.timeline.map((t, i) => (
              <li key={i} className={`tl ${statusClass(t.status)}`}>
                <span className="tl-dot" aria-hidden />
                <div className="tl-body">
                  <div className="tl-status">{STATUS_LABEL[t.status]}</div>
                  {t.note && <div className="tl-note">{t.note}</div>}
                  <div className="tl-time" title={formatDateTime(new Date(t.at))}>
                    {relativeTime(new Date(t.at))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
