import { describe, expect, it } from "vitest";
import { formatProductStockQuantity } from "./product-units";
import type { Product } from "@/hooks/useProducts";

const product: Product = {
  id: "product-1",
  name: "Packaged item",
  unit_id: "pack",
  sub_unit_id: "piece",
  sub_unit_factor: 10,
  sub_unit_selling_price: 1,
  branch_id: "branch-1",
  supplier_id: null,
  brand_id: null,
  product_category_id: null,
  opening_stock: 0,
  current_stock: 0,
  low_stock_threshold: 0,
  out_of_stock_threshold: 0,
  sku: null,
  description: null,
  category: "sellable",
  is_taxable: true,
  item_type: "product",
  cost_price: 0,
  selling_price: 0,
  expiration_date: null,
  is_archived: false,
  created_at: "",
  updated_at: "",
  units: { id: "pack", name: "Pack", abbreviation: "pk" },
  sub_units: { id: "piece", name: "Piece", abbreviation: "pc" },
};

describe("formatProductStockQuantity", () => {
  it("formats full units and the remaining subunits", () => {
    expect(formatProductStockQuantity(product, 12)).toBe("1 pack, 2 pieces");
  });

  it("omits a zero remainder and formats stock below one full unit", () => {
    expect(formatProductStockQuantity(product, 10)).toBe("1 pack");
    expect(formatProductStockQuantity(product, 3)).toBe("3 pieces");
  });

  it("uses the subunit label for zero stock", () => {
    expect(formatProductStockQuantity(product, 0)).toBe("0 pieces");
  });
});
