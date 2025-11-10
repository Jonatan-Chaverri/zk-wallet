import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,       // enable recommended defaults
  typescript: {
    ignoreBuildErrors: true,
  },

  // 👇 most important — make sure we do NOT statically export
  output: undefined,

  // 👇 optional — helpful for dynamic apps
  experimental: {
    typedRoutes: false,
  },

  // Webpack config to ignore optional dependencies
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    // Ignore warnings about optional dependencies
    config.ignoreWarnings = [
      { module: /@react-native-async-storage\/async-storage/ },
      { module: /pino-pretty/ },
    ];

    return config;
  },
};

export default nextConfig;
