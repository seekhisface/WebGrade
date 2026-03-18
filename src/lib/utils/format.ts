// ── Shared formatting utilities ──────────────────────────────────────────────

/**
 * Short date: "Mar 11, 2026"
 */
export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Date + time: "Mar 11, 2:30 PM"
 */
export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Compact money format: "$500", "$38k", "$1.2M"
 */
export function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}k`;
  }
  return `$${n}`;
}

/**
 * Relative time: "2m ago", "5h ago", "3d ago"
 */
export function formatTimeAgo(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Percentage string: "42.1%"
 * @param n      The number (already in percentage form, e.g. 42.1)
 * @param decimals  Decimal places (default 1)
 */
export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}
