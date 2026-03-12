import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  DollarSign,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Search,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  PackageCheck,
  PackageX,
  ArrowRightLeft,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { toast } from "sonner@2.0.3";
import { motion, AnimatePresence } from 'motion/react';
import api from "../../services/api";
import FlowHintBar from "../../components/ui/FlowHintBar";
import { emitDataSync } from "../../services/dataSyncBus";
import { subscribeDataSync } from "../../services/dataSyncBus";
import { isOwnerLike } from "../../utils/roles";

type ApprovalPoItem = {
  id: string;
  noPO: string;
  supplier: string;
  total: number;
  status: string;
};

type ApprovalQuotationItem = {
  id: string;
  noPenawaran: string;
  kepada: string;
  grandTotal: number;
  status: string;
};

type ApprovalInvoiceItem = {
  id: string;
  noInvoice: string;
  customer: string;
  totalBayar: number;
  status: string;
};

type ApprovalMaterialRequestItem = {
  id: string;
  noRequest: string;
  projectName: string;
  requestedBy: string;
  status: string;
  items: Array<Record<string, unknown>>;
};

export default function ApprovalCenterPage() {
  const navigate = useNavigate();
  const { 
    currentUser,
    addAuditLog
  } = useApp();

  const [activeTab, setActiveTab] = useState<'po' | 'rab' | 'invoice' | 'warehouse'>('po');
  const [searchTerm, setSearchTerm] = useState('');
  const [terminologyMode, setTerminologyMode] = useState<'RAB' | 'SOW'>('RAB');
  const [syncing, setSyncing] = useState(false);
  const [serverPOs, setServerPOs] = useState<ApprovalPoItem[]>([]);
  const [serverQuotations, setServerQuotations] = useState<ApprovalQuotationItem[]>([]);
  const [serverInvoices, setServerInvoices] = useState<ApprovalInvoiceItem[]>([]);
  const [serverMaterialRequests, setServerMaterialRequests] = useState<ApprovalMaterialRequestItem[]>([]);
  const [serverStats, setServerStats] = useState<{ total: number; highValue: number } | null>(null);
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const normalizeStatus = (value: unknown) => String(value || "").trim().toUpperCase();
  const currentRole = String(currentUser?.role || "").trim().toUpperCase();
  const isActualOwner = currentRole === "OWNER";
  const isSpv = currentRole === "SPV";
  const isOwner = isOwnerLike(currentRole);
  const isAdmin = currentRole === "ADMIN";
  const isManager = currentRole === "MANAGER";
  const canSendQuotation = isOwner || isAdmin || isManager || currentRole === "SALES";
  const canVerifyInvoice = isOwner || isAdmin || isManager || currentRole === "FINANCE";
  const canApproveRejectMr =
    isOwner || isAdmin || isManager || currentRole === "SUPPLY_CHAIN" || currentRole === "WAREHOUSE" || currentRole === "PURCHASING";
  const canIssueMr = isOwner || isAdmin || currentRole === "SUPPLY_CHAIN" || currentRole === "WAREHOUSE" || currentRole === "PRODUKSI";
  const canApprovePo = (total: number) => {
    const highValue = total > 10_000_000;
    if (highValue) return isOwner || isAdmin;
    return isOwner || isAdmin || isManager || currentRole === "FINANCE" || currentRole === "SUPPLY_CHAIN" || currentRole === "PURCHASING";
  };

  const fetchApprovalCenterData = async (silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const res = await api.get<{
        stats?: { total?: number; highValue?: number };
        po?: ApprovalPoItem[];
        quotations?: ApprovalQuotationItem[];
        invoices?: ApprovalInvoiceItem[];
        materialRequests?: ApprovalMaterialRequestItem[];
      }>('/dashboard/finance-approval-queue');

      setServerPOs(Array.isArray(res.data?.po) ? res.data.po : []);
      setServerQuotations(Array.isArray(res.data?.quotations) ? res.data.quotations : []);
      setServerInvoices(Array.isArray(res.data?.invoices) ? res.data.invoices : []);
      setServerMaterialRequests(Array.isArray(res.data?.materialRequests) ? res.data.materialRequests : []);
      setServerStats(
        res.data?.stats
          ? {
              total: Number(res.data.stats.total || 0),
              highValue: Number(res.data.stats.highValue || 0),
            }
          : null
      );
      setLastSyncedAt(new Date().toISOString());
      if (!silent) toast.success('Approval center data berhasil disinkronkan.');
    } catch {
      if (!silent) toast.error('Gagal refresh approval center.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => {
    fetchApprovalCenterData(true);
  }, []);

  useEffect(() => {
    let cooldown = false;
    const pull = () => {
      if (cooldown) return;
      cooldown = true;
      void fetchApprovalCenterData(true).finally(() => {
        window.setTimeout(() => {
          cooldown = false;
        }, 1200);
      });
    };

    const unsubscribe = subscribeDataSync(pull);
    const onFocus = () => pull();
    const onVisibilityChange = () => {
      if (!document.hidden) pull();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // 1. Filter Pending POs
  const pendingPOs = useMemo(() => {
    return serverPOs.filter(po => 
      (normalizeStatus(po.status) === 'DRAFT' || normalizeStatus(po.status) === 'SENT') &&
      ((po.noPO || '').toLowerCase().includes(searchTerm.toLowerCase()) || (po.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [serverPOs, searchTerm]);

  // 2. Filter Pending Quotations
  const pendingQuotations = useMemo(() => {
    return serverQuotations.filter(q => 
      (normalizeStatus(q.status) === 'DRAFT' || normalizeStatus(q.status) === 'SENT' || normalizeStatus(q.status) === 'REVIEW') &&
      ((q.noPenawaran || '').toLowerCase().includes(searchTerm.toLowerCase()) || (q.kepada || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [serverQuotations, searchTerm]);

  // 3. Filter Unpaid Invoices
  const pendingInvoices = useMemo(() => {
    return serverInvoices.filter(inv => 
      normalizeStatus(inv.status) === 'UNPAID' &&
      ((inv.noInvoice || '').toLowerCase().includes(searchTerm.toLowerCase()) || (inv.customer || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [serverInvoices, searchTerm]);

  // 4. Filter Material Requests (Warehouse Ops)
  const pendingRequests = useMemo(() => {
    return serverMaterialRequests.filter(mr => 
      (normalizeStatus(mr.status) === 'PENDING' || normalizeStatus(mr.status) === 'APPROVED') &&
      ((mr.noRequest || '').toLowerCase().includes(searchTerm.toLowerCase()) || (mr.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [serverMaterialRequests, searchTerm]);

  const isPendingQuotationStatus = (status: string) =>
    status === "DRAFT" || status === "SENT" || status === "REVIEW";
  const isPendingMaterialRequestStatus = (status: string) =>
    status === "PENDING" || status === "APPROVED";
  const canApproveQuotationItem = (q: ApprovalQuotationItem) => {
    const status = normalizeStatus(q.status);
    if (status === "SENT") return isSpv;
    if (status === "REVIEW") return isActualOwner;
    return false;
  };
  const canRejectQuotationItem = (q: ApprovalQuotationItem) => {
    const status = normalizeStatus(q.status);
    if (status === "SENT") return isSpv || isActualOwner;
    if (status === "REVIEW") return isActualOwner;
    return false;
  };
  const getQuotationAuditLabel = (q: ApprovalQuotationItem) => {
    const status = normalizeStatus(q.status);
    if (status === "DRAFT") return "Ready to Send";
    if (status === "SENT") return "SPV Review";
    if (status === "REVIEW") return "Owner Final Review";
    return "Processed";
  };

  const executeApprovalAction = async (
    documentType: "PO" | "INVOICE" | "MATERIAL_REQUEST" | "QUOTATION",
    documentId: string,
    action: "APPROVE" | "REJECT" | "VERIFY" | "ISSUE" | "SEND",
    successMessage: string,
    reason?: string
  ) => {
    const actionKey = `${documentType}:${documentId}:${action}`;
    if (actionLoadingMap[actionKey]) return;
    setActionLoadingMap((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const res = await api.post<{ status?: string }>('/dashboard/finance-approval-action', {
        documentType,
        documentId,
        action,
        reason: reason || undefined,
      });
      const nextStatus = normalizeStatus(res?.data?.status);
      let pendingDelta = -1;

      // Local state update only (no global refresh) to avoid UI "kedip" after action.
      if (documentType === "PO") {
        setServerPOs((prev) => prev.filter((item) => item.id !== documentId));
      } else if (documentType === "INVOICE") {
        setServerInvoices((prev) => prev.filter((item) => item.id !== documentId));
      } else if (documentType === "QUOTATION") {
        const currentItem = serverQuotations.find((item) => item.id === documentId);
        const wasPending = currentItem ? isPendingQuotationStatus(normalizeStatus(currentItem.status)) : true;
        const remainsPending = isPendingQuotationStatus(nextStatus);
        pendingDelta = (remainsPending ? 1 : 0) - (wasPending ? 1 : 0);
        if (remainsPending) {
          setServerQuotations((prev) =>
            prev.map((item) =>
              item.id === documentId
                ? { ...item, status: nextStatus || item.status }
                : item
            )
          );
        } else {
          setServerQuotations((prev) => prev.filter((item) => item.id !== documentId));
        }
      } else if (documentType === "MATERIAL_REQUEST") {
        const currentItem = serverMaterialRequests.find((item) => item.id === documentId);
        const wasPending = currentItem ? isPendingMaterialRequestStatus(normalizeStatus(currentItem.status)) : true;
        const remainsPending = isPendingMaterialRequestStatus(nextStatus);
        pendingDelta = (remainsPending ? 1 : 0) - (wasPending ? 1 : 0);
        if (action === "APPROVE") {
          setServerMaterialRequests((prev) =>
            prev.map((item) =>
              item.id === documentId
                ? { ...item, status: nextStatus || "Approved" }
                : item
            )
          );
        } else if (!remainsPending) {
          setServerMaterialRequests((prev) => prev.filter((item) => item.id !== documentId));
        }
      }

      setServerStats((prev) => {
        if (!prev) return prev;
        const nextTotal = Math.max(0, Number(prev.total || 0) + pendingDelta);
        return {
          ...prev,
          total: nextTotal,
        };
      });

      emitDataSync(`finance-approval:${documentType}:${action}`);
      toast.success(successMessage);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Aksi approval gagal');
      throw err;
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // Handlers
  const handleApprovePO = async (po: ApprovalPoItem) => {
    await executeApprovalAction("PO", po.id, "APPROVE", `Purchase Order ${po.noPO} telah disetujui.`);
    addAuditLog({
      action: 'PO_APPROVED',
      module: 'Purchasing',
      details: `PO ${po.noPO} disetujui oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleRejectPO = async (po: ApprovalPoItem) => {
    await executeApprovalAction("PO", po.id, "REJECT", `Purchase Order ${po.noPO} ditolak.`);
    addAuditLog({
      action: 'PO_REJECTED',
      module: 'Purchasing',
      details: `PO ${po.noPO} ditolak oleh ${currentUser?.fullName}`,
      status: 'Warning'
    });
  };

  const handleSendQuotation = async (q: ApprovalQuotationItem) => {
    await executeApprovalAction("QUOTATION", q.id, "SEND", `Quotation ${q.noPenawaran || q.id} berhasil dikirim.`);
    addAuditLog({
      action: 'QUOTATION_SENT',
      module: 'Sales',
      details: `Quotation ${q.noPenawaran || q.id} dikirim oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleApproveQuotation = async (q: ApprovalQuotationItem) => {
    await executeApprovalAction("QUOTATION", q.id, "APPROVE", `Quotation ${q.noPenawaran || q.id} disetujui.`);
    addAuditLog({
      action: 'QUOTATION_APPROVED',
      module: 'Sales',
      details: `Quotation ${q.noPenawaran || q.id} disetujui oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleRejectQuotation = async (q: ApprovalQuotationItem) => {
    await executeApprovalAction("QUOTATION", q.id, "REJECT", `Quotation ${q.noPenawaran || q.id} ditolak.`);
    addAuditLog({
      action: 'QUOTATION_REJECTED',
      module: 'Sales',
      details: `Quotation ${q.noPenawaran || q.id} ditolak oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleViewQuotation = (q: ApprovalQuotationItem) => {
    navigate('/sales/quotation', { state: { openPreviewQuotationId: q.id } });
  };

  const handleApproveRequest = async (mr: ApprovalMaterialRequestItem) => {
    await executeApprovalAction("MATERIAL_REQUEST", mr.id, "APPROVE", `Material Request ${mr.noRequest} disetujui.`);
    addAuditLog({
      action: 'MAT_REQ_APPROVED',
      module: 'Warehouse',
      details: `Material Request ${mr.noRequest} disetujui oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleRejectRequest = async (mr: ApprovalMaterialRequestItem) => {
    await executeApprovalAction("MATERIAL_REQUEST", mr.id, "REJECT", `Material Request ${mr.noRequest} ditolak.`);
    addAuditLog({
      action: 'MAT_REQ_REJECTED',
      module: 'Warehouse',
      details: `Material Request ${mr.noRequest} ditolak oleh ${currentUser?.fullName}`,
      status: 'Warning'
    });
  };

  const handleIssueRequest = async (mr: ApprovalMaterialRequestItem) => {
    await executeApprovalAction("MATERIAL_REQUEST", mr.id, "ISSUE", `Material Request ${mr.noRequest} telah dikeluarkan dari gudang.`);
    addAuditLog({
      action: 'MAT_REQ_ISSUED',
      module: 'Warehouse',
      details: `Material untuk ${mr.noRequest} dikeluarkan dari gudang oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const handleVerifyInvoice = async (inv: ApprovalInvoiceItem) => {
    await executeApprovalAction("INVOICE", inv.id, "VERIFY", `Invoice ${inv.noInvoice} telah diverifikasi lunas.`);
    addAuditLog({
      action: 'INV_VERIFIED',
      module: 'Finance',
      details: `Pembayaran Invoice ${inv.noInvoice} diverifikasi oleh ${currentUser?.fullName}`,
      status: 'Success'
    });
  };

  const stats = serverStats || { total: 0, highValue: 0 };
  const lastSyncLabel = useMemo(() => {
    if (!lastSyncedAt) return "Belum ada sync";
    return new Date(lastSyncedAt).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastSyncedAt]);

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-slate-900 rounded-full -mr-40 -mt-40 opacity-[0.02]" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Approval Command Center</h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase tracking-widest border border-emerald-200">System Secure</span>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] italic">PT GTP Fiscal & Operational Control</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Pending Tasks</p>
              <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter">{stats.total} <span className="text-sm font-bold not-italic text-slate-300 uppercase ml-1">Docs</span></h3>
           </div>
           {stats.highValue > 0 && (
             <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="text-amber-500" size={18} />
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest italic">{stats.highValue} High-Value POs</span>
             </div>
           )}
        </div>
      </div>

      <FlowHintBar
        title="Alur Approval Terpusat:"
        badges={[
          { label: "PO", tone: "info" },
          { label: "Quotation", tone: "warning" },
          { label: "Invoice", tone: "success" },
          { label: "Material Request", tone: "danger" },
        ]}
        helper="Semua approval utama dipusatkan di halaman ini untuk menghindari alur yang terpecah."
      />

      {/* Grid Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(['po', 'rab', 'invoice', 'warehouse'] as const).map((type) => {
          const count = type === 'po' ? pendingPOs.length : type === 'rab' ? pendingQuotations.length : type === 'invoice' ? pendingInvoices.length : pendingRequests.length;
          const label = type === 'po' ? 'Purchase Orders' : type === 'rab' ? 'Quotation' : type === 'invoice' ? 'Invoices' : 'Material Request';
          const icon = type === 'po' ? <DollarSign /> : type === 'rab' ? <FileText /> : type === 'invoice' ? <UserCheck /> : <ArrowRightLeft />;
          const tone = type === "po"
            ? { activeCard: "border-indigo-500 ring-4 ring-indigo-50", activeIcon: "bg-indigo-500 text-white", idleIcon: "bg-indigo-50 text-indigo-500" }
            : type === "rab"
              ? { activeCard: "border-amber-500 ring-4 ring-amber-50", activeIcon: "bg-amber-500 text-white", idleIcon: "bg-amber-50 text-amber-500" }
              : type === "invoice"
                ? { activeCard: "border-emerald-500 ring-4 ring-emerald-50", activeIcon: "bg-emerald-500 text-white", idleIcon: "bg-emerald-50 text-emerald-500" }
                : { activeCard: "border-rose-500 ring-4 ring-rose-50", activeIcon: "bg-rose-500 text-white", idleIcon: "bg-rose-50 text-rose-500" };
          
          return (
            <motion.div 
              key={type}
              whileHover={{ y: -5 }}
              onClick={() => setActiveTab(type)}
              className={`p-8 rounded-[2.5rem] border bg-white shadow-sm cursor-pointer transition-all ${activeTab === type ? tone.activeCard : "border-slate-100"}`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${activeTab === type ? tone.activeIcon : tone.idleIcon}`}>
                {icon}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
              <h4 className="text-2xl font-black italic text-slate-900 leading-none">{count} Pending</h4>
            </motion.div>
          )
        })}
      </div>

      {/* Main Approval Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
           {activeTab === 'rab' ? (
             <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setTerminologyMode('RAB')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${terminologyMode === 'RAB' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  RAB Terminology
                </button>
                <button 
                  onClick={() => setTerminologyMode('SOW')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${terminologyMode === 'SOW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  SOW Terminology
                </button>
             </div>
           ) : (
             <div className="px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-500">
               Last Sync: {lastSyncLabel}
             </div>
           )}
           
           <div className="flex items-center gap-3">
              {activeTab === 'rab' && (
                <div className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Last Sync: {lastSyncLabel}
                </div>
              )}
              <button
                onClick={() => fetchApprovalCenterData(false)}
                disabled={syncing}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {syncing ? 'Syncing...' : 'Refresh'}
              </button>
              <div className="relative flex-1 max-w-md">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Cari Dokumen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm"
              />
              </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Details</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value Impact</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit Status</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* PO Tab */}
                  {activeTab === 'po' && pendingPOs.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{po.noPO}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Vendor: {po.supplier}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-slate-900 italic">Rp {po.total.toLocaleString('id-ID')}</span>
                          {po.total > 10000000 && <div className="text-[8px] font-black text-amber-600 uppercase mt-1 italic tracking-widest">High Value Threshold</div>}
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${po.total > 10000000 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                             {po.total > 10000000 ? 'Director Review' : 'Manager Approval'}
                          </span>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                             {canApprovePo(po.total) ? (
                               <>
                                 <button disabled={!!actionLoadingMap[`PO:${po.id}:APPROVE`]} onClick={() => { void handleApprovePO(po); }} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ThumbsUp size={18} /></button>
                                 <button disabled={!!actionLoadingMap[`PO:${po.id}:REJECT`]} onClick={() => { void handleRejectPO(po); }} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ThumbsDown size={18} /></button>
                               </>
                             ) : (
                               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))}

                  {/* Warehouse Tab */}
                  {activeTab === 'warehouse' && pendingRequests.map(mr => (
                    <tr key={mr.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{mr.noRequest}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Project: {mr.projectName}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <div className="flex flex-col items-end">
                             <span className="text-sm font-black text-slate-900 italic">{mr.items.length} Items</span>
                             <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">{mr.requestedBy}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          {(() => {
                            const mrStatus = normalizeStatus(mr.status);
                            const isApproved = mrStatus === 'APPROVED';
                            return (
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                            isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                             {isApproved ? 'Ready to Issue' : 'Pending Review'}
                          </span>
                            );
                          })()}
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                             {normalizeStatus(mr.status) === 'PENDING' ? (
                               canApproveRejectMr ? (
                                 <button disabled={!!actionLoadingMap[`MATERIAL_REQUEST:${mr.id}:APPROVE`]} onClick={() => { void handleApproveRequest(mr); }} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <PackageCheck size={14} /> Approve Request
                                 </button>
                               ) : (
                                 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                               )
                             ) : (
                               canIssueMr ? (
                                 <button disabled={!!actionLoadingMap[`MATERIAL_REQUEST:${mr.id}:ISSUE`]} onClick={() => { void handleIssueRequest(mr); }} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <ArrowRightLeft size={14} /> Issue to Site
                                 </button>
                               ) : (
                                 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                               )
                             )}
                             {normalizeStatus(mr.status) === 'PENDING' && canApproveRejectMr && (
                               <button disabled={!!actionLoadingMap[`MATERIAL_REQUEST:${mr.id}:REJECT`]} onClick={() => { void handleRejectRequest(mr); }} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><PackageX size={14} /></button>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))}

                  {/* Quotation Tab */}
                  {activeTab === 'rab' && pendingQuotations.map(q => (
                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{q.noPenawaran || q.id}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Client: {q.kepada || 'N/A'}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-indigo-600 italic">Rp {(q.grandTotal || 0).toLocaleString('id-ID')}</span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          {(() => {
                            const quoStatus = normalizeStatus(q.status);
                            return (
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                            quoStatus === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : quoStatus === 'REVIEW'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                             {getQuotationAuditLabel(q)}
                          </span>
                            );
                          })()}
                       </td>
                       <td className="px-10 py-8 text-center">
                          {normalizeStatus(q.status) === 'DRAFT' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewQuotation(q)}
                                className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                                title="Lihat quotation"
                              >
                                <Eye size={18} />
                              </button>
                              {canSendQuotation ? (
                                <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:SEND`]} onClick={() => { void handleSendQuotation(q); }} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                   <CheckCircle size={16} /> Send Quotation
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewQuotation(q)}
                                className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                                title="Lihat quotation"
                              >
                                <Eye size={18} />
                              </button>
                              {canApproveQuotationItem(q) || canRejectQuotationItem(q) ? (
                                <>
                                  {canApproveQuotationItem(q) && (
                                    <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:APPROVE`]} onClick={() => { void handleApproveQuotation(q); }} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                       <ThumbsUp size={18} />
                                    </button>
                                  )}
                                  {canRejectQuotationItem(q) && (
                                    <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:REJECT`]} onClick={() => { void handleRejectQuotation(q); }} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                       <ThumbsDown size={18} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  {normalizeStatus(q.status) === 'SENT' ? 'Menunggu SPV' : 'Owner Only'}
                                </span>
                              )}
                            </div>
                          )}
                       </td>
                    </tr>
                  ))}

                  {/* Invoice Tab */}
                  {activeTab === 'invoice' && pendingInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{inv.noInvoice}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Buyer: {inv.customer}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-emerald-600 italic">Rp {inv.totalBayar.toLocaleString('id-ID')}</span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-emerald-50 text-emerald-600 border-emerald-100">
                             Payment Verification
                          </span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          {canVerifyInvoice ? (
                            <button disabled={!!actionLoadingMap[`INVOICE:${inv.id}:VERIFY`]} onClick={() => { void handleVerifyInvoice(inv); }} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 mx-auto hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed">
                               <UserCheck size={16} /> Mark as Paid
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                          )}
                       </td>
                    </tr>
                  ))}

                  {countActiveTab() === 0 && (
                    <tr>
                       <td colSpan={4} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center opacity-20">
                             <ShieldCheck size={80} className="mb-4 text-slate-300" />
                             <p className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Antrean Bersih</p>
                             <p className="text-xs font-bold uppercase text-slate-400 mt-2">Semua dokumen telah diproses untuk kategori ini</p>
                          </div>
                       </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  function countActiveTab() {
    if (activeTab === 'po') return pendingPOs.length;
    if (activeTab === 'rab') return pendingQuotations.length;
    if (activeTab === 'invoice') return pendingInvoices.length;
    if (activeTab === 'warehouse') return pendingRequests.length;
    return 0;
  }
}
