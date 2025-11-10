'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/utils/api';
import { useWalletStore } from '../lib/store/walletStore';
import { useConfidentialERC20 } from './useConfidentialERC20';
import { generateKeyBytes } from '../lib/utils/crypto';
import type { Address } from 'viem';

interface User {
  id: string;
  name: string;
  address: string;
  public_key_x: string | null;
  public_key_y: string | null;
  created_at: string;
}

const USERNAME_STORAGE_KEY = 'zk-wallet-username';

export function useUser(address: Address | null) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const { setKeyPair, setPublicKey, privateKey } = useWalletStore();
  const { registerUserPk, isConfigured: isContractConfigured } = useConfidentialERC20();

  // Load username from localStorage on mount (only on client after hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (storedUsername && address) {
      // If we have a stored username, set registered state optimistically
      setIsRegistered(true);
      setUser({
        id: '', // Will be updated when we fetch
        name: storedUsername,
        address: address,
        public_key_x: null,
        public_key_y: null,
        created_at: '',
      });
    }
  }, [address]);

  // Fetch user when address changes
  useEffect(() => {
    if (!address) {
      setUser(null);
      setIsRegistered(false);
      // Clear username from localStorage when address is cleared
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USERNAME_STORAGE_KEY);
        window.dispatchEvent(new Event('username-storage-changed'));
      }
      return;
    }

    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.getUser({ address });
        if (response.user) {
          setUser(response.user);
          setIsRegistered(true);
          
          // Store public key in wallet store if available
          if (response.user.public_key_x && response.user.public_key_y) {
            // If we have a private key, update the full key pair
            if (privateKey) {
              setKeyPair({
                privateKey,
                publicKey: {
                  x: response.user.public_key_x,
                  y: response.user.public_key_y,
                },
              });
            } else {
              // If no private key exists, just update the public key
              setPublicKey({
                x: response.user.public_key_x,
                y: response.user.public_key_y,
              });
            }
          }
          
          // Store username in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(USERNAME_STORAGE_KEY, response.user.name);
            window.dispatchEvent(new Event('username-storage-changed'));
          }
        } else {
          setUser(null);
          setIsRegistered(false);
          // Clear username from localStorage if user not found
          if (typeof window !== 'undefined') {
            localStorage.removeItem(USERNAME_STORAGE_KEY);
            window.dispatchEvent(new Event('username-storage-changed'));
          }
        }
      } catch (err: any) {
        // 404 means user is not registered, which is fine
        setUser(null);
        setIsRegistered(false);
        // Clear username from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(USERNAME_STORAGE_KEY);
          window.dispatchEvent(new Event('username-storage-changed'));
        }
        if (!err.message?.includes('404') && !err.message?.includes('not found')) {
          setError(err.message || 'Failed to fetch user');
          console.error('Error fetching user:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [address]);

  /**
   * Register a new user
   */
  const register = async (username: string): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.register({
        address,
        username,
      });
      
      const newUser = {
        id: response.user.id,
        name: response.user.username,
        address: response.user.address,
        public_key_x: response.publicKey.x,
        public_key_y: response.publicKey.y,
        created_at: response.user.created_at,
      };
      
      setUser(newUser);
      setIsRegistered(true);
      
      // Store public key in wallet store
      setKeyPair({
        privateKey: response.secret,
        publicKey: {
          x: response.publicKey.x,
          y: response.publicKey.y,
        },
      });
      
      // Store username in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(USERNAME_STORAGE_KEY, response.user.username);
        window.dispatchEvent(new Event('username-storage-changed'));
      }
      
      // Register public key in ConfidentialERC20 contract
      if (isContractConfigured) {
        try {
          // Convert public key (x, y) to Uint8Array using generateKeyBytes
          const publicKeyBytes = generateKeyBytes({
            x: response.publicKey.x,
            y: response.publicKey.y,
          });
          
          // Register the public key in the contract
          const txHash = await registerUserPk(publicKeyBytes);
          console.log('✅ Public key registered in contract. Tx hash:', txHash);
        } catch (contractError: any) {
          // Log error but don't fail the registration - user is still registered in backend
          console.error('⚠️ Failed to register public key in contract:', contractError);
          // Optionally, you could set a warning state here
        }
      } else {
        console.warn('⚠️ Contract not configured, skipping public key registration');
      }
      
      // Return the secret (client should store this securely)
      return response.secret;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to register user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh user data
   */
  const refresh = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getUser({ address });
      if (response.user) {
        setUser(response.user);
        setIsRegistered(true);
        
        // Store public key in wallet store if available
        if (response.user.public_key_x && response.user.public_key_y) {
          // If we have a private key, update the full key pair
          if (privateKey) {
            setKeyPair({
              privateKey,
              publicKey: {
                x: response.user.public_key_x,
                y: response.user.public_key_y,
              },
            });
          } else {
            // If no private key exists, just update the public key
            setPublicKey({
              x: response.user.public_key_x,
              y: response.user.public_key_y,
            });
          }
        }
        
        // Store username in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(USERNAME_STORAGE_KEY, response.user.name);
          window.dispatchEvent(new Event('username-storage-changed'));
        }
      } else {
        setUser(null);
        setIsRegistered(false);
        // Clear username from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(USERNAME_STORAGE_KEY);
          window.dispatchEvent(new Event('username-storage-changed'));
        }
      }
    } catch (err: any) {
      setUser(null);
      setIsRegistered(false);
      // Clear username from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USERNAME_STORAGE_KEY);
        window.dispatchEvent(new Event('username-storage-changed'));
      }
      if (!err.message?.includes('404') && !err.message?.includes('not found')) {
        setError(err.message || 'Failed to refresh user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear user data and localStorage
   */
  const clearUser = () => {
    setUser(null);
    setIsRegistered(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USERNAME_STORAGE_KEY);
      window.dispatchEvent(new Event('username-storage-changed'));
    }
  };

  return {
    user,
    isLoading,
    error,
    isRegistered,
    register,
    refresh,
    clearUser,
  };
}

