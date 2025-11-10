'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useWalletStore } from '../lib/store/walletStore';
import { removePrivateKey } from '../lib/utils/privateKeyStorage';
import { isMobile, isMetaMaskInstalled, openMetaMaskMobile, isInMetaMaskBrowser } from '../lib/utils/mobile';
import type { Address } from 'viem';

export function useWallet() {
  const [error, setError] = useState<string | null>(null);

  const { address: metamaskAddress, isConnected: isMetamaskConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect: disconnectWagmi } = useDisconnect();

  const {
    address: storedAddress,
    publicKey,
    privateKey,
    setAddress,
    clearWallet,
  } = useWalletStore();

  // Don't generate keys automatically - keys are only created when user registers
  // The backend generates keys using GrumpkinScalar/Schnorr during registration

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
   * Handles both desktop (extension) and mobile (app) scenarios
   */
  const connectWallet = async () => {
    setError(null);
    
    // Check if we're on mobile
    const onMobile = isMobile();
    const hasMetaMask = isMetaMaskInstalled();
    const inMetaMaskBrowser = isInMetaMaskBrowser();
    
    // On mobile, if not in MetaMask browser and no ethereum provider
    if (onMobile && !inMetaMaskBrowser && !hasMetaMask) {
      // Try to open MetaMask app via deep link
      try {
        openMetaMaskMobile();
        // Don't set error here - the deep link will handle navigation
        // User will see instructions if they come back
        return;
      } catch (err: any) {
        setError('Please open this site in MetaMask\'s in-app browser. Tap the menu (☰) in MetaMask and select "Browser", then navigate to this site.');
        return;
      }
    }
    
    // Try to find injected connector (works on desktop or in MetaMask mobile browser)
    const injectedConnector = connectors.find((c) => c.id === 'injected' || c.name === 'MetaMask');
    
    if (!injectedConnector) {
      if (onMobile) {
        setError('Please open this site in MetaMask\'s in-app browser. Tap the menu (☰) in MetaMask and select "Browser".');
      } else {
        setError('MetaMask not found. Please install MetaMask extension.');
      }
      return;
    }

    try {
      connect({ connector: injectedConnector });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Connection error:', err);
    }
  };

  // Use MetaMask address if connected, otherwise use stored address
  const address = isMetamaskConnected && metamaskAddress ? metamaskAddress : storedAddress;

  /**
   * Disconnect wallet
   */
  const disconnect = () => {
    // Clear private key from localStorage before disconnecting
    if (address) {
      removePrivateKey(address);
    }
    disconnectWagmi();
    clearWallet();
    setError(null);
    // Clear username from localStorage when wallet disconnects
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zk-wallet-username');
      window.dispatchEvent(new Event('username-storage-changed'));
    }
  };
  // User is connected if MetaMask is connected and address exists
  // Public key is only required after registration (handled by useUser hook)
  const isConnected = isMetamaskConnected && !!address;

  return {
    address: address as Address | null,
    publicKey,
    privateKey,
    isConnected,
    isConnecting,
    error,
    connectWallet,
    disconnect,
  };
}