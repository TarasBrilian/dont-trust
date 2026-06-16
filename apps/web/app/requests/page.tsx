"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listRequests,
  subscribe,
  STATUS_LABEL,
  type RequestStatus,
  type VerificationRequest,
} from "../../src/lib/requests";
import { formatAmount, relativeTime } from "../../src/lib/format";

type Filter = "all" | RequestStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function statusClass(s: RequestStatus): string {
  return s === "approved"
    ? "ok"
    : s === "rejected"
      ? "fail"
      : s === "review"
        ? "warn"
        : "idle";
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setRequests(listRequests());
    sync();
    setReady(true);
    return subscribe(sync);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [requests]);

  const shown = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  return (
    <main className="container">
      <div className="page-head rise d1">
        <h1 className="page-title">Review queue</h1>
        <p className="page-lead">
          Incoming RWA verification requests. Approve to onboard the attestor and
          publish the token to the dashboard.
        </p>
      </div>

      <div className="filters rise d2" role="tablist">
        {FILTERS.map((ff) => (
          <button
            key={ff.key}
            role="tab"
            aria-selected={filter === ff.key}
            className={`filter ${filter === ff.key ? "active" : ""}`}
            onClick={() => setFilter(ff.key)}
          >
            {ff.label}
            <span className="filter-count">{counts[ff.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="req-list rise d3">
        {ready && shown.length === 0 && (
          <div className="empty">No requests in this view.</div>
        )}
        {shown.map((r) => (
          <Link key={r.id} href={`/requests/${r.id}`} className="req-row">
            <div className="req-main">
              <div className="req-id mono">{r.id}</div>
              <div className="req-title">
                <span className="sym">{r.symbol}</span>
                <span className="full">{r.issuer}</span>
              </div>
            </div>
            <span className="tag">{r.assetClass}</span>
            <div className="req-supply mono">
              {formatAmount(r.claimedSupply)} <span className="muted">{r.unit}</span>
            </div>
            <div className="req-time">{relativeTime(new Date(r.createdAt))}</div>
            <span className={`pill ${statusClass(r.status)}`}>
              <span className="ring" aria-hidden />
              {STATUS_LABEL[r.status]}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
