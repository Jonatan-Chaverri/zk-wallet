'use client';

import { Layout } from '../components/Layout';
import { WalletCard } from '../components/WalletCard';
import { TxHistory } from '../components/TxHistory';
import { useWallet } from '../hooks/useWallet';

export default function DashboardPage() {
  const { isConnected, connectWallet, isConnecting } = useWallet();

  if (!isConnected) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Please connect your MetaMask wallet to view your dashboard.
          </p>
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
