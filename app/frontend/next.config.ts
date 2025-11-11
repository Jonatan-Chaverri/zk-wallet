import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,       // enable recommended defaults
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 👇 most important — make sure we do NOT statically export
  output: undefined,

  // 👇 optional — helpful for dynamic apps
  typedRoutes: false,

  // WebAssembly support for confidential-transfers and Noir
  webpack: (config, { isServer }) => {
    // Enable WebAssembly experiments
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Configure .wasm file handling
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Resolve 'wbg' module to the shim (used by wasm-bindgen generated code)
    config.resolve.alias = {
      ...config.resolve.alias,
      wbg: require.resolve('./wbg-shim.js'),
    };

    return config;
  },
};

export default nextConfig;
