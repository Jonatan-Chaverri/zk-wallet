import { Layout } from './components/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-5xl font-bold mb-6">zkWallet</h1>
        <p className="text-xl text-gray-700 mb-4 max-w-2xl mx-auto">
          A privacy-preserving wallet that allows you to manage encrypted balances
          and generate zero-knowledge proofs locally on Arbitrum Stylus.
        </p>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 mb-8 max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Demo Version</p>
          <p className="text-sm text-yellow-800">
            This is a demo application. Currently, it only works on <strong>Arbitrum Sepolia</strong> with <strong>WETH tokens</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">🔐 Private</h3>
            <p className="text-sm text-gray-600">
              All balances are encrypted using ElGamal encryption over BabyJub curves.
              Only you can decrypt your balances.
            </p>
          </div>

          <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">🛡️ Zero-Knowledge</h3>
            <p className="text-sm text-gray-600">
              Generate ZK proofs locally using Noir circuits. Prove ownership
              and validity without revealing sensitive information.
            </p>
          </div>

          <div className="bg-white border border-black rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">⚡ Fast</h3>
            <p className="text-sm text-gray-600">
              Built on Arbitrum Stylus for efficient, low-cost transactions.
              All cryptographic operations happen off-chain.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}