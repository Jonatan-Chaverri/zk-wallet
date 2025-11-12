'use client';

import { useState } from 'react';
import {
  generateDepositProof,
  generateTransferProof,
  generateWithdrawProof,
  generateRandomness,
  type DepositParams,
  type TransferParams,
  type WithdrawParams,
} from '../lib/noir/proofGeneration';

export function useProofs() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generateDeposit = async (params: {
    senderPrivKey: string;
    randomness?: string;
    senderPubkey: { x: string; y: string };
    oldBalanceX1: { x: string; y: string };
    oldBalanceX2: { x: string; y: string };
    senderAddress: string;
    token: string;
    amount: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const depositParams: DepositParams = {
        senderPrivKey: params.senderPrivKey,
        randomness: params.randomness || generateRandomness(),
        senderPubkey: params.senderPubkey,
        oldBalanceX1: params.oldBalanceX1,
        oldBalanceX2: params.oldBalanceX2,
        senderAddress: params.senderAddress,
        token: params.token,
        amount: params.amount,
      };
      setProgress(30);
      const result = await generateDepositProof(depositParams);
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
    senderPrivKey: string;
    transferAmount: string;
    randomnessSender?: string;
    randomnessReceiver?: string;
    receiverAddress: string;
    receiverPubkey: { x: string; y: string };
    receiverOldBalanceX1: { x: string; y: string };
    receiverOldBalanceX2: { x: string; y: string };
    senderPubkey: { x: string; y: string };
    senderOldBalanceX1: { x: string; y: string };
    senderOldBalanceX2: { x: string; y: string };
    token: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const transferParams: TransferParams = {
        senderPrivKey: params.senderPrivKey,
        transferAmount: params.transferAmount,
        randomnessSender: params.randomnessSender || generateRandomness(),
        randomnessReceiver: params.randomnessReceiver || generateRandomness(),
        receiverAddress: params.receiverAddress,
        receiverPubkey: params.receiverPubkey,
        receiverOldBalanceX1: params.receiverOldBalanceX1,
        receiverOldBalanceX2: params.receiverOldBalanceX2,
        senderPubkey: params.senderPubkey,
        senderOldBalanceX1: params.senderOldBalanceX1,
        senderOldBalanceX2: params.senderOldBalanceX2,
        token: params.token,
      };
      setProgress(30);
      const result = await generateTransferProof(transferParams);
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
    senderPrivKey: string;
    randomness?: string;
    senderPubkey: { x: string; y: string };
    oldBalanceX1: { x: string; y: string };
    oldBalanceX2: { x: string; y: string };
    senderAddress: string;
    token: string;
    amount: string;
  }) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      const withdrawParams: WithdrawParams = {
        senderPrivKey: params.senderPrivKey,
        randomness: params.randomness || generateRandomness(),
        senderPubkey: params.senderPubkey,
        oldBalanceX1: params.oldBalanceX1,
        oldBalanceX2: params.oldBalanceX2,
        senderAddress: params.senderAddress,
        token: params.token,
        amount: params.amount,
      };
      setProgress(30);
      const result = await generateWithdrawProof(withdrawParams);
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
