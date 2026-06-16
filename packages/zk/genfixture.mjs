// Dev fixture generator: writes a valid witness input.json using the SHARED
// commitment/msg formulas + a real EdDSA signature. Feeds `snarkjs fullprove`;
// gentestdata.mjs then turns that output into the verifier's on-chain test
// vector. Run from packages/zk (see the "gen:testdata" npm script).
import { buildPoseidon, buildEddsa } from "circomlibjs";
import { computeCommitment, computeMessage } from "@zk-pob/shared";
import { writeFileSync } from "node:fs";

const eddsa = await buildEddsa();
const poseidonRaw = await buildPoseidon();
const F = poseidonRaw.F;
const poseidon = (inputs) => F.toObject(poseidonRaw(inputs));

const balances = [250000n, 180000n, 150000n, 120000n, 100000n, 90000n, 70000n, 40000n];
const salts = [11n, 22n, 33n, 44n, 55n, 66n, 77n, 88n];
const claimedSupply = 1000000n;
const tokenId = 424242n;
const expiry = 7777777777n;

const commitment = computeCommitment(poseidon, balances, salts);
const msg = computeMessage(poseidon, commitment, tokenId, expiry);

const prv = Buffer.from("01".repeat(32), "hex");
const pub = eddsa.prv2pub(prv);
const sig = eddsa.signPoseidon(prv, F.e(msg));

const input = {
  balances: balances.map(String),
  salts: salts.map(String),
  R8x: F.toObject(sig.R8[0]).toString(),
  R8y: F.toObject(sig.R8[1]).toString(),
  S: sig.S.toString(),
  attestorAx: F.toObject(pub[0]).toString(),
  attestorAy: F.toObject(pub[1]).toString(),
  commitment: commitment.toString(),
  claimedSupply: claimedSupply.toString(),
  tokenId: tokenId.toString(),
  expiry: expiry.toString(),
};
writeFileSync("input.json", JSON.stringify(input, null, 2));
console.log("wrote input.json");
