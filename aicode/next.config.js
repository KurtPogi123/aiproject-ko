/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: './',  // ← This fixes the CSS/JS paths!
  images: { unoptimized: true },
};

module.exports = nextConfig;