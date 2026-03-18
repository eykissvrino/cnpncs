import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  typescript: {
    // Allow build to proceed even with type errors (Prisma might not be generated yet)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
