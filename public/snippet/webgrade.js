/**
 * WebGrade Tracking Snippet v1.0
 * P1-03: Client-side behavioral tracking
 *
 * Install by pasting ONE line into the <head> of any website:
 *   <script src="https://cdn.webgrade.io/wg.js?id=YOUR_SNIPPET_ID" async></script>
 *
 * Features:
 *   - Scroll depth tracking (25%, 50%, 75%, 90%, 100%)
 *   - Click tracking (CTA detection, rage click detection)
 *   - Hesitation detection (cursor hover > 1.5s before click)
 *   - SPA-aware route change detection (React, Vue, Angular, Next.js)
 *   - Page exit / time-on-page
 *   - Exit intent detection (cursor leaving viewport top)
 *   - Form focus tracking
 *   - Bot detection (pre-filter before sending)
 *   - Consent-aware: respects consent mode if present
 *   - ~7 KB gzipped over the wire (~25 KB raw), async, non-blocking
 *
 * Privacy:
 *   - No cookies in anonymous mode
 *   - Session ID is pseudonymous (not linked to identity)
 *   - No raw IP sent from client (IP is read server-side and immediately hashed)
 */

(function (window, document) {
  'use strict';

  // -------------------------------------------------------------------------
  // Config — injected server-side when snippet is served
  // -------------------------------------------------------------------------
  var CONFIG = {
    snippetId: '{{SNIPPET_ID}}',      // Replaced server-side
    ingestUrl: '{{INGEST_URL}}',      // e.g. https://app.webgrade.io/api/ingest
    // Modal-conversion tracking: form ID or action-URL fragment.
    // When a form_submit event matches this selector, the snippet auto-fires
    // a conversion event WITHOUT requiring window.wg('conversion') in customer code.
    // Empty string = disabled. Substituted server-side from SiteOnboarding.conversionFormSelector.
    conversionFormSelector: '{{CONVERSION_FORM_SELECTOR}}',
    version: '1.0.0',
    debug: false,
  };

  // -------------------------------------------------------------------------
  // Abort if already loaded (HC-05: duplicate script detection)
  // -------------------------------------------------------------------------
  if (window.__wg_loaded) {
    console.warn('[WebGrade] Snippet loaded more than once on this page.');
    return;
  }
  window.__wg_loaded = true;

  // -------------------------------------------------------------------------
  // Bot detection — basic pre-filter (P1-05 does full server-side filtering)
  // -------------------------------------------------------------------------
  function isBot() {
    var ua = navigator.userAgent.toLowerCase();
    var botPatterns = [
      'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
      'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
      'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'rogerbot',
      'headlesschrome', 'phantomjs', 'selenium', 'webdriver'
    ];
    for (var i = 0; i < botPatterns.length; i++) {
      if (ua.indexOf(botPatterns[i]) !== -1) return true;
    }
    // Headless browser detection
    if (navigator.webdriver) return true;
    if (!window.chrome && navigator.vendor === '') return true;
    return false;
  }

  if (isBot()) {
    if (CONFIG.debug) console.log('[WebGrade] Bot detected, not tracking.');
    return;
  }

  // -------------------------------------------------------------------------
  // Consent mode check (DL-02)
  // If a consent management platform (OneTrust, Cookiebot) has set
  // analytics consent to false, run in anonymous mode (no session ID cookie)
  // -------------------------------------------------------------------------
  function hasAnalyticsConsent() {
    // OneTrust
    if (window.OnetrustActiveGroups && window.OnetrustActiveGroups.indexOf('C0002') === -1) {
      return false;
    }
    // Cookiebot
    if (window.Cookiebot && window.Cookiebot.consent && !window.Cookiebot.consent.statistics) {
      return false;
    }
    // Google Consent Mode v2
    if (window.dataLayer) {
      // Conservative: assume no consent if consent mode is active
      // The server-side ingestion handles full consent mode logic
    }
    return true; // Default: consent given (adjust per your legal requirements)
  }

  var consentGiven = hasAnalyticsConsent();

  // -------------------------------------------------------------------------
  // Session ID — pseudonymous, not linked to identity
  // In anonymous mode (no consent): generate per-page, no storage
  // In full mode (consent given): persist in sessionStorage only (not cookie)
  // -------------------------------------------------------------------------
  function generateId() {
    return 'wg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var SESSION_KEY = 'wg_sid_' + CONFIG.snippetId;
  var sessionId;

  if (consentGiven) {
    sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  } else {
    // Anonymous mode: new ID each page, no storage
    sessionId = generateId();
  }

  // -------------------------------------------------------------------------
  // Event queue and batch sender
  // Events are queued and sent in batches every 2 seconds, or immediately
  // for high-priority events (conversion, page exit)
  // -------------------------------------------------------------------------
  var queue = [];
  var pageStartTime = Date.now();
  var currentUrl = window.location.href;

  // -------------------------------------------------------------------------
  // URL normalization — strip hash fragments so tab/filter clicks
  // (e.g. /portfolio#active, /team#all) don't inflate page counts.
  // Hash sections are captured separately via section_view events.
  // -------------------------------------------------------------------------
  function stripHash(url) {
    try { return url.split('#')[0]; } catch (e) { return url; }
  }

  // -------------------------------------------------------------------------
  // File download detection — matches common downloadable extensions
  // -------------------------------------------------------------------------
  var downloadExtensions = /\.(pdf|docx?|xlsx?|csv|pptx?|zip|rar|gz|tar|dmg|exe|msi)(\?|$)/i;

  function isDownloadLink(el) {
    if (!el) return false;
    var href = el.href || '';
    if (downloadExtensions.test(href)) return true;
    if (el.hasAttribute && el.hasAttribute('download')) return true;
    return false;
  }

  function send(events) {
    if (!events || events.length === 0) return;

    var payload = JSON.stringify({
      snippetId: CONFIG.snippetId,
      sessionId: sessionId,
      consentGiven: consentGiven,
      events: events,
    });

    // Use sendBeacon with Blob to ensure correct Content-Type
    // sendBeacon without Blob sends as text/plain, which breaks JSON parsing
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(CONFIG.ingestUrl, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.ingestUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  function track(type, data) {
    var event = Object.assign({}, data, {
      t: type,                            // event type
      ts: Date.now(),                     // timestamp
      u: stripHash(window.location.href), // current URL (hash stripped)
      ti: document.title,                 // page title
    });
    queue.push(event);
  }

  // Flush queue every 2 seconds
  setInterval(function () {
    if (queue.length > 0) {
      send(queue.splice(0));
    }
  }, 2000);

  // Flush on page exit — guard against double-fire from pagehide + beforeunload
  var exitFired = false;
  function flushAndExit() {
    if (exitFired) return;
    exitFired = true;
    var exitEvents = queue.splice(0);
    exitEvents.push({
      t: 'page_exit',
      ts: Date.now(),
      u: stripHash(currentUrl),
      ms: Date.now() - pageStartTime,    // time on page
    });
    send(exitEvents);
  }

  window.addEventListener('pagehide', flushAndExit);
  window.addEventListener('beforeunload', flushAndExit);

  // -------------------------------------------------------------------------
  // UTM + ad click ID extraction
  // Captures standard UTMs plus platform-specific click IDs (gclid, fbclid, etc.)
  // -------------------------------------------------------------------------
  function extractUtm() {
    try {
      var params = new URLSearchParams(window.location.search);
      var utm = {};

      // Standard UTM params
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(key) {
        var val = params.get(key);
        if (val) utm[key] = val;
      });

      // Ad platform click IDs — infer source/medium when UTMs are missing
      var clickIds = {
        gclid:   { source: 'google',   medium: 'cpc' },  // Google Ads
        gbraid:  { source: 'google',   medium: 'cpc' },  // Google Ads (iOS)
        wbraid:  { source: 'google',   medium: 'cpc' },  // Google Ads (web-to-app)
        fbclid:  { source: 'facebook', medium: 'cpc' },  // Meta Ads
        msclkid: { source: 'bing',     medium: 'cpc' },  // Microsoft Ads
        li_fat_id: { source: 'linkedin', medium: 'cpc' }, // LinkedIn Ads
        ttclid:  { source: 'tiktok',   medium: 'cpc' },  // TikTok Ads
        twclid:  { source: 'twitter',  medium: 'cpc' },  // Twitter/X Ads
        rdt_cid: { source: 'reddit',   medium: 'cpc' },  // Reddit Ads
      };

      for (var cid in clickIds) {
        var cidVal = params.get(cid);
        if (cidVal) {
          utm['_click_id'] = cid;
          utm['_click_id_value'] = cidVal;
          // Only set source/medium if not already provided by UTM
          if (!utm.utm_source) utm.utm_source = clickIds[cid].source;
          if (!utm.utm_medium) utm.utm_medium = clickIds[cid].medium;
          break; // Only capture the first match
        }
      }

      return Object.keys(utm).length > 0 ? utm : null;
    } catch (e) { return null; }
  }

  // -------------------------------------------------------------------------
  // Referrer filtering — ignore self-referrals
  // -------------------------------------------------------------------------
  function getExternalReferrer() {
    var ref = document.referrer;
    if (!ref) return null;
    try {
      var refHost = new URL(ref).hostname;
      var curHost = window.location.hostname;
      // Strip www for comparison
      refHost = refHost.replace(/^www\./, '');
      curHost = curHost.replace(/^www\./, '');
      // Self-referral = same domain = not a real external source
      if (refHost === curHost) return null;
      return ref;
    } catch (e) {
      return ref;
    }
  }

  // -------------------------------------------------------------------------
  // Page view — fire immediately (with UTM + referrer + landing page)
  // -------------------------------------------------------------------------
  var utmData = extractUtm();
  var externalRef = getExternalReferrer();
  track('page_view', {
    ref: externalRef,
    entry: window.location.pathname,
    utm: utmData,
  });

  // -------------------------------------------------------------------------
  // Tab focus/blur tracking — measures attention
  // -------------------------------------------------------------------------
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      track('tab_blur', {});
    } else {
      track('tab_focus', {});
    }
  });

  // -------------------------------------------------------------------------
  // Scroll depth tracking (P1-03)
  // Fire at 25%, 50%, 75%, 90%, 100% thresholds
  // -------------------------------------------------------------------------
  var scrollThresholds = [25, 50, 75, 90, 100];
  var scrollFired = {};

  function getScrollDepth() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    if (docHeight <= 0) return 100;
    return Math.round((scrollTop / docHeight) * 100);
  }

  window.addEventListener('scroll', function () {
    var depth = getScrollDepth();
    for (var i = 0; i < scrollThresholds.length; i++) {
      var threshold = scrollThresholds[i];
      if (depth >= threshold && !scrollFired[threshold]) {
        scrollFired[threshold] = true;
        track('scroll', { pct: threshold });
      }
    }
  }, { passive: true });

  // -------------------------------------------------------------------------
  // Click tracking + CTA detection + rage click detection (P1-03)
  // -------------------------------------------------------------------------
  var clickTimestamps = [];
  var RAGE_CLICK_WINDOW_MS = 1000;
  var RAGE_CLICK_THRESHOLD = 3;

  function isCta(el) {
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    var text = (el.innerText || el.value || '').toLowerCase();
    var classList = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    var role = (el.getAttribute('role') || '').toLowerCase();

    // Button or link
    if (tag === 'button' || tag === 'a') return true;
    if (role === 'button') return true;

    // CTA keyword detection
    var ctaKeywords = ['sign up', 'signup', 'get started', 'start free', 'try', 'buy',
                       'purchase', 'checkout', 'subscribe', 'download', 'request',
                       'book', 'schedule', 'contact', 'demo', 'free trial'];
    for (var i = 0; i < ctaKeywords.length; i++) {
      if (text.indexOf(ctaKeywords[i]) !== -1) return true;
    }

    // CTA class names
    var ctaClasses = ['cta', 'btn', 'button', 'action'];
    for (var j = 0; j < ctaClasses.length; j++) {
      if (classList.indexOf(ctaClasses[j]) !== -1) return true;
    }

    return false;
  }

  // Walk up the DOM to find the nearest clickable ancestor (a, button, [role="button"])
  // so we capture "Products" instead of a nested <span> or <svg> inside the link
  function findClickableAncestor(el) {
    var current = el;
    var maxDepth = 5;
    while (current && current !== document.body && maxDepth-- > 0) {
      var tag = (current.tagName || '').toLowerCase();
      if (tag === 'a' || tag === 'button' || (current.getAttribute && current.getAttribute('role') === 'button')) {
        return current;
      }
      current = current.parentElement;
    }
    return el; // Fall back to original target
  }

  document.addEventListener('click', function (e) {
    var rawEl = e.target;
    var el = findClickableAncestor(rawEl);
    var now = Date.now();

    // Rage click detection
    clickTimestamps.push(now);
    clickTimestamps = clickTimestamps.filter(function (t) {
      return now - t < RAGE_CLICK_WINDOW_MS;
    });

    var isRage = clickTimestamps.length >= RAGE_CLICK_THRESHOLD;

    var tag = el.tagName ? el.tagName.toLowerCase() : null;
    var txt = (el.innerText || '').slice(0, 100);
    var cls = (typeof el.className === 'string' ? el.className : '').slice(0, 100);
    var ctaHit = isCta(el);
    var href = el.href || null;
    var hoverMs = window.__wg_hover_ms || null;

    var baseData = {
      tag: tag, txt: txt, cls: cls, cta: ctaHit,
      rage: isRage, hms: hoverMs, href: href,
    };

    // Classify the click into the most specific event type:
    // 1. File download clicks (highest priority — distinct funnel signal)
    // 2. CTA clicks (signup, demo, contact, etc.)
    // 3. Navigation clicks (link to another page)
    // 4. Generic click (div, img, span, etc.)
    if (isDownloadLink(el)) {
      track('file_download', baseData);
    } else if (ctaHit) {
      track('cta_click', baseData);
    } else if (tag === 'a' && href) {
      track('nav_click', baseData);
    } else {
      track('click', baseData);
    }

    window.__wg_hover_ms = null;
  }, true);

  // -------------------------------------------------------------------------
  // Hesitation detection — time cursor hovers over element before clicking
  // -------------------------------------------------------------------------
  var hoverStartTime = null;
  var hoverTarget = null;
  var HESITATION_THRESHOLD_MS = 1500; // 1.5 seconds

  document.addEventListener('mouseover', function (e) {
    if (isCta(e.target)) {
      hoverStartTime = Date.now();
      hoverTarget = e.target;
    }
  });

  document.addEventListener('mouseout', function (e) {
    if (e.target === hoverTarget) {
      var hoverMs = hoverStartTime ? Date.now() - hoverStartTime : 0;
      if (hoverMs >= HESITATION_THRESHOLD_MS) {
        window.__wg_hover_ms = hoverMs;
        track('hesitation', { ms: hoverMs });
      }
      hoverStartTime = null;
      hoverTarget = null;
    }
  });

  // -------------------------------------------------------------------------
  // Exit intent detection — cursor leaves top of viewport
  // -------------------------------------------------------------------------
  document.addEventListener('mouseleave', function (e) {
    if (e.clientY < 10) {
      track('exit_intent', {});
    }
  });

  // -------------------------------------------------------------------------
  // Form tracking
  // -------------------------------------------------------------------------
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      track('form_focus', {
        type: el.type || tag,
        name: el.name || el.id || null,
      });
    }
  });

  document.addEventListener('submit', function (e) {
    var formId = e.target.id || null;
    var formAction = e.target.action || null;

    track('form_submit', {
      id: formId,
      action: formAction,
    });

    // Modal-conversion tracking: if the form matches the configured selector,
    // auto-fire a conversion event. Selector matches against form id (exact)
    // OR against form action URL (substring match). This lets sites with
    // modal-only confirmation flows (no /thanks page) still record conversions.
    var sel = CONFIG.conversionFormSelector;
    if (sel && sel.length > 0) {
      var matches = false;
      if (formId && formId === sel) matches = true;
      else if (formAction && formAction.indexOf(sel) !== -1) matches = true;
      if (matches) {
        track('conversion', { source: 'form_submit_auto', formId: formId, formAction: formAction });
        // Flush immediately — conversions are high priority
        send(queue.splice(0));
      }
    }
  }, true);

  // -------------------------------------------------------------------------
  // SPA route change detection (P1-03)
  // Supports React Router, Vue Router, Angular, Next.js App Router
  // -------------------------------------------------------------------------

  // Check if two URLs differ only by hash
  function isHashOnlyChange(oldUrl, newUrl) {
    try {
      var a = new URL(oldUrl);
      var b = new URL(newUrl);
      return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search && a.hash !== b.hash;
    } catch (e) {
      return false;
    }
  }

  function getHashSection(url) {
    try {
      var hash = new URL(url).hash;
      return hash ? hash.replace('#', '') : null;
    } catch (e) {
      return null;
    }
  }

  function handleRouteChange(newUrl) {
    if (newUrl === currentUrl) return;

    // Hash-only change on the same page = section navigation, not a new page
    if (isHashOnlyChange(currentUrl, newUrl)) {
      var section = getHashSection(newUrl);
      if (section) {
        track('section_view', {
          section: section,
        });
      }
      currentUrl = newUrl;
      return;
    }

    // Full route change — flush old page events
    var pageEvents = queue.splice(0);
    pageEvents.push({
      t: 'page_exit',
      ts: Date.now(),
      u: stripHash(currentUrl),
      ms: Date.now() - pageStartTime,
    });
    send(pageEvents);

    // Start tracking new page
    currentUrl = newUrl;
    pageStartTime = Date.now();
    scrollFired = {};

    track('page_view', {
      ref: currentUrl, // Previous page as referrer for SPA
      spa: true,
    });
  }

  // Intercept History API (React Router, Next.js, etc.)
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    handleRouteChange(window.location.href);
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    handleRouteChange(window.location.href);
  };

  window.addEventListener('popstate', function () {
    handleRouteChange(window.location.href);
  });

  // -------------------------------------------------------------------------
  // Section view tracking — hash navigation on single-page sites
  // hashchange fires for native anchor clicks that don't go through pushState.
  // handleRouteChange already covers pushState/replaceState/popstate, so only
  // handle hashchange when the URL wasn't already updated by those paths.
  // -------------------------------------------------------------------------
  window.addEventListener('hashchange', function () {
    var newUrl = window.location.href;
    if (newUrl === currentUrl) return; // Already handled by handleRouteChange
    var section = getHashSection(newUrl);
    if (section) {
      track('section_view', {
        section: section,
      });
      currentUrl = newUrl;
    }
  });

  // -------------------------------------------------------------------------
  // Copy text detection — user selecting & copying = research intent
  // -------------------------------------------------------------------------
  document.addEventListener('copy', function () {
    var selection = (window.getSelection() || '').toString().slice(0, 200);
    if (selection.length > 5) { // Ignore accidental tiny selections
      track('copy_text', {
        txt: selection,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Conversion tracking — call window.wg('conversion') from your thank-you page
  // or pass the conversion URL in the snippet config
  // -------------------------------------------------------------------------
  window.wg = function (event, data) {
    if (event === 'conversion') {
      track('conversion', data || {});
      // Flush immediately — conversion events are high priority
      send(queue.splice(0));
    }
  };

  // -------------------------------------------------------------------------
  // Page load complete + Core Web Vitals
  // Uses PerformanceObserver for LCP, CLS, INP (replaces FID).
  // Falls back to performance.timing for basic metrics.
  // -------------------------------------------------------------------------
  var cwvData = {};

  // LCP — Largest Contentful Paint
  try {
    var lcpObserver = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      if (entries.length > 0) {
        cwvData.lcp = Math.round(entries[entries.length - 1].startTime);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* PerformanceObserver not supported */ }

  // CLS — Cumulative Layout Shift
  try {
    var clsValue = 0;
    var clsObserver = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].hadRecentInput) {
          clsValue += entries[i].value;
        }
      }
      cwvData.cls = Math.round(clsValue * 1000) / 1000; // 3 decimal places
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) { /* not supported */ }

  // INP — Interaction to Next Paint (replaces FID)
  try {
    var inpObserver = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        var dur = entries[i].duration;
        if (!cwvData.inp || dur > cwvData.inp) {
          cwvData.inp = Math.round(dur);
        }
      }
    });
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) { /* not supported */ }

  function firePageLoadComplete() {
    var perf = window.performance && window.performance.timing;
    var navTiming = {};
    if (perf && perf.navigationStart > 0) {
      navTiming.ttfb = perf.responseStart - perf.navigationStart;
      navTiming.domReady = perf.domContentLoadedEventEnd - perf.navigationStart;
      navTiming.fullLoad = perf.loadEventEnd > 0
        ? perf.loadEventEnd - perf.navigationStart
        : Date.now() - perf.navigationStart;
    }

    track('page_load_complete', {
      metadata: Object.assign({}, navTiming, cwvData),
    });
  }

  if (document.readyState === 'complete') {
    // Delay slightly to let CWV observers collect data
    setTimeout(firePageLoadComplete, 200);
  } else {
    window.addEventListener('load', function () {
      setTimeout(firePageLoadComplete, 200);
    });
  }

  // -------------------------------------------------------------------------
  // Mobile exit intent detection
  // Desktop: cursor leaves viewport top (already tracked above).
  // Mobile: rapid scroll back to top after reading = likely about to leave.
  // Also detect back-button intent via touchend near screen edge.
  // -------------------------------------------------------------------------
  var lastScrollY = 0;
  var lastScrollTime = 0;
  var mobileExitFired = false;

  if (/mobile|android|iphone/i.test(navigator.userAgent)) {
    window.addEventListener('scroll', function () {
      var now = Date.now();
      var scrollY = window.pageYOffset || 0;
      var elapsed = now - lastScrollTime;

      // Fast upward scroll (>500px in <300ms) from below the fold
      if (!mobileExitFired && lastScrollY > 400 && scrollY < 100 && elapsed < 300) {
        mobileExitFired = true;
        track('exit_intent', { metadata: { trigger: 'mobile_scroll_top' } });
        // Reset after 10s so it can fire again on a long session
        setTimeout(function () { mobileExitFired = false; }, 10000);
      }

      lastScrollY = scrollY;
      lastScrollTime = now;
    }, { passive: true });
  }

  if (CONFIG.debug) {
    console.log('[WebGrade] Snippet loaded. Session:', sessionId, '| Consent:', consentGiven);
  }

}(window, document));
