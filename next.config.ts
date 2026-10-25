
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.12"],

  reactStrictMode: true,

  experimental: {
    // Sube el límite del póster desde el panel admin.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
