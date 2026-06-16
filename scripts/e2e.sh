#!/usr/bin/env bash
#
# End-to-end happy path + tamper case (CLAUDE.md "Done means"). Both must run:
#   happy:  attest -> prove -> submit -> on-chain status == backed
#   tamper: drop one balance below threshold -> proof fails on-chain
#
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
DEPLOYED=".deploy/deployed.json"

[ -f "$DEPLOYED" ] || { echo "run ./deploy.sh first ($DEPLOYED missing)"; exit 1; }

echo "==> 1. attestor signs the reserve book"
# ATTESTOR_PRIVATE_KEY=... node apps/attestor sign --book reserves.json \
#   --token <tokenIdFelt> --expiry <unix>  > attestation.json

echo "==> 2. backend builds witness + proves (snarkjs fullprove)"
# offline check first (cheaper failure loop — CLAUDE.md):
#   cd "$ROOT/packages/zk"
#   snarkjs groth16 fullprove input.json build/proof_of_backing_js/proof_of_backing.wasm \
#       build/proof_of_backing_final.zkey proof.json public.json
#   snarkjs groth16 verify build/verification_key.json public.json proof.json

echo "==> 3. submit proof to verifier"
# stellar contract invoke --id <verifierId> -- submit_proof --proof ... --signals ...

echo "==> 4. assert on-chain status == backed"
# stellar contract invoke --id <verifierId> -- status

echo "==> 5. TAMPER: re-run with one balance below threshold, expect failure"
# rebuild witness with a lowered balance; submit_proof must return PairingFailed.

echo "TODO: wire steps above once apps + contracts are implemented."
