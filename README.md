# zk-pob — Zero-Knowledge Proof of Backing for RWA on Stellar

Prove that a tokenized real-world asset is fully backed by off-chain reserves —
**without revealing the reserve book, the custodians, or any per-account balance.**

Built for *Stellar Hacks: Real-World ZK*. Verifies a Groth16 proof on-chain using
the BN254 host functions introduced in Protocol 25 (X-Ray).

## The problem

A tokenized RWA (e.g. a treasury-backed token) claims 1:1 backing by off-chain
assets. Today, proving that claim forces a bad trade-off:

- **Publish the book** → leaks balances, counterparties, and positions.
- **Trust an auditor's word** → reintroduces the single trusted party that
  on-chain finance exists to remove. Counterparty/redemption risk is the #1 risk
  in RWA.

There has been no way to prove `reserves ≥ supply` *publicly*, *without a trusted
checker*, and *without disclosing the book*. Zero-knowledge is the only tool that
does all three at once.

## What it does

An attestor (custodian/auditor/bank) signs the reserve balances. The issuer then
produces a single ~200-byte proof that the signed reserves sum to **at least** the
token's on-chain circulating supply. A Soroban contract verifies the proof and the
live supply, then records a public, tamper-proof "fully backed as of ledger T"
status. Anyone can read that status; no one ever sees the book.

One structural advantage of doing this for an *on-chain* RWA: the **liability side
is already public** (the token's `total_supply`), so only the asset side needs ZK.
Half the classic proof-of-reserves problem is solved for free by Stellar.

How it works cryptographically: see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Tech stack

| Layer | Choice |
|---|---|
| Circuit | Circom 2.1.x + circomlib (`Poseidon`, `EdDSAPoseidonVerifier`, `Num2Bits`, `GreaterEqThan`) |
| Proving | snarkjs · Groth16 · BN254 (`bn128`) |
| Attestation | Node.js + circomlibjs — EdDSA over BabyJubjub |
| Backend | NestJS (repository pattern) — proving + orchestration API |
| Frontend | Next.js (App Router, latest) + TypeScript |
| On-chain | Soroban (Rust), Protocol 25+ BN254 host functions |
| Network | Stellar testnet |

The on-chain Groth16 verifier is **adapted, not invented** — the verification
algorithm is generic. The differentiator is the circuit and the application logic.

## Repo layout

```
apps/
  web/        Next.js (App Router) dashboard — trustless chain reads + history
  api/        NestJS backend — proving, submission, persistence (repository pattern)
  attestor/   Standalone signer (custodian) — EdDSA over reserve balances
packages/
  zk/         Circom circuits, build, keys, snarkjs proving library
  shared/     Single source of truth for the Poseidon commitment/msg format + types
  contracts/
    verifier/ Soroban Groth16/BN254 verifier + proof-of-backing logic
    token/    Sample RWA token exposing total_supply
scripts/      Deploy + end-to-end runner
```

## Quickstart

Prerequisites: Node 20+, Rust + `stellar` CLI, `circom` 2.1.x, `snarkjs`.

```bash
# 0. Install workspace deps from the repo root
npm install

# 1. Build circuit + run trusted setup (generates a local ptau)
cd packages/zk && ./build.sh     # -> build/proof_of_backing.{wasm,zkey}, verification_key.json

# 2. Deploy token + verifier to testnet, register the attestor key
cd ../../scripts && ./deploy.sh

# 3. Run the full demo (attest -> prove -> verify on-chain)
./e2e.sh

# 4. Dashboard
cd ../apps/web && npm run dev
```

## Demo (the "aha")

1. Dashboard shows token supply (public, e.g. `1,000,000 RWUSD`) and a green badge:
   **Fully backed ✓ — verified on-chain 2 min ago**, produced by a ZK proof.
2. The reserve book, the banks, and every per-account balance are **nowhere** in
   any transaction.
3. Drop one reserve balance below the threshold → regenerate → the proof **fails
   on-chain verification** → badge turns red. Proves the badge is real, not cosmetic.

## Trust model (short)

ZK does not make the attestor honest — if a custodian signs a fake balance, the
proof faithfully proves the fake. Trust still anchors on the attestor's signature.
What ZK removes is the *disclosure* of the book and the need for a trusted
*checker*. This is the inherent limit of all proof-of-reserves; ZK adds privacy on
top of the standard PoR trust model rather than weakening it. Full threat model and
mitigations (multi-attestor, token binding, freshness) in
[ARCHITECTURE.md](./ARCHITECTURE.md#trust-model--limits).

## License

MIT.