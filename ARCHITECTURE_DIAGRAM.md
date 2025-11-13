# zkWallet Architecture & Workflow Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER'S BROWSER                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    FRONTEND (Next.js 15.5.6)                       │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │   Wallet UI  │  │  Proof Gen   │  │   Key Mgmt   │             │     │
│  │  │   (React)    │  │  (NoirJS)    │  │  (Aztec.js)  │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  │         │                  │                  │                     │     │
│  │         └──────────────────┼──────────────────┘                     │     │
│  │                            │                                        │     │
│  │  ┌─────────────────────────▼──────────────────────────┐            │     │
│  │  │         Noir Circuit Executor (WASM)                │            │     │
│  │  │  - deposit.json  (62KB bytecode)                    │            │     │
│  │  │  - transfer.json (70KB bytecode)                    │            │     │
│  │  │  - withdraw.json (62KB bytecode)                    │            │     │
│  │  └─────────────────────────┬──────────────────────────┘            │     │
│  │                            │                                        │     │
│  │  ┌─────────────────────────▼──────────────────────────┐            │     │
│  │  │      UltraHonk Prover (bb.js@2.1.2)                │            │     │
│  │  │  Generates ZK proof: 6,976 bytes (218 fields)      │            │     │
│  │  └─────────────────────────┬──────────────────────────┘            │     │
│  │                            │                                        │     │
│  └────────────────────────────┼────────────────────────────────────────┘     │
│                               │                                              │
│                               │ Proof (6,976 bytes)                          │
│                               │ + Public Inputs                              │
│                               ▼                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP POST
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express API on port 3001)                      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    Transaction Relay Service                       │     │
│  │                                                                     │     │
│  │  Routes:                                                            │     │
│  │  • POST /api/wallet/deploy        - Deploy user wallet             │     │
│  │  • POST /api/wallet/register-pk   - Register Grumpkin pubkey        │     │
│  │  • POST /api/transaction/deposit  - Submit deposit + proof         │     │
│  │  • POST /api/transaction/transfer - Submit transfer + proof        │     │
│  │  • POST /api/transaction/withdraw - Submit withdraw + proof        │     │
│  │  • POST /api/transaction          - Log transaction to database    │     │
│  │  • GET  /api/config/balance       - Query encrypted balance        │     │
│  │  • GET  /api/getUser              - Get user by address/username   │     │
│  │  • POST /api/register             - Register new user              │     │
│  │  • POST /api/deleteUser           - Delete user by address         │     │
│  │  • GET  /api/tokens               - Get available tokens           │     │
│  └────────────────────────┬───────────────────────────────────────────┘     │
│                           │                                                  │
│                           │ Signs & submits transaction                      │
│                           │ (Gas abstraction)                                │
│                           ▼                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
                            │ RPC Call (viem)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARBITRUM SEPOLIA TESTNET                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      VERIFIER CONTRACTS                              │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  DepositVerifier.sol  (92KB)                               │     │   │
│  │  │  Address: 0xC43C243E2e1667Af1c3d36Df8e4d76B302642970      │     │   │
│  │  │  • Verifies deposit proofs (6,976 bytes)                   │     │   │
│  │  │  • Updates encrypted balance                               │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  WithdrawVerifier.sol (92KB)                               │     │   │
│  │  │  Address: 0x59b1800deDB9AeC940E96F78B650DCDCeA1F5449      │     │   │
│  │  │  • Verifies withdraw proofs (6,976 bytes)                  │     │   │
│  │  │  • Updates encrypted balance & releases funds              │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  TransferVerifier.sol (92KB)                               │     │   │
│  │  │  Address: 0xe17d3034062113d1eD4526A8C58f60645E6f5f6a      │     │   │
│  │  │  • Verifies transfer proofs (6,976 bytes)                  │     │   │
│  │  │  • Updates both sender & receiver encrypted balances       │     │   │
│  │  │  • Uses homomorphic addition (no receiver private key!)    │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    WALLET & TOKEN CONTRACTS                          │   │
│  │                                                                       │   │
│  │  • UserWallet (Stylus WASM) - ERC-4337 smart wallet                 │   │
│  │  • ConfidentialERC20 - Token contract with encrypted balances       │   │
│  │  • WalletFactory - Deploys user wallets                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Database: Supabase PostgreSQL                                              │
│  • Stores user public keys                                                  │
│  • Tracks deployed wallet addresses                                         │
│  • Encrypted balance state                                                  │
│  • Transaction logs (deposit/transfer/withdraw)                             │
│  • Contract registry (verifiers, tokens)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deposit Workflow

```
┌─────────────┐
│    USER     │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Clicks "Deposit 1000 tokens"
       │
       ▼
┌──────────────────────────────────────────────────────┐
│              FRONTEND: Generate Proof                │
│                                                       │
│  Inputs (Private):                                   │
│  • sender_priv_key: 42                               │
│  • current_balance: 500 (decrypted)                  │
│  • r_new_balance: 222 (fresh randomness)             │
│                                                       │
│  Inputs (Public):                                    │
│  • sender_address: 1                                 │
│  • sender_pubkey: {...} (from private key)           │
│  • old_balance_ct: {...} (current encrypted balance) │
│  • token: 1                                          │
│  • amount: 1000                                      │
│                                                       │
│  Circuit Execution:                                  │
│  1. Verify sender owns private key                   │
│  2. Decrypt old balance, verify it matches           │
│  3. Compute new_balance = 500 + 1000 = 1500          │
│  4. Encrypt new_balance with fresh randomness        │
│  5. Generate proof (~2 seconds)                      │
│                                                       │
│  Output:                                             │
│  • Proof: 6,976 bytes                                │
│  • new_balance_ct: Enc(1500)                         │
│  • revealed_amount: 1000 (for custody)               │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 2. POST /api/transaction/deposit
                        │    { proof, newBalanceCt, amount }
                        ▼
┌──────────────────────────────────────────────────────┐
│              BACKEND: Relay Transaction              │
│                                                       │
│  1. Validate proof format                            │
│  2. Sign transaction with relay wallet               │
│  3. Submit to DepositVerifier contract               │
│  4. Pay gas on behalf of user                        │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 3. Contract call:
                        │    verifyAndDeposit(proof, publicInputs)
                        ▼
┌──────────────────────────────────────────────────────┐
│         ARBITRUM: DepositVerifier.sol                │
│                                                       │
│  1. Verify proof (6,976 bytes) with UltraHonk        │
│  2. Check public inputs match                        │
│  3. Transfer 1000 tokens to contract custody         │
│  4. Update on-chain encrypted balance:               │
│     old_balance_ct → new_balance_ct (Enc(1500))      │
│                                                       │
│  ✅ Transaction succeeds                             │
│  📊 New encrypted balance stored on-chain            │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 4. Transaction receipt
                        ▼
                ┌─────────────┐
                │    USER     │
                │  Balance:   │
                │  Enc(1500)  │
                │  (visible   │
                │  only to    │
                │  user)      │
                └─────────────┘
```

---

## Transfer Workflow (Key Feature: Homomorphic Encryption)

```
┌─────────────┐                                    ┌─────────────┐
│  SENDER     │                                    │  RECEIVER   │
│  Balance:   │                                    │  Balance:   │
│  Enc(1500)  │                                    │  Enc(300)   │
└──────┬──────┘                                    └─────────────┘
       │
       │ 1. Transfer 500 tokens to Receiver
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│              FRONTEND: Generate Transfer Proof                   │
│                                                                   │
│  Inputs (Private):                                               │
│  • sender_priv_key: 42                                           │
│  • current_balance_sender: 1500                                  │
│  • transfer_amount: 500                                          │
│  • r_new_balance_sender: 333 (fresh randomness)                 │
│  • r_transfer_amount: 444 (fresh randomness)                    │
│                                                                   │
│  Inputs (Public):                                                │
│  • sender_address, sender_pubkey                                 │
│  • old_balance_sender_ct: Enc(1500)                              │
│  • receiver_address, receiver_pubkey                             │
│  • old_balance_receiver_ct: Enc(300)                             │
│  • token: 1                                                      │
│                                                                   │
│  Circuit Execution:                                              │
│  1. Verify sender owns private key                               │
│  2. Decrypt sender's old balance, verify it matches              │
│  3. Check sufficient balance: 1500 >= 500 ✅                     │
│  4. Compute sender new_balance = 1500 - 500 = 1000              │
│  5. Encrypt sender new_balance: Enc(1000)                        │
│  6. Encrypt transfer amount: Enc(500) [under receiver's key]    │
│  7. Homomorphic addition:                                        │
│     Enc(300) + Enc(500) = Enc(800)  [NO RECEIVER KEY NEEDED!]   │
│  8. Generate proof (~2 seconds)                                  │
│                                                                   │
│  Output:                                                         │
│  • Proof: 6,976 bytes                                            │
│  • sender_new_balance_ct: Enc(1000)                              │
│  • receiver_new_balance_ct: Enc(800)                             │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ 2. POST /api/transaction/transfer
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│         ARBITRUM: TransferVerifier.sol                           │
│                                                                   │
│  1. Verify proof (6,976 bytes)                                   │
│  2. Update both encrypted balances atomically:                   │
│     • Sender:   Enc(1500) → Enc(1000)                            │
│     • Receiver: Enc(300)  → Enc(800)                             │
│                                                                   │
│  ✅ No tokens move (already in shielded pool)                    │
│  ✅ Both balances updated privately                              │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ 3. Both users see updated balances
                        │
       ┌────────────────┴─────────────────┐
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  SENDER     │                    │  RECEIVER   │
│  Balance:   │                    │  Balance:   │
│  Enc(1000)  │                    │  Enc(800)   │
│  (only      │                    │  (only      │
│  sender     │                    │  receiver   │
│  can        │                    │  can        │
│  decrypt)   │                    │  decrypt)   │
└─────────────┘                    └─────────────┘
```

**Key Innovation:** The receiver's new balance is computed using **homomorphic addition** on the encrypted values. The receiver never needs to share their private key!

---

## Withdraw Workflow

```
┌─────────────┐
│    USER     │
│  Balance:   │
│  Enc(1000)  │
└──────┬──────┘
       │
       │ 1. Withdraw 400 tokens
       │
       ▼
┌──────────────────────────────────────────────────────┐
│              FRONTEND: Generate Proof                │
│                                                       │
│  Inputs (Private):                                   │
│  • sender_priv_key: 42                               │
│  • current_balance: 1000                             │
│  • withdraw_amount: 400                              │
│  • r_new_balance: 555 (fresh randomness)             │
│                                                       │
│  Inputs (Public):                                    │
│  • sender_address, sender_pubkey                     │
│  • old_balance_ct: Enc(1000)                         │
│  • token: 1                                          │
│                                                       │
│  Circuit Execution:                                  │
│  1. Verify sender owns private key                   │
│  2. Decrypt old balance, verify it matches           │
│  3. Check sufficient balance: 1000 >= 400 ✅         │
│  4. Compute new_balance = 1000 - 400 = 600           │
│  5. Encrypt new_balance with fresh randomness        │
│  6. Generate proof (~2 seconds)                      │
│                                                       │
│  Output:                                             │
│  • Proof: 6,976 bytes                                │
│  • new_balance_ct: Enc(600)                          │
│  • revealed_amount: 400 (to release)                 │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 2. POST /api/transaction/withdraw
                        ▼
┌──────────────────────────────────────────────────────┐
│         ARBITRUM: WithdrawVerifier.sol               │
│                                                       │
│  1. Verify proof (6,976 bytes)                       │
│  2. Update encrypted balance:                        │
│     Enc(1000) → Enc(600)                             │
│  3. Transfer 400 tokens from contract to user        │
│                                                       │
│  ✅ Tokens released from shielded pool               │
│  ✅ New encrypted balance stored                     │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 3. User receives 400 tokens
                        ▼
┌─────────────┐
│    USER     │
│  Encrypted  │
│  Balance:   │
│  Enc(600)   │
│             │
│  Wallet:    │
│  +400 tokens│
└─────────────┘
```

---

## Privacy Guarantees

### What's Hidden (Private)
- ❌ **Account balances** - Always encrypted with ElGamal
- ❌ **Transfer amounts** - Never revealed on-chain
- ❌ **Transaction sender** (when using relay)
- ❌ **Who paid gas** (backend relayer)
- ❌ **Private keys** - Never leave the browser

### What's Public
- ✅ **Encrypted balance ciphertexts** - (unreadable without private key)
- ✅ **Proof verification** - Anyone can verify proofs are valid
- ✅ **Transaction occurred** - But not the amount
- ✅ **Sender/receiver addresses** - Smart contract addresses visible

---

## Transaction Logging & Database

**Recent Addition (PR #24):** The system now includes transaction logging to the database for audit trails and user transaction history.

### Transaction Logging Flow

```
┌────────────────────────────────────────────────────────┐
│              FRONTEND: After Transaction               │
│                                                         │
│  1. User completes deposit/transfer/withdraw           │
│  2. Transaction is submitted to blockchain             │
│  3. Receive tx_hash from blockchain                    │
│  4. Call apiClient.registerTransaction({               │
│       tx_hash: "0x...",                                │
│       type: "DEPOSIT" | "TRANSFER" | "WITHDRAW",       │
│       token: "0x...",                                  │
│       amount: "1000",                                  │
│       sender_address: "0x...",                         │
│       receiver_address: "0x..." (for transfers)        │
│     })                                                 │
└─────────────────────┬──────────────────────────────────┘
                      │
                      │ POST /api/transaction
                      ▼
┌────────────────────────────────────────────────────────┐
│              BACKEND: Transaction Service              │
│                                                         │
│  1. Validate tx_hash format (0x + 64 hex chars)        │
│  2. Check if transaction already logged (prevent dups) │
│  3. Resolve contract_id from CONFIDENTIAL_ERC20        │
│  4. Store in PostgreSQL:                               │
│     • tx_hash (unique, lowercase)                      │
│     • type (deposit/transfer/withdraw)                 │
│     • status (default: "confirmed")                    │
│     • token, amount, addresses                         │
│     • contract_id, created_at                          │
│                                                         │
│  Returns: { success: true, transaction: {...} }        │
└────────────────────────────────────────────────────────┘
```

### Database Schema (transactions table)

```
transactions
├── id (uuid, primary key)
├── tx_hash (text, unique) - Blockchain transaction hash
├── type (text) - 'deposit' | 'transfer' | 'withdraw'
├── status (text) - 'pending' | 'confirmed' | 'failed'
├── token (text, nullable) - Token contract address
├── amount (text, nullable) - Transaction amount
├── sender_address (text, nullable) - Sender wallet address
├── receiver_address (text, nullable) - Receiver wallet (transfers only)
├── contract_id (uuid, foreign key) - Reference to contracts table
├── created_at (timestamp) - When transaction was logged
└── updated_at (timestamp) - Last update time
```

**Use Cases:**
- User transaction history
- Audit trail for compliance
- Analytics and monitoring
- Debugging failed transactions

---

## ElGamal Homomorphic Encryption Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    ElGamal Encryption                          │
│                                                                 │
│  User's Keys:                                                  │
│  • Private Key (scalar): k = 42                                │
│  • Public Key (point): H = k·G                                 │
│    where G = BabyJub generator point                           │
│                                                                 │
│  Encrypt a balance (e.g., 1000):                               │
│  • Choose random scalar: r                                     │
│  • Ciphertext = (x1, x2) where:                                │
│    - x1 = r·G        (ephemeral key)                           │
│    - x2 = r·H + m·G  (encrypted message)                       │
│                                                                 │
│  Decrypt:                                                      │
│  • Given ciphertext (x1, x2) and private key k                 │
│  • Compute: m·G = x2 - k·x1                                    │
│  • Recover m by verifying: m·G == m·G for known m              │
│                                                                 │
│  Homomorphic Addition (Transfer Circuit):                      │
│  • Enc(300) = (x1, x2)                                         │
│  • Enc(500) = (y1, y2)                                         │
│  • Enc(800) = (x1+y1, x2+y2)  ← Point addition!                │
│                                                                 │
│  ⚠️ Only works when both ciphertexts use the SAME public key!  │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Components

### 1. Noir Circuits (Workspace: `wallet_proof/`)
```
wallet_proof/
├── deposit/src/main.nr      (119 ACIR opcodes, 72 Brillig opcodes)
├── transfer/src/main.nr     (Transfer with homomorphic addition)
├── withdraw/src/main.nr     (Withdrawal logic)
└── target/
    ├── deposit.json   (62KB) ──┐
    ├── transfer.json  (70KB)   ├──> Used by NoirJS in browser
    └── withdraw.json  (62KB) ──┘
```

### 2. Verifier Generation Pipeline
```
Circuit Source (main.nr)
    │
    │ nargo compile
    ▼
ACIR Bytecode
    │
    │ Embedded in JSON
    ▼
Circuit JSON (deposit.json)
    │
    │ node generate-verifier.mjs
    │ Uses: bb.js@2.1.2 + UltraHonkBackend
    ▼
Solidity Verifier Contract (92KB)
    │
    │ Deploy to Arbitrum
    ▼
On-Chain Verifier (expects 6,976-byte proofs)
```

### 3. Frontend Proof Generation Stack
```
User Input
    │
    ▼
React Component (page.tsx)
    │
    ▼
React Hook (useProofs.ts)
    │
    ▼
Noir Bridge (lib/noir/index.ts)
    │
    ▼
Proof Generation (proofGeneration.ts)
    │
    ├──> Load circuit bytecode (deposit.json)
    ├──> Initialize Noir program
    ├──> Execute circuit → Generate witness
    └──> Generate proof with bb.js@2.1.2
           │
           ▼
    Proof (6,976 bytes) + Public Inputs
```

### 4. Backend API Architecture
```
Express Server (port 3001)
    │
    ├─> /api/wallet/deploy                 - Deploy user wallet
    ├─> /api/wallet/register-pk            - Register public key on-chain
    ├─> /api/transaction/deposit           - Submit deposit with proof
    ├─> /api/transaction/transfer          - Submit transfer with proof
    ├─> /api/transaction/withdraw          - Submit withdraw with proof
    ├─> /api/transaction (POST)            - Log transaction to database (NEW)
    ├─> /api/config                        - Get app configuration
    ├─> /api/config/balance                - Query encrypted balance
    ├─> /api/getUser                       - Get user by address/username
    ├─> /api/register                      - Register new user
    ├─> /api/deleteUser                    - Delete user
    └─> /api/tokens                        - Get available tokens
         │
         ├──> Supabase (PostgreSQL) - User & transaction state
         └──> Viem - Arbitrum RPC calls
```

---

## Critical Version Requirements

| Component | Version | Why Critical |
|-----------|---------|--------------|
| **bb.js** | **2.1.2** | Different versions generate incompatible proof formats |
| Noir | 1.0.0-beta.14 | Circuit compilation version |
| NoirJS | 1.0.0-beta.14 | Must match Noir version |
| Next.js | 15.5.6 | Latest stable |
| Node.js | ≥16.0.0 | Required for WASM support |

---

## Security Model

### Threat Model
1. **Malicious Observer** - Can see all on-chain data
   - ✅ Protected: Balances encrypted, amounts never revealed

2. **Malicious Relayer** - Backend could be compromised
   - ✅ Protected: Can't decrypt balances, can't forge proofs

3. **Smart Contract Exploit** - Verifier could have bugs
   - ⚠️ Mitigation: Formal verification needed (future work)

### Trust Assumptions
- ✅ User trusts their own browser (proof generation)
- ✅ User trusts the Noir circuit logic (open source)
- ✅ User trusts the cryptography (ElGamal on BabyJub)
- ⚠️ User must trust backend won't censor (can self-host)
