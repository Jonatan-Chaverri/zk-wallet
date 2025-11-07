'use client';

import { createConfig, WagmiProvider, http } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
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

export function Providers({ children }: { children: React.ReactNode }) {
  const [wagmiConfig, setWagmiConfig] = useState<ReturnType<typeof createConfig> | null>(null);

  useEffect(() => {
    // Fetch RPC URL from backend
    apiClient.getConfig().then((cfg) => {
      const config = createConfig({
        chains: [arbitrumSepolia],
        transports: {
          [arbitrumSepolia.id]: http(cfg.rpcUrl),
        },
      });
      setWagmiConfig(config);
    }).catch((err) => {
      console.error('Failed to fetch config, using default:', err);
      // Fallback to default
      const config = createConfig({
        chains: [arbitrumSepolia],
        transports: {
          [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
        },
      });
      setWagmiConfig(config);
    });
  }, []);

  if (!wagmiConfig) {
    // Loading state - could show a loading spinner here
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
