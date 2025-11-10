import { Chain, defineChain } from 'viem';
import { arbitrumSepolia, arbitrumGoerli, arbitrumNova } from 'viem/chains';

/**
 * Manually defined Arbitrum Nitro Devnet chain
 */
export const arbitrumNitroDev = defineChain({
  id: 412346, // 👈 must match your node's chainId
  name: 'Arbitrum Nitro Devnet',
  network: 'arbitrum-nitro-dev',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8547'],
    },
  },
});

export const getChainId = (chain: Chain) => {
  return (chain && 'id' in chain ? chain.id : undefined) || '23011913';
}

/**
 * Get the Arbitrum chain based on ARBITRUM_CHAIN environment variable
 * @returns The selected chain or defaults to arbitrumSepolia
 */
export function getArbitrumChain(): Chain {
  const chainName = process.env.ARBITRUM_CHAIN || 'arbitrumSepolia';

  switch (chainName) {
    case 'arbitrumSepolia':
      return arbitrumSepolia;
    case 'arbitrumGoerli':
      return arbitrumGoerli;
    case 'arbitrumNova':
      return arbitrumNova;
    case 'arbitrumNitroDev':
      return arbitrumNitroDev;
    default:
      console.warn(`Unknown ARBITRUM_CHAIN value: ${chainName}. Defaulting to arbitrumSepolia.`);
      return arbitrumSepolia;
  }
}

