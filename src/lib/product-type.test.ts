import { describe, expect, it } from 'vitest';
import { getProductType } from './product-type';

describe('getProductType', () => {
  it('uses service and variable as explicit types before the legacy stock category', () => {
    expect(getProductType({ item_type: 'service', category: 'consumable' })).toBe('service');
    expect(getProductType({ item_type: 'variable', category: 'sellable' })).toBe('variable');
  });

  it('uses the legacy sellable/consumable classification for standard products', () => {
    expect(getProductType({ item_type: 'product', category: 'sellable' })).toBe('sellable');
    expect(getProductType({ item_type: 'product', category: 'consumable' })).toBe('consumable');
  });
});