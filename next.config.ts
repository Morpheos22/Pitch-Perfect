import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  serverExternalPackages: [
    "sharp",
    "z-ai-web-dev-sdk",
    "resend",
    "pdf-parse",
    "mammoth",
    "jszip",
  ],
};

export default nextConfig;
