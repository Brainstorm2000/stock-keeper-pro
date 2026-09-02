import { describe, expect, it } from 'vitest';
import { getExpirationStatus } from './expiration-status';

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
