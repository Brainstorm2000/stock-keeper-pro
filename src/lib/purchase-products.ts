import type { Product } from '@/hooks/useProducts';

export function getPurchasableProductsForPurchase(products: Product[], branchId?: string) {
  if (!branchId) return [];

  return products.filter((product) => {
    const matchesBranch = product.branch_id === branchId || !product.branch_id;
    const isPurchasableItem = product.item_type !== 'service';

    return matchesBranch && isPurchasableItem;
  });
}

export function getMaxReturnableQuantity(purchasedQuantity: number, currentStock: number, alreadyReturnedQuantity: number) {
  const remainingPurchasedQuantity = Math.max(0, purchasedQuantity - alreadyReturnedQuantity);
  const availableStockQuantity = Math.max(0, currentStock);

  return Math.min(remainingPurchasedQuantity, availableStockQuantity);
}
