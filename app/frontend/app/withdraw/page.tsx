'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useWallet } from '../hooks/useWallet';
import { useUser } from '../hooks/useUser';
import { useConfidentialERC20 } from '../hooks/useConfidentialERC20';
import { apiClient } from '../lib/utils/api';
import { savePrivateKey, getPrivateKey } from '../lib/utils/privateKeyStorage';
import { generateDepositWithdrawProof } from '../lib/utils/proverMock';
import { generateKeyBytes } from '../lib/utils/crypto';
import { Address, parseUnits } from 'viem';

export default function WithdrawPage() {
  const { address, isConnected, connectWallet, isConnecting, privateKey } = useWallet();
  const { user } = useUser(address);
  const { balanceOfEnc, withdraw: withdrawFromContract } = useConfidentialERC20();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [tokens, setTokens] = useState<Array<{ name: string; network: string; address: string }>>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

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
    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      try {
        const response = await apiClient.getTokens();
        setTokens(response.tokens);
        console.log('Available tokens:', response.tokens.map(t => t.name));
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    if (isConnected) {
      fetchTokens();
    }
  }, [isConnected]);

  // Save private key to localStorage whenever it changes
  useEffect(() => {
    if (address && privateKeyInput.trim()) {
      savePrivateKey(address, privateKeyInput.trim());
    }
  }, [address, privateKeyInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (!address) {
      setWithdrawError('Wallet not connected');
      return;
    }

    if (!user?.public_key_x || !user.public_key_y) {
      setWithdrawError('User public key not found. Please register first.');
      return;
    }

    if (!token) {
      setWithdrawError('Please select a token');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }

    setIsWithdrawing(true);

    try {
      // Convert amount to wei (assuming 18 decimals for ERC20 tokens)
      const amountWei = parseUnits(amount, 18);

      // Get current encrypted balance
      const currentBalance = await balanceOfEnc(token as Address, address);
      
      // Convert current balance from Uint8Array to the format expected by prover
      const currentBalanceBytes = currentBalance instanceof Uint8Array 
        ? currentBalance 
        : new Uint8Array(currentBalance);

      // Generate public key bytes (64 bytes: x||y)
      const userPubKeyBytes = generateKeyBytes({
        x: user.public_key_x,
        y: user.public_key_y,
      });

      // Generate proof and public inputs using mock prover
      const { public_inputs, proof } = generateDepositWithdrawProof(
        userPubKeyBytes,
        address,
        token,
        amountWei,
        currentBalanceBytes
      );

      // Call withdraw function
      const txHash = await withdrawFromContract(public_inputs, proof);
      
      setWithdrawSuccess(`Withdraw successful! Transaction: ${txHash}`);
      setAmount(''); // Clear form on success
    } catch (err: any) {
      console.error('Withdraw error:', err);
      setWithdrawError(err.message || 'Failed to withdraw tokens');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Withdraw</h1>
          <p className="text-gray-600 mb-4">Please connect your MetaMask wallet to withdraw tokens.</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Withdraw Tokens</h1>

        <form onSubmit={handleSubmit} className="bg-white border border-black rounded-xl p-6 shadow-lg space-y-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-2">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              required
              className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-2">
              Token
            </label>
            <select
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              disabled={isLoadingTokens || tokens.length === 0}
              className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingTokens ? 'Loading tokens...' : tokens.length === 0 ? 'No tokens available' : 'Select a token'}
              </option>
              {tokens.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.name} ({t.network})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="private_key" className="block text-sm font-medium mb-2">
              Private Key
            </label>
            <div className="relative">
              <input
                id="private_key"
                type={showPrivateKey ? 'text' : 'password'}
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder={privateKey ? 'Using wallet private key (or enter custom)' : 'Enter private key'}
                required={!privateKey}
                className="w-full px-4 py-2 pr-10 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
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
            {privateKey && (
              <p className="text-xs text-gray-500 mt-1">
                Using private key from connected wallet. You can override it above.
              </p>
            )}
            {privateKeyInput && !privateKey && (
              <p className="text-xs text-gray-500 mt-1">
                Private key is saved locally and will be remembered for this wallet.
              </p>
            )}
          </div>

          {withdrawError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{withdrawError}</p>
            </div>
          )}

          {withdrawSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">{withdrawSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isWithdrawing || !user?.public_key_x || !user?.public_key_y}
            className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
