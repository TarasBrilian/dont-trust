import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { prove, encodeProof, encodePublicSignals } from "@zk-pob/zk";
import { buildWitnessInput, type Attestation, type WitnessInput } from "@zk-pob/shared";
import { ChainService } from "../chain/chain.service.js";
import {
  VERIFICATION_REPOSITORY,
  type IVerificationRepository,
  type VerificationRecord,
} from "./domain/verification.repository.js";
import type { CreateVerificationDto } from "./dto/create-verification.dto.js";

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
   * Build the witness from an attestation bound to `claimedSupply`, then prove +
   * submit. `claimedSupply` should be the live on-chain supply (read via
   * ChainService.totalSupply) — the verifier re-checks it on-chain (INVARIANT 2).
   * The attestor signs reserves only, so the supply is supplied here, not in the
   * attestation (INVARIANT 6).
   */
  async proveAndSubmitFromAttestation(
    attestationId: string,
    attestation: Attestation,
    claimedSupply: bigint,
  ): Promise<VerificationRecord> {
    const witness = buildWitnessInput(attestation, claimedSupply);
    return this.proveAndSubmit(attestationId, witness);
  }

  /**
   * Prove + submit a full attestation posted by a client (POST /verifications).
   * claimedSupply defaults to the live on-chain supply (which the verifier
   * re-checks — INVARIANT 2). Raw balances are used transiently, never persisted.
   */
  async proveAndSubmitFromDto(dto: CreateVerificationDto): Promise<VerificationRecord> {
    const attestation = parseAttestation(dto);
    const claimedSupply = dto.claimedSupply
      ? BigInt(dto.claimedSupply)
      : await this.chain.totalSupply();
    return this.proveAndSubmitFromAttestation(newId(), attestation, claimedSupply);
  }

  /**
   * Prove + submit a server-side demo attestation (POST /verifications/demo) so a
   * client (the prover console) can trigger a REAL Groth16 proof without holding
   * the attestor key (which must never live here — CLAUDE.md). The attestation is
   * produced out-of-process by the attestor; the path is DEMO_ATTESTATION_PATH
   * (default scripts/.e2e/attestation.json, written by e2e.sh).
   */
  async proveAndSubmitDemo(): Promise<VerificationRecord> {
    const path = resolveFromRoot(
      process.env.DEMO_ATTESTATION_PATH ?? "scripts/.e2e/attestation.json",
    );
    if (!existsSync(path)) {
      throw new Error(
        `demo attestation not found at ${path} — run scripts/e2e.sh (or POST /verifications with an attestation)`,
      );
    }
    const attestation = parseAttestation(JSON.parse(readFileSync(path, "utf8")));
    const claimedSupply = await this.chain.totalSupply();
    return this.proveAndSubmitFromAttestation(newId(), attestation, claimedSupply);
  }

  /**
   * Build a proof from a witness and submit it. claimedSupply must equal the
   * live on-chain supply (the verifier re-checks it — INVARIANT 2).
   */
  async proveAndSubmit(
    attestationId: string,
    witness: WitnessInput,
  ): Promise<VerificationRecord> {
    if (!process.env.ZK_WASM_PATH || !process.env.ZK_ZKEY_PATH) {
      throw new Error("ZK_WASM_PATH / ZK_ZKEY_PATH not configured");
    }
    // Configured paths may be relative to the repo root (as in .env); the api may
    // run from a different cwd, so resolve them against the root.
    const wasmPath = resolveFromRoot(process.env.ZK_WASM_PATH);
    const zkeyPath = resolveFromRoot(process.env.ZK_ZKEY_PATH);

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

/** Parse an attestor-shaped object (decimal-string fields) into an Attestation. */
function parseAttestation(raw: {
  accounts: { balance: string; salt: string }[];
  signature: { R8x: string; R8y: string; S: string };
  attestorPublicKey: { Ax: string; Ay: string };
  commitment: string;
  tokenId: string;
  expiry: string;
}): Attestation {
  return {
    accounts: raw.accounts.map((a) => ({
      balance: BigInt(a.balance),
      salt: BigInt(a.salt),
    })),
    signature: {
      R8x: BigInt(raw.signature.R8x),
      R8y: BigInt(raw.signature.R8y),
      S: BigInt(raw.signature.S),
    },
    attestorPublicKey: {
      Ax: BigInt(raw.attestorPublicKey.Ax),
      Ay: BigInt(raw.attestorPublicKey.Ay),
    },
    commitment: BigInt(raw.commitment),
    tokenId: BigInt(raw.tokenId),
    expiry: BigInt(raw.expiry),
  };
}

function newId(): string {
  return "ver_" + Math.random().toString(36).slice(2, 12);
}

/** Resolve a path that may be relative to the monorepo root (where .env lives). */
function resolveFromRoot(p: string): string {
  if (isAbsolute(p)) return p;
  return resolve(repoRoot(), p);
}

let _root: string | null = null;
function repoRoot(): string {
  if (_root) return _root;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const pkg = resolve(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).name === "zk-pob") {
          _root = dir;
          return dir;
        }
      } catch {
        /* keep walking up */
      }
    }
    dir = dirname(dir);
  }
  _root = process.cwd();
  return _root;
}
