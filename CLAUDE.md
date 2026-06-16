# CLAUDE.md

Operational guide for working in this repo. Concept and pitch: [README.md](./README.md).
Cryptographic design and rationale: [ARCHITECTURE.md](./ARCHITECTURE.md). This file
does not repeat them — it tells you how to build here and what must never break.

**One line:** prove `sum(attested off-chain reserves) ≥ on-chain token supply` with a
Groth16/BN254 proof, verified on a Soroban contract, without disclosing the reserves.

## Where things live

Monorepo. `apps/*` are runnable; `packages/*` are libs/artifacts/contracts.

- `apps/attestor` — Node + circomlibjs. Holds the BabyJubjub key, signs the balance
  set. **Separate from the backend on purpose** — never move the attestor key into
  `apps/api`. Output format must match the circuit's `msg`/commitment byte-for-byte.
- `apps/api` — NestJS, **repository pattern**. Builds witness, runs the prover, submits
  to Soroban, persists. Domain services depend on repository *interfaces*
  (`IAttestationRepository`, `IVerificationRepository`) via DI; DB adapters are swappable.
  Proving lives here, not in the browser, because the witness holds private balances.
- `apps/web` — Next.js (App Router, latest). Reads supply + backing status **directly
  from chain** via stellar-sdk (trustless); the backend is called only for history.
  Do not route the backing-status read through the backend.
- `packages/zk` — `proof_of_backing.circom` is the source of truth for the constraint
  system. `build.sh` compiles + runs setup. Also exposes the snarkjs proving wrapper
  used by `apps/api`.
- `packages/shared` — the one definition of the Poseidon commitment/`msg` input order,
  shared by `apps/attestor` and `apps/api`. Change it here, nowhere else.
- `packages/contracts/{verifier,token}` — Soroban/Rust. Verifier uses Protocol 25 host
  fns: `bn254_g1_add`, `bn254_g1_mul`, `pairing_check`.
- `scripts/` — `deploy.sh`, `e2e.sh`.

## Commands

```bash
cd packages/zk && ./build.sh              # compile circuit + trusted setup (idempotent)
# offline proof check before touching anything on-chain:
cd packages/zk && snarkjs groth16 fullprove ... && snarkjs groth16 verify ...
stellar contract build                    # in each packages/contracts/* crate
cargo test --manifest-path packages/contracts/verifier/Cargo.toml
cd apps/api && npm run start:dev           # NestJS backend
cd apps/web && npm run dev                 # Next.js dashboard
cd scripts && ./deploy.sh && ./e2e.sh      # testnet deploy + full happy path
```

Always validate a circuit change offline (`fullprove` + `verify`) **before** touching
the contract or the backend. Cheaper failure loop.

## Conventions

- Circom 2.1.x, circomlib pinned. snarkjs Groth16 on `bn128` (= BN254). Do not switch
  curves — it is what makes the Stellar host functions usable.
- `N` (reserve account count) is a compile-time constant. Treat it as fixed per build.
- EdDSA is BabyJubjub (circomlib), **not** Ed25519/ECDSA. The attestor signs with
  BabyJubjub keys; do not introduce RSA/ECDSA verification in-circuit (huge cost).
- Public signal order is a contract between circuit, snarkjs output, and the verifier.
  If you reorder or add public signals, update all three or verification silently fails.
- Backend (`apps/api`): domain services depend on repository *interfaces*, never on a
  concrete ORM. Keep DB access behind the repository adapters; no query logic in services.
- Frontend (`apps/web`): the backing-status and supply reads go to chain, not the API.
  Treat the backend as a source for history only.

## Invariants — never break these

These are security-critical. Violating any one makes the system forgeable. See
ARCHITECTURE §3/§5/§7 for why.

1. **Range-check every balance** (`Num2Bits(64)`) before summation. Removing it allows
   field-wraparound forgery.
2. **Verifier reads `total_supply` live** from the token contract. Never accept the
   prover's `claimedSupply` as ground truth.
3. **Attestor key must be checked against the on-chain allowlist.** No allowlist check
   = anyone forges attestations.
4. **`tokenId` and `expiry` are bound inside the signed message** and re-checked
   on-chain. Do not drop them to "simplify."
5. **Application checks run before `pairing_check`** (cheap-fail ordering), but the
   pairing check is never skipped or short-circuited.
6. Attestor signs **reserves only**, never `claimedSupply`. Keep asset/liability
   separation intact.

## Gotchas

- Commitment/`msg` mismatch between `attestor/` and `circuits/` is the #1 silent
  failure: proof generates fine offline but the formulas differ → on-chain reject.
  Keep one shared definition of the Poseidon inputs.
- snarkjs public-signal array order ≠ circuit declaration order in some cases; trust
  the generated `public.json`, and map it explicitly in the verifier.
- BN254 point serialization for the host functions is big-endian `concat(X, Y)`; match
  it exactly when passing `vk` and proof points.
- Trusted-setup artifacts (`.zkey`) are build outputs — regenerate, never hand-edit.

## Done means

A change is complete when: circuit verifies offline, `cargo test` passes, `e2e.sh`
runs the attest→prove→verify happy path on testnet, **and** the tamper case (one
balance below threshold) fails on-chain. Both paths must be demonstrated.