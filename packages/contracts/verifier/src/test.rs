#![cfg(test)]
//! On-chain verification tests. These run the REAL BN254 host functions (they
//! execute in the test host), against a real Groth16 proof generated from the
//! proof_of_backing circuit (see src/testdata.rs).
//!
//! Demonstrates both required paths (CLAUDE.md "Done means"):
//!   - happy: valid proof over sufficient reserves -> backed == true
//!   - tamper: a flipped public signal -> pairing_check fails on-chain
//! Plus the application-layer guards (live supply, token binding).

use super::*;
use crate::testdata::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};
use zk_pob_token::{Token as TokenContract, TokenClient};

const SUPPLY: i128 = 1_000_000; // == claimedSupply baked into the proof

fn build_vk(env: &Env) -> VerificationKey {
    let mut ic = Vec::new(env);
    for p in VK_IC.iter() {
        ic.push_back(BytesN::from_array(env, p));
    }
    VerificationKey {
        alpha1: BytesN::from_array(env, &VK_ALPHA1),
        beta2: BytesN::from_array(env, &VK_BETA2),
        gamma2: BytesN::from_array(env, &VK_GAMMA2),
        delta2: BytesN::from_array(env, &VK_DELTA2),
        ic,
    }
}

fn build_proof(env: &Env) -> Proof {
    Proof {
        a: BytesN::from_array(env, &PROOF_A),
        b: BytesN::from_array(env, &PROOF_B),
        c: BytesN::from_array(env, &PROOF_C),
    }
}

fn build_signals(env: &Env) -> Vec<BytesN<32>> {
    let mut s = Vec::new(env);
    for sig in PUBLIC.iter() {
        s.push_back(BytesN::from_array(env, sig));
    }
    s
}

fn attestor_key(env: &Env) -> BytesN<64> {
    let mut k = [0u8; 64];
    k[0..32].copy_from_slice(&PUBLIC[0]);
    k[32..64].copy_from_slice(&PUBLIC[1]);
    BytesN::from_array(env, &k)
}

fn token_id_felt(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &PUBLIC[4])
}

/// Deploy token + verifier, wire them, allowlist the attestor. Returns the
/// verifier client's contract id and the token client (for supply tweaks).
fn setup(env: &Env, supply: i128) -> (Address, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);

    let token_id = env.register(TokenContract, ());
    let token = TokenClient::new(env, &token_id);
    token.init(&admin);
    token.set_supply(&supply);

    let verifier_id = env.register(Verifier, ());
    let v = VerifierClient::new(env, &verifier_id);
    v.init(&admin, &token_id, &token_id_felt(env), &build_vk(env));
    v.allow_attestor(&attestor_key(env));

    (verifier_id, token_id)
}

#[test]
fn happy_path_marks_backed() {
    let env = Env::default();
    let (verifier_id, _token_id) = setup(&env, SUPPLY);
    let v = VerifierClient::new(&env, &verifier_id);

    let ok = v.submit_proof(&build_proof(&env), &build_signals(&env));
    assert!(ok, "valid proof over sufficient reserves must verify");

    let status = v.status().expect("status set");
    assert!(status.backed);
    assert_eq!(status.supply, SUPPLY);
}

#[test]
fn tamper_public_signal_fails_pairing() {
    let env = Env::default();
    let (verifier_id, _token_id) = setup(&env, SUPPLY);
    let v = VerifierClient::new(&env, &verifier_id);

    // Flip one byte of the commitment signal (folded into the pairing, not an
    // application check) so it reaches and fails the pairing_check.
    let mut signals = build_signals(&env);
    let mut bad = PUBLIC[2];
    bad[31] ^= 0x01;
    signals.set(SIG_COMMITMENT, BytesN::from_array(&env, &bad));

    assert_eq!(
        v.try_submit_proof(&build_proof(&env), &signals),
        Err(Ok(Error::PairingFailed)),
    );
    assert!(v.status().is_none(), "tampered proof must not record status");
}

#[test]
fn supply_mismatch_rejected_before_pairing() {
    let env = Env::default();
    // Token supply differs from the proof's claimedSupply (1_000_000).
    let (verifier_id, _token_id) = setup(&env, SUPPLY - 1);
    let v = VerifierClient::new(&env, &verifier_id);

    assert_eq!(
        v.try_submit_proof(&build_proof(&env), &build_signals(&env)),
        Err(Ok(Error::SupplyMismatch)),
    );
}

#[test]
fn unknown_attestor_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let token_id = env.register(TokenContract, ());
    let token = TokenClient::new(&env, &token_id);
    token.init(&admin);
    token.set_supply(&SUPPLY);

    let verifier_id = env.register(Verifier, ());
    let v = VerifierClient::new(&env, &verifier_id);
    v.init(&admin, &token_id, &token_id_felt(&env), &build_vk(&env));
    // NOTE: no allow_attestor call.

    assert_eq!(
        v.try_submit_proof(&build_proof(&env), &build_signals(&env)),
        Err(Ok(Error::AttestorNotAllowed)),
    );
}
