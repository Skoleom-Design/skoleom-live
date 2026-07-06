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
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-dialog', 'framer-motion', 'lucide-react'],
  },
};

module.exports = nextConfig;
