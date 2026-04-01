import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Append connection_limit to DATABASE_URL if not already set.
// This caps how many connections each serverless instance opens.
// Supabase transaction pooler defaults to pool_size=15, shared across
// ALL serverless instances — without this, a single instance can exhaust it.
function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (url.includes('connection_limit')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=3`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    datasources: {
      db: { url: getDatasourceUrl() },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
