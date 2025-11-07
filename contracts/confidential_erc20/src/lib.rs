//!
//! ConfidentialERC20 - Stylus Contract (Noir ZK Proof Model, NO on-chain crypto math)
//!
//! Confidential ERC-20 custody contract using user-side ElGamal encryption
//! (BabyJub) and Noir-generated ZK proofs for confidential transfers.
//!
//! Design:
//! - All cryptographic math (ElGamal, BabyJub, homomorphic add/sub, comparisons)
//!   happens OFF-CHAIN inside Noir circuits.
//! - This contract ONLY:
//!   - stores ciphertexts (as raw bytes),
//!   - verifies Noir proofs with domain separation,
//!   - updates balances using NEW ciphertexts provided by the user,
//!   - manages ERC-20 custody (deposit/withdraw).
//!
//! Noir verifier interface (assumed):
//!     function verify(bytes proof, bytes publicInputs) external view returns (bool);
//!

// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::evm;
use stylus_sdk::{
    prelude::*,
    call::RawCall,
    alloy_primitives::{Address, FixedBytes, U256, keccak256, Bytes},
    alloy_sol_types::{sol, SolCall}, // 👈 bring SolCall trait into scope for .abi_encode()
};

// Ciphertext representation (ElGamal over BabyJub, treated as opaque bytes)
#[derive(PartialEq, Eq)]
pub struct Ciphertext {
    pub x1: [u8; 32],
    pub x2: [u8; 32],
}


impl Ciphertext {
    pub fn zero() -> Self {
        Self { x1: [0u8; 32], x2: [0u8; 32] }
    }
}

// Main storage
sol_storage! {
    #[entrypoint]
    pub struct ConfidentialERC20 {
        // Allowlist of supported underlying ERC-20 tokens
        mapping(address => bool) supported_tokens;

        // Store per user public key
        mapping(address => bytes32) user_pk;

        // Noir verifier contract (must implement verify(bytes,bytes) -> bool)
        address verifier;

        // Encrypted balances: mapping(token => mapping(user => ciphertext))
        mapping(bytes32 => mapping(bytes32 => bytes32)) balances_x1;
        mapping(bytes32 => mapping(bytes32 => bytes32)) balances_x2;

        // Nullifiers for replay protection: hash(proof) -> used?
        mapping(bytes32 => bool) nullifiers;

        // Reentrancy guard
        ReentrancyGuard guard;

        // Admin / owner
        address owner;

        // Chain id (for domain separation in Noir proof)
        uint256 chain_id;
    }

    pub struct ReentrancyGuard {
        bool locked;
    }
}

// Helpers

#[inline(never)]
fn address_to_bytes32(addr: Address) -> FixedBytes<32> {
    let mut out = [0u8; 32];
    let bytes = addr.into_array();
    out[12..32].copy_from_slice(&bytes);
    FixedBytes::from(out)
}

fn balance_key(token: Address, user: Address) -> (FixedBytes<32>, FixedBytes<32>) {
    (address_to_bytes32(token), address_to_bytes32(user))
}

fn encode_ciphertext(ct: &Ciphertext) -> [u8; 64] {
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&ct.x1);
    out[32..].copy_from_slice(&ct.x2);
    out
}

// Events
sol! {
    /// Encrypted transfer occurred (logs new encrypted balances)
    event TransferConfidential(
        address indexed token,
        address indexed from,
        address indexed to,
        bytes c_from_new, // new encrypted balance of `from`
        bytes c_to_new    // new encrypted balance of `to`
    );

    /// Plain deposit with encrypted balance update
    event Deposit(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 plain_amount,
        bytes c_balance_new  // new encrypted balance of `to`
    );

    /// Plain withdrawal with encrypted balance update
    event Withdraw(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 plain_amount,
    );

    event VerifierUpdated(address verifier);
    event TokenAllowlistUpdated(address indexed token, bool allowed);
    event UserPkRegistered(address indexed user, bytes pk);

    // Standard ERC-20
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // Noir verifier
    function verify(bytes proof, bytes publicInputs) external view returns (bool);
}

#[public]
impl ConfidentialERC20 {
    /// One-time initialization
    pub fn init(&mut self, verifier: Address, chain_id: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err("Already initialized".into());
        }

        self.verifier.set(verifier);
        self.owner.set(self.vm().msg_sender());
        self.chain_id.set(chain_id);
        Ok(())
    }

    pub fn register_user_pk(&mut self, pk: Vec<u8>) -> Result<(), Vec<u8>> {
        if pk.len() != 32 {
            return Err("Invalid pk length".into());
        }

        let sender = self.vm().msg_sender();
        self.user_pk.setter(sender).set(FixedBytes::<32>::try_from(pk.as_slice()).unwrap());

        evm::log(UserPkRegistered {
            user: sender,
            pk: pk.into(),
        });

        Ok(())
    }

    /// Get encrypted balance for (token, user).
    /// NOTE: This is just the stored ciphertext; decryption happens off-chain.
    pub fn balance_of_enc(&self, token: Address, user: Address) -> ([u8; 32], [u8; 32]) {
        let (t, u) = balance_key(token, user);
        let bx1 = self.balances_x1.get(t).get(u);
        let bx2 = self.balances_x2.get(t).get(u);

        let mut x1 = [0u8; 32];
        let mut x2 = [0u8; 32];

        let s1 = bx1.as_slice();
        let s2 = bx2.as_slice();
        if s1.len() == 32 {
            x1.copy_from_slice(s1);
        }
        if s2.len() == 32 {
            x2.copy_from_slice(s2);
        }
        (x1, x2)
    }

    /// Deposit plain ERC-20 tokens, and set a NEW encrypted balance for `to`.
    ///
    /// Noir circuit must ensure:
    /// - new_balance = old_balance + amount
    /// - range constraints valid
    ///
    /// `proof_inputs` convention (you define this in Noir; here we only assume):
    /// - first 32 bytes: `amount` (U256 big-endian) - revealed by circuit
    /// - rest: arbitrary public inputs for Noir, passed through to verifier.
    pub fn deposit(
        &mut self,
        token: Address,
        amount: U256,
        new_balance_ct_x1: [u8; 32],
        new_balance_ct_x2: [u8; 32],
        to: Address,
        proof_inputs: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), Vec<u8>> {
        self._non_reentrant()?;

        if !self.supported_tokens.get(token) {
            self._release_reentrancy();
            return Err("Token not supported".into());
        }

        let from = self.vm().msg_sender();

        // Verify ZK proof
        self._verify_proof(token, from, to, &proof_inputs, &proof)?;

        // Replay protection
        let proof_hash = keccak256(&proof);
        let key = FixedBytes::from(proof_hash);
        if self.nullifiers.get(key) {
            self._release_reentrancy();
            return Err("Proof already used".into());
        }
        self.nullifiers.setter(key).set(true);

        // Extract plaintext amount from proof inputs (first 32 bytes)
        let amount = self._extract_amount_from_proof_inputs(&proof_inputs)?;

        // Move plain tokens into custody
        self._transfer_from(token, from, self.vm().contract_address(), amount)?;

        // Store the NEW balance ciphertext (no math on-chain)
        let ct = Ciphertext { x1: new_balance_ct_x1, x2: new_balance_ct_x2 };
        self._set_balance(token, to, &ct);

        evm::log(Deposit {
            token,
            from,
            to,
            plain_amount: amount,
            c_balance_new: Bytes::from(encode_ciphertext(&ct).to_vec()),
        });

        self._release_reentrancy();
        Ok(())
    }

    /// Withdraw plain ERC-20 tokens and set NEW encrypted balance for `from`.
    ///
    /// Noir circuit must ensure:
    /// - old_balance_from - amount = new_balance_from,
    /// - no overspend, etc.
    ///
    /// `proof_inputs` convention (you define this in Noir; here we only assume):
    /// - first 32 bytes: `amount` (U256 big-endian)
    /// - rest: arbitrary public inputs for Noir, passed through to verifier.
    pub fn withdraw(
        &mut self,
        token: Address,
        to: Address,
        new_from_ct_x1: [u8; 32],
        new_from_ct_x2: [u8; 32],
        proof_inputs: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), Vec<u8>> {
        self._non_reentrant()?;

        if !self.supported_tokens.get(token) {
            self._release_reentrancy();
            return Err("Token not supported".into());
        }

        let from = self.vm().msg_sender();

        self._verify_proof(token, from, to, &proof_inputs, &proof)?;

        // Replay protection
        let proof_hash = keccak256(&proof);
        let key = FixedBytes::from(proof_hash);
        if self.nullifiers.get(key) {
            self._release_reentrancy();
            return Err("Proof already used".into());
        }
        self.nullifiers.setter(key).set(true);

        // Extract plaintext amount from proof inputs (first 32 bytes)
        let amount = self._extract_amount_from_proof_inputs(&proof_inputs)?;

        // Update encrypted balance for `from` (NEW balance)
        let ct_from = Ciphertext { x1: new_from_ct_x1, x2: new_from_ct_x2 };
        self._set_balance(token, from, &ct_from);

        // Send plain ERC-20 tokens out
        self._transfer(token, to, amount)?;

        self._release_reentrancy();
        Ok(())
    }

    // --- Admin ---

    pub fn set_supported_token(&mut self, token: Address, allowed: bool) -> Result<(), Vec<u8>> {
        self._only_owner()?;
        let mut setter = self.supported_tokens.setter(token);
        setter.set(allowed);
        evm::log(TokenAllowlistUpdated { token, allowed });
        Ok(())
    }

    pub fn set_verifier(&mut self, verifier: Address) -> Result<(), Vec<u8>> {
        self._only_owner()?;
        self.verifier.set(verifier);
        evm::log(VerifierUpdated { verifier });
        Ok(())
    }

    pub fn get_verifier(&self) -> Address {
        self.verifier.get()
    }

    pub fn get_owner(&self) -> Address {
        self.owner.get()
    }

    pub fn is_supported_token(&self, token: Address) -> bool {
        self.supported_tokens.get(token)
    }
}

// --- Internal logic ---
impl ConfidentialERC20 {
    // Reentrancy
    fn _non_reentrant(&mut self) -> Result<(), Vec<u8>> {
        if self.guard.locked.get() {
            return Err("Reentrant call".into());
        }
        self.guard.locked.set(true);
        Ok(())
    }

    fn _release_reentrancy(&mut self) {
        self.guard.locked.set(false);
    }

    // Owner-only
    fn _only_owner(&self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err("Not owner".into());
        }
        Ok(())
    }

    /// Set encrypted balance for a user and token.
    /// NO math, just overwrite with the NEW ciphertext.
    fn _set_balance(&mut self, token: Address, user: Address, ct: &Ciphertext) {
        let (t, u) = balance_key(token, user);
        self.balances_x1
            .setter(t)
            .setter(u)
            .set(FixedBytes::from(ct.x1));
        self.balances_x2
            .setter(t)
            .setter(u)
            .set(FixedBytes::from(ct.x2));
    }

    #[inline(never)]
    fn push_addr(buf: &mut Vec<u8>, addr: Address) {
        let mut tmp = [0u8; 32];
        tmp[12..].copy_from_slice(&addr.into_array());
        buf.extend_from_slice(&tmp);
    }

    /// Verify a Noir proof.
    ///
    /// We build public inputs as:
    ///   [ token, from, to, chain_id, contract, method_id, proof_inputs... ]
    ///
    /// All cryptographic relations between ciphertexts & amounts live inside `proof_inputs`
    /// and are proved in Noir. We do NOT interpret them here.
    fn _verify_proof(
        &self,
        token: Address,
        from: Address,
        to: Address,
        proof_inputs: &[u8],
        proof: &[u8],
    ) -> Result<(), Vec<u8>> {
        let verifier = self.verifier.get();
        let mut public_inputs = Vec::new();
    
        // token (address padded to 32 bytes)
        let mut token_bytes = [0u8; 32];
        token_bytes[12..32].copy_from_slice(&token.into_array());
        public_inputs.extend_from_slice(&token_bytes);
    
        // from
        let mut from_bytes = [0u8; 32];
        from_bytes[12..32].copy_from_slice(&from.into_array());
        public_inputs.extend_from_slice(&from_bytes);
    
        // to
        let mut to_bytes = [0u8; 32];
        to_bytes[12..32].copy_from_slice(&to.into_array());
        public_inputs.extend_from_slice(&to_bytes);
    
        // pk_from (must be registered)
        let pk_from = self.user_pk.get(from);
        let pk_from_bytes = pk_from.as_slice();
        // If user hasn't registered pk, this will be all zeros (assuming default)
        if pk_from_bytes.iter().all(|b| *b == 0) {
            return Err("from pk not registered".into());
        }
        public_inputs.extend_from_slice(pk_from_bytes);
    
        // pk_to (for transfers; for withdraw you can still supply & ignore in Noir)
        let pk_to = self.user_pk.get(to);
        let pk_to_bytes = pk_to.as_slice();
        if pk_to_bytes.iter().all(|b| *b == 0) {
            return Err("to pk not registered".into());
        }
        public_inputs.extend_from_slice(pk_to_bytes);
    
        // chain_id
        let chain = self.chain_id.get();
        let mut chain_bytes = [0u8; 32];
        chain_bytes.copy_from_slice(&chain.to_be_bytes::<32>());
        public_inputs.extend_from_slice(&chain_bytes);
    
        // contract address
        let mut contract_bytes = [0u8; 32];
        contract_bytes[12..32]
            .copy_from_slice(&self.vm().contract_address().into_array());
        public_inputs.extend_from_slice(&contract_bytes);
    
        // method id (domain separation tag for Noir)
        public_inputs.extend_from_slice(&[0x3b, 0x98, 0x32, 0x2f]);
    
        // Append user-provided public inputs (ciphertexts, amounts, etc.)
        public_inputs.extend_from_slice(proof_inputs);
    
        // Typed call to verifier.verify(bytes,bytes)
        let calldata = verifyCall {
            proof: Bytes::from(proof.to_vec()),
            publicInputs: Bytes::from(public_inputs),
        }
        .abi_encode();
    
        let res = unsafe { RawCall::new_static().call(verifier, &calldata)? };
    
        if res.len() >= 32 && res[31] == 0 {
            return Err("Verifier returned false".into());
        }
    
        Ok(())
    }    

    /// Extract plaintext amount (U256) from proof inputs.
    /// Convention: first 32 bytes of `proof_inputs` = amount (big-endian).
    fn _extract_amount_from_proof_inputs(&self, proof_inputs: &[u8]) -> Result<U256, Vec<u8>> {
        if proof_inputs.len() < 32 {
            return Err("Invalid proof inputs".into());
        }
        let mut amt = [0u8; 32];
        amt.copy_from_slice(&proof_inputs[0..32]);
        Ok(U256::from_be_bytes(amt))
    }

    /// Plain ERC-20 transfer using typed sol! call
    fn _transfer(&self, token: Address, to: Address, amount: U256) -> Result<(), Vec<u8>> {
        let calldata = transferCall { to, amount }.abi_encode();
    
        // raw CALL to token
        let res = unsafe {
            RawCall::new()
                .call(token, &calldata)?
        };
    
        // Standard ERC-20 convention: if it returns a bool, check it.
        // If it returns nothing, treat as success.
        if res.len() >= 32 && res[31] == 0 {
            return Err("ERC20 transfer failed".into());
        }
    
        Ok(())
    }    

    /// Plain ERC-20 transferFrom using typed sol! call
    fn _transfer_from(
        &self,
        token: Address,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<(), Vec<u8>> {
        let calldata = transferFromCall { from, to, amount }.abi_encode();
    
        let res = unsafe {
            RawCall::new()
                .call(token, &calldata)?
        };
    
        if res.len() >= 32 && res[31] == 0 {
            return Err("ERC20 transferFrom failed".into());
        }
    
        Ok(())
    }    
}

#[cfg(test)]
mod tests;