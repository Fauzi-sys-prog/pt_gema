import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppProvider } from './contexts/AppContext';
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import AppErrorBoundary from "./components/AppErrorBoundary";

import LoginPage from "./pages/LoginPage";
import logoImage from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

const MainDashboard = lazy(() => import("./pages/dashboard/MainDashboard"));
const DataCollection = lazy(() => import("./pages/data-collection/DataCollection"));
const ProjectManagementPage = lazy(() => import("./pages/ProjectManagementPage"));
const PenawaranPage = lazy(() => import("./pages/sales/PenawaranPage"));
const PenawaranDetailPage = lazy(() => import("./pages/sales/PenawaranDetailPage"));
const RABProjectPage = lazy(() => import("./pages/sales/RABProjectPage"));
const InvoicePage = lazy(() => import("./pages/sales/InvoicePage"));
const SalesAnalyticsPage = lazy(() => import("./pages/sales/SalesAnalyticsPage"));
const ProcurementHubPage = lazy(() => import("./pages/purchasing/ProcurementHubPage"));
const PurchaseOrderPage = lazy(() => import("./pages/purchasing/PurchaseOrderPage"));
const ReceivingPage = lazy(() => import("./pages/purchasing/ReceivingPage"));
const VendorAnalysisPage = lazy(() => import("./pages/purchasing/VendorAnalysisPage"));
const ProductionDashboard = lazy(() => import("./pages/production/ProductionDashboard"));
const ProductionReportPage = lazy(() => import("./pages/production/ProductionReportPage"));
const ProductionTrackerPage = lazy(() =>
  import("./pages/production/Tracker").then((module) => ({ default: module.ProductionTrackerPage })),
);
const ProductionGuidePage = lazy(() => import("./pages/production/ProductionGuidePage"));
const QCInspectionPage = lazy(() => import("./pages/production/QCInspectionPage"));
const WarehouseLedgerPage = lazy(() => import("./pages/inventory/WarehouseLedgerPage"));
const StockInPage = lazy(() => import("./pages/inventory/StockInPage"));
const StockOutPage = lazy(() => import("./pages/inventory/StockOutPage"));
const StockReportPage = lazy(() => import("./pages/inventory/StockReportPage"));
const StockJournalPage = lazy(() => import("./pages/inventory/StockJournalPage"));
const StockCardDetailPage = lazy(() => import("./pages/inventory/StockCardDetailPage"));
const TraceabilityPage = lazy(() => import("./pages/inventory/TraceabilityPage"));
const StockAgingPage = lazy(() => import("./pages/inventory/StockAgingPage"));
const StockOpnamePage = lazy(() => import("./pages/inventory/StockOpnamePage"));
const BOMVerificationPage = lazy(() => import("./pages/production/BOMVerificationPage"));
const DaftarAsset = lazy(() => import("./pages/asset/DaftarAsset"));
const RentalOutPage = lazy(() => import("./pages/asset/RentalOutPage"));
const InternalUsagePage = lazy(() => import("./pages/asset/InternalUsagePage"));
const KaryawanPage = lazy(() => import("./pages/hr/KaryawanPage"));
const AbsensiPage = lazy(() => import("./pages/hr/AbsensiPage"));
const AttendanceRecapPage = lazy(() => import("./pages/hr/AttendanceRecapPage"));
const FieldProjectRecord = lazy(() => import("./pages/hr/FieldProjectRecord"));
const CutiPage = lazy(() => import("./pages/hr/CutiPage"));
const PayrollPage = lazy(() => import("./pages/finance/PayrollPage"));
const CashflowPage = lazy(() => import("./pages/finance/CashflowPage"));
const GeneralLedgerPage = lazy(() => import("./pages/finance/GeneralLedgerPage"));
const AccountsPayablePage = lazy(() => import("./pages/finance/AccountsPayablePage"));
const DigitalArchivePage = lazy(() => import("./pages/finance/DigitalArchivePage"));
const ProjectProfitLossPage = lazy(() => import("./pages/finance/ProjectProfitLossPage"));
const ApprovalCenterPage = lazy(() => import("./pages/finance/ApprovalCenterPage"));
const PPNPage = lazy(() => import("./pages/finance/PPNPage"));
const BankReconciliationPage = lazy(() => import("./pages/finance/BankReconciliationPage"));
const PettyCashPage = lazy(() => import("./pages/finance/PettyCashPage"));
const ExecutiveDashboardPage = lazy(() => import("./pages/finance/ExecutiveDashboardPage"));
const YearEndClosingPage = lazy(() => import("./pages/finance/YearEndClosingPage"));
const UserManagementPage = lazy(() => import("./pages/settings/UserManagementPage"));
const AuditTrailPage = lazy(() => import("./pages/settings/AuditTrailPage"));
const WorkingExpensePage = lazy(() => import("./pages/finance/WorkingExpensePage"));
const VendorPaymentPage = lazy(() => import("./pages/finance/VendorPaymentPage"));
const AccountsReceivablePage = lazy(() => import("./pages/finance/AccountsReceivablePage"));
const CashFlowCommandCenter = lazy(() => import("./pages/finance/CashFlowCommandCenter"));
const GuideHubPage = lazy(() => import("./pages/guide/GuideHubPage"));
const DashboardSurat = lazy(() => import("./pages/correspondence/DashboardSurat"));
const SuratMasukPage = lazy(() => import("./pages/correspondence/SuratMasukPage"));
const SuratKeluarPage = lazy(() => import("./pages/correspondence/SuratKeluarPage"));
const BeritaAcaraPage = lazy(() => import("./pages/correspondence/BeritaAcaraPage"));
const SuratJalanPage = lazy(() => import("./pages/correspondence/SuratJalanPage"));
const QuotationPage = lazy(() => import("./pages/sales/QuotationPage"));
const LogisticsCommandCenter = lazy(() => import("./pages/logistics/LogisticsCommandCenter"));
const DeliveryTrackingPage = lazy(() => import("./pages/logistics/DeliveryTrackingPage"));
const FleetMaintenancePage = lazy(() => import("./pages/asset/FleetMaintenancePage"));
const SuratPerintahKerjaPage = lazy(() => import("./pages/correspondence/SuratPerintahKerjaPage"));

function RouteLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-red-600 animate-pulse" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">
            Menyiapkan halaman...
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          Kami sedang memuat modul yang kamu buka supaya bundle awal tetap ringan dan halaman lain tidak ikut terbawa.
        </p>
        <div className="mt-5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-red-600 animate-[loadingPulse_1200ms_ease-in-out_infinite]" />
        </div>
        <style>{`
          @keyframes loadingPulse {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(120%); }
            100% { transform: translateX(260%); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setShowSplash(false));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  if (showSplash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm animate-[logoFade_1200ms_ease-in-out]">
          <img
            src={logoImage}
            alt="GM Teknik Logo"
            className="w-full h-full object-contain origin-left animate-[flagWave_1200ms_ease-in-out_infinite]"
          />
        </div>
        <style>{`
          @keyframes logoFade {
            0% { opacity: 0; transform: scale(0.9); }
            40% { opacity: 1; transform: scale(1); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes flagWave {
            0% { transform: perspective(300px) rotateY(0deg) skewY(0deg); }
            25% { transform: perspective(300px) rotateY(-8deg) skewY(1.5deg); }
            50% { transform: perspective(300px) rotateY(0deg) skewY(0deg); }
            75% { transform: perspective(300px) rotateY(8deg) skewY(-1.5deg); }
            100% { transform: perspective(300px) rotateY(0deg) skewY(0deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <AppErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
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
              path="/settings/master"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/settings/user-management" replace />
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
                    <Navigate to="/sales/quotation" replace />
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
              path="/sales/rab"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RABProjectPage />
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
                    <Navigate to="/sales/invoice" replace />
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

            {/* Purchasing & Supply Chain */}
            <Route
              path="/purchasing/procurement-hub"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProcurementHubPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/purchasing/vendor-analysis"
              element={
                <ProtectedRoute>
                  <Layout>
                    <VendorAnalysisPage />
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
              path="/produksi/bom-verification/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BOMVerificationPage />
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
            <Route path="/finance/invoicing" element={<Navigate to="/sales/invoice" replace />} />
            <Route path="/finance/payments" element={<Navigate to="/finance/vendor-payment" replace />} />
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
              path="/hr/absensi"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AbsensiPage />
                  </Layout>
                </ProtectedRoute>
              }
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
                    <AttendanceRecapPage />
                  </Layout>
                </ProtectedRoute>
              }
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
              path="/hr/payroll"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PayrollPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Finance */}
            <Route
              path="/finance/cashflow"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CashflowPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
              path="/finance/working-expense"
              element={
                <ProtectedRoute>
                  <Layout>
                    <WorkingExpensePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
              path="/finance/archive"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DigitalArchivePage />
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

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
          </Suspense>
          </AppErrorBoundary>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
