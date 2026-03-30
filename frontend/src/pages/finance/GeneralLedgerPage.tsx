import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  Wallet,
  CheckCircle2,
  X,
  Calendar,
  Filter,
  Save,
  Loader2,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import api from "../../services/api";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner@2.0.3";

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
  sourceId: string;
}

const GeneralLedgerTrendChart = lazy(
  () => import("../../components/finance/GeneralLedgerTrendChart"),
);

const chartFallback = (
  <div className="lg:col-span-8 bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm">
    <div className="mb-8 h-5 w-56 rounded-full bg-slate-100" />
    <div className="h-[400px] animate-pulse rounded-[2rem] bg-slate-100" />
  </div>
);

export default function GeneralLedgerPage() {
  const { addAuditLog, currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<"overview" | "income" | "expense">("overview");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCharts, setShowCharts] = useState(false);

  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    category: "Operating",
    debit: 0,
    credit: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [serverSummary, setServerSummary] = useState<{
    journalEntries?: JournalEntry[];
    financialData?: Array<{ month: string; totalIncome: number; totalExpense: number; netProfit: number }>;
    totals?: {
      income: number;
      expense: number;
      net: number;
      health: number;
      receivable: number;
      payable: number;
    };
  } | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const fetchGeneralLedgerSummary = async (silent = true) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<typeof serverSummary>('/dashboard/finance-general-ledger-summary');
      if (data) setServerSummary(data);
      if (!silent) toast.success("General ledger summary refreshed");
    } catch {
      if (!silent) toast.error("Gagal refresh general ledger summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchGeneralLedgerSummary(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowCharts(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const effectiveJournalEntries = serverSummary?.journalEntries || [];

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return effectiveJournalEntries.filter((entry) => {
      const tabMatch =
        activeTab === "overview" ||
        (activeTab === "income" && entry.debit > 0) ||
        (activeTab === "expense" && entry.credit > 0);

      const textMatch =
        entry.reference.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q);

      return tabMatch && textMatch;
    });
  }, [effectiveJournalEntries, activeTab, searchQuery]);

  const localFinancialData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return months
      .map((m, i) => {
        const monthEntries = effectiveJournalEntries.filter((e) => new Date(e.date).getMonth() === i);
        const totalIncome = monthEntries.reduce((sum, e) => sum + e.debit, 0);
        const totalExpense = monthEntries.reduce((sum, e) => sum + e.credit, 0);
        return {
          month: m,
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense,
        };
      })
      .filter((x) => x.totalIncome > 0 || x.totalExpense > 0);
  }, [effectiveJournalEntries]);

  const financialData = serverSummary?.financialData || localFinancialData;

  const localTotals = useMemo(() => {
    const income = effectiveJournalEntries.reduce((s, e) => s + e.debit, 0);
    const expense = effectiveJournalEntries.reduce((s, e) => s + e.credit, 0);
    const net = income - expense;
    const health = income > 0 ? Math.max(0, Math.min(100, (net / income) * 100 + 50)) : 100;

    return {
      income,
      expense,
      net,
      health,
      receivable: 0,
      payable: 0,
    };
  }, [effectiveJournalEntries]);

  const totals = serverSummary?.totals || localTotals;

  const exportCsv = async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      generatedAt: new Date().toISOString(),
      view: activeTab,
      summary: totals,
      rows: filteredEntries.map((e) => ({
        date: e.date,
        reference: e.reference,
        description: e.description,
        category: e.category,
        debit: e.debit,
        credit: e.credit,
        balance: e.balance,
      })),
      generatedBy: currentUser?.fullName || currentUser?.username || "Finance GL",
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post("/exports/general-ledger-report/excel", payload, { responseType: "blob" }),
        api.post("/exports/general-ledger-report/word", payload, { responseType: "blob" }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: "application/vnd.ms-excel" }));
      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `general-ledger-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: "application/msword" }));
      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `general-ledger-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);
      toast.success("General ledger Word + Excel berhasil diekspor.");
    } catch {
      toast.error("Export general ledger gagal.");
    }
  };

  const handleQuickFilterReset = () => {
    setSearchQuery("");
    toast.success("Filter pencarian ledger di-reset.");
  };
  const isEntryAmountInvalid = newEntry.debit <= 0 && newEntry.credit <= 0;

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEntryAmountInvalid) {
      toast.error("Debit atau Credit harus lebih dari 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const year = new Date(newEntry.date).getFullYear();
      const seq = String(effectiveJournalEntries.length + 1).padStart(4, "0");
      const reference = `GJ/${year}/${seq}`;

      const entryId = `GL-${Date.now()}`;
      const payload = {
        id: entryId,
        date: newEntry.date,
        ref: reference,
        description: newEntry.description,
        amount: Math.max(newEntry.debit, newEntry.credit),
        project: "General Ledger",
        admin: currentUser?.fullName || currentUser?.username || "System",
        type: "BK",
        source: `general-ledger|category=${encodeURIComponent(newEntry.category)}|debit=${newEntry.debit}|credit=${newEntry.credit}`,
      };

      await api.post("/archive-registry", payload);

      addAuditLog({
        action: "GL_ENTRY_CREATED",
        module: "Finance",
        details: `Journal ${reference} dibuat oleh ${currentUser?.fullName || currentUser?.username || "System"}`,
        status: "Success",
      });

      setShowAddModal(false);
      setNewEntry({
        date: new Date().toISOString().split("T")[0],
        description: "",
        category: "Operating",
        debit: 0,
        credit: 0,
      });
      await fetchGeneralLedgerSummary(true);
      toast.success("Journal entry recorded & synced to database");
    } catch (err: any) {
      if (!err?.__toastShown) {
        toast.error("Gagal menyimpan journal entry ke database");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">
              Master Ledger
            </span>
            <span className="text-slate-400 font-bold text-xs uppercase italic tracking-wider">
              PT Gema Teknik Perkasa
            </span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Building2 className="text-blue-600" size={36} />
            General Ledger Control
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">
            Pusat Digitalisasi Arus Kas & Verifikasi Transaksi Finansial
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchGeneralLedgerSummary(false)}
            disabled={summaryLoading}
            className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60"
          >
            {summaryLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={exportCsv}
            className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
          >
            <FileSpreadsheet size={18} /> Export Ledger
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all"
          >
            <Plus size={18} /> Add Journal Entry
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleAddEntry}>
                <div className="p-8 border-b-2 border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">
                      New Journal Entry
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Recording Manual Financial Transaction
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Transaction Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="date"
                          required
                          value={newEntry.date}
                          onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                      <select
                        value={newEntry.category}
                        onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                        <option value="Operating">Operating</option>
                        <option value="Investment">Investment</option>
                        <option value="Financing">Financing</option>
                        <option value="Tax">Tax & Duty</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      required
                      placeholder="Enter transaction details..."
                      value={newEntry.description}
                      onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all min-h-[100px] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Debit (Income)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">Rp</span>
                        <input
                          type="number"
                          value={newEntry.debit}
                          onChange={(e) => setNewEntry({ ...newEntry, debit: Number(e.target.value) })}
                          className="w-full pl-12 pr-4 py-4 bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Credit (Expense)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-600 font-bold">Rp</span>
                        <input
                          type="number"
                          value={newEntry.credit}
                          onChange={(e) => setNewEntry({ ...newEntry, credit: Number(e.target.value) })}
                          className="w-full pl-12 pr-4 py-4 bg-rose-50/30 border-2 border-rose-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isEntryAmountInvalid ? "text-rose-500" : "text-emerald-600"}`}>
                    {isEntryAmountInvalid ? "Isi Debit atau Credit lebih dari 0 untuk submit." : "Siap diposting ke ledger."}
                  </p>
                  <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isEntryAmountInvalid}
                    className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Post Entry
                  </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
          { label: "Total Revenue (YTD)", val: formatCurrency(totals.income), icon: TrendingUp, color: "text-emerald-600" },
          { label: "Total Expenses (YTD)", val: formatCurrency(totals.expense), icon: TrendingDown, color: "text-rose-600" },
          { label: "Net Profit (YTD)", val: formatCurrency(totals.net), icon: DollarSign, color: "text-blue-600" },
          { label: "Ledger Health", val: `${Math.round(totals.health)}%`, icon: CheckCircle2, color: "text-emerald-500" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                <stat.icon size={20} />
              </div>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {showCharts ? (
          <Suspense fallback={chartFallback}>
            <GeneralLedgerTrendChart financialData={financialData} />
          </Suspense>
        ) : (
          chartFallback
        )}

        <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet size={120} />
          </div>
          <h3 className="text-sm font-black uppercase italic tracking-widest mb-8 text-blue-400">Current Ledger Balance</h3>
          <div className="space-y-8 relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Net Position</p>
              <h2 className="text-4xl font-black italic tracking-tighter">{formatCurrency(totals.net)}</h2>
            </div>

            <div className="pt-8 border-t border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Piutang (AR)</span>
                <span className="text-sm font-black italic">{formatCurrency(totals.receivable)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Commitment (PO)</span>
                <span className="text-sm font-black italic">{formatCurrency(totals.payable)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden mb-12">
        <div className="p-8 border-b-2 border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
          <div className="flex gap-4">
            {["overview", "income", "expense"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as "overview" | "income" | "expense")}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab
                    ? "bg-slate-900 text-white shadow-xl"
                    : "bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="pl-10 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-blue-500 transition-all w-64"
              />
            </div>
            <button
              onClick={handleQuickFilterReset}
              className="p-2.5 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 transition-all"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-50">
                <th className="px-8 py-6">Date</th>
                <th className="px-8 py-6">Reference</th>
                <th className="px-8 py-6">Description</th>
                <th className="px-8 py-6">Category</th>
                <th className="px-8 py-6 text-right">Debit (Income)</th>
                <th className="px-8 py-6 text-right">Credit (Expense)</th>
                <th className="px-8 py-6 text-right font-black text-slate-900">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {filteredEntries.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="font-bold text-slate-500">
                      {new Date(item.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{item.reference}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 uppercase italic tracking-tight">{item.description}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Verified Journal Entry System</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-emerald-600">{formatCurrency(item.debit)}</td>
                  <td className="px-8 py-5 text-right font-black text-rose-500">{formatCurrency(item.credit)}</td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 text-[12px] italic">{formatCurrency(item.balance)}</td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 text-sm font-bold">
                    Belum ada journal entry pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
