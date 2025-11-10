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
   * Get user by address or username
   */
  async getUser(params: { address?: string; username?: string }): Promise<{
    success: boolean;
    user: {
      id: string;
      name: string;
      address: string;
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
  }): Promise<{
    success: boolean;
    user: {
      id: string;
      address: string;
      username: string;
      created_at: string;
    };
    secret: string;
  }> {
    const response = await this.request<{
      success: boolean;
      user: {
        id: string;
        address: string;
        username: string;
        created_at: string;
      };
      secret: string;
    }>(
      '/api/register',
      {
        method: 'POST',
        body: JSON.stringify({
          address: params.address,
          username: params.username,
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
}

export const apiClient = new ApiClient(API_BASE_URL);

