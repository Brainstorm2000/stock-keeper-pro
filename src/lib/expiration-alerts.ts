import type { Product } from '@/hooks/useProducts';
import type { InventoryBatch } from '@/hooks/useInventoryBatches';
import { getExpirationStatus } from '@/lib/expiration-status';

export function getExpirationAlertBatches(
  products: Product[],
  batches: InventoryBatch[],
  branchId?: string,
): InventoryBatch[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const activeBatches = batches.filter((batch) => {
    const product = batch.product_id ? productsById.get(batch.product_id) : null;
    const matchesBranch = !branchId || branchId === 'all' || batch.branch_id === null || batch.branch_id === branchId;
    return product && product.item_type !== 'service' && batch.remaining_quantity > 0 && matchesBranch;
  });
  const productsWithActiveBatches = new Set(activeBatches.map((batch) => batch.product_id));
  const unbatchedStock = products.flatMap((product): InventoryBatch[] => {
    const stock = Number(product.current_stock);
    const matchesBranch = !branchId || branchId === 'all' || product.branch_id === branchId;
    if (
      product.item_type === 'service' ||
      !matchesBranch ||
      stock <= 0 ||
      !product.expiration_date ||
      productsWithActiveBatches.has(product.id)
    ) {
      return [];
    }

    return [{
      id: `unbatched-${product.id}`,
      organization_id: product.organization_id,
      branch_id: product.branch_id,
      product_id: product.id,
      variation_id: null,
      raw_material_id: null,
      purchase_item_id: null,
      batch_number: 'Unbatched stock',
      expiration_date: product.expiration_date,
      initial_quantity: stock,
      remaining_quantity: stock,
      unit_cost: Number(product.cost_price) || 0,
      source_type: 'product_expiry_fallback',
      source_id: null,
      created_at: product.created_at,
    }];
  });

  return [...activeBatches, ...unbatchedStock];
}

export function getExpirationAlertCounts(
  products: Product[],
  batches: InventoryBatch[],
  branchId?: string,
  today = new Date(),
) {
  const expiredProducts = getExpirationProductIds(products, batches, 'expired', branchId, today);
  const almostExpiredProducts = getExpirationProductIds(products, batches, 'almost_expired', branchId, today);
  return {
    expired_items: expiredProducts.size,
    almost_expired_items: almostExpiredProducts.size,
  };
}

export function getExpirationProductIds(
  products: Product[],
  batches: InventoryBatch[],
  status: 'expired' | 'almost_expired',
  branchId?: string,
  today = new Date(),
) {
  return new Set(
    getExpirationAlertBatches(products, batches, branchId)
      .filter((batch) => getExpirationStatus(batch.expiration_date, today) === status)
      .flatMap((batch) => batch.product_id ? [batch.product_id] : []),
  );
}