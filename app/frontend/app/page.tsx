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

        <div className="flex gap-4 justify-center mb-12">
          <Link
            href="/test-proofs"
            className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-medium"
          >
            Test Proof Generation
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-black rounded-xl bg-white text-black hover:bg-gray-50 transition-colors font-medium"
          >
            Full Wallet
          </Link>
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