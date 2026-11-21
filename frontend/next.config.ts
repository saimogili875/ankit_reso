import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress dev-mode cross-origin warnings when switching between localhost and 127.0.0.1
  allowedDevOrigins: ['127.0.0.1:3000', 'localhost:3000'],
  async rewrites() {
    const rawOrigin = (
      process.env.BACKEND_ORIGIN ||
      (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
        ? process.env.NEXT_PUBLIC_API_URL
        : 'http://localhost:8000')
    );
    const backendOrigin = rawOrigin.replace(/\/api\/?$/, '').replace(/\/+$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
