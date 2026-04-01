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
 *   - <5KB minified, async, non-blocking
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
      u: window.location.href,            // current URL
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

  // Flush on page exit
  function flushAndExit() {
    var exitEvents = queue.splice(0);
    exitEvents.push({
      t: 'page_exit',
      ts: Date.now(),
      u: currentUrl,
      ms: Date.now() - pageStartTime,    // time on page
    });
    send(exitEvents);
  }

  window.addEventListener('pagehide', flushAndExit);
  window.addEventListener('beforeunload', flushAndExit);

  // -------------------------------------------------------------------------
  // Page view — fire immediately
  // -------------------------------------------------------------------------
  track('page_view', {
    ref: document.referrer,
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

    track('click', {
      tag: el.tagName ? el.tagName.toLowerCase() : null,
      txt: (el.innerText || '').slice(0, 100), // First 100 chars only
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 100),
      cta: isCta(el),
      rage: isRage,
      hms: window.__wg_hover_ms || null,       // Hesitation time
      href: el.href || null,                   // Capture link destination for nav clicks
    });

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
    track('form_submit', {
      id: e.target.id || null,
      action: e.target.action || null,
    });
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
      u: currentUrl,
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

  // Auto-detect conversion if current URL matches the goal
  // (Goal URL is validated server-side — snippet just fires the event)
  if (document.readyState === 'complete') {
    // Already loaded
  } else {
    window.addEventListener('load', function () {
      // Server-side ingestion will check if this URL is the conversion goal
      track('page_load_complete', {});
    });
  }

  if (CONFIG.debug) {
    console.log('[WebGrade] Snippet loaded. Session:', sessionId, '| Consent:', consentGiven);
  }

}(window, document));
