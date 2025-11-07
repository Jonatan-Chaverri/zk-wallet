'use client';

import { useMemo, useState, useEffect } from 'react';
import { Address, createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { apiClient } from '../lib/utils/api';
import { useWallet } from './useWallet';

export function useContracts() {
  const { address } = useWallet();
  const [config, setConfig] = useState<{
    confidentialERC20: Address | undefined;
    rpcUrl: string;
  } | null>(null);

  // Fetch config from backend on mount
  useEffect(() => {
    apiClient.getConfig().then((cfg) => {
      setConfig({
        confidentialERC20: cfg.confidentialERC20 as Address | undefined,
        rpcUrl: cfg.rpcUrl,
      });
    }).catch((err) => {
      console.error('Failed to fetch config from backend:', err);
    });
  }, []);

  const contracts = useMemo(() => {
    // Use the user's deployed wallet address (from store)
    const userWalletAddress = address as Address | undefined;

    return {
      userWallet: userWalletAddress, // User's deployed wallet
      confidentialERC20: config?.confidentialERC20,
    };
  }, [address, config]);

  const publicClient = useMemo(() => {
    const rpcUrl = config?.rpcUrl || 'https://sepolia-rollup.arbitrum.io/rpc';
    return createPublicClient({
      chain: arbitrumSepolia,
      transport: http(rpcUrl),
    });
  }, [config]);

  const fetchEncryptedBalance = async (token: Address) => {
    if (!address) {
      throw new Error('Wallet not created');
    }

    // Use backend API to fetch encrypted balance
    return apiClient.getEncryptedBalance(token, address);
  };

  return {
    ...contracts,
    publicClient,
    fetchEncryptedBalance,
    isConfigured: !!contracts.userWallet && !!config?.confidentialERC20,
  };
}
