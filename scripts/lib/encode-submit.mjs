// e2e helper: snarkjs proof.json + public.json -> the hex args `submit_proof`
// takes, via the @zk-pob/zk BN254 encoder (single source incl. G2 c1||c0).
// Writes <proofOut> ({a,b,c} hex struct) and <signalsOut> ([hex x6]).
// Usage: node encode-submit.mjs <proof.json> <public.json> <proofOut> <signalsOut>
import { readFileSync, writeFileSync } from "node:fs";
import { encodeProof, encodePublicSignals, bytesToHex } from "@zk-pob/zk";

const [proofPath, publicPath, proofOut, signalsOut] = process.argv.slice(2);
if (!proofPath || !publicPath || !proofOut || !signalsOut) {
  throw new Error("usage: encode-submit.mjs <proof.json> <public.json> <proofOut> <signalsOut>");
}

const proof = JSON.parse(readFileSync(proofPath, "utf8"));
const pub = JSON.parse(readFileSync(publicPath, "utf8"));

const ep = encodeProof(proof);
const proofArg = { a: bytesToHex(ep.a), b: bytesToHex(ep.b), c: bytesToHex(ep.c) };
const signalsArg = encodePublicSignals(pub).map(bytesToHex);

writeFileSync(proofOut, JSON.stringify(proofArg));
writeFileSync(signalsOut, JSON.stringify(signalsArg));
console.error(`encode-submit: wrote ${proofOut}, ${signalsOut}`);
