import type { Product } from '@/hooks/useProducts';
import type { Sale } from '@/hooks/useSales';

interface SaleReturn {
  sale_id: string;
  total_amount: number;
}

export function calculateSellableInventoryValue(
  products: Product[],
  branchId: string,
  category = 'all',
  supplierId = 'all',
  search = '',
) {
  const normalizedSearch = search.trim().toLowerCase();
  return products
    .filter((product) =>
      !product.is_archived &&
      product.item_type !== 'service' &&
      product.category === 'sellable' &&
      (branchId === 'all' || product.branch_id === branchId) &&
      (category === 'all' || product.category === category) &&
      (supplierId === 'all' || product.supplier_id === supplierId) &&
      (!normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku?.toLowerCase().includes(normalizedSearch)),
    )
    .reduce((total, product) => {
      if (product.item_type === 'variable' && product.variations?.length) {
        return total + product.variations.reduce(
          (sum, variation) => sum + Number(variation.current_stock) * Number(variation.selling_price),
          0,
        );
      }
      return total + Number(product.current_stock) * Number(product.selling_price);
    }, 0);
}

export function calculateCompletedRevenue(
  sales: Sale[],
  returns: SaleReturn[],
  from?: Date,
  to?: Date,
  branchId = 'all',
) {
  const filteredSales = sales.filter((sale) => {
    const date = new Date(sale.created_at);
    return sale.status === 'completed' &&
      (!from || date >= from) &&
      (!to || date <= to) &&
      (branchId === 'all' || sale.branch_id === branchId);
  });
  const saleIds = new Set(filteredSales.map((sale) => sale.id));
  const returnedBySale = returns.reduce((total, saleReturn) =>
    saleIds.has(saleReturn.sale_id) ? total + Number(saleReturn.total_amount || 0) : total, 0);

  return Math.max(0, filteredSales.reduce(
    (total, sale) => total + Math.max(0, Number(sale.total_amount || 0) - Number(sale.balance_due || 0)),
    0,
  ) - returnedBySale);
}

export function calculateCompletedCogs(
  sales: Sale[],
  from?: Date,
  to?: Date,
  branchId = 'all',
) {
  return sales
    .filter((sale) => {
      const date = new Date(sale.created_at);
      return sale.status === 'completed' &&
        (!from || date >= from) &&
        (!to || date <= to) &&
        (branchId === 'all' || sale.branch_id === branchId);
    })
    .reduce((total, sale) => total + (sale.sale_items || []).reduce(
      (saleTotal, item) => saleTotal + Number(item.quantity || 0) * Number(item.cost_price || 0),
      0,
    ), 0);
}