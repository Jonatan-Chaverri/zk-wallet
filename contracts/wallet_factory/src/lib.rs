//! zkWalletFactory - Stylus contract (Arbitrum Stylus example style)
//!
//! Deploys wallet contracts deterministically using CREATE2 via RawDeploy.
//! After deployment, calls `init(owner, confErc20)` on the wallet.

#![cfg_attr(not(feature = "export-abi"), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, B256, U256, keccak256},
    deploy::RawDeploy,
    evm,
    call::RawCall,
    prelude::*,
    alloy_sol_types::{sol, SolCall},
};

pub const WALLET_BYTECODE: &[u8; 46325] = include_bytes!("./user_wallet.wasm");

// -------------------------------------------------------------
// Storage
// -------------------------------------------------------------
sol_storage! {
    #[entrypoint]
    pub struct WalletFactory {
        /// ConfidentialERC20 used by all wallets
        address conf_erc20;
    }
}

// -------------------------------------------------------------
// ABI declarations (events + external wallet interface)
// -------------------------------------------------------------
sol! {
    /// Emitted when a new wallet is deployed
    event WalletDeployed(address indexed wallet, address indexed owner, bytes32 salt);

}

// -------------------------------------------------------------
// Main implementation
// -------------------------------------------------------------
#[public]
impl WalletFactory {

    /// Deploys a new wallet via CREATE2 and calls its `init(owner, confErc20)`
    pub fn deploy_wallet(&self) -> Result<Address, Vec<u8>> {
        //let code = WALLET_BYTECODE;
        let code = WALLET_BYTECODE;
        if code.is_empty() {
            return Err("Empty code".into());
        }
    
        let endowment = U256::ZERO;
        let salt = B256::with_last_byte(1);
        let deployer = RawDeploy::new().salt(salt);
    
        // SAFETY: RawDeploy allows deploying WASM contracts via Stylus host
        let deployed = unsafe { deployer.deploy(code, endowment).unwrap() };
        Ok(deployed)
    }

    /// Compute deterministic wallet address using standard CREATE2 formula
    pub fn predict_wallet_address(&self, salt: B256, code: Vec<u8>) -> Address {
        let address = self.vm().contract_address();
        get_create2_address(address, salt, &code)
    }
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------


fn get_create2_address(from: Address, salt: B256, init_code: &[u8]) -> Address {
    let init_code_hash = keccak256(init_code);

    let mut bytes = Vec::with_capacity(1 + 20 + salt.len() + init_code_hash.len());
    bytes.push(0xff);
    bytes.extend_from_slice(from.as_slice());
    bytes.extend_from_slice(salt.as_slice());
    bytes.extend_from_slice(init_code_hash.as_slice());

    let hash = keccak256(&bytes);

    let mut addr_bytes = [0u8; 20];
    addr_bytes.copy_from_slice(&hash[12..]);
    Address::from_slice(&addr_bytes)
}
