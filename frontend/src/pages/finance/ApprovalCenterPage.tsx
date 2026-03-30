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
import { useApp } from "../../contexts/AppContext";
import { toast } from "sonner@2.0.3";
import { motion, AnimatePresence } from 'motion/react';
import api from "../../services/api";
import FlowHintBar from "../../components/ui/FlowHintBar";
import StatusGuideCard from "../../components/ui/StatusGuideCard";
import { subscribeDataSync } from "../../services/dataSyncBus";
import { isOwnerLike } from "../../utils/roles";

type ApprovalPoItem = {
  id: string;
  noPO: string;
  supplier: string;
  total: number;
  status: string;
  projectId?: string;
  auditStatus?: string;
  auditTrail?: string;
  availableActions?: string[];
};

type ApprovalQuotationItem = {
  id: string;
  noPenawaran: string;
  kepada: string;
  grandTotal: number;
  status: string;
  tanggal?: string;
  perihal?: string;
  sentAt?: string;
  sentBy?: string;
  sentByRole?: string;
  spvApprovedBy?: string;
  spvApprovedByRole?: string;
  spvApprovedAt?: string;
  approvedBy?: string;
  approvedByRole?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByRole?: string;
  rejectedAt?: string;
  rejectReason?: string;
  items: Array<{
    id?: string;
    kode: string;
    nama: string;
    qty: number;
    unit: string;
    harga?: number;
    total?: number;
  }>;
  auditStatus?: string;
  auditTrail?: string;
  availableActions?: string[];
};

type ApprovalInvoiceItem = {
  id: string;
  noInvoice: string;
  customer: string;
  totalBayar: number;
  status: string;
  verifiedBy?: string;
  verifiedByRole?: string;
  tanggalBayar?: string;
  auditStatus?: string;
  auditTrail?: string;
  availableActions?: string[];
};

type ApprovalMaterialRequestItem = {
  id: string;
  noRequest: string;
  projectName: string;
  requestedBy: string;
  status: string;
  approvedBy?: string;
  approvedByRole?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByRole?: string;
  rejectedAt?: string;
  issuedBy?: string;
  issuedByRole?: string;
  issuedAt?: string;
  rejectReason?: string;
  items: Array<Record<string, unknown>>;
  auditStatus?: string;
  auditTrail?: string;
  availableActions?: string[];
};

export default function ApprovalCenterPage() {
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
  const [selectedQuotationDetail, setSelectedQuotationDetail] = useState<ApprovalQuotationItem | null>(null);
  const [quotationTimeline, setQuotationTimeline] = useState<any[]>([]);
  const [quotationTimelineLoading, setQuotationTimelineLoading] = useState(false);
  const [quotationTimelineError, setQuotationTimelineError] = useState<string | null>(null);

  const normalizeStatus = (value: unknown) => String(value || "").trim().toUpperCase();
  const currentRole = String(currentUser?.role || "").trim().toUpperCase();
  const isActualOwner = currentRole === "OWNER";
  const isSpv = currentRole === "SPV";
  const isOwner = isOwnerLike(currentRole);
  const isAdmin = currentRole === "ADMIN";
  const isManager = currentRole === "MANAGER";
  const canSendQuotation = isOwner || isAdmin || isManager || currentRole === "SALES";
  const canVerifyInvoice = isOwner || isAdmin || isManager || currentRole === "FINANCE";
  const canApproveRejectMr = isActualOwner || isSpv;
  const canIssueMr = isOwner || isAdmin || currentRole === "SUPPLY_CHAIN" || currentRole === "WAREHOUSE" || currentRole === "PRODUKSI";
  const canApprovePo = () => isActualOwner || isSpv;
  const getPoAuditLabel = (po: ApprovalPoItem) => {
    if (po.auditStatus) return po.auditStatus;
    const status = normalizeStatus(po.status);
    if (status === "DRAFT") return "Ready to Send";
    if (status === "SENT") return "Owner / SPV Review";
    if (status === "PARTIAL") return "Receiving Partial";
    if (status === "RECEIVED") return "Received";
    return status.replace(/_/g, " ");
  };
  const getInvoiceAuditLabel = (inv: ApprovalInvoiceItem) => {
    if (inv.auditStatus) return inv.auditStatus;
    const status = normalizeStatus(inv.status);
    if (status === "UNPAID") return "Awaiting Verification";
    if (status === "PAID") return "Verified Paid";
    return status.replace(/_/g, " ");
  };
  const getInvoiceAuditTrail = (inv: ApprovalInvoiceItem) => {
    if (inv.auditTrail) return inv.auditTrail;
    if (inv.verifiedBy) {
      return `Verified by ${inv.verifiedBy}${inv.verifiedByRole ? ` (${inv.verifiedByRole})` : ""}`;
    }
    return "Waiting finance verification";
  };
  const getMrAuditLabel = (mr: ApprovalMaterialRequestItem) => {
    if (mr.auditStatus) return mr.auditStatus;
    const status = normalizeStatus(mr.status);
    if (status === "PENDING") return "Pending Review";
    if (status === "APPROVED") return "Ready to Issue";
    if (status === "ISSUED") return "Issued";
    if (status === "REJECTED") return "Rejected";
    return status.replace(/_/g, " ");
  };
  const getMrAuditTrail = (mr: ApprovalMaterialRequestItem) => {
    if (mr.auditTrail) return mr.auditTrail;
    const status = normalizeStatus(mr.status);
    if (status === "APPROVED" && mr.approvedBy) {
      return `Approved by ${mr.approvedBy}${mr.approvedByRole ? ` (${mr.approvedByRole})` : ""}`;
    }
    if (status === "ISSUED" && mr.issuedBy) {
      return `Issued by ${mr.issuedBy}${mr.issuedByRole ? ` (${mr.issuedByRole})` : ""}`;
    }
    if (status === "REJECTED" && mr.rejectedBy) {
      return `Rejected by ${mr.rejectedBy}${mr.rejectedByRole ? ` (${mr.rejectedByRole})` : ""}`;
    }
    return "Waiting approval";
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
      (normalizeStatus(q.status) === 'DRAFT' || normalizeStatus(q.status) === 'SENT' || normalizeStatus(q.status) === 'REVIEW' || normalizeStatus(q.status) === 'REJECTED') &&
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
    status === "DRAFT" || status === "SENT" || status === "REVIEW" || status === "REJECTED";
  const isPendingMaterialRequestStatus = (status: string) =>
    status === "PENDING" || status === "APPROVED";
  const canApproveQuotationItem = (q: ApprovalQuotationItem) => {
    if (Array.isArray(q.availableActions)) return q.availableActions.includes("APPROVE");
    const status = normalizeStatus(q.status);
    if (status === "SENT" || status === "REVIEW") return isOwner || isSpv;
    return false;
  };
  const canRejectQuotationItem = (q: ApprovalQuotationItem) => {
    if (Array.isArray(q.availableActions)) return q.availableActions.includes("REJECT");
    const status = normalizeStatus(q.status);
    if (status === "SENT" || status === "REVIEW") return isOwner || isSpv;
    return false;
  };
  const canReviewQuotationItem = (q: ApprovalQuotationItem) => {
    if (Array.isArray(q.availableActions)) return q.availableActions.includes("REVIEW");
    return false;
  };
  const getQuotationAuditLabel = (q: ApprovalQuotationItem) => {
    if (q.auditStatus) return q.auditStatus;
    const status = normalizeStatus(q.status);
    if (status === "DRAFT") return "Ready to Send";
    if (status === "SENT") return "Management Approval";
    if (status === "REVIEW") return "Management Review";
    if (status === "REJECTED") return "Rejected";
    if (status === "APPROVED") return "Approved";
    return "Processed";
  };
  const getQuotationAuditTrail = (q: ApprovalQuotationItem) => {
    if (q.auditTrail) return q.auditTrail;
    const status = normalizeStatus(q.status);
    if (status === "REVIEW") {
      const actor = q.spvApprovedBy ? `${q.spvApprovedBy}${q.spvApprovedByRole ? ` (${q.spvApprovedByRole})` : ""}` : "SPV";
      return `SPV reviewed by ${actor}`;
    }
    if (status === "APPROVED") {
      const actor = q.approvedBy ? `${q.approvedBy}${q.approvedByRole ? ` (${q.approvedByRole})` : ""}` : "Management";
      return `Approved by ${actor}`;
    }
    if (status === "REJECTED") {
      const actor = q.rejectedBy ? `${q.rejectedBy}${q.rejectedByRole ? ` (${q.rejectedByRole})` : ""}` : "Reviewer";
      return `Rejected by ${actor}`;
    }
    if (status === "SENT") {
      return q.sentBy ? `Sent by ${q.sentBy}` : "Waiting management approval";
    }
    return "Draft quotation";
  };
  const canResendRejectedQuotation = (q: ApprovalQuotationItem) =>
    Array.isArray(q.availableActions)
      ? q.availableActions.includes("SEND") && normalizeStatus(q.status) === "REJECTED"
      : normalizeStatus(q.status) === "REJECTED" && canSendQuotation;

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
      await fetchApprovalCenterData(true);
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
    setSelectedQuotationDetail(q);
    setQuotationTimeline([]);
    setQuotationTimelineError(null);
    setQuotationTimelineLoading(true);
    void api
      .get(`/quotations/${q.id}/approval-logs`)
      .then((res) => {
        setQuotationTimeline(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err: any) => {
        setQuotationTimelineError(err?.response?.data?.error || "Gagal memuat timeline approval quotation");
        setQuotationTimeline([]);
      })
      .finally(() => {
        setQuotationTimelineLoading(false);
      });
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

      <StatusGuideCard
        title="Panduan Status Approval"
        helper="Gunakan panduan ini untuk cepat membaca posisi dokumen sebelum menekan approve, reject, verify, atau issue."
        sections={[
          {
            title: "Quotation",
            items: [
              {
                label: "Draft",
                tone: "neutral",
                description: "Dokumen masih disusun sales dan belum dikirim untuk keputusan manajemen.",
              },
              {
                label: "Sent / Review",
                tone: "warning",
                description: "Quotation sudah masuk meja approval dan tinggal menunggu keputusan OWNER atau SPV.",
              },
              {
                label: "Approved",
                tone: "success",
                description: "Quotation sudah disetujui dan aman dilanjutkan ke tahap project atau pekerjaan berikutnya.",
              },
              {
                label: "Rejected",
                tone: "danger",
                description: "Quotation ditolak dan harus diperbaiki atau dikirim ulang sebelum lanjut.",
              },
            ],
          },
          {
            title: "Purchase Order",
            items: [
              {
                label: "Draft",
                tone: "neutral",
                description: "PO masih disusun dan belum siap diproses vendor atau receiving.",
              },
              {
                label: "Sent",
                tone: "info",
                description: "PO sudah diterbitkan dan biasanya menunggu review atau tindak lanjut proses barang masuk.",
              },
              {
                label: "Partial / Received",
                tone: "success",
                description: "Barang datang sebagian atau sudah diterima penuh, jadi tim gudang bisa lanjut cek receiving.",
              },
            ],
          },
          {
            title: "Invoice & Material Request",
            items: [
              {
                label: "Unpaid",
                tone: "warning",
                description: "Invoice belum diverifikasi lunas, jadi finance masih perlu cek pembayaran masuk.",
              },
              {
                label: "Paid",
                tone: "success",
                description: "Pembayaran sudah tervalidasi dan invoice tidak butuh tindak lanjut operasional.",
              },
              {
                label: "Pending / Approved / Issued",
                tone: "info",
                description: "Material request bergerak dari menunggu review, siap issue, lalu selesai dikeluarkan untuk lapangan.",
              },
              {
                label: "Rejected",
                tone: "danger",
                description: "Permintaan material ditolak dan perlu koreksi kebutuhan sebelum diajukan ulang.",
              },
            ],
          },
        ]}
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
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                            normalizeStatus(po.status) === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          }`}>
                             {getPoAuditLabel(po)}
                          </span>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                             {normalizeStatus(po.status) === 'SENT' && (po.availableActions || []).includes('APPROVE') ? (
                               <>
                                 <button disabled={!!actionLoadingMap[`PO:${po.id}:APPROVE`]} onClick={() => { void handleApprovePO(po); }} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ThumbsUp size={18} /></button>
                                 {(po.availableActions || []).includes('REJECT') && <button disabled={!!actionLoadingMap[`PO:${po.id}:REJECT`]} onClick={() => { void handleRejectPO(po); }} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ThumbsDown size={18} /></button>}
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
                              <div className="flex flex-col items-center gap-2">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                                  isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                   {getMrAuditLabel(mr)}
                                </span>
                                <div className="max-w-[240px] text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                                  {getMrAuditTrail(mr)}
                                </div>
                              </div>
                            );
                          })()}
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                             {normalizeStatus(mr.status) === 'PENDING' ? (
                               (mr.availableActions || []).includes('APPROVE') ? (
                                 <button disabled={!!actionLoadingMap[`MATERIAL_REQUEST:${mr.id}:APPROVE`]} onClick={() => { void handleApproveRequest(mr); }} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <PackageCheck size={14} /> Approve Request
                                 </button>
                               ) : (
                                 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                               )
                             ) : (
                               (mr.availableActions || []).includes('ISSUE') ? (
                                 <button disabled={!!actionLoadingMap[`MATERIAL_REQUEST:${mr.id}:ISSUE`]} onClick={() => { void handleIssueRequest(mr); }} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <ArrowRightLeft size={14} /> Issue to Site
                                 </button>
                               ) : (
                                 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Read Only</span>
                               )
                             )}
                             {normalizeStatus(mr.status) === 'PENDING' && (mr.availableActions || []).includes('REJECT') && (
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
                          <div className="flex flex-col items-center gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                            quoStatus === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : quoStatus === 'REVIEW'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : quoStatus === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-100'
                                  : quoStatus === 'APPROVED'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                             {getQuotationAuditLabel(q)}
                          </span>
                          <span className="max-w-[240px] text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                            {getQuotationAuditTrail(q)}
                          </span>
                          </div>
                            );
                          })()}
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleViewQuotation(q)}
                              className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                              title="Detail barang quotation"
                            >
                              <Eye size={18} />
                            </button>
                            {(normalizeStatus(q.status) === 'DRAFT' || canResendRejectedQuotation(q)) && (q.availableActions || []).includes('SEND') && (
                              <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:SEND`]} onClick={() => { void handleSendQuotation(q); }} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest italic flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                 <CheckCircle size={14} /> {normalizeStatus(q.status) === 'REJECTED' ? 'Send Again' : 'Send'}
                              </button>
                            )}
                            {canReviewQuotationItem(q) && (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-[9px] font-black uppercase tracking-widest italic border border-amber-100 cursor-default"
                              >
                                Review
                              </button>
                            )}
                            {canApproveQuotationItem(q) && (
                              <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:APPROVE`]} onClick={() => { void handleApproveQuotation(q); }} className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-widest italic border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                 Approve
                              </button>
                            )}
                            {canRejectQuotationItem(q) && (
                              <button disabled={!!actionLoadingMap[`QUOTATION:${q.id}:REJECT`]} onClick={() => { void handleRejectQuotation(q); }} className="px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-widest italic border border-rose-100 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                 Reject
                              </button>
                            )}
                            {!canApproveQuotationItem(q) && !canRejectQuotationItem(q) && normalizeStatus(q.status) !== 'DRAFT' && !canResendRejectedQuotation(q) && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                {normalizeStatus(q.status) === 'SENT' || normalizeStatus(q.status) === 'REVIEW' ? 'Menunggu Approval' : 'Read Only'}
                              </span>
                            )}
                          </div>
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
                          <div className="flex flex-col items-center gap-2">
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-emerald-50 text-emerald-600 border-emerald-100">
                               {getInvoiceAuditLabel(inv)}
                            </span>
                            <span className="max-w-[220px] text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                              {getInvoiceAuditTrail(inv)}
                            </span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          {(inv.availableActions || []).includes('VERIFY') ? (
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
      <AnimatePresence>
        {selectedQuotationDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setSelectedQuotationDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-5xl bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Quotation Detail</p>
                  <h3 className="text-2xl font-black italic tracking-tighter text-slate-900 uppercase">{selectedQuotationDetail.noPenawaran || selectedQuotationDetail.id}</h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">Client: {selectedQuotationDetail.kepada || "-"}</p>
                  {selectedQuotationDetail.perihal && (
                    <p className="text-sm text-slate-600 mt-3">{selectedQuotationDetail.perihal}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQuotationDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                >
                  Close
                </button>
              </div>
              <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50/40">
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Status</p>
                  <p className="text-sm font-black italic text-slate-900 mt-2">{getQuotationAuditLabel(selectedQuotationDetail)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Trail</p>
                  <p className="text-sm font-bold text-slate-700 mt-2">{getQuotationAuditTrail(selectedQuotationDetail)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</p>
                  <p className="text-sm font-bold text-slate-700 mt-2">{selectedQuotationDetail.tanggal || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</p>
                  <p className="text-sm font-black italic text-indigo-600 mt-2">Rp {(selectedQuotationDetail.grandTotal || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
              <div className="px-8 py-6">
                <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Kode</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Barang</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Qty</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Harga</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedQuotationDetail.items.length > 0 ? selectedQuotationDetail.items.map((item, index) => (
                        <tr key={item.id || `${selectedQuotationDetail.id}-${index}`}>
                          <td className="px-5 py-4 text-sm font-bold text-slate-700">{item.kode || "-"}</td>
                          <td className="px-5 py-4 text-sm font-black text-slate-900 uppercase">{item.nama || "-"}</td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-700 text-right">{item.qty || 0}</td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-700">{item.unit || "-"}</td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-700 text-right">Rp {Number(item.harga || 0).toLocaleString('id-ID')}</td>
                          <td className="px-5 py-4 text-sm font-black italic text-slate-900 text-right">Rp {Number(item.total || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                            Detail barang belum tersedia di quotation ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {selectedQuotationDetail.rejectReason && (
                  <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2">Reject Reason</p>
                    <p className="text-sm font-bold text-rose-700">{selectedQuotationDetail.rejectReason}</p>
                  </div>
                )}
                <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50/50 px-6 py-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Approval Timeline</p>
                      <p className="text-sm font-bold text-slate-600 mt-1">Timeline ini langsung diambil dari tabel approval log quotation.</p>
                    </div>
                  </div>
                  {quotationTimelineLoading ? (
                    <div className="text-sm font-bold text-slate-500">Loading timeline...</div>
                  ) : quotationTimelineError ? (
                    <div className="text-sm font-bold text-rose-600">{quotationTimelineError}</div>
                  ) : quotationTimeline.length === 0 ? (
                    <div className="text-sm font-bold text-slate-500">Belum ada audit trail quotation ini.</div>
                  ) : (
                    <div className="space-y-3">
                      {quotationTimeline.map((row: any) => (
                        <div key={row.id} className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                  {row?.action || "-"}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {row?.createdAt ? new Date(row.createdAt).toLocaleString('id-ID') : "-"}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-slate-700 mt-2">
                                {getApprovalActorLabel(row)} ({getApprovalRoleLabel(row?.actorRole)})
                              </p>
                            </div>
                            <div className="text-sm font-bold text-slate-600">
                              {row?.fromStatus || "-"} → {row?.toStatus || "-"}
                            </div>
                          </div>
                          {row?.reason ? (
                            <p className="mt-3 text-sm font-bold text-rose-600">Reason: {row.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

function getApprovalActorLabel(row: any) {
  const actorName = String(row?.metadata?.actorName || '').trim();
  if (actorName) return actorName;
  return row?.actorUserId || '-';
}

function getApprovalRoleLabel(role: string | undefined | null) {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "OWNER") return "Owner";
  if (normalized === "SPV") return "SPV";
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "MANAGER") return "Manager";
  if (normalized === "FINANCE") return "Finance";
  if (normalized === "SALES") return "Sales";
  return normalized;
}
