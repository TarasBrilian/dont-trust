pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

/*
 * Proof of Backing — sum(attested reserves) >= claimedSupply, in zero knowledge.
 *
 * This file is the SOURCE OF TRUTH for the constraint system. The public-signal
 * order in `main` below is a contract with snarkjs `public.json`, the on-chain
 * verifier, and @zk-pob/shared's PUBLIC_SIGNAL_ORDER. Keep all four in lockstep.
 *
 * See ARCHITECTURE.md §3 for the rationale behind each constraint.
 */
template ProofOfBacking(N) {
    // ---- private inputs ----
    signal input balances[N];   // per-account reserve balances
    signal input salts[N];      // per-account blinding for the commitment
    signal input R8x;           // EdDSA signature component
    signal input R8y;           // EdDSA signature component
    signal input S;             // EdDSA signature scalar

    // ---- public inputs ---- (order mirrors PUBLIC_SIGNAL_ORDER in shared)
    signal input attestorAx;    // attestor BabyJubjub public key X
    signal input attestorAy;    // attestor BabyJubjub public key Y
    signal input commitment;    // Poseidon commitment to (balances, salts)
    signal input claimedSupply; // liability the proof is bound to
    signal input tokenId;       // token contract this attestation is bound to
    signal input expiry;        // attestation freshness deadline

    // === Constraint 1: commitment binding ===
    // commitment == Poseidon(balances || salts). For N=8 this is 16 inputs,
    // the circomlib Poseidon ceiling. Larger N needs the sum-tree (ARCH §8).
    component hash = Poseidon(2 * N);
    for (var i = 0; i < N; i++) {
        hash.inputs[i] <== balances[i];
    }
    for (var i = 0; i < N; i++) {
        hash.inputs[N + i] <== salts[i];
    }
    commitment === hash.out;

    // === Constraint 2: attestation ===
    // msg = Poseidon(commitment, tokenId, expiry); verify the attestor signed it.
    // Signature verification is curve equations INSIDE the circuit, not trusted.
    component msgHash = Poseidon(3);
    msgHash.inputs[0] <== commitment;
    msgHash.inputs[1] <== tokenId;
    msgHash.inputs[2] <== expiry;

    component sig = EdDSAPoseidonVerifier();
    sig.enabled <== 1;
    sig.Ax  <== attestorAx;
    sig.Ay  <== attestorAy;
    sig.R8x <== R8x;
    sig.R8y <== R8y;
    sig.S   <== S;
    sig.M   <== msgHash.out;

    // === Constraint 3: range checks (MANDATORY) ===
    // Bound each balance to [0, 2^64). Without this, a "balance" near the prime
    // wraps and can pass the solvency check falsely. The classic ZK soundness bug.
    component balanceBits[N];
    for (var i = 0; i < N; i++) {
        balanceBits[i] = Num2Bits(64);
        balanceBits[i].in <== balances[i];
    }
    // Also bound claimedSupply so the comparator below cannot be tricked by wrap.
    component supplyBits = Num2Bits(64);
    supplyBits.in <== claimedSupply;

    // === Constraint 4: aggregation ===
    // R = sum(balances). With N<=8 and each balance < 2^64, R < 2^67 — no wrap.
    signal partial[N + 1];
    partial[0] <== 0;
    for (var i = 0; i < N; i++) {
        partial[i + 1] <== partial[i] + balances[i];
    }
    signal R;
    R <== partial[N];

    // === Constraint 5: solvency ===
    // R >= claimedSupply. Width 68 covers R (<2^67) and claimedSupply (<2^64).
    component solvent = GreaterEqThan(68);
    solvent.in[0] <== R;
    solvent.in[1] <== claimedSupply;
    solvent.out === 1;
}

// N = 8 reserve accounts for the demo. Public signal order is fixed here.
component main {
    public [attestorAx, attestorAy, commitment, claimedSupply, tokenId, expiry]
} = ProofOfBacking(8);
