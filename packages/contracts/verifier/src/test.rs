#![cfg(test)]
//! Both paths must be demonstrated (CLAUDE.md "Done means"):
//!   - happy path: valid proof over sufficient reserves -> backed == true
//!   - tamper case: one balance below threshold -> submit_proof fails on-chain
//!
//! These are skeletons. Fill them once pairing_verify and read_total_supply land.

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn init_sets_token_and_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let vk = BytesN::from_array(&env, &[0u8; 32]);

    client.init(&admin, &token, &vk);
    // TODO: assert stored token/admin once getters exist.
}

#[test]
#[ignore = "todo: wire pairing_verify + read_total_supply"]
fn happy_path_marks_backed() {
    // TODO: allowlist attestor, mint supply, submit valid proof, assert backed.
}

#[test]
#[ignore = "todo: wire pairing_verify + read_total_supply"]
fn tamper_case_fails_onchain() {
    // TODO: submit a proof where reserves < supply, expect Error::PairingFailed.
}
