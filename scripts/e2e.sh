#!/usr/bin/env bash
#
# OPS-3 — End-to-end on Stellar testnet (CLAUDE.md "Done means"). Demonstrates:
#   HAPPY:   attest -> witness -> prove -> submit -> on-chain status == backed
#   TAMPER A (under-backed): drop a balance below threshold -> proof is unprovable
#   TAMPER B (on-chain):     flip a public signal of a valid proof -> verifier rejects
#
# Reads ids from .deploy/deployed.json and the attestor key from .env (both written
# by deploy.sh). Run ./deploy.sh first.
#
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
ZK="$ROOT/packages/zk"
WORK=".e2e"
DEPLOYED=".deploy/deployed.json"

[ -f "$DEPLOYED" ] || { echo "run ./deploy.sh first ($DEPLOYED missing)"; exit 1; }
command -v stellar >/dev/null || { echo "stellar CLI not found"; exit 1; }

SNARKJS="$ROOT/node_modules/.bin/snarkjs"
[ -x "$SNARKJS" ] || SNARKJS="snarkjs"
command -v "$SNARKJS" >/dev/null 2>&1 || { echo "snarkjs not found"; exit 1; }

# Attestor key + identity config from .env (deploy.sh wrote them).
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
[ -n "${ATTESTOR_PRIVATE_KEY:-}" ] || { echo "ATTESTOR_PRIVATE_KEY not set (run ./deploy.sh)"; exit 1; }
NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${STELLAR_SOURCE:-deployer}"

# Deployment ids -> shell vars.
eval "$(node -e 'const d=require("./'"$DEPLOYED"'");for(const[k,v]of Object.entries({VERIFIER_ID:d.verifierId,TOKEN_ID:d.tokenId,TOKEN_ID_FELT:d.tokenIdFelt,SUPPLY:d.supply}))console.log(`${k}=${v}`)')"
EXPIRY=4102444800   # year 2100, comfortably past the ledger clock

echo "==> using verifier $VERIFIER_ID (supply=$SUPPLY, tokenId=$TOKEN_ID_FELT)"
mkdir -p "$WORK"

echo "==> ensuring TS workspaces are built"
( cd "$ROOT" && npm run --silent build --workspace packages/shared --workspace packages/zk --workspace apps/attestor )

WASM="$ZK/build/proof_of_backing_js/proof_of_backing.wasm"
ZKEY="$ZK/build/proof_of_backing_final.zkey"
VK="$ZK/build/verification_key.json"

# Reserves summing to exactly SUPPLY (1,000,000) -> fully backed.
cat > "$WORK/reserves.json" <<'JSON'
[
  { "balance": "250000", "salt": "11" },
  { "balance": "180000", "salt": "22" },
  { "balance": "150000", "salt": "33" },
  { "balance": "120000", "salt": "44" },
  { "balance": "100000", "salt": "55" },
  { "balance": "90000",  "salt": "66" },
  { "balance": "70000",  "salt": "77" },
  { "balance": "40000",  "salt": "88" }
]
JSON

attest() { # book -> attestation.json on stdout
  node "$ROOT/apps/attestor/dist/cli.js" sign --book "$1" --token "$TOKEN_ID_FELT" --expiry "$EXPIRY"
}
prove() { # input.json proof.json public.json
  "$SNARKJS" groth16 fullprove "$1" "$WASM" "$ZKEY" "$2" "$3"
}

# ----------------------------------------------------------------------------
echo
echo "################ HAPPY PATH ################"
echo "==> 1. attestor signs the reserve book"
attest "$WORK/reserves.json" > "$WORK/attestation.json"

echo "==> 2. build witness + prove (offline gate first)"
node lib/mkwitness.mjs "$WORK/attestation.json" "$SUPPLY" "$WORK/input.json"
prove "$WORK/input.json" "$WORK/proof.json" "$WORK/public.json"
"$SNARKJS" groth16 verify "$VK" "$WORK/public.json" "$WORK/proof.json"

echo "==> 3. submit proof to verifier"
node lib/encode-submit.mjs "$WORK/proof.json" "$WORK/public.json" "$WORK/proof.arg.json" "$WORK/signals.arg.json"
stellar contract invoke --id "$VERIFIER_ID" --source "$SOURCE" --network "$NETWORK" -- submit_proof \
  --proof "$(cat "$WORK/proof.arg.json")" --signals "$(cat "$WORK/signals.arg.json")"

echo "==> 4. assert on-chain status == backed"
STATUS=$(stellar contract invoke --id "$VERIFIER_ID" --source "$SOURCE" --network "$NETWORK" -- status 2>/dev/null)
echo "status: $STATUS"
echo "$STATUS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);if(o&&o.backed===true){console.error("OK: backed == true");process.exit(0)}console.error("FAIL: status not backed");process.exit(1)})'

# ----------------------------------------------------------------------------
echo
echo "################ TAMPER A — reserves below threshold (unprovable) ################"
# Drop the first balance far below threshold so sum < SUPPLY.
node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1]));b[0].balance="1";fs.writeFileSync(process.argv[2],JSON.stringify(b,null,2))' \
  "$WORK/reserves.json" "$WORK/reserves.tampered.json"
attest "$WORK/reserves.tampered.json" > "$WORK/attestation.tampered.json"
node lib/mkwitness.mjs "$WORK/attestation.tampered.json" "$SUPPLY" "$WORK/input.tampered.json"
echo "==> regenerate proof for under-backed reserves (must FAIL)"
if prove "$WORK/input.tampered.json" "$WORK/proof.tampered.json" "$WORK/public.tampered.json" >/dev/null 2>&1; then
  echo "FAIL: a proof was generated for under-backed reserves!"; exit 1
fi
echo "OK: under-backed reserves are unprovable — backing cannot be faked"

# ----------------------------------------------------------------------------
echo
echo "################ TAMPER B — flip a public signal (rejected on-chain) ################"
# Take the VALID proof but flip one byte of the commitment signal (index 2).
node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync(process.argv[1]));let h=s[2];const last=h.slice(-1);s[2]=h.slice(0,-1)+(last==="0"?"1":"0");fs.writeFileSync(process.argv[2],JSON.stringify(s))' \
  "$WORK/signals.arg.json" "$WORK/signals.tampered.arg.json"
echo "==> submit valid proof with a tampered signal (must be REJECTED)"
if stellar contract invoke --id "$VERIFIER_ID" --source "$SOURCE" --network "$NETWORK" -- submit_proof \
    --proof "$(cat "$WORK/proof.arg.json")" --signals "$(cat "$WORK/signals.tampered.arg.json")" >/dev/null 2>&1; then
  echo "FAIL: chain accepted a tampered proof!"; exit 1
fi
echo "OK: chain rejected the tampered proof"

echo
echo "################ DONE — happy verified on-chain, both tamper paths fail ################"
