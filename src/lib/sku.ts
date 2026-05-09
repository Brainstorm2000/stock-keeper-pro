// Auto-generate a short, readable SKU when none is provided.
// Format: <PREFIX>-<6 base36 chars> (e.g. PRD-K3F9XA)
export function generateSku(prefix: string = 'PRD'): string {
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 6);
  const time = Date.now().toString(36).toUpperCase().slice(-3);
  return `${prefix}-${rand}${time}`;
}