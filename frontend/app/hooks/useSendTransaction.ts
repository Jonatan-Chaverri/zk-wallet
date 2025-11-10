'use client';

import { useSendTransaction as useWagmiSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { encodeDepositPrivate, encodeTransferPrivate, encodeWithdrawPrivate } from '../lib/contracts/userWallet';
import type { Address } from 'viem';
import type { Ciphertext } from '../lib/types';

export function useSendTransaction() {
  const { sendTransaction, data: hash, isPending, error } = useWagmiSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const sendDeposit = async (params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    amount: bigint;
    newBalance: Ciphertext;
    to: Address;
  }) => {
    const calldata = encodeDepositPrivate(
      params.tokenAddress,
      params.amount,
      params.newBalance,
      params.to
    );

    return sendTransaction({
      to: params.userWalletAddress,
      data: calldata,
    });
  };

  const sendTransfer = async (params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    recipient: Address;
    fromNewBalance: Ciphertext;
    toNewBalance: Ciphertext;
    proofInputs: string;
    proof: string;
  }) => {
    const calldata = encodeTransferPrivate(
      params.tokenAddress,
      params.recipient,
      params.fromNewBalance,
      params.toNewBalance,
      params.proofInputs,
      params.proof
    );

    return sendTransaction({
      to: params.userWalletAddress,
      data: calldata,
    });
  };

  const sendWithdraw = async (params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    recipient: Address;
    newBalance: Ciphertext;
    proofInputs: string;
    proof: string;
  }) => {
    const calldata = encodeWithdrawPrivate(
      params.tokenAddress,
      params.recipient,
      params.newBalance,
      params.proofInputs,
      params.proof
    );

    return sendTransaction({
      to: params.userWalletAddress,
      data: calldata,
    });
  };

  return {
    sendDeposit,
    sendTransfer,
    sendWithdraw,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

