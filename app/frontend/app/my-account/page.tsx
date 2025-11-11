'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '../components/Layout';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';
import { useConfidentialERC20 } from '../hooks/useConfidentialERC20';
import { apiClient } from '../lib/utils/api';
import { savePrivateKey, getPrivateKey } from '../lib/utils/privateKeyStorage';
import { Address } from 'viem';
// @ts-expect-error - baby-giant-wasm is provided by confidential-transfers
import * as curveWasm from 'confidential-transfers/baby-giant';

export default function MyAccountPage() {
  const router = useRouter();
  const { address, isConnected, connectWallet, isConnecting, disconnect } = useWallet();
  const { user: userFromHook, isLoading: isLoadingUser, refresh, clearUser } = useUser(address);
  const { balanceOfEnc } = useConfidentialERC20();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    address: string;
    public_key_x: string | null;
    public_key_y: string | null;
    created_at: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Balance checking state
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [tokens, setTokens] = useState<Array<{ name: string; network: string; address: string }>>([]);

  // Load private key from localStorage when address is available
  // Clear it when address is not available (disconnected)
  useEffect(() => {
    if (address) {
      const storedKey = getPrivateKey(address);
      if (storedKey) {
        setPrivateKeyInput(storedKey);
      } else {
        // Clear the input if no stored key exists (prevents restoring from component state)
        setPrivateKeyInput('');
      }
    } else {
      // Clear when disconnected
      setPrivateKeyInput('');
    }
  }, [address]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!address || !isConnected) {
        setUser(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.getUser({ address });
        if (response.user) {
          setUser(response.user);
        } else {
          setError('User not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch user information');
        console.error('Error fetching user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [address, isConnected]);

  // Save private key to localStorage whenever it changes
  useEffect(() => {
    if (address && privateKeyInput.trim()) {
      savePrivateKey(address, privateKeyInput.trim());
    }
  }, [address, privateKeyInput]);

  // Fetch available tokens
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await apiClient.getTokens();
        setTokens(response.tokens);
        if (response.tokens.length > 0) {
          setSelectedToken(response.tokens[0].address as Address);
        }
      } catch (err) {
        console.error('Failed to fetch tokens:', err);
      }
    };

    if (isConnected) {
      fetchTokens();
    }
  }, [isConnected]);

  const decryptBalance = (balEnc: { c1: { x: bigint; y: bigint }; c2: { x: bigint; y: bigint } }, privateKey: string): string => {
    if (BigInt(0) == BigInt(balEnc.c2.x)) {
      return '0.00';
    }
    const balECPointEncoded = curveWasm.elgamal_decrypt(
      BigInt(privateKey).toString(),
      BigInt(balEnc.c1.x).toString(),
      BigInt(balEnc.c1.y).toString(),
      BigInt(balEnc.c2.x).toString(),
      BigInt(balEnc.c2.y).toString(),
    );
    const [x, y] = balECPointEncoded.split('|');
    const bal = curveWasm.grumpkin_bsgs_str(x, y).toString();
    if ('0' == bal) {
      throw new Error('Wrong private key');
    }
    return bal.substring(0, bal.length - 2) + '.' + bal.substring(bal.length - 2);
  };

  const handleCheckBalance = async () => {
    if (!privateKeyInput.trim()) {
      setBalanceError('Please enter your private key');
      return;
    }

    if (!selectedToken) {
      setBalanceError('Please select a token');
      return;
    }

    if (!address) {
      setBalanceError('Wallet not connected');
      return;
    }

    setIsCheckingBalance(true);
    setBalanceError(null);
    setBalance(null);

    try {
      const result = await balanceOfEnc(selectedToken, address);
      
      // Parse the Uint8Array (128 bytes) into CipherText structure
      // bytes 0-31: c1.x
      // bytes 32-63: c1.y
      // bytes 64-95: c2.x
      // bytes 96-127: c2.y
      const c1x = BigInt('0x' + Array.from(result.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
      const c1y = BigInt('0x' + Array.from(result.slice(32, 64))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
      const c2x = BigInt('0x' + Array.from(result.slice(64, 96))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
      const c2y = BigInt('0x' + Array.from(result.slice(96, 128))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));

      const balEnc = {
        c1: { x: c1x, y: c1y },
        c2: { x: c2x, y: c2y }
      };

      console.log('balEnc:', balEnc);

      const decryptedBalance = decryptBalance(balEnc, privateKeyInput.trim());
      setBalance(decryptedBalance);
    } catch (err: any) {
      console.error('Error checking balance:', err);
      setBalanceError(err.message || 'Failed to check balance.');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">My Account</h1>
          <p className="text-white mb-4">Please connect your MetaMask wallet to view your account information.</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-black text-white rounded-xl hover:bg-brand-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">My Account</h1>
          <div className="bg-black border border-white rounded-xl p-6 shadow-lg">
            <p className="text-white">Loading account information...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">My Account</h1>
          <div className="bg-black border border-white rounded-xl p-6 shadow-lg">
            <p className="text-red-400 mb-4">
              {error || 'User not found. Please make sure you are registered.'}
            </p>
            <button
              onClick={() => {
                setError(null);
                if (address) {
                  const fetchUser = async () => {
                    setIsLoading(true);
                    try {
                      const response = await apiClient.getUser({ address });
                      if (response.user) {
                        setUser(response.user);
                        setError(null);
                      } else {
                        setError('User not found');
                      }
                    } catch (err: any) {
                      setError(err.message || 'Failed to fetch user information');
                    } finally {
                      setIsLoading(false);
                    }
                  };
                  fetchUser();
                }
              }}
              className="px-4 py-2 border border-white rounded-lg hover:bg-brand-purple text-white transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">My Account</h1>

        <div className="bg-black border border-white rounded-xl p-6 shadow-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Username
            </label>
            <div className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-white">
              {user.name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Address
            </label>
            <div className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm break-all text-white">
              {user.address}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Registration Date
            </label>
            <div className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white">
              {formatDate(user.created_at)}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={async () => {
                clearUser();
                disconnect();
                // Wait a bit to ensure disconnect state updates propagate
                await new Promise(resolve => setTimeout(resolve, 200));
                // Force a full page reload to ensure all state is cleared
                window.location.href = '/';
              }}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>

        {/* Balance Check Section */}
        <div className="bg-black border border-white rounded-xl p-6 shadow-lg space-y-6 mt-6">
          <h2 className="text-xl font-bold mb-4 text-white">Check Balance</h2>
          
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-white mb-2">
              Token
            </label>
            <select
              id="token"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as Address)}
              className="w-full px-4 py-2 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white font-mono text-sm bg-black text-white"
            >
              <option value="">Select a token</option>
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.name} ({token.network})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="private_key" className="block text-sm font-medium text-white mb-2">
              Private Key
            </label>
            <div className="relative">
              <input
                id="private_key"
                type={showPrivateKey ? 'text' : 'password'}
                value={privateKeyInput}
                onChange={(e) => {
                  setPrivateKeyInput(e.target.value);
                  setBalanceError(null);
                  setBalance(null);
                }}
                placeholder="Enter your private key to decrypt balance"
                className="w-full px-4 py-2 pr-10 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white font-mono text-sm bg-black text-white placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-purple focus:outline-none"
                aria-label={showPrivateKey ? 'Hide private key' : 'Show private key'}
              >
                {showPrivateKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Your private key is used locally to decrypt your balance. It is never sent to the server.
            </p>
            {privateKeyInput && (
              <p className="text-xs text-gray-400 mt-1">
                Private key is saved locally and will be remembered for this wallet.
              </p>
            )}
          </div>

          {balanceError && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-3">
              <p className="text-sm text-red-200">{balanceError}</p>
            </div>
          )}

          {balance !== null && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4">
              <p className="text-sm font-medium text-green-200 mb-1">Decrypted Balance:</p>
              <p className="text-2xl font-bold text-green-100">{balance}</p>
            </div>
          )}

          <button
            onClick={handleCheckBalance}
            disabled={isCheckingBalance || !privateKeyInput.trim() || !selectedToken}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isCheckingBalance ? 'Checking Balance...' : 'Check Balance'}
          </button>
        </div>
      </div>
    </Layout>
  );
}

