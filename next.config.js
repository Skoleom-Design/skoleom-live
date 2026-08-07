/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      process.env.S3_BUCKET_DOMAIN || 'skoleom-live.s3.amazonaws.com',
    ],
    formats: ['image/avif', 'image/webp'],
  },
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
    ];
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-dialog', 'framer-motion', 'lucide-react'],
  },
};

module.exports = nextConfig;
