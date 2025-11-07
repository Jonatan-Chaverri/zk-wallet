'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ProofGenerator } from '../components/ProofGenerator';
import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { useProofs } from '../hooks/useProofs';
import { encryptValue } from '../lib/utils/crypto';
import { Address, parseUnits } from 'viem';
import { apiClient } from '../lib/utils/api';

export default function DepositPage() {
  const { address, publicKey, isConnected, createWallet, isCreating, isRegistering } = useWallet();
  const { userWallet, fetchEncryptedBalance } = useContracts();
  const { generateDeposit, isGenerating } = useProofs();

  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint>(BigInt('23011913')); // Default fallback

  // Fetch chainId from backend config (but keep it in frontend for proof generation)
  useEffect(() => {
    apiClient.getConfig().then((config) => {
      setChainId(BigInt(config.chainId));
    }).catch(() => {
      // Keep default if fetch fails
    });
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !publicKey || !userWallet || !isConnected) {
      setError('Please connect your wallet');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Get current balance
      const currentBalance = await fetchEncryptedBalance(tokenAddress as Address);
      
      // Parse amount
      const amountBigInt = parseUnits(amount, parseInt(decimals));

      // Encrypt new balance (old + deposit)
      // TODO: This should use homomorphic addition in Noir
      const newBalance = await encryptValue(amountBigInt, publicKey);

      // Generate ZK proof
      const proofResult = await generateDeposit({
        oldBalance: currentBalance,
        depositAmount: amountBigInt,
        newBalance,
        publicKey,
        chainId,
        contractAddress: userWallet,
      });

      // Submit transaction via backend API
      const hash = await apiClient.submitDeposit({
        userWalletAddress: userWallet,
        tokenAddress: tokenAddress as Address,
        amount: amountBigInt.toString(),
        newBalance,
        to: address as Address,
      });

      setSuccess(`Transaction submitted: ${hash}`);
    } catch (err: any) {
      setError(err.message || 'Failed to deposit');
      console.error('Deposit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Deposit</h1>
          <p className="text-gray-600 mb-4">Please create a wallet to deposit tokens.</p>
          <button
            onClick={createWallet}
            disabled={isCreating || isRegistering}
            className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isCreating ? 'Deploying...' : isRegistering ? 'Registering...' : 'Create Wallet'}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Deposit Tokens</h1>

        <ProofGenerator>
          <form onSubmit={handleDeposit} className="bg-white border border-black rounded-xl p-6 shadow-lg space-y-6">
            <div>
              <label htmlFor="token" className="block text-sm font-medium mb-2">
                Token Address
              </label>
              <input
                id="token"
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
                required
                className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label htmlFor="decimals" className="block text-sm font-medium mb-2">
                  Decimals
                </label>
                <input
                  id="decimals"
                  type="number"
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  placeholder="18"
                  required
                  className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isGenerating}
              className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting || isGenerating ? 'Processing...' : 'Deposit'}
            </button>
          </form>
        </ProofGenerator>
      </div>
    </Layout>
  );
}
