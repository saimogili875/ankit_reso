import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const rawOrigin = (
  process.env.BACKEND_ORIGIN ||
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
    ? process.env.NEXT_PUBLIC_API_URL
    : '') ||
  'https://ankit-reso.onrender.com'
);

if (isProduction) {
  if (!rawOrigin || rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1')) {
    throw new Error(
      `[CRITICAL CONNECTION ERROR] Production builds (NODE_ENV=production or VERCEL=1) require ` +
      `BACKEND_ORIGIN (e.g. 'https://ankit-reso.onrender.com') or an absolute NEXT_PUBLIC_API_URL ` +
      `pointing to the remote production backend. Refusing to build with localhost or empty origin.`
    );
  }
}

const effectiveOrigin = rawOrigin || 'http://localhost:8000';
const backendOrigin = effectiveOrigin.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  // Suppress dev-mode cross-origin warnings when switching between localhost and 127.0.0.1
  allowedDevOrigins: ['127.0.0.1:3000', 'localhost:3000'],
  async redirects() {
    return [
      {
        source: '/batches',
        destination: '/courses',
        permanent: true,
      },
      {
        source: '/batches/:path*',
        destination: '/courses/:path*',
        permanent: true,
      },
      {
        source: '/admin/batches',
        destination: '/admin/courses',
        permanent: true,
      },
      {
        source: '/admin/pricing-cards',
        destination: '/admin/courses',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
