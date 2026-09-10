/**
 * Injects useEscapeKey into every page that has show* modal state.
 * Run: node scripts/add-escape-key.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative, dirname } from 'path';

const ROOT = resolve(process.cwd(), 'src/app');
const HOOK_SRC = 'src/app/hooks/useEscapeKey.ts';

// Map of file (relative to src/app) → modal state names
const FILES = {
  // Finance
  'pages/finance/AccountsPayablePage.tsx':     ['showPayModal', 'showCreateModal'],
  'pages/finance/AccountsReceivablePage.tsx':  ['showInvoiceModal','showCustomerModal','showPaymentModal','showPreviewModal','showExportModal'],
  'pages/finance/VendorPaymentPage.tsx':       ['showExpenseModal','showVendorModal','showPreviewModal'],
  'pages/finance/PettyCashPage.tsx':           ['showInputModal','showTopUpModal'],
  'pages/finance/WorkingExpensePage.tsx':      ['showCreateModal','showAddRow'],
  'pages/finance/ExecutiveDashboardPage.tsx':  ['showAuditModal'],
  'pages/finance/GeneralLedgerPage.tsx':       ['showAddModal'],
  'pages/finance/CashFlowCommandCenter.tsx':   ['showExportModal'],
  'pages/finance/DigitalArchivePage.tsx':      ['showExportModal'],
  'pages/finance/CashflowPage.tsx':            ['showExportModal'],
  'pages/finance/YearEndClosingPage.tsx':      ['showProfitCenterModal'],
  'pages/finance/PiutangPage.tsx':             ['showExportModal'],
  'pages/finance/PPNPage.tsx':                 [],   // check dynamically
  'pages/finance/BankReconciliationPage.tsx':  [],
  'pages/finance/PayrollPage.tsx':             [],
  // HR
  'pages/hr/AbsensiPage.tsx':                  ['showModal'],
  'pages/hr/THLPage.tsx':                      ['showModal'],
  'pages/hr/CutiPage.tsx':                     ['showModal','showDetailModal'],
  'pages/hr/ShiftPage.tsx':                    ['showShiftModal','showScheduleModal'],
  'pages/hr/FieldProjectRecord.tsx':           ['showKasbonModal','showEquipmentModal','showMaterialModal','showFinalizeModal'],
  'pages/hr/KaryawanPage.tsx':                 ['showModal','showDetailModal'],
  'pages/hr/KasbonKaryawanPage.tsx':           ['showModal'],
  'pages/hr/KasbonTHLPage.tsx':                ['showModal'],
  'pages/hr/PenilaianKinerjaPage.tsx':         ['showFormModal','showDetailModal'],
  'pages/hr/ResignPage.tsx':                   ['showModal'],
  // Projects
  'pages/ProjectManagementPage.tsx':           ['showProjectModal','showProjectDetailModal','showAddExpenseModal','showAddWorkOrderModal','showAddBOQItemModal','showAddUsageModal','showMRForm','showBiayaForm'],
  'pages/ProjectQuotationPage.tsx':            ['showModal','showDetailModal','showMaterialModal','showManpowerModal','showScheduleModal','showConsumableModal','showEquipmentModal'],
  // Purchasing
  'pages/purchasing/PurchaseOrderPage.tsx':    ['showModal','showDetailModal','showSkuModal'],
  'pages/purchasing/ReceivingPage.tsx':        ['showModal','showDetailModal'],
  // Inventory
  'pages/inventory/InventoryCenter.tsx':       ['showNewItemModal','showOpnameModal'],
  'pages/inventory/StockOutPage.tsx':          ['showModal','showDetailModal','showPrintView'],
  'pages/inventory/StockInPage.tsx':           ['showModal','showDetailModal'],
  'pages/inventory/StockOpnamePage.tsx':       ['showForm'],
  // Production
  'pages/production/ProductionDashboard.tsx':  ['showBOM','showCreateModal'],
  'pages/production/ProductionReportPage.tsx': ['showAddModal'],
  'pages/production/QCInspectionPage.tsx':     ['showModal','showPrintPreview'],
  'pages/production/DailyReport.tsx':          ['showRef','showForm'],
  // Correspondence
  'pages/correspondence/SuratMasukPage.tsx':   ['showModal','showDetailModal','showDisposisiModal'],
  'pages/correspondence/SuratKeluarPage.tsx':  ['showModal','showDetailModal','showApprovalModal','showTemplateModal'],
  'pages/correspondence/SuratJalanPage.tsx':   ['showPreview','showCreateModal'],
  'pages/correspondence/SuratPerintahKerjaPage.tsx': ['showPreview','showCreateModal'],
  'pages/correspondence/BeritaAcaraPage.tsx':  ['showCreateModal','showPreview'],
  // Sales
  'pages/sales/QuotationPage.tsx':             ['showCreateModal','showSurveyListModal','showPreview'],
  'pages/sales/PenawaranPage.tsx':             ['showModal'],
  'pages/sales/PenawaranDetailPage.tsx':       ['showConvertModal'],
  // Logistics
  'pages/logistics/LogisticsCommandCenter.tsx':['showPickupModal','showAuditModal'],
  // Asset
  'pages/asset/FleetMaintenancePage.tsx':      ['showMaintModal'],
  'pages/asset/RentalOutPage.tsx':             ['showRentalModal'],
  'pages/asset/InternalUsagePage.tsx':         ['showAssignModal'],
  // Data collection
  'pages/data-collection/DataCollection.tsx':  ['showModal','showDetailModal'],
  'pages/data-collection/DataCollectionDetailModal.tsx': ['showMaterialModal','showManpowerModal','showScheduleModal','showConsumableModal','showEquipmentModal'],
  'pages/data-collection/DataCollectionFormModal.tsx': ['showAdvanced','showCreateFormMaterialModal','showManpowerModal','showScheduleModal','showConsumableModal','showEquipmentModal','showBOMMaterialModal'],
  // Settings
  'pages/settings/UserManagementPage.tsx':     ['showModal'],
};

let updated = 0;
let skipped = 0;

for (const [rel, explicitModals] of Object.entries(FILES)) {
  const filePath = resolve(ROOT, rel);
  let src;
  try { src = readFileSync(filePath, 'utf8'); } catch { skipped++; continue; }

  // Skip if already has useEscapeKey
  if (src.includes('useEscapeKey')) { skipped++; continue; }

  // Auto-detect modal state names if not explicitly provided
  let modals = explicitModals.length > 0 ? explicitModals : [];
  if (modals.length === 0) {
    const found = [...src.matchAll(/const \[(\bshow\w+\b), set\w+\] = useState\(false\)/g)];
    modals = found.map(m => m[1]);
  }
  if (modals.length === 0) { skipped++; continue; }

  // Filter to only modals that actually exist in the file
  modals = modals.filter(m => src.includes(`const [${m},`));
  if (modals.length === 0) { skipped++; continue; }

  // Compute relative import path from file to hook
  const fileDir = dirname(resolve(ROOT, rel));
  const hookFile = resolve(process.cwd(), 'src/app/hooks/useEscapeKey');
  const relImport = relative(fileDir, hookFile).replace(/\\/g, '/');
  const importPath = relImport.startsWith('.') ? relImport : `./${relImport}`;

  // Build the hook call
  const closersArr = modals.map(m => `    { condition: ${m}, close: () => set${m[0].toUpperCase()}${m.slice(1)}(false) },`).join('\n');
  const hookCall = `  useEscapeKey([\n${closersArr}\n  ]);\n`;

  // Insert import: after the last existing import line
  const lastImportIdx = [...src.matchAll(/^import .+$/gm)].at(-1);
  if (!lastImportIdx) { skipped++; continue; }
  const insertImportAt = lastImportIdx.index + lastImportIdx[0].length;
  const newImportLine = `\nimport { useEscapeKey } from '${importPath}';`;

  // Insert hook call: after the last useState declaration in the component
  const allUseStates = [...src.matchAll(/const \[\w+, \w+\] = useState[^;]+;/g)];
  if (allUseStates.length === 0) { skipped++; continue; }
  const lastUseState = allUseStates.at(-1);
  const insertHookAt = lastUseState.index + lastUseState[0].length;

  // Apply both edits (insert import first — it's before the hook insertion point)
  let out = src.slice(0, insertImportAt) + newImportLine + src.slice(insertImportAt);
  // Adjust hook insertion offset by the length of the import we just inserted
  const offset = newImportLine.length;
  out = out.slice(0, insertHookAt + offset) + '\n\n' + hookCall + out.slice(insertHookAt + offset);

  writeFileSync(filePath, out, 'utf8');
  console.log(`✅ ${rel} (${modals.join(', ')})`);
  updated++;
}

console.log(`\nDone. ${updated} files updated, ${skipped} skipped.`);
