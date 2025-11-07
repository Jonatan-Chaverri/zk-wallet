import { Address } from 'viem';
import type { Ciphertext, BabyJubKeyPair } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  [key: string]: any;
}

export interface AppConfig {
  chainId: string;
  rpcUrl: string;
  confidentialERC20: string;
  defaultWalletAddress: string;
}

let configCache: AppConfig | null = null;

/**
 * API client for backend interactions
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Deploy a new UserWallet contract
   */
  async deployWallet(params: {
    owner: Address;
    confidentialERC20: Address;
  }): Promise<Address> {
    const response = await this.request<ApiResponse<{ walletAddress: Address }>>(
      '/api/wallet/deploy',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.walletAddress;
  }

  /**
   * Register user's public key in ConfidentialERC20
   */
  async registerPublicKey(params: {
    confidentialERC20: Address;
    userWalletAddress: Address;
    publicKey: BabyJubKeyPair['publicKey'];
  }): Promise<string> {
    const response = await this.request<ApiResponse<{ txHash: string }>>(
      '/api/wallet/register-pk',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.txHash;
  }

  /**
   * Submit a deposit transaction
   */
  async submitDeposit(params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    amount: string;
    newBalance: Ciphertext;
    to: Address;
  }): Promise<string> {
    const response = await this.request<ApiResponse<{ txHash: string }>>(
      '/api/transaction/deposit',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.txHash;
  }

  /**
   * Submit a transfer transaction
   */
  async submitTransfer(params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    recipient: Address;
    fromNewBalance: Ciphertext;
    toNewBalance: Ciphertext;
    proofInputs: string;
    proof: string;
  }): Promise<string> {
    const response = await this.request<ApiResponse<{ txHash: string }>>(
      '/api/transaction/transfer',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.txHash;
  }

  /**
   * Submit a withdraw transaction
   */
  async submitWithdraw(params: {
    userWalletAddress: Address;
    tokenAddress: Address;
    recipient: Address;
    newBalance: Ciphertext;
    proofInputs: string;
    proof: string;
  }): Promise<string> {
    const response = await this.request<ApiResponse<{ txHash: string }>>(
      '/api/transaction/withdraw',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.txHash;
  }

  /**
   * Get application configuration from backend
   */
  async getConfig(): Promise<AppConfig> {
    if (configCache) {
      return configCache;
    }

    const response = await this.request<ApiResponse<{ config: AppConfig }>>(
      '/api/config',
      {
        method: 'GET',
      }
    );
    
    configCache = response.config;
    return response.config;
  }

  /**
   * Get encrypted balance for a user
   */
  async getEncryptedBalance(token: Address, user: Address): Promise<Ciphertext> {
    const response = await this.request<ApiResponse<{ balance: Ciphertext }>>(
      `/api/config/balance?token=${token}&user=${user}`,
      {
        method: 'GET',
      }
    );
    return response.balance;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

