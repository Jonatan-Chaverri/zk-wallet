/**
 * Network utilities for ensuring transactions are on Arbitrum Sepolia
 */

// Arbitrum Sepolia chain ID
export const ARBITRUM_SEPOLIA_CHAIN_ID = BigInt(421614);

// Arbitrum Sepolia network configuration for MetaMask
export const ARBITRUM_SEPOLIA_NETWORK = {
  chainId: `0x${ARBITRUM_SEPOLIA_CHAIN_ID.toString(16)}`, // 0x66eee
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io'],
};

/**
 * Check if the wallet is connected to Arbitrum Sepolia
 */
export async function isOnArbitrumSepolia(): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    return false;
  }

  try {
    const chainId = await (window as any).ethereum.request({
      method: 'eth_chainId',
    });
    const chainIdNumber = BigInt(chainId);
    return chainIdNumber === ARBITRUM_SEPOLIA_CHAIN_ID;
  } catch (error) {
    console.error('Error checking chain ID:', error);
    return false;
  }
}

/**
 * Switch to Arbitrum Sepolia network
 * If the network is not added, it will be added first
 */
export async function switchToArbitrumSepolia(): Promise<void> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // First, try to switch to the network
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARBITRUM_SEPOLIA_NETWORK.chainId }],
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        // Add the network to MetaMask
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARBITRUM_SEPOLIA_NETWORK],
        });
      } catch (addError) {
        console.error('Error adding Arbitrum Sepolia network:', addError);
        throw new Error(
          'Failed to add Arbitrum Sepolia network. Please add it manually in MetaMask.'
        );
      }
    } else {
      // Other error (e.g., user rejected the request)
      console.error('Error switching to Arbitrum Sepolia:', switchError);
      throw new Error(
        'Failed to switch to Arbitrum Sepolia network. Please switch manually in MetaMask.'
      );
    }
  }
}

/**
 * Ensure the wallet is on Arbitrum Sepolia
 * If not, attempt to switch to it
 */
export async function ensureArbitrumSepolia(): Promise<void> {
  const isOnCorrectNetwork = await isOnArbitrumSepolia();
  
  if (!isOnCorrectNetwork) {
    await switchToArbitrumSepolia();
    
    // Verify the switch was successful
    const verifyNetwork = await isOnArbitrumSepolia();
    if (!verifyNetwork) {
      throw new Error(
        'Failed to switch to Arbitrum Sepolia. Please switch manually in MetaMask.'
      );
    }
  }
}

