#!/usr/bin/env node
/**
 * Attestor CLI. Reads a reserve book + token binding, prints an Attestation
 * (commitment, signature, public key) as JSON for the backend to consume.
 *
 * Usage:
 *   attestor sign --book reserves.json --token <tokenIdFelt> --expiry <unix>
 *
 * reserves.json: [{ "balance": "1000000", "salt": "12345" }, ...]  (length N)
 *
 * The private key is read from ATTESTOR_PRIVATE_KEY (hex). Never commit it.
 */
import { readFileSync } from "node:fs";
import { Attestor } from "./attestor.js";
import { N, type ReserveAccount } from "@zk-pob/shared";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith("--")) out[a.slice(2)] = argv[++i] ?? "";
  }
  return out;
}

/** Load the attestor private key from ATTESTOR_PRIVATE_KEY (hex). */
function loadKey(): Uint8Array {
  const keyHex = process.env.ATTESTOR_PRIVATE_KEY;
  if (!keyHex) throw new Error("ATTESTOR_PRIVATE_KEY not set");
  return Uint8Array.from(Buffer.from(keyHex.replace(/^0x/, ""), "hex"));
}

/** A field element as 32-byte big-endian hex (the on-chain BytesN form). */
function feltHex(x: bigint): string {
  const hex = x.toString(16);
  if (hex.length > 64) throw new Error(`field element too large: ${x}`);
  return hex.padStart(64, "0");
}

/**
 * `attestor pubkey` — print the on-chain allowlist key ax||ay (64 bytes, 128 hex)
 * for `Verifier.allow_attestor`. deploy.sh (OPS-2) consumes this on stdout.
 */
async function pubkeyCmd() {
  const attestor = await Attestor.create(loadKey());
  const { Ax, Ay } = attestor.publicKey();
  process.stdout.write(feltHex(Ax) + feltHex(Ay) + "\n");
}

async function signCmd() {
  const args = parseArgs(process.argv.slice(2));
  const key = loadKey();
  if (!args.book || !args.token || !args.expiry) {
    throw new Error("usage: attestor sign --book <file> --token <felt> --expiry <unix>");
  }

  const raw = JSON.parse(readFileSync(args.book, "utf8")) as { balance: string; salt: string }[];
  if (raw.length !== N) throw new Error(`book must have exactly N=${N} accounts`);
  const accounts: ReserveAccount[] = raw.map((r) => ({
    balance: BigInt(r.balance),
    salt: BigInt(r.salt),
  }));

  const attestor = await Attestor.create(key);
  const attestation = await attestor.attest(accounts, BigInt(args.token), BigInt(args.expiry));

  // bigint -> string so JSON can carry field elements
  const json = JSON.stringify(
    attestation,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
  process.stdout.write(json + "\n");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "pubkey") return pubkeyCmd();
  return signCmd(); // default: `sign`
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
