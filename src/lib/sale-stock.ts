export interface SaleStockAdjustment {
  product_id: string;
  variation_id?: string | null;
  quantity: number;
}

interface StockProduct {
  id: string;
  current_stock: number;
  item_type: string;
  variations?: Array<{ id: string; current_stock: number }>;
}

export function applySaleStockAdjustments<T extends StockProduct>(
  products: T[],
  adjustments: SaleStockAdjustment[],
) {
  return products.map((product) => {
    if (product.item_type === 'service') return product;

    const productAdjustment = adjustments
      .filter((adjustment) => adjustment.product_id === product.id)
      .reduce((total, adjustment) => total + adjustment.quantity, 0);
    if (productAdjustment === 0) return product;

    return {
      ...product,
      current_stock: Number(product.current_stock) - productAdjustment,
      variations: product.variations?.map((variation) => {
        const variationAdjustment = adjustments
          .filter((adjustment) =>
            adjustment.product_id === product.id &&
            adjustment.variation_id === variation.id,
          )
          .reduce((total, adjustment) => total + adjustment.quantity, 0);
        return variationAdjustment === 0
          ? variation
          : {
              ...variation,
              current_stock: Number(variation.current_stock) - variationAdjustment,
            };
      }),
    };
  });
}

export function buildSaleStockAdjustments(
  previousItems: Array<{ product_id: string; variation_id?: string | null; quantity: number; unit_multiplier?: number | null }>,
  nextItems: Array<{ product_id: string; variation_id?: string | null; quantity: number; unit_multiplier?: number | null }>,
) {
  const previousMap = new Map<string, number>();
  const nextMap = new Map<string, number>();

  const makeKey = (productId: string, variationId?: string | null) =>
    variationId ? `${productId}:${variationId}` : productId;

  for (const item of previousItems) {
    const key = makeKey(item.product_id, item.variation_id);
    previousMap.set(
      key,
      (previousMap.get(key) || 0) + Number(item.quantity) * Number(item.unit_multiplier || 1),
    );
  }

  for (const item of nextItems) {
    const key = makeKey(item.product_id, item.variation_id);
    nextMap.set(
      key,
      (nextMap.get(key) || 0) + Number(item.quantity) * Number(item.unit_multiplier || 1),
    );
  }

  const keys = new Set([...nextMap.keys(), ...previousMap.keys()]);

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
