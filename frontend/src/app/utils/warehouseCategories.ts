export const BASE_WAREHOUSE_CATEGORIES = [
  'Bahan Baku',
  'Barang Jadi',
  'Consumable',
  'Piping',
  'Fitting & Valve',
  'Castable',
  'Monolithics',
  'Refractory',
  'PPE',
  'Tools',
  'Electrical',
  'Civil',
  'Mechanical',
  'Chemical',
  'Sparepart',
  'General',
];

export function getWarehouseCategories(
  stockItemList: Array<{ kategori?: string }> = [],
  extraCategories: string[] = [],
): string[] {
  return [...new Set([
    ...BASE_WAREHOUSE_CATEGORIES,
    ...stockItemList.map(item => item.kategori).filter(Boolean) as string[],
    ...extraCategories,
  ])].sort((a, b) => a.localeCompare(b));
}
