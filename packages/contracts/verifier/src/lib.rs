#![no_std]
//! Proof-of-Backing verifier.
//!
//! Verifies a Groth16/BN254 proof that off-chain reserves ≥ the token's live
//! supply, then records a public "backed as of ledger T" status. The Groth16
//! algorithm is generic/adapted; the value is in the application checks and
//! their ordering.
//!
//! Check ordering is INVARIANT 5: cheap application checks fail fast, the
//! pairing check runs last and is NEVER skipped or short-circuited.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, vec, Address, BytesN, Env,
    Symbol, Vec,
};
use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr};

/// Number of public signals (PUBLIC_SIGNAL_ORDER in @zk-pob/shared):
/// [attestorAx, attestorAy, commitment, claimedSupply, tokenId, expiry].
const N_PUBLIC: u32 = 6;
const SIG_AX: u32 = 0;
const SIG_AY: u32 = 1;
const SIG_COMMITMENT: u32 = 2;
const SIG_CLAIMED_SUPPLY: u32 = 3;
const SIG_TOKEN_ID: u32 = 4;
const SIG_EXPIRY: u32 = 5;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin allowed to configure the contract.
    Admin,
    /// The token contract whose total_supply is the liability (INVARIANT 2).
    Token,
    /// The tokenId field element bound into the signed message (INVARIANT 4).
    TokenIdFelt,
    /// Groth16 verification key for the circuit (set once at init).
    Vk,
    /// Allowlist of attestor public keys, keyed by ax||ay (INVARIANT 3).
    Attestor(BytesN<64>),
    /// Latest backing status.
    Status,
}

/// Groth16 verification key, BN254 points as host-format bytes.
/// G1 = be(X)||be(Y) (64B). G2 = be(X)||be(Y), each Fp2 = be(c1)||be(c0) (128B).
#[contracttype]
#[derive(Clone)]
pub struct VerificationKey {
    pub alpha1: BytesN<64>,
    pub beta2: BytesN<128>,
    pub gamma2: BytesN<128>,
    pub delta2: BytesN<128>,
    /// IC has N_PUBLIC + 1 points; IC[0] is the constant term.
    pub ic: Vec<BytesN<64>>,
}

/// Groth16 proof points in BN254 host-format bytes.
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
}

#[contracttype]
#[derive(Clone)]
pub struct BackingStatus {
    pub backed: bool,
    pub commitment: BytesN<32>,
    pub supply: i128,
    pub verified_at: u64,
}

/// Emitted on a successful verification.
#[contractevent]
#[derive(Clone)]
pub struct Backed {
    pub commitment: BytesN<32>,
    pub supply: i128,
    pub verified_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AttestorNotAllowed = 2,
    SupplyMismatch = 3,
    WrongToken = 4,
    Expired = 5,
    PairingFailed = 6,
    AlreadyInitialized = 7,
    BadSignals = 8,
    BadVk = 9,
}

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// One-time setup: admin, bound token (Address + tokenId felt), and the
    /// circuit verification key.
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        token_id_felt: BytesN<32>,
        vk: VerificationKey,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        if vk.ic.len() != N_PUBLIC + 1 {
            return Err(Error::BadVk);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TokenIdFelt, &token_id_felt);
        env.storage().instance().set(&DataKey::Vk, &vk);
        Ok(())
    }

    /// Admin adds an attestor public key (ax||ay) to the allowlist (INVARIANT 3).
    pub fn allow_attestor(env: Env, key: BytesN<64>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Attestor(key), &true);
    }

    /// Verify a proof and record backing status. Checks ordered cheap-first;
    /// pairing last (INVARIANT 5).
    ///
    /// `signals` are the 6 raw public field elements in PUBLIC_SIGNAL_ORDER.
    /// They are folded into the pairing (binding the proof to its inputs), and
    /// individual signals are re-checked against on-chain truth.
    pub fn submit_proof(env: Env, proof: Proof, signals: Vec<BytesN<32>>) -> Result<bool, Error> {
        if signals.len() != N_PUBLIC {
            return Err(Error::BadSignals);
        }

        // 1. Attestor (ax, ay) must be on the allowlist.
        let key = concat_pubkey(
            &env,
            &signals.get(SIG_AX).unwrap(),
            &signals.get(SIG_AY).unwrap(),
        );
        if !env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Attestor(key))
            .unwrap_or(false)
        {
            return Err(Error::AttestorNotAllowed);
        }

        // 2. claimedSupply must equal the LIVE on-chain supply (INVARIANT 2).
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        let live: i128 =
            env.invoke_contract(&token, &Symbol::new(&env, "total_supply"), Vec::new(&env));
        if signals.get(SIG_CLAIMED_SUPPLY).unwrap() != i128_to_felt(&env, live) {
            return Err(Error::SupplyMismatch);
        }

        // 3. tokenId in the signed message must match the bound token (INVARIANT 4).
        let token_id_felt: BytesN<32> =
            env.storage().instance().get(&DataKey::TokenIdFelt).unwrap();
        if signals.get(SIG_TOKEN_ID).unwrap() != token_id_felt {
            return Err(Error::WrongToken);
        }

        // 4. Attestation must not be stale (INVARIANT 4).
        if felt_to_u64(&signals.get(SIG_EXPIRY).unwrap()) <= env.ledger().timestamp() {
            return Err(Error::Expired);
        }

        // 5. Pairing check — never skipped (INVARIANT 5).
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;
        if !groth16_verify(&env, &vk, &proof, &signals) {
            return Err(Error::PairingFailed);
        }

        // 6. Persist status + emit event.
        let status = BackingStatus {
            backed: true,
            commitment: signals.get(SIG_COMMITMENT).unwrap(),
            supply: live,
            verified_at: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::Status, &status);
        Backed {
            commitment: status.commitment.clone(),
            supply: status.supply,
            verified_at: status.verified_at,
        }
        .publish(&env);
        Ok(true)
    }

    /// Public read of the latest backing status (frontend reads this directly).
    pub fn status(env: Env) -> Option<BackingStatus> {
        env.storage().instance().get(&DataKey::Status)
    }
}

/// Groth16 verification via the BN254 host functions:
/// e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1,
/// where vk_x = IC[0] + Σ IC[i+1]·signals[i] (public inputs folded into a point,
/// which is what binds the proof to its inputs — ARCHITECTURE §5).
fn groth16_verify(
    env: &Env,
    vk: &VerificationKey,
    proof: &Proof,
    signals: &Vec<BytesN<32>>,
) -> bool {
    let bn = env.crypto().bn254();

    // vk_x = IC[0] + Σ IC[i+1] * signals[i]
    let mut vk_x = Bn254G1Affine::from_bytes(vk.ic.get(0).unwrap());
    for i in 0..signals.len() {
        let ic = Bn254G1Affine::from_bytes(vk.ic.get(i + 1).unwrap());
        let scalar = Fr::from_bytes(signals.get(i).unwrap());
        let term = bn.g1_mul(&ic, &scalar);
        vk_x = bn.g1_add(&vk_x, &term);
    }

    let neg_a = -Bn254G1Affine::from_bytes(proof.a.clone());
    let alpha = Bn254G1Affine::from_bytes(vk.alpha1.clone());
    let c = Bn254G1Affine::from_bytes(proof.c.clone());

    let b = Bn254G2Affine::from_bytes(proof.b.clone());
    let beta = Bn254G2Affine::from_bytes(vk.beta2.clone());
    let gamma = Bn254G2Affine::from_bytes(vk.gamma2.clone());
    let delta = Bn254G2Affine::from_bytes(vk.delta2.clone());

    let g1 = vec![env, neg_a, alpha, vk_x, c];
    let g2 = vec![env, b, beta, gamma, delta];
    bn.pairing_check(g1, g2)
}

/// Allowlist key = ax || ay (64 bytes).
fn concat_pubkey(env: &Env, ax: &BytesN<32>, ay: &BytesN<32>) -> BytesN<64> {
    let mut out = [0u8; 64];
    out[0..32].copy_from_slice(&ax.to_array());
    out[32..64].copy_from_slice(&ay.to_array());
    BytesN::from_array(env, &out)
}

/// Encode a non-negative i128 as a 32-byte big-endian field element, to compare
/// the live supply against the proof's claimedSupply signal.
fn i128_to_felt(env: &Env, x: i128) -> BytesN<32> {
    let mut out = [0u8; 32];
    out[16..32].copy_from_slice(&x.to_be_bytes());
    BytesN::from_array(env, &out)
}

/// Extract a u64 from a field element (expiry). A value exceeding u64 saturates
/// to u64::MAX (treated as far-future, so the freshness check still passes).
fn felt_to_u64(b: &BytesN<32>) -> u64 {
    let a = b.to_array();
    let mut high = 0u8;
    for byte in a.iter().take(24) {
        high |= *byte;
    }
    if high != 0 {
        return u64::MAX;
    }
    let mut v = 0u64;
    for byte in a.iter().skip(24) {
        v = (v << 8) | (*byte as u64);
    }
    v
}

#[cfg(test)]
mod testdata;
#[cfg(test)]
mod test;
