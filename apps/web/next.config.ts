import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@wordcourt/shared'],
  experimental: {
    // Surface async/await-driven server actions and viem optimisations
    optimizePackageImports: ['lucide-react', '@wordcourt/shared'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  webpack(config) {
    // pino uses dynamic requires that webpack can't statically analyse; mark as externals
    // on the client to keep the server logger out of the bundle.
    config.externals = [...(config.externals ?? []), 'pino-pretty', 'lokijs', 'encoding'];
    // @metamask/sdk (pulled in by wagmi/RainbowKit's MetaMask connector) imports a
    // React-Native-only storage module on the browser entry. Alias it to `false` so
    // webpack treats it as absent rather than emitting a Module-not-found warning.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
