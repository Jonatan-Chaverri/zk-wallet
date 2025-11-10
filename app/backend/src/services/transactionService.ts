import { Address, createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DepositRequest, TransferRequest, WithdrawRequest } from '../types';
import { getArbitrumChain } from '../utils/chain';

// UserWallet ABI
const userWalletAbi = parseAbi([
  'function deposit_private(address token, uint256 amount, bytes32 new_balance_x1, bytes32 new_balance_x2, address to, bytes proof_inputs, bytes proof)',
  'function transfer_private(address token, address to, bytes32 new_from_x1, bytes32 new_from_x2, bytes32 new_to_x1, bytes32 new_to_x2, bytes proof_inputs, bytes proof)',
  'function withdraw_private(address token, address to, bytes32 new_from_x1, bytes32 new_from_x2, bytes proof_inputs, bytes proof)',
]);

/**
 * Get the deployment wallet client
 */
function getDeploymentWallet() {
  const privateKey = process.env.DEFAULT_WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('DEFAULT_WALLET_PRIVATE_KEY not configured in environment variables');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = getArbitrumChain();
  const rpcUrl = process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { walletClient, publicClient };
}

/**
 * Submit a deposit transaction
 */
export async function submitDeposit(params: DepositRequest): Promise<string> {
  const { walletClient } = getDeploymentWallet();

  const calldata = encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'deposit_private',
    args: [
      params.tokenAddress,
      BigInt(params.amount),
      params.newBalance.x1 as `0x${string}`,
      params.newBalance.x2 as `0x${string}`,
      params.to,
      params.proofInputs as `0x${string}`,
      params.proof as `0x${string}`,
    ],
  });

  const hash = await walletClient.sendTransaction({
    to: params.userWalletAddress,
    data: calldata,
  });

  return hash;
}

/**
 * Submit a transfer transaction
 */
export async function submitTransfer(params: TransferRequest): Promise<string> {
  const { walletClient } = getDeploymentWallet();

  const calldata = encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'transfer_private',
    args: [
      params.tokenAddress,
      params.recipient,
      params.fromNewBalance.x1 as `0x${string}`,
      params.fromNewBalance.x2 as `0x${string}`,
      params.toNewBalance.x1 as `0x${string}`,
      params.toNewBalance.x2 as `0x${string}`,
      params.proofInputs as `0x${string}`,
      params.proof as `0x${string}`,
    ],
  });

  const hash = await walletClient.sendTransaction({
    to: params.userWalletAddress,
    data: calldata,
  });

  return hash;
}

/**
 * Submit a withdraw transaction
 */
export async function submitWithdraw(params: WithdrawRequest): Promise<string> {
  const { walletClient } = getDeploymentWallet();

  const calldata = encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'withdraw_private',
    args: [
      params.tokenAddress,
      params.recipient,
      params.newBalance.x1 as `0x${string}`,
      params.newBalance.x2 as `0x${string}`,
      params.proofInputs as `0x${string}`,
      params.proof as `0x${string}`,
    ],
  });

  const hash = await walletClient.sendTransaction({
    to: params.userWalletAddress,
    data: calldata,
  });

  return hash;
}

