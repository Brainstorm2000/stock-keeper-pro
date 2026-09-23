export function calculateSellingPrice(costPrice: number, markupPercent: number): number {
  return Math.max(0, costPrice * (1 + markupPercent / 100));
}

export function calculateMarkupPercent(costPrice: number, sellingPrice: number): number {
  if (costPrice <= 0) return 0;
  return ((sellingPrice - costPrice) / costPrice) * 100;
}
