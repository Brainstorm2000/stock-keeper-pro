import { describe, expect, it } from 'vitest';
import {
  getExpirationStatus,
  matchesExpirationFilter,
} from './expiration-status';

describe('getExpirationStatus', () => {
  it('marks dates before today as expired', () => {
    const today = new Date('2026-08-31T12:00:00Z');
    expect(getExpirationStatus('2026-08-30', today)).toBe('expired');
  });

  it('marks dates within 30 days as almost expired', () => {
    const today = new Date('2026-08-31T12:00:00Z');
    expect(getExpirationStatus('2026-09-20', today)).toBe('almost_expired');
  });

  it('keeps future dates beyond the warning window as normal', () => {
    const today = new Date('2026-08-31T12:00:00Z');
    expect(getExpirationStatus('2026-10-15', today)).toBe('normal');
  });
});

describe('matchesExpirationFilter', () => {
  const today = new Date(2026, 8, 1);

  it('uses batch expiry dates before the product-level fallback', () => {
    expect(
      matchesExpirationFilter('expired', ['2026-08-31'], '2026-12-01', today),
    ).toBe(true);
    expect(
      matchesExpirationFilter('expired', ['2026-12-01'], '2026-08-31', today),
    ).toBe(false);
  });

  it('does not classify products with no expiry date as not expired', () => {
    expect(matchesExpirationFilter('not_expired', [], null, today)).toBe(false);
    expect(matchesExpirationFilter('all', [], null, today)).toBe(true);
  });
});
