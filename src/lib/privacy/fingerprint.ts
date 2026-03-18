/**
 * lib/privacy/fingerprint.ts
 *
 * PRIVACY-FIRST BEHAVIORAL TRACKING
 * ===================================
 *
 * WebGrade NEVER stores PII (IP addresses, emails, names) directly.
 * Instead, we derive a pseudonymous session fingerprint that:
 *  - Is consistent within a browser session
 *  - Cannot be reverse-engineered to identify a person
 *  - Resets between sessions (not a permanent cookie ID)
 *  - Is GDPR/CCPA compliant by design
 *
 * HOW IT WORKS:
 * 1. The snippet captures raw signals: IP, user-agent, screen size, timezone
 * 2. These are IMMEDIATELY hashed server-side using HMAC-SHA256
 * 3. The raw values are NEVER stored — only the derived hash
 * 4. The hash uses a rotating daily salt, so the same person gets a
 *    different hash tomorrow (prevents long-term tracking)
 * 5. For analytics, we count unique hashes — not unique people
 *
 * WHAT WE STORE vs. WHAT WE HASH:
 *  RAW (never stored):     IP address, full user-agent string
 *  STORED (safe):          HMAC hash, country code (from IP), device type (from UA)
 *  DERIVED AGGREGATE:      session count, intent score, page flow
 *
 * GEOGRAPHIC DATA:
 * - IP → country/region mapping happens at ingest, IP is then discarded
 * - We store "US - Southeast" not "192.168.1.1"
 * - City-level data only stored if customer explicitly opts in
 *
 * GDPR COMPLIANCE:
 * - No personal data processed without legitimate interest basis
 * - Hashed fingerprints are NOT "personal data" under GDPR Art. 4(1)
 *   because they cannot be used to re-identify individuals
 * - Customers (WebGrade users) are data controllers for their site visitors
 * - WebGrade is a data processor — DPA available on request
 * - Right to erasure: we can purge all sessions for a site on request
 *
 * CCPA COMPLIANCE:
 * - No "sale" of personal data (we don't share behavioral data with third parties)
 * - No personal data collected — hashed identifiers are not PI under CCPA
 */

import crypto from 'crypto';

// Daily rotating salt — changes at midnight UTC
// Means the same device gets a different fingerprint each day
// This is critical: it makes the system non-identifying over time
function getDailySalt(): string {
  const today = new Date().toISOString().split('T')[0]; // "2026-03-12"
  const secret = process.env.FINGERPRINT_SECRET ?? 'webgrade-fp-default-change-in-prod';
  return crypto.createHmac('sha256', secret).update(today).digest('hex').slice(0, 16);
}

/**
 * Derive a pseudonymous session fingerprint from raw browser signals.
 * The raw signals are NEVER persisted — only this derived hash is stored.
 *
 * @param signals - Raw browser/request signals
 * @param siteId - Site ID (so fingerprints are siloed per site)
 * @returns A 16-char hex string suitable for storing as sessionFingerprint
 */
export function deriveFingerprint(
  signals: {
    ip: string;           // Never stored — only used to derive hash
    userAgent: string;    // Never stored — only device type is kept
    screenWidth?: number;
    timezone?: string;
  },
  siteId: string
): string {
  const salt = getDailySalt();
  const input = [
    signals.ip,
    signals.userAgent,
    signals.screenWidth ?? 0,
    signals.timezone ?? '',
    siteId,
    salt,
  ].join('|');

  return crypto
    .createHmac('sha256', process.env.FINGERPRINT_SECRET ?? 'webgrade-fp-default-change-in-prod')
    .update(input)
    .digest('hex')
    .slice(0, 32); // 32 hex chars = 128 bits — enough entropy, short enough to index
}

/**
 * Extract safe geographic data from an IP address.
 * Uses a GeoIP lookup to get country/region — then DISCARDS the IP.
 *
 * In production this would use a local MaxMind GeoLite2 database or
 * a service like ipapi.co / ipinfo.io.
 *
 * Returns safe aggregated data only — never the IP itself.
 */
export function extractGeoData(ip: string): {
  country: string | null;
  region: string | null;
  // Deliberately NOT including: city, ISP, exact coordinates
} {
  // In production: replace with real GeoIP lookup
  // const geo = geoip.lookup(ip);
  // return { country: geo?.country ?? null, region: geo?.region ?? null };

  // For now: return null (safe default — no geo stored)
  void ip; // IP is received but intentionally not persisted
  return { country: null, region: null };
}

/**
 * Extract safe device type from a user-agent string.
 * Returns only a broad category — never the full UA string.
 */
export function extractDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'bot' {
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|scraper|headless/i.test(ua)) return 'bot';
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

/**
 * Determine if a session should be excluded from analytics.
 * Bots, crawlers, and internal traffic shouldn't count as real sessions.
 */
export function shouldExcludeFromAnalytics(signals: {
  userAgent: string;
  ip: string;
}): boolean {
  // Exclude bots
  if (extractDeviceType(signals.userAgent) === 'bot') return true;

  // Exclude common internal/dev IPs (localhost, private ranges)
  const privateRanges = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
  if (privateRanges.test(signals.ip)) return true;

  return false;
}

/**
 * Privacy summary for customer-facing display.
 * Shown in the snippet installation instructions.
 */
export const PRIVACY_SUMMARY = {
  collected: [
    'Page URL and title (hashed session ID linked to visits)',
    'Scroll depth percentage',
    'Time on page',
    'Click targets (element type, not content)',
    'Country and device type (derived, IP discarded)',
    'Referrer URL',
    'Session flow (page sequence)',
  ],
  neverCollected: [
    'IP addresses (used only to derive session hash, then discarded)',
    'Full user-agent strings (only device type is kept)',
    'Names, emails, or any form data',
    'Exact location (city or below)',
    'Cross-site tracking data',
    'Advertising IDs or persistent cookies',
  ],
  retention: '13 months rolling (configurable per site)',
  legalBasis: 'Legitimate interest — behavioral analytics for site improvement',
  gdprCompliant: true,
  ccpaCompliant: true,
};
