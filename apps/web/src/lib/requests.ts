/**
 * Client-side store for RWA verification requests (mock).
 *
 * Backed by localStorage so a request survives navigation and refresh during a
 * demo. Shapes mirror what a real backend would expose, so swapping to an API
 * later only means replacing the functions below. Approved requests are exposed
 * as RwaProject so the dashboard can show them — closing the loop.
 */
import type { RwaProject } from "./mock";

export type RequestStatus = "submitted" | "review" | "approved" | "rejected";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

export interface TimelineEntry {
  status: RequestStatus;
  at: string; // ISO
  note?: string;
}

export interface VerificationRequest {
  id: string;
  createdAt: string;
  status: RequestStatus;

  // On-chain identity
  tokenContract: string;
  network: string;
  symbol: string;
  claimedSupply: number;
  unit: string;

  // Issuer & asset
  issuer: string;
  assetClass: string;
  jurisdiction: string;

  // Attestor setup
  attestorKey: string;
  reserveAccounts: number;
  frequency: string;

  // Documents & contact
  documents: string[];
  contactName: string;
  contactEmail: string;

  // Set when approved
  commitment?: string;
  verifiedLedger?: number;

  timeline: TimelineEntry[];
}

export type NewRequestInput = Omit<
  VerificationRequest,
  "id" | "createdAt" | "status" | "timeline" | "commitment" | "verifiedLedger"
>;

const KEY = "zkpob.requests.v1";
let cache: VerificationRequest[] | null = null;
const listeners = new Set<() => void>();

const HEX = "0123456789abcdef";
function hash(len: number): string {
  let s = "0x";
  for (let i = 0; i < len; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}
function genId(): string {
  const n = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `REQ-${n}`;
}

function seed(): VerificationRequest[] {
  const now = Date.now();
  const min = 60_000;
  const t = (m: number) => new Date(now - m * min).toISOString();
  return [
    {
      id: "REQ-8A21",
      createdAt: t(35),
      status: "review",
      tokenContract: "CABZ3K7P2QJ5VYT6WX9N4M8RHF2LDQE7SC1UVB0AKG5YHN3PXOIWMRTD",
      network: "Stellar Testnet",
      symbol: "fUSD",
      claimedSupply: 2_500_000,
      unit: "fUSD",
      issuer: "Fjord Capital Ltd.",
      assetClass: "Treasury",
      jurisdiction: "Singapore",
      attestorKey: "0x2f8a…BJJ…c41d",
      reserveAccounts: 8,
      frequency: "Daily",
      documents: ["custodian-statement.pdf", "audit-engagement.pdf"],
      contactName: "Lena Marsh",
      contactEmail: "lena@fjordcapital.example",
      timeline: [
        { status: "submitted", at: t(35) },
        { status: "review", at: t(28), note: "Assigned to compliance" },
      ],
    },
    {
      id: "REQ-5C09",
      createdAt: t(120),
      status: "submitted",
      tokenContract: "CDLM9P0QX2K7VYT6WX9N4M8RHF2LDQE7SC1UVB0AKG5YHN3PXOIWZZTD",
      network: "Stellar Testnet",
      symbol: "AGRO",
      claimedSupply: 640_000,
      unit: "AGRO",
      issuer: "Verde Agro Holdings",
      assetClass: "Commodities",
      jurisdiction: "Brazil",
      attestorKey: "0x7c10…BJJ…9e22",
      reserveAccounts: 6,
      frequency: "Weekly",
      documents: ["warehouse-receipts.pdf"],
      contactName: "Caio Ribeiro",
      contactEmail: "caio@verde.example",
      timeline: [{ status: "submitted", at: t(120) }],
    },
    {
      id: "REQ-3F77",
      createdAt: t(1440),
      status: "approved",
      tokenContract: "CAQK7P2QJ5VYT6WX9N4M8RHF2LDQE7SC1UVB0AKG5YHN3PXOIWLMNTD",
      network: "Stellar Testnet",
      symbol: "PROP",
      claimedSupply: 9_800_000,
      unit: "PROP",
      issuer: "Harbor Real Estate Trust",
      assetClass: "Real estate",
      jurisdiction: "United States",
      attestorKey: "0x4d53…BJJ…a3b7",
      reserveAccounts: 8,
      frequency: "Daily",
      documents: ["title-deeds.pdf", "valuation-report.pdf", "audit.pdf"],
      contactName: "Diego Alvarez",
      contactEmail: "diego@harbortrust.example",
      commitment: hash(64),
      verifiedLedger: 1_284_488,
      timeline: [
        { status: "submitted", at: t(1440) },
        { status: "review", at: t(1400), note: "Assigned to compliance" },
        { status: "approved", at: t(1320), note: "Attestor onboarded, first proof verified" },
      ],
    },
    {
      id: "REQ-1B40",
      createdAt: t(2880),
      status: "rejected",
      tokenContract: "CDRR9P0QX2K7VYT6WX9N4M8RHF2LDQE7SC1UVB0AKG5YHN3PXOIWQ2TD",
      network: "Stellar Testnet",
      symbol: "SCAMX",
      claimedSupply: 50_000_000,
      unit: "SCAMX",
      issuer: "Anon Yield DAO",
      assetClass: "Other",
      jurisdiction: "Unspecified",
      attestorKey: "0x0000…BJJ…0000",
      reserveAccounts: 2,
      frequency: "On-demand",
      documents: [],
      contactName: "—",
      contactEmail: "ops@anonyield.example",
      timeline: [
        { status: "submitted", at: t(2880) },
        { status: "review", at: t(2840) },
        { status: "rejected", at: t(2810), note: "No verifiable custodian; attestor not identifiable" },
      ],
    },
  ];
}

function load(): VerificationRequest[] {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = seed();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as VerificationRequest[]) : seed();
  } catch {
    cache = seed();
  }
  if (!window.localStorage.getItem(KEY)) persist();
  return cache;
}

function persist() {
  if (typeof window !== "undefined" && cache) {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function listRequests(): VerificationRequest[] {
  return [...load()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRequest(id: string): VerificationRequest | null {
  return load().find((r) => r.id === id) ?? null;
}

export function createRequest(input: NewRequestInput): VerificationRequest {
  const now = new Date().toISOString();
  const req: VerificationRequest = {
    ...input,
    id: genId(),
    createdAt: now,
    status: "submitted",
    timeline: [{ status: "submitted", at: now }],
  };
  cache = [req, ...load()];
  persist();
  emit();
  return req;
}

export function advanceRequest(
  id: string,
  status: RequestStatus,
  note?: string,
): VerificationRequest | null {
  const list = load();
  const req = list.find((r) => r.id === id);
  if (!req) return null;
  req.status = status;
  req.timeline = [...req.timeline, { status, at: new Date().toISOString(), note }];
  if (status === "approved") {
    req.commitment = req.commitment ?? hash(64);
    req.verifiedLedger =
      req.verifiedLedger ??
      Math.max(1_284_500, ...list.map((r) => r.verifiedLedger ?? 0)) + 7;
  }
  persist();
  emit();
  return req;
}

/** Approved requests as dashboard projects (closes the loop). */
export function approvedAsProjects(): RwaProject[] {
  return load()
    .filter((r) => r.status === "approved")
    .map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.issuer,
      category: r.assetClass,
      supply: r.claimedSupply,
      unit: r.unit,
      backed: true,
      verifiedLedger: r.verifiedLedger ?? 1_284_500,
      verifiedAt: new Date(),
      reserveAccounts: r.reserveAccounts,
      attestors: 1,
      commitment: r.commitment ?? hash(64),
    }));
}
