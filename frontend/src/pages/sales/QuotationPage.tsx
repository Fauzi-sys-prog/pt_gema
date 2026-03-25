import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, X, Printer, Save, Download, DollarSign, 
  CheckCircle, XCircle, Clock, Send, Copy, ArrowUpRight,
  TrendingUp, Calculator, Users, Package, Wrench, ShoppingCart,
  Percent, CreditCard, FileCheck, AlertCircle, Building2, Award,
  ChevronDown, ChevronRight, Zap, Target, Settings, Calendar,
  MapPin, Eye, Trash2, RefreshCcw, Edit
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { loadSampleQuotation } from '../../data/sampleQuotationGTP';
import api from '../../services/api';
import FlowHintBar from '../../components/ui/FlowHintBar';
import { getRoleLabel, isOwnerLike } from '../../utils/roles';

// Quotation Management Page - Transformed to Commercial Pricing Tool
export default function QuotationPage() {
  const { quotationList, addQuotation, updateQuotation, deleteQuotation, addAuditLog, dataCollectionList, projectList } = useApp();
  const { currentUser } = useAuth();
  const currentRoleUpper = String(currentUser?.role || '').toUpperCase();
  const isOwner = isOwnerLike(currentRoleUpper);
  const isSpv = currentRoleUpper === 'SPV';
  const canViewApprovalAudit =
    isOwnerLike(currentRoleUpper) || currentRoleUpper === 'ADMIN' || currentRoleUpper === 'MANAGER';
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSurveyListModal, setShowSurveyListModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showApprovalLogsModal, setShowApprovalLogsModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [selectedApprovalQuotation, setSelectedApprovalQuotation] = useState<any>(null);
  const [approvalLogs, setApprovalLogs] = useState<any[]>([]);
  const [approvalLogsLoading, setApprovalLogsLoading] = useState(false);
  const [approvalLogsError, setApprovalLogsError] = useState<string | null>(null);
  const [approvalActionFilter, setApprovalActionFilter] = useState<string>('ALL');
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [creationMode, setCreationMode] = useState<'from-survey' | 'manual'>('from-survey');
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [showAdvancedQuotationEditor, setShowAdvancedQuotationEditor] = useState(true);
  const [serverQuotationList, setServerQuotationList] = useState<any[] | null>(null);
  const [exportingQuotationId, setExportingQuotationId] = useState<string | null>(null);

  // Pricing Strategy State
  const [pricingStrategy, setPricingStrategy] = useState<'cost-plus' | 'market-based' | 'value-based'>('cost-plus');
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    manpower: true,
    materials: true,
    equipment: true,
    consumables: true
  });

  // Ensure quotation list is reactive even when context/server fetch timing differs.
  const safeQuotationList = useMemo(() => {
    const merged = new Map<string, any>();
    const serverRows = Array.isArray(serverQuotationList) ? serverQuotationList : [];
    const contextRows = Array.isArray(quotationList) ? quotationList : [];

    for (const row of serverRows) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      merged.set(key, row);
    }
    for (const row of contextRows) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      // Prefer context so optimistic create/update/delete appears instantly.
      merged.set(key, row);
    }
    return Array.from(merged.values());
  }, [serverQuotationList, quotationList]);

  useEffect(() => {
    let mounted = true;
    const normalizeList = (payload: unknown): any[] => {
      if (Array.isArray(payload)) return payload as any[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: any[] }).items;
      }
      return [];
    };

    const fetchQuotationList = async (silent = true) => {
      try {
        const res = await api.get('/quotations');
        if (!mounted) return;
        setServerQuotationList(normalizeList(res.data));
      } catch (err) {
        if (!mounted) return;
        if (!silent) toast.error('Gagal memuat quotation dari server');
      }
    };

    void fetchQuotationList(true);

    const onFocus = () => {
      void fetchQuotationList(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchQuotationList(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const getSurveyDate = (survey: any) =>
    survey?.tanggalPengumpulan || survey?.date || survey?.tanggalSurvey || survey?.createdAt || new Date().toISOString();

  const getSurveyStatus = (survey: any) => {
    const raw = String(survey?.status || "Draft").toLowerCase();
    if (["completed", "verified", "ready", "done", "final"].includes(raw)) return "Completed";
    if (["in progress", "progress", "ongoing"].includes(raw)) return "In Progress";
    return "Draft";
  };

  const hasSurveyPricingData = (survey: any) => {
    const manpower = Array.isArray(survey?.manpower) ? survey.manpower.length : 0;
    const materials = Array.isArray(survey?.materials) ? survey.materials.length : 0;
    const equipment = Array.isArray(survey?.equipment) ? survey.equipment.length : 0;
    const tools = Array.isArray(survey?.tools) ? survey.tools.length : 0;
    const consumables = Array.isArray(survey?.consumables) ? survey.consumables.length : 0;
    return manpower + materials + equipment + tools + consumables > 0;
  };

  const getDataCollectionSourceLabel = (dc: any) =>
    dc?.noKoleksi ||
    dc?.namaResponden ||
    dc?.namaKolektor ||
    dc?.customer ||
    dc?.id ||
    "Data Collection";

  const buildSourceSnapshotMeta = (survey: any) => ({
    sourceSnapshotAt: new Date().toISOString(),
    sourceSnapshotBy: currentUser?.name || currentUser?.username || "System",
    sourceSnapshotLabel: getDataCollectionSourceLabel(survey),
  });

  // Survey available for smart pricing (allow Draft too, as long as data exists)
  const availableSurveys = dataCollectionList.filter((dc) => hasSurveyPricingData(dc));
  const editingQuotation = editingQuotationId
    ? safeQuotationList.find((q: any) => q.id === editingQuotationId)
    : null;

  const formatDisplayDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("id-ID");
  };

  const handleBackendQuotationWordExport = async (quotation: any) => {
    const id = String(quotation?.id || '').trim();
    if (!id) {
      toast.error('ID quotation tidak valid untuk export');
      return;
    }
    const safeNo = String(quotation?.noPenawaran || quotation?.nomorQuotation || id).replace(/[^\w.-]+/g, '_');
    setExportingQuotationId(id);
    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/quotations/${id}/word`, { responseType: 'blob' }),
        api.get(`/exports/quotations/${id}/excel`, { responseType: 'blob' }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: 'application/msword' });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `quotation_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `quotation_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);
      toast.success('Export Word + Excel quotation berhasil');
    } catch {
      toast.error('Export Word + Excel gagal, silakan coba lagi');
    } finally {
      setExportingQuotationId(null);
    }
  };

  const [formData, setFormData] = useState({
    noPenawaran: '',
    revisi: 'A',
    tanggal: new Date().toISOString().split('T')[0],
    jenisQuotation: 'Jasa' as 'Jasa' | 'Material',
    kepada: '',
    perusahaan: '',
    lokasi: '',
    up: '',
    lampiran: '-',
    perihal: '',
    validityDays: 30,
    dataCollectionId: '', // Track which survey this came from
    // Multi-unit pricing
    unitCount: 1,
    enableMultiUnit: false,
  });

  // Pricing Configuration
  const [pricingConfig, setPricingConfig] = useState({
    // Markup by category (%)
    manpowerMarkup: 25,
    materialsMarkup: 20,
    equipmentMarkup: 30,
    consumablesMarkup: 15,
    // Additional fees
    overheadPercent: 10,
    contingencyPercent: 5,
    // Discount
    discountPercent: 0,
    discountReason: '',
  });

  // Payment Terms
  const [paymentTerms, setPaymentTerms] = useState({
    type: 'termin' as 'full' | 'termin' | 'dp-progress',
    termins: [
      { label: 'DP (Down Payment)', percent: 30, timing: 'Setelah PO' },
      { label: 'Termin 1', percent: 30, timing: '30% Progress' },
      { label: 'Termin 2', percent: 30, timing: '60% Progress' },
      { label: 'Pelunasan', percent: 10, timing: 'Setelah BAST' },
    ],
    paymentDueDays: 30,
    retention: 5, // % retention
    retentionPeriod: 90, // days
    // Penalty clause
    penaltyEnabled: false,
    penaltyRate: 0.1,
    penaltyMax: 5,
    penaltyCondition: 'keterlambatan penyelesaian pekerjaan',
  });

  // Commercial Terms
  const [commercialTerms, setCommercialTerms] = useState({
    warranty: '12 bulan setelah BAST',
    delivery: 'FOB Warehouse',
    installation: 'Termasuk instalasi dan commissioning',
    penalty: '0.1% per hari (max 5% dari nilai kontrak)',
    conditions: [
      'Harga belum termasuk PPN 11%',
      'Harga sudah termasuk biaya pengiriman area Jakarta',
      'Pembayaran melalui transfer ke rekening perusahaan',
      'Force majeure: bencana alam, kebakaran, perang, dll',
    ],
    // Scope & Exclusions
    scopeOfWork: [] as string[],
    exclusions: [] as string[],
    projectDuration: 0,
    penaltyOvertime: 0,
  });

  // Pricing Items - Populated from Survey or Manual
  const [pricingItems, setPricingItems] = useState<{
    manpower: any[],
    materials: any[],
    equipment: any[],
    consumables: any[]
  }>({
    manpower: [],
    materials: [],
    equipment: [],
    consumables: []
  });

  type UiQuotationStatus = "Draft" | "Sent" | "Review" | "Approved" | "Rejected";

  const normalizeStatus = (raw: unknown): UiQuotationStatus => {
    const v = String(raw || "").toUpperCase();
    if (v === "SENT") return "Sent";
    if (v === "REVIEW" || v === "REVIEW_SPV") return "Review";
    if (v === "APPROVED") return "Approved";
    if (v === "REJECTED") return "Rejected";
    return "Draft";
  };

  const getAllowedStatuses = (quotation: any): UiQuotationStatus[] => {
    if (isQuotationLockedByApprovedProject(quotation?.id)) {
      return [normalizeStatus(quotation?.status)];
    }
    const current = normalizeStatus(quotation?.status);

    if (current === "Approved") return ["Approved"];
    if (current === "Rejected") return isOwner ? ["Rejected", "Draft"] : ["Rejected"];
    if (current === "Review") {
      return isOwner ? ["Review", "Approved", "Rejected", "Draft"] : ["Review"];
    }

    if (current === "Sent") {
      if (isSpv) return ["Sent", "Draft", "Review", "Approved", "Rejected"];
      if (isOwner) return ["Sent", "Draft", "Review", "Approved", "Rejected"];
      return ["Sent", "Draft"];
    }

    // Draft
    return ["Draft", "Sent"];
  };

  const isQuotationLockedByApprovedProject = (quotationId?: string) => {
    if (!quotationId) return false;
    return (projectList || []).some((p: any) => {
      const approval = String(p?.approvalStatus || "").toUpperCase();
      return approval === "APPROVED" && p?.quotationId === quotationId;
    });
  };

  const canExportFinalQuotation = (quotation: any) => {
    return normalizeStatus(quotation?.status) === "Approved";
  };

  const loadQuotationApprovalLogs = async (quotation: any) => {
    if (!quotation?.id) return;
    setSelectedApprovalQuotation(quotation);
    setShowApprovalLogsModal(true);
    setApprovalLogsLoading(true);
    setApprovalLogsError(null);
    setApprovalActionFilter('ALL');
    try {
      const res = await api.get(`/quotations/${quotation.id}/approval-logs`);
      setApprovalLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Gagal mengambil approval logs quotation';
      setApprovalLogsError(msg);
      setApprovalLogs([]);
    } finally {
      setApprovalLogsLoading(false);
    }
  };

  const filteredApprovalLogs = approvalActionFilter === 'ALL'
    ? approvalLogs
    : approvalLogs.filter((row: any) => String(row?.action || '').toUpperCase() === approvalActionFilter);

  const getApprovalActorLabel = (row: any) => {
    const actorName = String(row?.metadata?.actorName || '').trim();
    if (actorName) return actorName;
    return row?.actorUserId || '-';
  };

  const mapSurveyToPricingItems = (survey: any, config: any) => ({
    manpower: (survey.manpower || []).map((mp: any) => {
      const quantity = mp.quantity ?? mp.jumlah ?? 1;
      const duration = mp.duration ?? mp.durasi ?? 1;
      const costPerUnit = mp.upah ?? mp.rate ?? mp.costPerUnit ?? mp.costPerDay ?? 0;
      const totalCost = costPerUnit * quantity * duration;
      const markup = config.manpowerMarkup ?? 25;
      return {
        id: `mp-${Date.now()}-${Math.random()}`,
        description: mp.position || mp.jabatan || mp.role || 'Tenaga Kerja',
        quantity,
        unit: 'Orang',
        duration,
        durationUnit: mp.durationUnit || 'Hari',
        costPerUnit,
        totalCost,
        markup,
        sellingPrice: totalCost * (1 + markup / 100),
        notes: mp.notes || mp.keterangan || (mp.assignedPerson ? `PIC: ${mp.assignedPerson}` : ''),
      };
    }),
    materials: (survey.materials || []).map((mat: any) => {
      const quantity = mat.qtyEstimate ?? mat.qty ?? mat.qtyInstalled ?? mat.qtyDelivery ?? 0;
      const costPerUnit = mat.hargaSatuan ?? mat.price ?? mat.unitPrice ?? 0;
      const totalCost = costPerUnit * quantity;
      const markup = config.materialsMarkup ?? 20;
      return {
        id: `mat-${Date.now()}-${Math.random()}`,
        description: mat.materialName || mat.productName || mat.nama || 'Material',
        quantity,
        unit: mat.unit || mat.unitInstalled || mat.unitDelivery || 'Pcs',
        costPerUnit,
        totalCost,
        markup,
        sellingPrice: totalCost * (1 + markup / 100),
        supplier: mat.supplier || '',
        notes: mat.notes || mat.keterangan || '',
      };
    }),
    equipment: ((survey.equipment || survey.tools) || []).map((eq: any) => {
      const quantity = eq.quantity ?? eq.jumlah ?? 1;
      const duration = eq.duration ?? eq.durasi ?? 1;
      const costPerUnit = eq.biayaSewa ?? eq.cost ?? eq.rate ?? eq.unitPrice ?? 0;
      const totalCost = costPerUnit * quantity * duration;
      const markup = config.equipmentMarkup ?? 30;
      return {
        id: `eq-${Date.now()}-${Math.random()}`,
        description: eq.equipmentName || eq.namaAlat || eq.nama || 'Equipment',
        quantity,
        unit: eq.unit || eq.satuan || 'Unit',
        duration,
        durationUnit: 'Hari',
        costPerUnit,
        totalCost,
        markup,
        sellingPrice: totalCost * (1 + markup / 100),
        notes: eq.notes || eq.keterangan || (eq.supplier ? `Supplier: ${eq.supplier}` : ''),
      };
    }),
    consumables: (survey.consumables || []).map((cons: any) => {
      const quantity = cons.quantity ?? cons.qty ?? 0;
      const costPerUnit = cons.hargaSatuan ?? cons.price ?? cons.unitPrice ?? 0;
      const totalCost = costPerUnit * quantity;
      const markup = config.consumablesMarkup ?? 15;
      return {
        id: `cons-${Date.now()}-${Math.random()}`,
        description: cons.itemName || cons.nama || 'Consumable',
        quantity,
        unit: cons.unit || cons.satuan || 'Pcs',
        costPerUnit,
        totalCost,
        markup,
        sellingPrice: totalCost * (1 + markup / 100),
        notes: cons.notes || cons.keterangan || cons.category || '',
      };
    })
  });

  const normalizeStringList = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return input
        .map((v) => String(v ?? "").trim())
        .filter((v) => v.length > 0);
    }
    if (typeof input === "string") {
      return input
        .split(/\r?\n|;/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return [];
  };

  const extractSurveyTerms = (survey: any) => {
    const scopeOfWork = normalizeStringList(
      survey?.scopeOfWork ?? survey?.scope_of_work ?? survey?.scope ?? survey?.ruangLingkup
    );
    const exclusions = normalizeStringList(
      survey?.exclusions ?? survey?.pengecualian ?? survey?.excludeItems
    );
    const projectDuration =
      Number(survey?.durasiProyekHari ?? survey?.projectDuration ?? survey?.durationDays) || 0;

    return { scopeOfWork, exclusions, projectDuration };
  };

  const calculateCommercialTotalsFrom = (items: any, config: any) => {
    let totalCost = 0;
    let totalSelling = 0;

    Object.values(items).forEach((list: any) => {
      list.forEach((item: any) => {
        totalCost += item.totalCost || 0;
        totalSelling += item.sellingPrice || 0;
      });
    });

    const overhead = totalSelling * ((config.overheadPercent ?? 10) / 100);
    const subtotalWithOverhead = totalSelling + overhead;
    const contingency = subtotalWithOverhead * ((config.contingencyPercent ?? 5) / 100);
    const subtotalWithContingency = subtotalWithOverhead + contingency;
    const discount = subtotalWithContingency * ((config.discountPercent ?? 0) / 100);
    const grandTotal = subtotalWithContingency - discount;
    const grossProfit = grandTotal - totalCost;
    const marginPercent = totalCost > 0 ? (grossProfit / grandTotal) * 100 : 0;

    return {
      totalCost,
      totalSelling,
      overhead,
      contingency,
      discount,
      grandTotal,
      grossProfit,
      marginPercent,
    };
  };

  const handleChangeStatus = async (quotation: any, newStatus: UiQuotationStatus) => {
    if (isQuotationLockedByApprovedProject(quotation?.id)) {
      toast.error("Quotation terkunci karena sudah dipakai project Approved.");
      return;
    }
    const allowed = getAllowedStatuses(quotation);
    if (!allowed.includes(newStatus)) {
      toast.error(`Status ${quotation?.status || "Draft"} tidak bisa diubah ke ${newStatus}`);
      return;
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: newStatus };

    if (newStatus === "Sent") patch.sentAt = now;

    try {
      await updateQuotation(quotation.id, patch as any);
      addAuditLog({
        action: "UPDATE_QUOTATION_STATUS",
        module: "Sales",
        details: `Status ${quotation.noPenawaran} diubah: ${quotation.status} -> ${newStatus}`,
        status: "Success",
      });
      toast.success(`Status quotation diubah ke ${newStatus}`);
    } catch {
      // Error toast already handled in AppContext.
    }
  };

  const handleRefreshFromDataCollection = async (quotation: any) => {
    if (isQuotationLockedByApprovedProject(quotation?.id)) {
      toast.error("Quotation terkunci karena sudah dipakai project Approved.");
      return;
    }
    if (!quotation?.dataCollectionId) {
      toast.error('Quotation ini tidak terhubung ke Data Collection');
      return;
    }

    if (normalizeStatus(quotation?.status) === 'Rejected') {
      toast.error('Quotation Rejected tidak boleh di-refresh harga');
      return;
    }

    const survey = dataCollectionList.find((dc) => dc.id === quotation.dataCollectionId);
    if (!survey) {
      toast.error('Data Collection sumber tidak ditemukan');
      return;
    }

    const config = {
      manpowerMarkup: quotation?.pricingConfig?.manpowerMarkup ?? pricingConfig.manpowerMarkup,
      materialsMarkup: quotation?.pricingConfig?.materialsMarkup ?? pricingConfig.materialsMarkup,
      equipmentMarkup: quotation?.pricingConfig?.equipmentMarkup ?? pricingConfig.equipmentMarkup,
      consumablesMarkup: quotation?.pricingConfig?.consumablesMarkup ?? pricingConfig.consumablesMarkup,
      overheadPercent: quotation?.pricingConfig?.overheadPercent ?? pricingConfig.overheadPercent,
      contingencyPercent: quotation?.pricingConfig?.contingencyPercent ?? pricingConfig.contingencyPercent,
      discountPercent: quotation?.pricingConfig?.discountPercent ?? pricingConfig.discountPercent,
    };

    const refreshedItems = mapSurveyToPricingItems(survey, config);
    const totals = calculateCommercialTotalsFrom(refreshedItems, config);
    const sourceMeta = buildSourceSnapshotMeta(survey);
    const surveyTerms = extractSurveyTerms(survey);

    try {
      await updateQuotation(quotation.id, {
        pricingItems: refreshedItems,
        pricingConfig: {
          ...(quotation?.pricingConfig || {}),
          ...config,
        },
        ...totals,
        sourceType: 'from-survey',
        surveyReference: {
          id: survey.id,
          noKoleksi: survey.noKoleksi,
          namaResponden: survey.namaResponden,
        },
        commercialTerms: {
          ...(quotation?.commercialTerms || {}),
          ...(surveyTerms.scopeOfWork.length > 0 ? { scopeOfWork: surveyTerms.scopeOfWork } : {}),
          ...(surveyTerms.exclusions.length > 0 ? { exclusions: surveyTerms.exclusions } : {}),
          ...(surveyTerms.projectDuration > 0 ? { projectDuration: surveyTerms.projectDuration } : {}),
        },
        ...sourceMeta,
      } as any);

      addAuditLog({
        action: "REFRESH_QUOTATION_FROM_SURVEY",
        module: "Sales",
        details: `Harga ${quotation.noPenawaran} di-refresh dari survey ${survey.noKoleksi || survey.id}`,
        status: "Success",
      });

      toast.success('Harga quotation berhasil di-update dari Data Collection');
    } catch {
      // Error toast already handled in AppContext.
    }
  };

  const handleEditQuotation = (quotation: any) => {
    if (isQuotationLockedByApprovedProject(quotation?.id)) {
      toast.error("Quotation terkunci karena sudah dipakai project Approved.");
      return;
    }
    setEditingQuotationId(quotation.id);
    setCreationMode(quotation?.dataCollectionId ? 'from-survey' : 'manual');
    setSelectedSurvey(quotation?.surveyReference || null);

    setFormData({
      noPenawaran: quotation.noPenawaran || '',
      revisi: quotation.revisi || 'A',
      tanggal: quotation.tanggal || new Date().toISOString().split('T')[0],
      jenisQuotation: quotation.jenisQuotation || 'Jasa',
      kepada: quotation.kepada || '',
      perusahaan: quotation.perusahaan || '',
      lokasi: quotation.lokasi || '',
      up: quotation.up || '',
      lampiran: quotation.lampiran || '-',
      perihal: quotation.perihal || '',
      validityDays: quotation.validityDays || 30,
      dataCollectionId: quotation.dataCollectionId || '',
      unitCount: quotation.unitCount || 1,
      enableMultiUnit: !!quotation.enableMultiUnit,
    });

    setPricingStrategy(quotation.pricingStrategy || 'cost-plus');
    setPricingConfig({
      ...pricingConfig,
      ...(quotation.pricingConfig || {}),
    });
    setPricingItems({
      manpower: quotation?.pricingItems?.manpower || [],
      materials: quotation?.pricingItems?.materials || [],
      equipment: quotation?.pricingItems?.equipment || [],
      consumables: quotation?.pricingItems?.consumables || [],
    });
    setPaymentTerms(quotation.paymentTerms || paymentTerms);
    setCommercialTerms(quotation.commercialTerms || commercialTerms);
    setShowAdvancedQuotationEditor(true);
    setShowCreateModal(true);
  };

  // Generate nomor penawaran
  const generateNoPenawaran = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    const maxNumberThisYear = safeQuotationList.reduce((max, q: any) => {
      const qYear = new Date(q?.tanggal || "").getFullYear();
      if (qYear !== year) return max;

      const firstPart = String(q?.noPenawaran || "").split("/")[0];
      const numeric = Number.parseInt(firstPart, 10);
      if (Number.isNaN(numeric)) return max;
      return Math.max(max, numeric);
    }, 0);

    const nextNumber = maxNumberThisYear + 1;
    return `${String(nextNumber).padStart(3, '0')}/${formData.revisi}/PEN/GTP/${romanMonths[month - 1]}/${year}`;
  };

  // Load data from selected survey
  const loadFromSurvey = (survey: any) => {
    setSelectedSurvey(survey);
    
    // Populate form data
    setFormData(prev => ({
      ...prev,
      kepada: survey.namaResponden || survey.customer || '',
      perusahaan: survey.customer || survey.namaResponden || '',
      lokasi: survey.lokasi || '',
      perihal: `Penawaran ${survey.tipePekerjaan || 'Pekerjaan'}`,
      dataCollectionId: survey.id,
    }));

    // Transform survey data to pricing items with COST only
    const transformedPricing = mapSurveyToPricingItems(survey, pricingConfig);
    const surveyTerms = extractSurveyTerms(survey);

    setPricingItems(transformedPricing);
    setCommercialTerms((prev) => ({
      ...prev,
      ...(surveyTerms.scopeOfWork.length > 0 ? { scopeOfWork: surveyTerms.scopeOfWork } : {}),
      ...(surveyTerms.exclusions.length > 0 ? { exclusions: surveyTerms.exclusions } : {}),
      ...(surveyTerms.projectDuration > 0 ? { projectDuration: surveyTerms.projectDuration } : {}),
    }));
    
    toast.success('Data survey berhasil dimuat', {
      description: `${survey.noKoleksi || survey.id} - ${survey.namaResponden || survey.customer || 'Survey'}`
    });

    setShowSurveyListModal(false);
  };

  // Calculate selling prices based on markup
  const calculatePricing = () => {
    const updated = { ...pricingItems };
    
    // Apply markup to each category
    Object.keys(updated).forEach(category => {
      updated[category as keyof typeof updated] = updated[category as keyof typeof updated].map((item: any) => {
        const markupPercent = item.markup || 0;
        const totalCost = item.totalCost || 0;
        const sellingPrice = totalCost * (1 + markupPercent / 100);
        return { ...item, sellingPrice };
      });
    });

    setPricingItems(updated);
  };

  // Recalculate when markup changes
  React.useEffect(() => {
    calculatePricing();
  }, [pricingConfig]);

  // Handle navigation from Data Collection
  React.useEffect(() => {
    const navState = (location.state || {}) as any;
    const dcId =
      navState.dataCollectionId ||
      navState.selectedDataCollectionId;
    const shouldAutoOpen =
      (navState.fromDataCollection && !!navState.dataCollectionId) ||
      (navState.openQuotationModal && !!navState.selectedDataCollectionId);

    if (shouldAutoOpen && dcId) {
      const dataCollection = dataCollectionList.find(dc => dc.id === dcId);
      
      if (dataCollection) {
        // Auto-open modal and load data
        setCreationMode('from-survey');
        loadFromSurvey(dataCollection);
        setShowAdvancedQuotationEditor(true);
        setShowCreateModal(true);
        
        // Clear location state to prevent re-triggering
        window.history.replaceState({}, document.title);
        
        toast.success(`📋 Data dari "${dataCollection.namaResponden}" berhasil dimuat!`);
      }
    }
  }, [location.state, dataCollectionList]);

  React.useEffect(() => {
    const navState = (location.state || {}) as any;
    const openPreviewQuotationId = navState.openPreviewQuotationId;
    if (!openPreviewQuotationId) return;

    const targetQuotation = safeQuotationList.find((q: any) => q.id === openPreviewQuotationId);
    if (!targetQuotation) return;

    setSelectedQuotation(targetQuotation);
    setShowPreview(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, safeQuotationList]);

  // Calculate totals with commercial components
  const calculateCommercialTotals = () => {
    let totalCost = 0;
    let totalSelling = 0;

    Object.values(pricingItems).forEach(items => {
      items.forEach(item => {
        totalCost += item.totalCost || 0;
        totalSelling += item.sellingPrice || 0;
      });
    });

    // Add overhead
    const overhead = totalSelling * (pricingConfig.overheadPercent / 100);
    const subtotalWithOverhead = totalSelling + overhead;

    // Add contingency
    const contingency = subtotalWithOverhead * (pricingConfig.contingencyPercent / 100);
    const subtotalWithContingency = subtotalWithOverhead + contingency;

    // Apply discount
    const discount = subtotalWithContingency * (pricingConfig.discountPercent / 100);
    const grandTotal = subtotalWithContingency - discount;

    // Gross profit
    const grossProfit = grandTotal - totalCost;
    const marginPercent = totalCost > 0 ? (grossProfit / grandTotal) * 100 : 0;

    return {
      totalCost,
      totalSelling,
      overhead,
      contingency,
      discount,
      grandTotal,
      grossProfit,
      marginPercent
    };
  };

  // Load Sample Quotation - PT Gema Teknik Perkasa Real Case
  const handleLoadSample = async () => {
    let sample: any = null;
    let sampleSource = "local-fallback";

    try {
      const res = await api.get("/quotations/sample");
      if (res?.data?.sample && typeof res.data.sample === "object") {
        sample = res.data.sample;
        sampleSource = String(res.data.source || "backend");
      }
    } catch {
      // Fallback to local sample below.
    }

    if (!sample) {
      sample = loadSampleQuotation();
    }
    
    setFormData({
      noPenawaran: sample.noPenawaran || "",
      revisi: sample.revisi || "A",
      tanggal: sample.tanggal || new Date().toISOString().slice(0, 10),
      jenisQuotation: sample.jenisQuotation || "Jasa",
      kepada: sample.kepada || "",
      perusahaan: sample.perusahaan || sample.kepada || "",
      lokasi: sample.lokasi || "",
      up: sample.up || "",
      lampiran: sample.lampiran || "-",
      perihal: sample.perihal || "Penawaran Pekerjaan",
      validityDays: sample.validityDays || 30,
      dataCollectionId: sample.dataCollectionId || "",
      unitCount: sample.unitCount || 1,
      enableMultiUnit: !!sample.enableMultiUnit
    });

    setPricingStrategy(sample.pricingStrategy || "cost-plus");
    setPricingConfig(sample.pricingConfig || pricingConfig);
    setPricingItems(sample.pricingItems || { manpower: [], materials: [], equipment: [], consumables: [] });
    setPaymentTerms(sample.paymentTerms || paymentTerms);
    setCommercialTerms(sample.commercialTerms || commercialTerms);
    
    setCreationMode('manual');
    setShowAdvancedQuotationEditor(true);
    setShowCreateModal(true);

    toast.success('Contoh quotation berhasil dimuat', {
      description: sampleSource === "local-fallback"
        ? "Fallback local sample"
        : `Source: ${sampleSource}`
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const commercialTotals = calculateCommercialTotals();
    const generatedNoPenawaran = generateNoPenawaran();
    const noPenawaran = editingQuotationId ? (formData.noPenawaran || generatedNoPenawaran) : generatedNoPenawaran;
    const sourceMeta =
      creationMode === "from-survey" && formData.dataCollectionId
        ? buildSourceSnapshotMeta(
            dataCollectionList.find((dc) => dc.id === formData.dataCollectionId) || selectedSurvey
          )
        : {};
    
    const baseQuotation = {
      id: editingQuotationId || `QUO-${Date.now()}`,
      ...formData,
      noPenawaran,
      pricingStrategy,
      pricingConfig,
      pricingItems,
      paymentTerms,
      commercialTerms,
      ...commercialTotals,
      status: (editingQuotation?.status || 'Draft') as any,
      createdBy: editingQuotation?.createdBy || 'Admin',
      createdAt: editingQuotation?.createdAt || new Date().toISOString(),
      sourceType: creationMode,
      surveyReference: selectedSurvey ? {
        id: selectedSurvey.id,
        noKoleksi: selectedSurvey.noKoleksi,
        namaResponden: selectedSurvey.namaResponden
      } : null,
      ...sourceMeta,
    };

    try {
      if (editingQuotationId) {
        await updateQuotation(editingQuotationId, baseQuotation as any);
        addAuditLog({
          action: 'UPDATE_QUOTATION',
          module: 'Sales',
          details: `Update Quotation ${noPenawaran} - ${formData.kepada} | Margin: ${commercialTotals.marginPercent.toFixed(1)}%`,
          status: 'Success'
        });
        toast.success('Quotation berhasil di-update');
      } else {
        await addQuotation(baseQuotation as any);
        addAuditLog({
          action: 'CREATE_QUOTATION',
          module: 'Sales',
          details: `Membuat Quotation ${noPenawaran} - ${formData.kepada} | Margin: ${commercialTotals.marginPercent.toFixed(1)}%`,
          status: 'Success'
        });
        toast.success('Quotation berhasil dibuat');
      }

      setShowCreateModal(false);
      resetForm();
    } catch {
      // Error toast already handled in AppContext.
    }
  };

  const resetForm = () => {
    setEditingQuotationId(null);
    setFormData({
      noPenawaran: '',
      revisi: 'A',
      tanggal: new Date().toISOString().split('T')[0],
      jenisQuotation: 'Jasa',
      kepada: '',
      perusahaan: '',
      lokasi: '',
      up: '',
      lampiran: '-',
      perihal: '',
      validityDays: 30,
      dataCollectionId: '',
    });
    setPricingItems({
      manpower: [],
      materials: [],
      equipment: [],
      consumables: []
    });
    setSelectedSurvey(null);
    setCreationMode('from-survey');
  };

  const addManualItem = (category: 'manpower' | 'materials' | 'equipment' | 'consumables') => {
    const newItem = {
      id: `${category}-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: category === 'manpower' ? 'Orang' : 'Pcs',
      costPerUnit: 0,
      totalCost: 0,
      markup: pricingConfig[`${category}Markup` as keyof typeof pricingConfig] as number,
      sellingPrice: 0,
      notes: '',
      ...(category === 'manpower' || category === 'equipment' ? { duration: 1, durationUnit: 'Hari' } : {})
    };

    setPricingItems(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }));
  };

  const updateItem = (category: string, itemId: string, field: string, value: any) => {
    setPricingItems(prev => ({
      ...prev,
      [category]: prev[category as keyof typeof prev].map((item: any) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          
          // Recalculate total cost
          if (field === 'quantity' || field === 'costPerUnit' || field === 'duration') {
            const qty = updated.quantity || 0;
            const cost = updated.costPerUnit || 0;
            const dur = updated.duration || 1;
            updated.totalCost = cost * qty * (category === 'manpower' || category === 'equipment' ? dur : 1);
            updated.sellingPrice = updated.totalCost * (1 + (updated.markup || 0) / 100);
          }

          // Recalculate selling price if markup changes
          if (field === 'markup') {
            updated.sellingPrice = updated.totalCost * (1 + (value || 0) / 100);
          }

          return updated;
        }
        return item;
      })
    }));
  };

  const deleteItem = (category: string, itemId: string) => {
    setPricingItems(prev => ({
      ...prev,
      [category]: prev[category as keyof typeof prev].filter((item: any) => item.id !== itemId)
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updatePaymentTermin = (index: number, field: string, value: any) => {
    const newTermins = [...paymentTerms.termins];
    newTermins[index] = { ...newTermins[index], [field]: value };
    setPaymentTerms({ ...paymentTerms, termins: newTermins });
  };

  const addPaymentTermin = () => {
    setPaymentTerms({
      ...paymentTerms,
      termins: [
        ...paymentTerms.termins,
        { label: `Termin ${paymentTerms.termins.length + 1}`, percent: 0, timing: '' }
      ]
    });
  };

  const commercialTotals = calculateCommercialTotals();

  // Filtered quotations
  const filteredQuotations = safeQuotationList.filter(q => {
    const matchSearch = q.noPenawaran?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       q.kepada?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      filterStatus === 'All' ||
      normalizeStatus(q.status) === normalizeStatus(filterStatus);
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    const normalized = normalizeStatus(status);
    const variants: any = {
      Draft: 'bg-gray-100 text-gray-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Approved: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
      Sent: 'bg-blue-100 text-blue-800',
      Review: 'bg-amber-100 text-amber-800',
    };
    return variants[normalized] || variants.Draft;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Commercial Quotation Management</h1>
            <p className="text-sm text-gray-600">Transform Technical Data → Commercial Proposal with Smart Pricing</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <FileText className="w-3.5 h-3.5" />
              Total Quotations
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              Draft
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => normalizeStatus(q.status) === 'Draft').length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Send className="w-3.5 h-3.5 text-blue-600" />
              Sent
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => normalizeStatus(q.status) === 'Sent').length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              Linked Project
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => !!(q as any).projectId).length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              Avg Margin
            </div>
            <div className="font-bold text-gray-900">
              {safeQuotationList.length > 0 
                ? (safeQuotationList.reduce((sum, q) => sum + (q.marginPercent || 0), 0) / safeQuotationList.length).toFixed(1)
                : '0.0'}%
            </div>
          </div>
        </div>

        <FlowHintBar
          className="mt-3"
          title="Alur Quotation:"
          badges={[
            { label: "Draft", tone: "neutral" },
            { label: "Sent", tone: "info" },
            { label: "Approved = Final Export Ready", tone: "success" },
            { label: "Rejected", tone: "danger" },
            { label: "Locked jika dipakai Project Approved", tone: "warning" },
          ]}
          helper="Export final dokumen quotation hanya aktif pada status Approved."
          actions={[
            { label: "Buka Approval Hub", onClick: () => navigate('/finance/approvals') },
            { label: "Buka Project Ledger", onClick: () => navigate('/project') },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <button
          onClick={() => {
            setCreationMode('from-survey');
            if (availableSurveys.length > 0) {
              setShowSurveyListModal(true);
            } else {
              toast.error('Belum ada data survey yang bisa dipakai', {
                description: 'Isi minimal manpower/material/equipment/tools di Data Collection terlebih dahulu'
              });
            }
          }}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Zap className="w-5 h-5" />
          Create from Survey (Smart Pricing)
        </button>
        <button
          onClick={() => {
            setCreationMode('manual');
            setShowAdvancedQuotationEditor(true);
            setShowCreateModal(true);
          }}
          className="flex-1 bg-white text-gray-700 px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Manual Quotation
        </button>
        <button
          onClick={handleLoadSample}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Eye className="w-5 h-5" />
          Load Sample (Real GTP)
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by number or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Review">Review Internal</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Quotation List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">No. Penawaran</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Tanggal</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Customer</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Perihal</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-700">Grand Total</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-700">Margin %</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Status</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Source</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((quotation) => (
                <tr key={quotation.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 text-sm font-medium text-blue-600">{quotation.noPenawaran}</td>
                  <td className="p-3 text-sm text-gray-600">{formatDisplayDate(quotation.tanggal)}</td>
                  <td className="p-3">
                    <div className="text-sm font-medium text-gray-900">{quotation.kepada}</div>
                    {quotation.perusahaan && <div className="text-xs text-gray-500">{quotation.perusahaan}</div>}
                  </td>
                  <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{quotation.perihal}</td>
                  <td className="p-3 text-sm font-semibold text-right text-gray-900">
                    Rp {(quotation.grandTotal || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      (quotation.marginPercent || 0) >= 20 ? 'bg-green-100 text-green-800' :
                      (quotation.marginPercent || 0) >= 10 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {(quotation.marginPercent || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const allowedStatuses = getAllowedStatuses(quotation);
                      return (
                    <select
                      value={normalizeStatus(quotation.status)}
                      onChange={(e) => { void handleChangeStatus(quotation, e.target.value as UiQuotationStatus); }}
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadge(quotation.status)}`}
                      disabled={allowedStatuses.length <= 1}
                    >
                      {allowedStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-center">
                    {quotation.dataCollectionId ? (() => {
                      const sourceDataCollection = dataCollectionList.find(dc => dc.id === quotation.dataCollectionId);
                      return (
                        <button
                          onClick={() => navigate('/data-collection')}
                          className="flex items-center justify-center gap-1 mx-auto px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition-colors"
                          title={`From: ${getDataCollectionSourceLabel(sourceDataCollection)}`}
                        >
                          <Zap className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-xs text-purple-600 font-medium">Data Collection</span>
                        </button>
                      );
                    })() : (
                      <div className="flex items-center justify-center gap-1">
                        <Settings className="w-3.5 h-3.5 text-gray-600" />
                        <span className="text-xs text-gray-600">Manual</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      {canExportFinalQuotation(quotation) && (
                        <span className="px-2 py-1 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                          FINAL EXPORT READY
                        </span>
                      )}
                      {isQuotationLockedByApprovedProject(quotation.id) && (
                        <span className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-100 text-amber-700 border border-amber-200">
                          Locked
                        </span>
                      )}
                      <button
                        onClick={() => handleEditQuotation(quotation)}
                        disabled={isQuotationLockedByApprovedProject(quotation.id)}
                        className={`p-1.5 rounded transition-colors ${
                          isQuotationLockedByApprovedProject(quotation.id)
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-amber-600 hover:bg-amber-50'
                        }`}
                        title="Edit quotation"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { void handleRefreshFromDataCollection(quotation); }}
                        disabled={!quotation.dataCollectionId || isQuotationLockedByApprovedProject(quotation.id)}
                        className={`p-1.5 rounded transition-colors ${
                          quotation.dataCollectionId && !isQuotationLockedByApprovedProject(quotation.id)
                            ? 'text-purple-600 hover:bg-purple-50'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title="Refresh harga dari Data Collection"
                      >
                        <RefreshCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedQuotation(quotation);
                          setShowPreview(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canViewApprovalAudit && (
                        <button
                          onClick={() => {
                            void loadQuotationApprovalLogs(quotation);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Approval history"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!canExportFinalQuotation(quotation)) {
                            toast.error("Export final quotation hanya bisa untuk status Approved.");
                            return;
                          }
                          await handleBackendQuotationWordExport(quotation);
                        }}
                        disabled={!canExportFinalQuotation(quotation) || exportingQuotationId === quotation.id}
                        className={`p-1.5 rounded transition-colors ${
                          canExportFinalQuotation(quotation)
                            ? "text-green-600 hover:bg-green-50"
                            : "text-gray-300 cursor-not-allowed"
                        }`}
                        title={
                          canExportFinalQuotation(quotation)
                            ? (exportingQuotationId === quotation.id ? "Exporting..." : "Export Word + Excel")
                            : "Status harus Approved untuk export final"
                        }
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (isQuotationLockedByApprovedProject(quotation.id)) {
                            toast.error("Quotation terkunci karena sudah dipakai project Approved.");
                            return;
                          }
                          if (window.confirm('Delete quotation?')) {
                            deleteQuotation(quotation.id);
                            toast.success('Quotation berhasil dihapus');
                          }
                        }}
                        disabled={isQuotationLockedByApprovedProject(quotation.id)}
                        className={`p-1.5 rounded transition-colors ${
                          isQuotationLockedByApprovedProject(quotation.id)
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No quotations found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Survey Selection Modal */}
      <AnimatePresence>
        {showSurveyListModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSurveyListModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h2 className="font-bold text-xl">Select Survey Data</h2>
                    <p className="text-sm text-blue-100 mt-1">Import technical data and apply commercial pricing</p>
                  </div>
                  <button onClick={() => setShowSurveyListModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-3">
                  {availableSurveys.map(survey => (
                    <div
                      key={survey.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
                      onClick={() => {
                        loadFromSurvey(survey);
                        setShowAdvancedQuotationEditor(true);
                        setShowCreateModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-blue-600">{survey.noKoleksi || survey.id}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              getSurveyStatus(survey) === 'Completed' ? 'bg-green-100 text-green-700' :
                              getSurveyStatus(survey) === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {getSurveyStatus(survey)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900 font-medium mb-1">{survey.namaResponden || survey.customer || '-'}</div>
                          <div className="text-xs text-gray-600 mb-2">{survey.lokasi || '-'}</div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(getSurveyDate(survey)).toLocaleDateString('id-ID')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {(survey.manpower || []).length} Manpower
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5" />
                              {(survey.materials || []).length} Materials
                            </span>
                            <span className="flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              {((survey.equipment || survey.tools) || []).length} Equipment
                            </span>
                          </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>

                {availableSurveys.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 font-medium mb-2">No Survey Data Available</p>
                    <p className="text-sm text-gray-500">Isi Data Collection minimal 1 item manpower/material/equipment/tools</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal - MEGA FORM */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-7xl w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleCreate}>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <h2 className="font-bold text-xl">
                        {editingQuotationId
                          ? 'Edit Quotation'
                          : creationMode === 'from-survey'
                            ? '⚡ Smart Commercial Quotation'
                            : 'Manual Quotation'}
                      </h2>
                      <p className="text-sm text-blue-100 mt-1">
                        {creationMode === 'from-survey' && selectedSurvey ? (
                          <>From Survey: {selectedSurvey.noKoleksi} - {selectedSurvey.namaResponden}</>
                        ) : (
                          'Create quotation with manual data entry'
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {isOwner ? 'Mode Detail Owner' : 'Mode Editor Detail'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {showAdvancedQuotationEditor
                          ? 'Detail perhitungan ditampilkan penuh.'
                          : 'Tampilkan ringkasan approval, detail bisa dibuka saat dibutuhkan.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedQuotationEditor((prev) => !prev)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {showAdvancedQuotationEditor ? 'Sembunyikan Detail' : 'Lihat Detail Perhitungan'}
                    </button>
                  </div>

                  {/* SECTION 1: Basic Information */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-600">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-gray-900">Basic Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={formData.tanggal}
                          onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Revisi</label>
                        <input
                          type="text"
                          value={formData.revisi}
                          onChange={(e) => setFormData({ ...formData, revisi: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Validity Period (Days)</label>
                        <input
                          type="number"
                          value={formData.validityDays || 30}
                          onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kepada (Customer Name)</label>
                        <input
                          type="text"
                          value={formData.kepada}
                          onChange={(e) => setFormData({ ...formData, kepada: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perusahaan</label>
                        <input
                          type="text"
                          value={formData.perusahaan}
                          onChange={(e) => setFormData({ ...formData, perusahaan: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Proyek</label>
                        <input
                          type="text"
                          value={formData.lokasi}
                          onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">UP (Attn)</label>
                        <input
                          type="text"
                          value={formData.up}
                          onChange={(e) => setFormData({ ...formData, up: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perihal</label>
                        <input
                          type="text"
                          value={formData.perihal}
                          onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {!showAdvancedQuotationEditor && (
                    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <h3 className="mb-3 text-sm font-bold text-emerald-800">Ringkasan Keputusan Owner</h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-emerald-200 bg-white p-3">
                          <p className="text-xs text-slate-500">Customer / Proyek</p>
                          <p className="text-sm font-semibold text-slate-800">{formData.kepada || '-'}</p>
                          <p className="text-xs text-slate-500">{formData.perihal || '-'}</p>
                        </div>
                        <div className="rounded-md border border-emerald-200 bg-white p-3">
                          <p className="text-xs text-slate-500">Grand Total</p>
                          <p className="text-lg font-bold text-emerald-700">Rp {commercialTotals.grandTotal.toLocaleString('id-ID')}</p>
                          <p className="text-xs text-slate-500">
                            Margin: <span className="font-semibold text-slate-700">{commercialTotals.marginPercent.toFixed(1)}%</span>
                          </p>
                        </div>
                        <div className="rounded-md border border-emerald-200 bg-white p-3">
                          <p className="text-xs text-slate-500">Status Markup</p>
                          <p className="text-sm font-semibold text-slate-800">
                            Manpower {pricingConfig.manpowerMarkup || 0}% | Material {pricingConfig.materialsMarkup || 0}% | Equipment {pricingConfig.equipmentMarkup || 0}%
                          </p>
                        </div>
                        <div className="rounded-md border border-emerald-200 bg-white p-3">
                          <p className="text-xs text-slate-500">Sumber Data</p>
                          <p className="text-sm font-semibold text-slate-800">
                            {creationMode === 'from-survey' ? 'Data Collection (Survey)' : 'Manual Input'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {showAdvancedQuotationEditor && (
                  <>
                  {/* SECTION 2: Pricing Strategy */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-purple-600">
                      <Target className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-gray-900">Pricing Strategy & Markup Configuration</h3>
                    </div>
                    
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setPricingStrategy('cost-plus')}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            pricingStrategy === 'cost-plus' 
                              ? 'border-purple-600 bg-purple-100 shadow-md' 
                              : 'border-gray-300 bg-white hover:border-purple-400'
                          }`}
                        >
                          <Calculator className="w-5 h-5 text-purple-600 mb-1" />
                          <div className="font-semibold text-sm">Cost Plus</div>
                          <div className="text-xs text-gray-600">Add markup % to cost</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricingStrategy('market-based')}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            pricingStrategy === 'market-based' 
                              ? 'border-purple-600 bg-purple-100 shadow-md' 
                              : 'border-gray-300 bg-white hover:border-purple-400'
                          }`}
                        >
                          <TrendingUp className="w-5 h-5 text-purple-600 mb-1" />
                          <div className="font-semibold text-sm">Market Based</div>
                          <div className="text-xs text-gray-600">Based on market price</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricingStrategy('value-based')}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            pricingStrategy === 'value-based' 
                              ? 'border-purple-600 bg-purple-100 shadow-md' 
                              : 'border-gray-300 bg-white hover:border-purple-400'
                          }`}
                        >
                          <Award className="w-5 h-5 text-purple-600 mb-1" />
                          <div className="font-semibold text-sm">Value Based</div>
                          <div className="text-xs text-gray-600">Premium for unique value</div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Users className="w-4 h-4 text-blue-600" />
                          Manpower Markup %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.manpowerMarkup || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, manpowerMarkup: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Package className="w-4 h-4 text-green-600" />
                          Materials Markup %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.materialsMarkup || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, materialsMarkup: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Wrench className="w-4 h-4 text-orange-600" />
                          Equipment Markup %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.equipmentMarkup || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, equipmentMarkup: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <ShoppingCart className="w-4 h-4 text-purple-600" />
                          Consumables Markup %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.consumablesMarkup || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, consumablesMarkup: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Overhead %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.overheadPercent || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, overheadPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contingency %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.contingencyPercent || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, contingencyPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={pricingConfig.discountPercent || 0}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, discountPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount Reason</label>
                        <input
                          type="text"
                          value={pricingConfig.discountReason}
                          onChange={(e) => setPricingConfig({ ...pricingConfig, discountReason: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="e.g. Long-term customer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Pricing Items */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-green-600">
                      <Calculator className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-gray-900">Pricing Items Breakdown</h3>
                    </div>

                    {/* Manpower */}
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('manpower')}
                        className="w-full p-3 bg-blue-50 flex items-center justify-between hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-semibold text-blue-900">
                          <Users className="w-5 h-5" />
                          Manpower ({pricingItems.manpower.length} items)
                        </div>
                        {expandedSections.manpower ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      {expandedSections.manpower && (
                        <div className="p-4 bg-white">
                          <button
                            type="button"
                            onClick={() => addManualItem('manpower')}
                            className="mb-3 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Manpower
                          </button>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 font-semibold">Description</th>
                                  <th className="text-center p-2 font-semibold">Qty</th>
                                  <th className="text-center p-2 font-semibold">Duration</th>
                                  <th className="text-right p-2 font-semibold">Cost/Unit</th>
                                  <th className="text-right p-2 font-semibold">Total Cost</th>
                                  <th className="text-center p-2 font-semibold">Markup %</th>
                                  <th className="text-right p-2 font-semibold">Selling Price</th>
                                  <th className="text-center p-2 font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pricingItems.manpower.map(item => (
                                  <tr key={item.id} className="border-t border-gray-200">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem('manpower', item.id, 'description', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="Job title..."
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.quantity || 0}
                                        onChange={(e) => updateItem('manpower', item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={item.duration || 0}
                                          onChange={(e) => updateItem('manpower', item.id, 'duration', parseFloat(e.target.value) || 0)}
                                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                        />
                                        <span className="text-xs text-gray-600">days</span>
                                      </div>
                                    </td>
                                    <td className="p-2 text-right">
                                      <input
                                        type="number"
                                        value={item.costPerUnit || 0}
                                        onChange={(e) => updateItem('manpower', item.id, 'costPerUnit', parseFloat(e.target.value) || 0)}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-medium">
                                      {(item.totalCost || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.markup || 0}
                                        onChange={(e) => updateItem('manpower', item.id, 'markup', parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-green-700">
                                      {(item.sellingPrice || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => deleteItem('manpower', item.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {pricingItems.manpower.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-500 text-sm">
                                      No manpower items. Click "Add Manpower" to add.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Materials */}
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('materials')}
                        className="w-full p-3 bg-green-50 flex items-center justify-between hover:bg-green-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-semibold text-green-900">
                          <Package className="w-5 h-5" />
                          Materials ({pricingItems.materials.length} items)
                        </div>
                        {expandedSections.materials ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      {expandedSections.materials && (
                        <div className="p-4 bg-white">
                          <button
                            type="button"
                            onClick={() => addManualItem('materials')}
                            className="mb-3 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Material
                          </button>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 font-semibold">Description</th>
                                  <th className="text-center p-2 font-semibold">Qty</th>
                                  <th className="text-center p-2 font-semibold">Unit</th>
                                  <th className="text-right p-2 font-semibold">Cost/Unit</th>
                                  <th className="text-right p-2 font-semibold">Total Cost</th>
                                  <th className="text-center p-2 font-semibold">Markup %</th>
                                  <th className="text-right p-2 font-semibold">Selling Price</th>
                                  <th className="text-center p-2 font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pricingItems.materials.map(item => (
                                  <tr key={item.id} className="border-t border-gray-200">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem('materials', item.id, 'description', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="Material name..."
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.quantity || 0}
                                        onChange={(e) => updateItem('materials', item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.unit}
                                        onChange={(e) => updateItem('materials', item.id, 'unit', e.target.value)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right">
                                      <input
                                        type="number"
                                        value={item.costPerUnit || 0}
                                        onChange={(e) => updateItem('materials', item.id, 'costPerUnit', parseFloat(e.target.value) || 0)}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-medium">
                                      {(item.totalCost || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.markup || 0}
                                        onChange={(e) => updateItem('materials', item.id, 'markup', parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-green-700">
                                      {(item.sellingPrice || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => deleteItem('materials', item.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {pricingItems.materials.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-500 text-sm">
                                      No material items. Click "Add Material" to add.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Equipment */}
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('equipment')}
                        className="w-full p-3 bg-orange-50 flex items-center justify-between hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-semibold text-orange-900">
                          <Wrench className="w-5 h-5" />
                          Equipment ({pricingItems.equipment.length} items)
                        </div>
                        {expandedSections.equipment ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      {expandedSections.equipment && (
                        <div className="p-4 bg-white">
                          <button
                            type="button"
                            onClick={() => addManualItem('equipment')}
                            className="mb-3 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Equipment
                          </button>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 font-semibold">Description</th>
                                  <th className="text-center p-2 font-semibold">Qty</th>
                                  <th className="text-center p-2 font-semibold">Duration</th>
                                  <th className="text-right p-2 font-semibold">Cost/Unit</th>
                                  <th className="text-right p-2 font-semibold">Total Cost</th>
                                  <th className="text-center p-2 font-semibold">Markup %</th>
                                  <th className="text-right p-2 font-semibold">Selling Price</th>
                                  <th className="text-center p-2 font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pricingItems.equipment.map(item => (
                                  <tr key={item.id} className="border-t border-gray-200">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem('equipment', item.id, 'description', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="Equipment name..."
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.quantity || 0}
                                        onChange={(e) => updateItem('equipment', item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={item.duration || 0}
                                          onChange={(e) => updateItem('equipment', item.id, 'duration', parseFloat(e.target.value) || 0)}
                                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                        />
                                        <span className="text-xs text-gray-600">days</span>
                                      </div>
                                    </td>
                                    <td className="p-2 text-right">
                                      <input
                                        type="number"
                                        value={item.costPerUnit || 0}
                                        onChange={(e) => updateItem('equipment', item.id, 'costPerUnit', parseFloat(e.target.value) || 0)}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-medium">
                                      {(item.totalCost || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.markup || 0}
                                        onChange={(e) => updateItem('equipment', item.id, 'markup', parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-green-700">
                                      {(item.sellingPrice || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => deleteItem('equipment', item.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {pricingItems.equipment.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-500 text-sm">
                                      No equipment items. Click "Add Equipment" to add.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Consumables */}
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('consumables')}
                        className="w-full p-3 bg-purple-50 flex items-center justify-between hover:bg-purple-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-semibold text-purple-900">
                          <ShoppingCart className="w-5 h-5" />
                          Consumables ({pricingItems.consumables.length} items)
                        </div>
                        {expandedSections.consumables ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      {expandedSections.consumables && (
                        <div className="p-4 bg-white">
                          <button
                            type="button"
                            onClick={() => addManualItem('consumables')}
                            className="mb-3 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Consumable
                          </button>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 font-semibold">Description</th>
                                  <th className="text-center p-2 font-semibold">Qty</th>
                                  <th className="text-center p-2 font-semibold">Unit</th>
                                  <th className="text-right p-2 font-semibold">Cost/Unit</th>
                                  <th className="text-right p-2 font-semibold">Total Cost</th>
                                  <th className="text-center p-2 font-semibold">Markup %</th>
                                  <th className="text-right p-2 font-semibold">Selling Price</th>
                                  <th className="text-center p-2 font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pricingItems.consumables.map(item => (
                                  <tr key={item.id} className="border-t border-gray-200">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem('consumables', item.id, 'description', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="Item name..."
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.quantity || 0}
                                        onChange={(e) => updateItem('consumables', item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.unit}
                                        onChange={(e) => updateItem('consumables', item.id, 'unit', e.target.value)}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right">
                                      <input
                                        type="number"
                                        value={item.costPerUnit || 0}
                                        onChange={(e) => updateItem('consumables', item.id, 'costPerUnit', parseFloat(e.target.value) || 0)}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-medium">
                                      {(item.totalCost || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={item.markup || 0}
                                        onChange={(e) => updateItem('consumables', item.id, 'markup', parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-green-700">
                                      {(item.sellingPrice || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => deleteItem('consumables', item.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {pricingItems.consumables.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-500 text-sm">
                                      No consumable items. Click "Add Consumable" to add.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 4: Financial Summary */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-yellow-600">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      <h3 className="font-bold text-gray-900">Financial Summary</h3>
                    </div>
                    
                    {/* Multi-Unit Toggle */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enableMultiUnit}
                          onChange={(e) => setFormData({ ...formData, enableMultiUnit: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Multi-Unit Pricing</span>
                      </label>
                      {formData.enableMultiUnit && (
                        <div className="mt-3 flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Unit Count:</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.unitCount}
                            onChange={(e) => setFormData({ ...formData, unitCount: parseInt(e.target.value) || 1 })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">units</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-600 rounded-lg p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Total Cost (Base)</div>
                          <div className="font-bold text-xl text-gray-900">
                            Rp {commercialTotals.totalCost.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">After Markup</div>
                          <div className="font-bold text-xl text-blue-700">
                            Rp {commercialTotals.totalSelling.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Overhead ({pricingConfig.overheadPercent}%)</div>
                          <div className="font-semibold text-lg text-gray-700">
                            Rp {commercialTotals.overhead.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Contingency ({pricingConfig.contingencyPercent}%)</div>
                          <div className="font-semibold text-lg text-gray-700">
                            Rp {commercialTotals.contingency.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Discount ({pricingConfig.discountPercent}%)</div>
                          <div className="font-semibold text-lg text-red-600">
                            - Rp {commercialTotals.discount.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Grand Total (1 Unit)</div>
                          <div className="font-bold text-2xl text-green-700">
                            Rp {commercialTotals.grandTotal.toLocaleString('id-ID')}
                          </div>
                        </div>
                        
                        {/* Multi-Unit Total */}
                        {formData.enableMultiUnit && formData.unitCount > 1 && (
                          <div className="col-span-2 bg-emerald-100 border-2 border-emerald-600 rounded-lg p-4 mt-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-emerald-700 mb-1">Total for {formData.unitCount} Units</div>
                                <div className="font-bold text-3xl text-emerald-700">
                                  Rp {(commercialTotals.grandTotal * formData.unitCount).toLocaleString('id-ID')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-emerald-600">Per Unit</div>
                                <div className="text-sm text-emerald-700">
                                  Rp {commercialTotals.grandTotal.toLocaleString('id-ID')}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="col-span-2 border-t-2 border-yellow-600 pt-4 mt-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-gray-600 mb-1">Gross Profit</div>
                              <div className="font-bold text-xl text-purple-700">
                                Rp {commercialTotals.grossProfit.toLocaleString('id-ID')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600 mb-1">Margin</div>
                              <div className={`font-bold text-3xl ${
                                commercialTotals.marginPercent >= 20 ? 'text-green-600' :
                                commercialTotals.marginPercent >= 10 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {commercialTotals.marginPercent.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 5: Payment Terms */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-indigo-600">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-gray-900">Payment Terms</h3>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Structure</label>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'full' })}
                          className={`p-2 rounded-lg border-2 text-sm ${
                            paymentTerms.type === 'full' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          Full Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'termin' })}
                          className={`p-2 rounded-lg border-2 text-sm ${
                            paymentTerms.type === 'termin' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          Termin
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'dp-progress' })}
                          className={`p-2 rounded-lg border-2 text-sm ${
                            paymentTerms.type === 'dp-progress' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          DP + Progress
                        </button>
                      </div>

                      {paymentTerms.type !== 'full' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">Payment Schedule</label>
                            <button
                              type="button"
                              onClick={addPaymentTermin}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Termin
                            </button>
                          </div>
                          <div className="space-y-2">
                            {paymentTerms.termins.map((termin, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                  type="text"
                                  value={termin.label}
                                  onChange={(e) => updatePaymentTermin(idx, 'label', e.target.value)}
                                  className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="Label..."
                                />
                                <input
                                  type="number"
                                  value={termin.percent || 0}
                                  onChange={(e) => updatePaymentTermin(idx, 'percent', parseFloat(e.target.value) || 0)}
                                  className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                  placeholder="%"
                                />
                                <span className="col-span-1 text-sm text-gray-600">%</span>
                                <input
                                  type="text"
                                  value={termin.timing}
                                  onChange={(e) => updatePaymentTermin(idx, 'timing', e.target.value)}
                                  className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="Timing..."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTermins = paymentTerms.termins.filter((_, i) => i !== idx);
                                    setPaymentTerms({ ...paymentTerms, termins: newTermins });
                                  }}
                                  className="col-span-1 p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-sm font-medium text-indigo-700">
                            Total: {paymentTerms.termins.reduce((sum, t) => sum + t.percent, 0)}%
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due (Days)</label>
                          <input
                            type="number"
                            value={paymentTerms.paymentDueDays || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, paymentDueDays: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Retention %</label>
                          <input
                            type="number"
                            step="0.1"
                            value={paymentTerms.retention || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, retention: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Retention Period (Days)</label>
                          <input
                            type="number"
                            value={paymentTerms.retentionPeriod || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, retentionPeriod: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 6: Commercial Terms & Conditions */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-teal-600">
                      <FileCheck className="w-5 h-5 text-teal-600" />
                      <h3 className="font-bold text-gray-900">Commercial Terms & Conditions</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                        <input
                          type="text"
                          value={commercialTerms.warranty}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, warranty: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                        <input
                          type="text"
                          value={commercialTerms.delivery}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, delivery: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Installation</label>
                        <input
                          type="text"
                          value={commercialTerms.installation}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, installation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Clause</label>
                        <input
                          type="text"
                          value={commercialTerms.penalty}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, penalty: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional Conditions</label>
                      {commercialTerms.conditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={cond}
                            onChange={(e) => {
                              const newConditions = [...commercialTerms.conditions];
                              newConditions[idx] = e.target.value;
                              setCommercialTerms({ ...commercialTerms, conditions: newConditions });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newConditions = commercialTerms.conditions.filter((_, i) => i !== idx);
                              setCommercialTerms({ ...commercialTerms, conditions: newConditions });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCommercialTerms({
                            ...commercialTerms,
                            conditions: [...commercialTerms.conditions, '']
                          });
                        }}
                        className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Condition
                      </button>
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingQuotationId ? 'Update Quotation' : 'Create Quotation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && selectedQuotation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-between">
                <div className="text-white">
                  <h2 className="font-bold text-xl">{selectedQuotation.noPenawaran}</h2>
                  <p className="text-sm text-blue-100">{selectedQuotation.kepada}</p>
                </div>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Tanggal:</strong> {new Date(selectedQuotation.tanggal).toLocaleDateString('id-ID')}</div>
                    <div><strong>Validity:</strong> {selectedQuotation.validityDays} hari</div>
                    <div><strong>Perusahaan:</strong> {selectedQuotation.perusahaan || '-'}</div>
                    <div><strong>Lokasi:</strong> {selectedQuotation.lokasi}</div>
                    <div className="col-span-2"><strong>Perihal:</strong> {selectedQuotation.perihal}</div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">Financial Summary</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2">
                        <div>Total Cost:</div>
                        <div className="text-right font-semibold">Rp {(selectedQuotation.totalCost || 0).toLocaleString('id-ID')}</div>
                        <div>After Markup:</div>
                        <div className="text-right font-semibold">Rp {(selectedQuotation.totalSelling || 0).toLocaleString('id-ID')}</div>
                        <div>Overhead:</div>
                        <div className="text-right">Rp {(selectedQuotation.overhead || 0).toLocaleString('id-ID')}</div>
                        <div>Contingency:</div>
                        <div className="text-right">Rp {(selectedQuotation.contingency || 0).toLocaleString('id-ID')}</div>
                        <div>Discount:</div>
                        <div className="text-right text-red-600">- Rp {(selectedQuotation.discount || 0).toLocaleString('id-ID')}</div>
                        <div className="font-bold text-lg border-t pt-2">Grand Total:</div>
                        <div className="text-right font-bold text-lg text-green-700 border-t pt-2">Rp {(selectedQuotation.grandTotal || 0).toLocaleString('id-ID')}</div>
                        <div className="font-bold">Margin:</div>
                        <div className="text-right font-bold text-purple-700">{(selectedQuotation.marginPercent || 0).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  {selectedQuotation.dataCollectionId && (() => {
                    const sourceDataCollection = dataCollectionList.find(dc => dc.id === selectedQuotation.dataCollectionId);
                    return (
                      <div className="border-t pt-4">
                        <div className="bg-purple-50 border-2 border-purple-600 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-purple-700" />
                              <div>
                                <div className="font-bold text-purple-900">Created from Data Collection</div>
                                {sourceDataCollection && (
                                  <div className="text-sm text-purple-700">
                                    {getDataCollectionSourceLabel(sourceDataCollection)}
                                  </div>
                                )}
                                {selectedQuotation?.sourceSnapshotAt && (
                                  <div className="text-xs text-purple-600 mt-1">
                                    Snapshot: {new Date(selectedQuotation.sourceSnapshotAt).toLocaleString('id-ID')}
                                  </div>
                                )}
                              </div>
                            </div>
                            {sourceDataCollection && (
                              <button
                                onClick={() => {
                                  setShowPreview(false);
                                  navigate('/data-collection');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                              >
                                <ArrowUpRight size={16} />
                                View Source
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={async () => {
                    if (!canExportFinalQuotation(selectedQuotation)) {
                      toast.error("Export final quotation hanya bisa untuk status Approved.");
                      return;
                    }
                    await handleBackendQuotationWordExport(selectedQuotation);
                  }}
                  disabled={!canExportFinalQuotation(selectedQuotation) || exportingQuotationId === selectedQuotation?.id}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    canExportFinalQuotation(selectedQuotation)
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {exportingQuotationId === selectedQuotation?.id ? 'Exporting...' : 'Export Word + Excel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approval Logs Modal */}
      <AnimatePresence>
        {showApprovalLogsModal && selectedApprovalQuotation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowApprovalLogsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between">
                <div className="text-white">
                  <h2 className="font-bold text-xl">Quotation Approval History</h2>
                  <p className="text-sm text-indigo-100">
                    {selectedApprovalQuotation?.noPenawaran || selectedApprovalQuotation?.id}
                  </p>
                </div>
                <button
                  onClick={() => setShowApprovalLogsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-auto max-h-[calc(90vh-140px)]">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {['ALL', 'CREATE', 'SEND', 'APPROVE', 'REJECT', 'REOPEN_DRAFT', 'STATUS_CHANGE'].map((key) => (
                    <button
                      key={key}
                      onClick={() => setApprovalActionFilter(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        approvalActionFilter === key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {approvalLogsLoading ? (
                  <div className="text-sm text-gray-500">Loading approval logs...</div>
                ) : approvalLogsError ? (
                  <div className="text-sm text-red-600">{approvalLogsError}</div>
                ) : filteredApprovalLogs.length === 0 ? (
                  <div className="text-sm text-gray-500">Belum ada approval log untuk quotation ini.</div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-gray-700">Time</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Action</th>
                          <th className="text-left p-3 font-semibold text-gray-700">From</th>
                          <th className="text-left p-3 font-semibold text-gray-700">To</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Actor Role</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApprovalLogs.map((row: any) => (
                          <tr key={row.id} className="border-b border-gray-100">
                            <td className="p-3 text-gray-700">
                              {row?.createdAt ? new Date(row.createdAt).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
                                {row?.action || '-'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-700">{row?.fromStatus || '-'}</td>
                            <td className="p-3 text-gray-700">{row?.toStatus || '-'}</td>
                            <td className="p-3 text-gray-700">{getRoleLabel(row?.actorRole) || '-'}</td>
                            <td className="p-3 text-gray-700">{getApprovalActorLabel(row)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
