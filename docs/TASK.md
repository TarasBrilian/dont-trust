# TASK.md — Build Plan (frontend → contract)

Implementation backlog for **zk-pob** (zero-knowledge proof of backing for RWA on
Stellar). Derived from a full audit of the repo on 2026-06-16.

Read alongside [CLAUDE.md](../CLAUDE.md) (build rules + invariants) and
[ARCHITECTURE.md](../ARCHITECTURE.md) (crypto/system design). Every task that
touches security references the invariant it must preserve.

## Legend

- Status: ✅ done & verified · 🟡 partial · ⬜ not started
- Priority: **P0** = on the critical path to a live end-to-end demo · **P1** =
  needed for a credible product · **P2** = hardening / scale / nice-to-have
- Each task lists **Depends on** and **Done when** (acceptance criteria).

---

## 0. Current state (what already works)

| Area | State | Evidence |
|---|---|---|
| Circuit `proof_of_backing.circom` | ✅ | compiles; `snarkjs fullprove`+`verify` pass (happy); tamper fails at solvency (l.89) |
| BN254 encoder (`packages/zk/src/encode.ts`) | ✅ | drives the on-chain test vector; G2 `c1\|\|c0` correct |
| Shared commitment/msg (`packages/shared`) | ✅ | single source; consumed by fixtures |
| Verifier contract (Groth16/BN254 + checks) | ✅ | `cargo test -p zk-pob-verifier` = 4 pass (real pairing); wasm builds |
| Token contract (`total_supply`) | ✅ | `cargo test` pass |
| Backend skeleton (NestJS, repository pattern) | 🟡 | builds; DI + in-memory repos done; chain calls stubbed |
| Attestor (EdDSA signer + CLI) | 🟡 | typechecks; never run end-to-end as a process |
| Frontend (dashboard, prover console, request flow) | 🟡 | builds; **all data mock**; no chain/API calls |
| Deploy / e2e scripts | ✅ | deploy.sh (init+allowlist) + e2e.sh (happy+tamper) run on testnet |
| Live testnet deployment | ✅ | token CCHP6GXX..LU64, verifier CDSVPPO6..3HEV; Backed event emitted |
| CI | ⬜ | none |

**Proven twice:** Groth16 verification works offline (snarkjs) and on-chain
(`cargo test` runs the real BN254 host pairing). **Not yet proven:** anything
crossing a process boundary (attestor→api→chain→web).

---

## 1. Architecture decisions to lock FIRST (blockers)

These change downstream work; decide before building Phase 3+.

- [x] **DEC-1 ✅ = (a) One verifier+token deploy per project.** Chosen for the
  hackathon: zero contract changes (the deployed verifier/token already pass
  `cargo test`), full isolation per project, and the demo needs only one pair
  (RWUSD). Many projects = a list of `{tokenId, verifierId}` in `deployed.json`;
  the frontend reads each project's status from its own verifier address.
  Multi-tenant (b) is the future scaling path, not needed now. CON-3 is therefore
  a no-op; `deploy.sh` (OPS-2) deploys one pair.
- [ ] **DEC-2 (P1) — Supply domain.** Circuit range-checks `claimedSupply` to
  64-bit; on-chain supply is `i128`. Decide max supply (cap at 2^64−1 and reject
  larger, or widen the circuit). **Done when:** documented + enforced in circuit
  and `i128_to_felt`.
- [ ] **DEC-3 (P1) — `N` (reserve accounts) policy.** `N=8` is hardcoded in
  `shared` (`N`), circuit (`ProofOfBacking(8)`) and contract (`N_PUBLIC`).
  Decide: fixed N for v1, or per-project N (needs per-N circuit + vk). For N>8
  the Poseidon(2N) ceiling forces the Merkle sum-tree (ARCH §8).
- [ ] **DEC-4 (P0) — Demo trust scope.** For the hackathon, confirm local ptau is
  acceptable (it is, per ARCH §4) and that proving stays server-side.

---

## 2. Circuit & ZK (`packages/zk`)

- [x] **ZK-1 ✅** Circuit with all 5 constraints; offline prove/verify both paths.
- [x] **ZK-2 ✅** `build.sh` compile + trusted setup (local ptau).
- [x] **ZK-3 ✅** BN254 encoder (`encode.ts`) + proving wrapper (`prove`).
- [ ] **ZK-4 (P1)** Unit tests for `encode.ts` — assert G1=64B, G2=128B, the
  `c1||c0` Fp2 ordering, and `feltTo32BE` edge cases. *Done when:* `vitest`/`node
  --test` suite passes; guards the #1 silent-failure surface.
- [x] **ZK-5 ✅** Verify-key export: `encodeVkHex` (reuses `encodeVk`, single-source
  BN254 layout) + `exportvk.mjs` (`npm run vk:export`) read `verification_key.json`
  → `build/vk.contract.json`, the hex-string `VerificationKey` struct `init` takes.
  Validates BytesN widths + IC count (7) + nPublic (6); bytes verified byte-identical
  to the proven on-chain test vector (`testdata.rs`). *Remaining:* `deploy.sh --vk`
  wiring is OPS-2 (gated on DEC-1).
- [ ] **ZK-6 (P2)** Real trusted-setup ceremony (multi-party phase-2) for any
  non-demo use. *Depends on:* DEC-4.
- [ ] **ZK-7 (P2)** Merkle sum-tree variant for N>8 (ARCH §8). *Depends on:* DEC-3.

---

## 3. Contracts (`packages/contracts`)

- [x] **CON-1 ✅** Verifier: Groth16/BN254 `pairing_check`, public-input folding,
  check ordering (INVARIANT 5), live `total_supply` read (INVARIANT 2), allowlist
  (3), token/expiry binding (4). 4 passing tests incl. tamper + supply-mismatch.
- [x] **CON-2 ✅** Token: readable `total_supply`.
- [ ] **CON-3 (P0)** Apply **DEC-1**. If multi-tenant: add `register_project`,
  per-project storage, `submit_proof(project_id, …)`, `status(project_id)`,
  `list_projects`. *Depends on:* DEC-1. *Done when:* `cargo test` covers 2+
  projects; one backed, one under-backed.
- [ ] **CON-4 (P1)** Token: expand to SEP-41 surface (balance/transfer/decimals)
  or document why the minimal token is sufficient for the demo.
- [ ] **CON-5 (P1)** Attestor allowlist management UX: helper to derive the
  `ax||ay` (BytesN<64>) key from the attestor CLI output; `remove_attestor`.
- [ ] **CON-6 (P1)** Events: confirm `Backed` event shape is what `apps/web`/`api`
  index; add a `Rejected`/attempt event if history needs on-chain provenance.
- [ ] **CON-7 (P2)** Storage TTL / bump for persistent entries (allowlist,
  status) so they don't expire on testnet.
- [ ] **CON-8 (P2)** Multi-attestor k-of-n threshold verification (ARCH §8).

---

## 4. Attestor (`apps/attestor`)

- [x] **ATT-1 ✅** `Attestor` class (EdDSA/BabyJubjub) + CLI scaffold.
- [x] **ATT-2 ✅** End-to-end correctness test: signs via the **actual** `Attestor`
  class → `buildWitnessInput` (shared) → `snarkjs fullprove`+`verify`. 3 tests pass
  (`apps/attestor/test/attest-prove-verify.test.mjs`): happy + over-backed verify,
  under-backed is unprovable (solvency constraint, circom l.89). No `genfixture.mjs`
  replica — the test exercises the same builder apps/api uses. Run: `npm test -w apps/attestor`.
- [x] **ATT-3 ✅** `attestor pubkey` prints the on-chain allowlist key (`ax||ay`,
  128 hex) for `allow_attestor` (consumed by deploy.sh); `attestor sign` already
  emits the ingestable attestation JSON. `Attestor.publicKey()` added.
- [ ] **ATT-4 (P1)** Key management: load/generate BabyJubjub key from a file/env
  safely; never log it. Document the separation from `apps/api` (INVARIANT: key
  never in backend).

---

## 5. Shared (`packages/shared`)

- [x] **SH-1 ✅** Canonical commitment/msg + `PUBLIC_SIGNAL_ORDER` + types.
- [ ] **SH-2 (P1)** Unit tests: commitment/msg determinism + a cross-check vector
  shared with the circuit (catch drift = the #1 gotcha).
- [ ] **SH-3 (P2)** Export a runtime-agnostic Poseidon helper wrapper so attestor
  and api construct it identically (reduce per-app glue).

---

## 6. Backend (`apps/api`)

- [x] **API-1 ✅** NestJS skeleton, repository pattern, in-memory adapters, DI.
- [x] **API-2 ✅ — Witness builder.** `buildWitnessInput(attestation, claimedSupply)`
  lives in `packages/shared/src/witness.ts` (single source — also retires the
  genfixture replica); wired into `VerificationService.proveAndSubmitFromAttestation`.
  Validated by ATT-2's `snarkjs verify` (a built witness is accepted). api builds clean.
  Note: `claimedSupply` is passed in, never from the attestation (INVARIANT 6).
- [x] **API-3 ✅ — `ChainService.totalSupply()`** via `@stellar/stellar-sdk` v12
  (`rpc.Server`): credential-free read-only `simulateTransaction` of
  `token.total_supply()`, `scValToNative` i128→bigint. Replaces the stub; api builds.
- [~] **API-4 🟡 — `ChainService.submitProof()`** (code complete; live check pending
  OPS-2/OPS-3). Maps `EncodedProof`→`Proof` struct + signals→`Vec<BytesN<32>>`,
  `prepareTransaction`(simulate+assemble)→sign→`sendTransaction`→poll. **Bug caught
  pre-deploy:** `nativeToScVal({…})` emits scvString keys; a Soroban struct needs
  scvSymbol keys (sorted), so the Proof is now built with an explicit
  `xdr.ScMapEntry`/`scvSymbol` helper — verified offline (symbol keys a,b,c; bytes
  64/128/64; signals vec 6×32B). A trap (PairingFailed/SupplyMismatch/…) surfaces as
  a thrown error at simulate, so the tamper case fails loudly. OPS-3 proved the
  encoded proof/signals bytes are contract-valid live (a real proof verified
  on-chain via the same @zk-pob/zk encoder); the remaining unexercised bit is only
  ChainService's own stellar-sdk submission plumbing, which API-5 will drive.
  *Depends on:* CON-3 (no-op per DEC-1), ZK-5 ✅.
- [ ] **API-5 (P0) — Endpoints.** `POST /attestations` (ingest attestor output),
  `POST /verifications` (build witness → prove → submit → persist), keep
  `GET /verifications`. Add DTO validation (`class-validator`). *Depends on:*
  API-2..4.
- [ ] **API-6 (P1) — Verification-request backend.** Mirror the frontend flow
  server-side: `VerificationRequest` entity + repository, `POST /requests`,
  `GET /requests`, `PATCH /requests/:id` (status transitions), approve →
  register on-chain (allowlist + project). *Depends on:* DEC-1.
- [ ] **API-7 (P1) — Real persistence adapter.** Implement a DB adapter (e.g.
  Prisma/Postgres) behind `IAttestationRepository`/`IVerificationRepository`
  (proves the repository pattern). Store commitments/proofs/status — **never raw
  balances** (ARCH §2). *Done when:* adapter swapped in `app.module` with no
  service change.
- [ ] **API-8 (P1)** Config validation (`@nestjs/config` schema) for RPC_URL,
  IDs, ZK artifact paths; fail fast if missing.
- [ ] **API-9 (P2)** AuthN/AuthZ for admin review actions + attestor ingestion.
- [ ] **API-10 (P2)** Background scheduler for periodic re-attestation per
  project `frequency`.

---

## 7. Frontend (`apps/web`)

- [x] **WEB-1 ✅** Dashboard (portfolio overview + project grid + history).
- [x] **WEB-2 ✅** Prover console (interactive tamper demo, simulated).
- [x] **WEB-3 ✅** Verification request flow (form → queue → detail, localStorage).
- [ ] **WEB-4 (P0) — `lib/chain.ts` real reads.** Implement `readSupply()` and
  `readBackingStatus()` against the deployed contracts via stellar-sdk (the
  trustless path — INVARIANT: status comes from chain, not the API). Replaces the
  stubs. *Depends on:* CON-3, OPS-2.
- [ ] **WEB-5 (P0) — Swap mock → live on the dashboard.** `getProjects()` reads
  chain status per project; keep `lib/mock.ts` behind a flag for offline demos.
  *Depends on:* WEB-4.
- [ ] **WEB-6 (P1) — Wire request flow to the API** (`POST /requests`, queue/detail
  from `GET/PATCH`), replacing the localStorage store. *Depends on:* API-6.
- [ ] **WEB-7 (P1) — Prover console → backend.** Optional "real proof" mode that
  calls `POST /verifications` so the console runs an **actual** Groth16 proof, not
  a simulation. Keep the simulated mode for offline demos. *Depends on:* API-5.
- [ ] **WEB-8 (P1) — Wallet integration (Freighter)** for issuer submission and
  admin approve/reject signing real transactions.
- [ ] **WEB-9 (P2)** History from chain events (indexed) + per-project history.
- [ ] **WEB-10 (P2)** Polish: post-submit toast, nav queue-count badge, status
  transition animations, empty/error/loading states for live data.
- [ ] **WEB-11 (P2)** Frontend tests (component + a Playwright happy-path) +
  accessibility pass.

---

## 8. Scripts / DevOps

- [x] **OPS-1 ✅** `deploy.sh` builds + deploys wasm (version-agnostic path).
- [x] **OPS-2 ✅ — `deploy.sh` deploys + initializes on testnet.** Deploys a
  token+verifier pair (DEC-1=a), runs `token.init`/`set_supply(1000000)`,
  `verifier.init` (token + tokenId felt 424242 + ZK-5 vk), `allow_attestor` (key
  from `attestor pubkey`); writes `deployed.json` and upserts ids into `.env`.
  **Deployed live:** token `CCHP6GXXU7NCOUZ3636BYJGMWPGCPDVNTDFI2GWQBI2KOSYHVQZALU64`,
  verifier `CDSVPPO6PQESEIHB6PUWVIX63KBIKJ6NSUEXMHY5GLI3QRQFHGUV3HEV`. Verified
  on-chain: `total_supply()==1000000`, `status()==null` (no proof yet).
- [x] **OPS-3 ✅ — `e2e.sh` runs the full loop on testnet.** HAPPY:
  attest→witness(shared builder)→`snarkjs fullprove`+verify→`submit_proof`→on-chain
  `Backed` event, `status().backed==true` (supply 1000000). TAMPER A (a balance
  below threshold): proof is unprovable. TAMPER B (flipped public signal): verifier
  rejects on-chain. Helpers: `scripts/lib/{mkwitness,encode-submit}.mjs`. Proven tx:
  `7981595f090810f68ef24aa360ed19e0ffa68a70495f491c2a128e9e3c829b23`.
- [ ] **OPS-4 (P1) — CI** (GitHub Actions): `cargo test`, `npm run build`
  (workspaces), circuit compile, encoder/shared unit tests on every push.
- [ ] **OPS-5 (P1)** Funded testnet identity setup doc + `.env` wiring across apps.
- [ ] **OPS-6 (P2)** Containerize api + a deploy target for web (Vercel) and api.

---

## 9. Critical path to a live end-to-end demo

The shortest ordered route from "mock" to "real attest→prove→verify on testnet":

1. **DEC-1** decide token model → **CON-3** contract matches it
2. **ZK-5** vk export → **OPS-2** deploy + init on testnet (`deployed.json`)
3. **API-2** witness builder → **API-3/4** chain read + submit → **API-5** endpoints
4. **ATT-2** attestor output proven circuit-valid
5. **OPS-3** e2e happy + tamper on testnet (the headline proof)
6. **WEB-4/5** dashboard reads live status from chain
7. (then P1) **API-6 + WEB-6** request flow on real backend; **WEB-7** console
   runs real proofs; **WEB-8** wallet signing

Everything in §0 marked ✅ stays the foundation; this path only connects it.

---

## 10. Definition of done (project-level, from CLAUDE.md)

A change is complete when: circuit verifies offline, `cargo test` passes,
`e2e.sh` runs the attest→prove→verify happy path on testnet, **and** the tamper
case (one balance below threshold) fails on-chain. Both paths demonstrated.
