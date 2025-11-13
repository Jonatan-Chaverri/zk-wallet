# zkWallet

A zero-knowledge confidential token wallet that enables private transfers between users while hiding transaction amounts and account balances on-chain. Built as a public good for the **Invisible Garden program in Argentina 2025**.

🌐 **Live Demo**: [https://zk-wallet-kappa.vercel.app/](https://zk-wallet-kappa.vercel.app/)

## Overview

zkWallet is a privacy-preserving cryptocurrency wallet that uses zero-knowledge proofs and ElGamal encryption to enable confidential token transfers. Unlike traditional blockchain transactions where amounts and balances are publicly visible, zkWallet ensures that:

- **Transaction amounts are hidden** from public view
- **Account balances remain encrypted** on-chain
- **Transfer operations are verifiable** without revealing sensitive financial data
- **Only the involved parties** can decrypt their own balances using their private keys

## Purpose

The primary goal of zkWallet is to provide financial privacy for users transacting on public blockchains. By leveraging zero-knowledge cryptography, users can:

1. **Deposit tokens** into encrypted balances without revealing the amount
2. **Transfer tokens** between users while keeping both the transfer amount and account balances private
3. **Withdraw tokens** from their encrypted balance without exposing their total holdings

All operations are cryptographically verified on-chain using zero-knowledge proofs, ensuring that the system remains secure and trustless while maintaining complete privacy.

## User Registration and Key Generation

Before users can perform any confidential operations, they must register and generate a cryptographic key pair. This is a critical security requirement:

### Registration Process

1. **Key Pair Generation**: When a user registers, a unique cryptographic key pair is generated client-side:
   - **Private Key**: Generated using the Grumpkin curve (BabyJub) scalar, stored locally in the browser's localStorage and also show it to the user.
   - **Public Key**: Derived from the private key using Schnorr signature scheme, consisting of two 32-byte coordinates (x, y)

2. **On-Chain Registration**: The public key (64 bytes total) is registered both:
   - In the backend database for user lookup
   - On-chain in the ConfidentialERC20 smart contract via `registerUserPk()`

3. **Security Model**: 
   - Private keys **never leave the client** - they are stored locally and used only for proof generation
   - Public keys are stored on-chain and in the database to enable encrypted balance operations
   - The private key is required to decrypt balances and generate zero-knowledge proofs

### Why Registration is Required

The encryption system uses **ElGamal encryption** over the Grumpkin curve (BabyJub). Each user's balance is encrypted under their public key, which means:

- Balances can only be decrypted by the owner using their private key
- Transfers require the sender to encrypt amounts under both their own and the receiver's public keys
- Without a registered public key, a user cannot receive encrypted transfers or maintain a confidential balance

## Zero-Knowledge Proof Generation

All confidential operations (deposit, transfer, withdraw) require generating zero-knowledge proofs using **Noir circuits** and the **UltraHonk backend** from Aztec's bb.js library. These proofs cryptographically verify the correctness of operations without revealing sensitive information.

### What is Hidden

The zero-knowledge proofs ensure that the following information remains private:

1. **Account Balances**: Current and new balances are stored as ElGamal ciphertexts (encrypted values) on-chain
2. **Transaction Amounts**: For transfers, the amount being sent is kept private (though revealed for deposits/withdrawals to enable ERC-20 token transfers)
3. **Private Keys**: User private keys are never exposed or transmitted
4. **Balance History**: Previous balance values cannot be inferred from on-chain data

### What is Proven

The proofs demonstrate:

1. **Ownership**: The user knows the private key corresponding to their public key
2. **Correctness**: Balance updates are computed correctly using homomorphic encryption
3. **Sufficiency**: For withdrawals and transfers, the user has sufficient balance (without revealing the actual balance)
4. **Integrity**: The encrypted balance updates match the claimed operations

### Proof Circuits

#### Deposit Proof

**Purpose**: Proves a user can deposit tokens into their encrypted balance.

**What it proves**:
- User owns the old encrypted balance (knows the private key)
- New balance = old balance + deposit amount (using homomorphic addition)
- The encrypted balance update is computed correctly

**Private inputs**:
- `sender_priv_key`: User's private key (never revealed)
- `r_amount`: Randomness for encrypting the deposit amount

**Public inputs**:
- `sender_pubkey`: User's public key
- `old_balance_x1/x2`: Current encrypted balance (ElGamal ciphertext as two curve points)
- `sender_address`: User's Ethereum address
- `token`: Token contract address
- `amount`: Deposit amount (revealed to enable ERC-20 transfer)

**Output**: New encrypted balance (as ciphertext)

#### Transfer Proof

**Purpose**: Proves a user can transfer tokens between encrypted balances without revealing amounts or balances.

**What it proves**:
- Sender owns their old encrypted balance
- Sender has sufficient balance to transfer (without revealing the actual balance)
- New balances computed correctly for both sender and receiver using homomorphic operations
- Receiver's balance is updated correctly (sender doesn't need receiver's private key)

**Private inputs**:
- `sender_priv_key`: Sender's private key
- `transfer_amount`: Amount to transfer (kept private)
- `r_amount_sender`: Randomness for encrypting amount under sender's key
- `r_amount_receiver`: Randomness for encrypting amount under receiver's key

**Public inputs**:
- `sender_pubkey`: Sender's public key
- `sender_old_balance_x1/x2`: Sender's current encrypted balance
- `receiver_pubkey`: Receiver's public key
- `receiver_old_balance_x1/x2`: Receiver's current encrypted balance
- `receiver_address`: Receiver's Ethereum address
- `token`: Token contract address

**Output**: New encrypted balances for both sender and receiver

**Key Innovation**: The transfer circuit uses **homomorphic encryption** to update the receiver's balance without requiring the receiver's private key. The sender encrypts the transfer amount under the receiver's public key, and the circuit performs homomorphic addition entirely on encrypted values.

#### Withdraw Proof

**Purpose**: Proves a user can withdraw tokens from their encrypted balance.

**What it proves**:
- User owns the old encrypted balance
- User has sufficient balance to withdraw (without revealing the actual balance)
- New balance = old balance - withdraw amount (using homomorphic subtraction)
- The encrypted balance update is computed correctly

**Private inputs**:
- `sender_priv_key`: User's private key
- `r_amount`: Randomness for encrypting the withdrawal amount

**Public inputs**:
- `sender_pubkey`: User's public key
- `old_balance_x1/x2`: Current encrypted balance
- `sender_address`: User's Ethereum address
- `token`: Token contract address
- `amount`: Withdrawal amount (revealed to enable ERC-20 transfer)

**Output**: New encrypted balance (as ciphertext)

### Proof Generation Flow

All proofs follow this general flow:

1. **Prepare Inputs**: Gather private inputs (private key, randomness) and public inputs (encrypted balances, addresses, etc.)
2. **Execute Noir Circuit**: Run the compiled Noir circuit with the inputs to generate a witness
3. **Generate Proof**: Use the UltraHonk backend to generate a zero-knowledge proof from the witness
4. **Submit to Contract**: Send the proof and public inputs to the smart contract for verification
5. **On-Chain Verification**: The contract verifies the proof and updates encrypted balances accordingly

The proof generation happens entirely **client-side** - no sensitive information is sent to any server.

## Technologies

zkWallet is built using a modern stack of cutting-edge cryptographic and blockchain technologies:

### Smart Contract Layer
- **Arbitrum Stylus**: Rust-based smart contracts deployed on Arbitrum, enabling efficient on-chain proof verification
- **Rust**: Systems programming language for the ConfidentialERC20 contract
- **Hardhat**: Development environment and deployment tooling for Solidity verifier contracts

### Zero-Knowledge Layer
- **Noir**: Domain-specific language for writing zero-knowledge circuits
- **UltraHonk Verifier**: Aztec's UltraHonk proof system for efficient proof verification on-chain
- **ElGamal Encryption**: Homomorphic encryption scheme over the Grumpkin curve (BabyJub) for encrypted balance storage

### Frontend
- **Next.js**: React framework for the web application
- **TypeScript**: Type-safe JavaScript for the frontend codebase
- **Aztec.js**: Cryptographic libraries for key generation and proof generation
- **ethers.js**: Ethereum library for smart contract interactions

### Backend
- **Node.js**: Runtime for the backend API
- **PostgreSQL**: Database for user and transaction management
- **Express**: Web framework for the REST API

### Cryptographic Primitives
- **Grumpkin Curve (BabyJub)**: Elliptic curve used for ElGamal encryption
- **Schnorr Signatures**: Signature scheme for public key derivation
- **Homomorphic Encryption**: Enables computation on encrypted values without decryption

## Team

This project was built as a public good for the **Invisible Garden program in Argentina 2025** by:

- **Jonatan Chaverri** - [@jonatan-chaverri](https://github.com/jonatan-chaverri) - Devfolio: @jonatanchaverri
- **Gerson Loaiza** - [@Gerson](https://github.com/Gerson2102) - Devfolio: @0xGerson
- **Shramee Srivastav** - [@Shramme](https://github.com/shramee)

## Project Structure

```
zk-wallet/
├── app/
│   ├── frontend/          # Next.js web application
│   │   ├── app/
│   │   │   ├── hooks/     # React hooks for contract interaction, proofs, user management
│   │   │   ├── lib/       # Noir circuits, proof generation, utilities
│   │   │   └── deposit/   # Deposit page
│   │   │   └── transfer/  # Transfer page
│   │   │   └── withdraw/  # Withdraw page
│   │   └── ...
│   └── backend/           # Node.js API server
│       ├── src/
│       │   ├── routes/    # API endpoints
│       │   └── db/        # Database services and migrations
│       └── ...
├── contracts/
│   ├── confidential_erc20/  # Stylus contract (Rust) - Main confidential token contract
│   ├── verifier/            # Solidity verifier contracts (UltraHonk)
│   └── test_contracts/      # Testing utilities
└── wallet_proof/            # Noir circuits
    ├── deposit/             # Deposit proof circuit
    ├── transfer/            # Transfer proof circuit
    └── withdraw/            # Withdraw proof circuit
```

## Getting Started

For detailed setup instructions, see the individual README files:
- [Frontend README](app/frontend/README.md)
- [Backend README](app/backend/README.md)
- [Contracts README](contracts/README.md)

## License

This project is open source and available for use as a public good.
