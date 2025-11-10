import { Address } from 'viem';
import { apiClient } from './api';
import type { BabyJubKeyPair } from '../types';

/**
 * Register user's public key in ConfidentialERC20
 * Now uses backend API to keep private keys secure
 */
export async function registerUserPublicKey(
  confidentialERC20Address: Address,
  userWalletAddress: Address,
  publicKey: BabyJubKeyPair['publicKey']
): Promise<string> {
  return apiClient.registerPublicKey({
    confidentialERC20: confidentialERC20Address,
    userWalletAddress,
    publicKey,
  });
}
