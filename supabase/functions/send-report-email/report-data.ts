// Builds report sections (headers + rows + summary) for a given organization/period.

export interface ReportSection {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  summary: Record<string, string>;
}

export interface ReportBundle {
  orgName: string;
  periodStart: string;
  periodEnd: string;
  sections: ReportSection[];
}

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const day = (v: unknown) => (v ? String(v).slice(0, 10) : '');

// deno-lint-ignore no-explicit-any
export async function buildReport(
  supabase: any,
  organizationId: string,
  periodStart: string,
  periodEnd: string,
  reports: string[],
): Promise<ReportBundle> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  const sections: ReportSection[] = [];
  const startISO = `${periodStart}T00:00:00.000Z`;
  const endISO = `${periodEnd}T23:59:59.999Z`;

  if (reports.includes('sales')) {
    const { data } = await supabase
      .from('sales')
      .select('sale_number, created_at, customer_name, total_amount, amount_paid, balance_due, payment_status, status')
      .eq('organization_id', organizationId)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false });
    const rows = (data ?? []).map((s: Record<string, unknown>) => [
      String(s.sale_number ?? ''),
      day(s.created_at),
      String(s.customer_name || 'Walk-in'),
      money(s.total_amount),
      money(s.amount_paid),
      money(s.balance_due),
      String(s.payment_status ?? ''),
    ]);
    const total = (data ?? []).reduce((a: number, s: Record<string, unknown>) => a + Number(s.total_amount ?? 0), 0);
    const outstanding = (data ?? []).reduce((a: number, s: Record<string, unknown>) => a + Number(s.balance_due ?? 0), 0);
    sections.push({
      name: 'Sales',
      headers: ['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Balance', 'Payment Status'],
      rows,
      summary: {
        'Transactions': String(rows.length),
        'Total Revenue': money(total),
        'Outstanding': money(outstanding),
      },
    });
  }

  if (reports.includes('inventory')) {
    const { data } = await supabase
      .from('products')
      .select('name, sku, current_stock, low_stock_threshold, out_of_stock_threshold, cost_price, selling_price, item_type')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('name');
    const items = (data ?? []).filter((p: Record<string, unknown>) => p.item_type !== 'service');
    const rows = items.map((p: Record<string, unknown>) => [
      String(p.name ?? ''),
      String(p.sku ?? ''),
      Number(p.current_stock ?? 0),
      money(p.cost_price),
      money(p.selling_price),
      money(Number(p.current_stock ?? 0) * Number(p.cost_price ?? 0)),
    ]);
    const stockValue = items.reduce(
      (a: number, p: Record<string, unknown>) => a + Number(p.current_stock ?? 0) * Number(p.cost_price ?? 0),
      0,
    );
    const lowStock = items.filter(
      (p: Record<string, unknown>) => Number(p.current_stock ?? 0) <= Number(p.low_stock_threshold ?? 0),
    ).length;
    sections.push({
      name: 'Inventory',
      headers: ['Product', 'SKU', 'Stock', 'Cost Price', 'Selling Price', 'Stock Value'],
      rows,
      summary: {
        'Products': String(rows.length),
        'Stock Value': money(stockValue),
        'Low / Out of Stock': String(lowStock),
      },
    });
  }

  if (reports.includes('purchases')) {
    const { data } = await supabase
      .from('purchases')
      .select('purchase_number, purchase_date, total_amount, amount_paid, payment_status, suppliers(name)')
      .eq('organization_id', organizationId)
      .gte('purchase_date', periodStart)
      .lte('purchase_date', periodEnd)
      .order('purchase_date', { ascending: false });
    const rows = (data ?? []).map((p: Record<string, any>) => [
      String(p.purchase_number ?? ''),
      day(p.purchase_date),
      String(p.suppliers?.name ?? ''),
      money(p.total_amount),
      money(p.amount_paid),
      String(p.payment_status ?? ''),
    ]);
    const total = (data ?? []).reduce((a: number, p: Record<string, unknown>) => a + Number(p.total_amount ?? 0), 0);
    const paid = (data ?? []).reduce((a: number, p: Record<string, unknown>) => a + Number(p.amount_paid ?? 0), 0);
    sections.push({
      name: 'Purchases',
      headers: ['PO Number', 'Date', 'Supplier', 'Total', 'Paid', 'Status'],
      rows,
      summary: {
        'Orders': String(rows.length),
        'Total Spend': money(total),
        'Amount Paid': money(paid),
      },
    });
  }

  if (reports.includes('expenses')) {
    const { data } = await supabase
      .from('expenses')
      .select('expense_date, description, amount, expense_categories(name)')
      .eq('organization_id', organizationId)
      .gte('expense_date', periodStart)
      .lte('expense_date', periodEnd)
      .order('expense_date', { ascending: false });
    const rows = (data ?? []).map((e: Record<string, any>) => [
      day(e.expense_date),
      String(e.description ?? ''),
      String(e.expense_categories?.name ?? 'Uncategorised'),
      money(e.amount),
    ]);
    const total = (data ?? []).reduce((a: number, e: Record<string, unknown>) => a + Number(e.amount ?? 0), 0);
    sections.push({
      name: 'Expenses',
      headers: ['Date', 'Description', 'Category', 'Amount'],
      rows,
      summary: {
        'Entries': String(rows.length),
        'Total Expenses': money(total),
      },
    });
  }

  return {
    orgName: org?.name ?? 'Organization',
    periodStart,
    periodEnd,
    sections,
  };
}
