'use client';

import { useWallet } from '../hooks/useWallet';
import { useContracts } from '../hooks/useContracts';
import { useEffect, useState } from 'react';
import type { Ciphertext } from '../lib/types';

export function WalletCard() {
  const { address, publicKey } = useWallet();
  const { fetchEncryptedBalance } = useContracts();
  const [balances, setBalances] = useState<Array<{ token: string; ciphertext: Ciphertext }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    // TODO: Fetch balances for all supported tokens
    // For now, this is a placeholder
    setLoading(false);
  }, [address]);

  if (!address) {
    return (
      <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
        <p className="text-gray-600">Connect your wallet to view balances</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">Wallet</h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Address</p>
          <p className="font-mono text-sm break-all">{address}</p>
        </div>

        {publicKey && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Public Key</p>
            <div className="space-y-1">
              <p className="font-mono text-xs break-all">
                <span className="text-gray-500">X:</span> {publicKey.x.slice(0, 20)}...
              </p>
              <p className="font-mono text-xs break-all">
                <span className="text-gray-500">Y:</span> {publicKey.y.slice(0, 20)}...
              </p>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600 mb-2">Encrypted Balances</p>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : balances.length === 0 ? (
            <p className="text-sm text-gray-500">No balances found</p>
          ) : (
            <div className="space-y-2">
              {balances.map((balance, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-mono text-gray-600">
                    Token: {balance.token.slice(0, 10)}...
                  </p>
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    Ciphertext: {balance.ciphertext.x1.slice(0, 16)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
