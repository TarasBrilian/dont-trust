#!/usr/bin/env bash
#
# Deploy token + verifier to Stellar testnet and register the attestor key.
# Writes contract ids to scripts/.deploy/deployed.json for e2e.sh and the apps.
#
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
OUT=".deploy"
mkdir -p "$OUT"

NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${STELLAR_SOURCE:-default}"   # a funded testnet identity in `stellar keys`

command -v stellar >/dev/null || { echo "stellar CLI not found"; exit 1; }

echo "==> building contracts"
stellar contract build --manifest-path "$ROOT/packages/contracts/token/Cargo.toml"
stellar contract build --manifest-path "$ROOT/packages/contracts/verifier/Cargo.toml"

# stellar CLI's wasm target dir changed across versions (wasm32v1-none on 25.x,
# wasm32-unknown-unknown earlier). Resolve it instead of hardcoding.
find_wasm() {
  find "$ROOT/target" -name "$1" -path "*release*" -not -path "*/deps/*" 2>/dev/null | head -1
}
TOKEN_WASM=$(find_wasm zk_pob_token.wasm)
VERIFIER_WASM=$(find_wasm zk_pob_verifier.wasm)
[ -n "$TOKEN_WASM" ] && [ -n "$VERIFIER_WASM" ] || { echo "wasm not found under target/"; exit 1; }

echo "==> deploying token"
TOKEN_ID=$(stellar contract deploy \
  --wasm "$TOKEN_WASM" \
  --source "$SOURCE" --network "$NETWORK")

echo "==> deploying verifier"
VERIFIER_ID=$(stellar contract deploy \
  --wasm "$VERIFIER_WASM" \
  --source "$SOURCE" --network "$NETWORK")

echo "token:    $TOKEN_ID"
echo "verifier: $VERIFIER_ID"

# TODO: stellar contract invoke ... init (token, verifier) and allow_attestor
#       with the attestor public key emitted by apps/attestor.

cat > "$OUT/deployed.json" <<JSON
{
  "network": "$NETWORK",
  "tokenId": "$TOKEN_ID",
  "verifierId": "$VERIFIER_ID"
}
JSON
echo "==> wrote $OUT/deployed.json"
