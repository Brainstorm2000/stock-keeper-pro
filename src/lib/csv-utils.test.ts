import { describe, expect, it } from 'vitest';
import { exportProductsToCSV, generateCSVTemplate, parseCSV } from './csv-utils';
import type { Product } from '@/hooks/useProducts';

describe('product CSV import and export', () => {
  it('round-trips product fields and main-unit stock for subunit products', () => {
    const product: Product = {
      id: 'product-1',
      name: 'Tea, "Special"',
      unit_id: 'unit-pack',
      sub_unit_id: 'unit-piece',
      sub_unit_factor: 10,
      sub_unit_selling_price: 2.5,
      branch_id: 'branch-1',
      supplier_id: null,
      brand_id: null,
      product_category_id: 'category-1',
      opening_stock: 100,
      current_stock: 50,
      low_stock_threshold: 20,
      out_of_stock_threshold: 0,
      sku: 'TEA-1',
      description: 'Imported\nproduct',
      category: 'sellable',
      is_taxable: false,
      item_type: 'product',
      cost_price: 12,
      selling_price: 20,
      expiration_date: '2027-01-31',
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      units: { id: 'unit-pack', name: 'Pack', abbreviation: 'pk' },
      sub_units: { id: 'unit-piece', name: 'Piece', abbreviation: 'pc' },
      product_categories: { id: 'category-1', name: 'Tea' },
    };

    const csv = exportProductsToCSV([product], [{ id: 'branch-1', name: 'Main Store' }]);
    const [imported] = parseCSV(csv);

    expect(imported).toMatchObject({
      name: product.name,
      item_type: 'product',
      category: 'sellable',
      unit_name: 'Pack',
      opening_stock: 10,
      current_stock: 5,
      low_stock_threshold: 2,
      cost_price: 12,
      selling_price: 20,
      is_taxable: false,
      expiration_date: '2027-01-31',
      sub_unit_name: 'Piece',
      sub_unit_factor: 10,
      sub_unit_selling_price: 2.5,
      description: product.description,
      branch_name: 'Main Store',
    });
  });

  it('generates a template with rows that conform to the import schema', () => {
    const products = parseCSV(generateCSVTemplate());

    expect(products).toHaveLength(4);
    expect(products[0]).toMatchObject({
      name: 'Sample Product',
      unit_name: 'Packs',
      is_taxable: true,
      sub_unit_name: 'Pieces',
      sub_unit_factor: 10,
    });
    expect(products[2]).toMatchObject({
      is_variation: true,
      parent_sku: 'TSHIRT-001',
      variation_attributes: [
        { attribute: 'Size', value: 'Small' },
        { attribute: 'Color', value: 'Red' },
      ],
    });
  });

  it('parses commas, escaped quotes, and line breaks inside CSV fields', () => {
    const [product] = parseCSV(
      'Product Name,Unit,Description\r\n"Tea, ""Special""",Pack,"first line\nsecond line"\r\n',
    );

    expect(product.name).toBe('Tea, "Special"');
    expect(product.description).toBe('first line\nsecond line');
  });
});
