/**
 * Mock data for the dashboard. Shapes mirror exactly what will later be read
 * from chain (lib/chain.ts), so switching to on-chain data only means swapping
 * the getProjects()/getHistory() implementations — the UI components stay the same.
 */

export interface RwaProject {
  id: string;
  symbol: string;
  name: string;
  /** Asset class, e.g. "Treasury", "Gold", "Real estate". */
  category: string;
  /** Circulating supply in the token's own unit. */
  supply: number;
  /** Display unit shown next to the figure. */
  unit: string;
  backed: boolean;
  /** Ledger at which the backing status was verified on-chain. */
  verifiedLedger: number;
  verifiedAt: Date;
  /** Number of reserve accounts bound in the proof (N). */
  reserveAccounts: number;
  /** Attestors on the on-chain allowlist for this token. */
  attestors: number;
  /** Poseidon commitment to the reserve set (not the balances). */
  commitment: string;
}

export interface VerificationRow {
  id: string;
  asset: string;
  at: Date;
  ledger: number;
  supply: number;
  unit: string;
  backed: boolean;
  txHash: string;
}

export const NETWORK = "Stellar Testnet";

const NOW = Date.now();
const MIN = 60_000;

const PROJECTS: RwaProject[] = [
  {
    id: "rwusd",
    symbol: "RWUSD",
    name: "Treasury-Backed RW USD",
    category: "Treasury",
    supply: 1_000_000,
    unit: "RWUSD",
    backed: true,
    verifiedLedger: 1_284_531,
    verifiedAt: new Date(NOW - 2 * MIN),
    reserveAccounts: 8,
    attestors: 3,
    commitment: "0x0dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4e530a3b7c1f9a0e2d8b4f6a2",
  },
  {
    id: "xaut2",
    symbol: "gXAU",
    name: "Tokenized Gold Vault",
    category: "Gold",
    supply: 48_250,
    unit: "oz",
    backed: true,
    verifiedLedger: 1_284_510,
    verifiedAt: new Date(NOW - 6 * MIN),
    reserveAccounts: 6,
    attestors: 2,
    commitment: "0x7b1f9a0e2d8b4f6a20dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4e530a3b7",
  },
  {
    id: "recf",
    symbol: "RECF",
    name: "Real Estate Credit Fund",
    category: "Real estate",
    supply: 12_400_000,
    unit: "RECF",
    backed: true,
    verifiedLedger: 1_284_402,
    verifiedAt: new Date(NOW - 18 * MIN),
    reserveAccounts: 8,
    attestors: 4,
    commitment: "0x16519f2c4e530a3b7c1f9a0e2d8b4f6a20dceb6a5f4ce3204e3a1c0f7b8d4e2a1",
  },
  {
    id: "pcdf",
    symbol: "PCDF",
    name: "Private Credit Debt Fund",
    category: "Private credit",
    supply: 7_850_000,
    unit: "PCDF",
    backed: true,
    verifiedLedger: 1_284_188,
    verifiedAt: new Date(NOW - 41 * MIN),
    reserveAccounts: 8,
    attestors: 3,
    commitment: "0xc1f9a0e2d8b4f6a20dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4e530a3b7c",
  },
  {
    id: "carb",
    symbol: "CARB",
    name: "Verified Carbon Credits",
    category: "Carbon",
    supply: 320_000,
    unit: "tCO₂e",
    backed: false,
    verifiedLedger: 1_283_950,
    verifiedAt: new Date(NOW - 73 * MIN),
    reserveAccounts: 5,
    attestors: 2,
    commitment: "0x4e530a3b7c1f9a0e2d8b4f6a20dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4",
  },
  {
    id: "tbill",
    symbol: "sTBILL",
    name: "Short-Term T-Bill Note",
    category: "Treasury",
    supply: 5_200_000,
    unit: "sTBILL",
    backed: true,
    verifiedLedger: 1_284_077,
    verifiedAt: new Date(NOW - 55 * MIN),
    reserveAccounts: 8,
    attestors: 3,
    commitment: "0xa3b7c1f9a0e2d8b4f6a20dceb6a5f4ce3204e3a1c0f7b8d4e2a16519f2c4e530a",
  },
];

const HISTORY: VerificationRow[] = [
  { id: "h1", asset: "RWUSD", at: new Date(NOW - 2 * MIN), ledger: 1_284_531, supply: 1_000_000, unit: "RWUSD", backed: true, txHash: "0x9f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8c2f1a4d7b9" },
  { id: "h2", asset: "gXAU", at: new Date(NOW - 6 * MIN), ledger: 1_284_510, supply: 48_250, unit: "oz", backed: true, txHash: "0x4d7b9e2c1f8a0d3b6e5c4928d1ba7e3c0f9f2a4c81d3b7e0a6c5f4928d1ba7e3" },
  { id: "h3", asset: "RECF", at: new Date(NOW - 18 * MIN), ledger: 1_284_402, supply: 12_400_000, unit: "RECF", backed: true, txHash: "0x1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d" },
  { id: "h4", asset: "PCDF", at: new Date(NOW - 41 * MIN), ledger: 1_284_188, supply: 7_850_000, unit: "PCDF", backed: true, txHash: "0xc2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6e8" },
  { id: "h5", asset: "sTBILL", at: new Date(NOW - 55 * MIN), ledger: 1_284_077, supply: 5_200_000, unit: "sTBILL", backed: true, txHash: "0xe8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7a0d3b6" },
  { id: "h6", asset: "CARB", at: new Date(NOW - 73 * MIN), ledger: 1_283_950, supply: 320_000, unit: "tCO₂e", backed: false, txHash: "0xa0d3b6e8c2f1a4d7b99f2a4c81d3b7e0a6c5f4928d1ba7e3c0f8d6a2b4e1c9f7" },
];

/** Simulate network latency so the loading state feels real. */
function delay<T>(value: T, ms = 600): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Monitored RWA projects (later: read each verifier.status() from chain). */
export function getProjects(): Promise<RwaProject[]> {
  return delay(PROJECTS.map((p) => ({ ...p, verifiedAt: p.verifiedAt })));
}

/** Verification history across all projects (later: GET /verifications). */
export function getHistory(): Promise<VerificationRow[]> {
  return delay(HISTORY, 350);
}
