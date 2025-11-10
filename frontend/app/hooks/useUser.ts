'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/utils/api';
import type { Address } from 'viem';

interface User {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

const USERNAME_STORAGE_KEY = 'zk-wallet-username';

export function useUser(address: Address | null) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Load username from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
      if (storedUsername && address) {
        // If we have a stored username, set registered state optimistically
        setIsRegistered(true);
        setUser({
          id: '', // Will be updated when we fetch
          name: storedUsername,
          address: address,
          created_at: '',
        });
      }
    }
  }, []);

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
        created_at: response.user.created_at,
      };
      
      setUser(newUser);
      setIsRegistered(true);
      
      // Store username in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(USERNAME_STORAGE_KEY, response.user.username);
        window.dispatchEvent(new Event('username-storage-changed'));
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

