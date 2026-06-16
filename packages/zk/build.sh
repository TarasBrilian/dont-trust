#!/usr/bin/env bash
#
# Compile proof_of_backing.circom and run the Groth16 trusted setup.
# Idempotent: re-running regenerates artifacts in build/. Never hand-edit .zkey.
#
# Outputs (in build/):
#   proof_of_backing.r1cs                constraint system
#   proof_of_backing_js/                 wasm witness generator
#   proof_of_backing_final.zkey          proving key (phase-2 contribution applied)
#   verification_key.json                verification key (consumed by the verifier)
#
set -euo pipefail
cd "$(dirname "$0")"

CIRCUIT=proof_of_backing
PTAU_POWER=14                 # 2^14 constraints headroom; bump if compile reports more
BUILD=build
PTAU="$BUILD/pot${PTAU_POWER}_final.ptau"

mkdir -p "$BUILD"

command -v circom  >/dev/null || { echo "circom not found (need 2.1.x)"; exit 1; }
command -v snarkjs >/dev/null || { echo "snarkjs not found"; exit 1; }

echo "==> compiling circuit"
circom "circuits/${CIRCUIT}.circom" \
  --r1cs --wasm --sym \
  -l ../../node_modules \
  -o "$BUILD"

echo "==> powers of tau (phase 1)"
if [ ! -f "$PTAU" ]; then
  # For a hackathon we generate a fresh ptau locally. Production must use a
  # public, audited ceremony output instead (ARCHITECTURE §4 "Trusted setup").
  snarkjs powersoftau new bn128 "$PTAU_POWER" "$BUILD/pot_0000.ptau" -v
  snarkjs powersoftau contribute "$BUILD/pot_0000.ptau" "$BUILD/pot_0001.ptau" \
    --name="first contribution" -v -e="$(head -c 64 /dev/urandom | base64)"
  snarkjs powersoftau prepare phase2 "$BUILD/pot_0001.ptau" "$PTAU" -v
fi

echo "==> groth16 setup (phase 2)"
snarkjs groth16 setup "$BUILD/${CIRCUIT}.r1cs" "$PTAU" "$BUILD/${CIRCUIT}_0000.zkey"
snarkjs zkey contribute "$BUILD/${CIRCUIT}_0000.zkey" "$BUILD/${CIRCUIT}_final.zkey" \
  --name="phase2 contribution" -v -e="$(head -c 64 /dev/urandom | base64)"
snarkjs zkey export verificationkey "$BUILD/${CIRCUIT}_final.zkey" "$BUILD/verification_key.json"

echo "==> done. artifacts in $BUILD/"
echo
echo "Offline proof check (validate BEFORE touching the contract — see CLAUDE.md):"
echo "  snarkjs groth16 fullprove input.json \\"
echo "      $BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm $BUILD/${CIRCUIT}_final.zkey \\"
echo "      proof.json public.json"
echo "  snarkjs groth16 verify $BUILD/verification_key.json public.json proof.json"
