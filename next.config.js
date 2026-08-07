/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      process.env.S3_BUCKET_DOMAIN || 'skoleom-live.s3.amazonaws.com',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Ces rewrites gerent le HTTP classique. Les upgrades WebSocket (/socket.io/*) ne passent
  // PAS par ici — Next ne les proxie pas via rewrites() — voir server.js pour ce cas.
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${apiUrl}/static/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-dialog', 'framer-motion', 'lucide-react'],
  },
};

module.exports = nextConfig;
