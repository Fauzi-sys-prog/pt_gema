import React, { useState, useMemo } from 'react';
import { Search, Download, Plus, Wallet, Calendar, ChevronRight, Receipt, ArrowUpRight, ArrowDownLeft, BookOpen, X, FileText, CreditCard, CheckCircle2, RefreshCw } from 'lucide-react'; import { motion, AnimatePresence } from 'motion/react'; import { toast } from 'sonner@2.0.3';  interface PettyCashEntry {   id: string;   date: string;   accountCode: string;   description: string;   debit: number;   credit: number;   balance: number; }  interface AccountSummary {   code: string;   name: string; }  import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';

export default function PettyCashPage() {
  const { archiveRegistry, addAuditLog, currentUser } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [serverArchive, setServerArchive] = useState<any[]>([]);
  const [serverSummary, setServerSummary] = useState<{
    totalDebit: number;
    totalCredit: number;
    endingBalance: number;
    transactionCount: number;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial operating balance
  const initialBalance = 1072706499.94;

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    accountCode: '',
    description: '',
    type: 'Credit' as 'Debit' | 'Credit',
    amount: 0
  });

  const [topUpRequest, setTopUpRequest] = useState({
    amount: 0,
    notes: '',
    priority: 'Normal' as 'Normal' | 'Urgent'
  });

  const accountList: AccountSummary[] = [
    { code: '13301', name: 'Piutang Karyawan' },
    { code: '13302', name: 'Uang Muka Project' },
    { code: '21010', name: 'Hutang Gaji Karyawan Tetap' },
    { code: '21020', name: 'Hutang Gaji Karyawan Freelance' },
    { code: '21030', name: 'Hutang Overtime Project' },
    { code: '50001', name: 'Beban Marketing Fee' },
    { code: '50002', name: 'Beban Pembelian dan Pemeliharaan Alat' },
    { code: '51001', name: 'Beban Material Project' },
    { code: '51004', name: 'Beban Pelatihan Karyawan' },
    { code: '51005', name: 'Beban Listrik, Air dan Telepon' },
    { code: '51006', name: 'Beban Perbaikan dan Pemeliharaan Mobil Kantor' },
    { code: '00000', name: 'Penerimaan Kas (Bank Refill)' },
  ];

  const parsePettyMeta = (source?: string) => {
    if (!source) return { accountCode: "00000", direction: "credit" as "debit" | "credit" };
    const parts = source.split("|");
    const map = Object.fromEntries(
      parts.slice(1).map((part) => part.split("=")).filter((p) => p.length === 2),
    );
    return {
      accountCode: map.accountCode || "00000",
      direction: map.direction === "debit" ? "debit" as const : "credit" as const,
    };
  };

  const fetchPettyCashData = async (silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const [summaryRes, res] = await Promise.all([
        api.get<{
          summary?: {
            totalDebit?: number;
            totalCredit?: number;
            endingBalance?: number;
            transactionCount?: number;
          };
        }>('/dashboard/finance-petty-cash-summary'),
        api.get<any[]>('/finance/petty-cash-transactions'),
      ]);
      setServerArchive((res.data || []).map((row: any) => ({ id: row.id, ...row })));
      if (summaryRes.data?.summary) {
        setServerSummary({
          totalDebit: Number(summaryRes.data.summary.totalDebit || 0),
          totalCredit: Number(summaryRes.data.summary.totalCredit || 0),
          endingBalance: Number(summaryRes.data.summary.endingBalance || 0),
          transactionCount: Number(summaryRes.data.summary.transactionCount || 0),
        });
      } else {
        setServerSummary(null);
      }
      if (!silent) toast.success('Petty cash data berhasil disinkronkan.');
    } catch {
      setServerSummary(null);
      if (!silent) toast.error('Gagal refresh petty cash data.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  React.useEffect(() => {
    fetchPettyCashData(true);
  }, []);

  const liveArchiveRegistry = serverArchive.length > 0 ? serverArchive : archiveRegistry;

  const entries = useMemo<PettyCashEntry[]>(() => {
    const pettyRows = liveArchiveRegistry
      .filter((row) => row.type === "PETTY")
      .sort((a, b) => a.date.localeCompare(b.date));

    let running = initialBalance;
    return pettyRows.map((row) => {
      const meta = parsePettyMeta(row.source);
      const debit = meta.direction === "debit" ? row.amount : 0;
      const credit = meta.direction === "credit" ? row.amount : 0;
      running = running + debit - credit;
      return {
        id: row.id,
        date: row.date,
        accountCode: meta.accountCode,
        description: row.description,
        debit,
        credit,
        balance: running,
      };
    });
  }, [liveArchiveRegistry]);

  const handleSaveTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpRequest.amount <= 0) {
      toast.error("Nominal top-up harus lebih dari 0");
      return;
    }
    setIsSubmitting(true);

    const date = new Date().toISOString().split("T")[0];
    const txId = `PTTY-${Date.now()}`;
    const payload = {
      id: txId,
      date,
      ref: `PC-TOPUP-${Date.now().toString().slice(-6)}`,
      description: `Top-up kas kecil (${topUpRequest.priority}) - ${topUpRequest.notes}`,
      amount: topUpRequest.amount,
      project: "General/PettyCash",
      admin: currentUser?.fullName || currentUser?.username || "Finance Admin",
      type: "PETTY",
      source: `petty|accountCode=00000|direction=debit|kind=topup`,
    };
    api.post('/finance/petty-cash-transactions', payload)
      .then(() => {
        setServerArchive((prev) => [{ id: txId, ...payload }, ...prev]);
      })
      .catch(() => {
        toast.error("Gagal simpan transaksi top-up ke database");
      });
    addAuditLog({
      action: "PETTY_TOPUP_REQUESTED",
      module: "Finance",
      details: `Top-up petty cash diajukan sebesar ${formatCurrency(topUpRequest.amount)}`,
      status: "Success",
    });

    toast.success("Permintaan Top-Up Kas Kecil telah diajukan ke Direksi", {
      description: `Nominal: ${formatCurrency(topUpRequest.amount)}`,
    });
    setShowTopUpModal(false);
    setIsSubmitting(false);
    setTopUpRequest({ amount: 0, notes: '', priority: 'Normal' });
  };

  const effectiveTotals = useMemo(
    () => ({
      debit: Number(serverSummary?.totalDebit ?? 0),
      credit: Number(serverSummary?.totalCredit ?? 0),
      lastBalance:
        serverSummary && Number.isFinite(serverSummary.endingBalance)
          ? initialBalance + Number(serverSummary.endingBalance)
          : initialBalance,
    }),
    [initialBalance, serverSummary]
  );

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTransaction.amount <= 0) {
      toast.error("Nominal transaksi harus lebih dari 0");
      return;
    }
    setIsSubmitting(true);

    const txId = `PTTY-${Date.now()}`;
    const payload = {
      id: txId,
      date: newTransaction.date,
      ref: `PC-${newTransaction.accountCode}-${Date.now().toString().slice(-4)}`,
      description: newTransaction.description,
      amount: newTransaction.amount,
      project: 'General/PettyCash',
      admin: currentUser?.fullName || currentUser?.username || 'Finance Admin',
      type: 'PETTY',
      source: `petty|accountCode=${newTransaction.accountCode}|direction=${newTransaction.type === "Debit" ? "debit" : "credit"}|kind=transaction`,
    };
    api.post('/finance/petty-cash-transactions', payload)
      .then(() => {
        setServerArchive((prev) => [{ id: txId, ...payload }, ...prev]);
      })
      .catch(() => {
        toast.error("Gagal simpan transaksi kas kecil ke database");
      });
    addAuditLog({
      action: "PETTY_TRANSACTION_CREATED",
      module: "Finance",
      details: `Transaksi petty cash ${newTransaction.type} ${formatCurrency(newTransaction.amount)} pada akun ${newTransaction.accountCode}`,
      status: "Success",
    });

    setShowInputModal(false);
    setIsSubmitting(false);
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      accountCode: '',
      description: '',
      type: 'Credit',
      amount: 0
    });
    toast.success("Transaksi kas kecil berhasil dicatat");
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
  };

  const filteredEntries = entries.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.accountCode.includes(searchTerm)
  );

  const handlePrintReport = () => {
    addAuditLog({
      action: "PETTY_REPORT_PRINTED",
      module: "Finance",
      details: `Cetak laporan petty cash (${filteredEntries.length} baris)`,
      status: "Success",
    });
    window.print();
    toast.success("Mode cetak laporan petty cash dibuka.");
  };

  return (
    <div className="space-y-6 pb-12 px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-blue-200">Financial Ops</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Petty Cash Ledger</span>
           </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Wallet className="text-blue-600" size={32} />
            Kas Kecil (Petty Cash)
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-1">
            Periode Januari 2026 - Laporan Pertanggungjawaban
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPettyCashData(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 shadow-sm transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
          <button onClick={handlePrintReport} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 shadow-sm transition-all text-[10px] font-black uppercase tracking-widest">
            <Download size={18} />
            <span>Cetak Laporan</span>
          </button>
          <button 
            onClick={() => setShowInputModal(true)}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Plus size={18} />
            <span>Input Transaksi</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Saldo Awal</div>
          <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(initialBalance)}</div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Masuk</div>
          <div className="flex items-center gap-3">
             <ArrowDownLeft size={20} className="text-emerald-500" />
             <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(effectiveTotals.debit)}</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Keluar</div>
          <div className="flex items-center gap-3">
             <ArrowUpRight size={20} className="text-rose-500" />
             <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(effectiveTotals.credit)}</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Wallet size={80} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Saldo Berjalan</div>
            <div className="text-3xl font-black text-white italic tracking-tighter">
              {formatCurrency(effectiveTotals.lastBalance)}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Journal Table */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Cari transaksi atau kode akun..." 
                className="w-full pl-16 pr-8 py-4 bg-slate-50 border-none rounded-[1.5rem] text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="px-8 py-4 bg-slate-50 border-none rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
              <option>Semua Akun</option>
              {accountList.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-slate-300">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Tanggal</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Akun</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Keterangan</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Debit</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Kredit</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest border-b border-slate-800 bg-slate-800">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6 text-xs font-black text-slate-500 italic uppercase">{entry.date}</td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">{entry.accountCode}</span>
                      </td>
                      <td className="px-8 py-6 text-sm font-black text-slate-900 italic uppercase tracking-tight">{entry.description}</td>
                      <td className={`px-8 py-6 text-right text-sm font-black italic ${entry.debit > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className={`px-8 py-6 text-right text-sm font-black italic ${entry.credit > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className="px-8 py-6 text-right text-sm font-black text-slate-900 bg-slate-50/30 italic">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Info: Chart of Accounts */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm sticky top-6">
            <h3 className="text-slate-900 font-black uppercase italic text-[10px] tracking-widest mb-6 flex items-center gap-3">
              <BookOpen size={18} className="text-blue-600" />
              Daftar Akun Petty Cash
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {accountList.map((acc) => (
                <div key={acc.code} className="flex flex-col p-4 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                  <span className="text-[10px] font-black text-blue-600 tracking-tighter group-hover:scale-105 origin-left transition-transform">{acc.code}</span>
                  <span className="text-[11px] font-black text-slate-700 leading-tight uppercase italic">{acc.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
             <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Receipt size={24} />
                   </div>
                   <h4 className="font-black uppercase italic text-[10px] tracking-widest">Informasi Re-Fill</h4>
                </div>
                <p className="text-[11px] font-bold opacity-80 leading-relaxed italic">
                   Pengisian kembali kas kecil dilakukan setiap saldo mencapai minimum Rp 5.000.000,- atau setiap akhir bulan berjalan.
                </p>
                <button 
                  onClick={() => setShowTopUpModal(true)}
                  className="mt-8 w-full py-4 bg-white text-blue-600 rounded-[1.25rem] font-black text-[10px] uppercase shadow-xl hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                   Ajukan Pengisian (Top-Up)
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Input Transaction Modal */}
      <AnimatePresence>
        {showInputModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveTransaction}>
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-3">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Pencatatan Transaksi Kas</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Update pengeluaran atau pemasukan kas kecil</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowInputModal(false)} className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-100">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Transaksi</label>
                      <div className="relative">
                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                          type="date" 
                          required
                          value={newTransaction.date}
                          onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                          className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Mutasi</label>
                      <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                        <button 
                          type="button"
                          onClick={() => setNewTransaction({...newTransaction, type: 'Credit'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newTransaction.type === 'Credit' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Keluar (Credit)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewTransaction({...newTransaction, type: 'Debit'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newTransaction.type === 'Debit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          Masuk (Debit)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori Akun</label>
                    <select 
                      required
                      value={newTransaction.accountCode}
                      onChange={(e) => setNewTransaction({...newTransaction, accountCode: e.target.value})}
                      className="w-full px-8 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                    >
                      <option value="">Pilih Kode Akun</option>
                      {accountList.map(acc => (
                        <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan Transaksi</label>
                    <textarea 
                      required
                      placeholder="Contoh: Pembelian materai untuk kontrak project..."
                      rows={3}
                      value={newTransaction.description}
                      onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                      className="w-full px-8 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal (IDR)</label>
                    <div className="relative">
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black italic text-slate-400">Rp</span>
                      <input 
                        type="number" 
                        required
                        placeholder="0"
                        value={Number.isNaN(newTransaction.amount) ? '' : newTransaction.amount}
                        onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                        className="w-full pl-20 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all" 
                      />
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowInputModal(false)}
                    className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    ) : <CheckCircle2 size={18} />}
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Up Request Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSaveTopUp}>
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-blue-600">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white text-blue-600 rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                      <RefreshCw size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Formulir Top-Up Kas</h3>
                      <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest mt-2">Permintaan dana operasional lapangan</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowTopUpModal(false)} className="p-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl transition-all border border-blue-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioritas Permintaan</label>
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setTopUpRequest({...topUpRequest, priority: 'Normal'})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topUpRequest.priority === 'Normal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Normal
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTopUpRequest({...topUpRequest, priority: 'Urgent'})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topUpRequest.priority === 'Urgent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Urgent
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal Top-Up (IDR)</label>
                    <div className="relative">
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black italic text-slate-400">Rp</span>
                      <input 
                        type="number" 
                        required
                        placeholder="0"
                        value={Number.isNaN(topUpRequest.amount) ? '' : topUpRequest.amount}
                        onChange={(e) => setTopUpRequest({...topUpRequest, amount: Number(e.target.value)})}
                        className="w-full pl-20 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan / Alasan Pengisian</label>
                    <textarea 
                      required
                      placeholder="Contoh: Saldo menipis untuk persiapan project Cikande minggu depan..."
                      rows={3}
                      value={topUpRequest.notes}
                      onChange={(e) => setTopUpRequest({...topUpRequest, notes: e.target.value})}
                      className="w-full px-8 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="p-10 bg-slate-50 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    ) : <ArrowUpRight size={18} />}
                    Ajukan Dana
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
