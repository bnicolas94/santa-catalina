import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@santa-catalina/contracts'],
  poweredByHeader: false,
}

export default nextConfig
