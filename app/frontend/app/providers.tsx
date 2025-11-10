'use client';

import { createConfig, WagmiProvider, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { apiClient } from './lib/utils/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Create config synchronously with default RPC URL to ensure WagmiProvider is always available
const defaultRpcUrl = 'https://sepolia-rollup.arbitrum.io/rpc';
const defaultConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(defaultRpcUrl),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [wagmiConfig, setWagmiConfig] = useState<ReturnType<typeof createConfig>>(defaultConfig);

  useEffect(() => {
    // Fetch RPC URL from backend and update config if different
    apiClient.getConfig().then((cfg) => {
      if (cfg.rpcUrl !== defaultRpcUrl) {
        const config = createConfig({
          chains: [arbitrumSepolia],
          connectors: [injected()],
          transports: {
            [arbitrumSepolia.id]: http(cfg.rpcUrl),
          },
        });
        setWagmiConfig(config);
      }
    }).catch((err) => {
      console.error('Failed to fetch config, using default:', err);
      // Keep using default config
    });
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
