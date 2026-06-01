/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    serverComponentsExternalPackages: ['pdfkit'],
  },
  // geoip-lite ships binary .dat databases that it loads from disk at runtime
  // via fs.openSync. Next.js's automatic tracing doesn't pick those up, so
  // builds fail with ENOENT on geoip-country.dat when collecting page data
  // for /api/ingest (the only route that pulls in anonymize.ts, which
  // imports geoip-lite). Explicitly include the data directory so the
  // serverless bundle ships them.
  outputFileTracingIncludes: {
    '/api/ingest': ['./node_modules/geoip-lite/data/**/*'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), '@prisma/client', 'prisma'];
    }
    return config;
  },
};
module.exports = nextConfig;
