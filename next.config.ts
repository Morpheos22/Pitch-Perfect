import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "sharp",
    "z-ai-web-dev-sdk",
    "resend",
  ],
};

export default nextConfig;
