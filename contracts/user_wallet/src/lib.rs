// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{
    prelude::*,
    call::RawCall,
    alloy_primitives::{Address, U256, FixedBytes, Bytes},
    alloy_sol_types::{sol, SolCall},
};

// -----------------------------
// ERC-4337: UserOperation type
// -----------------------------
sol! {
    // Interface to the ConfidentialERC20 contract
    function deposit(
        address token,
        uint256 amount,
        bytes32 new_balance_x1,
        bytes32 new_balance_x2,
        address to,
        bytes   proof_inputs,
        bytes   proof
    );

    function transfer_confidential(
        address token,
        address to,
        bytes32 new_from_x1,
        bytes32 new_from_x2,
        bytes32 new_to_x1,
        bytes32 new_to_x2,
        bytes   proof_inputs,
        bytes   proof
    );

    function withdraw(
        address token,
        address to,
        bytes32 new_from_x1,
        bytes32 new_from_x2,
        bytes   proof_inputs,
        bytes   proof
    );
}

// -----------------------------
// Storage layout
// -----------------------------
sol_storage! {
    #[entrypoint]
    pub struct UserWallet {
        // EOA / key that controls this wallet
        address owner;

        // Linked ConfidentialERC20 contract
        address confidential_erc20;

        // Optional audit/view key (e.g. BabyJub viewing key)
        bytes32 audit_pubkey;

        // Nonce for replay protection
        uint256 nonce;
    }
}

// -----------------------------
// Public interface
// -----------------------------
#[public]
impl UserWallet {

    /// One-time initialization.
    /// `owner`       – EOA that controls this AA wallet.
    /// `entry_point` – ERC-4337 EntryPoint contract address.
    /// `conf_erc20`  – ConfidentialERC20 contract address.
    pub fn init(
        &mut self,
        owner: Address,
        conf_erc20: Address,
    ) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err("Already initialized".into());
        }

        self.owner.set(owner);
        self.confidential_erc20.set(conf_erc20);
        self.nonce.set(U256::ZERO);

        Ok(())
    }

    // -------------------------
    // ConfidentialERC20 forwarders (allowlisted)
    // -------------------------

    /// Private deposit into ConfidentialERC20.
    ///
    /// This forwards to:
    ///   ConfidentialERC20.deposit(token, amount, (new_balance_x1, new_balance_x2), to, proof_inputs, proof)
    ///
    /// NOTE:
    ///  - `to` is the "confidential balance owner" in ConfidentialERC20.
    ///  - Typically you'd pass `self.vm().contract_address()` so the wallet
    ///    contract is the account that holds the confidential balance.
    ///  - Deposit now requires ZK proof to ensure balance correctness.
    pub fn deposit_private(
        &mut self,
        token: Address,
        amount: U256,
        new_balance_x1: FixedBytes<32>,
        new_balance_x2: FixedBytes<32>,
        to: Address,
        proof_inputs: FixedBytes<32>,
        proof: FixedBytes<32>,
    ) -> Result<(), Vec<u8>> {
        self._only_owner()?;

        let calldata = depositCall {
            token,
            amount,
            new_balance_x1,
            new_balance_x2,
            to,
            proof_inputs: proof_inputs.into(),
            proof: proof.into(),
        }
        .abi_encode();

        let conf = self.confidential_erc20.get();
        unsafe {
            let _ = RawCall::new().call(conf, &calldata)?;
        }

        Ok(())
    }

    /// Private transfer between confidential balances.
    ///
    /// Forwards to:
    ///   ConfidentialERC20.transfer_confidential(
    ///     token,
    ///     to,
    ///     new_from_x1, new_from_x2,
    ///     new_to_x1,   new_to_x2,
    ///     proof_inputs,
    ///     proof
    ///   )
    ///
    /// Here:
    ///  - `from` inside ConfidentialERC20 will be `msg.sender` = this wallet.
    ///  - `to` is the recipient confidential account (likely another wallet).
    pub fn transfer_private(
        &mut self,
        token: Address,
        to: Address,
        new_from_x1: FixedBytes<32>,
        new_from_x2: FixedBytes<32>,
        new_to_x1: FixedBytes<32>,
        new_to_x2: FixedBytes<32>,
        proof_inputs: FixedBytes<32>,
        proof: FixedBytes<32>,
    ) -> Result<(), Vec<u8>> {
        self._only_owner()?;
    
        let calldata = transfer_confidentialCall {
            token,
            to,
            new_from_x1,
            new_from_x2,
            new_to_x1,
            new_to_x2,
            proof_inputs: proof_inputs.into(),
            proof: proof.into(),
        }
        .abi_encode();
    
        let conf = self.confidential_erc20.get();
        unsafe {
            let _ = RawCall::new().call(conf, &calldata)?;
        }
    
        Ok(())
    }    

    /// Private withdrawal from ConfidentialERC20 back to a plain ERC-20 balance.
    ///
    /// Forwards to:
    ///   ConfidentialERC20.withdraw(
    ///     token,
    ///     to,
    ///     new_from_x1, new_from_x2,
    ///     proof_inputs,
    ///     proof
    ///   )
    ///
    /// `to` will receive **plain ERC-20** tokens.
    pub fn withdraw_private(
        &mut self,
        token: Address,
        to: Address,
        new_from_x1: FixedBytes<32>,
        new_from_x2: FixedBytes<32>,
        proof_inputs: FixedBytes<32>,
        proof: FixedBytes<32>,
    ) -> Result<(), Vec<u8>> {
        self._only_owner()?;

        let calldata = withdrawCall {
            token,
            to,
            new_from_x1,
            new_from_x2,
            proof_inputs: proof_inputs.into(),
            proof: proof.into(),
        }
        .abi_encode();

        let conf = self.confidential_erc20.get();
        unsafe {
            let _ = RawCall::new().call(conf, &calldata)?;
        }

        Ok(())
    }

    // -------------------------
    // Admin / metadata
    // -------------------------

    pub fn set_owner(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        self._only_owner()?;
        self.owner.set(new_owner);
        Ok(())
    }

    pub fn set_confidential_erc20(&mut self, new_conf: Address) -> Result<(), Vec<u8>> {
        self._only_owner()?;
        self.confidential_erc20.set(new_conf);
        Ok(())
    }

    pub fn set_audit_pubkey(&mut self, pk: FixedBytes<32>) -> Result<(), Vec<u8>> {
        self._only_owner()?;
        self.audit_pubkey.set(pk);
        Ok(())
    }

    pub fn get_audit_pubkey(&self) -> FixedBytes<32> {
        self.audit_pubkey.get()
    }

    pub fn get_owner(&self) -> Address {
        self.owner.get()
    }

    pub fn get_confidential_erc20(&self) -> Address {
        self.confidential_erc20.get()
    }

    pub fn get_nonce(&self) -> U256 {
        self.nonce.get()
    }
}

// -----------------------------
// Helper checks
// -----------------------------
impl UserWallet {
    fn _only_owner(&self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err("Not owner".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;