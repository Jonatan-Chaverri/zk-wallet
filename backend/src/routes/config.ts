import express from 'express';
import { Address, createPublicClient, http, parseAbi } from 'viem';
import { getArbitrumChain, getChainId } from '../utils/chain';

const router = express.Router();

// ConfidentialERC20 ABI
const confidentialERC20Abi = parseAbi([
  'function balance_of_enc(address token, address user) view returns (bytes32 x1, bytes32 x2)',
]);

/**
 * GET /api/config
 * Get application configuration (contract addresses, chain ID, etc.)
 */
router.get('/', (req, res) => {
  const config = {
    chainId: getChainId(getArbitrumChain()),
    rpcUrl: process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    confidentialERC20: process.env.CONFIDENTIAL_ERC20 || '',
    defaultWalletAddress: process.env.DEFAULT_WALLET_ADDRESS || '',
  };

  res.json({
    success: true,
    config,
  });
});

/**
 * GET /api/config/balance
 * Get encrypted balance for a user
 */
router.get('/balance', async (req, res, next) => {
  try {
    const { token, user } = req.query;

    if (!token || !user) {
      return res.status(400).json({
        error: 'Missing required query parameters: token, user',
      });
    }

    const confidentialERC20 = process.env.CONFIDENTIAL_ERC20 as Address | undefined;
    if (!confidentialERC20) {
      return res.status(500).json({
        error: 'CONFIDENTIAL_ERC20 not configured',
      });
    }

    const chain = getArbitrumChain();
    const publicClient = createPublicClient({
      chain,
      transport: http(process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
    });

    const result = await publicClient.readContract({
      address: confidentialERC20,
      abi: confidentialERC20Abi,
      functionName: 'balance_of_enc',
      args: [token as Address, user as Address],
    });

    res.json({
      success: true,
      balance: {
        x1: `0x${result[0].replace('0x', '').padStart(64, '0')}`,
        x2: `0x${result[1].replace('0x', '').padStart(64, '0')}`,
      },
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

