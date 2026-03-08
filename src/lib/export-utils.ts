import { format } from 'date-fns';

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

export function exportToPDF(title: string, headers: string[], rows: string[][], summary?: Record<string, string>) {
  // Generate a simple HTML-based printable PDF
  const html = `
    <!DOCTYPE html>
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
      .summary { display: flex; gap: 24px; margin-bottom: 16px; }
      .summary-item { background: #f5f5f5; padding: 8px 16px; border-radius: 6px; }
      .summary-label { font-size: 11px; color: #888; }
      .summary-value { font-size: 16px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f0f0f0; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; }
      td { padding: 8px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) { background: #fafafa; }
    </style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generated on ${format(new Date(), 'PPP pp')}</div>
    ${summary ? `<div class="summary">${Object.entries(summary).map(([k, v]) => `<div class="summary-item"><div class="summary-label">${k}</div><div class="summary-value">${v}</div></div>`).join('')}</div>` : ''}
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => { w.print(); };
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
