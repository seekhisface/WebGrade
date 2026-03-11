/**
 * P1-05: Bot Filtering + Traffic Exclusion
 * Server-side companion to client-side pre-filtering in snippet.
 *
 * Used by: src/app/api/ingest/route.ts
 */

interface BotCheckResult {
  isBot: boolean;
  reason: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
}

interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  browser: string | null;
  os: string | null;
}

// Known bot user agent patterns
const BOT_PATTERNS: Array<{ pattern: RegExp; name: string; confidence: 'high' | 'medium' }> = [
  // Search engines
  { pattern: /googlebot/i, name: 'Googlebot', confidence: 'high' },
  { pattern: /bingbot/i, name: 'Bingbot', confidence: 'high' },
  { pattern: /slurp/i, name: 'Yahoo Slurp', confidence: 'high' },
  { pattern: /duckduckbot/i, name: 'DuckDuckBot', confidence: 'high' },
  { pattern: /baiduspider/i, name: 'Baidu Spider', confidence: 'high' },
  { pattern: /yandexbot/i, name: 'Yandex Bot', confidence: 'high' },

  // SEO crawlers (common — should be excluded from behavioral data)
  { pattern: /semrushbot/i, name: 'SEMrush Bot', confidence: 'high' },
  { pattern: /ahrefsbot/i, name: 'Ahrefs Bot', confidence: 'high' },
  { pattern: /mj12bot/i, name: 'Majestic Bot', confidence: 'high' },
  { pattern: /dotbot/i, name: 'OpenLinkProfiler', confidence: 'high' },
  { pattern: /rogerbot/i, name: 'Moz Rogerbot', confidence: 'high' },
  { pattern: /screaming frog/i, name: 'Screaming Frog', confidence: 'high' },

  // Headless browsers / automation (critical to exclude)
  { pattern: /headlesschrome/i, name: 'Headless Chrome', confidence: 'high' },
  { pattern: /phantomjs/i, name: 'PhantomJS', confidence: 'high' },
  { pattern: /selenium/i, name: 'Selenium', confidence: 'high' },
  { pattern: /puppeteer/i, name: 'Puppeteer', confidence: 'high' },
  { pattern: /playwright/i, name: 'Playwright', confidence: 'high' },

  // Archive / monitoring
  { pattern: /ia_archiver/i, name: 'Internet Archive', confidence: 'high' },
  { pattern: /facebot/i, name: 'Facebook Scraper', confidence: 'high' },
  { pattern: /uptimerobot/i, name: 'UptimeRobot', confidence: 'high' },
  { pattern: /pingdom/i, name: 'Pingdom', confidence: 'high' },

  // Generic patterns (lower confidence)
  { pattern: /\bbot\b/i, name: 'Generic Bot', confidence: 'medium' },
  { pattern: /\bcrawler\b/i, name: 'Generic Crawler', confidence: 'medium' },
  { pattern: /\bspider\b/i, name: 'Generic Spider', confidence: 'medium' },
  { pattern: /\bscraper\b/i, name: 'Generic Scraper', confidence: 'medium' },
];

/**
 * Detect bots from user agent string.
 * Returns isBot: true if confident it's a bot.
 */
export function detectBotFromUserAgent(userAgent: string): BotCheckResult {
  if (!userAgent || userAgent.length === 0) {
    return { isBot: true, reason: 'Empty user agent', confidence: 'high' };
  }

  for (const { pattern, name, confidence } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, reason: name, confidence };
    }
  }

  return { isBot: false, reason: null, confidence: null };
}

/**
 * Classify device type, browser, and OS from user agent.
 * Used to populate session fields.
 */
export function classifyDevice(userAgent: string): DeviceInfo {
  if (!userAgent) return { deviceType: null, browser: null, os: null };

  const ua = userAgent.toLowerCase();

  // Device type
  let deviceType: DeviceInfo['deviceType'] = 'desktop';
  if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Browser
  let browser: string | null = null;
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera/') || ua.includes('opr/')) browser = 'Opera';
  else if (ua.includes('trident/') || ua.includes('msie')) browser = 'IE';

  // OS
  let os: string | null = null;
  if (ua.includes('windows nt')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('iphone os') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  return { deviceType, browser, os };
}

/**
 * Check if a session should be excluded as internal traffic.
 * Called with a list of IP hashes configured as "internal" by the site owner.
 */
export function isInternalTraffic(ipHash: string, internalIpHashes: string[]): boolean {
  return internalIpHashes.includes(ipHash);
}
