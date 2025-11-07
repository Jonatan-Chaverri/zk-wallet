'use client';

import { useState } from 'react';
import {
  generateDepositProof,
  generateTransferProof,
  generateWithdrawProof,
} from '../lib/noir';
import type { Ciphertext } from '../lib/types';

export function useProofs() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generateDeposit = async (params: {
    oldBalance: Ciphertext;
    depositAmount: bigint;
    newBalance: Ciphertext;
    publicKey: { x: string; y: string };
    chainId: bigint;
    contractAddress: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const result = await generateDepositProof({
        oldBalance: JSON.stringify(params.oldBalance),
        depositAmount: params.depositAmount,
        newBalance: JSON.stringify(params.newBalance),
        publicKey: JSON.stringify(params.publicKey),
        chainId: params.chainId,
        contractAddress: params.contractAddress,
      });
      setProgress(100);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to generate deposit proof');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const generateTransfer = async (params: {
    fromOldBalance: Ciphertext;
    toOldBalance: Ciphertext;
    amount: bigint;
    fromNewBalance: Ciphertext;
    toNewBalance: Ciphertext;
    fromPublicKey: { x: string; y: string };
    toPublicKey: { x: string; y: string };
    chainId: bigint;
    contractAddress: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const result = await generateTransferProof({
        fromOldBalance: JSON.stringify(params.fromOldBalance),
        toOldBalance: JSON.stringify(params.toOldBalance),
        amount: params.amount,
        fromNewBalance: JSON.stringify(params.fromNewBalance),
        toNewBalance: JSON.stringify(params.toNewBalance),
        fromPublicKey: JSON.stringify(params.fromPublicKey),
        toPublicKey: JSON.stringify(params.toPublicKey),
        chainId: params.chainId,
        contractAddress: params.contractAddress,
      });
      setProgress(100);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to generate transfer proof');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWithdraw = async (params: {
    oldBalance: Ciphertext;
    amount: bigint;
    newBalance: Ciphertext;
    publicKey: { x: string; y: string };
    chainId: bigint;
    contractAddress: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const result = await generateWithdrawProof({
        oldBalance: JSON.stringify(params.oldBalance),
        amount: params.amount,
        newBalance: JSON.stringify(params.newBalance),
        publicKey: JSON.stringify(params.publicKey),
        chainId: params.chainId,
        contractAddress: params.contractAddress,
      });
      setProgress(100);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to generate withdraw proof');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateDeposit,
    generateTransfer,
    generateWithdraw,
    isGenerating,
    progress,
    error,
  };
}
