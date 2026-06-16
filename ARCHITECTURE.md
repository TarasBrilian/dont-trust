# Architecture

Cryptographic and system design for zk-pob. For the pitch, quickstart, and demo,
see [README.md](./README.md). This document assumes you know *what* the project
claims and explains *how* it holds.

## 1. The two-sided insight

Every proof-of-reserves has two halves:

- **Liabilities** — total claims you owe. For a centralized exchange this is the
  hard, fraud-prone half. For an on-chain RWA token it is simply the token's
  `total_supply` — **public and trustless on Stellar**. We do not prove it; the
  verifier *reads* it.
- **Assets** — your real reserves, held off-chain. This is the half that needs ZK,
  because the chain cannot inspect a bank balance.

So the system proves exactly one relation: `sum(attested reserves) ≥ live supply`,
binding a privately-held asset set to a publicly-read liability number.

## 2. System components and trust boundary

The architecture is driven by one rule: **raw reserve balances may exist only inside
the attestor and the backend** — never in the frontend, on-chain, or in any reader.

| Component | App / package | Tech | Responsibility | Sees raw balances? |
|---|---|---|---|---|
| Attestor | `apps/attestor` | Node + circomlibjs | Holds the BabyJubjub key; signs the balance set. Separate process from the backend so the issuer never holds the attestor key. | yes (source) |
| ZK | `packages/zk` | Circom + snarkjs | Circuit, trusted-setup keys, proving library. Build-time artifact + runtime lib, not a service. | no |
| Backend | `apps/api` | NestJS, repository pattern | Builds witness, generates the Groth16 proof (server-side — witness holds secrets), submits to Soroban, persists history. | yes (transient) |
| Verifier | `packages/contracts/verifier` | Soroban / Rust | On-chain check: allowlist, live supply, freshness, `pairing_check`. Source of truth for status. | no |
| Token | `packages/contracts/token` | Soroban / Rust | Sample RWA token; exposes `total_supply`. | no |
| Frontend | `apps/web` | Next.js (App Router) | Dashboard. Reads supply + backing status **directly from chain** (trustless); calls the backend only for non-critical history/metadata. | no |

Data flow:

```
attestor  ── balances + signature ─────────────▶  backend (api)
packages/zk  ── wasm + zkey ───────────────────▶  backend (api)
backend  ── proof + public signals ────────────▶  verifier (soroban)
verifier ── reads total_supply ────────────────▶  token (soroban)
frontend ── reads "backed as of ledger T" ─────▶  verifier (soroban)   (trustless)
frontend ── reads history/metadata ────────────▶  backend (api)        (non-critical)
```

Persistence note: the database stores commitments, proofs, and verification status —
**never raw balances**. Why proving is server-side and not in the browser: the witness
contains the private balances, so it must never reach a client. Why the frontend reads
status from chain rather than the backend: the core claim must not require trusting the
backend; only history (which is non-authoritative) comes from the API.

## 3. The circuit

A circuit is not wiring — it is a large system of arithmetic equations over the
BN254 scalar field (integers mod a ~254-bit prime) that is satisfiable **only if
the claim is true**. All logic reduces to additions and multiplications.

`N` = number of reserve accounts (compile-time constant; demo uses 8).

### Signals

| Visibility | Signal | Meaning |
|---|---|---|
| private | `balances[N]` | per-account reserve balances |
| private | `salts[N]` | per-account blinding for the commitment |
| private | `R8x, R8y, S` | attestor's EdDSA signature components |
| public | `attestorAx, attestorAy` | attestor public key (BabyJubjub) |
| public | `commitment` | `Poseidon` commitment to `(balances, salts)` |
| public | `claimedSupply` | liability the proof is bound to |
| public | `tokenId` | token contract this attestation is bound to |
| public | `expiry` | attestation freshness deadline |

### Constraints (all must hold, or no witness exists)

1. **Commitment binding** — recompute `commitment == Poseidon(balances, salts)`.
   Ties the public commitment to the private balances.
2. **Attestation** — `EdDSAPoseidonVerifier` over
   `msg = Poseidon(commitment, tokenId, expiry)`. Proves the attestor signed *this*
   reserve set, for *this* token, with *this* deadline. Signature verification
   happens **inside** the circuit, as curve equations — not trusted from outside.
3. **Range checks** — `Num2Bits(64)` on every `balances[i]`. **Mandatory, not
   cosmetic:** field elements wrap mod the prime, so an unconstrained "balance" near
   the prime can behave like a huge or negative number and pass the comparison
   falsely. Bounding each balance to `[0, 2^64)` makes the sum unable to wrap
   (`sum ≤ 2^(64+log2 N) ≪ prime`). This is the classic ZK soundness bug.
4. **Aggregation** — `R = Σ balances[i]` (in-circuit for v1; see §7 for the
   sum-tree path).
5. **Solvency** — `GreaterEqThan(R, claimedSupply) === 1`.

`claimedSupply` is *not* signed by the attestor — the attestor attests reserves,
not liabilities. The binding of `claimedSupply` to reality happens on-chain (§5).

## 4. Proving system

- **Witness** — the full solution to the equation system: every private value plus
  all intermediates. Large, secret, never leaves the prover.
- **Proof** — a ~200-byte object (Groth16: `A∈G1, B∈G2, C∈G1`) asserting "I know a
  satisfying witness" without revealing it. Size is **constant** regardless of `N`
  (succinct) → constant on-chain verification cost.
- **Curve** — snarkjs Groth16 defaults to `bn128` (= BN254), and circomlib EdDSA
  uses BabyJubjub (embedded in BN254's scalar field). Both match Stellar's BN254
  host functions exactly — no curve translation needed.
- **Trusted setup** — Groth16 needs a per-circuit setup that emits "toxic waste"
  (secret randomness) which **must be destroyed**; whoever keeps it can forge any
  proof. Production needs a multi-party ceremony (one honest participant suffices).
  This repo uses a public Powers-of-Tau file + a phase-2 contribution; the
  limitation is disclosed and acceptable for a hackathon.

## 5. On-chain verification (Soroban)

The verifier does not re-run the computation. It checks a single bilinear pairing
equation of the form `e(A,B) = e(α,β) · e(L,γ) · e(C,δ)`, where `α,β,γ,δ` come from
the verification key and `L` is the public signals folded into a curve point. X-Ray
provides the primitives: `bn254_g1_add` and `bn254_g1_mul` build `L`, and
`pairing_check` evaluates the final equation. Because the public signals are folded
into `L`, altering any of them (e.g. `claimedSupply`) unbalances the equation, so a
proof is cryptographically bound to its public inputs.

`submitProof(proof, publicSignals)` — application checks first, crypto last:

1. `(attestorAx, attestorAy)` ∈ on-chain attestor allowlist.
   *Without this, anyone registers their own key and proves anything.*
2. `claimedSupply == token.total_supply()` — **read live from the token contract**,
   never trusted from the prover. *Otherwise the prover lowballs the liability.*
3. `tokenId == configured token address`. *Prevents reusing an attestation across
   tokens (double-counting).*
4. `expiry > current ledger timestamp`. *Rejects stale attestations.*
5. `pairing_check(...)` over the BN254 host functions.
6. On success: store `{ verified_at, commitment, backed: true }`, emit event.

## 6. Trust model & limits

These are inherent to *all* proof-of-reserves, not specific weaknesses. ZK adds
privacy on top of the standard PoR trust model; it does not change these:

- **The attestor can lie.** A signed fake balance proves fine. Trust anchors on the
  signature. Mitigation: a regulated auditor whose signature is legally binding, or
  **multiple independent attestors** with a threshold proven in-circuit.
- **Cross-token double-counting** — the same reserves attested for two tokens.
  Mitigated by binding `tokenId` into the signed message (constraint 2 + check 3).
- **Borrow-on-attestation-day** — funds borrowed only while audited. A temporal
  problem no ZK proof solves; mitigated operationally by frequent/random attestation
  windows. Out of scope.

## 7. Threat model

| Attack | Mitigation |
|---|---|
| Forge / self-register attestor | On-chain attestor allowlist (check 1) |
| Lowball liability | Live `total_supply` read on-chain (check 2) |
| Field-wraparound balance | `Num2Bits(64)` per balance (constraint 3) |
| Reuse attestation across tokens | `tokenId` bound in signed msg (constraint 2, check 3) |
| Replay stale attestation | `expiry` vs ledger time (check 4) |
| Tamper public inputs | Pairing binds inputs into `L` (§5) |
| Fabricated reserves | Out of ZK scope — multi-attestor / legal accountability |

## 8. Scaling path

- **Merkle sum-tree** — replace in-circuit summation with a sum-tree where each
  internal node carries `hash` + `subtotal`, rooted at `(rootHash, R)`. Benefits:
  each custodian can later be handed a Merkle path to verify its own leaf is in the
  published root without seeing others; the root binds structure and total together.
- **Multi-attestor threshold** — verify `k`-of-`n` independent attestor signatures
  in-circuit, reducing reliance on any single attestor.
- **Per-asset valuation** — extend leaves with `(quantity, signed_price)` and prove
  `Σ quantity·price ≥ supply` for non-1:1 reserves (e.g. T-bills at market).