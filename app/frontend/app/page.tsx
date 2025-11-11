import { Layout } from './components/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="max-w-5xl mx-auto text-center py-16 px-4">
        <h1 className="text-6xl font-extrabold mb-4 text-white tracking-tight">
          zkWallet
        </h1>
        <p className="text-xl text-gray-200 mb-10 max-w-3xl mx-auto">
          A <strong>privacy-preserving wallet</strong> prototype built on{' '}
          <span className="text-brand-purple font-semibold">Arbitrum Stylus</span>.<br />
          Manage encrypted balances and prove transactions without revealing your data.
        </p>

        <div className="bg-black/70 border border-white/20 rounded-2xl p-8 mb-12 max-w-3xl mx-auto backdrop-blur-sm">
          <h2 className="text-2xl font-semibold mb-3 text-white">🔒 Confidentiality Model</h2>
          <p className="text-gray-200 mb-4 text-sm">
            zkWallet balances <span className="font-semibold text-white">transparency</span> and{' '}
            <span className="font-semibold text-white">privacy</span> through a hybrid model:
          </p>
          <ul className="text-gray-100 text-left list-disc list-inside space-y-2">
            <li>
              <strong className="text-brand-purple">Public:</strong> sender and receiver addresses remain visible on-chain
            </li>
            <li>
              <strong className="text-brand-purple">Private:</strong> transaction amounts are encrypted and invisible to third parties
            </li>
          </ul>
          <p className="text-gray-400 mt-5 text-sm">
            This approach preserves the integrity of public blockchains while protecting user confidentiality.
          </p>
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
