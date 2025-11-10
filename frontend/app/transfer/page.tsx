'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useWallet } from '../hooks/useWallet';
import { apiClient } from '../lib/utils/api';

export default function TransferPage() {
  const { isConnected, connectWallet, isConnecting, privateKey } = useWallet();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [receiver, setReceiver] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [tokens, setTokens] = useState<Array<{ name: string; network: string; address: string }>>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No backend calls for now - just log the values
    console.log('Transfer:', { 
      amount, 
      token, 
      receiver, 
      private_key: privateKeyInput || privateKey 
    });
  };

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Transfer</h1>
          <p className="text-gray-600 mb-4">Please connect your MetaMask wallet to transfer tokens.</p>
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
        <h1 className="text-3xl font-bold mb-6">Transfer Tokens</h1>

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
            <label htmlFor="receiver" className="block text-sm font-medium mb-2">
              Receiver Address or Username
            </label>
            <input
              id="receiver"
              type="text"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="0x... or username"
              required
              className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter either a wallet address (0x...) or a username
            </p>
          </div>

          <div>
            <label htmlFor="private_key" className="block text-sm font-medium mb-2">
              Private Key
            </label>
            <input
              id="private_key"
              type="password"
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              placeholder={privateKey ? 'Using wallet private key (or enter custom)' : 'Enter private key'}
              required={!privateKey}
              className="w-full px-4 py-2 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
            />
            {privateKey && (
              <p className="text-xs text-gray-500 mt-1">
                Using private key from connected wallet. You can override it above.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-medium"
          >
            Transfer
          </button>
        </form>
      </div>
    </Layout>
  );
}
