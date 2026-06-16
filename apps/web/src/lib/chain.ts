/**
 * Trustless chain reads for the dashboard. The backing status and supply come
 * DIRECTLY from chain via stellar-sdk (read-only simulation — no wallet, no
 * signing) — never through the backend (ARCHITECTURE §2). The API is used only
 * for non-critical history.
 */
import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  Keypair,
  Networks,
  BASE_FEE,
  scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? Networks.TESTNET;

/** The verifier's stored backing status (BackingStatus in the contract). */
export interface OnChainStatus {
  backed: boolean;
  /** 0x-prefixed Poseidon commitment to the reserve set. */
  commitment: string;
  /** Circulating supply the status was verified against. */
  supply: bigint;
  /** When the verifier recorded the status (from `verified_at`, unix seconds). */
  verifiedAt: Date;
}

let _server: rpc.Server | null = null;
function server(): rpc.Server {
  if (!_server) _server = new rpc.Server(RPC_URL);
  return _server;
}

// A throwaway source for read-only simulation (never needs to exist on-chain).
let _readAccount: string | null = null;
function readAccount(): string {
  if (!_readAccount) _readAccount = Keypair.random().publicKey();
  return _readAccount;
}

/** Simulate a no-arg contract read and return the native-decoded return value. */
async function simulateRead(contractId: string, method: string): Promise<unknown> {
  const source = new Account(readAccount(), "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(30)
    .build();

  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${method} failed: ${sim.error}`);
  }
  if (!sim.result) throw new Error(`simulate ${method}: empty result`);
  return scValToNative(sim.result.retval);
}

/** Read live circulating supply straight from the token contract. */
export async function readSupply(tokenId: string): Promise<bigint> {
  const v = (await simulateRead(tokenId, "total_supply")) as bigint | number | string;
  return BigInt(v);
}

/**
 * Read the authoritative "backed as of ledger T" status from the verifier.
 * Returns null when no proof has been verified yet (the contract's `status()`
 * returns Option::None).
 */
export async function readBackingStatus(
  verifierId: string,
): Promise<OnChainStatus | null> {
  const native = (await simulateRead(verifierId, "status")) as {
    backed: boolean;
    commitment: Uint8Array;
    supply: bigint;
    verified_at: bigint | number;
  } | null;
  if (!native) return null;
  return {
    backed: Boolean(native.backed),
    commitment: "0x" + toHex(native.commitment),
    supply: BigInt(native.supply),
    verifiedAt: new Date(Number(native.verified_at) * 1000),
  };
}

/** Current ledger sequence — used to show "as of ledger N" on a trustless read. */
export async function latestLedger(): Promise<number> {
  const { sequence } = await server().getLatestLedger();
  return sequence;
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
