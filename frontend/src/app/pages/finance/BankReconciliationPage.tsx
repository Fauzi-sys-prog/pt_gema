import { useState, useMemo } from 'react';
import { bankOpeningBalanceKey, useApp } from '../../contexts/AppContext';
import {
  Search, Building2, ChevronDown, Pencil, X, AlertCircle,
  Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  CreditCard, Landmark, Calendar, Plus, RefreshCw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'BTN'];

const isSelectedBank = (value: string | undefined, selectedBank: string) =>
  Boolean(value && value.toLowerCase().includes(selectedBank.toLowerCase()));

interface MutasiRow {
  id: string;
  tanggal: string;
  keterangan: string;
  keteranganDetail?: string;
  debit: number;
  kredit: number;
  tipe: 'Penerimaan AR' | 'Pembayaran AP' | 'Top-Up Kas Gudang' | 'Top-Up Kas Kantor' | 'Tambahan Biaya Proyek' | 'Payroll' | 'Gaji THL' | 'Setoran Bank' | 'Penarikan Bank';
  manualId?: string;
}

export default function BankReconciliationPage() {
  const {
    customerInvoiceList = [],
    vendorInvoiceList = [],
    pettyCashList = [],
    pettyCashGudangList = [],
    expenseList = [],
    payrollRunList = [],
    thlPayrollRunList = [],
    bankSaldoAwal,
    setBankSaldoAwal,
    bankManualEntryList = [],
    addBankManualEntry,
    deleteBankManualEntry,
  } = useApp();

  const [selectedBank, setSelectedBank] = useState('BCA');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipe, setFilterTipe] = useState<'all' | 'in' | 'out'>('all');

  const [showSaldoModal, setShowSaldoModal] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const [saldoTanggal, setSaldoTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [saldoPrioritas, setSaldoPrioritas] = useState<'Normal' | 'Urgent'>('Normal');
  const [saldoCatatan, setSaldoCatatan] = useState('');

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpForm, setTopUpForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    keterangan: '',
    amount: '',
    tipe: 'Masuk' as 'Masuk' | 'Keluar',
    notes: '',
    bank: selectedBank,
    bankCustom: '',
  });
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);
  const [isSubmittingSaldo, setIsSubmittingSaldo] = useState(false);

  const openTopUpModal = () => {
    setTopUpForm(f => ({ ...f, bank: selectedBank, bankCustom: '' }));
    setShowTopUpModal(true);
  };

  const resolvedBank = topUpForm.bank === 'Lainnya' ? topUpForm.bankCustom : topUpForm.bank;

  const handleSubmitTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(topUpForm.amount.replace(/[^0-9]/g, ''));
    if (!amt || amt <= 0) return;
    if (!resolvedBank.trim()) return;
    setIsSubmittingTopUp(true);
    try {
      await addBankManualEntry({
        tanggal: topUpForm.tanggal,
        bank: resolvedBank.trim(),
        keterangan: topUpForm.keterangan,
        amount: amt,
        tipe: topUpForm.tipe,
        notes: topUpForm.notes || undefined,
        createdAt: new Date().toISOString(),
      });
      toast.success(`Top Up ${topUpForm.tipe === 'Masuk' ? 'Debit' : 'Kredit'} Rp ${amt.toLocaleString('id-ID')} dicatat`);
      setSelectedBank(resolvedBank.trim());
      setTopUpForm({ tanggal: new Date().toISOString().split('T')[0], keterangan: '', amount: '', tipe: 'Masuk', notes: '', bank: selectedBank, bankCustom: '' });
      setShowTopUpModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan mutasi bank: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  const periodBalanceKey = bankOpeningBalanceKey(selectedBank, selectedPeriod);
  const hasPeriodBalances = Object.keys(bankSaldoAwal || {})
    .some(key => key.startsWith(`${selectedBank}::`));
  const saldoAwal = typeof bankSaldoAwal?.[periodBalanceKey] === 'number'
    ? bankSaldoAwal[periodBalanceKey]
    : hasPeriodBalances ? 0 : bankSaldoAwal?.[selectedBank] ?? 0;

  const bankOptions = useMemo(() => Array.from(new Set([
    ...BANKS,
    ...Object.keys(bankSaldoAwal || {}).filter(bank => !bank.includes('::')),
    ...bankManualEntryList.map(entry => entry.bank),
  ])).filter(Boolean), [bankSaldoAwal, bankManualEntryList]);

  const BANK_LABELS: Record<string, string> = {
    BCA: 'BCA PT Gema Teknik Perkasa',
    Mandiri: 'Mandiri PT Gema Teknik Perkasa',
    BNI: 'BNI PT Gema Teknik Perkasa',
    BRI: 'BRI PT Gema Teknik Perkasa',
    'CIMB Niaga': 'CIMB Niaga PT Gema Teknik Perkasa',
    Permata: 'Permata PT Gema Teknik Perkasa',
    Danamon: 'Danamon PT Gema Teknik Perkasa',
    BSI: 'BSI PT Gema Teknik Perkasa',
    BTN: 'BTN PT Gema Teknik Perkasa',
  };

  const handleSetSaldo = async () => {
    if (isSubmittingSaldo) return;
    const val = parseFloat(saldoInput.replace(/[^0-9]/g, ''));
    if (isNaN(val) || val < 0) return;
    if (!window.confirm(`Tetapkan saldo awal ${selectedBank} sebesar Rp ${val.toLocaleString('id-ID')}? Ini akan mengubah dasar perhitungan rekonsiliasi bank.`)) return;
    setIsSubmittingSaldo(true);
    try {
      await setBankSaldoAwal(selectedBank, val, {
        period: selectedPeriod,
        date: saldoTanggal,
        note: saldoCatatan || undefined,
        priority: saldoPrioritas,
      });
      toast.success(`Saldo awal ${selectedBank} periode ${selectedPeriod} berhasil disimpan`);
      setShowSaldoModal(false);
      setSaldoInput('');
      setSaldoCatatan('');
      setSaldoPrioritas('Normal');
    } catch (err) {
      toast.error('Gagal menyimpan saldo awal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmittingSaldo(false);
    }
  };

  const openSaldoModal = () => {
    setSaldoInput(saldoAwal > 0 ? String(saldoAwal) : '');
    setSaldoTanggal(`${selectedPeriod}-01`);
    setShowSaldoModal(true);
  };

  // ── Computed rows ──────────────────────────────────────────────
  const arRows = useMemo<MutasiRow[]>(() =>
    customerInvoiceList.flatMap(inv =>
      (inv.paymentHistory || [])
        .filter(p => p.tanggal && p.metodeBayar !== 'Cash' &&
          // Rekonsiliasi memakai rekening perusahaan penerima, bukan bank pengirim customer.
          isSelectedBank(p.rekeningTujuan || p.bankName, selectedBank))
        .map((pay, idx) => ({
          id: `ar-${inv.id}-${idx}`,
          tanggal: pay.tanggal,
          keterangan: `Penerimaan dari ${inv.customerName} — ${inv.noInvoice}`,
          keteranganDetail: [inv.perihal, pay.remark].filter(Boolean).join(' · ') || undefined,
          debit: pay.nominal, kredit: 0,
          tipe: 'Penerimaan AR' as const,
        }))
  ), [customerInvoiceList, selectedBank]);

  const apRows = useMemo<MutasiRow[]>(() =>
    vendorInvoiceList.flatMap(vi =>
      (vi.paymentHistory || [])
        .filter(p => p.tanggal && p.metodeBayar !== 'Cash' && isSelectedBank(p.bank, selectedBank))
        .map((pay, idx) => ({
          id: `ap-${vi.id}-${idx}`,
          tanggal: pay.tanggal,
          keterangan: `Pembayaran ke ${vi.supplier} — ${vi.noInvoiceVendor}`,
          keteranganDetail: [pay.keterangan, vi.keterangan].filter(Boolean).join(' · ') || undefined,
          debit: 0, kredit: pay.nominal,
          tipe: 'Pembayaran AP' as const,
        }))
  ), [vendorInvoiceList, selectedBank]);

  const vendorExpenseRows = useMemo<MutasiRow[]>(() =>
    (expenseList || [])
      .filter(e => e.status === 'Paid' && e.bank !== 'Cash' && (e.paidAt || e.tanggal) && isSelectedBank(e.bank, selectedBank))
      .map((e, idx) => ({
        id: `ve-${e.id}-${idx}`,
        tanggal: (e.paidAt || e.tanggal).slice(0, 10),
        keterangan: `Tambahan Biaya Proyek — ${e.vendorName}`,
        keteranganDetail: [e.keterangan, e.projectName, e.bank].filter(Boolean).join(' · ') || undefined,
        debit: 0, kredit: e.totalNominal,
        tipe: 'Tambahan Biaya Proyek' as const,
      }))
  , [expenseList, selectedBank]);

  const pcRows = useMemo<MutasiRow[]>(() =>
    (pettyCashList || [])
      .filter(e => e.accountCode === '00000' && e.debit > 0 && e.date &&
        e.sumberDana && e.sumberDana.toLowerCase().includes(selectedBank.toLowerCase()))
      .map((e, idx) => ({
        id: `pc-${e.id}-${idx}`,
        tanggal: e.date,
        keterangan: `Top-Up Kas Kantor — ${e.description}`,
        keteranganDetail: e.sumberDana,
        debit: 0, kredit: e.debit,
        tipe: 'Top-Up Kas Kantor' as const,
      }))
  , [pettyCashList, selectedBank]);

  const pcgRows = useMemo<MutasiRow[]>(() =>
    (pettyCashGudangList || [])
      .filter(e => e.accountCode === '00000' && e.debit > 0 && e.date &&
        e.sumberDana && e.sumberDana.toLowerCase().includes(selectedBank.toLowerCase()))
      .map((e, idx) => ({
        id: `pcg-${e.id}-${idx}`,
        tanggal: e.date,
        keterangan: `Top-Up Kas Gudang — ${e.description}`,
        keteranganDetail: e.sumberDana,
        debit: 0, kredit: e.debit,
        tipe: 'Top-Up Kas Gudang' as const,
      }))
  , [pettyCashGudangList, selectedBank]);

  const payrollRows = useMemo<MutasiRow[]>(() =>
    (payrollRunList || [])
      .filter(r => r.status === 'Disbursed' && isSelectedBank(r.bank, selectedBank) && r.periodLabel)
      .map((r, idx) => ({
        id: `pr-${r.id}-${idx}`,
        tanggal: r.disbursedAt ? r.disbursedAt.slice(0, 10) : r.processedDate.slice(0, 10),
        keterangan: `Payroll ${r.periodLabel} — ${r.employeeCount || 0} karyawan`,
        keteranganDetail: r.bank,
        debit: 0, kredit: r.totalTHP,
        tipe: 'Payroll' as const,
      }))
  , [payrollRunList, selectedBank]);

  const thlPayrollRows = useMemo<MutasiRow[]>(() =>
    (thlPayrollRunList || [])
      .filter(r => r.status === 'Disbursed' && isSelectedBank(r.bank, selectedBank) && r.periodLabel)
      .map((r, idx) => ({
        id: `thl-${r.id}-${idx}`,
        tanggal: r.disbursedAt ? r.disbursedAt.slice(0, 10) : r.createdAt.slice(0, 10),
        keterangan: `Gaji THL ${r.periodLabel} — ${r.thlCount} orang`,
        keteranganDetail: r.bank,
        debit: 0, kredit: r.totalNetto,
        tipe: 'Gaji THL' as const,
      }))
  , [thlPayrollRunList, selectedBank]);

  const manualRows = useMemo<MutasiRow[]>(() =>
    (bankManualEntryList || [])
      .filter(e => isSelectedBank(e.bank, selectedBank))
      .map(e => ({
        id: `bme-${e.id}`,
        tanggal: e.tanggal,
        keterangan: e.keterangan,
        keteranganDetail: e.notes,
        debit:  e.tipe === 'Masuk'  ? e.amount : 0,
        kredit: e.tipe === 'Keluar' ? e.amount : 0,
        tipe: (e.tipe === 'Masuk' ? 'Setoran Bank' : 'Penarikan Bank') as MutasiRow['tipe'],
        manualId: e.id,
      }))
  , [bankManualEntryList, selectedBank]);

  const periodRows = useMemo(() =>
    [...arRows, ...apRows, ...vendorExpenseRows, ...pcRows, ...pcgRows, ...payrollRows, ...thlPayrollRows, ...manualRows]
      .filter(r => r.tanggal.startsWith(selectedPeriod))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  , [arRows, apRows, vendorExpenseRows, pcRows, pcgRows, payrollRows, thlPayrollRows, manualRows, selectedPeriod]);

  const rowsWithSaldo = useMemo(() => {
    let saldo = saldoAwal;
    return periodRows.map(r => { saldo += r.debit - r.kredit; return { ...r, saldo }; });
  }, [periodRows, saldoAwal]);

  const filtered = useMemo(() =>
    rowsWithSaldo.filter(r => {
      if (filterTipe === 'in' && r.debit === 0) return false;
      if (filterTipe === 'out' && r.kredit === 0) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (![r.keterangan, r.keteranganDetail].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
      }
      return true;
    })
  , [rowsWithSaldo, filterTipe, searchTerm]);

  const stats = useMemo(() => {
    const totalDebit = periodRows.reduce((s, r) => s + r.debit, 0);
    const totalKredit = periodRows.reduce((s, r) => s + r.kredit, 0);
    const saldoAkhir = saldoAwal + totalDebit - totalKredit;
    return { totalDebit, totalKredit, saldoAkhir };
  }, [periodRows, saldoAwal]);

  const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString('id-ID')}`;
  const net = stats.saldoAkhir - saldoAwal;

  const tipeBadge: Record<string, string> = {
    'Penerimaan AR':     'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Pembayaran AP':     'bg-rose-50 text-rose-600 border-rose-100',
    'Top-Up Kas Gudang': 'bg-amber-50 text-amber-600 border-amber-100',
    'Top-Up Kas Kantor': 'bg-sky-50 text-sky-600 border-sky-100',
    'Biaya Kerja':       'bg-purple-50 text-purple-600 border-purple-100',
    'Tambahan Biaya Proyek': 'bg-orange-50 text-orange-600 border-orange-100',
    'Payroll':           'bg-indigo-50 text-indigo-600 border-indigo-100',
    'Gaji THL':          'bg-violet-50 text-violet-600 border-violet-100',
    'Setoran Bank':      'bg-teal-50 text-teal-600 border-teal-100',
    'Penarikan Bank':    'bg-pink-50 text-pink-600 border-pink-100',
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-[#F8FAFC] min-h-screen">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-200">Financial Ledger</span>
            <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Bank Reconciliation</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Landmark className="text-indigo-600" size={32} />
            Rekonsiliasi Bank
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Mutasi rekening otomatis dari AR, AP, Payroll &amp; Petty Cash</p>
        </div>

        {/* Period selector only */}
        <div className="relative flex items-center gap-2 bg-white border-2 border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
          <Calendar size={15} className="text-slate-400 shrink-0" />
          <input
            type="month"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-700 outline-none"
          />
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Saldo Awal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Landmark size={80} className="text-indigo-600" />
          </div>
          <div className="flex items-start justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Banknote size={12} /> Saldo Awal
            </p>
            <button
              onClick={openSaldoModal}
              className="w-7 h-7 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all"
              title="Edit saldo awal"
            >
              <Pencil size={12} />
            </button>
          </div>
          {saldoAwal > 0
            ? <h3 className="text-2xl font-black italic text-slate-900 tracking-tight">{fmt(saldoAwal)}</h3>
            : <h3 className="text-sm font-bold text-slate-400 italic mt-2">Belum diset</h3>}
          <p className="text-[9px] text-slate-400 mt-3 font-medium">{BANK_LABELS[selectedBank] || selectedBank}</p>
        </motion.div>

        {/* Total Masuk */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group bg-gradient-to-br from-white to-emerald-50/30"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <ArrowDownRight size={80} className="text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <ArrowDownRight size={12} /> Total Masuk
          </p>
          <h3 className="text-2xl font-black italic text-emerald-600 tracking-tight">{fmt(stats.totalDebit)}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">
            {arRows.filter(r => r.tanggal.startsWith(selectedPeriod)).length} transaksi periode ini
          </p>
        </motion.div>

        {/* Total Keluar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[2.5rem] border border-red-100 shadow-sm relative overflow-hidden group bg-gradient-to-br from-white to-red-50/30"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <ArrowUpRight size={80} className="text-red-500" />
          </div>
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <ArrowUpRight size={12} /> Total Keluar
          </p>
          <h3 className="text-2xl font-black italic text-red-600 tracking-tight">{fmt(stats.totalKredit)}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">
            {periodRows.filter(r => r.kredit > 0).length} transaksi keluar
          </p>
        </motion.div>

        {/* Saldo Akhir */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            {net >= 0
              ? <TrendingUp size={80} className="text-sky-500" />
              : <TrendingDown size={80} className="text-rose-500" />}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            {net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} Saldo Akhir
          </p>
          <h3 className={`text-2xl font-black italic tracking-tight ${stats.saldoAkhir < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {fmt(stats.saldoAkhir)}
          </h3>
          <div className={`mt-4 text-[10px] font-bold uppercase italic ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {net >= 0 ? '+' : ''}{fmt(net)} vs saldo awal
          </div>
        </motion.div>
      </div>

      {/* ── MAIN TABLE SECTION ── */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1 flex-wrap">
            {/* Bank selector */}
            <div className="relative flex items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3">
              <CreditCard size={14} className="text-indigo-400 shrink-0" />
              <select
                value={selectedBank}
                onChange={e => setSelectedBank(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none appearance-none pr-5"
              >
                {bankOptions.map(b => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Search */}
            <div className="relative min-w-[240px] flex-1">
              <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari keterangan transaksi..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-slate-100 focus:border-indigo-300 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            {(['all', 'in', 'out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterTipe(t)}
                className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  filterTipe === t
                    ? t === 'in'  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : t === 'out' ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-100'
                    : 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-700 hover:border-slate-200'
                }`}
              >
                {t === 'all' ? 'Semua' : t === 'in' ? '↓ Masuk' : '↑ Keluar'}
              </button>
            ))}
            <div className="px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest self-center whitespace-nowrap">
              {filtered.length} baris
            </div>
            <button
              onClick={openTopUpModal}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 border-2 border-indigo-600"
            >
              <Plus size={14} /> Top Up
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (Masuk)</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Kredit (Keluar)</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building2 size={24} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-wide">Tidak ada mutasi</p>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      {arRows.length + apRows.length === 0
                        ? 'Catat pembayaran AR/AP via Transfer terlebih dahulu'
                        : `Ganti filter — ada ${periodRows.length} transaksi di periode ini`}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="px-10 py-8">
                      <span className="text-sm font-black text-slate-800 tabular-nums">
                        {new Date(row.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wide">{row.tanggal.slice(0, 4)}</p>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-stretch gap-3 min-w-0">
                        <div className={`w-1 rounded-full shrink-0 ${row.debit > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <div className="min-w-0">
                          <div className="mb-1.5">
                            <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${tipeBadge[row.tipe] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              {row.tipe}
                            </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight truncate">{row.keterangan}</p>
                          {row.keteranganDetail && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate max-w-[320px]">{row.keteranganDetail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <span className="text-xs font-black text-slate-500 whitespace-nowrap">{selectedBank}</span>
                    </td>
                    <td className="px-10 py-8 text-right">
                      {row.debit > 0 ? (
                        <div>
                          <span className="text-sm font-black text-emerald-600 tabular-nums">{fmt(row.debit)}</span>
                          <p className="text-[9px] text-emerald-400 font-bold uppercase mt-0.5">Masuk</p>
                        </div>
                      ) : <span className="text-slate-200 text-lg">—</span>}
                    </td>
                    <td className="px-10 py-8 text-right">
                      {row.kredit > 0 ? (
                        <div>
                          <span className="text-sm font-black text-rose-600 tabular-nums">{fmt(row.kredit)}</span>
                          <p className="text-[9px] text-rose-400 font-bold uppercase mt-0.5">Keluar</p>
                        </div>
                      ) : <span className="text-slate-200 text-lg">—</span>}
                    </td>
                    <td className="px-10 py-8 text-right">
                      <span className={`text-sm font-black tabular-nums ${(row as any).saldo < 0 ? 'text-rose-500' : 'text-slate-900'}`}>
                        {fmt((row as any).saldo)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="px-10 py-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Periode {selectedPeriod}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-sm font-black text-emerald-600 tabular-nums">{fmt(stats.totalDebit)}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-sm font-black text-rose-600 tabular-nums">{fmt(stats.totalKredit)}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className={`text-sm font-black tabular-nums ${stats.saldoAkhir < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {fmt(stats.saldoAkhir)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 font-medium text-center pb-4">
        Transaksi Cash tidak ditampilkan · Sumber: AR, AP, Tambahan Biaya Proyek, Petty Cash Top-Up, Mutasi Manual
      </p>

      {/* ── CATAT MUTASI MANUAL MODAL ── */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden"
          >
            <form onSubmit={handleSubmitTopUp}>
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-7 pt-7 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center rotate-3">
                      <RefreshCw size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white leading-tight">Top Up</h3>
                      <p className="text-indigo-200 text-[10px] font-bold mt-0.5 uppercase tracking-widest">
                        {BANK_LABELS[selectedBank] || selectedBank}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowTopUpModal(false)}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="px-7 py-6 space-y-5">
                {/* Tipe toggle */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Jenis Mutasi</label>
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                    {(['Masuk', 'Keluar'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setTopUpForm(f => ({...f, tipe: t}))}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                          topUpForm.tipe === t
                            ? t === 'Masuk'
                              ? 'bg-white text-emerald-600 shadow-sm'
                              : 'bg-white text-rose-600 shadow-sm'
                            : 'text-slate-400'
                        }`}
                      >
                        {t === 'Masuk' ? 'Debit' : 'Kredit'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date + keterangan */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tanggal</label>
                    <input type="date" required value={topUpForm.tanggal}
                      onChange={e => setTopUpForm(f => ({...f, tanggal: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Bank</label>
                    <div className="relative">
                      <Landmark size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                      <select
                        value={topUpForm.bank}
                        onChange={e => setTopUpForm(f => ({...f, bank: e.target.value, bankCustom: ''}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all appearance-none"
                      >
                        {bankOptions.map(b => <option key={b}>{b}</option>)}
                        <option value="Lainnya">Lainnya...</option>
                      </select>
                    </div>
                  </div>
                </div>

                {topUpForm.bank === 'Lainnya' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Nama Bank Lainnya</label>
                    <input type="text" required={topUpForm.bank === 'Lainnya'} autoFocus
                      placeholder="Contoh: Bank Muamalat, OCBC..."
                      value={topUpForm.bankCustom}
                      onChange={e => setTopUpForm(f => ({...f, bankCustom: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Keterangan Transaksi</label>
                  <input type="text" required placeholder="Contoh: Setoran modal dari owner..."
                    value={topUpForm.keterangan}
                    onChange={e => setTopUpForm(f => ({...f, keterangan: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Nominal (IDR)
                  </label>
                  <div className={`flex items-center rounded-2xl px-4 py-3 gap-2 border-2 focus-within:border-indigo-400 transition-all ${
                    topUpForm.tipe === 'Masuk' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                  }`}>
                    <span className={`text-sm font-black shrink-0 ${topUpForm.tipe === 'Masuk' ? 'text-emerald-500' : 'text-rose-500'}`}>Rp</span>
                    <input type="text" inputMode="numeric" required
                      placeholder="0"
                      value={topUpForm.amount ? Number(topUpForm.amount.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                      onChange={e => setTopUpForm(f => ({...f, amount: e.target.value.replace(/\D/g, '')}))}
                      className="flex-1 bg-transparent text-xl font-black outline-none min-w-0 placeholder:text-slate-300 text-slate-800" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Catatan <span className="font-medium normal-case text-slate-300">(opsional)</span></label>
                  <textarea placeholder="Catatan tambahan..." rows={2}
                    value={topUpForm.notes}
                    onChange={e => setTopUpForm(f => ({...f, notes: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all resize-none placeholder:text-slate-300" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowTopUpModal(false)}
                    className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50 transition-all">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmittingTopUp}
                    className={`flex-[2] py-4 rounded-2xl text-white text-sm font-black transition-all shadow-lg flex items-center justify-center gap-2 ${
                      topUpForm.tipe === 'Masuk'
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                    }`}>
                    {isSubmittingTopUp
                      ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      : <RefreshCw size={16} />}
                    Simpan Mutasi
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── SET SALDO AWAL MODAL ── */}
      {showSaldoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden">

            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-7 pt-7 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Banknote size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">Formulir Saldo Awal</h3>
                    <p className="text-indigo-200 text-[11px] font-bold mt-0.5">Posisi rekening sebelum periode sistem</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaldoModal(false)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            <div className="px-7 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={saldoTanggal}
                    onChange={e => setSaldoTanggal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Prioritas</label>
                  <div className="flex gap-2">
                    {(['Normal', 'Urgent'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setSaldoPrioritas(p)}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wide transition-all border-2 ${
                          saldoPrioritas === p
                            ? p === 'Urgent'
                              ? 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-100'
                              : 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {p === 'Urgent' && <AlertCircle size={11} className="inline mr-1 -mt-px" />}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Bank Sumber Dana</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedBank}
                    onChange={e => setSelectedBank(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all appearance-none"
                  >
                    {BANKS.map(b => (
                      <option key={b} value={b}>{BANK_LABELS[b] || `${b} PT Gema Teknik Perkasa`}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nominal Saldo Awal (IDR)</label>
                <div className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 gap-2 focus-within:border-indigo-400 transition-all">
                  <span className="text-sm font-black text-slate-400 shrink-0">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={saldoInput ? Number(saldoInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                    onChange={e => setSaldoInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleSetSaldo()}
                    placeholder="0"
                    autoFocus
                    className="flex-1 bg-transparent text-xl font-black text-slate-800 outline-none min-w-0 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Catatan / Keterangan</label>
                <textarea
                  value={saldoCatatan}
                  onChange={e => setSaldoCatatan(e.target.value)}
                  placeholder="Contoh: Saldo awal rekening per periode Agustus 2026..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all resize-none placeholder:text-slate-300"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowSaldoModal(false)}
                  className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSetSaldo}
                  disabled={isSubmittingSaldo}
                  className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingSaldo ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
