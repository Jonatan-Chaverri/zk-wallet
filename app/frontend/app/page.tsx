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

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-black border border-white/30 rounded-xl p-6 shadow-lg hover:border-brand-purple transition">
            <h3 className="text-lg font-bold mb-3 text-white">🔐 Private</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Balances are encrypted using <strong>ElGamal</strong> over <strong>BabyJub</strong> curves.
              Only you hold the key to decrypt your assets.
            </p>
          </div>

          <div className="bg-black border border-white/30 rounded-xl p-6 shadow-lg hover:border-brand-purple transition">
            <h3 className="text-lg font-bold mb-3 text-white">🛡️ Zero-Knowledge</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Locally generate <strong>ZK proofs</strong> via Noir circuits to validate ownership and correctness —
              without revealing any sensitive information.
            </p>
          </div>

          <div className="bg-black border border-white/30 rounded-xl p-6 shadow-lg hover:border-brand-purple transition">
            <h3 className="text-lg font-bold mb-3 text-white">⚡ Fast</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Powered by <strong>Arbitrum Stylus</strong> for near-native Rust performance and ultra-low fees.
              Cryptographic operations run securely off-chain.
            </p>
          </div>
        </div>

        <div className="bg-yellow-100 border border-yellow-400 rounded-xl p-5 mb-10 max-w-3xl mx-auto text-yellow-900 mt-16">
          <p className="font-semibold mb-1">⚠️ Demo Notice</p>
          <p className="text-sm leading-relaxed">
            This is a prototype built for the{' '}
            <strong>Invisible Garden Hackathon</strong>.  
            Currently functional on <strong>Arbitrum Sepolia</strong> with <strong>WETH</strong> tokens only.
          </p>
        </div>

        <div>
          <section className="mt-16 max-w-3xl mx-auto px-4 text-center">
            <a
              href="https://github.com/Jonatan-Chaverri/zk-wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              View Source on GitHub
            </a>
          </section>
        </div>
      </div>
    </Layout>
  );
}
