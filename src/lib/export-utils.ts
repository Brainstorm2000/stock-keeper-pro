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

export function exportToPDF(title: string, headers: string[], rows: string[][], summary?: Record<string, string>, orgDetails?: { name: string; address?: string | null; email?: string | null; logo_url?: string | null }) {
  // Generate a simple HTML-based printable PDF
  const html = `
    <!DOCTYPE html>
    <html><head><title>${title}</title>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
      .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #eaeaea; padding-bottom: 16px; }
      .org-details { display: flex; align-items: center; gap: 16px; }
      .org-logo { max-height: 60px; max-width: 150px; object-fit: contain; }
      .org-info { font-size: 14px; color: #555; }
      .org-name { font-size: 20px; font-weight: bold; color: #111; margin: 0 0 4px 0; }
      .report-title-container { text-align: right; }
      h1 { font-size: 24px; margin: 0 0 8px 0; color: #111; }
      .meta { font-size: 12px; color: #666; }
      .summary { display: flex; gap: 24px; margin-bottom: 20px; background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #eaeaea; }
      .summary-item { display: flex; flex-direction: column; gap: 4px; }
      .summary-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
      .summary-value { font-size: 18px; font-weight: bold; color: #111; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
      th { background: #f3f4f6; text-align: left; padding: 12px; border-bottom: 2px solid #d1d5db; color: #374151; font-weight: 600; }
      td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
      tr:nth-child(even) { background: #f9fafb; }
      @media print {
        @page { margin: 1cm; }
        body { padding: 0; }
      }
    </style></head><body>
    <div class="header-container">
      <div class="org-details">
        ${orgDetails?.logo_url ? `<img src="${orgDetails.logo_url}" class="org-logo" alt="${orgDetails.name} logo" />` : ''}
        <div class="org-info">
          ${orgDetails ? `
            <h2 class="org-name">${orgDetails.name}</h2>
            ${orgDetails.address ? `<div>${orgDetails.address}</div>` : ''}
            ${orgDetails.email ? `<div>${orgDetails.email}</div>` : ''}
          ` : `
            <h2 class="org-name">Company Report</h2>
          `}
        </div>
      </div>
      <div class="report-title-container">
        <h1>${title}</h1>
        <div class="meta">Generated on ${format(new Date(), 'PPP pp')}</div>
      </div>
    </div>
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
