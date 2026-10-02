import { describe, expect, it } from 'vitest';
import { getPurchaseItemKey } from './purchase-item-key';

describe('getPurchaseItemKey', () => {
  it('keeps different variations of the same product independent', () => {
    expect(getPurchaseItemKey('product-1', 'variation-a')).not.toBe(
      getPurchaseItemKey('product-1', 'variation-b'),
    );
  });

  it('uses the same key for a regular product without a variation', () => {
    expect(getPurchaseItemKey('product-1')).toBe(getPurchaseItemKey('product-1', null));
  });
});
