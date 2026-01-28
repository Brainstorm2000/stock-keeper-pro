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
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  sku?: string;
  description?: string;
  branch_name?: string;
}

// Export products to CSV
export function exportProductsToCSV(
  products: Product[],
  branches?: { id: string; name: string }[]
): string {
  const headers = [
    'Product Name',
    'Unit',
    'Opening Stock',
    'Current Stock',
    'Low Stock Threshold',
    'Out of Stock Threshold',
    'SKU',
    'Description',
    'Branch',
    'Last Updated',
  ];

  const rows = products.map((product) => {
    const branchName = branches?.find((b) => b.id === product.branch_id)?.name || '';
    return [
      escapeCSV(product.name),
      escapeCSV(product.units?.name || ''),
      product.opening_stock.toString(),
      product.current_stock.toString(),
      product.low_stock_threshold.toString(),
      product.out_of_stock_threshold.toString(),
      escapeCSV(product.sku || ''),
      escapeCSV(product.description || ''),
      escapeCSV(branchName),
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
    unit: findHeader(headers, ['unit', 'unit of measurement', 'uom']),
    opening_stock: findHeader(headers, ['opening stock', 'opening', 'initial stock']),
    current_stock: findHeader(headers, ['current stock', 'current', 'stock', 'quantity']),
    low_stock_threshold: findHeader(headers, ['low stock threshold', 'low stock', 'low threshold', 'reorder level']),
    out_of_stock_threshold: findHeader(headers, ['out of stock threshold', 'out of stock', 'oos threshold']),
    sku: findHeader(headers, ['sku', 'product code', 'code', 'barcode']),
    description: findHeader(headers, ['description', 'desc', 'notes']),
    branch: findHeader(headers, ['branch', 'location', 'store']),
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

    const product: ParsedCSVProduct = {
      name,
      unit_name,
      opening_stock: parseNumber(values[headerMap.opening_stock], 0),
      current_stock: parseNumber(values[headerMap.current_stock], 0),
      low_stock_threshold: parseNumber(values[headerMap.low_stock_threshold], 10),
      out_of_stock_threshold: parseNumber(values[headerMap.out_of_stock_threshold], 0),
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
    'Unit',
    'Opening Stock',
    'Current Stock',
    'Low Stock Threshold',
    'Out of Stock Threshold',
    'SKU',
    'Description',
    'Branch',
  ];

  const sampleRow = [
    'Sample Product',
    'Pieces',
    '100',
    '50',
    '10',
    '0',
    'SKU-001',
    'Sample description',
    'Main Store',
  ];

  return [headers.join(','), sampleRow.join(',')].join('\n');
}
