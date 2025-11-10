# Quick Start Guide

Get the backend API server running quickly.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A wallet with private key for deployment (keep this secret!)

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
```bash
cp .env.example .env
```

3. **Configure `.env`:**
```env
# Required: Your deployment wallet private key (keep secret!)
DEFAULT_WALLET_PRIVATE_KEY=0x...

# Required: Your RPC endpoint
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Required: Contract addresses
ENTRY_POINT=0x...

# Optional: Wallet factory (if using factory pattern)
USER_WALLET_FACTORY=0x...

# Optional: CORS origin (default: http://localhost:3000)
CORS_ORIGIN=http://localhost:3000
```

4. **Start the server:**
```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3001` by default.

## Verify It's Working

Check the health endpoint:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

## Next Steps

- Update your frontend `.env` to include `NEXT_PUBLIC_API_URL=http://localhost:3001`
- The frontend will automatically use the backend API for all blockchain operations

## Troubleshooting

**Port already in use:**
- Change `PORT` in `.env` to a different port
- Update frontend `NEXT_PUBLIC_API_URL` accordingly

**CORS errors:**
- Ensure `CORS_ORIGIN` in backend `.env` matches your frontend URL
- Check that frontend is making requests to the correct backend URL

**Transaction failures:**
- Verify `DEFAULT_WALLET_PRIVATE_KEY` is correct
- Ensure the deployment wallet has sufficient funds for gas
- Check that `RPC_URL` is accessible and correct

