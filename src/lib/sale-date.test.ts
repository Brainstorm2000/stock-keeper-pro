import { describe, expect, it } from 'vitest';
import { getLocalDateString, getSaleDateTimestamp } from './sale-date';

describe('sale date helpers', () => {
  it('formats today using the local calendar date', () => {
    expect(getLocalDateString(new Date(2026, 9, 2, 0, 30))).toBe('2026-10-02');
  });

  it('converts an allowed sale date at local noon', () => {
    const now = new Date(2026, 9, 2, 10);
    const timestamp = getSaleDateTimestamp('2026-09-30', now);

    expect(timestamp).not.toBeNull();
    expect(getLocalDateString(new Date(timestamp!))).toBe('2026-09-30');
  });

  it('allows today and rejects future or invalid calendar dates', () => {
    const now = new Date(2026, 9, 2, 10);

    expect(getSaleDateTimestamp('2026-10-02', now)).not.toBeNull();
    expect(getSaleDateTimestamp('2026-10-03', now)).toBeNull();
    expect(getSaleDateTimestamp('2026-02-30', now)).toBeNull();
  });
});