/** Formatting helpers for the UI (en-US locale). */

const nf = new Intl.NumberFormat("en-US");

/** 1000000 -> "1,000,000" */
export function formatAmount(n: number): string {
  return nf.format(n);
}

/** Shorten a long hash/identifier: 0x1a2b…f9e0 */
export function truncateMiddle(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Relative time in English: "just now", "5 minutes ago", "2 hours ago". */
export function relativeTime(from: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (s < 30) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** Compact date-time: "Jun 16, 2026, 09:42" */
export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Ledger number: "#1,284,531" */
export function formatLedger(n: number): string {
  return `#${nf.format(n)}`;
}
