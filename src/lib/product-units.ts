import type { Product } from "@/hooks/useProducts";

export function getProductStockFactor(product: Pick<Product, "sub_unit_id" | "sub_unit_factor">): number {
  return product.sub_unit_id ? Number(product.sub_unit_factor) || 1 : 1;
}

export function getProductMainUnitLabel(product: Pick<Product, "units">): string {
  return product.units?.abbreviation || product.units?.name || "unit";
}

export function getProductSubUnitLabel(
  product: Pick<Product, "sub_unit_id" | "sub_units">,
): string | null {
  if (!product.sub_unit_id) return null;
  return product.sub_units?.abbreviation || product.sub_units?.name || "subunit";
}

export function formatProductStock(product: Product): string {
  return formatProductStockQuantity(product, Number(product.current_stock));
}

export function formatProductStockQuantity(
  product: {
    sub_unit_id?: string | null;
    sub_unit_factor?: number | null;
    units?: { name?: string | null; abbreviation?: string | null } | null;
    sub_units?: { name?: string | null; abbreviation?: string | null } | null;
  },
  stock: number,
): string {
  const mainUnitLabel = product.units?.abbreviation || product.units?.name || "unit";
  if (!product.sub_unit_id) {
    return `${stock.toLocaleString()} ${mainUnitLabel}`;
  }

  const subUnitLabel = product.sub_units?.abbreviation || product.sub_units?.name || "subunit";
  const factor = Number(product.sub_unit_factor) || 1;
  const mainUnits = Math.floor(stock / factor);
  const subUnits = stock - mainUnits * factor;
  const parts: string[] = [];

  if (mainUnits !== 0) {
    const mainUnitName = (product.units?.name || mainUnitLabel).toLocaleLowerCase();
    parts.push(`${mainUnits.toLocaleString()} ${formatUnitName(mainUnitName, mainUnits)}`);
  }
  if (subUnits !== 0 || parts.length === 0) {
    const subUnitName = (product.sub_units?.name || subUnitLabel).toLocaleLowerCase();
    parts.push(`${subUnits.toLocaleString()} ${formatUnitName(subUnitName, subUnits)}`);
  }

  return parts.join(", ");
}

function formatUnitName(name: string, quantity: number): string {
  const normalized = name.trim();
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  if (Math.abs(quantity) === 1) return singular;
  if (normalized.toLowerCase().endsWith("s")) return normalized;
  return `${singular}${/[sxz]$|(?:ch|sh)$/i.test(singular) ? "es" : "s"}`;
}

export function getUnitMultiplier(product: Product, unit: "main" | "sub"): number {
  return unit === "main" ? getProductStockFactor(product) : 1;
}

export function getUnitLabel(product: Product, unit: "main" | "sub"): string {
  return unit === "main"
    ? getProductMainUnitLabel(product)
    : getProductSubUnitLabel(product) || getProductMainUnitLabel(product);
}
