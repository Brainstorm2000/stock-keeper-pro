import { describe, it, expect } from 'vitest';
import type { Product } from '@/hooks/useProducts';
import { getPurchasableProductsForPurchase, getMaxReturnableQuantity } from '@/lib/purchase-products';

describe('purchase product filters', () => {
  it('excludes service products from the purchase-order product list', () => {
    const products = [
      {
        id: 'service-1',
        name: 'Consulting',
        item_type: 'service',
        branch_id: 'branch-1',
      },
      {
        id: 'product-1',
        name: 'Widgets',
        item_type: 'product',
        branch_id: 'branch-1',
      },
      {
        id: 'variable-1',
        name: 'T-shirt',
        item_type: 'variable',
        branch_id: 'branch-1',
      },
      {
        id: 'other-branch',
        name: 'Other Branch Item',
        item_type: 'product',
        branch_id: 'branch-2',
      },
    ] as Product[];

    const result = getPurchasableProductsForPurchase(products, 'branch-1');

    expect(result.map((product) => product.id)).toEqual(['product-1', 'variable-1']);
  });

  it('caps purchase returns by current stock and already purchased quantity', () => {
    expect(getMaxReturnableQuantity(10, 3, 2)).toBe(3);
    expect(getMaxReturnableQuantity(4, 10, 6)).toBe(0);
    expect(getMaxReturnableQuantity(5, 0, 0)).toBe(0);
  });
});
