/**
 * Utility functions for managing private keys in localStorage
 * Keys are stored per wallet address to support multiple wallets
 */

const STORAGE_PREFIX = 'zk-wallet-private-key-';

/**
 * Get the storage key for a given wallet address
 */
function getStorageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`;
}

/**
 * Save private key to localStorage for a specific wallet address
 */
export function savePrivateKey(address: string, privateKey: string): void {
  if (typeof window === 'undefined' || !address || !privateKey) {
    return;
  }

  try {
    const key = getStorageKey(address);
    localStorage.setItem(key, privateKey);
  } catch (error) {
    console.error('Failed to save private key to localStorage:', error);
  }
}

/**
 * Get private key from localStorage for a specific wallet address
 */
export function getPrivateKey(address: string | null): string | null {
  if (typeof window === 'undefined' || !address) {
    return null;
  }

  try {
    const key = getStorageKey(address);
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Failed to get private key from localStorage:', error);
    return null;
  }
}

/**
 * Remove private key from localStorage for a specific wallet address
 */
export function removePrivateKey(address: string | null): void {
  if (typeof window === 'undefined' || !address) {
    return;
  }

  try {
    const key = getStorageKey(address);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove private key from localStorage:', error);
  }
}

/**
 * Clear all private keys from localStorage (for all wallets)
 */
export function clearAllPrivateKeys(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear private keys from localStorage:', error);
  }
}

