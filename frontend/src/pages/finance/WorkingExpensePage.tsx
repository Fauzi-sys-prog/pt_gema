import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  FileText,
  Download,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  MapPin,
  Image as ImageIcon,
  Save,
  Clock,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';

// New image asset from user
import imgBiayaKerjaRef from 'figma:asset/58af19785453a99273d5a0b2ab1d8cd3bef38814.png';

interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  nominal: number;
  hasNota: 'Y' | 'T' | '';
  remark?: string;
}

interface WorkingExpenseSheet {
  id: string;
  client: string;
  project: string;
  location: string;
  date: string;
  noHal: string;
  revisi: string;
  items: ExpenseItem[];
  totalKas: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Paid';
  createdBy?: string;
}

const getLedgerStatusUi = (status: WorkingExpenseSheet["status"]) => {
  switch (status) {
    case "Approved":
      return {
        title: "Approved",
        accentText: "text-emerald-400",
        iconBg: "bg-emerald-600",
        icon: CheckCircle2,
      };
    case "Paid":
      return {
        title: "Paid",
        accentText: "text-blue-400",
        iconBg: "bg-blue-600",
        icon: DollarSign,
      };
    case "Submitted":
      return {
        title: "Submitted",
        accentText: "text-amber-400",
        iconBg: "bg-amber-500",
        icon: Clock,
      };
    default:
      return {
        title: "Draft",
        accentText: "text-slate-400",
        iconBg: "bg-slate-600",
        icon: Save,
      };
  }
};

const getLedgerStatusBadgeClass = (status: WorkingExpenseSheet["status"]) => {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "Paid":
      return "bg-blue-50 text-blue-600 border-blue-100";
    case "Submitted":
      return "bg-amber-50 text-amber-600 border-amber-100";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const normalizeWorkingExpenseSheet = (row: any): WorkingExpenseSheet => {
  const payload = row?.payload ?? row ?? {};
  const normalizeStatus = (s: unknown): WorkingExpenseSheet["status"] => {
    const up = String(s || "").trim().toUpperCase();
    if (up === "APPROVED") return "Approved";
    if (up === "PAID") return "Paid";
    if (up === "SUBMITTED") return "Submitted";
    return "Draft";
  };
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const items: ExpenseItem[] = itemsRaw.map((it: any, idx: number) => ({
    id: String(it?.id || `item-${idx + 1}`),
    date: String(it?.date || ""),
    description: String(it?.description || ""),
    nominal: Number(it?.nominal || 0),
    hasNota: it?.hasNota === "Y" ? "Y" : it?.hasNota === "T" ? "T" : "",
    remark: typeof it?.remark === "string" ? it.remark : undefined,
  }));
  return {
    id: String(payload?.id || row?.entityId || row?.id || `BK-${Date.now()}`),
    client: String(payload?.client || ""),
    project: String(payload?.project || ""),
    location: String(payload?.location || ""),
    date: String(payload?.date || new Date().toISOString().split("T")[0]),
    noHal: String(payload?.noHal || ""),
    revisi: String(payload?.revisi || "0"),
    items,
    totalKas: Number(payload?.totalKas || 0),
    status: normalizeStatus(payload?.status),
    createdBy: String(payload?.createdBy || row?.createdBy || "").trim() || undefined,
  };
};

const toWorkingExpensePayload = (sheet: WorkingExpenseSheet) => ({
  id: sheet.id,
  client: sheet.client,
  project: sheet.project,
  location: sheet.location,
  date: sheet.date,
  noHal: sheet.noHal,
  revisi: sheet.revisi,
  items: sheet.items.map((it) => ({
    id: it.id,
    date: it.date,
    description: it.description,
    nominal: Number(it.nominal || 0),
    hasNota: it.hasNota,
    ...(it.remark ? { remark: it.remark } : {}),
  })),
  totalKas: Number(sheet.totalKas || 0),
  status: sheet.status,
  ...(sheet.createdBy ? { createdBy: sheet.createdBy } : {}),
});

const getWorkingExpenseGrandTotal = (sheet: WorkingExpenseSheet) =>
  sheet.items.reduce((sum, item) => sum + Number(item.nominal || 0), 0);

const getWorkingExpenseBalanceUi = (balance: number) => {
  if (balance < 0) {
    return {
      label: "Defisit",
      className: "text-rose-400",
    };
  }

  if (balance === 0) {
    return {
      label: "Imbang",
      className: "text-amber-300",
    };
  }

  return {
    label: "Sisa Kas",
    className: "text-emerald-400",
  };
};

export default function WorkingExpensePage() {
  const { projectList = [], addArchiveEntry, addAuditLog, currentUser } = useApp();
  const actorName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'unknown';
  const [sheets, setSheets] = useState<WorkingExpenseSheet[]>([]);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedSheet, setSelectedSheet] = useState<WorkingExpenseSheet | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSheets = async () => {
      try {
        const res = await api.get('/finance/working-expense-sheets');
        const rows = Array.isArray(res.data) ? res.data : [];
        const items = rows.map((row: any) => normalizeWorkingExpenseSheet(row));
        if (mounted) setSheets(items);
      } catch (err) {
        if (mounted) {
          console.error('Failed loading working expense sheets', err);
          setSheets([]);
        }
      }
    };

    void loadSheets();
    return () => {
      mounted = false;
    };
  }, []);

  const handleApprove = async () => {
    if (!selectedSheet) return;
    setIsSubmitting(true);

    const pendingSheet: WorkingExpenseSheet = {
      ...selectedSheet,
      status: 'Approved',
    };

    try {
      const res = await api.patch(
        `/finance/working-expense-sheets/${selectedSheet.id}`,
        toWorkingExpensePayload(pendingSheet),
      );
      const approvedSheet = normalizeWorkingExpenseSheet(res?.data || pendingSheet);
      await addArchiveEntry({
          date: new Date().toISOString().split('T')[0],
          ref: selectedSheet.noHal,
          description: `Final Settlement: ${selectedSheet.project}`,
          amount: getWorkingExpenseGrandTotal(selectedSheet),
          project: selectedSheet.project,
          admin: actorName,
          type: 'BK',
          source: 'Working Expense'
      });
      setSheets((prev) => prev.map((s) => (s.id === approvedSheet.id ? approvedSheet : s)));
      setSelectedSheet(approvedSheet);
      addAuditLog({
        action: "WORKING_EXPENSE_APPROVED",
        module: "Finance",
        details: `Working expense ${approvedSheet.noHal} approved`,
        status: "Success",
      });
      toast.success("Ledger Approved and Archived", {
        description: `Data has been moved to Digital Archive Data Registry.`,
      });
    } catch (err: any) {
      console.error('Failed approving working expense sheet', err);
      if (!err?.__toastShown) {
        toast.error('Gagal approve dan arsipkan Working Expense');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const [newExpense, setNewExpense] = useState({
    projectId: '',
    client: '',
    project: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    noHal: '',
    totalKas: 0,
  });

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const entry: WorkingExpenseSheet = {
      id: `BK-${Date.now()}`,
      client: newExpense.client,
      project: newExpense.project,
      location: newExpense.location,
      date: newExpense.date,
      noHal: newExpense.noHal,
      revisi: '0',
      totalKas: newExpense.totalKas,
      status: 'Draft',
      createdBy: actorName,
      items: [],
    };

    try {
      const res = await api.post('/finance/working-expense-sheets', entry);
      const saved = normalizeWorkingExpenseSheet(res?.data || entry);
      setSheets((prev) => [saved, ...prev]);
      setSelectedSheet(saved);
      addAuditLog({
        action: "WORKING_EXPENSE_CREATED",
        module: "Finance",
        details: `Working expense ${saved.noHal} created`,
        status: "Success",
      });
      toast.success("Biaya Kerja baru telah dibuat", {
        description: `Ref: ${saved.noHal} - ${saved.project}`,
      });
      setSearchQuery('');
      setShowCreateModal(false);
      setView('detail');
      setNewExpense({
        projectId: '',
        client: '',
        project: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        noHal: '',
        totalKas: 0,
      });
    } catch (err) {
      console.error('Failed creating working expense sheet', err);
      toast.error('Gagal membuat Working Expense di backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSheet = useMemo(() => {
    if (!sheets.length) return null;
    const submitted = sheets.find((s) => s.status === 'Submitted');
    const draft = sheets.find((s) => s.status === 'Draft');
    return submitted || draft || sheets[0];
  }, [sheets]);

  const hasSheets = sheets.length > 0;

  const renderEmptyState = (
    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 text-center">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada Working Expense</p>
      <p className="text-sm font-bold text-slate-500 mt-2">Klik tombol `New Working Expense` untuk membuat ledger baru.</p>
    </div>
  );

  const displayedSheets = useMemo(() => {
    if (!hasSheets) return [];
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return sheets;
    return sheets.filter((sheet) =>
      [sheet.noHal, sheet.client, sheet.project, sheet.location, sheet.status, sheet.date]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    );
  }, [hasSheets, searchQuery, sheets]);

  const isSearchEmpty = searchQuery.trim().length > 0 && displayedSheets.length === 0;

  // keep selected data valid after backend refresh
  useEffect(() => {
    if (!selectedSheet) return;
    const found = displayedSheets.find((s) => s.id === selectedSheet.id);
    if (found) {
      setSelectedSheet(found);
      return;
    }
    const fallback = sheets.find((s) => s.id === selectedSheet.id);
    if (fallback) {
      setSelectedSheet(fallback);
      return;
    }
    setSelectedSheet(null);
    setView('list');
  }, [displayedSheets, selectedSheet, sheets]);

  // original helper and render start below
  
  if (!hasSheets && view === 'list') {
    // show empty block and keep page usable
  }

  const activeForCard = displayedSheets.length
    ? displayedSheets[0]
    : searchQuery.trim()
      ? null
      : activeSheet || null;

  const handleOpenActiveDetail = () => {
    if (!activeForCard) return;
    handleOpenDetail(activeForCard);
  };

  // existing page logic continues
  
  const handleOpenDetail = (sheet: WorkingExpenseSheet) => {
    setSelectedSheet(sheet);
    setView('detail');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const downloadBlobFile = (filename: string, content: BlobPart, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSingleSheet = async (sheet: WorkingExpenseSheet) => {
    const payload = {
      ...sheet,
      generatedBy: actorName,
      generatedAt: new Date().toISOString(),
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post("/exports/working-expense-sheet/excel", payload, { responseType: "blob" }),
        api.post("/exports/working-expense-sheet/word", payload, { responseType: "blob" }),
      ]);
      downloadBlobFile(`working-expense-${sheet.id}.xls`, excelRes.data, "application/vnd.ms-excel");
      downloadBlobFile(`working-expense-${sheet.id}.doc`, wordRes.data, "application/msword");
    } catch {
      toast.error("Export Working Expense sheet gagal.");
      return;
    }
    addAuditLog({
      action: "WORKING_EXPENSE_EXPORTED",
      module: "Finance",
      details: `Working expense ${sheet.noHal} exported as Word+Excel`,
      status: "Success",
    });
    toast.success("Export selesai", { description: `${sheet.noHal} (.doc + .xls)` });
  };

  const handleExportAll = async () => {
    if (!displayedSheets.length) {
      toast.info("Tidak ada data Working Expense untuk diekspor.");
      return;
    }
    const payload = {
      items: displayedSheets.map((sheet) => ({
        ...sheet,
        grandTotal: getWorkingExpenseGrandTotal(sheet),
      })),
      generatedBy: actorName,
      generatedAt: new Date().toISOString(),
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post("/exports/working-expense-ledger/excel", payload, { responseType: "blob" }),
        api.post("/exports/working-expense-ledger/word", payload, { responseType: "blob" }),
      ]);
      const dateKey = new Date().toISOString().slice(0, 10);
      downloadBlobFile(`working-expense-ledger-${dateKey}.xls`, excelRes.data, "application/vnd.ms-excel");
      downloadBlobFile(`working-expense-ledger-${dateKey}.doc`, wordRes.data, "application/msword");
    } catch {
      toast.error("Bulk export Working Expense gagal.");
      return;
    }
    addAuditLog({
      action: "WORKING_EXPENSE_BULK_EXPORTED",
      module: "Finance",
      details: `Bulk export working expense (${displayedSheets.length} rows) as Word+Excel`,
      status: "Success",
    });
    toast.success("Bulk export selesai", { description: `${displayedSheets.length} rows (.doc + .xls)` });
  };

  const handlePrintCurrent = () => {
    if (!selectedSheet) return;
    addAuditLog({
      action: "WORKING_EXPENSE_PRINTED",
      module: "Finance",
      details: `Print ledger ${selectedSheet.noHal}`,
      status: "Success",
    });
    window.print();
  };

  if (view === 'detail' && selectedSheet) {
    const grandTotal = getWorkingExpenseGrandTotal(selectedSheet);
    const sisaUang = selectedSheet.totalKas - grandTotal;
    const balanceUi = getWorkingExpenseBalanceUi(sisaUang);
    const statusUi = getLedgerStatusUi(selectedSheet.status);
    const StatusIcon = statusUi.icon;
    const canApprove = selectedSheet.status === "Draft" || selectedSheet.status === "Submitted";
    const detailFacts = [
      { label: "Ref No", value: selectedSheet.noHal },
      { label: "Tanggal", value: selectedSheet.date },
      { label: "Project", value: selectedSheet.project },
      { label: "Location", value: selectedSheet.location || "-" },
      { label: "Items", value: `${selectedSheet.items.length} lines` },
      { label: "Status", value: selectedSheet.status },
    ];

    return (
      <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <button 
            disabled={isSubmitting}
            onClick={() => setView('list')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Biaya Kerja Ledger</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Ref No: {selectedSheet.noHal}</p>
          </div>
          <div className="ml-auto flex gap-3">
             <button
                disabled={isSubmitting}
                onClick={() => toast.info("Scan preview tersedia di panel kanan")}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <ImageIcon size={16} /> Preview Scan
             </button>
             <button
                disabled={isSubmitting}
                onClick={handlePrintCurrent}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Download size={16} /> Print / Save PDF
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Ledger Sheet */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
               {/* Document Header Section */}
               <div className="flex justify-between items-start mb-10 pb-8 border-b border-slate-100 border-dashed">
                  <div className="space-y-6 flex-1">
                     <div className="grid grid-cols-2 gap-8">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.client}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.date}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Project</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.project}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">No. Hal</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.noHal}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.location}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revisi</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">{selectedSheet.revisi}</p>
                        </div>
                     </div>
                  </div>
                  <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center p-4 border border-slate-100">
                     <ImageWithFallback src="/logo.png" className="w-full h-full object-contain" />
                  </div>
               </div>

               {/* Expenses Table Grid - Mirroring the "BIAYA KERJA" sheet */}
               <div className="overflow-hidden border border-slate-900 rounded-xl">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-900 text-white divide-x divide-slate-700">
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center w-12">No</th>
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest w-24">Tanggal</th>
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest">Deskripsi</th>
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-right w-40">Nominal (IDR)</th>
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center w-20">Nota Y/T</th>
                           <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest">Remark</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200">
                        {selectedSheet.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-all divide-x divide-slate-100">
                             <td className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                             <td className="px-4 py-3 text-[10px] font-black text-slate-600 uppercase italic">{item.date}</td>
                             <td className="px-4 py-3 text-xs font-black text-slate-900 uppercase italic">{item.description}</td>
                             <td className="px-4 py-3 text-xs font-black text-slate-900 text-right italic">
                                {item.nominal > 0 ? formatCurrency(item.nominal) : '-'}
                             </td>
                             <td className="px-4 py-3 text-center">
                                <span className={`text-[10px] font-black ${item.hasNota === 'Y' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                   {item.hasNota || '-'}
                                </span>
                             </td>
                             <td className="px-4 py-3 text-[10px] text-slate-400 italic">{item.remark || '-'}</td>
                          </tr>
                        ))}
                        {/* Placeholder rows to reach 25 lines like in the template */}
                        {Array.from({ length: Math.max(0, 25 - selectedSheet.items.length) }).map((_, i) => (
                           <tr key={`empty-${i}`} className="divide-x divide-slate-100 h-10 opacity-20">
                              <td className="px-4 py-3 text-[10px] font-bold text-slate-300 text-center">{selectedSheet.items.length + i + 1}</td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot>
                        <tr className="bg-slate-50 divide-x divide-slate-100 border-t-2 border-slate-900">
                           <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Grand Total</td>
                           <td className="px-6 py-4 text-sm font-black text-right italic text-slate-900 bg-slate-100/50">{formatCurrency(grandTotal)}</td>
                           <td colSpan={2}></td>
                        </tr>
                        <tr className="bg-slate-50 divide-x divide-slate-100">
                           <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Total Kas</td>
                           <td className="px-6 py-4 text-sm font-black text-right italic text-blue-600 bg-blue-50/30">{formatCurrency(selectedSheet.totalKas)}</td>
                           <td colSpan={2}></td>
                        </tr>
                        <tr
                          className={`text-white divide-x ${
                            sisaUang < 0
                              ? "bg-rose-600 divide-rose-500"
                              : sisaUang === 0
                                ? "bg-amber-500 divide-amber-400"
                                : "bg-emerald-600 divide-emerald-500"
                          }`}
                        >
                           <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em]">{balanceUi.label}</td>
                           <td className="px-6 py-4 text-lg font-black text-right italic">{formatCurrency(sisaUang)}</td>
                           <td colSpan={2}></td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            </div>
          </div>

          {/* Verification & Archive Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
               <div className="flex items-center gap-3 mb-8">
                  <div className={`w-10 h-10 ${statusUi.iconBg} rounded-xl flex items-center justify-center`}>
                     <StatusIcon size={20} />
                  </div>
                  <div>
                     <h4 className="text-[10px] font-black uppercase italic tracking-widest text-blue-400">Ledger Status</h4>
                     <p className={`text-sm font-black uppercase italic tracking-tighter ${statusUi.accentText}`}>{statusUi.title}</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Proof of Receipt</p>
                     <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-white/10 overflow-hidden relative group cursor-pointer">
                        <ImageWithFallback src={imgBiayaKerjaRef} alt="Nota Proof" className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40">
                           <button
                             disabled={isSubmitting}
                             onClick={() => toast.info("Scan sudah ditampilkan")}
                             className="px-4 py-2 bg-white text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             Preview Scan
                           </button>
                        </div>
                     </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Document Snapshot</p>
                     {detailFacts.map((fact) => (
                        <div key={fact.label} className="flex items-center justify-between gap-4 text-[9px] font-bold uppercase">
                           <span className="text-slate-400 tracking-widest">{fact.label}</span>
                           <span className="text-white italic text-right">{fact.value}</span>
                        </div>
                     ))}
                  </div>

                  <button 
                    onClick={handleApprove}
                    disabled={isSubmitting || !canApprove}
                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 ${
                      canApprove
                        ? "bg-blue-600 text-white shadow-blue-900/40 hover:bg-blue-700"
                        : "bg-slate-700 text-slate-300 shadow-none cursor-not-allowed"
                    }`}
                  >
                     {isSubmitting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <CheckCircle2 size={16} />} 
                     {canApprove ? "Approve Ledger" : `Ledger ${selectedSheet.status}`}
                  </button>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Ledger Summary</h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase">
                     <span className="text-slate-400 tracking-widest">Grand Total</span>
                     <span className="text-slate-900 italic">{formatCurrency(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase">
                     <span className="text-slate-400 tracking-widest">Total Kas</span>
                     <span className="text-slate-900 italic">{formatCurrency(selectedSheet.totalKas)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase">
                     <span className="text-slate-400 tracking-widest">{balanceUi.label}</span>
                     <span className={`${balanceUi.className} italic`}>{formatCurrency(sisaUang)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase">
                     <span className="text-slate-400 tracking-widest">Generated By</span>
                     <span className="text-slate-900 italic">{selectedSheet.createdBy || "-"}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Biaya Kerja Hub</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Operational Field Expenses & Digital Proofs</p>
          </div>
        </div>

        <div className="flex gap-3">
           <button
              onClick={handleExportAll}
              disabled={!displayedSheets.length}
              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
           >
              <Download size={16} /> {displayedSheets.length ? "Bulk Export" : "No Data To Export"}
           </button>
           <button 
             onClick={() => setShowCreateModal(true)}
             className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
           >
              <Plus size={16} /> New Working Expense
           </button>
        </div>
      </div>

      {!hasSheets && renderEmptyState}

      {hasSheets && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
           <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-110 transition-transform">
              <ImageIcon size={200} />
           </div>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 italic">
             {isSearchEmpty ? "Search Result" : "Active Site Report"}
           </p>
           <h3 className="text-xl font-black italic text-white tracking-tighter uppercase mb-6 leading-tight">
             {activeForCard
               ? `BK - ${activeForCard.client} (${activeForCard.project})`
               : isSearchEmpty
                 ? "Tidak Ada Ledger Yang Cocok"
                 : "Belum Ada Ledger Aktif"}
           </h3>
           
      {(() => {
        const activeBalance = activeForCard
          ? activeForCard.totalKas - getWorkingExpenseGrandTotal(activeForCard)
          : 0;
        const activeBalanceUi = getWorkingExpenseBalanceUi(activeBalance);
        return (
           <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
                 <span className="text-sm font-black italic text-blue-400">
                   {formatCurrency(activeForCard ? getWorkingExpenseGrandTotal(activeForCard) : 0)}
                 </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{activeBalanceUi.label}</span>
                     <span className={`text-sm font-black italic ${activeBalanceUi.className}`}>
                       {formatCurrency(activeBalance)}
                 </span>
              </div>
           </div>
        );
      })()}

           <button 
             onClick={handleOpenActiveDetail}
             disabled={!activeForCard}
             className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
           >
              {isSearchEmpty ? "No Matching Ledger" : "Open Ledger"} <ChevronRight size={14} />
           </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
           <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-[10px] font-black text-slate-900 uppercase italic tracking-widest">History Biaya Kerja</h3>
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                 <input
                   type="text"
                   placeholder="Search BK / Client / Project / Status..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase italic outline-none focus:border-blue-500 transition-all"
                 />
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr>
                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Identity</th>
                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Project & Location</th>
                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-right">Nominal</th>
                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-center">Status</th>
                       <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-center">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {displayedSheets.map(sheet => (
                      (() => {
                        const statusBadgeClass = getLedgerStatusBadgeClass(sheet.status);
                        return (
                      <tr key={sheet.id} className="hover:bg-slate-50/50 transition-all group">
                         <td className="px-8 py-6">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-slate-400 uppercase italic mb-1">{sheet.noHal}</span>
                               <span className="text-xs font-black text-slate-900 uppercase italic leading-none">{sheet.client}</span>
                               <span className="text-[8px] text-slate-400 font-bold uppercase mt-1.5">{sheet.date}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex flex-col">
                               <span className="text-xs font-black text-slate-700 uppercase italic leading-none">{sheet.project}</span>
                               <span className="text-[8px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-1">
                                  <MapPin size={8} /> {sheet.location}
                               </span>
                            </div>
                         </td>
                         <td className="px-8 py-6 font-black italic text-xs text-blue-600 text-right">
                            {formatCurrency(getWorkingExpenseGrandTotal(sheet))}
                         </td>
                         <td className="px-8 py-6 text-center">
                            <span className={`px-3 py-1 border rounded-lg text-[8px] font-black uppercase italic tracking-widest ${statusBadgeClass}`}>
                               {sheet.status}
                            </span>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <button 
                              onClick={() => handleOpenDetail(sheet)}
                              className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all mr-2"
                            >
                               <ChevronRight size={16} />
                            </button>
                            <button
                              onClick={() => handleExportSingleSheet(sheet)}
                              className="p-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
                            >
                              <Download size={16} />
                            </button>
                         </td>
                      </tr>
                        );
                      })()
                    ))}
                    {displayedSheets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Tidak ada ledger yang cocok dengan pencarian.
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
      )}

      {/* Visual Reference Section */}
      <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-200 border-dashed">
         <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-400 shadow-sm">
               <ImageIcon size={20} />
            </div>
            <div>
               <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">System Blueprint Reference</h3>
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Standardized Paper Ledger Mirroring</p>
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
               <div className="aspect-[4/3] bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-2xl p-4">
                  <ImageWithFallback src={imgBiayaKerjaRef} alt="Biaya Kerja Ref" className="w-full h-full object-contain" />
               </div>
               <p className="text-[9px] text-center font-black text-slate-400 uppercase tracking-[0.3em]">Operational Expense Template v2.6</p>
            </div>
            <div className="flex flex-col justify-center space-y-8">
               <div className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-900 uppercase italic mb-4 tracking-tight">Key Ledger Principles</h4>
                  <ul className="space-y-4">
                     {[
                       'Zero Re-typing: From paper to digital ledger in seconds',
                       'Project Reconciliation: Auto-deduct from field cash',
                       'Digital Archive: Paper nota and digital records synced',
                       'Balance Validation: Automatic Sisa Uang calculation'
                     ].map((item, i) => (
                       <li key={i} className="flex items-start gap-3">
                          <div className="mt-1 w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase italic">{item}</span>
                       </li>
                     ))}
                  </ul>
               </div>
               <div className="p-8 bg-blue-600 rounded-[2rem] shadow-xl text-white">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">Executive Summary</p>
                  <p className="text-sm font-black uppercase italic leading-tight">"Sistem ini memastikan setiap rupiah yang keluar di lapangan terdokumentasi dan terhubung ke P&L Project secara real-time."</p>
               </div>
            </div>
         </div>
      </div>

      {/* New Working Expense Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleCreateExpense}>
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-900">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">New Working Expense</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Create new operational site ledger</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowCreateModal(false)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 overflow-y-auto max-h-[70vh]">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
                        value={newExpense.projectId}
                        onChange={(e) => {
                          const selectedProjectId = e.target.value;
                          const p = projectList.find((proj) => proj.id === selectedProjectId);
                          const anyProject = p as any;
                          setNewExpense({
                            ...newExpense,
                            projectId: p?.id || '',
                            project:
                              anyProject?.namaProject ||
                              anyProject?.projectName ||
                              '',
                            client:
                              anyProject?.customer ||
                              anyProject?.customerName ||
                              '',
                            location:
                              anyProject?.location ||
                              anyProject?.lokasi ||
                              anyProject?.quotationSnapshot?.lokasi ||
                              '',
                          });
                        }}
                      >
                        <option value="">Select Project</option>
                        {projectList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p as any)?.namaProject || (p as any)?.projectName || p.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Ref (No. Hal)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="001/BK/GTP/II/2026"
                        value={newExpense.noHal}
                        onChange={(e) => setNewExpense({...newExpense, noHal: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Name</label>
                      <input 
                        type="text" 
                        readOnly
                        placeholder="Auto-filled from project"
                        value={newExpense.client}
                        className="w-full px-6 py-4 bg-slate-100 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none text-slate-500" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Location</label>
                      <input 
                        type="text" 
                        readOnly
                        placeholder="Auto-filled from project"
                        value={newExpense.location}
                        className="w-full px-6 py-4 bg-slate-100 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none text-slate-500" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Cash Advance (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black italic text-slate-400 text-xs">Rp</span>
                        <input 
                          type="number" 
                          required
                          placeholder="0"
                          value={newExpense.totalKas || ''}
                          onChange={(e) => setNewExpense({...newExpense, totalKas: Number(e.target.value)})}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-blue-500 transition-all" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Date</label>
                      <input 
                        type="date" 
                        required
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-blue-500 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">Zero Re-typing Integration</h4>
                      <p className="text-[9px] text-blue-600 font-bold leading-relaxed">Sistem akan otomatis menghubungkan pengeluaran ini dengan saldo Kas Kecil (Petty Cash) dan laporan P&L Project yang dipilih.</p>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 flex gap-4">
                  <button 
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Create Ledger
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
