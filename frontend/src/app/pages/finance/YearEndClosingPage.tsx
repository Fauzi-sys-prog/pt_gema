import { useState, useMemo } from 'react';
import {
  ShieldCheck, Lock, Unlock, TrendingUp, TrendingDown,
  X, CheckCircle2, AlertCircle, BarChart3, Calendar,
  FileText, History, Sparkles, ArrowUpRight, ArrowDownLeft,
  GanttChartSquare, Building2, Users, Briefcase, Package,
  CreditCard, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

export default function YearEndClosingPage() {
  const {
    customerInvoiceList = [],
    vendorInvoiceList = [],
    expenseList = [],
    payrollRunList = [],
    thlPayrollRunList = [],
    pettyCashList = [],
    pettyCashGudangList = [],
    bankSaldoAwal = {},
    closedYearsList = [],
    addClosedYear,
    isYearClosed,
    addAuditLog,
  } = useApp();
  const { currentUser } = useAuth();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState(0);

  const locked = isYearClosed(selectedYear);
  const closedRecord = closedYearsList.find(c => c.year === selectedYear);

  // ── P&L for selected year ────────────────────────────────────────────
  const pl = useMemo(() => {
    const y = String(selectedYear);

    // Basis akrual: pendapatan diakui saat invoice customer diposting,
    // bukan saat kas diterima. PPN keluaran tidak termasuk pendapatan.
    const postedStatuses = ['Approved', 'Partial Paid', 'Paid', 'Overdue'];
    const revenue = customerInvoiceList
      .filter(inv => postedStatuses.includes(inv.status) && (inv.tanggal || inv.createdAt || '').startsWith(y))
      .reduce((sum, inv) => sum + (inv.subtotal || 0), 0);

    // AP diakui saat invoice vendor disetujui. PPN masukan dipisahkan dari HPP.
    const vendorCost = vendorInvoiceList
      .filter((vi: any) => postedStatuses.includes(vi.status) && (vi.tanggal || vi.createdAt || '').startsWith(y))
      .reduce((sum: number, vi: any) => {
        const total = Number(vi.totalAmount || 0);
        const rate = Number(vi.ppn || 0);
        return sum + (rate > 0 ? total / (1 + rate / 100) : total);
      }, 0);

    // Vendor expense entries
    const expCost = (expenseList || [])
      .filter(e => ['Approved', 'Paid'].includes(e.status) && ((e as any).tanggal || (e as any).createdAt || '').startsWith(y))
      .reduce((sum, e) => sum + ((e as any).nominal || (e as any).amount || 0), 0);

    // Payroll
    const payrollCost = (payrollRunList || [])
      .filter(r => r.status === 'Disbursed' && (r.disbursedAt || r.processedDate || '').startsWith(y))
      .reduce((sum, r) => sum + (r.totalTHP || 0), 0);

    // THL payroll
    const thlCost = (thlPayrollRunList || [])
      .filter(r => r.status === 'Disbursed' && (r.disbursedAt || r.createdAt || '').startsWith(y))
      .reduce((sum, r) => sum + (r.totalNetto || 0), 0);

    // Petty cash outflow (excluding top-up refills)
    const pcCost = (pettyCashList || [])
      .filter(e => e.date?.startsWith(y) && e.accountCode !== '00000' && e.kredit > 0)
      .reduce((sum, e) => sum + e.kredit, 0);
    const pcgCost = (pettyCashGudangList || [])
      .filter(e => e.date?.startsWith(y) && e.accountCode !== '00000' && e.kredit > 0)
      .reduce((sum, e) => sum + e.kredit, 0);

    const totalExpenses = vendorCost + expCost + payrollCost + thlCost + pcCost + pcgCost;
    const netProfit = revenue - totalExpenses;

    // Carry-forward AR: unpaid / partial customer invoices
    const carryForwardAR = customerInvoiceList
      .filter(inv => {
        const created = (inv.tanggal || inv.createdAt || '').slice(0, 4);
        return created === y && Number(inv.outstandingAmount || 0) > 0;
      })
      .reduce((sum, inv) => sum + Number(inv.outstandingAmount || 0), 0);

    // Carry-forward AP: unpaid vendor invoices
    const carryForwardAP = vendorInvoiceList
      .filter(vi => {
        const created = ((vi as any).tanggal || (vi as any).createdAt || '').slice(0, 4);
        return created === y && (vi as any).status !== 'Paid';
      })
      .reduce((sum, vi: any) => sum + Number(vi.outstandingAmount ?? (vi.totalAmount - (vi.paidAmount || 0)) ?? 0), 0);

    return {
      revenue, vendorCost, expCost,
      payrollCost, thlCost, pcCost: pcCost + pcgCost,
      totalExpenses, netProfit, carryForwardAR, carryForwardAP,
      margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    };
  }, [selectedYear, customerInvoiceList, vendorInvoiceList, expenseList, payrollRunList, thlPayrollRunList, pettyCashList, pettyCashGudangList]);

  // ── Monthly chart ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const y = String(selectedYear);
    const buckets = Array.from({ length: 12 }, () => ({ rev: 0, exp: 0 }));

    const postedStatuses = ['Approved', 'Partial Paid', 'Paid', 'Overdue'];
    customerInvoiceList
      .filter(inv => postedStatuses.includes(inv.status))
      .forEach(inv => addToMonth(inv.tanggal || inv.createdAt || '', inv.subtotal || 0, 'rev'));

    const addExp = (date: string, amt: number) => {
      if (!date?.startsWith(y)) return;
      const m = new Date(date).getMonth();
      if (m >= 0 && m < 12) buckets[m].exp += amt;
    };

    function addToMonth(date: string, amount: number, field: 'rev' | 'exp') {
      if (!date?.startsWith(y)) return;
      const month = new Date(date).getMonth();
      if (month >= 0 && month < 12) buckets[month][field] += amount;
    }

    vendorInvoiceList.filter((vi: any) => postedStatuses.includes(vi.status)).forEach((vi: any) => {
      const total = Number(vi.totalAmount || 0);
      const rate = Number(vi.ppn || 0);
      addExp(vi.tanggal || vi.createdAt || '', rate > 0 ? total / (1 + rate / 100) : total);
    });
    (expenseList || []).filter(e => ['Approved', 'Paid'].includes(e.status)).forEach(e => addExp((e as any).tanggal || (e as any).createdAt || '', (e as any).nominal || (e as any).amount || 0));
    (payrollRunList || []).filter(r => r.status === 'Disbursed').forEach(r => addExp(r.disbursedAt || r.processedDate || '', r.totalTHP || 0));
    (thlPayrollRunList || []).filter(r => r.status === 'Disbursed').forEach(r => addExp(r.disbursedAt || r.createdAt || '', r.totalNetto || 0));

    return MONTHS.map((month, i) => ({
      month,
      rev: buckets[i].rev,
      exp: buckets[i].exp,
      profit: buckets[i].rev - buckets[i].exp,
    }));
  }, [selectedYear, customerInvoiceList, vendorInvoiceList, expenseList, payrollRunList, thlPayrollRunList]);

  // ── Closing process ──────────────────────────────────────────────────
  const handleConfirmClose = async () => {
    setShowConfirmModal(false);
    setIsClosing(true);
    setClosingStep(1);
    try {
      const closedYearId = `CY-${selectedYear}`;
      // Step 1: Close the year
      addClosedYear({
        year: selectedYear,
        closedAt: new Date().toISOString(),
        closedBy: currentUser?.fullName || 'Finance Manager',
        totalRevenue: pl.revenue,
        totalExpenses: pl.totalExpenses,
        netProfit: pl.netProfit,
        carryForwardAR: pl.carryForwardAR,
        carryForwardAP: pl.carryForwardAP,
        bankBalances: Object.fromEntries(
          Object.entries(bankSaldoAwal || {}).filter(([bank]) => !bank.includes('::')),
        ),
      });
      setClosingStep(4);
      // Step 2: Audit log — rollback step 1 if this fails
      try {
        addAuditLog({
          action: `Year-End Closing FY ${selectedYear}`,
          module: 'Finance',
          details: `Buku tahun ${selectedYear} resmi dikunci. Net Profit: ${fmt(pl.netProfit)}`,
          status: 'Success',
        });
      } catch (auditErr) {
        try {
          await api.request(`/finance/closed-years/${encodeURIComponent(closedYearId)}`, { method: 'DELETE' });
        } catch { /* best-effort rollback */ }
        throw auditErr;
      }
      toast.success(`Buku tahun ${selectedYear} berhasil dikunci!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Gagal mengunci buku tahun ${selectedYear}`);
    } finally {
      setIsClosing(false);
      setClosingStep(0);
    }
  };

  const expBreakdown = [
    { label: 'Vendor / AP',     val: pl.vendorCost,   icon: Briefcase,     color: '#6366f1' },
    { label: 'Vendor Expense',  val: pl.expCost,      icon: Package,       color: '#f59e0b' },
    { label: 'Payroll Staff',   val: pl.payrollCost,  icon: Users,         color: '#10b981' },
    { label: 'Gaji THL',        val: pl.thlCost,      icon: Users,         color: '#06b6d4' },
    { label: 'Petty Cash',      val: pl.pcCost,       icon: CreditCard,    color: '#f43f5e' },
  ].filter(e => e.val > 0);

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 bg-[#F8FAFC] min-h-screen pb-24">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${
              locked ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {locked ? `FY ${selectedYear} Dikunci` : `FY ${selectedYear} — Open`}
            </span>
            <span className="text-slate-400 font-bold text-xs uppercase italic tracking-widest">Fiscal Year Closing</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            {locked
              ? <Lock className="text-rose-500" size={36} />
              : <ShieldCheck className="text-emerald-500" size={36} />}
            Year-End <span className="text-indigo-600 ml-2">Closing</span>
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-1">
            Laporan Laba Rugi Konsolidasi & Tutup Buku Tahunan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year picker */}
          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-black text-slate-700 outline-none appearance-none"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {!locked && !isClosing && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
            >
              <Lock size={15} /> Tutup Buku {selectedYear}
            </button>
          )}
        </div>
      </div>

      {/* Closing progress */}
      {isClosing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <Sparkles size={300} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                <History size={20} />
              </div>
              <h3 className="text-lg font-black italic uppercase tracking-tight">Memproses Penutupan FY {selectedYear}...</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                'Konsolidasi P&L',
                'Validasi AR/AP',
                'Finalisasi Payroll',
                'Roll Over Saldo',
              ].map((label, i) => (
                <div key={i} className={`p-4 rounded-2xl border-2 transition-all ${
                  closingStep > i ? 'bg-white/10 border-indigo-500/60' : 'bg-white/5 border-white/5 opacity-30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Step 0{i+1}</span>
                    {closingStep > i && <CheckCircle2 size={14} className="text-indigo-400" />}
                  </div>
                  <p className="text-xs font-black uppercase italic">{label}</p>
                </div>
              ))}
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((closingStep / 4) * 100, 100)}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Closed banner */}
      {locked && closedRecord && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-100 border-2 border-rose-200 rounded-[2rem] px-6 py-5 flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center shrink-0">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-rose-800 uppercase italic">Buku {selectedYear} Sudah Dikunci</p>
            <p className="text-[10px] text-rose-500 font-bold mt-0.5">
              Ditutup oleh {closedRecord.closedBy} pada {new Date(closedRecord.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div className="text-right">
              <p className="text-[9px] font-black text-rose-400 uppercase">Net Profit Tercatat</p>
              <p className={`text-sm font-black ${closedRecord.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(closedRecord.netProfit)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: 'Total Revenue', val: pl.revenue, icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'from-white to-emerald-50/30', border: 'border-emerald-100' },
          { label: 'Total Expenses', val: pl.totalExpenses, icon: ArrowUpRight, color: 'text-rose-500', bg: 'from-white to-rose-50/30', border: 'border-rose-100' },
          { label: 'Net Profit', val: pl.netProfit, icon: pl.netProfit >= 0 ? TrendingUp : TrendingDown, color: pl.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600', bg: 'from-white to-indigo-50/20', border: 'border-indigo-100' },
          { label: 'Profit Margin', val: null, icon: BarChart3, color: 'text-amber-500', bg: 'from-white to-amber-50/20', border: 'border-amber-100', extra: `${pl.margin.toFixed(1)}%` },
        ].map((card, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-[2rem] p-5 sm:p-8 shadow-sm relative overflow-hidden`}
          >
            <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2 ${card.color}`}>
              <card.icon size={11} /> {card.label}
            </p>
            <h3 className={`text-lg sm:text-2xl font-black italic tracking-tight ${card.color}`}>
              {card.extra ?? fmt(card.val!)}
            </h3>
          </motion.div>
        ))}
      </div>

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-10 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={14} /> Revenue vs Expenses — {selectedYear}
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 900 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="rev" name="Revenue" stroke="#6366f1" strokeWidth={3} fill="url(#gRev)" isAnimationActive={false} />
                <Area type="monotone" dataKey="exp" name="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#gExp)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FileText size={14} /> Rincian Biaya
          </p>
          {expBreakdown.length === 0 ? (
            <div className="text-center py-10">
              <Building2 size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold">Tidak ada data biaya di {selectedYear}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expBreakdown.map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <div className="flex items-center gap-2">
                      <item.icon size={12} style={{ color: item.color }} />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700">{fmt(item.val)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: pl.totalExpenses > 0 ? `${(item.val / pl.totalExpenses) * 100}%` : '0%',
                      backgroundColor: item.color,
                    }} />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                <span className="text-sm font-black text-rose-600 italic">{fmt(pl.totalExpenses)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Carry-forward */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className={`rounded-[2rem] border-2 p-6 sm:p-8 ${pl.carryForwardAR > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${pl.carryForwardAR > 0 ? 'bg-amber-200 text-amber-700' : 'bg-slate-200 text-slate-400'}`}>
              <ArrowDownLeft size={16} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Piutang Belum Lunas (AR)</p>
              <p className="text-[10px] font-bold text-slate-500">Carry-forward ke tahun berikutnya</p>
            </div>
          </div>
          <h3 className={`text-2xl font-black italic ${pl.carryForwardAR > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            {pl.carryForwardAR > 0 ? fmt(pl.carryForwardAR) : 'Lunas semua'}
          </h3>
          {pl.carryForwardAR > 0 && (
            <p className="text-[9px] text-amber-600 font-bold mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> Invoice belum terbayar penuh akan terbawa ke {selectedYear + 1}
            </p>
          )}
        </div>

        <div className={`rounded-[2rem] border-2 p-6 sm:p-8 ${pl.carryForwardAP > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${pl.carryForwardAP > 0 ? 'bg-rose-200 text-rose-700' : 'bg-slate-200 text-slate-400'}`}>
              <ArrowUpRight size={16} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hutang Belum Lunas (AP)</p>
              <p className="text-[10px] font-bold text-slate-500">Carry-forward ke tahun berikutnya</p>
            </div>
          </div>
          <h3 className={`text-2xl font-black italic ${pl.carryForwardAP > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
            {pl.carryForwardAP > 0 ? fmt(pl.carryForwardAP) : 'Lunas semua'}
          </h3>
          {pl.carryForwardAP > 0 && (
            <p className="text-[9px] text-rose-500 font-bold mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> Vendor invoice belum dibayar terbawa ke {selectedYear + 1}
            </p>
          )}
        </div>
      </div>

      {/* Closing history */}
      {closedYearsList.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History size={14} /> Riwayat Tutup Buku
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {[...closedYearsList].sort((a, b) => b.year - a.year).map(rec => (
              <div key={rec.id} className="px-8 py-5 flex flex-wrap items-center gap-4 group hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Lock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 uppercase italic">Fiscal Year {rec.year}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {new Date(rec.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} · {rec.closedBy}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Revenue</p>
                    <p className="text-xs font-black text-emerald-600">{fmt(rec.totalRevenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Net Profit</p>
                    <p className={`text-xs font-black ${rec.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{fmt(rec.netProfit)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedYear(rec.year)}
                  className="p-2 text-slate-300 hover:text-slate-700 transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm close modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-7 pt-7 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500 rounded-2xl flex items-center justify-center rotate-3">
                    <Lock size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">Tutup Buku {selectedYear}?</h3>
                    <p className="text-slate-400 text-[10px] font-bold mt-0.5">Tindakan ini tidak bisa dibatalkan</p>
                  </div>
                </div>
                <button onClick={() => setShowConfirmModal(false)}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all">
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            <div className="px-7 py-6 space-y-5">
              {/* Summary */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                {[
                  { label: 'Total Revenue', val: fmt(pl.revenue), color: 'text-emerald-600' },
                  { label: 'Total Expenses', val: fmt(pl.totalExpenses), color: 'text-rose-500' },
                  { label: 'Net Profit / Loss', val: fmt(pl.netProfit), color: pl.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600' },
                  { label: 'Carry-forward AR', val: pl.carryForwardAR > 0 ? fmt(pl.carryForwardAR) : 'Nihil', color: 'text-amber-600' },
                  { label: 'Carry-forward AP', val: pl.carryForwardAP > 0 ? fmt(pl.carryForwardAP) : 'Nihil', color: 'text-rose-500' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.label}</span>
                    <span className={`text-sm font-black italic ${row.color}`}>{row.val}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                  Setelah dikunci, data tahun {selectedYear} tidak dapat diubah lagi. Saldo AR/AP carry-forward akan dibawa ke {selectedYear + 1}.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50 transition-all">
                  Batal
                </button>
                <button onClick={handleConfirmClose} disabled={isClosing}
                  className="flex-[2] py-4 rounded-2xl bg-slate-900 hover:bg-black text-white text-sm font-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  <Lock size={15} /> Ya, Tutup Buku {selectedYear}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
