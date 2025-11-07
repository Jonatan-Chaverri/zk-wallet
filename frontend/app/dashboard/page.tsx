'use client';

import { Layout } from '../components/Layout';
import { WalletCard } from '../components/WalletCard';
import { TxHistory } from '../components/TxHistory';
import { useWallet } from '../hooks/useWallet';

export default function DashboardPage() {
  const { isConnected, createWallet, isCreating, isRegistering } = useWallet();

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Please create a wallet to view your dashboard.
          </p>
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <WalletCard />
          <TxHistory />
        </div>
      </div>
    </Layout>
  );
}
