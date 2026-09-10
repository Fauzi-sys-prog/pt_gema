import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Building2,
  Calendar,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  Download,
  FileText,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { exportCashflowToWord, exportCashflowToExcel } from '../../utils/cashflowExport';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function CashFlowCommandCenter() {
  const {
    customerInvoiceList,
    expenseList,
    vendorList,
    customerList,
    vendorInvoiceList = [],
    payrollList,
    payrollRunList = [],
    thlPayrollRunList = [],
    pettyCashList = [],
    pettyCashGudangList = [],
  } = useApp();
  const [timeframe, setTimeframe] = useState<'30' | '60' | '90'>('30');
  const [showExportModal, setShowExportModal] = useState(false);

  useEscapeKey([
    { condition: showExportModal, close: () => setShowExportModal(false) },
  ]);


  // Calculate metrics
  const metrics = useMemo(() => {
    // AR Metrics
    const totalAR = customerInvoiceList.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalARInvoiced = customerInvoiceList.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalARPaid = customerInvoiceList.reduce((sum, inv) => sum + inv.paidAmount, 0);
    
    // Calculate AR aging
    const calculateAgingDays = (dueDate: string, status: string) => {
      if (status === 'Paid') return 0;
      const due = new Date(dueDate);
      const today = new Date();
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const arAging = {
      current: customerInvoiceList.filter(inv => {
        const days = calculateAgingDays(inv.dueDate, inv.status);
        return days === 0 && inv.status !== 'Paid';
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days0to30: customerInvoiceList.filter(inv => {
        const days = calculateAgingDays(inv.dueDate, inv.status);
        return days > 0 && days <= 30 && inv.status !== 'Paid';
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days31to60: customerInvoiceList.filter(inv => {
        const days = calculateAgingDays(inv.dueDate, inv.status);
        return days > 30 && days <= 60 && inv.status !== 'Paid';
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days61to90: customerInvoiceList.filter(inv => {
        const days = calculateAgingDays(inv.dueDate, inv.status);
        return days > 60 && days <= 90 && inv.status !== 'Paid';
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      over90: customerInvoiceList.filter(inv => {
        const days = calculateAgingDays(inv.dueDate, inv.status);
        return days > 90 && inv.status !== 'Paid';
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0)
    };

    // AP Metrics
    const approvedProjectExpenses = expenseList
      .filter(exp => exp.status === 'Approved' || exp.status === 'Pending Approval')
      .reduce((sum, exp) => sum + exp.totalNominal, 0);
    const outstandingVendorInvoices = vendorInvoiceList
      .filter(inv => !['Draft', 'Rejected', 'Paid'].includes(inv.status))
      .reduce((sum, inv) => sum + Math.max(0, inv.outstandingAmount ?? (inv.totalAmount - inv.paidAmount)), 0);
    const totalAP = approvedProjectExpenses + outstandingVendorInvoices;
    
    const paidProjectExpenses = expenseList
      .filter(exp => exp.status === 'Paid')
      .reduce((sum, exp) => sum + exp.totalNominal, 0);
    const paidVendorInvoices = vendorInvoiceList.reduce(
      (sum, inv) => sum + (inv.paymentHistory || []).reduce((paymentSum, payment) => paymentSum + (payment.nominal || 0), 0),
      0,
    );
    const totalAPPaid = paidProjectExpenses + paidVendorInvoices;

    // Working Capital
    const netWorkingCapital = totalAR - totalAP;
    const workingCapitalRatio = totalAP > 0 ? (totalAR / totalAP) : 0;

    // Cash Flow Health Score (0-100)
    let healthScore = 50;
    if (arAging.over90 === 0) healthScore += 20;
    if (arAging.days61to90 < totalAR * 0.1) healthScore += 10;
    if (workingCapitalRatio > 1) healthScore += 20;
    healthScore = Math.min(100, Math.max(0, healthScore));

    // Expected collections (next 30/60/90 days)
    const today = new Date();
    const getExpectedCollections = (days: number) => {
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      return customerInvoiceList.filter(inv => {
        const dueDate = new Date(inv.dueDate);
        return inv.status !== 'Paid' && dueDate >= today && dueDate <= futureDate;
      }).reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    };

    const expectedCollections30 = getExpectedCollections(30);
    const expectedCollections60 = getExpectedCollections(60);
    const expectedCollections90 = getExpectedCollections(90);

    // Critical alerts
    const overdueInvoices = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 0 && inv.status !== 'Paid';
    }).length;

    const highValueOverdue = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 30 && inv.outstandingAmount > 100000000 && inv.status !== 'Paid';
    }).length;

    // Top customers by outstanding
    const topCustomers = customerList.map(customer => {
      const invoices = customerInvoiceList.filter(inv => inv.customerId === customer.id);
      const outstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
      return {
        ...customer,
        outstanding,
        invoiceCount: invoices.length
      };
    })
    .filter(c => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);

    // Top vendors by payables
    const topVendors = vendorList.map(vendor => {
      const expenses = expenseList.filter(exp => 
        exp.vendorId === vendor.id && 
        (exp.status === 'Approved' || exp.status === 'Pending Approval')
      );
      const payable = expenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
      return {
        ...vendor,
        payable,
        expenseCount: expenses.length
      };
    })
    .filter(v => v.payable > 0)
    .sort((a, b) => b.payable - a.payable)
    .slice(0, 5);

    return {
      totalAR,
      totalARInvoiced,
      totalARPaid,
      totalAP,
      totalAPPaid,
      netWorkingCapital,
      workingCapitalRatio,
      healthScore,
      arAging,
      expectedCollections30,
      expectedCollections60,
      expectedCollections90,
      overdueInvoices,
      highValueOverdue,
      topCustomers,
      topVendors
    };
  }, [customerInvoiceList, expenseList, vendorInvoiceList, vendorList, customerList]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const monthlyChartData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const currentYear = new Date().getFullYear();
    const buckets = Array.from({ length: 12 }, () => ({ inflow: 0, outflow: 0 }));

    customerInvoiceList.forEach(inv => {
      (inv.paymentHistory || []).forEach(payment => {
        const d = new Date(payment.tanggal);
        if (d.getFullYear() === currentYear) buckets[d.getMonth()].inflow += payment.nominal || 0;
      });
    });

    expenseList.forEach(exp => {
      if (exp.status !== 'Paid') return;
      const d = new Date((exp as any).paidAt || (exp as any).tanggal || (exp as any).date || '');
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += (exp as any).totalNominal || (exp as any).nominal || 0;
    });

    (vendorInvoiceList || []).forEach((vi: any) => {
      (vi.paymentHistory || []).forEach((payment: any) => {
        const d = new Date(payment.tanggal);
        if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += payment.nominal || 0;
      });
    });

    const activePayrollRuns = payrollRunList.length > 0
      ? payrollRunList.filter(run => ['Disbursed', 'Closed'].includes(run.status)).map(run => ({ date: run.disbursedAt || run.processedDate, amount: run.totalTHP }))
      : payrollList.filter(run => run.status === 'Disbursed').map(run => ({ date: `${run.year}-${String(new Date(`${run.month} 1, ${run.year}`).getMonth() + 1).padStart(2, '0')}-01`, amount: run.totalPayroll }));
    activePayrollRuns.forEach(run => {
      const d = new Date(run.date || '');
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += run.amount || 0;
    });

    thlPayrollRunList.filter(run => run.status === 'Disbursed').forEach(run => {
      const d = new Date((run as any).disbursedAt || run.periode || '');
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += run.totalNetto || 0;
    });

    [...pettyCashList, ...pettyCashGudangList].forEach(entry => {
      if (!entry.date || entry.credit <= 0) return;
      const d = new Date(entry.date);
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += entry.credit;
    });

    return MONTHS.map((month, i) => ({ month, inflow: buckets[i].inflow, outflow: buckets[i].outflow, net: buckets[i].inflow - buckets[i].outflow }));
  }, [customerInvoiceList, expenseList, vendorInvoiceList, payrollList, payrollRunList, thlPayrollRunList, pettyCashList, pettyCashGudangList]);

  const totalInflow = monthlyChartData.reduce((s, d) => s + d.inflow, 0);
  const totalOutflow = monthlyChartData.reduce((s, d) => s + d.outflow, 0);
  const netCashflow = totalInflow - totalOutflow;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getHealthStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Critical';
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold truncate">AR/AP Cash Flow Command Center</h1>
            <p className="text-xs sm:text-sm text-gray-600 truncate">Real-time working capital & cash flow monitoring</p>
          </div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Total AR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 sm:p-6 rounded-xl text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium opacity-90">Total AR Outstanding</span>
            <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">
            {formatCurrency(metrics.totalAR)}
          </div>
          <div className="text-xs opacity-80">
            {customerInvoiceList.filter(inv => inv.status !== 'Paid').length} invoices unpaid
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <div className="text-xs">
              Collection Rate: {metrics.totalARInvoiced > 0 ? ((metrics.totalARPaid / metrics.totalARInvoiced) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </motion.div>

        {/* Total AP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 sm:p-6 rounded-xl text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium opacity-90">Total AP Outstanding</span>
            <ArrowDownRight className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">
            {formatCurrency(metrics.totalAP)}
          </div>
          <div className="text-xs opacity-80">
            {expenseList.filter(exp => exp.status === 'Approved' || exp.status === 'Pending Approval').length} expenses pending
          </div>
          <div className="mt-3 pt-3 border-t border-orange-400/30">
            <div className="text-xs break-words">
              Total Paid: {formatCurrency(metrics.totalAPPaid)}
            </div>
          </div>
        </motion.div>

        {/* Net Working Capital */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`p-4 sm:p-6 rounded-xl text-white shadow-lg ${
            metrics.netWorkingCapital >= 0
              ? 'bg-gradient-to-br from-green-500 to-green-600'
              : 'bg-gradient-to-br from-red-500 to-red-600'
          }`}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium opacity-90">Net Working Capital</span>
            {metrics.netWorkingCapital >= 0 ? (
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            ) : (
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
            )}
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">
            {formatCurrency(Math.abs(metrics.netWorkingCapital))}
          </div>
          <div className="text-xs opacity-80">
            AR - AP = {metrics.netWorkingCapital >= 0 ? 'Surplus' : 'Deficit'}
          </div>
          <div className="mt-3 pt-3 border-t border-white/30">
            <div className="text-xs">
              Ratio: {metrics.workingCapitalRatio.toFixed(2)}x
            </div>
          </div>
        </motion.div>

        {/* Cash Flow Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border-2 border-gray-200"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm font-medium text-gray-600">Cash Flow Health</span>
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.healthScore}</div>
            <div className="text-sm text-gray-500">/100</div>
          </div>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getHealthColor(metrics.healthScore)}`}>
            {getHealthStatus(metrics.healthScore)}
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  metrics.healthScore >= 80 ? 'bg-green-500' :
                  metrics.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${metrics.healthScore}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Critical Alerts */}
      {(metrics.overdueInvoices > 0 || metrics.highValueOverdue > 0) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg">
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-900 mb-1 text-sm sm:text-base">Critical Alerts</h3>
              <div className="space-y-1 text-xs sm:text-sm text-red-800">
                {metrics.overdueInvoices > 0 && (
                  <div className="break-words">⚠️ {metrics.overdueInvoices} overdue invoice(s) require immediate attention</div>
                )}
                {metrics.highValueOverdue > 0 && (
                  <div className="break-words">🔴 {metrics.highValueOverdue} high-value invoice(s) overdue &gt; 30 days</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">Expected Collections (30 Days)</h3>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2 break-words">
            {formatCurrency(metrics.expectedCollections30)}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            Projected receivables in next 30 days
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">Expected Collections (60 Days)</h3>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2 break-words">
            {formatCurrency(metrics.expectedCollections60)}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            Projected receivables in next 60 days
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">Expected Collections (90 Days)</h3>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-indigo-600 mb-2 break-words">
            {formatCurrency(metrics.expectedCollections90)}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            Projected receivables in next 90 days
          </div>
        </div>
      </div>

      {/* AR Aging Analysis */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 mb-4 sm:mb-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h3 className="font-bold text-gray-900 text-sm sm:text-base">AR Aging Analysis</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Current (Not Due)</div>
            <div className="text-base sm:text-xl font-bold text-green-600 break-words">{formatCurrency(metrics.arAging.current)}</div>
          </div>
          <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">0-30 Days</div>
            <div className="text-base sm:text-xl font-bold text-blue-600 break-words">{formatCurrency(metrics.arAging.days0to30)}</div>
          </div>
          <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">31-60 Days</div>
            <div className="text-base sm:text-xl font-bold text-yellow-600 break-words">{formatCurrency(metrics.arAging.days31to60)}</div>
          </div>
          <div className="p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">61-90 Days</div>
            <div className="text-base sm:text-xl font-bold text-orange-600 break-words">{formatCurrency(metrics.arAging.days61to90)}</div>
          </div>
          <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200 col-span-2 sm:col-span-1">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Over 90 Days</div>
            <div className="text-base sm:text-xl font-bold text-red-600 break-words">{formatCurrency(metrics.arAging.over90)}</div>
          </div>
        </div>
      </div>

      {/* Top Customers vs Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Customers */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Top 5 Customers (Outstanding)</h3>
          </div>
          <div className="space-y-3">
            {metrics.topCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No outstanding receivables</div>
            ) : (
              metrics.topCustomers.map((customer, idx) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-white text-xs sm:text-base flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-500' :
                      idx === 1 ? 'bg-gray-400' :
                      idx === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{customer.namaCustomer}</div>
                      <div className="text-xs text-gray-500">{customer.invoiceCount} invoice(s)</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-blue-600 text-xs sm:text-base break-words">{formatCurrency(customer.outstanding)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Vendors */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Building2 className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Top 5 Vendors (Payables)</h3>
          </div>
          <div className="space-y-3">
            {metrics.topVendors.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No outstanding payables</div>
            ) : (
              metrics.topVendors.map((vendor, idx) => (
                <div key={vendor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-white text-xs sm:text-base flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-500' :
                      idx === 1 ? 'bg-gray-400' :
                      idx === 2 ? 'bg-orange-600' : 'bg-orange-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{vendor.namaVendor}</div>
                      <div className="text-xs text-gray-500">{vendor.expenseCount} expense(s)</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-orange-600 text-xs sm:text-base break-words">{formatCurrency(vendor.payable)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-600 flex-shrink-0" />
            <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">Collection Efficiency</h4>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">{metrics.totalARInvoiced > 0 ? ((metrics.totalARPaid / metrics.totalARInvoiced) * 100).toFixed(1) : 0}%</div>
          <div className="text-sm text-gray-600">
            Total collected vs invoiced
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">Avg Days Outstanding</h4>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600 mb-2">
            {customerInvoiceList.filter(inv => inv.status !== 'Paid').length > 0 
              ? Math.round(
                  customerInvoiceList
                    .filter(inv => inv.status !== 'Paid')
                    .reduce((sum, inv) => {
                      const days = Math.ceil(
                        (new Date().getTime() - new Date(inv.tanggal).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return sum + days;
                    }, 0) / customerInvoiceList.filter(inv => inv.status !== 'Paid').length
                )
              : 0
            } days
          </div>
          <div className="text-sm text-gray-600">
            Average collection period
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">Working Capital Ratio</h4>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">
            {metrics.workingCapitalRatio.toFixed(2)}x
          </div>
          <div className="text-sm text-gray-600">
            {metrics.workingCapitalRatio >= 1 ? 'Healthy liquidity position' : 'Need improvement'}
          </div>
        </div>
      </div>

      {/* Monthly Cashflow Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Cashflow Bulanan {new Date().getFullYear()}
          </h3>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-500 font-medium mb-1">Total Inflow</p>
            <p className="text-sm font-bold text-blue-700">{formatCurrency(totalInflow)}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-500 font-medium mb-1">Total Outflow</p>
            <p className="text-sm font-bold text-red-700">{formatCurrency(totalOutflow)}</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${netCashflow >= 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
            <p className={`text-xs font-medium mb-1 ${netCashflow >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>Net Cashflow</p>
            <p className={`text-sm font-bold ${netCashflow >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{formatCurrency(netCashflow)}</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis key="x" dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis key="y" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e9 ? `${(v/1e9).toFixed(1)}M` : v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : String(v)} width={60} />
              <Tooltip key="tip" formatter={(v: number) => formatCurrency(v)} />
              <Area key="area-inflow" type="monotone" dataKey="inflow" stroke="#3b82f6" fill="url(#inflowGrad)" strokeWidth={2} name="Inflow" />
              <Area key="area-outflow" type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} name="Outflow" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Export Cashflow Statement</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-5">Pilih format export laporan cashflow tahunan.</p>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  toast.loading('Generating Word...', { id: 'cf-word' });
                  try {
                    await exportCashflowToWord({
                      inflow: totalInflow,
                      outflowPurchases: monthlyChartData.reduce((s, d) => s + d.outflow, 0),
                      outflowPayroll: 0,
                      totalOutflow,
                      netCashflow,
                      chartData: monthlyChartData,
                      period: String(new Date().getFullYear()),
                    });
                    toast.success('Word exported!', { id: 'cf-word' });
                  } catch { toast.error('Export gagal', { id: 'cf-word' }); }
                  setShowExportModal(false);
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-3 font-medium"
              >
                <FileText className="w-5 h-5" /> Export ke Word (.doc)
              </button>
              <button
                onClick={() => {
                  toast.loading('Generating Excel...', { id: 'cf-excel' });
                  try {
                    exportCashflowToExcel({
                      inflow: totalInflow,
                      outflowPurchases: totalOutflow,
                      outflowPayroll: 0,
                      totalOutflow,
                      netCashflow,
                      chartData: monthlyChartData,
                      period: String(new Date().getFullYear()),
                    });
                    toast.success('Excel exported!', { id: 'cf-excel' });
                  } catch { toast.error('Export gagal', { id: 'cf-excel' }); }
                  setShowExportModal(false);
                }}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-3 font-medium"
              >
                <FileSpreadsheet className="w-5 h-5" /> Export ke Excel (.csv)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
