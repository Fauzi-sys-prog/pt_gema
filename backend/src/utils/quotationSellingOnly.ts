// Quotation is a selling document. Costs belong to project budgeting, not quotations.
const removedKeys = new Set([
  'hargaUnit', 'hpp', 'HPP', 'totalHPP', 'costPerUnit', 'totalCost', 'grossProfit',
  'margin', 'marginPercent', 'costKnown', 'markup', 'markupPercent',
  'overhead', 'overheadPercent', 'contingency', 'contingencyPercent',
]);

export function quotationSellingOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(quotationSellingOnly);
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (removedKeys.has(key)) continue;
    // In dynamic quotation items, legacy `total` held HPP, not selling value.
    if (key === 'total' && ('hargaUnit' in input || 'totalHPP' in input)) continue;
    result[key] = key === 'subKeterangan' && typeof child === 'string'
      ? child.replace(/\n?HPP belum tersedia dari dokumen sumber\./g, '').trim()
      : quotationSellingOnly(child);
  }
  return result;
}
