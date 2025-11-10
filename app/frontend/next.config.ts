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
};

export default nextConfig;
