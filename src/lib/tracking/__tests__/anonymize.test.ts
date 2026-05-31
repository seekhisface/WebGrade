import { describe, it, expect } from 'vitest';
import { anonymizeRequest, extractGeoFromHeaders } from '../anonymize';

describe('extractGeoFromHeaders — AC5: platform header priority over geoip-lite', () => {
  it('returns country from x-vercel-ip-country header', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'DE' });
    const { country } = extractGeoFromHeaders(headers);
    expect(country).toBe('DE');
  });

  it('returns country from cf-ipcountry header', () => {
    const headers = new Headers({ 'cf-ipcountry': 'FR' });
    const { country } = extractGeoFromHeaders(headers);
    expect(country).toBe('FR');
  });

  it('returns country from cloudfront-viewer-country header', () => {
    const headers = new Headers({ 'cloudfront-viewer-country': 'JP' });
    const { country } = extractGeoFromHeaders(headers);
    expect(country).toBe('JP');
  });
});

describe('anonymizeRequest', () => {
  // AC1 + AC2: geoip-lite resolves public US IP when no platform headers present
  it('AC1/AC2: resolves country=US and non-null region for 8.8.8.8 via geoip-lite', () => {
    const headers = new Headers({ 'x-forwarded-for': '8.8.8.8' });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(result.country).toBe('US');
    expect(result.region).not.toBeNull();
    expect(typeof result.region).toBe('string');
  });

  // AC3: returned object must not expose raw IP; ipHash must be a 64-char hex digest
  it('AC3: returned object has exactly keys ipHash, country, region — no raw IP field', () => {
    const headers = new Headers({ 'x-forwarded-for': '8.8.8.8' });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(Object.keys(result).sort()).toEqual(['country', 'ipHash', 'region']);
    expect('rawIp' in result).toBe(false);
    expect('ip' in result).toBe(false);
    // 64 lowercase hex chars = SHA-256
    expect(result.ipHash).toMatch(/^[0-9a-f]{64}$/);
    // Hash must differ from raw input
    expect(result.ipHash).not.toBe('8.8.8.8');
  });

  // AC4: private/loopback IPs must not throw and must return null geo
  it('AC4: loopback IP 127.0.0.1 returns null country and null region without throwing', () => {
    const headers = new Headers({ 'x-forwarded-for': '127.0.0.1' });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(result.country).toBeNull();
    expect(result.region).toBeNull();
  });

  // AC5: each platform header takes priority — geoip-lite must not override header value
  it('AC5: x-vercel-ip-country header takes priority over geoip-lite lookup', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'DE',
      'x-forwarded-for': '8.8.8.8',
    });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(result.country).toBe('DE');
  });

  it('AC5: cf-ipcountry header takes priority over geoip-lite lookup', () => {
    const headers = new Headers({
      'cf-ipcountry': 'FR',
      'x-forwarded-for': '8.8.8.8',
    });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(result.country).toBe('FR');
  });

  it('AC5: cloudfront-viewer-country header takes priority over geoip-lite lookup', () => {
    const headers = new Headers({
      'cloudfront-viewer-country': 'JP',
      'x-forwarded-for': '8.8.8.8',
    });
    const result = anonymizeRequest(headers, 'test-site-id');
    expect(result.country).toBe('JP');
  });
});
