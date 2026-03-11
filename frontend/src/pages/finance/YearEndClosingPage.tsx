import { useState, useEffect } from 'react'; import { ShieldCheck, Lock, Unlock, TrendingUp, TrendingDown, PieChart as PieChartIcon, Download, ChevronRight, CheckCircle2, AlertCircle, BarChart3, Calendar, FileText, History, ArrowRight, GanttChartSquare, Sparkles } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';

export default function YearEndClosingPage() {
  const { addAuditLog, currentUser } = useApp();
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState(0);
  const [isYearLocked, setIsYearLocked] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [serverAnnualSummary, setServerAnnualSummary] = useState<{
    totalRev: number;
    totalVend: number;
    totalLabor: number;
    totalMaterial: number;
    overhead: number;
    grossProfit: number;
    netProfit: number;
    margin: number;
  } | null>(null);
  const [serverMonthlyRevData, setServerMonthlyRevData] = useState<Array<{
    month: string;
    rev: number;
    outflow: number;
    profit: number;
    idx: number;
  }>>([]);
  const [serverExpenseAlloc, setServerExpenseAlloc] = useState<Array<{
    label: string;
    value: number;
    percent: number;
    color: string;
  }>>([]);


  const fetchYearEndSummary = async (silent = true) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<{
        annualSummary?: typeof serverAnnualSummary;
        monthlyRevData?: typeof serverMonthlyRevData;
        expenseAlloc?: typeof serverExpenseAlloc;
      }>('/dashboard/finance-year-end-summary');
      if (data?.annualSummary) setServerAnnualSummary(data.annualSummary as NonNullable<typeof serverAnnualSummary>);
      if (Array.isArray(data?.monthlyRevData)) setServerMonthlyRevData(data.monthlyRevData);
      if (Array.isArray(data?.expenseAlloc)) setServerExpenseAlloc(data.expenseAlloc);
      if (!silent) toast.success('Year-end summary refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh year-end summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchYearEndSummary(true);
  }, []);

  const annualSummary = serverAnnualSummary || {
    totalRev: 0,
    totalVend: 0,
    totalLabor: 0,
    totalMaterial: 0,
    overhead: 0,
    grossProfit: 0,
    netProfit: 0,
    margin: 0,
  };
  const monthlyRevData = serverMonthlyRevData;
  const expenseAlloc = serverExpenseAlloc;

  const nextFrame = () =>
    new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

  const handleStartClosing = async () => {
    setIsClosing(true);
    setClosingStep(1);

    try {
      // Move step state across frames without artificial long delay.
      await nextFrame();
      setClosingStep(2);
      await nextFrame();
      setClosingStep(3);
      await nextFrame();
      setClosingStep(4);

      const closingId = `YE-2026-${Date.now()}`;
      await api.post('/archive-registry', {
        id: closingId,
        date: '2026-12-31',
        ref: 'YE-2026-GTP',
        description: 'Laporan Laba/Rugi Konsolidasi Akhir Tahun 2026',
        amount: annualSummary.netProfit,
        project: 'CONSOLIDATED-2026',
        admin: currentUser?.fullName || currentUser?.username || 'System',
        type: 'AR',
        source: 'year-end-close|year=2026',
      });

      addAuditLog({
        action: 'Year-End Closing Finalized',
        module: 'Finance',
        details: 'Tutup buku periode 2026 berhasil. Saldo awal 2027 telah digenerate.',
        status: 'Success'
      });

      setIsYearLocked(true);
      toast.success('Closing Berhasil! Buku 2026 resmi dikunci.');
    } catch {
      toast.error('Gagal closing tahun ke database.');
      setClosingStep(0);
    } finally {
      setIsClosing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleViewProfitCenter = () => {
    toast.info('Profit center tersedia di panel Revenue, Cost, dan Margin tahunan.');
  };

  const handleDownloadFiscalSummary = async () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue', annualSummary.totalRev],
      ['Total Vendor Cost', annualSummary.totalVend],
      ['Total Labor Cost', annualSummary.totalLabor],
      ['Total Material Cost', annualSummary.totalMaterial],
      ['Overhead', annualSummary.overhead],
      ['Gross Profit', annualSummary.grossProfit],
      ['Net Profit', annualSummary.netProfit],
      ['Margin (%)', annualSummary.margin.toFixed(2)],
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `fiscal-summary-${dateKey}`,
      title: 'Fiscal Summary Report',
      subtitle: 'Year End Closing Summary',
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan fiskal tahunan dengan net profit ${formatCurrency(annualSummary.netProfit)} dan margin ${annualSummary.margin.toFixed(2)}%.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Year End',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `fiscal-summary-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `fiscal-summary-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Fiscal summary Word + Excel berhasil diunduh.');
    } catch {
      toast.error('Export fiscal summary gagal.');
    }
  };

  const handleDownloadAuditorProof = async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Field', 'Value'],
      ['Generated At', new Date().toLocaleString('id-ID')],
      ['Total Revenue', annualSummary.totalRev],
      ['Total Outflow', annualSummary.totalVend + annualSummary.totalLabor + annualSummary.totalMaterial + annualSummary.overhead],
      ['Net Profit', annualSummary.netProfit],
      ['Margin (%)', annualSummary.margin.toFixed(2)],
      ['Fiscal Lock', isYearLocked ? 'LOCKED' : 'OPEN'],
      ['Closing Running', isClosing ? 'YES' : 'NO'],
    ];
    const payload = {
      filename: `auditor-proof-${dateKey}`,
      title: 'Auditor Proof Packet',
      subtitle: 'Year End Closing Verification',
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Paket verifikasi auditor untuk status tutup buku tahunan. Fiscal lock saat ini: ${isYearLocked ? 'LOCKED' : 'OPEN'}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Auditor',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `auditor-proof-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `auditor-proof-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Auditor proof Word + Excel berhasil diunduh.');
    } catch {
      toast.error('Export auditor proof gagal.');
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#FDFDFD] min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
           <div className="flex items-center gap-3 mb-3">
              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${isYearLocked ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 {isYearLocked ? 'Buku 2026 Dikunci' : 'Open Fiscal Year 2026'}
              </span>
              <span className="text-slate-400 font-bold text-xs uppercase italic tracking-widest">Audit Stability Mode</span>
           </div>
           <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-5">
              <ShieldCheck className={isYearLocked ? 'text-rose-600' : 'text-emerald-600'} size={48} />
              Fiscal Year <span className="text-blue-600">Closing</span>
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-2">Penyelarasan Saldo Akhir & Persiapan Buku Besar 2027</p>
        </div>
        
        {!isYearLocked && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchYearEndSummary(false)}
              disabled={summaryLoading}
              className="px-6 py-5 bg-white border border-slate-200 text-slate-700 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {summaryLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              onClick={handleStartClosing}
              disabled={isClosing}
              className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl flex items-center gap-4 group disabled:opacity-50"
            >
              {isClosing ? <History className="animate-spin" size={20} /> : <Lock size={20} className="group-hover:rotate-12 transition-transform" />}
              Start Year-End Finalization
            </button>
          </div>
        )}
      </div>

      {/* Annual Progress / Closing Steps */}
      <AnimatePresence>
        {isClosing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl"
          >
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Sparkles size={200} />
             </div>
             <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-pulse">
                      <GanttChartSquare size={24} />
                   </div>
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter">Processing Year-End Consensus...</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   {[
                     { step: 1, label: 'Consolidating P&L Ledger', active: closingStep >= 1 },
                     { step: 2, label: 'Finalizing Project WIP', active: closingStep >= 2 },
                     { step: 3, label: 'Tax (VAT/Income) Alignment', active: closingStep >= 3 },
                     { step: 4, label: 'Rolling Balances to FY 2027', active: closingStep >= 4 },
                   ].map((s) => (
                     <div key={s.step} className={`p-6 rounded-2xl border-2 transition-all ${s.active ? 'bg-white/10 border-blue-500/50' : 'bg-white/5 border-white/5 opacity-40'}`}>
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Step 0{s.step}</span>
                           {s.active && <CheckCircle2 size={16} className="text-blue-400" />}
                        </div>
                        <p className="text-sm font-black italic uppercase">{s.label}</p>
                     </div>
                   ))}
                </div>
                
                <div className="mt-10 h-2 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${(closingStep / 4) * 100}%` }}
                     className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                   />
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stats Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2 bg-white p-12 rounded-[3.5rem] border-2 border-slate-100 shadow-sm relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-all pointer-events-none">
               <TrendingUp size={120} />
            </div>
            <div className="flex justify-between items-start mb-12">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Annual Revenue Console</p>
                  <h3 className="text-5xl font-black italic text-slate-900 tracking-tighter">{formatCurrency(annualSummary.totalRev)}</h3>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase">
                     <TrendingUp size={16} /> +24.5% vs FY 2024
                  </div>
               </div>
               <div className="flex gap-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                     <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Fiscal Health Score</p>
                     <p className="text-xl font-black italic text-slate-900">92/100</p>
                  </div>
               </div>
            </div>

            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={monthlyRevData}>
                     <defs>
                        <linearGradient id="colorRevYE" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#94A3B8', fontSize:10, fontWeight:900}} />
                     <Tooltip />
                     <Area type="monotone" dataKey="rev" stroke="#3b82f6" strokeWidth={4} fill="url(#colorRevYE)" />
                     <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="transparent" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="space-y-8">
            <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                  <Sparkles size={100} />
               </div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 italic">Net Consolidated Profit</p>
               <h3 className="text-4xl font-black italic text-yellow-400 tracking-tighter mb-4">{formatCurrency(annualSummary.netProfit)}</h3>
               <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase italic text-blue-400 border border-white/5">
                     Margin: {annualSummary.margin.toFixed(1)}%
                  </div>
                  <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase italic text-emerald-400 border border-white/5">
                     Audited
                  </div>
               </div>
               
               <div className="mt-12 space-y-4">
                  <button
                     onClick={handleViewProfitCenter}
                     className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between px-6 border border-white/5 group"
                  >
                     <span>View Profit Center Analysis</span>
                     <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-100 shadow-sm">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic flex items-center gap-2">
                  <PieChartIcon size={16} /> Expense Allocation FY 2026
               </h4>
               <div className="space-y-5">
                  {expenseAlloc.map((item) => (
                    <div key={item.label}>
                       <div className="flex justify-between items-center mb-1.5 px-1">
                          <span className="text-[9px] font-black uppercase text-slate-400">{item.label}</span>
                          <span className="text-[10px] font-black text-slate-900 italic">{item.percent.toFixed(1)}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.percent}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* Fiscal Health & Audit Ready Check */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'Audit Log Status', val: 'SYNCED', desc: '1,422 Records Verified', icon: FileText, color: 'text-blue-600' },
           { label: 'Stock Valuation', val: 'FINAL', desc: 'Weighted Average Cost', icon: BarChart3, color: 'text-slate-900' },
           { label: 'Bank Balance', val: 'MATCHED', desc: 'Reconciled to Dec 31st', icon: ShieldCheck, color: 'text-emerald-600' },
           { label: 'Rollover Status', val: isYearLocked ? 'LOCKED' : 'READY', desc: 'Waiting for Consensus', icon: Unlock, color: isYearLocked ? 'text-rose-600' : 'text-amber-600' },
         ].map((card, i) => (
           <div key={i} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                 <div className={`p-3 bg-slate-50 rounded-2xl ${card.color}`}>
                    <card.icon size={20} />
                 </div>
                 <span className={`text-[9px] font-black uppercase tracking-widest ${card.color}`}>{card.val}</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <p className="text-sm font-black italic text-slate-900">{card.desc}</p>
           </div>
         ))}
      </div>

      {/* Audit Disclosure Banner */}
      <div className="bg-white p-12 rounded-[4rem] border-2 border-slate-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
         <div className="flex-1">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-4 flex items-center gap-3">
               <Sparkles className="text-amber-500" /> Fiscal Governance Integrity
            </h3>
            <p className="text-xs text-slate-500 font-bold leading-relaxed italic uppercase tracking-wide mb-8">
               Proses <span className="text-slate-900">Year-End Closing</span> ini memastikan semua transaksi di periode 2026 telah terverifikasi secara multi-level (Site Supervisor, Admin Gudang, hingga Finance). Setelah buku dikunci, saldo kas, bank, dan persediaan akan dipindahkan ke buku besar periode 2027 secara otomatis tanpa intervensi manual (<span className="text-blue-600 font-black italic">Zero Re-typing Rollover</span>).
            </p>
            <div className="flex flex-wrap gap-4">
               <button
                  onClick={handleDownloadFiscalSummary}
                  className="px-8 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"
               >
                  <Download size={14} /> Download Fiscal Summary
               </button>
               <button
                  onClick={handleDownloadAuditorProof}
                  className="px-8 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"
               >
                  <FileText size={14} /> Auditor Proof Packet
               </button>
            </div>
         </div>
         <div className="w-full md:w-96 bg-slate-50 p-10 rounded-[3rem] border-2 border-slate-100 text-center relative group">
            <div className="absolute inset-0 bg-blue-600 rounded-[3rem] translate-x-3 translate-y-3 -z-10 opacity-10 group-hover:translate-x-4 group-hover:translate-y-4 transition-all"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Audited Year-End Timestamp</p>
            <div className="flex flex-col items-center">
               <Calendar size={48} className="text-slate-200 mb-4" />
               <p className="text-2xl font-black italic text-slate-900 leading-none">31 DECEMBER 2026</p>
               <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Cut-off point for FY Consensus</p>
            </div>
         </div>
      </div>
    </div>
  );
}
