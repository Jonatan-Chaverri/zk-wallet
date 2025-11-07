'use client';

import { useState } from 'react';
import { useWalletStore } from '../lib/store/walletStore';
import { generateBabyJubKeyPair } from '../lib/utils/crypto';
import { deployUserWallet, registerUserPublicKey } from '../lib/utils/walletDeployment';
import { apiClient } from '../lib/utils/api';
import type { Address } from 'viem';

export function useWallet() {
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    address,
    publicKey,
    privateKey,
    setAddress,
    setKeyPair,
    clearWallet,
  } = useWalletStore();

  /**
   * Create a new wallet (deploy UserWallet contract)
   */
  const createWallet = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Generate BabyJub key pair for the user
      const keyPair = await generateBabyJubKeyPair();
      setKeyPair(keyPair);

      // Get contract addresses from backend API
      const config = await apiClient.getConfig();
      const confidentialERC20 = config.confidentialERC20 as Address | undefined;

      if (!confidentialERC20) {
        throw new Error('Contract addresses not configured in backend');
      }

      // Use the deployment wallet as the owner
      const ownerAddress = config.defaultWalletAddress as Address;

      if (!ownerAddress) {
        throw new Error('Default wallet address not configured in backend');
      }

      // Deploy UserWallet contract
      const walletAddress = await deployUserWallet({
        owner: ownerAddress,
        confidentialERC20,
      });

      setAddress(walletAddress);

      // Register public key in ConfidentialERC20
      setIsRegistering(true);
      await registerUserPublicKey(
        confidentialERC20,
        walletAddress,
        keyPair.publicKey
      );
      setIsRegistering(false);

      return walletAddress;
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
      console.error('Wallet creation error:', err);
      throw err;
    } finally {
      setIsCreating(false);
      setIsRegistering(false);
    }
  };

  /**
   * Load existing wallet from storage
   */
  const loadWallet = () => {
    // Wallet is loaded from Zustand store automatically
    return address;
  };

  /**
   * Clear wallet (logout)
   */
  const disconnect = () => {
    clearWallet();
    setError(null);
  };

  return {
    address,
    publicKey,
    privateKey,
    isConnected: !!address,
    isCreating,
    isRegistering,
    error,
    createWallet,
    loadWallet,
    disconnect,
  };
}