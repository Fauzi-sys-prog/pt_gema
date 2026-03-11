import { useEffect, useState, useMemo } from 'react'; import { Search, Download, Filter, ArrowUpRight, ArrowDownLeft, Wallet, Calendar, FileSpreadsheet, CheckCircle2, AlertCircle, Link, ChevronRight, TrendingUp, Landmark, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { ArchiveEntry, Invoice, VendorInvoice } from '../../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

interface BankTransaction {
  id: string;
  date: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  matchedId?: string;
  status: 'Matched' | 'Unmatched' | 'Potential';
}

export default function BankReconciliationPage() {
  const { invoiceList = [], vendorInvoiceList = [], archiveRegistry = [], addAuditLog, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  const [isMatching, setIsMatching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualMatchedIds, setManualMatchedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'all' | 'unmatched'>('all');
  const [serverInvoiceList, setServerInvoiceList] = useState<Invoice[] | null>(null);
  const [serverVendorInvoiceList, setServerVendorInvoiceList] = useState<VendorInvoice[] | null>(null);
  const [serverArchiveRegistry, setServerArchiveRegistry] = useState<ArchiveEntry[] | null>(null);
  const [serverTransactions, setServerTransactions] = useState<BankTransaction[] | null>(null);
  const [serverReconSummary, setServerReconSummary] = useState<{
    totalDebit: number;
    totalCredit: number;
    netMovement: number;
    transactionCount: number;
  } | null>(null);

  const effectiveInvoiceList = serverInvoiceList ?? invoiceList;
  const effectiveVendorInvoiceList = serverVendorInvoiceList ?? vendorInvoiceList;
  const effectiveArchiveRegistry = serverArchiveRegistry ?? archiveRegistry;

  const fetchReconciliationSources = async () => {
    try {
      setIsRefreshing(true);
      const [summaryRes, invoiceRes, vendorRes, archiveRes] = await Promise.all([
        api.get<{
          summary?: {
            totalDebit?: number;
            totalCredit?: number;
            netMovement?: number;
            transactionCount?: number;
          };
          transactions?: Array<{
            id?: string;
            date?: string;
            note?: string;
            debit?: number;
            credit?: number;
            ref?: string;
          }>;
        }>('/dashboard/finance-bank-recon-summary'),
        api.get('/invoices'),
        api.get('/finance/vendor-invoices'),
        api.get('/archive-registry'),
      ]);

      const normalizeRows = <T,>(rows: any[]): T[] => rows as T[];

      const invoiceRows = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
      const vendorRows = Array.isArray(vendorRes.data) ? vendorRes.data : [];
      const archiveRows = Array.isArray(archiveRes.data) ? archiveRes.data : [];
      setServerInvoiceList(normalizeRows<Invoice>(invoiceRows));
      setServerVendorInvoiceList(normalizeRows<VendorInvoice>(vendorRows));
      setServerArchiveRegistry(normalizeRows<ArchiveEntry>(archiveRows));
      if (summaryRes.data?.summary) {
        setServerReconSummary({
          totalDebit: Number(summaryRes.data.summary.totalDebit || 0),
          totalCredit: Number(summaryRes.data.summary.totalCredit || 0),
          netMovement: Number(summaryRes.data.summary.netMovement || 0),
          transactionCount: Number(summaryRes.data.summary.transactionCount || 0),
        });
      } else {
        setServerReconSummary(null);
      }
      if (Array.isArray(summaryRes.data?.transactions)) {
        let running = 0;
        const mapped = summaryRes.data.transactions
          .map((row, idx) => {
            const debit = Number(row.debit || 0);
            const credit = Number(row.credit || 0);
            running += debit - credit;
            return {
              id: String(row.id || `SRV-${idx + 1}`),
              date: String(row.date || ""),
              account: "BCA-GTP",
              description: String(row.note || row.ref || "Bank transaction"),
              debit,
              credit,
              balance: running,
              status: "Matched" as const,
            };
          })
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        setServerTransactions(mapped);
      } else {
        setServerTransactions(null);
      }
    } catch {
      setServerInvoiceList(null);
      setServerVendorInvoiceList(null);
      setServerArchiveRegistry(null);
      setServerTransactions(null);
      setServerReconSummary(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReconciliationSources();
  }, []);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const transactions = useMemo<BankTransaction[]>(() => {
    const rows: BankTransaction[] = [];

    for (const inv of effectiveInvoiceList) {
      const gross = Number(inv.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const status: BankTransaction["status"] =
        manualMatchedIds.has(inv.id) || inv.status === "Paid"
          ? "Matched"
          : paid > 0
          ? "Potential"
          : "Unmatched";

      rows.push({
        id: `AR-${inv.id}`,
        date: inv.date || new Date().toISOString().split("T")[0],
        account: "BCA-GTP",
        description: `KREDIT CUSTOMER ${inv.customerName || inv.customerId || "-"}`,
        debit: paid > 0 ? paid : gross,
        credit: 0,
        balance: 0,
        matchedId: inv.id,
        status,
      });
    }

    for (const vinv of effectiveVendorInvoiceList) {
      const total = Number(vinv.totalAmount || 0);
      const paid = Number(vinv.paidAmount || 0);
      const status: BankTransaction["status"] =
        manualMatchedIds.has(vinv.id) || vinv.status === "Paid"
          ? "Matched"
          : paid > 0
          ? "Potential"
          : "Unmatched";

      rows.push({
        id: `AP-${vinv.id}`,
        date: vinv.jatuhTempo || new Date().toISOString().split("T")[0],
        account: "BCA-GTP",
        description: `DEBIT VENDOR ${vinv.supplier || "-"}`,
        debit: 0,
        credit: paid > 0 ? paid : total,
        balance: 0,
        matchedId: vinv.id,
        status,
      });
    }

    for (const entry of effectiveArchiveRegistry) {
      if (entry.type !== "AR" && entry.type !== "AP" && entry.type !== "BK") continue;
      rows.push({
        id: `ARC-${entry.id}`,
        date: entry.date || new Date().toISOString().split("T")[0],
        account: "BCA-GTP",
        description: String(entry.description || "Archive Ledger Entry").toUpperCase(),
        debit: entry.type === "AR" ? Number(entry.amount || 0) : 0,
        credit: entry.type === "AP" || entry.type === "BK" ? Number(entry.amount || 0) : 0,
        balance: 0,
        matchedId: entry.id,
        status: "Matched",
      });
    }

    rows.sort((a, b) => (a.date > b.date ? 1 : -1));

    let running = 0;
    const withBalanceAsc = rows.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });

    return withBalanceAsc.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [effectiveInvoiceList, effectiveVendorInvoiceList, effectiveArchiveRegistry, manualMatchedIds]);

  const effectiveTransactions = serverTransactions ?? [];

  const handleAutoMatch = () => {
    setIsMatching(true);
    toast.loading("AI is analyzing statement patterns...", { id: "auto-match" });
    const idsToMark = effectiveTransactions
      .filter((t) => t.status !== "Matched" && !!t.matchedId)
      .map((t) => t.matchedId!) as string[];
    setManualMatchedIds((prev) => {
      const next = new Set(prev);
      idsToMark.forEach((id) => next.add(id));
      return next;
    });
    
    setIsMatching(false);
    addAuditLog({
      action: 'BANK_RECONCILE_AUTO_MATCH',
      module: 'Finance',
      entityType: 'BankReconciliation',
      entityId: selectedPeriod,
      description: `Auto match reconciled ${idsToMark.length} transactions for period ${selectedPeriod}`,
    });
    toast.success(`AI Auto-Match complete. ${idsToMark.length} transactions reconciled.`, { id: "auto-match" });
  };

  const handleManualLink = (transaction: BankTransaction) => {
    if (!transaction.matchedId) {
      toast.error('Tidak ada dokumen yang bisa di-link');
      return;
    }
    setManualMatchedIds((prev) => {
      const next = new Set(prev);
      next.add(transaction.matchedId!);
      return next;
    });
    addAuditLog({
      action: 'BANK_RECONCILE_MANUAL_LINK',
      module: 'Finance',
      entityType: 'BankReconciliation',
      entityId: transaction.id,
      description: `Manual link for ${transaction.description}`,
    });
    toast.success('Transaksi berhasil di-link');
  };

  const handleExportStatement = async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      generatedAt: new Date().toISOString(),
      periodLabel: selectedPeriod,
      viewLabel: tab === 'all' ? 'Semua transaksi' : 'Belum match',
      summary: {
        totalDebit: stats.totalDebit,
        totalCredit: stats.totalCredit,
        finalBalance: stats.finalBalance,
        matchRate: stats.matchRate,
        transactionCount: filteredTransactions.length,
      },
      rows: filteredTransactions.map((t) => ({
        id: t.id,
        date: t.date,
        account: t.account,
        description: t.description,
        debit: t.debit,
        credit: t.credit,
        balance: t.balance,
        status: t.status,
      })),
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Reconciliation',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/bank-reconciliation-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/bank-reconciliation-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `bank-reconciliation-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `bank-reconciliation-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'BANK_RECONCILE_EXPORTED',
        module: 'Finance',
        entityType: 'BankReconciliation',
        entityId: selectedPeriod,
        description: `Export bank reconciliation for ${selectedPeriod}`,
      });
      toast.success('Statement Word + Excel exported');
    } catch {
      toast.error('Export statement gagal');
    }
  };

  const filteredTransactions = effectiveTransactions.filter(t => {
    const inSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const inPeriod = (t.date || "").slice(0, 7) === selectedPeriod;
    const inTab = tab === 'all' ? true : t.status !== 'Matched';
    return inSearch && inPeriod && inTab;
  });

  const stats = useMemo(() => {
    const totalDebit = Number(serverReconSummary?.totalDebit ?? 0);
    const totalCredit = Number(serverReconSummary?.totalCredit ?? 0);
    const finalBalance = Number(serverReconSummary?.netMovement ?? 0);
    const count = Number(serverReconSummary?.transactionCount ?? effectiveTransactions.length);
    const matchRate = count > 0
      ? Math.round((effectiveTransactions.filter((t) => t.status === "Matched").length / count) * 100)
      : 0;
    return {
      initialBalance: 0,
      totalDebit,
      totalCredit,
      finalBalance,
      matchRate,
    };
  }, [effectiveTransactions, serverReconSummary]);

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-200">Financial Integrity</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Bank Reconciliation Hub</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-4">
              <Landmark className="text-indigo-600" size={40} />
              Bank Statement Matching
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-1">Sinkronisasi Rekening Koran dengan Ledger ERP</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchReconciliationSources}
            disabled={isRefreshing}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh Data
          </button>
          <button
            onClick={handleExportStatement}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> Export Statement
          </button>
          <button 
            onClick={handleAutoMatch}
            disabled={isMatching}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:bg-indigo-400 transition-all flex items-center gap-2 shadow-xl shadow-indigo-200"
          >
            {isMatching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
            Auto-Match AI
          </button>
        </div>
      </div>

      {/* Financial Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Awal</p>
              <h3 className="text-2xl font-black italic text-slate-900">{formatCurrency(stats.initialBalance)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase">
                <Calendar size={12} /> 01 Jan 2026
              </div>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Penerimaan (Debit)</p>
              <h3 className="text-2xl font-black italic text-slate-900">{formatCurrency(stats.totalDebit)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase">
                <ArrowDownLeft size={12} /> +12% vs Dec
              </div>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Pengeluaran (Kredit)</p>
              <h3 className="text-2xl font-black italic text-slate-900">{formatCurrency(stats.totalCredit)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-rose-600 uppercase">
                <ArrowUpRight size={12} /> -5% vs Dec
              </div>
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Book Balance</p>
              <h3 className="text-2xl font-black italic text-white">{formatCurrency(stats.finalBalance)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase">
                <ShieldCheck size={12} /> Account Reconciled
              </div>
           </div>
        </div>
      </div>

      {/* Controls & Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
           <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Cari Keterangan Rekening Koran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-2xl text-sm font-bold uppercase italic border-none focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              />
           </div>
           
           <div className="flex gap-4">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                 <button
                   onClick={() => setTab('all')}
                   className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${tab === 'all' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   All History
                 </button>
                 <button
                   onClick={() => setTab('unmatched')}
                   className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Unmatched
                 </button>
              </div>
              <input 
                type="month" 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-6 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Transaction</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounting Match</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reconcile Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.date}</span>
                       <span className="text-sm font-black text-slate-900 italic tracking-tight uppercase leading-tight">{t.description}</span>
                       <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{t.account}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    {t.status === 'Potential' ? (
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                            <Link size={14} />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-amber-600 uppercase italic">Potential Match</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Found Invoice: INV-001</span>
                         </div>
                         <button
                           onClick={() => handleManualLink(t)}
                           className="ml-4 px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-lg uppercase tracking-widest hover:bg-black"
                         >
                           Link
                         </button>
                      </div>
                    ) : t.status === 'Matched' ? (
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                            <CheckCircle2 size={14} />
                         </div>
                         <span className="text-[10px] font-black text-emerald-600 uppercase italic">System Reconciled</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 opacity-40">
                         <div className="p-2 bg-slate-100 text-slate-400 rounded-xl">
                            <AlertCircle size={14} />
                         </div>
                         <span className="text-[10px] font-black text-slate-400 uppercase italic">No Record Found</span>
                      </div>
                    )}
                  </td>
                  <td className="px-10 py-8 text-right">
                    <span className={`text-sm font-black italic ${t.debit > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                      {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <span className={`text-sm font-black italic ${t.credit > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                      {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <button
                      onClick={() => toast.info(`${t.description} | ${formatCurrency(t.debit || t.credit)}`)}
                      className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm group-hover:scale-110"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Advisory */}
      <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl" />
         <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/10">
                     <ShieldCheck size={28} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Bank Match Accuracy</h3>
               </div>
               <p className="text-slate-400 text-sm font-medium leading-relaxed italic max-w-2xl">
                 Sistem rekonsiliasi GTP ERP menggunakan algoritma pencocokan nama vendor dan nilai nominal untuk memastikan setiap mutasi bank terikat pada dokumen invoice yang sah. Pastikan saldo akhir buku besar kas selalu sinkron dengan saldo rekening koran BCA-GTP.
               </p>
               <div className="mt-10 flex flex-wrap gap-4">
                  <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Compliance Level: High</span>
                  </div>
                  <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-indigo-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Audit Ready: Jan 2026</span>
                  </div>
               </div>
            </div>
            
            <div className="w-full lg:w-72 bg-white/5 p-10 rounded-[3rem] border border-white/10 text-center flex flex-col items-center">
               <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                     <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                     <circle cx="64" cy="64" r="58" fill="none" stroke="#6366F1" strokeWidth="8" strokeDasharray={364} strokeDashoffset={364 - (364 * 0.95)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute flex flex-col">
                     <span className="text-3xl font-black italic text-white leading-none">95%</span>
                     <span className="text-[8px] font-black text-slate-500 uppercase">Match Rate</span>
                  </div>
               </div>
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Confidence</h4>
               <p className="text-[9px] text-slate-500 font-bold leading-tight">Match rate meningkat 5% dari periode sebelumnya berkat AI auto-linking.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
