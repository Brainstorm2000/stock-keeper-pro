export function getPurchaseItemKey(
  productId: string,
  variationId?: string | null,
  unitMultiplier?: number,
): string {
  return `${productId}:${variationId || ''}:${unitMultiplier ?? 1}`;
}
