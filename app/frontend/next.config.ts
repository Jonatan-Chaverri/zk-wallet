import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,       // enable recommended defaults
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    // Don't fail build on ESLint errors (warnings will still be shown)
    ignoreDuringBuilds: true,
  },

  // 👇 most important — make sure we do NOT statically export
  output: undefined,

  // 👇 optional — helpful for dynamic apps
  typedRoutes: false,

  // Webpack config to ignore optional dependencies and enable WebAssembly
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
      'wbg': false, // Ignore wbg module used by wasm-bindgen
    };

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Add rule for WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Handle 'wbg' module - it's a webpack-specific module used by wasm-bindgen
    // Alias it to an empty shim module
    if (!isServer) {
      const path = require('path');
      config.resolve.alias = {
        ...config.resolve.alias,
        'wbg': path.resolve(__dirname, 'wbg-shim.js'),
      };
    }

    // Ignore warnings about optional dependencies
    config.ignoreWarnings = [
      { module: /@react-native-async-storage\/async-storage/ },
      { module: /pino-pretty/ },
      /Failed to parse source map/,
    ];

    return config;
  },
};

export default nextConfig;
