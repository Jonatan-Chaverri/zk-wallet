'use client';

import { useWalletStore } from '../lib/store/walletStore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export function TxHistory() {
  const { transactions } = useWalletStore();

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        <p className="text-gray-600 text-sm">No transactions yet</p>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'withdraw':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'transfer':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-black text-white';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border border-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">Transaction History</h2>
      <div className="space-y-3">
        {transactions.slice(0, 10).map((tx, idx) => (
          <div
            key={idx}
            className="p-4 border border-gray-200 rounded-lg hover:border-brand-purple transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded border ${getTypeColor(
                    tx.type
                  )}`}
                >
                  {tx.type.toUpperCase()}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                    tx.status
                  )}`}
                >
                  {tx.status}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
              </span>
            </div>

            {tx.amount && (
              <p className="text-sm font-medium mb-1">
                Amount: {tx.amount} tokens
              </p>
            )}

            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <span className="font-medium">From:</span>{' '}
                <span className="font-mono">{tx.from.slice(0, 10)}...{tx.from.slice(-6)}</span>
              </p>
              <p>
                <span className="font-medium">To:</span>{' '}
                <span className="font-mono">{tx.to.slice(0, 10)}...{tx.to.slice(-6)}</span>
              </p>
            </div>

            <Link
              href={`https://sepolia.arbiscan.io/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-brand-purple hover:underline mt-2 inline-block"
            >
              View on Explorer →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
