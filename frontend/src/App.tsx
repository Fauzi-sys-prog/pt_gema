import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppProvider } from './contexts/AppContext';
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import AppErrorBoundary from "./components/AppErrorBoundary";

// Pages
import LoginPage from "./pages/LoginPage";
import MainDashboard from "./pages/dashboard/MainDashboard";
import DataCollection from "./pages/data-collection/DataCollection";
import ProjectManagementPage from "./pages/ProjectManagementPage";

// Sales
import PenawaranPage from "./pages/sales/PenawaranPage";
import PenawaranDetailPage from "./pages/sales/PenawaranDetailPage";
import RABProjectPage from "./pages/sales/RABProjectPage";
import InvoicePage from "./pages/sales/InvoicePage";
import SalesAnalyticsPage from "./pages/sales/SalesAnalyticsPage";

// Purchasing
import ProcurementHubPage from "./pages/purchasing/ProcurementHubPage";
import PurchaseOrderPage from "./pages/purchasing/PurchaseOrderPage";
import ReceivingPage from "./pages/purchasing/ReceivingPage";
import VendorAnalysisPage from "./pages/purchasing/VendorAnalysisPage";

// Production
import ProductionDashboard from "./pages/production/ProductionDashboard";
import ProductionReportPage from "./pages/production/ProductionReportPage";
import { ProductionTrackerPage } from "./pages/production/Tracker";
import ProductionGuidePage from "./pages/production/ProductionGuidePage";
import QCInspectionPage from "./pages/production/QCInspectionPage";

// Inventory
import WarehouseLedgerPage from "./pages/inventory/WarehouseLedgerPage";
import StockInPage from "./pages/inventory/StockInPage";
import StockOutPage from "./pages/inventory/StockOutPage";
import StockReportPage from "./pages/inventory/StockReportPage";
import StockJournalPage from "./pages/inventory/StockJournalPage";
import StockCardDetailPage from "./pages/inventory/StockCardDetailPage";
import TraceabilityPage from "./pages/inventory/TraceabilityPage";
import StockAgingPage from "./pages/inventory/StockAgingPage";
import StockOpnamePage from "./pages/inventory/StockOpnamePage";
import BOMVerificationPage from "./pages/production/BOMVerificationPage";

// Asset & Rental
import DaftarAsset from "./pages/asset/DaftarAsset";
import RentalOutPage from "./pages/asset/RentalOutPage";
import InternalUsagePage from "./pages/asset/InternalUsagePage";

// HR
import KaryawanPage from "./pages/hr/KaryawanPage";
import AbsensiPage from "./pages/hr/AbsensiPage";
import AttendanceRecapPage from "./pages/hr/AttendanceRecapPage";
import FieldProjectRecord from "./pages/hr/FieldProjectRecord";
import CutiPage from "./pages/hr/CutiPage";
import PayrollPage from "./pages/finance/PayrollPage";

// Finance
import CashflowPage from "./pages/finance/CashflowPage";
import GeneralLedgerPage from "./pages/finance/GeneralLedgerPage";
import AccountsPayablePage from "./pages/finance/AccountsPayablePage";
import DigitalArchivePage from "./pages/finance/DigitalArchivePage";
import ProjectProfitLossPage from "./pages/finance/ProjectProfitLossPage";
import ApprovalCenterPage from "./pages/finance/ApprovalCenterPage";
import PPNPage from "./pages/finance/PPNPage";
import BankReconciliationPage from "./pages/finance/BankReconciliationPage";
import PettyCashPage from "./pages/finance/PettyCashPage";
import ExecutiveDashboardPage from "./pages/finance/ExecutiveDashboardPage";
import YearEndClosingPage from "./pages/finance/YearEndClosingPage";
import UserManagementPage from "./pages/settings/UserManagementPage";
import AuditTrailPage from "./pages/settings/AuditTrailPage";
import WorkingExpensePage from "./pages/finance/WorkingExpensePage";
import VendorPaymentPage from "./pages/finance/VendorPaymentPage";
import AccountsReceivablePage from "./pages/finance/AccountsReceivablePage";
import CashFlowCommandCenter from "./pages/finance/CashFlowCommandCenter";
import GuideHubPage from "./pages/guide/GuideHubPage";

// Correspondence
import DashboardSurat from "./pages/correspondence/DashboardSurat";
import SuratMasukPage from "./pages/correspondence/SuratMasukPage";
import SuratKeluarPage from "./pages/correspondence/SuratKeluarPage";
import BeritaAcaraPage from "./pages/correspondence/BeritaAcaraPage";
import SuratJalanPage from "./pages/correspondence/SuratJalanPage";

// Sales
import QuotationPage from "./pages/sales/QuotationPage";
import LogisticsCommandCenter from "./pages/logistics/LogisticsCommandCenter";
import DeliveryTrackingPage from "./pages/logistics/DeliveryTrackingPage";
import FleetMaintenancePage from "./pages/asset/FleetMaintenancePage";
import SuratPerintahKerjaPage from "./pages/correspondence/SuratPerintahKerjaPage";
import logoImage from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

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
          </AppErrorBoundary>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
