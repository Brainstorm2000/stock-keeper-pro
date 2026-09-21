export interface TaxableSaleItemLike {
  product_id: string;
  quantity?: number;
  cost_price?: number;
  unit_price?: number;
  total_price?: number;
}

export interface TaxableSaleLike {
  id: string;
  status?: string;
  created_at?: string;
  subtotal?: number;
  total_amount?: number;
  wht_amount?: number;
  sale_items?: TaxableSaleItemLike[];
}

export interface TaxableProductLike {
  id: string;
  is_taxable?: boolean;
  item_type?: "product" | "service" | "variable";
}

export function getTaxableSales(
  sales: TaxableSaleLike[],
  products: TaxableProductLike[],
): TaxableSaleLike[] {
  const productLookup = new Map(products.map((product) => [product.id, Boolean(product.is_taxable)]));

  return sales.filter((sale) => {
    if (sale.status !== "completed") return false;
    const items = sale.sale_items ?? [];
    if (!items.length) return false;

    return items.some((item) => {
      const product = productLookup.get(item.product_id);
      return product === true;
    });
  });
}
