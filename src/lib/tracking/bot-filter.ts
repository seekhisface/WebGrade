/**
 * P1-05: Bot Filtering + Traffic Exclusion
 * Server-side companion to client-side pre-filtering in snippet.
 *
 * Used by: src/app/api/ingest/route.ts
 */

export type BotCategory = 'search_engine' | 'seo_tool' | 'automation' | 'monitoring' | 'social_scraper' | 'generic';

export interface BotCheckResult {
  isBot: boolean;
  reason: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  category: BotCategory | null;
}

interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  browser: string | null;
  os: string | null;
}

// Known bot user agent patterns — organized by category for segmentation
const BOT_PATTERNS: Array<{ pattern: RegExp; name: string; confidence: 'high' | 'medium'; category: BotCategory }> = [
  // Search engines — crawling for indexing
  { pattern: /googlebot/i, name: 'Googlebot', confidence: 'high', category: 'search_engine' },
  { pattern: /bingbot/i, name: 'Bingbot', confidence: 'high', category: 'search_engine' },
  { pattern: /slurp/i, name: 'Yahoo Slurp', confidence: 'high', category: 'search_engine' },
  { pattern: /duckduckbot/i, name: 'DuckDuckBot', confidence: 'high', category: 'search_engine' },
  { pattern: /baiduspider/i, name: 'Baidu Spider', confidence: 'high', category: 'search_engine' },
  { pattern: /yandexbot/i, name: 'Yandex Bot', confidence: 'high', category: 'search_engine' },
  { pattern: /applebot/i, name: 'Applebot', confidence: 'high', category: 'search_engine' },
  { pattern: /googleother/i, name: 'Google Other', confidence: 'high', category: 'search_engine' },
  { pattern: /petalbot/i, name: 'PetalBot (Huawei)', confidence: 'high', category: 'search_engine' },

  // SEO tools — crawling for analysis (competitor intel, backlinks)
  { pattern: /semrushbot/i, name: 'SEMrush Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /ahrefsbot/i, name: 'Ahrefs Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /mj12bot/i, name: 'Majestic Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /dotbot/i, name: 'OpenLinkProfiler', confidence: 'high', category: 'seo_tool' },
  { pattern: /rogerbot/i, name: 'Moz Rogerbot', confidence: 'high', category: 'seo_tool' },
  { pattern: /screaming frog/i, name: 'Screaming Frog', confidence: 'high', category: 'seo_tool' },
  { pattern: /serpstatbot/i, name: 'Serpstat Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /dataforseo/i, name: 'DataForSEO Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /blexbot/i, name: 'BLEXBot (Webmeup)', confidence: 'high', category: 'seo_tool' },
  { pattern: /zoominfobot/i, name: 'ZoomInfo Bot', confidence: 'high', category: 'seo_tool' },
  { pattern: /bytespider/i, name: 'ByteSpider (TikTok)', confidence: 'high', category: 'seo_tool' },

  // Headless browsers / automation — likely scraping or testing
  { pattern: /headlesschrome/i, name: 'Headless Chrome', confidence: 'high', category: 'automation' },
  { pattern: /phantomjs/i, name: 'PhantomJS', confidence: 'high', category: 'automation' },
  { pattern: /selenium/i, name: 'Selenium', confidence: 'high', category: 'automation' },
  { pattern: /puppeteer/i, name: 'Puppeteer', confidence: 'high', category: 'automation' },
  { pattern: /playwright/i, name: 'Playwright', confidence: 'high', category: 'automation' },
  { pattern: /webdriver/i, name: 'WebDriver', confidence: 'high', category: 'automation' },

  // Social media scrapers — link preview generation
  { pattern: /facebot|facebookexternalhit/i, name: 'Facebook Scraper', confidence: 'high', category: 'social_scraper' },
  { pattern: /twitterbot/i, name: 'Twitter Bot', confidence: 'high', category: 'social_scraper' },
  { pattern: /linkedinbot/i, name: 'LinkedIn Bot', confidence: 'high', category: 'social_scraper' },
  { pattern: /slackbot/i, name: 'Slack Bot', confidence: 'high', category: 'social_scraper' },
  { pattern: /whatsapp/i, name: 'WhatsApp Bot', confidence: 'high', category: 'social_scraper' },
  { pattern: /discordbot/i, name: 'Discord Bot', confidence: 'high', category: 'social_scraper' },
  { pattern: /telegrambot/i, name: 'Telegram Bot', confidence: 'high', category: 'social_scraper' },

  // Uptime / monitoring — not real traffic
  { pattern: /uptimerobot/i, name: 'UptimeRobot', confidence: 'high', category: 'monitoring' },
  { pattern: /pingdom/i, name: 'Pingdom', confidence: 'high', category: 'monitoring' },
  { pattern: /statuscake/i, name: 'StatusCake', confidence: 'high', category: 'monitoring' },
  { pattern: /newrelic/i, name: 'New Relic', confidence: 'high', category: 'monitoring' },
  { pattern: /ia_archiver/i, name: 'Internet Archive', confidence: 'high', category: 'monitoring' },
  { pattern: /gtmetrix/i, name: 'GTmetrix', confidence: 'high', category: 'monitoring' },
  { pattern: /pagespeedonline/i, name: 'Google PageSpeed', confidence: 'high', category: 'monitoring' },

  // Generic patterns (lower confidence — catch-all)
  { pattern: /\bbot\b/i, name: 'Generic Bot', confidence: 'medium', category: 'generic' },
  { pattern: /\bcrawler\b/i, name: 'Generic Crawler', confidence: 'medium', category: 'generic' },
  { pattern: /\bspider\b/i, name: 'Generic Spider', confidence: 'medium', category: 'generic' },
  { pattern: /\bscraper\b/i, name: 'Generic Scraper', confidence: 'medium', category: 'generic' },
];

/**
 * Detect bots from user agent string.
 * Returns isBot: true if confident it's a bot, plus category for segmentation.
 */
export function detectBotFromUserAgent(userAgent: string): BotCheckResult {
  if (!userAgent || userAgent.length === 0) {
    return { isBot: true, reason: 'Empty user agent', confidence: 'high', category: 'generic' };
  }

  for (const { pattern, name, confidence, category } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, reason: name, confidence, category };
    }
  }

  return { isBot: false, reason: null, confidence: null, category: null };
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
 * Classify a referrer URL into a traffic source channel.
 */
export function classifyTrafficSource(
  referrer: string | null | undefined,
  utmSource: string | null | undefined,
  utmMedium: string | null | undefined,
): string {
  // UTM overrides referrer
  if (utmMedium) {
    const med = utmMedium.toLowerCase();
    if (med === 'cpc' || med === 'ppc' || med === 'paid' || med === 'paidsearch') return 'paid';
    if (med === 'email' || med === 'newsletter') return 'email';
    if (med === 'social' || med === 'social-media') return 'social';
    if (med === 'referral') return 'referral';
    if (med === 'organic') return 'organic';
    if (med === 'display' || med === 'cpm' || med === 'banner') return 'paid';
    if (med === 'affiliate') return 'referral';
  }
  if (utmSource) {
    const src = utmSource.toLowerCase();
    if (src === 'google' || src === 'bing' || src === 'yahoo' || src === 'duckduckgo') {
      // Has utm_source=google but no medium=cpc → likely organic tagged
      return utmMedium ? 'paid' : 'organic';
    }
    if (['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest', 'reddit'].includes(src)) return 'social';
  }

  if (!referrer) return 'direct';

  let hostname: string;
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return 'direct';
  }

  // Search engines → organic
  const searchEngines = ['google.com', 'google.co', 'bing.com', 'yahoo.com', 'duckduckgo.com',
    'baidu.com', 'yandex.', 'ecosia.org', 'ask.com', 'aol.com'];
  for (const se of searchEngines) {
    if (hostname.includes(se)) return 'organic';
  }

  // Social media → social
  const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'youtube.com',
    't.co', 'lnkd.in', 'fb.me'];
  for (const sd of socialDomains) {
    if (hostname.includes(sd)) return 'social';
  }

  // Email providers → email
  const emailDomains = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com'];
  for (const ed of emailDomains) {
    if (hostname.includes(ed)) return 'email';
  }

  // Has a referrer but it's not search/social → referral
  return 'referral';
}

/**
 * Check if a session should be excluded as internal traffic.
 * Called with a list of IP hashes configured as "internal" by the site owner.
 */
export function isInternalTraffic(ipHash: string, internalIpHashes: string[]): boolean {
  return internalIpHashes.includes(ipHash);
}
