import { Address, encodeFunctionData, parseAbi, createPublicClient, http, createWalletClient, custom } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import type { Ciphertext, Proof } from '../types';

// UserWallet ABI (generated from Stylus contract)
export const userWalletAbi = parseAbi([
  'function init(address owner, address entry_point, address conf_erc20)',
  'function deposit_private(address token, uint256 amount, bytes32 new_balance_x1, bytes32 new_balance_x2, address to)',
  'function transfer_private(address token, address to, bytes32 new_from_x1, bytes32 new_from_x2, bytes32 new_to_x1, bytes32 new_to_x2, bytes proof_inputs, bytes proof)',
  'function withdraw_private(address token, address to, bytes32 new_from_x1, bytes32 new_from_x2, bytes proof_inputs, bytes proof)',
  'function get_owner() view returns (address)',
  'function get_entry_point() view returns (address)',
  'function get_confidential_erc20() view returns (address)',
  'function get_nonce() view returns (uint256)',
  'function set_owner(address new_owner)',
  'function set_entry_point(address new_entry)',
  'function set_confidential_erc20(address new_conf)',
  'function get_audit_pubkey() view returns (bytes)',
  'function set_audit_pubkey(bytes pk)',
]);

const chain = arbitrumSepolia;

/**
 * @deprecated Use apiClient.getConfig() and createPublicClient directly if needed
 * This function is kept for backward compatibility but should not be used
 */
export function createClient() {
  // This should not be used - RPC URL should come from backend config
  console.warn('createClient() is deprecated. Use apiClient for backend interactions.');
  
  return createPublicClient({
    chain,
    transport: http('https://sepolia-rollup.arbitrum.io/rpc'), // Default fallback
  });
}

export function createWallet() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not connected');
  }

  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });
}

export function encodeDepositPrivate(
  token: Address,
  amount: bigint,
  newBalance: Ciphertext,
  to: Address
) {
  return encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'deposit_private',
    args: [
      token,
      amount,
      newBalance.x1 as `0x${string}`,
      newBalance.x2 as `0x${string}`,
      to,
    ],
  });
}

export function encodeTransferPrivate(
  token: Address,
  to: Address,
  newFromBalance: Ciphertext,
  newToBalance: Ciphertext,
  proofInputs: string,
  proof: string
) {
  return encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'transfer_private',
    args: [
      token,
      to,
      newFromBalance.x1 as `0x${string}`,
      newFromBalance.x2 as `0x${string}`,
      newToBalance.x1 as `0x${string}`,
      newToBalance.x2 as `0x${string}`,
      proofInputs as `0x${string}`,
      proof as `0x${string}`,
    ],
  });
}

export function encodeWithdrawPrivate(
  token: Address,
  to: Address,
  newFromBalance: Ciphertext,
  proofInputs: string,
  proof: string
) {
  return encodeFunctionData({
    abi: userWalletAbi,
    functionName: 'withdraw_private',
    args: [
      token,
      to,
      newFromBalance.x1 as `0x${string}`,
      newFromBalance.x2 as `0x${string}`,
      proofInputs as `0x${string}`,
      proof as `0x${string}`,
    ],
  });
}
