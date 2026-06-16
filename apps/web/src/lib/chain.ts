/**
 * Trustless chain reads for the dashboard. The backing status and supply come
 * DIRECTLY from chain via stellar-sdk — never through the backend (ARCHITECTURE
 * §2). The API is used only for non-critical history.
 */

export interface BackingStatus {
  supply: bigint;
  backed: boolean;
  /** Ledger sequence the status was verified at. */
  verifiedLedger: number;
  /** Commitment of the most recent verified attestation. */
  commitment: string;
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const VERIFIER_ID = process.env.NEXT_PUBLIC_VERIFIER_ID ?? "";
const TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_ID ?? "";

/** Read live circulating supply straight from the token contract. */
export async function readSupply(): Promise<bigint> {
  void RPC_URL;
  void TOKEN_ID;
  // TODO: rpc.Server + Contract("total_supply") simulation read.
  throw new Error("not implemented: readSupply");
}

/** Read the authoritative "backed as of ledger T" status from the verifier. */
export async function readBackingStatus(): Promise<BackingStatus> {
  void VERIFIER_ID;
  // TODO: read the verifier contract's stored status entry.
  throw new Error("not implemented: readBackingStatus");
}
