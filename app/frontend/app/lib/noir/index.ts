// Noir proof generation integration
// This bridges the application's interface with the actual Noir circuits

import {
  generateDepositProof as generateDepositProofInternal,
  generateWithdrawProof as generateWithdrawProofInternal,
  generateTransferProof as generateTransferProofInternal,
  generateRandomness,
  type DepositParams,
  type WithdrawParams,
  type TransferParams,
} from './proofGeneration';
import { getTestAccount } from './testData';

/**
 * Generate ZK proof for deposit
 *
 * For development: Uses test account data
 * For production: Replace with real user's private key and encrypted balance
 */
export async function generateDepositProof(params: {
  oldBalance: string; // Currently unused - using test data
  depositAmount: bigint;
  newBalance: string; // Currently unused - circuit computes this
  publicKey: string; // Currently unused - using test data
  chainId: bigint; // Currently unused
  contractAddress: string; // Used as sender address
}): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  console.log('[Proof] Starting deposit proof generation...');

  // For development: Use test account
  // TODO: Replace with real user data from wallet
  const testAccount = getTestAccount('alice');

  // Prepare circuit inputs
  const circuitParams: DepositParams = {
    // Private inputs (secrets)
    senderPrivKey: testAccount.privateKey,
    currentBalance: testAccount.balance,
    randomness: generateRandomness(),

    // Public inputs
    senderPubkey: testAccount.publicKey,
    oldBalanceX1: testAccount.encryptedBalance.x1,
    oldBalanceX2: testAccount.encryptedBalance.x2,
    senderAddress: params.contractAddress,
    token: '0x0000000000000000000000000000000000000000', // TODO: Use actual token address
    amount: params.depositAmount.toString(),
  };

  // Generate proof using Noir circuit
  const result = await generateDepositProofInternal(circuitParams);

  console.log('[Proof] Deposit proof generated successfully!');
  return result;
}

/**
 * Generate ZK proof for transfer
 *
 * For development: Uses test account data
 * For production: Replace with real user's private key and encrypted balances
 */
export async function generateTransferProof(params: {
  fromOldBalance: string;
  toOldBalance: string;
  amount: bigint;
  fromNewBalance: string;
  toNewBalance: string;
  fromPublicKey: string;
  toPublicKey: string;
  chainId: bigint;
  contractAddress: string;
}): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  console.log('[Proof] Starting transfer proof generation...');

  // For development: Use test account as sender
  const senderAccount = getTestAccount('alice');

  // TODO: Get actual receiver data
  // For now, using sender as receiver for testing
  const receiverAccount = senderAccount;

  const circuitParams: TransferParams = {
    // Private inputs
    senderPrivKey: senderAccount.privateKey,
    senderCurrentBalance: senderAccount.balance,
    transferAmount: params.amount.toString(),
    randomnessSender: generateRandomness(),
    randomnessReceiver: generateRandomness(),

    // Public inputs
    receiverAddress: params.contractAddress, // TODO: Use actual receiver address
    receiverPubkey: receiverAccount.publicKey,
    receiverOldBalanceX1: receiverAccount.encryptedBalance.x1,
    receiverOldBalanceX2: receiverAccount.encryptedBalance.x2,
    senderPubkey: senderAccount.publicKey,
    senderOldBalanceX1: senderAccount.encryptedBalance.x1,
    senderOldBalanceX2: senderAccount.encryptedBalance.x2,
    token: '0x0000000000000000000000000000000000000000',
  };

  const result = await generateTransferProofInternal(circuitParams);

  console.log('[Proof] Transfer proof generated successfully!');
  return result;
}

/**
 * Generate ZK proof for withdrawal
 *
 * For development: Uses test account data
 * For production: Replace with real user's private key and encrypted balance
 */
export async function generateWithdrawProof(params: {
  oldBalance: string;
  amount: bigint;
  newBalance: string;
  publicKey: string;
  chainId: bigint;
  contractAddress: string;
}): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  console.log('[Proof] Starting withdraw proof generation...');

  // For development: Use test account
  const testAccount = getTestAccount('alice');

  const circuitParams: WithdrawParams = {
    // Private inputs
    senderPrivKey: testAccount.privateKey,
    currentBalance: testAccount.balance,
    randomness: generateRandomness(),

    // Public inputs
    senderPubkey: testAccount.publicKey,
    oldBalanceX1: testAccount.encryptedBalance.x1,
    oldBalanceX2: testAccount.encryptedBalance.x2,
    senderAddress: params.contractAddress,
    token: '0x0000000000000000000000000000000000000000',
    amount: params.amount.toString(),
  };

  const result = await generateWithdrawProofInternal(circuitParams);

  console.log('[Proof] Withdraw proof generated successfully!');
  return result;
}
