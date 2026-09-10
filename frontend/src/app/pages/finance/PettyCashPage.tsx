import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Plus, 
  Wallet, 
  Calendar,
  ChevronRight,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  X,
  FileText,
  CreditCard,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface PettyCashEntry {
  id: string;
  date: string;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  kasir?: string;
  sumberDana?: string;
}

interface AccountSummary {
  code: string;
  name: string;
}

import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function PettyCashPage() {
  const { addArchiveEntry, pettyCashList, addPettyCashEntry, topUpRequestList, addTopUpRequest, approveTopUpRequest, rejectTopUpRequest, payrollRunList, thlPayrollRunList } = useApp();
  const { currentUser } = useAuth();
  // Temporary: all authenticated roles may approve top-ups. Reinstate role policy later.
  const isManager = true;
  const pendingTopUps = topUpRequestList.filter(r => r.status === 'Pending');
  const [selectedPeriod, setSelectedPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccountCode, setFilterAccountCode] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialBalance = 0; // replaced by computedInitialBalance below

  // Payroll & Gaji THL disbursed otomatis dicatat sebagai kredit kas kecil
  const payrollCreditEntries = useMemo<PettyCashEntry[]>(() => {
    const payrollRows: PettyCashEntry[] = (payrollRunList || [])
      .filter(r => r.status === 'Disbursed')
      .map((r, idx) => ({
        id: `pr-${r.id}-${idx}`,
        date: (r.disbursedAt || r.processedDate).slice(0, 10),
        accountCode: '61001',
        description: `Payroll ${r.periodLabel} — ${r.employeeCount || 0} karyawan`,
        debit: 0,
        credit: r.totalTHP,
        balance: 0,
        kasir: r.bank,
        sumberDana: r.bank,
      }));
    const thlRows: PettyCashEntry[] = (thlPayrollRunList || [])
      .filter(r => r.status === 'Disbursed')
      .map((r, idx) => ({
        id: `thl-${r.id}-${idx}`,
        date: (r.disbursedAt || r.createdAt).slice(0, 10),
        accountCode: '51002',
        description: `Gaji THL ${r.periodLabel} — ${r.thlCount} orang`,
        debit: 0,
        credit: r.totalNetto,
        balance: 0,
        kasir: r.bank,
        sumberDana: r.bank,
      }));
    return [...payrollRows, ...thlRows];
  }, [payrollRunList, thlPayrollRunList]);

  // Gabungkan buku kas kecil + kredit payroll, urut tanggal, hitung ulang saldo berjalan
  const entries = useMemo(() => {
    const initial = pettyCashList.length > 0
      ? (pettyCashList[0].balance - (pettyCashList[0].debit || 0) + (pettyCashList[0].credit || 0))
      : 0;
    const merged = [...pettyCashList, ...payrollCreditEntries]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let running = initial;
    return merged.map(e => {
      running += (e.debit || 0) - (e.credit || 0);
      return { ...e, balance: running };
    });
  }, [pettyCashList, payrollCreditEntries]);

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    accountCode: '',
    description: '',
    type: 'Credit' as 'Debit' | 'Credit',
    amount: 0,
    kasir: 'BCA PT Gema Teknik Perkasa',
    sumberDana: '',
  });

  const [topUpRequest, setTopUpRequest] = useState({
    amount: 0,
    notes: '',
    priority: 'Normal' as 'Normal' | 'Urgent',
    bank: 'BCA PT Gema Teknik Perkasa',
    date: new Date().toISOString().split('T')[0],
  });

  useEscapeKey([
    { condition: showInputModal, close: () => setShowInputModal(false) },
    { condition: showTopUpModal, close: () => setShowTopUpModal(false) },
  ]);


  const handleSaveTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpRequest.amount <= 0) return;
    setIsSubmitting(true);
    setTimeout(() => {
      addTopUpRequest({
        date: topUpRequest.date,
        bank: topUpRequest.bank,
        amount: topUpRequest.amount,
        notes: topUpRequest.notes,
        priority: topUpRequest.priority,
        requestedBy: currentUser?.fullName || 'Kasir',
      });
      toast.success('Permintaan Top-Up diajukan', {
        description: 'Menunggu persetujuan Manager / Direksi',
      });
      setShowTopUpModal(false);
      setIsSubmitting(false);
      setTopUpRequest({ amount: 0, notes: '', priority: 'Normal', bank: 'BCA PT Gema Teknik Perkasa', date: new Date().toISOString().split('T')[0] });
    }, 800);
  };

  const totals = useMemo(() => {
    const debit = entries.reduce((sum, e) => sum + e.debit, 0);
    const credit = entries.reduce((sum, e) => sum + e.credit, 0);
    const lastBalance = entries.length > 0 ? entries[entries.length - 1].balance : initialBalance;
    return { debit, credit, lastBalance };
  }, [entries]);

  const accountList: AccountSummary[] = [
    { code: '12001', name: 'Piutang Karyawan' },
    { code: '12002', name: 'Uang Muka Project' },
    { code: '51001', name: 'Beban Material Project' },
    { code: '51002', name: 'Beban Gaji Karyawan Project' },
    { code: '51003', name: 'Beban Overhead Project' },
    { code: '60001', name: 'Beban Marketing Fee' },
    { code: '61001', name: 'Beban Gaji Karyawan Kantor' },
    { code: '61002', name: 'Beban Pelatihan Karyawan' },
    { code: '61003', name: 'Beban Listrik, air dan Telepon' },
    { code: '61004', name: 'Beban Perbaikan dan Pemeliharaan Mobil Kantor' },
    { code: '61005', name: 'Beban Perbaikan dan Pemeliharaan Peralatan Kantor' },
    { code: '61006', name: 'Beban Alat - alat tulis kantor' },
    { code: '61007', name: 'Beban Transport' },
    { code: '61008', name: 'Beban Kesehatan Karyawan' },
    { code: '61009', name: 'Beban Ketenagakerjaan Karyawan' },
    { code: '61010', name: 'Beban Rumah Tangga Kantor' },
    { code: '61011', name: 'Beban Penyusutan' },
    { code: '61012', name: 'Beban Sumbangan' },
    { code: '61013', name: 'Beban Perjalanan Dinas' },
    { code: '61014', name: 'Beban Perijinan' },
    { code: '61015', name: 'Beban Lain - lain' },
    { code: '61016', name: 'Beban Operational Direksi' },
    { code: '61017', name: 'Beban Hutang Pajak' },
    { code: '00000', name: 'Penerimaan Kas (Bank Refill)' },
  ];

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const lastEntry = entries[entries.length - 1];
      const currentBalance = lastEntry ? lastEntry.balance : initialBalance;

      const debitVal = newTransaction.type === 'Debit' ? newTransaction.amount : 0;
      const creditVal = newTransaction.type === 'Credit' ? newTransaction.amount : 0;

      const entryRef = `PC-${newTransaction.accountCode}-${Date.now().toString().slice(-4)}`;

      // Step 1: Add petty cash entry (async — entry not added on failure)
      await addPettyCashEntry({
        date: newTransaction.date,
        accountCode: newTransaction.accountCode,
        description: newTransaction.description,
        debit: debitVal,
        credit: creditVal,
        balance: currentBalance + debitVal - creditVal,
        kasir: newTransaction.kasir,
        sumberDana: newTransaction.type === 'Debit' ? newTransaction.sumberDana : undefined,
      });

      // Step 2: AUTOMATION — Add to Archive Registry
      try {
        addArchiveEntry({
          date: newTransaction.date,
          ref: entryRef,
          description: newTransaction.description,
          amount: newTransaction.amount,
          project: 'General/PettyCash',
          admin: 'Finance Admin',
          type: 'PETTY',
          source: 'Petty Cash Hub'
        });
      } catch (archiveErr) {
        // Rollback: remove the petty cash entry that was just added
        const added = pettyCashList[pettyCashList.length - 1];
        if (added) {
          try {
            const { api } = await import('../../services/api');
            await api.request(`/finance-petty-cash/${encodeURIComponent(added.id)}`, { method: 'DELETE' });
          } catch { /* best-effort rollback */ }
        }
        throw archiveErr;
      }

      setShowInputModal(false);
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        accountCode: '',
        description: '',
        type: 'Credit',
        amount: 0,
        kasir: 'BCA PT Gema Teknik Perkasa',
        sumberDana: '',
      });
      toast.success("Transaksi kas kecil berhasil dicatat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan transaksi kas kecil');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
  };

  const filteredEntries = entries.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.accountCode.includes(searchTerm);
    const matchAccount = !filterAccountCode || e.accountCode === filterAccountCode;
    return matchSearch && matchAccount;
  });

  // Compute initial balance: reverse-engineer from first entry's balance
  const computedInitialBalance = useMemo(() => {
    if (pettyCashList.length === 0) return 0;
    const first = pettyCashList[0];
    return first.balance - (first.debit || 0) + (first.credit || 0);
  }, [pettyCashList]);

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
            Periode November 2025 - Laporan Pertanggungjawaban
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 shadow-sm transition-all text-[10px] font-black uppercase tracking-widest">
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
          <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(computedInitialBalance)}</div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Masuk</div>
          <div className="flex items-center gap-3">
             <ArrowDownLeft size={20} className="text-emerald-500" />
             <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(totals.debit)}</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Keluar</div>
          <div className="flex items-center gap-3">
             <ArrowUpRight size={20} className="text-rose-500" />
             <div className="text-2xl font-black text-slate-900 italic tracking-tight">{formatCurrency(totals.credit)}</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Wallet size={80} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Saldo Berjalan</div>
            <div className="text-3xl font-black text-white italic tracking-tighter">
              {formatCurrency(totals.lastBalance)}
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
            <select
              value={filterAccountCode}
              onChange={e => setFilterAccountCode(e.target.value)}
              className="px-8 py-4 bg-slate-50 border-none rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Akun</option>
              {accountList.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
            </select>
          </div>

          {/* Pending Top-Up Approvals — visible to Manager/Admin/Director */}
          {pendingTopUps.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                  {pendingTopUps.length} Permintaan Top-Up Menunggu Persetujuan
                </p>
              </div>
              {pendingTopUps.map(req => (
                <div key={req.id} className="bg-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-amber-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${req.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{req.priority}</span>
                      <span className="text-sm font-black text-slate-900">Rp {req.amount.toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{req.date} · {req.bank}</p>
                    {req.notes && <p className="text-[10px] text-slate-400 italic">{req.notes}</p>}
                    <p className="text-[9px] text-slate-400">Diajukan oleh: {req.requestedBy}</p>
                  </div>
                  {isManager ? (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => { try { await approveTopUpRequest(req.id, currentUser?.fullName || 'Manager'); toast.success('Top-Up disetujui & dana masuk ke kas kecil'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Persetujuan top-up gagal'); } }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={async () => { try { await rejectTopUpRequest(req.id, 'Ditolak'); toast.error('Permintaan Top-Up ditolak'); } catch (error) { toast.error('Penolakan top-up gagal: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan')); } }}
                        className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-50 transition-all"
                      >
                        Tolak
                      </button>
                    </div>
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-[9px] font-black uppercase">Menunggu Approval</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-slate-300">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Tanggal</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">Bank</th>
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
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${entry.kasir === 'BCA PT Gema Teknik Perkasa' ? 'bg-blue-50 text-blue-700' : entry.kasir === 'BNI' ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {entry.kasir || 'BCA PT Gema Teknik Perkasa'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">{entry.accountCode}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-slate-900 italic uppercase tracking-tight">{entry.description}</div>
                        {entry.sumberDana && (
                          <div className="text-[10px] text-emerald-600 font-bold mt-1">← {entry.sumberDana}</div>
                        )}
                      </td>
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

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank</label>
                      <select
                        value={newTransaction.kasir}
                        onChange={(e) => setNewTransaction({...newTransaction, kasir: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                        <option value="BCA PT Gema Teknik Perkasa">BCA PT Gema Teknik Perkasa</option>
                        <option value="BNI">BNI</option>
                        <option value="Mandiri">Mandiri</option>
                      </select>
                    </div>
                    {newTransaction.type === 'Debit' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sumber Dana</label>
                        <select
                          value={newTransaction.sumberDana}
                          onChange={(e) => setNewTransaction({...newTransaction, sumberDana: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                        >
                          <option value="">Pilih Sumber</option>
                          <option value="Rek Ibu Sri Rahayu (BCA)">Rek Ibu Sri Rahayu (BCA)</option>
                          <option value="Rekening BCA GTP">Rekening BCA GTP</option>
                          <option value="Sisa Kas Project">Sisa Kas Project</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                    )}
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
                        value={newTransaction.amount || ''}
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

      {/* Top Up Request Modal */}
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

                <div className="p-10 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={topUpRequest.date}
                        onChange={(e) => setTopUpRequest({...topUpRequest, date: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioritas</label>
                      <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 h-[54px]">
                        <button
                          type="button"
                          onClick={() => setTopUpRequest({...topUpRequest, priority: 'Normal'})}
                          className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topUpRequest.priority === 'Normal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >Normal</button>
                        <button
                          type="button"
                          onClick={() => setTopUpRequest({...topUpRequest, priority: 'Urgent'})}
                          className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topUpRequest.priority === 'Urgent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                        >Urgent</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Sumber Dana</label>
                    <select
                      required
                      value={topUpRequest.bank}
                      onChange={(e) => setTopUpRequest({...topUpRequest, bank: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                    >
                      <option value="BCA PT Gema Teknik Perkasa">BCA PT Gema Teknik Perkasa</option>
                      <option value="BNI">BNI</option>
                      <option value="Mandiri">Mandiri</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal Top-Up (IDR)</label>
                    <div className="relative">
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black italic text-slate-400">Rp</span>
                      <input
                        type="number"
                        required
                        placeholder="0"
                        value={topUpRequest.amount || ''}
                        onChange={(e) => setTopUpRequest({...topUpRequest, amount: Number(e.target.value)})}
                        className="w-full pl-20 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan / Alasan Pengisian</label>
                    <textarea
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
    </div>
  );
}
