/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    serverComponentsExternalPackages: ['pdfkit'],
    // geoip-lite ships binary .dat databases that it loads from disk at runtime
    // via fs.openSync. Next.js's automatic tracing doesn't pick those up, so
    // we explicitly include the data directory so the serverless bundle
    // ships them. (Lazy-loaded in anonymize.ts to avoid build-time module-eval
    // ENOENT during "Collecting page data".) In Next 14 this key lives under
    // experimental; it moved to top-level in Next 15.
    outputFileTracingIncludes: {
      '/api/ingest': ['./node_modules/geoip-lite/data/**/*'],
    },
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
