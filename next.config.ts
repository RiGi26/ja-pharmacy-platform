import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'japanarenacorp.com',
        '*.japanarenacorp.com',
        '*.vercel.app',
      ],
    },
  },
  images: {
    domains: ['japanarenacorp.com'],
  },
  async headers() {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
