import { Injectable } from "@nestjs/common";

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
    // TODO: contract.call("total_supply") against the token contract.
    throw new Error("not implemented: ChainService.totalSupply");
  }

  /**
   * Submit proof + public signals to the verifier's submit_proof entrypoint.
   * BN254 points must be big-endian concat(X, Y) (CLAUDE.md "Gotchas").
   */
  async submitProof(
    _proofBytes: Uint8Array,
    _publicSignals: string[],
  ): Promise<SubmitResult> {
    // TODO: invoke verifier.submit_proof and parse the result/events.
    throw new Error("not implemented: ChainService.submitProof");
  }
}
