/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  experimental: {
    outputFileTracing: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
