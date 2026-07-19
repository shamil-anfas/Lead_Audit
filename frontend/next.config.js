/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for the Docker multi-stage build (copies a self-contained server to .next/standalone)
  output: 'standalone',
}

module.exports = nextConfig
