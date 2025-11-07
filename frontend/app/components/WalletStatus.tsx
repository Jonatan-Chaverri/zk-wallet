'use client';

import { useWallet } from '../hooks/useWallet';

export function WalletStatus() {
  const { address, isConnected, isCreating, isRegistering, error, createWallet, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Your Wallet</p>
          <p className="text-sm font-mono text-black">
            {address.slice(0, 8)}...{address.slice(-6)}
          </p>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 border border-black rounded-xl bg-white text-black hover:bg-gray-50 transition-colors text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={createWallet}
        disabled={isCreating || isRegistering}
        className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
      >
        {isCreating ? 'Deploying...' : isRegistering ? 'Registering...' : 'Create Wallet'}
      </button>
    </div>
  );
}
