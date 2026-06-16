#![no_std]
//! Minimal sample RWA token. The verifier's only requirement is a readable
//! `total_supply` (INVARIANT 2 reads it live). Not a full SEP-41 token — just
//! enough surface to drive the demo.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalSupply,
}

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
    }

    /// Demo mint/burn: adjust circulating supply. Real RWA would gate this.
    pub fn set_supply(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::TotalSupply, &amount);
    }

    /// The liability number the verifier reads live (INVARIANT 2).
    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn supply_roundtrips() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Token, ());
        let client = TokenClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.init(&admin);
        client.set_supply(&1_000_000);
        assert_eq!(client.total_supply(), 1_000_000);
    }
}
