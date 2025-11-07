import express from 'express';
import { submitDeposit, submitWithdraw } from '../services/transactionService';
import { DepositRequest, WithdrawRequest } from '../types';

const router = express.Router();

/**
 * POST /api/transaction/deposit
 * Submit a deposit transaction
 */
router.post('/deposit', async (req, res, next) => {
  try {
    const params: DepositRequest = req.body;

    // Validate required fields
    if (!params.userWalletAddress || !params.tokenAddress || !params.amount || !params.newBalance || !params.to || !params.proofInputs || !params.proof) {
      return res.status(400).json({
        error: 'Missing required fields: userWalletAddress, tokenAddress, amount, newBalance, to, proofInputs, proof',
      });
    }

    const txHash = await submitDeposit(params);

    res.json({
      success: true,
      txHash,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/transaction/withdraw
 * Submit a withdraw transaction
 */
router.post('/withdraw', async (req, res, next) => {
  try {
    const params: WithdrawRequest = req.body;

    // Validate required fields
    if (!params.userWalletAddress || !params.tokenAddress || !params.recipient || 
        !params.newBalance || !params.proofInputs || !params.proof) {
      return res.status(400).json({
        error: 'Missing required fields: userWalletAddress, tokenAddress, recipient, newBalance, proofInputs, proof',
      });
    }

    const txHash = await submitWithdraw(params);

    res.json({
      success: true,
      txHash,
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

