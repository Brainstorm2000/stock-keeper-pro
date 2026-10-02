export type ProductType = 'sellable' | 'consumable' | 'variable' | 'service';

export function getProductType(product: {
  item_type: 'product' | 'service' | 'variable';
  category: 'sellable' | 'consumable';
}): ProductType {
  if (product.item_type === 'service') return 'service';
  if (product.item_type === 'variable') return 'variable';
  return product.category;
}