'use client';

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { ProofGenerator } from '../components/ProofGenerator';
import { useProofs } from '../hooks/useProofs';

export default function TestProofsPage() {
  const { generateDeposit, generateTransfer, generateWithdraw, isGenerating, error } = useProofs();
  const [result, setResult] = useState<{ proof: Uint8Array; publicInputs: string[] } | null>(null);
  const [proofType, setProofType] = useState<string>('');

  const handleGenerateDeposit = async () => {
    try {
      setProofType('Deposit');
      setResult(null);
      const proof = await generateDeposit({
        oldBalance: { x1: '', x2: '' }, // Ignored - uses test data
        depositAmount: BigInt(100),
        newBalance: { x1: '', x2: '' }, // Ignored - computed by circuit
        publicKey: { x: '', y: '' }, // Ignored - uses test data
        chainId: BigInt(421614),
        contractAddress: '0x0000000000000000000000000000000000000001',
      });
      setResult(proof);
    } catch (err) {
      console.error('Deposit proof generation failed:', err);
    }
  };

  const handleGenerateTransfer = async () => {
    try {
      setProofType('Transfer');
      setResult(null);
      const proof = await generateTransfer({
        fromOldBalance: { x1: '', x2: '' },
        toOldBalance: { x1: '', x2: '' },
        amount: BigInt(50),
        fromNewBalance: { x1: '', x2: '' },
        toNewBalance: { x1: '', x2: '' },
        fromPublicKey: { x: '', y: '' },
        toPublicKey: { x: '', y: '' },
        chainId: BigInt(421614),
        contractAddress: '0x0000000000000000000000000000000000000002',
      });
      setResult(proof);
    } catch (err) {
      console.error('Transfer proof generation failed:', err);
    }
  };

  const handleGenerateWithdraw = async () => {
    try {
      setProofType('Withdraw');
      setResult(null);
      const proof = await generateWithdraw({
        oldBalance: { x1: '', x2: '' },
        amount: BigInt(75),
        newBalance: { x1: '', x2: '' },
        publicKey: { x: '', y: '' },
        chainId: BigInt(421614),
        contractAddress: '0x0000000000000000000000000000000000000003',
      });
      setResult(proof);
    } catch (err) {
      console.error('Withdraw proof generation failed:', err);
    }
  };

  const formatProof = (proof: Uint8Array) => {
    const hex = Array.from(proof)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `0x${hex}`;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Test Proof Generation</h1>
        <p className="text-gray-600 mb-8">
          Test the Noir circuits with pre-configured test data (Alice&apos;s account with 500 tokens balance).
        </p>

        <ProofGenerator>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={handleGenerateDeposit}
              disabled={isGenerating}
              className="px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Generate Deposit Proof
              <div className="text-xs mt-1 opacity-80">Deposit 100 tokens</div>
            </button>

            <button
              onClick={handleGenerateTransfer}
              disabled={isGenerating}
              className="px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Generate Transfer Proof
              <div className="text-xs mt-1 opacity-80">Transfer 50 tokens</div>
            </button>

            <button
              onClick={handleGenerateWithdraw}
              disabled={isGenerating}
              className="px-6 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Generate Withdraw Proof
              <div className="text-xs mt-1 opacity-80">Withdraw 75 tokens</div>
            </button>
          </div>
        </ProofGenerator>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-red-800 mb-1">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-bold text-green-800 mb-2">✅ {proofType} Proof Generated Successfully!</h3>
              <p className="text-sm text-green-700">
                Proof size: {result.proof.length} bytes | Public inputs: {result.publicInputs.length}
              </p>
            </div>

            <div className="bg-white border border-black rounded-xl p-6">
              <h3 className="font-bold mb-3">Proof Data (hex)</h3>
              <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                <code className="text-xs break-all font-mono">
                  {formatProof(result.proof)}
                </code>
              </div>
            </div>

            <div className="bg-white border border-black rounded-xl p-6">
              <h3 className="font-bold mb-3">Public Inputs ({result.publicInputs.length})</h3>
              <div className="space-y-2">
                {result.publicInputs.map((input, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Input #{i}</div>
                    <code className="text-xs break-all font-mono">{input}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-bold text-blue-800 mb-2">📝 Test Data Used</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Account:</strong> Alice</div>
                <div><strong>Private Key:</strong> 42</div>
                <div><strong>Current Balance:</strong> 500 tokens (encrypted)</div>
                <div><strong>Public Key X:</strong> 7356913722468763155518092886238006860757299964193402191943647957243737021149</div>
              </div>
            </div>
          </div>
        )}

        {!result && !error && !isGenerating && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-600">Click a button above to generate a proof</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
