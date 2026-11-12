import { describe, expect, it } from 'vitest';
import {
  getExpirationStatus,
  matchesExpirationFilter,
} from './expiration-status';
import { getExpirationAlertCounts } from './expiration-alerts';
import type { Product } from '@/hooks/useProducts';
import type { InventoryBatch } from '@/hooks/useInventoryBatches';

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

describe('getExpirationAlertCounts', () => {
  it('counts active batch rows and batchless product expiry with the same rules as the alert table', () => {
    const products = [
      {
        id: 'batched-product',
        organization_id: 'org-1',
        branch_id: 'branch-1',
        item_type: 'product',
        current_stock: 8,
        expiration_date: '2027-01-01',
        cost_price: 2,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'unbatched-product',
        organization_id: 'org-1',
        branch_id: 'branch-1',
        item_type: 'product',
        current_stock: 3,
        expiration_date: '2026-08-30',
        cost_price: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ] as Product[];
    const batches = [
      {
        id: 'expired-batch',
        organization_id: 'org-1',
        branch_id: 'branch-1',
        product_id: 'batched-product',
        variation_id: null,
        raw_material_id: null,
        purchase_item_id: null,
        batch_number: 'BATCH-1',
        expiration_date: '2026-08-30',
        initial_quantity: 5,
        remaining_quantity: 5,
        unit_cost: 2,
        source_type: 'purchase',
        source_id: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'second-expired-batch',
        organization_id: 'org-1',
        branch_id: 'branch-1',
        product_id: 'batched-product',
        variation_id: null,
        raw_material_id: null,
        purchase_item_id: null,
        batch_number: 'BATCH-1B',
        expiration_date: '2026-08-29',
        initial_quantity: 2,
        remaining_quantity: 2,
        unit_cost: 2,
        source_type: 'purchase',
        source_id: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'almost-expired-batch',
        organization_id: 'org-1',
        branch_id: 'branch-1',
        product_id: 'batched-product',
        variation_id: null,
        raw_material_id: null,
        purchase_item_id: null,
        batch_number: 'BATCH-2',
        expiration_date: '2026-09-20',
        initial_quantity: 3,
        remaining_quantity: 3,
        unit_cost: 2,
        source_type: 'purchase',
        source_id: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ] as InventoryBatch[];

    expect(getExpirationAlertCounts(products, batches, 'branch-1', new Date(2026, 7, 31))).toEqual({
      expired_items: 2,
      almost_expired_items: 1,
    });
  });
});
