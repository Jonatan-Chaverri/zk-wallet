'use client';

import { useEffect } from 'react';
import { useWatchContractEvent } from 'wagmi';
import { useWalletStore } from '../lib/store/walletStore';
import { confidentialERC20Abi } from '../lib/contracts/confidentialERC20';
import type { Address } from 'viem';

export function useEvents(contractAddress?: Address) {
  const { addTransaction } = useWalletStore();

  // Watch for Deposit events
  useWatchContractEvent({
    address: contractAddress,
    abi: confidentialERC20Abi,
    eventName: 'Deposit',
    onLogs(logs) {
      logs.forEach((log) => {
        addTransaction({
          hash: log.transactionHash,
          type: 'deposit',
          token: log.args.token || '',
          amount: log.args.plain_amount?.toString(),
          from: log.args.from || '',
          to: log.args.to || '',
          timestamp: Date.now(),
          status: 'success',
        });
      });
    },
  });

  // Watch for Withdraw events
  useWatchContractEvent({
    address: contractAddress,
    abi: confidentialERC20Abi,
    eventName: 'Withdraw',
    onLogs(logs) {
      logs.forEach((log) => {
        addTransaction({
          hash: log.transactionHash,
          type: 'withdraw',
          token: log.args.token || '',
          amount: log.args.plain_amount?.toString(),
          from: log.args.from || '',
          to: log.args.to || '',
          timestamp: Date.now(),
          status: 'success',
        });
      });
    },
  });

  // Watch for TransferConfidential events
  useWatchContractEvent({
    address: contractAddress,
    abi: confidentialERC20Abi,
    eventName: 'TransferConfidential',
    onLogs(logs) {
      logs.forEach((log) => {
        addTransaction({
          hash: log.transactionHash,
          type: 'transfer',
          token: log.args.token || '',
          from: log.args.from || '',
          to: log.args.to || '',
          timestamp: Date.now(),
          status: 'success',
        });
      });
    },
  });
}
