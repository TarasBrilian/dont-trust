// e2e helper: attestation.json + claimedSupply -> snarkjs witness input.json,
// using the SAME shared builder the backend uses (no replica).
// Usage: node mkwitness.mjs <attestation.json> <claimedSupply> <out input.json>
import { readFileSync, writeFileSync } from "node:fs";
import { buildWitnessInput } from "@zk-pob/shared";

const [attPath, claimedSupply, outPath] = process.argv.slice(2);
if (!attPath || !claimedSupply || !outPath) {
  throw new Error("usage: mkwitness.mjs <attestation.json> <claimedSupply> <out>");
}

const a = JSON.parse(readFileSync(attPath, "utf8"));
const attestation = {
  accounts: a.accounts.map((x) => ({ balance: BigInt(x.balance), salt: BigInt(x.salt) })),
  commitment: BigInt(a.commitment),
  signature: {
    R8x: BigInt(a.signature.R8x),
    R8y: BigInt(a.signature.R8y),
    S: BigInt(a.signature.S),
  },
  attestorPublicKey: {
    Ax: BigInt(a.attestorPublicKey.Ax),
    Ay: BigInt(a.attestorPublicKey.Ay),
  },
  tokenId: BigInt(a.tokenId),
  expiry: BigInt(a.expiry),
};

const witness = buildWitnessInput(attestation, BigInt(claimedSupply));
writeFileSync(outPath, JSON.stringify(witness, null, 2));
console.error(`mkwitness: wrote ${outPath}`);
