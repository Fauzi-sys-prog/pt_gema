import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, Calendar, Download, Filter, ArrowRight, PieChart as PieChartIcon, CreditCard, Building2, Users } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

const CashflowCharts = lazy(() => import('../../components/finance/CashflowCharts'));

const EMPTY_CASHFLOW_STATS = {
  inflow: 0,
  outflowPurchases: 0,
  outflowPayroll: 0,
  totalOutflow: 0,
  netCashflow: 0,
};

const cashflowChartsFallback = (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
      <div className="mb-8 h-5 w-48 rounded-full bg-slate-100" />
      <div className="h-80 animate-pulse rounded-[2rem] bg-slate-100" />
    </div>
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
      <div className="mb-8 h-5 w-40 rounded-full bg-slate-100" />
      <div className="h-[240px] animate-pulse rounded-[2rem] bg-slate-100" />
    </div>
  </div>
);

export default function CashflowPage() {
  const { addAuditLog, currentUser } = useApp();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [serverSummary, setServerSummary] = useState<{
    stats?: {
      inflow: number;
      outflowPurchases: number;
      outflowPayroll: number;
      totalOutflow: number;
      netCashflow: number;
    };
    outflowOther?: number;
    monthlyCashflow?: Array<{ key: string; month: string; inflow: number; outflow: number }>;
    pieData?: Array<{ name: string; value: number; color: string }>;
    transactionLog?: Array<{
      date: string;
      category: string;
      entity: string;
      amount: number;
      direction: 'IN' | 'OUT';
      status: string;
    }>;
  } | null>(null);

  const fetchCashflowSummary = async (silent = true) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<typeof serverSummary>('/dashboard/finance-cashflow-page-summary');
      if (data) setServerSummary(data);
      if (!silent) toast.success('Cashflow summary refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh cashflow summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchCashflowSummary(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowCharts(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const effectiveStats = serverSummary?.stats ?? EMPTY_CASHFLOW_STATS;
  const effectiveOutflowOther = Number(serverSummary?.outflowOther ?? 0);
  const effectiveMonthlyCashflow = serverSummary?.monthlyCashflow ?? [];
  const effectivePieData = serverSummary?.pieData ?? [];
  const effectiveTransactionLog = (serverSummary?.transactionLog ?? []).map((row) => ({
    ...row,
    dateObj: row.date instanceof Date ? row.date : new Date(row.date),
  }));
  const hasCashflowData =
    effectiveStats.inflow > 0 ||
    effectiveStats.totalOutflow > 0 ||
    effectiveMonthlyCashflow.length > 0 ||
    effectiveTransactionLog.length > 0;
  const cashPositionTone =
    effectiveStats.netCashflow > 0 ? 'Healthy Balance' : effectiveStats.netCashflow < 0 ? 'Deficit Position' : 'No Data Yet';
  const cashPositionClass =
    effectiveStats.netCashflow > 0
      ? 'text-emerald-400'
      : effectiveStats.netCashflow < 0
      ? 'text-rose-400'
      : 'text-slate-300';

  const handleExport = async () => {
    const rows = [
      ['Tanggal', 'Kategori', 'Entitas', 'Amount', 'Direction', 'Status'],
      ...effectiveTransactionLog.map((row) => [
        row.dateObj.toISOString().slice(0, 10),
        row.category,
        row.entity,
        String(row.amount),
        row.direction,
        row.status,
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `cashflow-statement-${dateKey}`,
      title: 'Cashflow Statement Report',
      subtitle: `Per tanggal ${dateKey} | ${effectiveTransactionLog.length} transaksi kas`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Laporan arus kas dengan total inflow Rp ${effectiveStats.inflow.toLocaleString('id-ID')}, total outflow Rp ${effectiveStats.totalOutflow.toLocaleString('id-ID')}, dan posisi kas bersih Rp ${effectiveStats.netCashflow.toLocaleString('id-ID')}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Cashflow',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `cashflow-statement-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `cashflow-statement-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'CASHFLOW_EXPORTED',
        module: 'Finance',
        details: `Export cashflow statement (${effectiveTransactionLog.length} baris)`,
        status: 'Success',
      });
      toast.success('Cashflow statement Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export cashflow statement gagal.');
    }
  };

  const handleMonthLiveInfo = () => {
    const lastMonth = effectiveMonthlyCashflow.at(-1)?.month || '-';
    addAuditLog({
      action: 'CASHFLOW_LIVE_MONTH_VIEWED',
      module: 'Finance',
      details: `Mode Month: Live aktif, bulan data terbaru: ${lastMonth}`,
      status: 'Success',
    });
    toast.info(`Mode live aktif. Data terbaru: ${lastMonth}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Cashflow Statement</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Liquid Assets & Transaction Flow</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button
             onClick={() => fetchCashflowSummary(false)}
             disabled={summaryLoading}
             className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-60"
           >
             {summaryLoading ? 'Refreshing...' : 'Refresh'}
           </button>
           <button
             onClick={handleMonthLiveInfo}
             className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
           >
             <Calendar size={16} /> Month: Live
           </button>
           <button onClick={handleExport} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg">
             <Download size={16} /> Export Statement
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <ArrowUpCircle size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Inflow (Revenue)</p>
              <p className="text-3xl font-black text-slate-900 italic mt-1">Rp {effectiveStats.inflow.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-emerald-600 font-black mt-2 flex items-center gap-1 uppercase">
                <TrendingUp size={12} /> {hasCashflowData ? 'Live from finance ledger' : 'Menunggu data ledger'}
              </p>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4">
                <ArrowDownCircle size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outflow (Expenses)</p>
              <p className="text-3xl font-black text-slate-900 italic mt-1">Rp {effectiveStats.totalOutflow.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-rose-600 font-black mt-2 flex items-center gap-1 uppercase">
                <ArrowRight size={12} /> {hasCashflowData ? 'Material, payroll, expense' : 'Belum ada outflow tercatat'}
              </p>
            </div>
         </div>

         <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4">
                <Wallet size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Cash Position</p>
              <p className={`text-3xl font-black italic mt-1 ${cashPositionClass}`}>Rp {effectiveStats.netCashflow.toLocaleString('id-ID')}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">
                  {cashPositionTone}
                </div>
              </div>
            </div>
         </div>
      </div>

      {showCharts ? (
        <Suspense fallback={cashflowChartsFallback}>
          <CashflowCharts
            monthlyCashflow={effectiveMonthlyCashflow}
            pieData={effectivePieData}
            totalOutflow={effectiveStats.totalOutflow}
          />
        </Suspense>
      ) : (
        cashflowChartsFallback
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">Recent Transaction Log</h3>
            <button
              onClick={() => toast.info(`Riwayat transaksi tampil: ${effectiveTransactionLog.length} baris terbaru`)}
              className="text-[10px] font-black text-blue-600 uppercase hover:underline"
            >
              View All History
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-slate-50">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {effectiveTransactionLog.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                           Belum ada transaksi finance yang tercatat.
                        </td>
                     </tr>
                  )}
                  {effectiveTransactionLog.map((row, i) => (
                     <tr key={`tx-${i}`} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                           <span className="text-xs font-black text-slate-600 uppercase italic">{row.dateObj.toLocaleDateString('id-ID')}</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${row.direction === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                 {row.direction === 'IN' ? <CreditCard size={14} /> : <Users size={14} />}
                              </div>
                              <span className="text-[10px] font-black text-slate-900 uppercase">{row.category}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-slate-400" />
                              <span className="text-xs font-black text-slate-600 uppercase">{row.entity}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <span className={`text-sm font-black italic ${row.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {row.direction === 'IN' ? '+' : '-'}Rp {row.amount.toLocaleString('id-ID')}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border italic ${
                             row.direction === 'IN'
                               ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                               : 'bg-rose-50 text-rose-600 border-rose-100'
                           }`}>
                             {row.status}
                           </span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
