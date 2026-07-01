export interface SaleStockAdjustment {
  product_id: string;
  variation_id?: string | null;
  quantity: number;
}

export function buildSaleStockAdjustments(
  previousItems: Array<{ product_id: string; variation_id?: string | null; quantity: number }>,
  nextItems: Array<{ product_id: string; variation_id?: string | null; quantity: number }>,
) {
  const previousMap = new Map<string, number>();
  const nextMap = new Map<string, number>();

  const makeKey = (productId: string, variationId?: string | null) =>
    variationId ? `${productId}:${variationId}` : productId;

  for (const item of previousItems) {
    const key = makeKey(item.product_id, item.variation_id);
    previousMap.set(key, (previousMap.get(key) || 0) + Number(item.quantity));
  }

  for (const item of nextItems) {
    const key = makeKey(item.product_id, item.variation_id);
    nextMap.set(key, (nextMap.get(key) || 0) + Number(item.quantity));
  }

  const keys = new Set([...previousMap.keys(), ...nextMap.keys()]);

  return Array.from(keys).reduce<SaleStockAdjustment[]>((acc, key) => {
    const previousQuantity = previousMap.get(key) || 0;
    const nextQuantity = nextMap.get(key) || 0;
    const delta = nextQuantity - previousQuantity;

    if (delta === 0) return acc;

    const [product_id, variation_id] = key.split(':');
    acc.push({
      product_id,
      variation_id: key.includes(':') ? variation_id : null,
      quantity: delta,
    });

    return acc;
  }, []);
}
