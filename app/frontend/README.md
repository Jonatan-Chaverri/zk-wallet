# ZK Wallet Frontend

A Next.js frontend application for a zero-knowledge confidential token wallet. This application enables users to deposit, withdraw, and transfer tokens with complete privacy using zero-knowledge proofs and ElGamal encryption.

## Overview

The frontend is built with Next.js and interacts with the ConfidentialERC20 smart contract on Arbitrum Sepolia. All confidential operations (deposit, withdraw, transfer) require generating zero-knowledge proofs using Noir circuits, which prove the correctness of encrypted balance updates without revealing the actual amounts or balances.

## Key Features

- **Zero-Knowledge Proof Generation**: Client-side proof generation for deposit, withdraw, and transfer operations
- **ElGamal Encryption**: Uses BabyJub/Grumpkin curve for encrypted balance storage
- **Public/Private Key Management**: Secure key generation and storage using Aztec.js
- **Contract Integration**: Direct interaction with ConfidentialERC20 smart contract via ethers.js
- **MetaMask Integration**: Wallet connection and transaction signing

## Architecture

### Key Generation and Management

The application uses **BabyJub/Grumpkin curve** cryptography for ElGamal encryption. Key pairs are generated using Aztec.js:

```typescript
// Key generation uses GrumpkinScalar and Schnorr signature scheme
const sk = GrumpkinScalar.random(); // Private key
const schnorr = new Schnorr();
const pk = await schnorr.computePublicKey(sk); // Public key {x, y}
```

**Key Lifecycle:**
1. **Registration**: When a user registers, a new key pair is generated client-side using `generateBabyJubKeyPair()`
2. **Storage**: 
   - Private keys are stored in browser `localStorage` (encrypted by wallet address)
   - Public keys are stored both in the backend database and on-chain in the ConfidentialERC20 contract
3. **On-Chain Registration**: The public key (64 bytes: 32 bytes x + 32 bytes y) is registered via `registerUserPk()` contract function
4. **Usage**: Private keys are used to generate proofs for confidential operations

**Security Note**: Private keys never leave the client. They are stored locally and used only for proof generation.

### Proof Generation

All confidential operations require zero-knowledge proofs generated using **Noir circuits** and the **UltraHonk backend** from Aztec's bb.js library.

#### Deposit Proof

**Purpose**: Proves that a user can deposit tokens into their encrypted balance without revealing the amount or current balance.

**What it proves:**
- User owns the old encrypted balance (knows the private key)
- New balance = old balance + deposit amount
- The encrypted balance update is computed correctly

**Inputs:**
- **Private**: `senderPrivKey` (user's private key), `r_amount` (randomness for encryption)
- **Public**: `senderPubkey` (user's public key), `oldBalanceX1/X2` (current encrypted balance), `senderAddress`, `token`, `amount`

**Process:**
1. Fetch current encrypted balance from contract (`balanceOfEnc`)
2. Parse balance into two points (x1, x2) representing the ElGamal ciphertext
3. Generate randomness for the new encryption
4. Execute Noir circuit with inputs
5. Generate proof using UltraHonk backend
6. Submit proof and public inputs to contract's `deposit()` function

**Circuit Location**: `app/lib/noir/circuits/deposit.json`

#### Withdraw Proof

**Purpose**: Proves that a user can withdraw tokens from their encrypted balance without revealing the amount or current balance.

**What it proves:**
- User owns the old encrypted balance
- User has sufficient balance to withdraw
- New balance = old balance - withdraw amount
- The encrypted balance update is computed correctly

**Inputs:**
- **Private**: `senderPrivKey`, `r_amount` (randomness)
- **Public**: `senderPubkey`, `oldBalanceX1/X2`, `senderAddress`, `token`, `amount`

**Process:**
1. Fetch current encrypted balance from contract
2. Parse balance into ciphertext points
3. Generate randomness for new encryption
4. Execute Noir circuit
5. Generate proof using UltraHonk backend
6. Submit proof and public inputs to contract's `withdraw()` function

**Circuit Location**: `app/lib/noir/circuits/withdraw.json`

#### Transfer Proof

**Purpose**: Proves that a user can transfer tokens between encrypted balances without revealing amounts or balances.

**What it proves:**
- Sender owns their old encrypted balance
- Sender has sufficient balance to transfer
- New balances computed correctly for both sender and receiver
- Receiver's balance is updated correctly

**Inputs:**
- **Private**: `senderPrivKey`, `r_amount_sender`, `r_amount_receiver` (randomness for both parties)
- **Public**: `senderPubkey`, `senderOldBalanceX1/X2`, `receiverPubkey`, `receiverOldBalanceX1/X2`, `receiverAddress`, `token`, `transfer_amount`

**Process:**
1. Fetch encrypted balances for both sender and receiver from contract
2. Parse both balances into ciphertext points
3. Generate randomness for both new encryptions
4. Execute Noir circuit with all inputs
5. Generate proof using UltraHonk backend
6. Submit proof and public inputs to contract's `transferConfidential()` function

**Circuit Location**: `app/lib/noir/circuits/transfer.json`

### Proof Generation Flow

All proofs follow a similar flow:

```typescript
// 1. Prepare inputs (private + public)
const inputs = {
  sender_priv_key: privateKey,
  // ... other inputs
};

// 2. Initialize Noir circuit
const noir = new Noir(circuitJson);

// 3. Execute circuit to generate witness
const { witness } = await noir.execute(inputs);

// 4. Generate proof using UltraHonk backend
const backend = new UltraHonkBackend(circuitBytecode);
const proof = await backend.generateProof(witness, { keccak: true });

// 5. Submit to contract
await contract.deposit(proof.publicInputs, proof.proof);
```

The proof generation is handled by the `useProofs` hook, which provides:
- `generateDeposit(params)` - Generate deposit proof
- `generateWithdraw(params)` - Generate withdraw proof
- `generateTransfer(params)` - Generate transfer proof

### Contract Interactions

The application uses **ethers.js** to interact with the ConfidentialERC20 contract:

**Key Contract Functions:**
- `registerUserPk(uint8[64] publicKey)` - Register user's public key on-chain
- `getUserPk(address user)` - Retrieve user's public key from contract
- `balanceOfEnc(address token, address user)` - Get encrypted balance (returns 416 bytes)
- `deposit(uint8[416] publicInputs, bytes proof)` - Deposit tokens with proof
- `withdraw(uint8[416] publicInputs, bytes proof)` - Withdraw tokens with proof
- `transferConfidential(uint8[704] publicInputs, bytes proof)` - Transfer tokens with proof

**Contract Hook**: `useConfidentialERC20()` provides all contract interaction methods and handles:
- Contract address configuration (fetched from backend)
- Provider setup (MetaMask or RPC fallback)
- Transaction signing
- Gas estimation

## Setup and Installation

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Backend API running (see backend README)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

3. Ensure Noir circuit artifacts are present:
   - `app/lib/noir/circuits/deposit.json`
   - `app/lib/noir/circuits/withdraw.json`
   - `app/lib/noir/circuits/transfer.json`

These are compiled Noir circuits that must be generated from the Noir source code in `wallet_proof/`.

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## Usage Flow

1. **Connect Wallet**: Click "Connect MetaMask" to connect your wallet
2. **Register**: If new user, register with a username. This will:
   - Generate a Grumkin curve key pair
   - Store public key in backend and on-chain
   - Store private key locally in localStorage
3. **Deposit**: 
   - Select token and amount
   - Enter private key (or use stored one)
   - Proof is generated client-side
   - Transaction submitted to contract
4. **Transfer**: 
   - Enter receiver address/username
   - Select token and amount
   - Proof is generated for both sender and receiver balance updates
   - Transaction submitted to contract
5. **Withdraw**: 
   - Select token and amount
   - Proof is generated proving sufficient balance
   - Tokens are withdrawn to your wallet

## Technical Details

### Dependencies

- **@noir-lang/noir_js**: Noir circuit execution
- **@aztec/bb.js**: UltraHonk proof backend
- **@aztec/aztec.js**: BabyJub key generation (GrumpkinScalar, Schnorr)
- **ethers**: Smart contract interactions
- **wagmi**: Wallet connection management
- **next**: React framework

### File Structure

```
app/
├── hooks/
│   ├── useConfidentialERC20.ts    # Contract interaction hook
│   ├── useProofs.ts                # Proof generation hook
│   ├── useUser.ts                  # User management hook
│   └── useWallet.ts                # Wallet connection hook
├── lib/
│   ├── noir/
│   │   ├── proofGeneration.ts      # Core proof generation logic
│   │   └── circuits/               # Compiled Noir circuits
│   ├── utils/
│   │   ├── crypto.ts               # Key generation utilities
│   │   └── publicInputs.ts        # Public input conversion
│   └── contracts/                  # Contract ABIs
├── deposit/
│   └── page.tsx                    # Deposit page
├── withdraw/
│   └── page.tsx                    # Withdraw page
└── transfer/
    └── page.tsx                    # Transfer page
```

### Security Considerations

1. **Private Keys**: Never transmitted to backend or exposed in logs
2. **Proof Generation**: All proofs generated client-side
3. **Storage**: Private keys stored in localStorage (consider upgrading to secure storage for production)
4. **Network**: Ensure backend API is running and accessible
5. **Contract**: Verify contract address is correct for your network

## Troubleshooting

### Proof Generation Fails

- Ensure Noir circuit artifacts are present and valid
- Check that private key format is correct (hex string with 0x prefix)
- Verify encrypted balance format matches expected structure

### Contract Interaction Fails

- Ensure MetaMask is connected to Arbitrum Sepolia
- Verify contract address is configured correctly
- Check that user's public key is registered on-chain

### Key Generation Issues

- Ensure @aztec/aztec.js is properly installed
- Check browser compatibility (requires Web Crypto API)

## Development Notes

- Proof generation can take 5-30 seconds depending on circuit complexity
- Gas limits are set high (15M) for zk-proof transactions
- Amounts are truncated to 40 bits (removing 6 decimals) to fit in Noir Field elements
- The contract multiplies by 10^6 to restore the original amount
