/**
 * Build the snarkjs witness input from an Attestation + the liability it is being
 * proven against. This is THE one place the Attestation -> WitnessInput mapping is
 * defined, so the backend (apps/api, at runtime) and the attestor correctness test
 * share it instead of each re-deriving the field set. That retires the
 * genfixture.mjs replica that ATT-2 calls out as the drift risk.
 *
 * claimedSupply is NOT part of the attestation: the attestor signs reserves, never
 * the liability (ARCHITECTURE §3, INVARIANT 6). The caller passes the supply the
 * proof is bound to; the on-chain verifier re-checks it against the live
 * total_supply (INVARIANT 2).
 */
import { N, type Attestation, type WitnessInput } from "./types.js";

/** In-circuit bound: Num2Bits(64) constrains each balance and claimedSupply to [0, 2^64). */
const TWO_POW_64 = 1n << 64n;

function assertInRange(label: string, value: bigint): void {
  if (value < 0n || value >= TWO_POW_64) {
    throw new Error(`${label} out of range [0, 2^64): ${value}`);
  }
}

/**
 * Map a full Attestation (private balances/salts + signature + public key + the
 * bound tokenId/expiry) plus the claimedSupply into the witness snarkjs `fullProve`
 * consumes. Field order mirrors WitnessInput / proof_of_backing.circom exactly.
 *
 * Range-checks balances and claimedSupply up front so a violation fails with a
 * clear message instead of an opaque snarkjs "Assert Failed" deep in witness
 * generation (the Num2Bits(64) constraint would reject it anyway).
 */
export function buildWitnessInput(
  attestation: Attestation,
  claimedSupply: bigint,
): WitnessInput {
  const { accounts, signature, attestorPublicKey, commitment, tokenId, expiry } =
    attestation;

  if (accounts.length !== N) {
    throw new Error(
      `attestation must have exactly N=${N} accounts, got ${accounts.length}`,
    );
  }
  for (let i = 0; i < accounts.length; i++) {
    assertInRange(`balance[${i}]`, accounts[i]!.balance);
  }
  assertInRange("claimedSupply", claimedSupply);

  return {
    // private
    balances: accounts.map((a) => a.balance.toString()),
    salts: accounts.map((a) => a.salt.toString()),
    R8x: signature.R8x.toString(),
    R8y: signature.R8y.toString(),
    S: signature.S.toString(),
    // public (PUBLIC_SIGNAL_ORDER)
    attestorAx: attestorPublicKey.Ax.toString(),
    attestorAy: attestorPublicKey.Ay.toString(),
    commitment: commitment.toString(),
    claimedSupply: claimedSupply.toString(),
    tokenId: tokenId.toString(),
    expiry: expiry.toString(),
  };
}
