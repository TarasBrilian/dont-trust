import { Inject, Injectable } from "@nestjs/common";
import { prove, encodeProof, encodePublicSignals } from "@zk-pob/zk";
import type { WitnessInput } from "@zk-pob/shared";
import { ChainService } from "../chain/chain.service.js";
import {
  VERIFICATION_REPOSITORY,
  type IVerificationRepository,
  type VerificationRecord,
} from "./domain/verification.repository.js";

/**
 * Orchestrates the prove -> submit -> persist flow. The witness holds private
 * balances, so this runs server-side only (ARCHITECTURE §2). This service stores
 * history; the authoritative backing status lives on-chain.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly chain: ChainService,
    @Inject(VERIFICATION_REPOSITORY)
    private readonly repo: IVerificationRepository,
  ) {}

  /**
   * Build a proof from a witness and submit it. claimedSupply must equal the
   * live on-chain supply (the verifier re-checks it — INVARIANT 2).
   */
  async proveAndSubmit(
    attestationId: string,
    witness: WitnessInput,
  ): Promise<VerificationRecord> {
    const wasmPath = process.env.ZK_WASM_PATH;
    const zkeyPath = process.env.ZK_ZKEY_PATH;
    if (!wasmPath || !zkeyPath) {
      throw new Error("ZK_WASM_PATH / ZK_ZKEY_PATH not configured");
    }

    const { proof, publicSignals } = await prove(witness, { wasmPath, zkeyPath });

    // Serialize to the BN254 host-format the verifier expects (single source:
    // @zk-pob/zk encoder, which owns the G2 c1||c0 ordering).
    const encodedProof = encodeProof(proof);
    const encodedSignals = encodePublicSignals(publicSignals);

    const result = await this.chain.submitProof(encodedProof, encodedSignals);

    return this.repo.save({
      id: "ver_" + Math.random().toString(36).slice(2, 12),
      attestationId,
      commitment: witness.commitment,
      claimedSupply: witness.claimedSupply,
      backed: result.backed,
      txHash: result.txHash,
      ledger: result.ledger,
      verifiedAt: new Date().toISOString(),
    });
  }

  history(): Promise<VerificationRecord[]> {
    return this.repo.list();
  }

  latest(): Promise<VerificationRecord | null> {
    return this.repo.latest();
  }
}
