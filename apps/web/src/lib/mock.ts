/**
 * Mock data for the dashboard. Shapes mirror exactly what will later be read
 * from chain (lib/chain.ts), so switching to on-chain data only means swapping
 * the getSnapshot()/getHistory() implementations — the UI components stay the same.
 */

export interface TokenMeta {
  symbol: string;
  name: string;
  contractId: string;
}

export interface BackingSnapshot {
  backed: boolean;
  supply: number;
  /** Ledger saat status diverifikasi on-chain. */
  verifiedLedger: number;
  /** Waktu verifikasi terakhir. */
  verifiedAt: Date;
  /** Poseidon commitment to the reserve set (not the balances). */
  commitment: string;
  /** Number of reserve accounts bound in the proof (N). */
  reserveAccounts: number;
  /** Number of attestors on the on-chain allowlist. */
  attestors: number;
  network: string;
}

export interface VerificationRow {
  id: string;
  at: Date;
  ledger: number;
  supply: number;
  backed: boolean;
  txHash: string;
}

/* Time anchors for the mock timeline. */

export const TOKEN: TokenMeta = {
  symbol: "RWUSD",
  name: "Treasury-Backed RW USD",
  contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};

const NOW = Date.now();
const MIN = 60_000;

const SNAPSHOT: BackingSnapshot = {
  backed: true,
  supply: 1_000_000,
  verifiedLedger: 1_284_531,
  verifiedAt: new Date(NOW - 2 * MIN),
  commitment:
    "0x0dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4e530a3b7c1f9a0e2d8b4f6a2",
  reserveAccounts: 8,
  attestors: 3,
  network: "Stellar Testnet",
};

const HISTORY: VerificationRow[] = [
  { id: "v1", at: new Date(NOW - 2 * MIN), ledger: 1_284_531, supply: 1_000_000, backed: true, txHash: "0x9f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8c2f1a4d7b9" },
  { id: "v2", at: new Date(NOW - 64 * MIN), ledger: 1_283_902, supply: 1_000_000, backed: true, txHash: "0x4d7b9e2c1f8a0d3b6e5c4928d1ba7e3c0f9f2a4c81d3b7e0a6c5f4928d1ba7e3" },
  { id: "v3", at: new Date(NOW - 3 * 60 * MIN), ledger: 1_283_140, supply: 950_000, backed: true, txHash: "0x1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d" },
  { id: "v4", at: new Date(NOW - 8 * 60 * MIN), ledger: 1_281_770, supply: 950_000, backed: false, txHash: "0xc2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8" },
  { id: "v5", at: new Date(NOW - 22 * 60 * MIN), ledger: 1_279_005, supply: 900_000, backed: true, txHash: "0xe8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6" },
  { id: "v6", at: new Date(NOW - 27 * 60 * MIN), ledger: 1_278_410, supply: 900_000, backed: true, txHash: "0xa0d3b6e8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7" },
];

/** Simulate network latency so the loading state feels real. */
function delay<T>(value: T, ms = 650): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Current backing status (later: read verifier.status() from chain). */
export function getSnapshot(): Promise<BackingSnapshot> {
  return delay({ ...SNAPSHOT, verifiedAt: new Date() });
}

/** Verification history (later: GET /verifications from the backend). */
export function getHistory(): Promise<VerificationRow[]> {
  return delay(HISTORY, 350);
}
