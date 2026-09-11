import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests run beside the developer's server, with separate locks/cache.
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
