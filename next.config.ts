import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Subida del póster desde el panel admin (Vercel limita el cuerpo de una función a ~4.5 MB)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
