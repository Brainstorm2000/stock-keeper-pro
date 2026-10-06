import { describe, expect, it } from 'vitest';
import { getLocalDateString, getSaleDateTimestamp } from './sale-date';

describe('sale date helpers', () => {
  it('formats today using the local calendar date', () => {
    expect(getLocalDateString(new Date(2026, 9, 2, 0, 30))).toBe('2026-10-02');
  });

  it('keeps the current local time for a sale dated today', () => {
    const now = new Date(2026, 9, 2, 10, 24, 36, 789);
    const timestamp = getSaleDateTimestamp('2026-10-02', now);

    expect(timestamp).toBe(now.toISOString());
  });

  it('normalizes past sale dates to local noon', () => {
    const now = new Date(2026, 9, 2, 10);
    const timestamp = getSaleDateTimestamp('2026-09-30', now);

    expect(timestamp).not.toBeNull();
    expect(getLocalDateString(new Date(timestamp!))).toBe('2026-09-30');
    expect(new Date(timestamp!).getHours()).toBe(12);
  });

  it('allows today and rejects future or invalid calendar dates', () => {
    const now = new Date(2026, 9, 2, 10);

    expect(getSaleDateTimestamp('2026-10-02', now)).not.toBeNull();
    expect(getSaleDateTimestamp('2026-10-03', now)).toBeNull();
    expect(getSaleDateTimestamp('2026-02-30', now)).toBeNull();
  });
});