import { describe, it, expect } from 'vitest';
import { buildSaleStockAdjustments } from '@/lib/sale-stock';
import { getDefaultAttendanceHours } from '@/lib/attendance-hours';

describe('buildSaleStockAdjustments', () => {
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

  it('defaults attendance hours to zero when a staff clocks in without clocking out', () => {
    expect(getDefaultAttendanceHours()).toEqual({
      hoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0,
    });
  });
});
