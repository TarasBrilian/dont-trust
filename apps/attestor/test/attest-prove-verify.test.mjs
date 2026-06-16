/**
 * ATT-2: prove the SHIPPED attestor output is circuit-valid.
 *
 * Signs with the real `Attestor` class (not a replica), builds the witness via the
 * shared `buildWitnessInput` — the exact code apps/api uses — then runs a real
 * Groth16 fullprove and checks snarkjs `verify` accepts it. Also asserts the tamper
 * path (reserves < claimedSupply) is unprovable: the in-circuit solvency constraint
 * makes witness generation fail. This is the offline half of CLAUDE.md "Done means";
 * the on-chain half lives in the verifier's cargo tests.
 *
 * Requires packages/zk build artifacts. Run `./build.sh` in packages/zk first
 * (the tests skip with a message if they are missing).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Attestor } from "../dist/index.js";
import { buildWitnessInput, N } from "@zk-pob/shared";
import { prove, verifyOffline } from "@zk-pob/zk";

const here = dirname(fileURLToPath(import.meta.url));
const ZK_BUILD = resolve(here, "../../../packages/zk/build");
const wasmPath = resolve(ZK_BUILD, "proof_of_backing_js/proof_of_backing.wasm");
const zkeyPath = resolve(ZK_BUILD, "proof_of_backing_final.zkey");
const vkPath = resolve(ZK_BUILD, "verification_key.json");

const haveArtifacts =
  existsSync(wasmPath) && existsSync(zkeyPath) && existsSync(vkPath);
const skip = haveArtifacts ? false : "packages/zk build artifacts missing — run ./build.sh";

// Deterministic 32-byte BabyJubjub private key (demo only; never a real key).
const PRIV = Uint8Array.from(Buffer.from("01".repeat(32), "hex"));
const TOKEN_ID = 424242n;
const EXPIRY = 7777777777n;

const SALTS = [11n, 22n, 33n, 44n, 55n, 66n, 77n, 88n];

function accounts(balances) {
  return balances.map((balance, i) => ({ balance, salt: SALTS[i] }));
}

test("real attestor output proves and verifies (happy path)", { skip }, async () => {
  const balances = [250000n, 180000n, 150000n, 120000n, 100000n, 90000n, 70000n, 40000n];
  assert.equal(balances.length, N, "balances must have N accounts");
  const claimedSupply = 1_000_000n; // == sum(balances): fully backed

  const attestor = await Attestor.create(PRIV);
  const attestation = await attestor.attest(accounts(balances), TOKEN_ID, EXPIRY);

  const witness = buildWitnessInput(attestation, claimedSupply);
  const { proof, publicSignals } = await prove(witness, { wasmPath, zkeyPath });

  const vk = JSON.parse(readFileSync(vkPath, "utf8"));
  const ok = await verifyOffline(vk, publicSignals, proof);
  assert.equal(ok, true, "valid proof over sufficient reserves must verify");
});

test("over-backed reserves still prove (sum > supply)", { skip }, async () => {
  const balances = [250000n, 180000n, 150000n, 120000n, 100000n, 90000n, 70000n, 40000n];
  const claimedSupply = 999_999n; // sum (1_000_000) > supply: still solvent

  const attestor = await Attestor.create(PRIV);
  const attestation = await attestor.attest(accounts(balances), TOKEN_ID, EXPIRY);

  const witness = buildWitnessInput(attestation, claimedSupply);
  const { proof, publicSignals } = await prove(witness, { wasmPath, zkeyPath });

  const vk = JSON.parse(readFileSync(vkPath, "utf8"));
  assert.equal(await verifyOffline(vk, publicSignals, proof), true);
});

test("under-backed reserves are unprovable (tamper path)", { skip }, async () => {
  const balances = [1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n]; // sum = 8
  const claimedSupply = 1_000_000n; // >> sum: solvency constraint fails

  const attestor = await Attestor.create(PRIV);
  const attestation = await attestor.attest(accounts(balances), TOKEN_ID, EXPIRY);
  const witness = buildWitnessInput(attestation, claimedSupply);

  // fullProve throws when the constraint system is unsatisfiable.
  await assert.rejects(prove(witness, { wasmPath, zkeyPath }));
});
