import { Address, encodeFunctionData, parseAbi, createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import type { Ciphertext, Proof } from '../types';

// ConfidentialERC20 ABI (generated from Stylus contract)
export const confidentialERC20Abi = parseAbi([
  'function init(address verifier, uint256 chain_id)',
  'function register_user_pk(bytes pk)',
  'function deposit(address token, uint256 amount, bytes32[2] new_balance_ct, address to)',
  'function withdraw(address token, address to, bytes32[2] new_from_ct, bytes proof_inputs, bytes proof)',
  'function transfer_confidential(address token, address to, bytes32[2] new_from_ct, bytes32[2] new_to_ct, bytes proof_inputs, bytes proof)',
  'function balance_of_enc(address token, address user) view returns (bytes32 x1, bytes32 x2)',
  'function get_verifier() view returns (address)',
  'function get_owner() view returns (address)',
  'function is_supported_token(address token) view returns (bool)',
  'event Deposit(address indexed token, address indexed from, address indexed to, uint256 plain_amount, bytes c_balance_new)',
  'event Withdraw(address indexed token, address indexed from, address indexed to, uint256 plain_amount, bytes c_balance_new)',
  'event TransferConfidential(address indexed token, address indexed from, address indexed to, bytes c_from_new, bytes c_to_new)',
  'event UserPkRegistered(address indexed user, bytes pk)',
]);

const chain = arbitrumSepolia;

/**
 * @deprecated Use apiClient.getEncryptedBalance() instead
 * This function is kept for backward compatibility but should not be used
 */
export function createConfidentialERC20Client() {
  console.warn('createConfidentialERC20Client() is deprecated. Use apiClient for backend interactions.');
  
  return createPublicClient({
    chain,
    transport: http('https://sepolia-rollup.arbitrum.io/rpc'), // Default fallback
  });
}

/**
 * @deprecated Use apiClient.getEncryptedBalance() instead
 * This function is kept for backward compatibility but should not be used
 */
export async function getEncryptedBalance(
  contractAddress: Address,
  token: Address,
  user: Address
): Promise<Ciphertext> {
  console.warn('getEncryptedBalance() is deprecated. Use apiClient.getEncryptedBalance() instead.');
  
  // This should not be used - use apiClient.getEncryptedBalance() instead
  throw new Error('getEncryptedBalance() is deprecated. Use apiClient.getEncryptedBalance() instead.');
}

export function encodeRegisterUserPk(pk: string) {
  return encodeFunctionData({
    abi: confidentialERC20Abi,
    functionName: 'register_user_pk',
    args: [pk as `0x${string}`],
  });
}

export function encodeDeposit(
  token: Address,
  amount: bigint,
  newBalance: Ciphertext,
  to: Address
) {
  return encodeFunctionData({
    abi: confidentialERC20Abi,
    functionName: 'deposit',
    args: [
      token,
      amount,
      [newBalance.x1 as `0x${string}`, newBalance.x2 as `0x${string}`],
      to,
    ],
  });
}
