import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { AppProvider } from "./contexts/AppContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[AppErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", background: "#fff1f2", minHeight: "100vh" }}>
          <h2 style={{ color: "#be123c", marginBottom: 8 }}>Render Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#1e293b", fontSize: 13 }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded pages
const MainDashboard = lazy(() => import("./pages/dashboard/MainDashboard"));
const DataCollection = lazy(() => import("./pages/data-collection/DataCollection"));
const ProjectManagementPage = lazy(() => import("./pages/ProjectManagementPage"));
const GuideHubPage = lazy(() => import("./pages/guide/GuideHubPage"));

// Sales
const ProjectQuotationHub = lazy(() => import("./pages/sales/ProjectQuotationHub"));
const PenawaranPage = lazy(() => import("./pages/sales/PenawaranPage"));
const PenawaranDetailPage = lazy(() => import("./pages/sales/PenawaranDetailPage"));
const InvoicePage = lazy(() => import("./pages/sales/InvoicePage"));
const AutomatedInvoicingPage = lazy(() => import("./pages/sales/AutomatedInvoicingPage"));
const SalesAnalyticsPage = lazy(() => import("./pages/sales/SalesAnalyticsPage"));
const QuotationPage = lazy(() => import("./pages/sales/QuotationPage"));
const QuotationApprovalPage = lazy(() => import("./pages/sales/QuotationApprovalPage"));

// Purchasing
const PurchaseOrderPage = lazy(() => import("./pages/purchasing/PurchaseOrderPage"));
const ReceivingPage = lazy(() => import("./pages/purchasing/ReceivingPage"));

// Production
const ProductionDashboard = lazy(() => import("./pages/production/ProductionDashboard"));
const DailyReport = lazy(() => import("./pages/production/DailyReport"));
const ProductionReportPage = lazy(() => import("./pages/production/ProductionReportPage"));
const ProductionTimelinePage = lazy(() => import("./pages/production/ProductionTimelinePage"));
const ProductionTrackerPage = lazy(() => import("./pages/production/Tracker").then(m => ({ default: m.ProductionTrackerPage })));
const ProductionGuidePage = lazy(() => import("./pages/production/ProductionGuidePage"));
const QCInspectionPage = lazy(() => import("./pages/production/QCInspectionPage"));

// Inventory
const WarehouseLedgerPage = lazy(() => import("./pages/inventory/WarehouseLedgerPage"));
const StockInPage = lazy(() => import("./pages/inventory/StockInPage"));
const StockOutPage = lazy(() => import("./pages/inventory/StockOutPage"));
const StockReportPage = lazy(() => import("./pages/inventory/StockReportPage"));
const StockJournalPage = lazy(() => import("./pages/inventory/StockJournalPage"));
const StockCardDetailPage = lazy(() => import("./pages/inventory/StockCardDetailPage"));
const TraceabilityPage = lazy(() => import("./pages/inventory/TraceabilityPage"));
const StockAgingPage = lazy(() => import("./pages/inventory/StockAgingPage"));
const StockOpnamePage = lazy(() => import("./pages/inventory/StockOpnamePage"));

// Asset & Rental
const DaftarAsset = lazy(() => import("./pages/asset/DaftarAsset"));
const RentalOutPage = lazy(() => import("./pages/asset/RentalOutPage"));
const InternalUsagePage = lazy(() => import("./pages/asset/InternalUsagePage"));
const FleetMaintenancePage = lazy(() => import("./pages/asset/FleetMaintenancePage"));

// HR
const KaryawanPage = lazy(() => import("./pages/hr/KaryawanPage"));
const KaryawanOnlinePage = lazy(() => import("./pages/hr/KaryawanOnlinePage"));
const RekapAbsensiPage = lazy(() => import("./pages/hr/RekapAbsensiPage"));
const FieldProjectRecord = lazy(() => import("./pages/hr/FieldProjectRecord"));
const CutiPage = lazy(() => import("./pages/hr/CutiPage"));
const LemburPage = lazy(() => import("./pages/hr/LemburPage"));
const THLPage = lazy(() => import("./pages/hr/THLPage"));
const KasbonTHLPage = lazy(() => import("./pages/hr/KasbonTHLPage"));
const THLTimesheetPage = lazy(() => import("./pages/hr/THLTimesheetPage"));
const GajianTHLPage = lazy(() => import("./pages/hr/GajianTHLPage"));
const KasbonKaryawanPage = lazy(() => import("./pages/hr/KasbonKaryawanPage"));
const ShiftPage = lazy(() => import("./pages/hr/ShiftPage"));
const ResignPage = lazy(() => import("./pages/hr/ResignPage"));
const PenilaianKinerjaPage = lazy(() => import("./pages/hr/PenilaianKinerjaPage"));
const HRDashboardPage = lazy(() => import("./pages/hr/HRDashboardPage"));
const AttendanceTodayPage = lazy(() => import("./pages/hr/AttendanceTodayPage"));
const EmployeeAdvancePage = lazy(() => import("./pages/hr/EmployeeAdvancePage"));
const PayrollPolicyPage = lazy(() => import("./pages/hr/PayrollPolicyPage"));
const PayrollProPage = lazy(() => import("./pages/hr/PayrollProPage"));
const TunjanganPage = lazy(() => import("./pages/hr/TunjanganPage"));
const PayrollSlipPage = lazy(() => import("./pages/hr/PayrollSlipPage"));
const HRLaporanPage = lazy(() => import("./pages/hr/HRLaporanPage"));
const KasKoperasiPage = lazy(() => import("./pages/hr/KasKoperasiPage"));

// Finance
const PayrollPage = lazy(() => import("./pages/finance/PayrollPage"));
const CashflowPage = lazy(() => import("./pages/finance/CashflowPage"));
const PiutangPage = lazy(() => import("./pages/finance/PiutangPage"));
const GeneralLedgerPage = lazy(() => import("./pages/finance/GeneralLedgerPage"));
const AccountsPayablePage = lazy(() => import("./pages/finance/AccountsPayablePage"));
const ProjectProfitLossPage = lazy(() => import("./pages/finance/ProjectProfitLossPage"));
const ApprovalCenterPage = lazy(() => import("./pages/finance/ApprovalCenterPage"));
const PPNPage = lazy(() => import("./pages/finance/PPNPage"));
const BankReconciliationPage = lazy(() => import("./pages/finance/BankReconciliationPage"));
const PettyCashPage = lazy(() => import("./pages/finance/PettyCashPage"));
const PettyCashGudangPage = lazy(() => import("./pages/finance/PettyCashGudangPage"));
const ExecutiveDashboardPage = lazy(() => import("./pages/finance/ExecutiveDashboardPage"));
const YearEndClosingPage = lazy(() => import("./pages/finance/YearEndClosingPage"));
const AgingARPage = lazy(() => import("./pages/finance/AgingARPage"));
// HIDDEN: const VendorPaymentPage = lazy(() => import("./pages/finance/VendorPaymentPage"));
const TambahanBiayaProyekPage = lazy(() => import("./pages/finance/TambahanBiayaProyekPage"));
const AccountsReceivablePage = lazy(() => import("./pages/finance/AccountsReceivablePage"));
const CashFlowCommandCenter = lazy(() => import("./pages/finance/CashFlowCommandCenter"));
const PaymentPage = lazy(() => import("./pages/finance/PaymentPage"));
const PayrollReportPage = lazy(() => import("./pages/finance/PayrollReportPage"));

// Settings
const UserManagementPage = lazy(() => import("./pages/settings/UserManagementPage"));
const AuditTrailPage = lazy(() => import("./pages/settings/AuditTrailPage"));

// Correspondence
const DashboardSurat = lazy(() => import("./pages/correspondence/DashboardSurat"));
const SuratMasukPage = lazy(() => import("./pages/correspondence/SuratMasukPage"));
const SuratKeluarPage = lazy(() => import("./pages/correspondence/SuratKeluarPage"));
const BeritaAcaraPage = lazy(() => import("./pages/correspondence/BeritaAcaraPage"));
const SuratJalanPage = lazy(() => import("./pages/correspondence/SuratJalanPage"));
const SuratPerintahKerjaPage = lazy(() => import("./pages/correspondence/SuratPerintahKerjaPage"));

// Logistics
const LogisticsCommandCenter = lazy(() => import("./pages/logistics/LogisticsCommandCenter"));
const DeliveryTrackingPage = lazy(() => import("./pages/logistics/DeliveryTrackingPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AuthAwareAppProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <>{children}</>;

  return <AppProvider>{children}</AppProvider>;
}

// Module-level preload — starts the moment this bundle is parsed, before React renders.
// Tier 1: fire immediately — Dashboard, Project, all Finance, core HR
import("./pages/dashboard/MainDashboard");
import("./pages/ProjectManagementPage");
import("./pages/hr/FieldProjectRecord");
import("./pages/sales/InvoicePage");
// All finance pages — load immediately so the Finance section feels instant
import("./pages/finance/PayrollPage");
import("./pages/finance/PettyCashPage");
import("./pages/finance/CashflowPage");
import("./pages/finance/CashFlowCommandCenter");
import("./pages/finance/AccountsPayablePage");
import("./pages/finance/AccountsReceivablePage");
// HIDDEN: import("./pages/finance/VendorPaymentPage");
import("./pages/finance/GeneralLedgerPage");
import("./pages/finance/ProjectProfitLossPage");
import("./pages/finance/ExecutiveDashboardPage");
import("./pages/finance/ApprovalCenterPage");
import("./pages/finance/PaymentPage");
import("./pages/finance/PiutangPage");
import("./pages/finance/AgingARPage");
import("./pages/finance/PPNPage");
import("./pages/finance/BankReconciliationPage");
import("./pages/finance/YearEndClosingPage");
// Tier 2: 300ms — Sales, Purchasing, Inventory, core HR
setTimeout(() => {
  import("./pages/sales/ProjectQuotationHub");
  import("./pages/sales/PenawaranPage");
  import("./pages/sales/PenawaranDetailPage");
  import("./pages/sales/SalesAnalyticsPage");
  import("./pages/sales/QuotationPage");
  import("./pages/sales/QuotationApprovalPage");
  import("./pages/sales/AutomatedInvoicingPage");
  import("./pages/purchasing/PurchaseOrderPage");
  import("./pages/purchasing/ReceivingPage");
  import("./pages/inventory/StockInPage");
  import("./pages/inventory/StockOutPage");
  import("./pages/inventory/StockReportPage");
  import("./pages/inventory/WarehouseLedgerPage");
  import("./pages/inventory/StockJournalPage");
  import("./pages/inventory/StockCardDetailPage");
  import("./pages/inventory/StockOpnamePage");
  import("./pages/inventory/TraceabilityPage");
  import("./pages/inventory/StockAgingPage");
  import("./pages/hr/KaryawanPage");
  import("./pages/hr/RekapAbsensiPage");
  import("./pages/hr/CutiPage");
  import("./pages/hr/LemburPage");
  import("./pages/hr/KasbonKaryawanPage");
  import("./pages/hr/KasbonTHLPage");
  import("./pages/hr/THLTimesheetPage");
  import("./pages/hr/GajianTHLPage");
  import("./pages/hr/EmployeeAdvancePage");
  import("./pages/hr/AttendanceTodayPage");
  import("./pages/hr/HRDashboardPage");
}, 300);
// Tier 3: 800ms — Production, Asset, remaining HR, Correspondence, Settings
setTimeout(() => {
  import("./pages/data-collection/DataCollection");
  import("./pages/production/ProductionDashboard");
  import("./pages/production/DailyReport");
  import("./pages/production/ProductionReportPage");
  import("./pages/production/ProductionTimelinePage");
  import("./pages/production/Tracker");
  import("./pages/production/QCInspectionPage");
  import("./pages/production/ProductionGuidePage");
  import("./pages/asset/DaftarAsset");
  import("./pages/asset/FleetMaintenancePage");
  import("./pages/asset/RentalOutPage");
  import("./pages/asset/InternalUsagePage");
  import("./pages/hr/THLPage");
  import("./pages/hr/KaryawanOnlinePage");
  import("./pages/hr/PenilaianKinerjaPage");
  import("./pages/hr/ShiftPage");
  import("./pages/hr/ResignPage");
  import("./pages/hr/PayrollProPage");
  import("./pages/hr/PayrollPolicyPage");
  import("./pages/hr/TunjanganPage");
  import("./pages/hr/PayrollSlipPage");
  import("./pages/hr/HRLaporanPage");
  import("./pages/hr/KasKoperasiPage");
  import("./pages/correspondence/DashboardSurat");
  import("./pages/correspondence/SuratMasukPage");
  import("./pages/correspondence/SuratKeluarPage");
  import("./pages/correspondence/BeritaAcaraPage");
  import("./pages/correspondence/SuratJalanPage");
  import("./pages/correspondence/SuratPerintahKerjaPage");
  import("./pages/settings/UserManagementPage");
  import("./pages/settings/AuditTrailPage");
  import("./pages/logistics/LogisticsCommandCenter");
  import("./pages/logistics/DeliveryTrackingPage");
  import("./pages/guide/GuideHubPage");
}, 800);

export default function App() {
  return (
    <AppErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <AuthAwareAppProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Navigate to="/dashboard" replace />
                    </Layout>
                  </ProtectedRoute>
                }
                path="/"
              />

              <Route
                path="/guide-book"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <GuideHubPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <MainDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-collection"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DataCollection />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/user-management"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <UserManagementPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/audit-trail"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AuditTrailPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProjectManagementPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Sales */}
              <Route
                path="/sales/quotation-hub"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProjectQuotationHub />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/penawaran"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PenawaranPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/penawaran/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PenawaranDetailPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/invoice"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InvoicePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/auto-invoice"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AutomatedInvoicingPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/analytics"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SalesAnalyticsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/quotation"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <QuotationPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales/quotation-approval"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <QuotationApprovalPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Purchasing & Supply Chain */}
              <Route
                path="/purchasing/purchase-order"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PurchaseOrderPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/purchasing/receiving"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ReceivingPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Production */}
              <Route
                path="/produksi/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProductionDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/report"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProductionReportPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/timeline"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProductionTrackerPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/gantt"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProductionTimelinePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/guide"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProductionGuidePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/qc"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <QCInspectionPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/laporan-harian"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DailyReport />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Inventory */}
              <Route
                path="/inventory/center"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <WarehouseLedgerPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stock-card/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockCardDetailPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stock-journal"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockJournalPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stock-in"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockInPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stock-out"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockOutPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/traceability"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TraceabilityPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/stock-report"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockReportPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/aging"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockAgingPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/opname"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <StockOpnamePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Asset & Rental */}
              <Route
                path="/asset/equipment"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DaftarAsset />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asset/rental-out"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RentalOutPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asset/internal-usage"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InternalUsagePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asset/maintenance"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <FleetMaintenancePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Finance */}
              <Route path="/finance/cashflow" element={<Navigate to="/finance/cashflow-command" replace />} />
              <Route path="/finance/piutang" element={<Navigate to="/finance/accounts-receivable" replace />} />
              <Route
                path="/finance/project-analysis"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProjectProfitLossPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/approvals"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ApprovalCenterPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/ledger"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <GeneralLedgerPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/ppn"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PPNPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/accounts-payable"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AccountsPayablePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/bank-reconciliation"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <BankReconciliationPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/petty-cash"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PettyCashPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/petty-cash-gudang"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PettyCashGudangPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/executive-dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExecutiveDashboardPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/payroll-report"
                element={<ProtectedRoute><Layout><PayrollReportPage /></Layout></ProtectedRoute>}
              />
              {/* HIDDEN: vendor-payment page dinonaktifkan
              <Route
                path="/finance/vendor-payment"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <VendorPaymentPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              */}
              <Route
                path="/finance/tambahan-biaya-proyek"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TambahanBiayaProyekPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/accounts-receivable"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AccountsReceivablePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/aging-ar"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AgingARPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/cashflow-command"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <CashFlowCommandCenter />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance/year-end"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <YearEndClosingPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Correspondence */}
              <Route
                path="/surat-menyurat/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DashboardSurat />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surat-menyurat/surat-masuk"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SuratMasukPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surat-menyurat/surat-keluar"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SuratKeluarPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surat-menyurat/berita-acara"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <BeritaAcaraPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surat-menyurat/surat-jalan"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SuratJalanPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surat-menyurat/spk"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SuratPerintahKerjaPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Logistics */}
              <Route
                path="/logistics/hub"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <LogisticsCommandCenter />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logistics/delivery/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DeliveryTrackingPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* HR */}
              <Route
                path="/hr/karyawan"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <KaryawanPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/karyawan-online"
                element={<Navigate to="/hr/attendance-today" replace />}
              />
              <Route
                path="/hr/absensi"
                element={<Navigate to="/hr/check-in-out" replace />}
              />
              <Route
                path="/hr/field-record"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <FieldProjectRecord />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/attendance-recap"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RekapAbsensiPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/rekap-absensi"
                element={<Navigate to="/hr/attendance-recap" replace />}
              />
              <Route
                path="/hr/cuti"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <CutiPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/lembur"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <LemburPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/lembur"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <LemburPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/thl"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <THLPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/thl-timesheet"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <THLTimesheetPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/gajian-thl"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <GajianTHLPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/kasbon-karyawan"
                element={<Navigate to="/hr/employee-advance?type=employee" replace />}
              />
              <Route
                path="/hr/kasbon-thl"
                element={<Navigate to="/hr/employee-advance?type=thl" replace />}
              />
              <Route
                path="/hr/shift"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ShiftPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/resign"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ResignPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/penilaian-kinerja"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PenilaianKinerjaPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/payroll"
                element={<Navigate to="/hr/payroll-pro" replace />}
              />

              <Route
                path="/hr/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <HRDashboardPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/attendance-today"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AttendanceTodayPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/check-in-out"
                element={<Navigate to="/hr/attendance-today" replace />}
              />
              <Route
                path="/hr/employee-advance"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EmployeeAdvancePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/produksi/kasbon"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EmployeeAdvancePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/payroll-policy"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PayrollPolicyPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/tunjangan"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TunjanganPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/payroll-pro"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PayrollProPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/payroll-slip/:runId/:employeeId"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PayrollSlipPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/payroll-history"
                element={<Navigate to="/hr/payroll-pro" replace />}
              />
              <Route
                path="/hr/laporan"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <HRLaporanPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/kas-koperasi"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <KasKoperasiPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
              />
            </Routes>
          </Suspense>
        </AuthAwareAppProvider>
      </AuthProvider>
    </BrowserRouter>
    </AppErrorBoundary>
  );
}
