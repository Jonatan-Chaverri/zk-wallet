'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useWalletStore } from '../lib/store/walletStore';
import { generateBabyJubKeyPair } from '../lib/utils/crypto';
import type { Address } from 'viem';

export function useWallet() {
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address: metamaskAddress, isConnected: isMetamaskConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect: disconnectWagmi } = useDisconnect();

  const {
    address: storedAddress,
    publicKey,
    privateKey,
    setAddress,
    setKeyPair,
    clearWallet,
  } = useWalletStore();

  // Generate BabyJub key pair when MetaMask connects
  useEffect(() => {
    if (isMetamaskConnected && metamaskAddress && !publicKey) {
      setIsGeneratingKeyPair(true);
      generateBabyJubKeyPair()
        .then((keyPair) => {
          setKeyPair(keyPair);
          setAddress(metamaskAddress);
        })
        .catch((err) => {
          setError(err.message || 'Failed to generate key pair');
          console.error('Key pair generation error:', err);
        })
        .finally(() => {
          setIsGeneratingKeyPair(false);
        });
    }
  }, [isMetamaskConnected, metamaskAddress, publicKey, setKeyPair, setAddress]);

  // Sync MetaMask address with store
  useEffect(() => {
    if (isMetamaskConnected && metamaskAddress) {
      setAddress(metamaskAddress);
    } else if (!isMetamaskConnected) {
      clearWallet();
    }
  }, [isMetamaskConnected, metamaskAddress, setAddress, clearWallet]);

  /**
   * Connect MetaMask wallet
   */
  const connectWallet = async () => {
    setError(null);
    const injectedConnector = connectors.find((c) => c.id === 'injected' || c.name === 'MetaMask');
    
    if (!injectedConnector) {
      setError('MetaMask not found. Please install MetaMask extension.');
      return;
    }

    try {
      connect({ connector: injectedConnector });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Connection error:', err);
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnect = () => {
    disconnectWagmi();
    clearWallet();
    setError(null);
    // Clear username from localStorage when wallet disconnects
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zk-wallet-username');
      window.dispatchEvent(new Event('username-storage-changed'));
    }
  };

  // Use MetaMask address if connected, otherwise use stored address
  const address = isMetamaskConnected && metamaskAddress ? metamaskAddress : storedAddress;
  const isConnected = isMetamaskConnected && !!address && !!publicKey;

  return {
    address: address as Address | null,
    publicKey,
    privateKey,
    isConnected,
    isConnecting: isConnecting || isGeneratingKeyPair,
    error,
    connectWallet,
    disconnect,
  };
}