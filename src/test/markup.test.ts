import { describe, expect, it } from 'vitest';
import { calculateMarkupPercent, calculateSellingPrice } from '@/lib/markup';

describe('markup calculations', () => {
  it('calculates selling price from cost and markup', () => {
    expect(calculateSellingPrice(100, 25)).toBe(125);
  });

  it('calculates markup from cost and selling price', () => {
    expect(calculateMarkupPercent(100, 125)).toBe(25);
  });

  it('returns zero markup when cost is zero', () => {
    expect(calculateMarkupPercent(0, 125)).toBe(0);
  });
});