'use client';

import { useState, useEffect, useMemo } from 'react';
import { Contract, BrowserProvider, JsonRpcProvider } from 'ethers';
import { apiClient, clearConfigCache } from '../lib/utils/api';
import { useWallet } from './useWallet';
import { ensureArbitrumSepolia } from '../lib/utils/network';
import type { Address } from 'viem';
import type { Ciphertext } from '../lib/types';
import confidentialERC20Abi from '../lib/contracts/confidentialERC20Abi.json';
import { erc20Abi } from '../lib/contracts/erc20Abi';

interface ConfidentialERC20Config {
  address: Address;
  rpcUrl: string;
}

/**
 * Hook to interact with ConfidentialERC20 contract using ethers
 */
export function useConfidentialERC20() {
  const { address } = useWallet();
  const [config, setConfig] = useState<ConfidentialERC20Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config from backend with retry logic
  const fetchConfig = async (retryCount = 0): Promise<ConfidentialERC20Config | null> => {
    const maxRetries = 3;
    try {
      setIsLoading(true);
      const cfg = await apiClient.getConfig();
      
      // Validate that we have the required fields
      if (!cfg.confidentialERC20) {
        throw new Error('ConfidentialERC20 address not found in config');
      }
      if (!cfg.rpcUrl) {
        throw new Error('RPC URL not found in config');
      }

      const newConfig: ConfidentialERC20Config = {
        address: cfg.confidentialERC20 as Address,
        rpcUrl: cfg.rpcUrl,
      };

      setConfig(newConfig);
      setError(null);
      return newConfig;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch config';
      setError(errorMessage);
      console.error('Failed to fetch config:', err);
      
      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log(`Retrying config fetch (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return fetchConfig(retryCount + 1);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Get ethers provider
  const provider = useMemo(() => {
    if (!config) {
      return null;
    }

    // Try to get browser provider (MetaMask) first
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new BrowserProvider((window as any).ethereum);
    } else {
      // Fallback to RPC provider
      return new JsonRpcProvider(config.rpcUrl);
    }
  }, [config]);

  // Get contract instance
  const getContract = async (): Promise<Contract> => {
    // Ensure we're on Arbitrum Sepolia before any transaction
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      await ensureArbitrumSepolia();
    }

    // Validate config and address - fetch if missing
    let currentConfig = config;
    if (!currentConfig || !currentConfig.address) {
      // Clear cache and try to fetch config again if it's missing
      console.log('Config missing or invalid, clearing cache and attempting to fetch...');
      clearConfigCache();
      currentConfig = await fetchConfig();
      
      // Check again after retry
      if (!currentConfig || !currentConfig.address) {
        throw new Error('Contract address not configured. Please ensure the backend is running and configured correctly.');
      }
    }

    if (!currentConfig.address) {
      throw new Error('Contract address is undefined. Please check backend configuration.');
    }

    if (!provider) {
      throw new Error('Provider not available');
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Get signer for write operations
    if (provider instanceof BrowserProvider) {
      const signer = await provider.getSigner();
      return new Contract(currentConfig.address, confidentialERC20Abi, signer);
    } else {
      throw new Error('Cannot get signer: BrowserProvider not available. Please connect MetaMask.');
    }
  };

  // Get read-only contract instance (for view functions)
  const getReadOnlyContract = (): Contract | null => {
    if (!config || !config.address || !provider) {
      return null;
    }

    return new Contract(config.address, confidentialERC20Abi, provider);
  };

  /**
   * Register user public key
   */
  const registerUserPk = async (publicKey: Uint8Array | number[]): Promise<string> => {
    const contract = await getContract();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Convert to array of numbers if needed
    const pkArray = Array.isArray(publicKey) ? publicKey : Array.from(publicKey);
    console.log('Registering user public key:', pkArray);
    console.log('pkArray length:', pkArray.length);
    
    const tx = await contract.registerUserPk(pkArray);
    await tx.wait();
    return tx.hash;
  };

  /**
   * Get user public key
   */
  const getUserPk = async (userAddress: Address): Promise<Uint8Array> => {
    const readOnlyContract = getReadOnlyContract();
    if (!readOnlyContract) {
      throw new Error('Contract not available');
    }

    const pk = await readOnlyContract.getUserPk(userAddress);
    return new Uint8Array(pk.map((x: any) => Number(x)));
  };

  /**
   * Get encrypted balance
   */
  const balanceOfEnc = async (token: Address, user: Address): Promise<Uint8Array> => {
    const readOnlyContract = getReadOnlyContract();
    if (!readOnlyContract) {
      throw new Error('Contract not available');
    }

    const balance = await readOnlyContract.balanceOfEnc(token, user);
    // Convert BigNumber array to Uint8Array
    return new Uint8Array(balance.map((x: any) => Number(x)));
  };

  /**
   * Deposit tokens
   */
  const deposit = async (
    proofInputs: Uint8Array | number[],
    proof: Uint8Array | number[]
  ): Promise<string> => {
    const contract = await getContract();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Convert to arrays if needed
    const inputsArray = Array.isArray(proofInputs) ? proofInputs : Array.from(proofInputs);
    const proofArray = Array.isArray(proof) ? proof : Array.from(proof);

    // Estimate gas if possible, otherwise use a high gas limit for complex zk-proof transactions
    let gasLimit = BigInt(15000000); // Default high gas limit for zk-proof transactions
    try {
      const estimatedGas = await contract.deposit.estimateGas(inputsArray, proofArray);
      // Add 20% buffer to estimated gas
      gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
      console.log('Estimated gas:', estimatedGas.toString(), 'Using gas limit:', gasLimit.toString());
    } catch (err) {
      console.warn('Gas estimation failed, using default gas limit:', err);
      // Keep the default high gas limit
    }

    const tx = await contract.deposit(inputsArray, proofArray, { gasLimit });
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error('Deposit transaction failed');
    }

    return tx.hash;
  };

  /**
   * Withdraw tokens
   */
  const withdraw = async (
    proofInputs: Uint8Array | number[],
    proof: Uint8Array | number[]
  ): Promise<string> => {
    const contract = await getContract();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Convert to arrays if needed
    const inputsArray = Array.isArray(proofInputs) ? proofInputs : Array.from(proofInputs);
    const proofArray = Array.isArray(proof) ? proof : Array.from(proof);

    const tx = await contract.withdraw(inputsArray, proofArray);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Withdraw transaction failed');
    }

    return tx.hash;
  };

  /**
   * Transfer confidential tokens
   */
  const transferConfidential = async (
    proofInputs: Uint8Array | number[],
    proof: Uint8Array | number[]
  ): Promise<string> => {
    const contract = await getContract();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Convert to arrays if needed
    const inputsArray = Array.isArray(proofInputs) ? proofInputs : Array.from(proofInputs);
    const proofArray = Array.isArray(proof) ? proof : Array.from(proof);

    const tx = await contract.transferConfidential(inputsArray, proofArray);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Transfer transaction failed');
    }

    return tx.hash;
  };

  /**
   * Get contract owner
   */
  const getOwner = async (): Promise<Address> => {
    const readOnlyContract = getReadOnlyContract();
    if (!readOnlyContract) {
      throw new Error('Contract not available');
    }

    return (await readOnlyContract.getOwner()) as Address;
  };

  /**
   * Get verifier address
   */
  const getVerifier = async (): Promise<Address> => {
    const readOnlyContract = getReadOnlyContract();
    if (!readOnlyContract) {
      throw new Error('Contract not available');
    }

    return (await readOnlyContract.getVerifier()) as Address;
  };

  /**
   * Check if token is supported
   */
  const isSupportedToken = async (token: Address): Promise<boolean> => {
    const readOnlyContract = getReadOnlyContract();
    if (!readOnlyContract) {
      throw new Error('Contract not available');
    }

    return await readOnlyContract.isSupportedToken(token);
  };

  /**
   * Approve WETH token spending for ConfidentialERC20 contract
   */
  const approveWETH = async (
    wethAddress: Address,
    amount: bigint
  ): Promise<string> => {
    // Ensure we're on Arbitrum Sepolia before any transaction
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      await ensureArbitrumSepolia();
    }

    if (!provider) {
      throw new Error('Provider not available');
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!config || !config.address) {
      throw new Error('ConfidentialERC20 address not configured');
    }

    // Get signer for write operations
    if (!(provider instanceof BrowserProvider)) {
      throw new Error('Cannot get signer: BrowserProvider not available. Please connect MetaMask.');
    }

    const signer = await provider.getSigner();
    const wethContract = new Contract(wethAddress, erc20Abi, signer);

    // Check current allowance
    const currentAllowance = await wethContract.allowance(address, config.address);
    
    // Only approve if current allowance is less than required amount
    if (currentAllowance < amount) {
      console.log(`Approving WETH transfer: ${amount.toString()} wei to ${config.address}`);
      const tx = await wethContract.approve(config.address, amount);
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('WETH approval transaction failed');
      }

      console.log('✅ WETH approved. Transaction hash:', tx.hash);
      return tx.hash;
    } else {
      console.log('WETH already approved with sufficient allowance');
      return 'already_approved';
    }
  };

  return {
    // State
    isLoading,
    error,
    isConfigured: !!config && !!address,
    contractAddress: config?.address,

    // Contract methods
    registerUserPk,
    getUserPk,
    balanceOfEnc,
    deposit,
    withdraw,
    transferConfidential,
    approveWETH,
    getOwner,
    getVerifier,
    isSupportedToken
  };
}

