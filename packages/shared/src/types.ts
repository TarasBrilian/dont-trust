/**
 * Shared domain types. Field elements that exceed JS safe-integer range
 * (balances, salts, signatures, the prime field) are carried as `bigint`.
 */

/** Number of reserve accounts. Compile-time constant — must match the circuit's N. */
export const N = 8;

/** A single reserve account's secret inputs (never leaves attestor/backend). */
export interface ReserveAccount {
  /** Balance in the token's smallest unit. Range-checked to [0, 2^64) in-circuit. */
  balance: bigint;
  /** Per-account blinding factor for the commitment. */
  salt: bigint;
}

/** EdDSA (BabyJubjub) signature components produced by the attestor. */
export interface EdDSASignature {
  R8x: bigint;
  R8y: bigint;
  S: bigint;
}

/** Attestor's BabyJubjub public key. */
export interface AttestorPublicKey {
  Ax: bigint;
  Ay: bigint;
}

/**
 * The public signals of the proof, in the canonical order shared by the
 * circuit, snarkjs `public.json`, and the on-chain verifier.
 *
 * INVARIANT: this order is a contract across all three. Reordering or adding a
 * signal here means updating the circuit's `main` public list and the verifier
 * in lockstep (CLAUDE.md "Conventions").
 */
export interface PublicSignals {
  attestorAx: bigint;
  attestorAy: bigint;
  commitment: bigint;
  claimedSupply: bigint;
  tokenId: bigint;
  expiry: bigint;
}

/** Canonical ordering of public signals as a tuple of field elements. */
export const PUBLIC_SIGNAL_ORDER = [
  "attestorAx",
  "attestorAy",
  "commitment",
  "claimedSupply",
  "tokenId",
  "expiry",
] as const satisfies readonly (keyof PublicSignals)[];

/** The witness input JSON consumed by snarkjs (`fullprove`). */
export interface WitnessInput {
  // private
  balances: string[];
  salts: string[];
  R8x: string;
  R8y: string;
  S: string;
  // public
  attestorAx: string;
  attestorAy: string;
  commitment: string;
  claimedSupply: string;
  tokenId: string;
  expiry: string;
}

/** What the attestor hands to the backend. Balances are secret; the rest is bindable. */
export interface Attestation {
  accounts: ReserveAccount[];
  commitment: bigint;
  signature: EdDSASignature;
  attestorPublicKey: AttestorPublicKey;
  tokenId: bigint;
  expiry: bigint;
}
