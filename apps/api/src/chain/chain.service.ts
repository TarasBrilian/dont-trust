import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  Keypair,
  Networks,
  BASE_FEE,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { EncodedProof } from "@zk-pob/zk";

/**
 * Soroban gateway. Reads live token supply and submits proofs to the verifier
 * contract. The verifier itself re-reads total_supply on-chain (INVARIANT 2);
 * the read here is only for building the witness's claimedSupply.
 *
 * Reads (total_supply) are credential-free simulations. submit_proof signs and
 * sends a real transaction, so it needs SOURCE_SECRET (a funded identity).
 */
export interface SubmitResult {
  backed: boolean;
  txHash: string;
  ledger: number;
}

@Injectable()
export class ChainService {
  /** Throwaway account id for read-only simulations (never needs to exist on-chain). */
  private readonly readAccountId = Keypair.random().publicKey();
  private rpcServer?: rpc.Server;

  constructor(private readonly config: ConfigService) {}

  // --- config accessors (fail at call time with a clear message, not at boot) ---

  private require(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) throw new Error(`${key} not configured`);
    return v;
  }

  private server(): rpc.Server {
    if (!this.rpcServer) {
      this.rpcServer = new rpc.Server(this.require("RPC_URL"));
    }
    return this.rpcServer;
  }

  /** Map the NETWORK name (or an explicit NETWORK_PASSPHRASE) to a passphrase. */
  private passphrase(): string {
    const explicit = this.config.get<string>("NETWORK_PASSPHRASE");
    if (explicit) return explicit;
    const net = (this.config.get<string>("NETWORK") ?? "testnet").toLowerCase();
    switch (net) {
      case "public":
      case "mainnet":
      case "pubnet":
        return Networks.PUBLIC;
      case "futurenet":
        return Networks.FUTURENET;
      case "standalone":
      case "local":
        return Networks.STANDALONE;
      case "testnet":
      default:
        return Networks.TESTNET;
    }
  }

  // --- reads ---

  /** Read the live circulating supply from the token contract (INVARIANT 2 input). */
  async totalSupply(): Promise<bigint> {
    const native = await this.simulateRead(this.require("TOKEN_ID"), "total_supply");
    return BigInt(native as bigint | number | string);
  }

  /**
   * Read-only contract call via simulation. No signing, no fee, no on-chain
   * account required — the source is a throwaway id the network never checks.
   */
  private async simulateRead(
    contractId: string,
    method: string,
    ...args: xdr.ScVal[]
  ): Promise<unknown> {
    const source = new Account(this.readAccountId, "0");
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase(),
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server().simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`simulate ${method} failed: ${sim.error}`);
    }
    if (!sim.result) throw new Error(`simulate ${method}: empty result`);
    return scValToNative(sim.result.retval);
  }

  // --- writes ---

  /**
   * Submit a proof to the verifier's `submit_proof(proof, signals)` entrypoint.
   * `proof` carries the BN254 host-format bytes (G1=64B, G2=128B) and `signals`
   * are the 6 public field elements as 32-byte big-endian values — both produced
   * by the @zk-pob/zk encoder so the byte layout matches the contract exactly.
   *
   * The verifier returns `Result<bool, Error>` and TRAPS on any rejection
   * (AttestorNotAllowed, SupplyMismatch, PairingFailed, …). prepareTransaction
   * simulates first, so a rejected proof — including the tamper case — surfaces
   * here as a thrown error rather than a `backed: false` result.
   */
  async submitProof(
    proof: EncodedProof,
    signals: Uint8Array[],
  ): Promise<SubmitResult> {
    const server = this.server();
    const kp = Keypair.fromSecret(this.require("SOURCE_SECRET"));
    const verifierId = this.require("VERIFIER_ID");

    // Build ScVals explicitly. A Soroban struct is a map with SYMBOL keys, sorted
    // lexicographically — nativeToScVal would emit string keys and the contract
    // would silently reject the decode. Bytes go straight to scvBytes (the host
    // checks the BytesN<64>/<128> length on decode).
    const proofScVal = structScVal({
      a: bytesScVal(proof.a),
      b: bytesScVal(proof.b),
      c: bytesScVal(proof.c),
    });
    const signalsScVal = xdr.ScVal.scvVec(signals.map(bytesScVal));

    const account = await server.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase(),
    })
      .addOperation(new Contract(verifierId).call("submit_proof", proofScVal, signalsScVal))
      .setTimeout(60)
      .build();

    // Simulate + assemble footprint/resource fees. Throws on a contract trap.
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(kp);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(`sendTransaction rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`);
    }

    const got = await this.awaitTx(sent.hash);
    if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`submit_proof failed on-chain (status=${got.status})`);
    }

    const backed =
      got.returnValue != null ? Boolean(scValToNative(got.returnValue)) : true;
    return { backed, txHash: sent.hash, ledger: got.ledger };
  }

  /** Poll getTransaction until it leaves NOT_FOUND or the deadline passes. */
  private async awaitTx(
    hash: string,
    timeoutMs = 30_000,
  ): Promise<rpc.Api.GetTransactionResponse> {
    const deadline = Date.now() + timeoutMs;
    let got = await this.server().getTransaction(hash);
    while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await this.server().getTransaction(hash);
    }
    return got;
  }
}

/** A byte array as an ScVal (decoded into BytesN<L> on-chain; length checked there). */
function bytesScVal(u8: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(u8));
}

/** A Soroban struct: an ScVal map keyed by field-name SYMBOLS, sorted lexically. */
function structScVal(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  const entries = Object.keys(fields)
    .sort()
    .map(
      (k) =>
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: fields[k]! }),
    );
  return xdr.ScVal.scvMap(entries);
}
