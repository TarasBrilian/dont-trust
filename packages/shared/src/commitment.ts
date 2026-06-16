/**
 * THE one definition of the Poseidon commitment and signed-message format.
 *
 * Both `apps/attestor` (signing) and `apps/api` (witness building) MUST import
 * these helpers — never reimplement them. A byte-for-byte mismatch here is the
 * #1 silent failure mode: the proof generates fine offline but is rejected
 * on-chain because the attestor and circuit hashed different things
 * (CLAUDE.md "Gotchas", ARCHITECTURE §3 constraints 1-2).
 *
 * The input ORDER below is mirrored exactly in proof_of_backing.circom.
 */

import type { AttestorPublicKey, EdDSASignature } from "./types.js";

/**
 * A Poseidon hash function over the BN254 scalar field, returning a field
 * element as bigint. Inject circomlibjs's `buildPoseidon()` result, wrapped so
 * it returns a bigint (use `poseidon.F.toObject(poseidon(inputs))`).
 */
export type PoseidonFn = (inputs: bigint[]) => bigint;

/**
 * Commitment = Poseidon(balances[0..N-1], salts[0..N-1]).
 *
 * Ordering: ALL balances first (in account index order), THEN all salts (same
 * order). Circuit fills `inputs[0..N-1]` with balances and `inputs[N..2N-1]`
 * with salts — keep these identical.
 */
export function computeCommitment(
  poseidon: PoseidonFn,
  balances: bigint[],
  salts: bigint[],
): bigint {
  if (balances.length !== salts.length) {
    throw new Error("balances and salts must have equal length (N)");
  }
  return poseidon([...balances, ...salts]);
}

/**
 * Signed message = Poseidon(commitment, tokenId, expiry).
 *
 * This is what the attestor signs with EdDSA and what the circuit reconstructs
 * before EdDSAPoseidonVerifier. Binds the reserve set to a specific token and
 * freshness deadline (INVARIANT 4).
 */
export function computeMessage(
  poseidon: PoseidonFn,
  commitment: bigint,
  tokenId: bigint,
  expiry: bigint,
): bigint {
  return poseidon([commitment, tokenId, expiry]);
}

/** Re-export for callers that hold full attestation parts. */
export interface SignedAttestationParts {
  commitment: bigint;
  tokenId: bigint;
  expiry: bigint;
  signature: EdDSASignature;
  attestorPublicKey: AttestorPublicKey;
}
