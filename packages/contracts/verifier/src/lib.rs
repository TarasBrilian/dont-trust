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

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin allowed to configure the contract.
    Admin,
    /// The token contract whose total_supply is the liability (INVARIANT 2/3).
    Token,
    /// Allowlist of attestor public keys, keyed by (Ax, Ay) bytes (INVARIANT 3).
    Attestor(BytesN<64>),
    /// Verification key for the circuit (set once at init).
    Vk,
    /// Latest backing status.
    Status,
}

#[contracttype]
#[derive(Clone)]
pub struct BackingStatus {
    pub backed: bool,
    pub commitment: BytesN<32>,
    pub claimed_supply: i128,
    pub verified_at: u64,
}

/// Public signals, in PUBLIC_SIGNAL_ORDER (must match circuit + @zk-pob/shared).
#[contracttype]
#[derive(Clone)]
pub struct PublicSignals {
    pub attestor_ax: BytesN<32>,
    pub attestor_ay: BytesN<32>,
    pub commitment: BytesN<32>,
    pub claimed_supply: i128,
    pub token_id: Address,
    pub expiry: u64,
}

/// Groth16 proof points, BN254 big-endian concat(X, Y) (CLAUDE.md "Gotchas").
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
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
}

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// One-time setup: admin, bound token, and the circuit verification key.
    pub fn init(env: Env, admin: Address, token: Address, vk: BytesN<32>) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Vk, &vk);
        Ok(())
    }

    /// Admin adds an attestor public key to the on-chain allowlist (INVARIANT 3).
    pub fn allow_attestor(env: Env, key: BytesN<64>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Attestor(key), &true);
    }

    /// Verify a proof and record backing status. Checks ordered cheap-first;
    /// pairing last (INVARIANT 5).
    pub fn submit_proof(
        env: Env,
        proof: Proof,
        signals: PublicSignals,
    ) -> Result<bool, Error> {
        // 1. Attestor must be on the allowlist.
        let key = concat_pubkey(&env, &signals.attestor_ax, &signals.attestor_ay);
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
        let live_supply = read_total_supply(&env, &token);
        if signals.claimed_supply != live_supply {
            return Err(Error::SupplyMismatch);
        }

        // 3. tokenId in the signed message must match the bound token (INVARIANT 4).
        if signals.token_id != token {
            return Err(Error::WrongToken);
        }

        // 4. Attestation must not be stale.
        if signals.expiry <= env.ledger().timestamp() {
            return Err(Error::Expired);
        }

        // 5. Pairing check — never skipped (INVARIANT 5).
        if !pairing_verify(&env, &proof, &signals) {
            return Err(Error::PairingFailed);
        }

        // 6. Persist status + emit event.
        let status = BackingStatus {
            backed: true,
            commitment: signals.commitment.clone(),
            claimed_supply: signals.claimed_supply,
            verified_at: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::Status, &status);
        env.events().publish((symbol("backed"),), status.clone());
        Ok(true)
    }

    /// Public read of the latest backing status (frontend reads this directly).
    pub fn status(env: Env) -> Option<BackingStatus> {
        env.storage().instance().get(&DataKey::Status)
    }
}

fn symbol(s: &str) -> soroban_sdk::Symbol {
    soroban_sdk::Symbol::new(&Env::default(), s)
}

/// Concatenate (Ax, Ay) into the allowlist key.
fn concat_pubkey(env: &Env, _ax: &BytesN<32>, _ay: &BytesN<32>) -> BytesN<64> {
    // TODO: build BytesN<64> from ax || ay.
    BytesN::from_array(env, &[0u8; 64])
}

/// Cross-contract read of the token's circulating supply (INVARIANT 2).
fn read_total_supply(_env: &Env, _token: &Address) -> i128 {
    // TODO: env.invoke_contract(token, "total_supply", args) -> i128.
    0
}

/// Build L from public signals (bn254_g1_add / bn254_g1_mul) and run
/// pairing_check: e(A,B) = e(α,β)·e(L,γ)·e(C,δ).
fn pairing_verify(_env: &Env, _proof: &Proof, _signals: &PublicSignals) -> bool {
    // TODO: Protocol 25 BN254 host fns. The verification key comes from DataKey::Vk.
    // Public signals fold into L, binding the proof to its inputs (ARCHITECTURE §5).
    let _signals_order: Vec<u32> = Vec::new(&Env::default());
    false
}

#[cfg(test)]
mod test;
