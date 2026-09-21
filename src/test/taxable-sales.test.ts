import { describe, expect, it } from "vitest";
import { getTaxableSales } from "@/lib/taxable-sales";

describe("getTaxableSales", () => {
  it("keeps only completed sales that contain taxable products or services", () => {
    const sales = [
      {
        id: "sale-1",
        created_at: "2026-01-02T00:00:00.000Z",
        status: "completed",
        subtotal: 100,
        total_amount: 100,
        wht_amount: 10,
        sale_items: [
          { product_id: "prod-taxable", quantity: 1, cost_price: 50 },
          { product_id: "prod-non-taxable", quantity: 1, cost_price: 20 },
        ],
      },
      {
        id: "sale-2",
        created_at: "2026-01-04T00:00:00.000Z",
        status: "completed",
        subtotal: 80,
        total_amount: 80,
        wht_amount: 5,
        sale_items: [
          { product_id: "prod-non-taxable", quantity: 2, cost_price: 30 },
        ],
      },
      {
        id: "sale-3",
        created_at: "2026-01-05T00:00:00.000Z",
        status: "pending",
        subtotal: 200,
        total_amount: 200,
        wht_amount: 20,
        sale_items: [
          { product_id: "prod-taxable", quantity: 1, cost_price: 100 },
        ],
      },
    ] as any;

    const products = [
      { id: "prod-taxable", is_taxable: true },
      { id: "prod-non-taxable", is_taxable: false },
    ] as any;

    expect(getTaxableSales(sales, products).map((sale) => sale.id)).toEqual(["sale-1"]);
  });

  it("treats a service as taxable when flagged as taxable", () => {
    const sales = [
      {
        id: "service-sale",
        created_at: "2026-01-06T00:00:00.000Z",
        status: "completed",
        subtotal: 250,
        total_amount: 250,
        wht_amount: 12,
        sale_items: [
          { product_id: "service-1", quantity: 1, cost_price: 100 },
        ],
      },
    ] as any;

    const products = [
      { id: "service-1", is_taxable: true },
    ] as any;

    expect(getTaxableSales(sales, products).map((sale) => sale.id)).toEqual(["service-sale"]);
  });
});
