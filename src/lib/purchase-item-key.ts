export function getPurchaseItemKey(productId: string, variationId?: string | null): string {
  return `${productId}:${variationId || ''}`;
}
