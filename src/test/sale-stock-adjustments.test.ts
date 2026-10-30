import { describe, it, expect } from 'vitest';
import { applySaleStockAdjustments, buildSaleStockAdjustments } from '@/lib/sale-stock';
import { getDefaultAttendanceHours } from '@/lib/attendance-hours';

describe('sale stock adjustments', () => {
  it('returns stock deltas for edited sale items', () => {
    const previousItems = [
      { product_id: 'prod-1', quantity: 2 },
      { product_id: 'prod-2', variation_id: 'var-1', quantity: 1 },
    ];

    const nextItems = [
      { product_id: 'prod-1', quantity: 1 },
      { product_id: 'prod-3', quantity: 3 },
      { product_id: 'prod-2', variation_id: 'var-1', quantity: 2 },
    ];

    expect(buildSaleStockAdjustments(previousItems, nextItems)).toEqual([
      { product_id: 'prod-1', variation_id: null, quantity: -1 },
      { product_id: 'prod-3', variation_id: null, quantity: 3 },
      { product_id: 'prod-2', variation_id: 'var-1', quantity: 1 },
    ]);
  });

  it('restores the sold quantity when an edited item is set to zero', () => {
    expect(
      buildSaleStockAdjustments(
        [{ product_id: 'prod-1', quantity: 3 }],
        [{ product_id: 'prod-1', quantity: 0 }],
      ),
    ).toEqual([{ product_id: 'prod-1', variation_id: null, quantity: -3 }]);
  });

  it('updates completed sale stock immediately without changing services', () => {
    const products = [
      { id: 'prod-1', current_stock: 20, item_type: 'product' },
      {
        id: 'prod-2',
        current_stock: 15,
        item_type: 'variable',
        variations: [{ id: 'var-1', current_stock: 5 }],
      },
      { id: 'service-1', current_stock: 0, item_type: 'service' },
    ];

    expect(
      applySaleStockAdjustments(products, [
        { product_id: 'prod-1', quantity: 3 },
        { product_id: 'prod-2', variation_id: 'var-1', quantity: 2 },
      ]),
    ).toEqual([
      { ...products[0], current_stock: 17 },
      {
        ...products[1],
        current_stock: 13,
        variations: [{ id: 'var-1', current_stock: 3 }],
      },
      products[2],
    ]);
  });

  it('defaults attendance hours to zero when a staff clocks in without clocking out', () => {
    expect(getDefaultAttendanceHours()).toEqual({
      hoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0,
    });
  });
});
