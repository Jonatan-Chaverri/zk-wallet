import express from 'express';
import { deployUserWallet, registerUserPublicKey } from '../services/walletService';
import { DeployWalletRequest, RegisterPublicKeyRequest } from '../types';

const router = express.Router();

/**
 * POST /api/wallet/deploy
 * Deploy a new UserWallet contract
 */
router.post('/deploy', async (req, res, next) => {
  try {
    // Note: owner and confidentialERC20 are no longer required in request body
    // owner is generated, confidentialERC20 comes from env
    const params: DeployWalletRequest = req.body;

    const result = await deployUserWallet(params);

    res.json({
      success: true,
      walletAddress: result.walletAddress,
      userPrivateKey: result.userPrivateKey,
      userPublicKey: result.userPublicKey,
      ownerAddress: result.ownerAddress,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/wallet/register-pk
 * Register user's public key in ConfidentialERC20
 */
router.post('/register-pk', async (req, res, next) => {
  try {
    const params: RegisterPublicKeyRequest = req.body;

    // Validate required fields
    if (!params.confidentialERC20 || !params.userWalletAddress || !params.publicKey) {
      return res.status(400).json({
        error: 'Missing required fields: confidentialERC20, userWalletAddress, publicKey',
      });
    }

    const txHash = await registerUserPublicKey(params);

    res.json({
      success: true,
      txHash,
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

