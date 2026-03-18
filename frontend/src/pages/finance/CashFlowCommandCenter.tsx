import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

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
  Activity
} from 'lucide-react';

type CashflowMetrics = {
  totalAR: number;
  totalARInvoiced: number;
  totalARPaid: number;
  totalAP: number;
  totalAPPaid: number;
  netWorkingCapital: number;
  workingCapitalRatio: number;
  healthScore: number;
  arAging: {
    current: number;
    days0to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
  expectedCollections30: number;
  expectedCollections60: number;
  expectedCollections90: number;
  overdueInvoices: number;
  highValueOverdue: number;
  unpaidInvoiceCount: number;
  pendingExpenseCount: number;
  avgDaysOutstanding: number;
  topCustomers: Array<{
    id: string;
    namaCustomer: string;
    outstanding: number;
    invoiceCount: number;
  }>;
  topVendors: Array<{
    id: string;
    namaVendor: string;
    payable: number;
    expenseCount: number;
  }>;
};

const DEFAULT_METRICS: CashflowMetrics = {
  totalAR: 0,
  totalARInvoiced: 0,
  totalARPaid: 0,
  totalAP: 0,
  totalAPPaid: 0,
  netWorkingCapital: 0,
  workingCapitalRatio: 0,
  healthScore: 0,
  arAging: {
    current: 0,
    days0to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  },
  expectedCollections30: 0,
  expectedCollections60: 0,
  expectedCollections90: 0,
  overdueInvoices: 0,
  highValueOverdue: 0,
  unpaidInvoiceCount: 0,
  pendingExpenseCount: 0,
  avgDaysOutstanding: 0,
  topCustomers: [],
  topVendors: [],
};

export default function CashFlowCommandCenter() {
  const [serverMetrics, setServerMetrics] = useState<CashflowMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get<{ metrics?: any }>('/dashboard/finance-cashflow-summary');
      if (data?.metrics) {
        setServerMetrics(data.metrics);
        if (!silent) toast.success('Finance cashflow summary diperbarui');
      }
    } catch {
      if (!silent) toast.error('Gagal refresh finance cashflow summary');
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(true);
  }, []);

  const metrics = useMemo(() => serverMetrics || DEFAULT_METRICS, [serverMetrics]);
  const hasCashflowData = useMemo(
    () =>
      metrics.totalARInvoiced > 0 ||
      metrics.totalAP > 0 ||
      metrics.totalAPPaid > 0 ||
      metrics.totalARPaid > 0 ||
      metrics.unpaidInvoiceCount > 0 ||
      metrics.pendingExpenseCount > 0 ||
      metrics.topCustomers.length > 0 ||
      metrics.topVendors.length > 0,
    [metrics]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getHealthColor = (score: number) => {
    if (!hasCashflowData) return 'text-slate-600 bg-slate-100';
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getHealthStatus = (score: number) => {
    if (!hasCashflowData) return 'No Data';
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
          <button
            type="button"
            onClick={() => loadSummary(false)}
            disabled={refreshing}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
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
            {metrics.unpaidInvoiceCount} invoices unpaid
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
            {metrics.pendingExpenseCount} expenses pending
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
                  !hasCashflowData ? 'bg-slate-400' :
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
      {!hasCashflowData ? (
        <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 mb-4 sm:mb-6 rounded-lg text-sm text-slate-600">
          Belum ada transaksi AR/AP relasional yang cukup untuk dianalisis. Dashboard ini akan terisi setelah invoice customer, vendor invoice, atau vendor expense mulai masuk.
        </div>
      ) : (metrics.overdueInvoices > 0 || metrics.highValueOverdue > 0) && (
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
            {metrics.avgDaysOutstanding} days
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
    </div>
  );
}
