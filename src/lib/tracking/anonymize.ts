/**
 * DL-01: IP Anonymization on Ingestion
 *
 * LEGAL NON-NEGOTIABLE: Raw IP addresses must NEVER be written to the database.
 * This module runs synchronously on the ingestion API before any database write.
 *
 * What we store:
 *   - ipHash: SHA-256 of (ip + site-specific salt). One-way. Cannot be reversed.
 *   - country: Derived from IP via geolocation lookup, then IP is discarded.
 *   - region: Optional, derived from IP, then IP is discarded.
 *
 * What we NEVER store:
 *   - Raw IP address
 *   - Full geolocation (city, lat/lng)
 *   - Any data that could re-identify a visitor
 *
 * Used by:
 *   - src/app/api/ingest/route.ts (session ingestion)
 *   - src/app/api/onboarding/route.ts (DPA acceptance logging)
 */

import { createHash } from 'crypto';

// geoip-lite is lazy-loaded inside anonymizeRequest() so it doesn't run
// at module-import time. Next.js's "Collecting page data" build step
// evaluates imports, and geoip-lite tries to fs.openSync its .dat files
// at that point — which fail because the serverless bundle isn't fully
// constructed yet. Deferring the require to first-request time avoids
// the build-time ENOENT and only costs a few ms of cold-start latency.
type GeoLookup = (ip: string) => { country?: string; region?: string } | null;
let geoipLookup: GeoLookup | null = null;
function getGeoipLookup(): GeoLookup {
  if (!geoipLookup) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require('geoip-lite');
    geoipLookup = geoip.lookup as GeoLookup;
  }
  return geoipLookup;
}

/**
 * Hash an IP address with a site-specific salt.
 * The salt ensures that the same IP on two different sites produces different hashes,
 * preventing cross-site visitor tracking.
 *
 * @param ip - Raw IP address (IPv4 or IPv6). Discarded after hashing.
 * @param siteId - Site ID used as salt component.
 * @returns One-way hash safe to store in the database.
 */
export function hashIp(ip: string, siteId: string): string {
  // Normalize IPv6 loopback to IPv4 form
  const normalizedIp = ip === '::1' ? '127.0.0.1' : ip;

  // Site-specific salt prevents cross-site correlation
  const saltedInput = `${normalizedIp}:${siteId}:webgrade-v1`;

  return createHash('sha256').update(saltedInput).digest('hex');
}

/**
 * Extract country and region from an IP address using Vercel's geo headers.
 * If not available (local dev, non-Vercel), returns null.
 *
 * Vercel injects these headers automatically in production:
 *   x-vercel-ip-country: "US"
 *   x-vercel-ip-country-region: "CA"
 *
 * @param headers - Request headers object
 * @returns { country, region } or nulls if not available
 */
export function extractGeoFromHeaders(headers: Headers): {
  country: string | null;
  region: string | null;
} {
  // Vercel edge: primary source
  const vercelCountry = headers.get('x-vercel-ip-country');
  if (vercelCountry) {
    return {
      country: vercelCountry,
      region: headers.get('x-vercel-ip-country-region'),
    };
  }

  // Cloudflare CDN: fallback when CF sits in front of Vercel
  const cfCountry = headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return { country: cfCountry, region: null };
  }

  // AWS CloudFront / generic CDN headers
  const cfCloudFront = headers.get('cloudfront-viewer-country');
  if (cfCloudFront) {
    return { country: cfCloudFront, region: headers.get('cloudfront-viewer-country-region') };
  }

  return { country: null, region: null };
}

/**
 * Extract the real client IP from request headers.
 * Handles proxies and load balancers (Vercel, Cloudflare, etc.)
 *
 * IMPORTANT: This IP is used ONLY for hashing and geo extraction.
 * It is NEVER passed to any database write function.
 *
 * @param headers - Request headers object
 * @returns Raw IP string (to be hashed immediately, never stored)
 */
export function extractRawIp(headers: Headers): string {
  // Vercel: real client IP
  const vercelIp = headers.get('x-real-ip');
  if (vercelIp) return vercelIp;

  // Cloudflare: connecting IP
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Standard forwarded header (take first IP = original client)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  // Fallback for local dev
  return '127.0.0.1';
}

/**
 * Combined helper: extract and immediately hash the IP.
 * Call this at the top of any ingestion handler.
 * The raw IP never leaves this function.
 *
 * @param headers - Request headers
 * @param siteId - Site ID for per-site salt
 * @returns { ipHash, country, region } — all safe to store
 */
export function anonymizeRequest(
  headers: Headers,
  siteId: string
): {
  ipHash: string;
  country: string | null;
  region: string | null;
} {
  // 1. Extract raw IP (temporary, never stored)
  const rawIp = extractRawIp(headers);

  // 2. Hash immediately — rawIp is not returned or stored
  const ipHash = hashIp(rawIp, siteId);

  // 3. Extract geo from platform headers (Vercel, Cloudflare, CloudFront)
  const { country: headerCountry, region: headerRegion } = extractGeoFromHeaders(headers);

  // 4. Fall back to local geoip-lite lookup when no platform header provided geo data.
  //    Private/loopback IPs (127.0.0.1, ::1) return null from geoip.lookup() natively.
  //    rawIp is consumed here in-memory and never returned or persisted (DL-01).
  let country = headerCountry;
  let region = headerRegion;
  if (country === null && region === null) {
    const geo = getGeoipLookup()(rawIp);
    country = geo?.country ?? null;
    region = geo?.region ?? null;
  }

  // rawIp goes out of scope here and is never persisted
  return { ipHash, country, region };
}
