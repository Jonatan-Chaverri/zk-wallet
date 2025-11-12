import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,       // enable recommended defaults
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
  webpack: (config) => {
    config.experiments = {
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    };
    return config
  },
};

export default nextConfig;
