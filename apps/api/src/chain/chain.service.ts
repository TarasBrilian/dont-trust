import { Injectable } from "@nestjs/common";
import type { EncodedProof } from "@zk-pob/zk";

/**
 * Soroban gateway. Reads live token supply and submits proofs to the verifier
 * contract. The verifier itself re-reads total_supply on-chain (INVARIANT 2);
 * this read is only for building the witness's claimedSupply.
 */
export interface SubmitResult {
  backed: boolean;
  txHash: string;
  ledger: number;
}

@Injectable()
export class ChainService {
  // TODO: construct from @stellar/stellar-sdk rpc.Server + Contract bindings,
  // configured via @nestjs/config (RPC_URL, VERIFIER_ID, TOKEN_ID).

  /** Read the live circulating supply from the token contract. */
  async totalSupply(): Promise<bigint> {
    // TODO: simulate token.total_supply() and return the i128 as bigint.
    throw new Error("not implemented: ChainService.totalSupply");
  }

  /**
   * Submit a proof to the verifier's `submit_proof(proof, signals)` entrypoint.
   * `proof` carries the BN254 host-format bytes (G1=64B, G2=128B) and `signals`
   * are the 6 public field elements as 32-byte big-endian values — both produced
   * by the @zk-pob/zk encoder so the byte layout matches the contract exactly.
   */
  async submitProof(
    proof: EncodedProof,
    signals: Uint8Array[],
  ): Promise<SubmitResult> {
    void proof;
    void signals;
    // TODO: map proof -> { a: BytesN<64>, b: BytesN<128>, c: BytesN<64> } and
    // signals -> Vec<BytesN<32>> ScVals, invoke submit_proof, parse the event.
    throw new Error("not implemented: ChainService.submitProof");
  }
}
