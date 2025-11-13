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
│  │  │   Wallet UI  │  │  Proof Gen   │  │   Supabase   │             │     │
│  │  │   (Nextjs)    │  │  (NoirJS)   │  │ (Public Keys)│             │     │
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
│                               │ Proof (6,976 bytes) + Public Inputs          │
│                               │                                              │
│                               │ Direct RPC Call (viem/wagmi)                 │
│                               │ User signs transaction in browser            │
│                               ▼                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Transaction to ConfidentialERC20
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARBITRUM SEPOLIA TESTNET                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              CONFIDENTIAL ERC20 (Main Contract)                      │   │
│  │                  (Arbitrum Stylus WASM)                              │   │
│  │                                                                       │   │
│  │  Receives transactions from frontend:                                │   │
│  │  • deposit(proof, publicInputs)                                  │   │
│  │  • transfer(proof, publicInputs)                                 │   │
│  │  • withdraw(proof, publicInputs)                                 │   │
│  │                                                                       │   │
│  │  Stores:                                                             │   │
│  │  • User public keys (Grumpkin)                                        │   │
│  │  • Encrypted balances (ElGamal ciphertexts)                          │   │
│  │  • Token custody                                                     │   │
│  │                                                                       │   │
│  │  Then calls appropriate verifier ──────────────┐                     │   │
│  └────────────────────────────────────────────────┼──────────────────────┘   │
│                                                   │                          │
│  ┌────────────────────────────────────────────────┼──────────────────────┐   │
│  │                 VERIFIER CONTRACTS             ▼                      │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  DepositVerifier.sol  (92KB)                               │     │   │
│  │  │  Address: 0xC43C243E2e1667Af1c3d36Df8e4d76B302642970      │     │   │
│  │  │  • Verifies deposit proofs (6,976 bytes)                   │     │   │
│  │  │  • Called by ConfidentialERC20                             │     │   │
│  │  │  • Returns: proof valid ✅ or invalid ❌                    │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  WithdrawVerifier.sol (92KB)                               │     │   │
│  │  │  Address: 0x59b1800deDB9AeC940E96F78B650DCDCeA1F5449      │     │   │
│  │  │  • Verifies withdraw proofs (6,976 bytes)                  │     │   │
│  │  │  • Called by ConfidentialERC20                             │     │   │
│  │  │  • Returns: proof valid ✅ or invalid ❌                    │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │  TransferVerifier.sol (92KB)                               │     │   │
│  │  │  Address: 0xe17d3034062113d1eD4526A8C58f60645E6f5f6a      │     │   │
│  │  │  • Verifies transfer proofs (6,976 bytes)                  │     │   │
│  │  │  • Called by ConfidentialERC20                             │     │   │
│  │  │  • Uses homomorphic addition validation                    │     │   │
│  │  │  • Returns: proof valid ✅ or invalid ❌                    │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
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
│                                                      │
│  Inputs (Private):                                   │
│  • sender_priv_key: 42                               │
│  • r_new_balance: 222 (fresh randomness)             │
│                                                      │
│  Inputs (Public):                                    │
│  • sender_address: 1                                 │
│  • sender_pubkey: {...} (from private key)           │
│  • old_balance_ct: {...} (current encrypted balance) │
│  • token: 0x...                                      │
│  • amount: 1000                                      │
│                                                      │
│  Circuit Execution:                                  │
│  1. Verify sender owns private key                   │
│  2. Encrypt new amount                               │
│  3. Compute new_balance = 500 + 1000 = 1500          │
│  4. Encrypt new_balance with fresh randomness        │
│  5. Generate proof (~2 seconds)                      │
│                                                      │
│  Output:                                             │
│  • Proof: 6,976 bytes                                │
│  • new_balance_ct: Enc(1500)                         │
│  • revealed_amount: 1000 (for custody)               │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 2. DIRECT CALL to Arbitrum (viem/wagmi)
                        │    User signs transaction in browser
                        │    ConfidentialERC20.deposit(proof, publicInputs, 1000)
                        ▼
┌──────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 (Stylus WASM)         │
│                                                       │
│  1. Receive deposit transaction from user            │
│  2. Extract proof and public inputs                  │
│  3. Call DepositVerifier.verify(proof, publicInputs) │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 3. Verifier called internally
                        ▼
┌──────────────────────────────────────────────────────┐
│         ARBITRUM: DepositVerifier.sol                │
│        (0xC43C243E2e1667Af1c3d36Df8e4d76B302642970)  │
│                                                      │
│  1. Verify proof (6,976 bytes) with UltraHonk        │
│  2. Check public inputs match                        │
│  3. Return: proof valid ✅ or invalid ❌            │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 4. If proof valid ✅
                        ▼
┌──────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 continues             │
│                                                      │
│  4. Transfer 1000 tokens from user to contract       │
│  5. Update on-chain encrypted balance:               │
│     old_balance_ct → new_balance_ct (Enc(1500))      │
│                                                      │
│  ✅ Transaction succeeds                             │
│  📊 New encrypted balance stored on-chain            │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 5. Transaction receipt (tx_hash)
                        │
                        ┴
                        │
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
│                                                                  │
│  Inputs (Private):                                               │
│  • sender_priv_key: 42                                           │
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
│  2. Encrypt sender's old balance, verify it matches              │
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
                        │ 2. DIRECT CALL to Arbitrum (viem/wagmi)
                        │    User signs transaction in browser
                        │    ConfidentialERC20.transfer(proof, publicInputs, recipient)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 (Stylus WASM)                     │
│                                                                   │
│  1. Receive transfer transaction from sender                     │
│  2. Extract proof and public inputs                              │
│  3. Call TransferVerifier.verify(proof, publicInputs)            │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ 3. Verifier called internally
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│         ARBITRUM: TransferVerifier.sol                           │
│         (0xe17d3034062113d1eD4526A8C58f60645E6f5f6a)             │
│                                                                   │
│  1. Verify proof (6,976 bytes) with UltraHonk                    │
│  2. Validate homomorphic addition correctness                    │
│  3. Return: proof valid ✅ or invalid ❌                          │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ 4. If proof valid ✅
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 continues                         │
│                                                                   │
│  4. Update both encrypted balances atomically:                   │
│     • Sender:   Enc(1500) → Enc(1000)                            │
│     • Receiver: Enc(300)  → Enc(800)                             │
│                                                                   │
│  ✅ No tokens move (already in contract custody)                 │
│  ✅ Both balances updated privately on-chain                     │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ 5. Transaction receipt (tx_hash)
                        │
       ┌────────────────┴─────────────────┐
       ▼                                  ▼
┌─────────────┐ 
│  SENDER     │
│  Balance:   │
│  Enc(1000)  │
│  sender     │
│  can        │                    ┌─────────────┐
│  decrypt)   │                    │  RECEIVER   │
└─────────────┘                    │  Balance:   │
                                   │  Enc(800)   │
                                   │  (only      │
                                   │  receiver   │
                                   │  can        │
                                   │  decrypt)   │
                                   └─────────────┘
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
│                                                      │
│  Inputs (Private):                                   │
│  • sender_priv_key: 42                               │                              │
│  • r_new_balance: 555 (fresh randomness)             │
│                                                      │
│  Inputs (Public):                                    │
│  • sender_address, sender_pubkey                     │
│  • old_balance_ct: Enc(1000)                         │
│  • token: 1                                          │
│                                                      │
│  Circuit Execution:                                  │
│  1. Verify sender owns private key                   │
│  2. Encrypt old balance, verify it matches           │
│  3. Check sufficient balance: 1000 >= 400✅         │
│  4. Compute new_balance = 1000 - 400 = 600           │
│  5. Encrypt new_balance with fresh randomness        │
│  6. Generate proof (~2 seconds)                      │
│                                                      │
│  Output:                                             │
│  • Proof: 6,976 bytes                                │
│  • new_balance_ct: Enc(600)                          │
│  • revealed_amount: 400 (to release)                 │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 2. DIRECT CALL to Arbitrum (viem/wagmi)
                        │    User signs transaction in browser
                        │    ConfidentialERC20.withdraw(proof, publicInputs, 400)
                        ▼
┌──────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 (Stylus WASM)         │
│                                                       │
│  1. Receive withdraw transaction from user           │
│  2. Extract proof and public inputs                  │
│  3. Call WithdrawVerifier.verify(proof, publicInputs)│
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 3. Verifier called internally
                        ▼
┌──────────────────────────────────────────────────────┐
│         ARBITRUM: WithdrawVerifier.sol               │
│         (0x59b1800deDB9AeC940E96F78B650DCDCeA1F5449)  │
│                                                       │
│  1. Verify proof (6,976 bytes) with UltraHonk        │
│  2. Check public inputs match                        │
│  3. Return: proof valid ✅ or invalid ❌              │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 4. If proof valid ✅
                        ▼
┌──────────────────────────────────────────────────────┐
│    ARBITRUM: ConfidentialERC20 continues             │
│                                                       │
│  4. Update encrypted balance:                        │
│     Enc(1000) → Enc(600)                             │
│  5. Transfer 400 tokens from contract to user        │
│                                                       │
│  ✅ Tokens released from contract custody            │
│  ✅ New encrypted balance stored on-chain            │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ 6. Transaction receipt (tx_hash)
                        │
                        ┴
                        │
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
- ❌ **Private keys** - Never leave the browser
- ❌ **Actual balance values** - Only encrypted ciphertexts visible

### What's Public
- ✅ **Transaction sender address** - User signs transaction in browser, visible on-chain
- ✅ **Encrypted balance ciphertexts** - (unreadable without private key)
- ✅ **Proof verification** - Anyone can verify proofs are valid
- ✅ **Transaction occurred** - But not the amount
- ✅ **Gas paid by user** - User pays gas for their own transactions
- ✅ **Receiver address** - Visible in transfer transactions

---

## Transaction Logging & Database

**Recent Addition (PR #24):** The system now includes **optional** transaction logging to the database for audit trails and user transaction history.

**Important:** Transaction logging is done AFTER the transaction succeeds on-chain. The backend is NOT involved in the transaction submission flow.

### Transaction Logging Flow (Post-Transaction)

```
┌────────────────────────────────────────────────────────┐
│              FRONTEND: After Blockchain TX             │
│                                                         │
│  1. User transaction succeeds on Arbitrum              │
│  2. Frontend receives tx_hash from blockchain          │
│  3. OPTIONAL: Log to backend for audit trail           │
│  4. Call apiClient.registerTransaction({               │
│       tx_hash: "0x...",                                │
│       type: "DEPOSIT" | "TRANSFER" | "WITHDRAW",       │
│       token: "0x...",                                  │
│       amount: "1000",                                  │
│       sender_address: "0x...",                         │
│       receiver_address: "0x..." (for transfers)        │
│     })                                                 │
│                                                         │
│  Note: This is for logging only, NOT for relaying TX   │
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
│  4. Store in PostgreSQL (audit trail):                 │
│     • tx_hash (unique, lowercase)                      │
│     • type (deposit/transfer/withdraw)                 │
│     • status (default: "confirmed")                    │
│     • token, amount, addresses                         │
│     • contract_id, created_at                          │
│                                                         │
│  Returns: { success: true, transaction: {...} }        │
│                                                         │
│  ⚠️ Backend does NOT submit transactions to Arbitrum!  │
│  Transactions are submitted directly from frontend.    │
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
│    where G = Grumpkin generator point                           │
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

**Note:** Backend is used for configuration, user management, and logging ONLY.
Transactions are submitted directly from frontend to Arbitrum!

```
Express Server (port 3001)
    │
    │ Configuration & Info:
    ├─> GET  /api/config                   - Get app configuration
    ├─> GET  /api/config/balance           - Query encrypted balance
    ├─> GET  /api/tokens                   - Get available tokens
    │
    │ User Management:
    ├─> GET  /api/getUser                  - Get user by address/username
    ├─> POST /api/register                 - Register new user
    ├─> POST /api/deleteUser               - Delete user
    │
    │ Transaction Logging (Post-TX):
    └─> POST /api/transaction              - Log completed transaction
         │
         └──> Supabase (PostgreSQL) - User data & transaction logs

⚠️ REMOVED Endpoints (transactions now direct from frontend):
   ❌ /api/wallet/deploy
   ❌ /api/wallet/register-pk
   ❌ /api/transaction/deposit
   ❌ /api/transaction/transfer
   ❌ /api/transaction/withdraw
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
   - ⚠️ Exposed: Sender address, receiver address, transaction timing

2. **Malicious Backend** - Backend database could be compromised
   - ✅ Protected: Backend has NO control over transactions
   - ✅ Protected: Backend cannot decrypt balances or forge proofs
   - ⚠️ Risk: Transaction logs in database reveal transaction patterns (if logged)

3. **Smart Contract Exploit** - Verifier or ConfidentialERC20 could have bugs
   - ⚠️ Mitigation: Formal verification needed (future work)
   - ⚠️ Risk: Incorrect balance updates, unauthorized withdrawals

4. **Browser Compromise** - User's browser or wallet could be hacked
   - ❌ No protection: Private keys stored in browser
   - ❌ No protection: Proofs generated client-side

### Trust Assumptions
- ✅ User trusts their own browser (proof generation, key storage)
- ✅ User trusts the Noir circuit logic (open source, auditable)
- ✅ User trusts the cryptography (ElGamal on Grumpkin, UltraHonk)
- ✅ User trusts Arbitrum network (transactions submitted directly)
- ✅ User trusts deployed smart contracts (ConfidentialERC20, verifiers)
- ⚠️ **NO trust required in backend** - Backend is optional (only for logging/config)

### Key Security Properties
- **Non-custodial**: Users control their own keys and sign their own transactions
- **Censorship resistant**: Transactions sent directly to Arbitrum (no intermediary)
- **Amount privacy**: All amounts encrypted with ElGamal homomorphic encryption
- **Verifiable**: All operations proven with zero-knowledge proofs
- **Auditable**: Transaction logs can be kept (optionally) for compliance
