import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Briefcase,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Landmark,
  Layers,
  Zap,
  ChevronRight,
  Building2,
  Download,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner@2.0.3";
import api from "../../services/api";

const ExecutiveDashboardCharts = lazy(() => import("../../components/finance/ExecutiveDashboardCharts"));

type ExecutiveSummary = {
  generatedAt?: string;
  projects?: {
    total?: number;
    inProgress?: number;
    completed?: number;
    pending?: number;
  };
  finance?: {
    revenue?: number;
    accountsPayable?: number;
    estimatedPayroll?: number;
    totalCommitment?: number;
    inventoryValue?: number;
  };
  approvals?: {
    pendingCount?: number;
  };
  lastUpdatedAt?: string | null;
};

type CashflowPageSummary = {
  generatedAt?: string;
  stats?: {
    inflow?: number;
    outflowPurchases?: number;
    outflowPayroll?: number;
    totalOutflow?: number;
    netCashflow?: number;
  };
  monthlyCashflow?: Array<{
    key?: string;
    month?: string;
    inflow?: number;
    outflow?: number;
  }>;
  lastUpdatedAt?: string | null;
};

type ProductionSummary = {
  generatedAt?: string;
  workOrders?: {
    total?: number;
    completed?: number;
    inProgress?: number;
    overdue?: number;
    avgProgress?: number;
  };
  lastUpdatedAt?: string | null;
};

type HrSummary = {
  generatedAt?: string;
  employees?: {
    total?: number;
    active?: number;
    inactive?: number;
    resigned?: number;
  };
  attendance?: {
    totalRecords?: number;
    todayAttendance?: number;
    totalWorkHours?: number;
  };
  lastUpdatedAt?: string | null;
};

type FinanceArSummary = {
  generatedAt?: string;
  metrics?: {
    totalAR?: number;
    totalInvoiced?: number;
    totalPaid?: number;
    overdueAmount?: number;
  };
  lastUpdatedAt?: string | null;
};

const executiveChartsFallback = (
  <>
    <div className="lg:col-span-2 rounded-[4rem] border border-white/5 bg-slate-900/20 p-12">
      <div className="mb-10 h-6 w-56 rounded-full bg-white/10" />
      <div className="h-[350px] animate-pulse rounded-[2.5rem] bg-white/5" />
    </div>
    <div className="lg:col-span-1 rounded-[4rem] border border-white/5 bg-slate-900/20 p-12">
      <div className="mb-10 h-6 w-44 rounded-full bg-white/10" />
      <div className="h-64 animate-pulse rounded-[2.5rem] bg-white/5" />
    </div>
  </>
);

export default function ExecutiveDashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [cashflowPageSummary, setCashflowPageSummary] = useState<CashflowPageSummary | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [hrSummary, setHrSummary] = useState<HrSummary | null>(null);
  const [financeArSummary, setFinanceArSummary] = useState<FinanceArSummary | null>(null);
  const hasExecutiveData =
    Boolean(executiveSummary) ||
    Boolean(cashflowPageSummary) ||
    Boolean(productionSummary) ||
    Boolean(hrSummary) ||
    Boolean(financeArSummary);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (date: Date) => {
    const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${m} ${y} • ${h}:${min}`;
  };

  const loadExecutiveSummary = async () => {
    const [summaryRes, cashflowRes, productionRes, hrRes, arRes] = await Promise.all([
      api.get<ExecutiveSummary>("/dashboard/summary"),
      api.get<CashflowPageSummary>("/dashboard/finance-cashflow-page-summary"),
      api.get<ProductionSummary>("/dashboard/production-summary"),
      api.get<HrSummary>("/dashboard/hr-summary"),
      api.get<FinanceArSummary>("/dashboard/finance-ar-summary"),
    ]);
    const summary = summaryRes.data;
    const cashflow = cashflowRes.data;
    const production = productionRes.data;
    const hr = hrRes.data;
    const ar = arRes.data;
    setExecutiveSummary(summary);
    setCashflowPageSummary(cashflow);
    setProductionSummary(production);
    setHrSummary(hr);
    setFinanceArSummary(ar);
    if (summary?.generatedAt) {
      setLastSynced(new Date(summary.generatedAt));
    } else if (production?.generatedAt) {
      setLastSynced(new Date(production.generatedAt));
    } else if (hr?.generatedAt) {
      setLastSynced(new Date(hr.generatedAt));
    } else if (ar?.generatedAt) {
      setLastSynced(new Date(ar.generatedAt));
    } else if (cashflow?.generatedAt) {
      setLastSynced(new Date(cashflow.generatedAt));
    } else if (summary?.lastUpdatedAt) {
      setLastSynced(new Date(summary.lastUpdatedAt));
    } else if (cashflow?.lastUpdatedAt) {
      setLastSynced(new Date(cashflow.lastUpdatedAt));
    } else {
      setLastSynced(new Date());
    }
  };

  useEffect(() => {
    loadExecutiveSummary().catch(() => {
      // fallback to local-computed cards
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowCharts(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.loading("Synchronizing financial & operational data...", { id: "refresh-sync" });
    try {
      await loadExecutiveSummary();
      toast.success("Data synchronized successfully. All ledgers are up-to-date.", { id: "refresh-sync" });
    } catch {
      toast.error("Gagal sinkronisasi executive dashboard.", { id: "refresh-sync" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadAudit = () => {
    setShowAuditModal(true);
  };

  const triggerDownload = async (type: string) => {
    toast.loading(`Generating ${type} Report...`, { id: "audit-gen" });
    try {
      const fileNamePrefix = `GTP_AUDIT_${type.toUpperCase().replace(/\s/g, '_')}_2026`;

      const payload = {
        type,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Executive Command Center',
        finStats,
        opsStats,
      };
      const excelResponse = await api.post('/exports/executive-audit/excel', payload, {
        responseType: 'blob',
      });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const excelUrl = window.URL.createObjectURL(excelBlob);
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `${fileNamePrefix}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      window.URL.revokeObjectURL(excelUrl);

      const response = await api.post('/exports/executive-audit/word', payload, {
        responseType: 'blob',
      });
      const wordBlob = new Blob([response.data], { type: 'application/msword' });
      const wordUrl = window.URL.createObjectURL(wordBlob);
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `${fileNamePrefix}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      window.URL.revokeObjectURL(wordUrl);

      toast.success(`${type} Reports Generated`, {
        id: "audit-gen",
        description: `Downloaded: .DOC (Word) & .XLS (Excel)`
      });
      setShowAuditModal(false);
    } catch {
      toast.error(`Gagal generate ${type} report`, { id: "audit-gen" });
    }
  };

  // 1. Consolidated Financial Metrics
  const finStats = useMemo(() => {
    const totalRevenue = executiveSummary?.finance?.revenue ?? 0;
    const totalCollected = cashflowPageSummary?.stats?.inflow ?? 0;
    const totalReceivable = financeArSummary?.metrics?.totalAR ?? 0;
    const totalPayable = executiveSummary?.finance?.accountsPayable ?? 0;
    const totalCommitment = executiveSummary?.finance?.totalCommitment ?? 0;
    const inventoryValue = executiveSummary?.finance?.inventoryValue ?? 0;
    
    return {
      totalRevenue,
      totalCollected,
      totalReceivable,
      totalCommitment,
      totalPayable,
      inventoryValue,
      netPosition: totalReceivable - totalPayable
    };
  }, [executiveSummary, cashflowPageSummary, financeArSummary]);

  // 2. Project Performance Aggregate
  const projectHealth = useMemo(() => {
    const completed = executiveSummary?.projects?.completed ?? 0;
    const inProgress = executiveSummary?.projects?.inProgress ?? 0;
    const planning = executiveSummary?.projects?.pending ?? 0;
    
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'In Progress', value: inProgress, color: '#3B82F6' },
      { name: 'Planning', value: planning, color: '#F59E0B' }
    ];
  }, [executiveSummary]);

  // 3. Revenue vs Expense Trend (real data, last 6 months, in million IDR)
  const trendData = useMemo(() => {
    const serverMonthly = cashflowPageSummary?.monthlyCashflow;
    if (!Array.isArray(serverMonthly)) return [];
    return serverMonthly.map((m) => ({
      name: m.month || '-',
      rev: Math.round((m.inflow || 0) / 1_000_000),
      exp: Math.round((m.outflow || 0) / 1_000_000),
    }));
  }, [cashflowPageSummary]);

  // 4. Operational Efficiency
  const opsStats = useMemo(() => {
    const totalWO = productionSummary?.workOrders?.total ?? 0;
    const completedWO = productionSummary?.workOrders?.completed ?? 0;
    const efficiency = totalWO > 0 ? (completedWO / totalWO) * 100 : 0;
    
    return { totalWO, completedWO, efficiency };
  }, [productionSummary]);

  return (
    <div className="p-10 space-y-10 bg-[#0F172A] min-h-screen text-slate-200 pb-32">
      {/* Executive Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 border-b border-slate-800 pb-10">
        <div>
           <div className="flex items-center gap-3 mb-4">
              <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/20">Executive Level</span>
              <span className="text-slate-500 font-black text-xs uppercase italic tracking-widest">PT Gema Teknik Perkasa</span>
           </div>
           <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-6">
              <ShieldCheck className="text-indigo-500" size={60} />
              Command Center
           </h1>
           <p className="text-slate-400 font-bold text-lg uppercase italic tracking-widest mt-4 opacity-60">Consolidated Financial & Operational Intelligence</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Last Synced</p>
              <p className="text-xl font-black text-indigo-400 italic">{hasExecutiveData ? formatDate(lastSynced) : 'NO DATA'}</p>
           </div>
           <div className="flex gap-2 mt-4">
              <button 
                onClick={handleDownloadAudit}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 group"
              >
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> Audit Pack
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-600/20 flex items-center gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Syncing...
                  </>
                ) : (
                  'Refresh Live Data'
                )}
              </button>
           </div>
        </div>
      </div>

      {/* Audit Modal */}
      <AnimatePresence>
        {showAuditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuditModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center gap-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-2">
                   <img src="https://images.unsplash.com/photo-1768402002414-882c0624016b?auto=format&fit=crop&q=80&w=200" alt="Gema Logo" className="w-full h-full object-contain filter invert opacity-80" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Generate Audit Pack</h3>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.3em] mt-2">PT Gema Teknik Perkasa Official</p>
                </div>
              </div>
              <div className="p-8 space-y-4">
                {[
                  { title: "Financial Consolidation", desc: "P&L, Balance Sheet, and AR/AP Aging", icon: <Landmark size={20} /> },
                  { title: "Operational Audit", desc: "Project Progress, Material Usage, and WO Status", icon: <Activity size={20} /> },
                  { title: "Inventory Valuation", desc: "Current Stock Level, Value, and FEFO Analysis", icon: <Layers size={20} /> },
                  { title: "Full Compliance Pack", desc: "All the above combined into a single archive", icon: <ShieldCheck size={20} /> }
                ].map((opt, i) => (
                  <button 
                    key={i}
                    onClick={() => triggerDownload(opt.title)}
                    className="w-full p-6 bg-white/5 hover:bg-white/10 border border-white/5 rounded-3xl flex items-center gap-6 transition-all group text-left"
                  >
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-white uppercase italic tracking-tighter">{opt.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium italic mt-1">{opt.desc}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
              <div className="p-8 bg-slate-950/50 flex justify-end">
                <button 
                  onClick={() => setShowAuditModal(false)}
                  className="px-8 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Layer: Financial Liquidity & Net Worth */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                 <Landmark size={24} />
              </div>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">+18.4%</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Aggregate Revenue</p>
           <h3 className="text-3xl font-black italic text-white tracking-tighter">{formatCurrency(finStats.totalRevenue)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Total Realized Contract Value</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400">
                 <ArrowUpRight size={24} />
              </div>
              <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">High Risk</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Accounts Receivable (AR)</p>
           <h3 className="text-3xl font-black italic text-rose-500 tracking-tighter">{formatCurrency(finStats.totalReceivable)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Outstanding Penagihan Customer</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                 <Layers size={24} />
              </div>
              <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">Asset Value</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Inventory Capital</p>
           <h3 className="text-3xl font-black italic text-amber-500 tracking-tighter">{formatCurrency(finStats.inventoryValue)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Nilai Barang Tersimpan di Gudang</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-indigo-600 p-10 rounded-[3rem] shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
           <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <Zap size={140} className="text-white" />
           </div>
           <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Net Cash Position</p>
           <h3 className="text-3xl font-black italic text-white tracking-tighter">{formatCurrency(finStats.netPosition)}</h3>
           <p className="text-[10px] text-indigo-100 font-bold uppercase mt-4 italic">Liquid AR minus Liquid AP</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {showCharts ? (
          <Suspense fallback={executiveChartsFallback}>
            <ExecutiveDashboardCharts
              trendData={trendData}
              projectHealth={projectHealth}
              totalProjects={executiveSummary?.projects?.total ?? 0}
            />
          </Suspense>
        ) : (
          executiveChartsFallback
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
         {/* Operational Efficiency Card */}
         <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900/40 to-slate-900/40 p-12 rounded-[4rem] border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 group-hover:scale-150 transition-all duration-700" />
            <h4 className="text-xs font-black uppercase italic tracking-widest text-slate-500 mb-8">Production Velocity</h4>
            <div className="flex flex-col items-center justify-center text-center space-y-6 relative z-10">
               <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                     <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                     <circle cx="80" cy="80" r="72" fill="none" stroke="#6366F1" strokeWidth="12" strokeDasharray={452} strokeDashoffset={452 - (452 * opsStats.efficiency / 100)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute flex flex-col">
                     <span className="text-5xl font-black italic text-white leading-none">{Math.round(opsStats.efficiency)}%</span>
                     <span className="text-[8px] font-black text-slate-500 uppercase mt-1 tracking-widest">Efficiency</span>
                  </div>
               </div>
               <div>
                  <h5 className="text-lg font-black text-white uppercase italic tracking-tighter">Manufacturing Output</h5>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic leading-tight">Terlapor {opsStats.completedWO} WO Selesai dari {opsStats.totalWO} Planning</p>
               </div>
            </div>
         </div>

         {/* Stock Critical Notice */}
         <div className="lg:col-span-3 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-10">
               <h4 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
                  <Activity className="text-rose-500" size={28} />
                  Operational Risk Monitor
               </h4>
               <button
                 onClick={handleDownloadAudit}
                 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-indigo-400/30 pb-1"
               >
                 Full Audit History
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-8 group hover:bg-white/[0.08] transition-all cursor-pointer">
                  <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                     <AlertTriangle size={32} />
                  </div>
                  <div>
                     <h5 className="text-sm font-black text-white uppercase italic tracking-tighter">FEFO Risk Alert</h5>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic mt-1">3 Material Monolithics terdeteksi mendekati kadaluwarsa ({"<"} 30 hari).</p>
                  </div>
                  <ChevronRight size={20} className="text-slate-700 ml-auto" />
               </div>

               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-8 group hover:bg-white/[0.08] transition-all cursor-pointer">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Zap size={32} />
                  </div>
                  <div>
                     <h5 className="text-sm font-black text-white uppercase italic tracking-tighter">Procurement Optimization</h5>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic mt-1">Sistem menyarankan pembelian batch baru untuk Bata Api SK-34 (Buffer {"<"} 10%).</p>
                  </div>
                  <ChevronRight size={20} className="text-slate-700 ml-auto" />
               </div>
            </div>

            <div className="mt-10 p-10 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] flex items-center justify-between gap-8">
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
                     <Building2 size={24} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Total Workforce Engagement</p>
                     <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">PT GTP Operational Excellence</h5>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="text-center px-6 py-2 bg-white/5 rounded-2xl border border-white/5">
                     <p className="text-[18px] font-black text-white italic leading-none">{hrSummary?.employees?.total ?? 0}</p>
                     <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Personnel</p>
                  </div>
                  <div className="text-center px-6 py-2 bg-white/5 rounded-2xl border border-white/5">
                     <p className="text-[18px] font-black text-indigo-400 italic leading-none">{executiveSummary?.projects?.inProgress ?? 0}</p>
                     <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Active Sites</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
