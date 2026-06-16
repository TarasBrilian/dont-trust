// ZK-5: export the circuit verification key to contract-ready bytes.
//
// Reads build/verification_key.json and serializes it via the @zk-pob/zk encoder
// (the single source for BN254 layout, incl. the G2 c1||c0 ordering) into the
// hex-string `VerificationKey` struct the Soroban verifier's `init` takes. Writes
// build/vk.contract.json, which deploy.sh consumes for `verifier init --vk` (OPS-2).
//
// Run from packages/zk after ./build.sh (see the "vk:export" npm script).
import { readFileSync, writeFileSync } from "node:fs";
import { encodeVkHex } from "@zk-pob/zk";

// PUBLIC_SIGNAL_ORDER length (must match the circuit's `main` public list and the
// verifier's N_PUBLIC). IC carries N_PUBLIC + 1 points (IC[0] is the constant term).
const N_PUBLIC = 6;

const vk = JSON.parse(readFileSync("build/verification_key.json", "utf8"));

if (vk.nPublic !== N_PUBLIC) {
  throw new Error(
    `nPublic mismatch: vk has ${vk.nPublic}, contract expects ${N_PUBLIC} — circuit/contract drift`,
  );
}

const out = encodeVkHex(vk);

// Assert the exact BytesN widths the contract declares (hex = 2 chars/byte). A
// wrong width means from_bytes will reject it on-chain, so fail loudly here.
const widths = { alpha1: 128, beta2: 256, gamma2: 256, delta2: 256 };
for (const [k, w] of Object.entries(widths)) {
  if (out[k].length !== w) {
    throw new Error(`${k}: expected ${w} hex chars (BytesN), got ${out[k].length}`);
  }
}
if (out.ic.length !== N_PUBLIC + 1) {
  throw new Error(`ic: expected ${N_PUBLIC + 1} points, got ${out.ic.length}`);
}
out.ic.forEach((p, i) => {
  if (p.length !== 128) throw new Error(`ic[${i}]: expected 128 hex chars, got ${p.length}`);
});

writeFileSync("build/vk.contract.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote build/vk.contract.json — ${out.ic.length} IC points, nPublic=${N_PUBLIC}`);
