import { Address } from 'viem';
import type { Ciphertext, BabyJubKeyPair } from '../types';

/**
 * Normalize API base URL to ensure it has a protocol
 * If no protocol is provided, defaults to https://
 */
function normalizeApiUrl(url: string): string {
  if (!url) {
    return 'http://localhost:3001';
  }
  
  // If URL already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Otherwise, prepend https://
  return `https://${url}`;
}

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

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
 * Clear the config cache (useful for retries or when config might have changed)
 */
export function clearConfigCache() {
  configCache = null;
}

/**
 * API client for backend interactions
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Ensure baseUrl doesn't end with a slash and endpoint starts with one
    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;
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
   * Get application configuration from backend
   */
  async getConfig(): Promise<AppConfig> {
    if (configCache) {
      return configCache;
    }

    const response = await this.request<ApiResponse<{ 
      config: {
        rpc_url: string;
        confidential_erc20: string;
      }
    }>>(
      '/api/config',
      {
        method: 'GET',
      }
    );
    
    // Map snake_case from backend to camelCase for frontend
    const mappedConfig: AppConfig = {
      chainId: '', // Not provided by backend currently
      rpcUrl: response.config.rpc_url,
      confidentialERC20: response.config.confidential_erc20,
      defaultWalletAddress: '', // Not provided by backend currently
    };
    
    configCache = mappedConfig;
    return mappedConfig;
  }

  /**
   * Get user by address or username
   */
  async getUser(params: { address?: string; username?: string }): Promise<{
    success: boolean;
    user: {
      id: string;
      name: string;
      address: string;
      public_key_x: string | null;
      public_key_y: string | null;
      created_at: string;
    } | null;
  }> {
    const queryParams = new URLSearchParams();
    if (params.address) queryParams.append('address', params.address);
    if (params.username) queryParams.append('username', params.username);

    try {
      const response = await this.request<{
        success: boolean;
        user: {
          id: string;
          name: string;
          address: string;
          public_key_x: string | null;
          public_key_y: string | null;
          created_at: string;
        };
      }>(
        `/api/getUser?${queryParams.toString()}`,
        {
          method: 'GET',
        }
      );
      return response;
    } catch (error) {
      return {
        success: false,
        user: null,
      };
    }
  }

  /**
   * Register a new user
   */
  async register(params: {
    address: string;
    username: string;
    publicKey: {
      x: string;
      y: string;
    };
  }): Promise<{
    success: boolean;
    user: {
      id: string;
      address: string;
      username: string;
      created_at: string;
    };
    publicKey: {
      x: string;
      y: string;
    };
  }> {
    const response = await this.request<{
      success: boolean;
      user: {
        id: string;
        address: string;
        username: string;
        created_at: string;
      };
      publicKey: {
        x: string;
        y: string;
      };
    }>(
      '/api/register',
      {
        method: 'POST',
        body: JSON.stringify({
          address: params.address,
          username: params.username,
          publicKey: params.publicKey,
        }),
      }
    );
    return response;
  }

  /**
   * Get available tokens
   */
  async getTokens(): Promise<{
    tokens: Array<{
      name: string;
      network: string;
      address: string;
    }>;
  }> {
    const response = await this.request<{
      tokens: Array<{
        name: string;
        network: string;
        address: string;
      }>;
    }>(
      '/api/tokens',
      {
        method: 'GET',
      }
    );
    return response;
  }

  /**
   * Register a user's public key in ConfidentialERC20
   */
  async registerPublicKey(params: {
    confidentialERC20: Address;
    userWalletAddress: Address;
    publicKey: {
      x: string;
      y: string;
    };
  }): Promise<string> {
    const response = await this.request<{
      success: boolean;
      txHash: string;
    }>(
      '/api/wallet/register-pk',
      {
        method: 'POST',
        body: JSON.stringify({
          confidentialERC20: params.confidentialERC20,
          userWalletAddress: params.userWalletAddress,
          publicKey: params.publicKey,
        }),
      }
    );
    return response.txHash;
  }

  /**
   * Delete a user by address
   */
  async deleteUser(address: string): Promise<{
    success: boolean;
    message: string;
    deletedUser: {
      id: string;
      address: string;
      username: string;
    };
  }> {
    const response = await this.request<{
      success: boolean;
      message: string;
      deletedUser: {
        id: string;
        address: string;
        username: string;
      };
    }>(
      '/api/deleteUser',
      {
        method: 'POST',
        body: JSON.stringify({
          address,
        }),
      }
    );
    return response;
  }

  /**
   * Register a transaction
   */
  async registerTransaction(params: {
    tx_hash: string;
    type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
    token?: string | null;
    amount?: string | null;
    sender_address?: string | null;
    receiver_address?: string | null;
  }): Promise<{
    success: boolean;
    transaction: {
      id: string;
      tx_hash: string;
      type: string;
      status: string;
      token: string | null;
      amount: string | null;
      sender_address: string | null;
      receiver_address: string | null;
      contract_id: string | null;
      created_at: string;
    };
  }> {
    const response = await this.request<{
      success: boolean;
      transaction: {
        id: string;
        tx_hash: string;
        type: string;
        status: string;
        token: string | null;
        amount: string | null;
        sender_address: string | null;
        receiver_address: string | null;
        contract_id: string | null;
        created_at: string;
      };
    }>(
      '/api/transaction',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

