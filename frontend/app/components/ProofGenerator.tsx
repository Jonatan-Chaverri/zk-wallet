'use client';

import { useProofs } from '../hooks/useProofs';

interface ProofGeneratorProps {
  onProofGenerated?: (proof: { proof: string; publicInputs: string }) => void;
  children?: React.ReactNode;
}

export function ProofGenerator({ onProofGenerated, children }: ProofGeneratorProps) {
  const { isGenerating, progress, error } = useProofs();

  return (
    <div className="space-y-4">
      {isGenerating && (
        <div className="bg-white border border-black rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Generating ZK Proof...</p>
            <span className="text-xs text-gray-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-black h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
