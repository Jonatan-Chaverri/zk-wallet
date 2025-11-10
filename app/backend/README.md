# ZK Wallet Backend API

Backend API server for handling blockchain interactions securely. All private keys and sensitive operations are kept on the server side.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the required values:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - `DEFAULT_WALLET_PRIVATE_KEY`: The private key for the deployment wallet (keep this secret!)
   - `RPC_URL`: Your Arbitrum Sepolia RPC endpoint
   - Contract addresses: `ENTRY_POINT`, `CONFIDENTIAL_ERC20`, `USER_WALLET_FACTORY`

## Development

Run the development server with hot reload:
```bash
npm run dev
```

## Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Endpoints

### Wallet Management

#### POST `/api/wallet/deploy`
Deploy a new UserWallet contract.

**Request Body:**
```json
{
  "owner": "0x...",
  "entryPoint": "0x...",
  "confidentialERC20": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "walletAddress": "0x..."
}
```

#### POST `/api/wallet/register-pk`
Register a user's public key in ConfidentialERC20.

**Request Body:**
```json
{
  "confidentialERC20": "0x...",
  "userWalletAddress": "0x...",
  "publicKey": {
    "x": "0x...",
    "y": "0x..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x..."
}
```

### Transactions

#### POST `/api/transaction/deposit`
Submit a deposit transaction.

**Request Body:**
```json
{
  "userWalletAddress": "0x...",
  "tokenAddress": "0x...",
  "amount": "1000000000000000000",
  "newBalance": {
    "x1": "0x...",
    "x2": "0x..."
  },
  "to": "0x..."
}
```

#### POST `/api/transaction/transfer`
Submit a transfer transaction.

**Request Body:**
```json
{
  "userWalletAddress": "0x...",
  "tokenAddress": "0x...",
  "recipient": "0x...",
  "fromNewBalance": {
    "x1": "0x...",
    "x2": "0x..."
  },
  "toNewBalance": {
    "x1": "0x...",
    "x2": "0x..."
  },
  "proofInputs": "0x...",
  "proof": "0x..."
}
```

#### POST `/api/transaction/withdraw`
Submit a withdraw transaction.

**Request Body:**
```json
{
  "userWalletAddress": "0x...",
  "tokenAddress": "0x...",
  "recipient": "0x...",
  "newBalance": {
    "x1": "0x...",
    "x2": "0x..."
  },
  "proofInputs": "0x...",
  "proof": "0x..."
}
```

## Security Notes

- **Never commit `.env` file to version control**
- Keep `DEFAULT_WALLET_PRIVATE_KEY` secure and never expose it
- Use environment variables for all sensitive configuration
- Consider using a hardware wallet or key management service in production

