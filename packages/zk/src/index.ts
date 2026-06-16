/**
 * snarkjs proving wrapper used by apps/api. Turns a WitnessInput into a Groth16
 * proof + public signals, and serializes BN254 points for the Soroban verifier.
 *
 * Proving happens server-side only — the witness holds private balances and must
 * never reach a browser (ARCHITECTURE §2).
 */
import { groth16 } from "snarkjs";
import type { WitnessInput } from "@zk-pob/shared";

export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface ProveResult {
  proof: Groth16Proof;
  publicSignals: string[];
}

export interface ProverArtifacts {
  /** Path to proof_of_backing_js/proof_of_backing.wasm */
  wasmPath: string;
  /** Path to proof_of_backing_final.zkey */
  zkeyPath: string;
}

/** Generate a proof from a fully-populated witness input. */
export async function prove(
  input: WitnessInput,
  artifacts: ProverArtifacts,
): Promise<ProveResult> {
  const { proof, publicSignals } = await groth16.fullProve(
    input as unknown as Record<string, unknown>,
    artifacts.wasmPath,
    artifacts.zkeyPath,
  );
  return { proof: proof as Groth16Proof, publicSignals };
}

/** Offline sanity check, mirrors `snarkjs groth16 verify`. */
export async function verifyOffline(
  verificationKey: unknown,
  publicSignals: string[],
  proof: Groth16Proof,
): Promise<boolean> {
  return groth16.verify(verificationKey as object, publicSignals, proof as object);
}

export * from "./encode.js";
