import type { Product } from '@/hooks/useProducts';

export interface CSVRow {
  name: string;
  unit: string;
  opening_stock: string;
  current_stock: string;
  low_stock_threshold: string;
  out_of_stock_threshold: string;
  sku?: string;
  description?: string;
  branch?: string;
}

export interface ParsedCSVProduct {
  name: string;
  unit_name: string;
  item_type: 'product' | 'service';
  category: 'sellable' | 'consumable';
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  cost_price: number;
  selling_price: number;
  sku?: string;
  description?: string;
  branch_name?: string;
  supplier_name?: string;
  brand_name?: string;
}

// Generic CSV row for simple imports
export interface GenericCSVRow {
  [key: string]: string;
}

// Export products to CSV
export function exportProductsToCSV(
  products: Product[],
  branches?: { id: string; name: string }[],
  suppliers?: { id: string; name: string }[],
  brands?: { id: string; name: string }[]
): string {
  const headers = [
    'Product Name',
    'Item Type',
    'Category',
    'Unit',
    'Opening Stock',
    'Current Stock',
    'Low Stock Threshold',
    'Out of Stock Threshold',
    'Cost Price',
    'Selling Price',
    'SKU',
    'Description',
    'Branch',
    'Supplier',
    'Brand',
    'Last Updated',
  ];

  const rows = products.map((product) => {
    const branchName = branches?.find((b) => b.id === product.branch_id)?.name || '';
    const supplierName = suppliers?.find((s) => s.id === product.supplier_id)?.name || '';
    const brandName = brands?.find((b) => b.id === product.brand_id)?.name || '';
    return [
      escapeCSV(product.name),
      product.item_type || 'product',
      product.category || 'sellable',
      escapeCSV(product.units?.name || ''),
      product.opening_stock.toString(),
      product.current_stock.toString(),
      product.low_stock_threshold.toString(),
      product.out_of_stock_threshold.toString(),
      (product.cost_price || 0).toString(),
      (product.selling_price || 0).toString(),
      escapeCSV(product.sku || ''),
      escapeCSV(product.description || ''),
      escapeCSV(branchName),
      escapeCSV(supplierName),
      escapeCSV(brandName),
      new Date(product.updated_at).toLocaleString(),
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

// Escape CSV special characters
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Parse CSV content
export function parseCSV(content: string): ParsedCSVProduct[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  
  // Map headers to expected fields
  const headerMap = {
    name: findHeader(headers, ['product name', 'name', 'product']),
    item_type: findHeader(headers, ['item type', 'type', 'item_type']),
    category: findHeader(headers, ['category', 'product category']),
    unit: findHeader(headers, ['unit', 'unit of measurement', 'uom']),
    opening_stock: findHeader(headers, ['opening stock', 'opening', 'initial stock']),
    current_stock: findHeader(headers, ['current stock', 'current', 'stock', 'quantity']),
    low_stock_threshold: findHeader(headers, ['low stock threshold', 'low stock', 'low threshold', 'reorder level']),
    out_of_stock_threshold: findHeader(headers, ['out of stock threshold', 'out of stock', 'oos threshold']),
    cost_price: findHeader(headers, ['cost price', 'cost', 'purchase price', 'buying price']),
    selling_price: findHeader(headers, ['selling price', 'price', 'sale price', 'retail price']),
    sku: findHeader(headers, ['sku', 'product code', 'code', 'barcode']),
    description: findHeader(headers, ['description', 'desc', 'notes']),
    branch: findHeader(headers, ['branch', 'location', 'store']),
    supplier: findHeader(headers, ['supplier', 'vendor']),
    brand: findHeader(headers, ['brand', 'manufacturer']),
  };

  if (headerMap.name === -1) {
    throw new Error('CSV must have a "Product Name" or "Name" column');
  }
  if (headerMap.unit === -1) {
    throw new Error('CSV must have a "Unit" column');
  }

  const products: ParsedCSVProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const name = values[headerMap.name]?.trim();
    const unit_name = values[headerMap.unit]?.trim();

    if (!name || !unit_name) {
      throw new Error(`Row ${i + 1}: Product name and unit are required`);
    }

    // Parse item_type with default 'product'
    let item_type: 'product' | 'service' = 'product';
    if (headerMap.item_type !== -1 && values[headerMap.item_type]) {
      const typeValue = values[headerMap.item_type].trim().toLowerCase();
      if (typeValue === 'service') {
        item_type = 'service';
      }
    }

    // Parse category with default 'sellable'
    let category: 'sellable' | 'consumable' = 'sellable';
    if (headerMap.category !== -1 && values[headerMap.category]) {
      const categoryValue = values[headerMap.category].trim().toLowerCase();
      if (categoryValue === 'consumable') {
        category = 'consumable';
      }
    }

    const product: ParsedCSVProduct = {
      name,
      unit_name,
      item_type,
      category,
      opening_stock: parseNumber(values[headerMap.opening_stock], 0),
      current_stock: parseNumber(values[headerMap.current_stock], 0),
      low_stock_threshold: parseNumber(values[headerMap.low_stock_threshold], 10),
      out_of_stock_threshold: parseNumber(values[headerMap.out_of_stock_threshold], 0),
      cost_price: parseNumber(values[headerMap.cost_price], 0),
      selling_price: parseNumber(values[headerMap.selling_price], 0),
    };

    if (headerMap.sku !== -1 && values[headerMap.sku]) {
      product.sku = values[headerMap.sku].trim();
    }
    if (headerMap.description !== -1 && values[headerMap.description]) {
      product.description = values[headerMap.description].trim();
    }
    if (headerMap.branch !== -1 && values[headerMap.branch]) {
      product.branch_name = values[headerMap.branch].trim();
    }
    if (headerMap.supplier !== -1 && values[headerMap.supplier]) {
      product.supplier_name = values[headerMap.supplier].trim();
    }
    if (headerMap.brand !== -1 && values[headerMap.brand]) {
      product.brand_name = values[headerMap.brand].trim();
    }

    products.push(product);
  }

  return products;
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

// Find header index
function findHeader(headers: string[], options: string[]): number {
  for (const option of options) {
    const index = headers.indexOf(option);
    if (index !== -1) return index;
  }
  return -1;
}

// Parse number with default
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const num = parseFloat(value.trim());
  return isNaN(num) ? defaultValue : num;
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Generate sample CSV template
export function generateCSVTemplate(): string {
  const headers = [
    'Product Name',
    'Item Type',
    'Category',
    'Unit',
    'Opening Stock',
    'Current Stock',
    'Low Stock Threshold',
    'Out of Stock Threshold',
    'Cost Price',
    'Selling Price',
    'SKU',
    'Description',
    'Branch',
    'Supplier',
    'Brand',
  ];

  const sampleRow = [
    'Sample Product',
    'product',
    'sellable',
    'Pieces',
    '100',
    '50',
    '10',
    '0',
    '5000',
    '7500',
    'SKU-001',
    'Sample description',
    'Main Store',
    'Sample Supplier',
    'Sample Brand',
  ];

  return [headers.join(','), sampleRow.join(',')].join('\n');
}

// Generate CSV template for brands
export function generateBrandsCSVTemplate(): string {
  const headers = ['name', 'description'];
  const sampleRow = ['Sample Brand', 'Description of the brand'];
  return [headers.join(','), sampleRow.join(',')].join('\n');
}

// Generate CSV template for suppliers
export function generateSuppliersCSVTemplate(): string {
  const headers = ['name', 'phone', 'email', 'address', 'notes'];
  const sampleRow = ['Sample Supplier', '+1234567890', 'supplier@example.com', '123 Main St', 'Notes about supplier'];
  return [headers.join(','), sampleRow.join(',')].join('\n');
}

// Generate CSV template for customers
export function generateCustomersCSVTemplate(): string {
  const headers = ['name', 'phone', 'email', 'address', 'notes'];
  const sampleRow = ['Sample Customer', '+1234567890', 'customer@example.com', '456 Oak Ave', 'Preferred customer'];
  return [headers.join(','), sampleRow.join(',')].join('\n');
}

// Generic CSV export for any data array
export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const rows = data.map(item => 
    headers.map(header => escapeCSV(String(item[header] ?? '')))
  );
  
  const content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  downloadCSV(content, filename);
}

// Parse generic CSV file
export async function parseGenericCSV(file: File): Promise<GenericCSVRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('CSV file must have at least a header row and one data row');
        }

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
        const rows: GenericCSVRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = parseCSVLine(line);
          const row: GenericCSVRow = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });

          rows.push(row);
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
