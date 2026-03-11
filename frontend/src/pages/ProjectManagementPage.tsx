import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  X,
  Calendar,
  MapPin,
  Users,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  ShoppingCart,
  Briefcase,
  Wrench,
  TrendingUp,
  Building2,
  ArrowRight,
  Download,
  Maximize2,
  FileText,
  FileSpreadsheet,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import type { Project, WorkOrder } from '../contexts/AppContext';
import { toast } from "sonner@2.0.3";
import { BOQMaterialModal } from "../components/project/BOQMaterialModal";
import logoGTP from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";
import api from "../services/api";
import FlowHintBar from "../components/ui/FlowHintBar";
import { subscribeDataSync } from "../services/dataSyncBus";

type ProjectTab = "overview" | "boq" | "milestones" | "work-order" | "mutation" | "field-records" | "procurement" | "financials";
type ProjectFilter = "All" | "Planning" | "In Progress" | "Completed" | "Approved" | "Rejected";
type BoqCategoryKey = "manpower" | "equipment" | "consumable" | "material" | "other";

import { TimelineTracker } from "../components/project/TimelineTracker";
import { MaterialUsageReportModal } from "../components/project/MaterialUsageReportModal";

const BOQ_CATEGORY_META: Record<BoqCategoryKey, { label: string; badge: string }> = {
  manpower: { label: "Manpower", badge: "bg-blue-50 text-blue-700 border-blue-100" },
  equipment: { label: "Equipment", badge: "bg-purple-50 text-purple-700 border-purple-100" },
  consumable: { label: "Consumable", badge: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  material: { label: "Material", badge: "bg-amber-50 text-amber-700 border-amber-100" },
  other: { label: "Other", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

type VoCategory = "Manpower" | "Material" | "Equipment" | "Consumable";

const VO_CATEGORY_CONFIG: Record<VoCategory, { codePrefix: string; defaultUnit: string }> = {
  Manpower: { codePrefix: "MP", defaultUnit: "Mandays" },
  Material: { codePrefix: "MAT", defaultUnit: "Sack" },
  Equipment: { codePrefix: "EQ", defaultUnit: "Unit" },
  Consumable: { codePrefix: "CON", defaultUnit: "Pcs" },
};

const createVoItemCode = (category: VoCategory) => {
  const prefix = VO_CATEGORY_CONFIG[category]?.codePrefix || "MAT";
  return `${prefix}-${Math.floor(Math.random() * 900) + 100}`;
};

const createInitialVoFormData = (category: VoCategory = "Material") => ({
  materialName: "",
  unit: VO_CATEGORY_CONFIG[category].defaultUnit,
  qtyEstimate: 1,
  unitPrice: 0,
  manpowerDays: 1,
  manpowerPersons: 1,
  itemKode: createVoItemCode(category),
  category,
});

export default function ProjectManagementPage() {
  const {
    projectList: ctxProjectList,
    addProject,
    updateProject,
    deleteProject,
    workOrderList: ctxWorkOrderList,
    updateWorkOrder,
    addWorkOrder,
    updateMaterialRequestStatus,
    materialRequestList: ctxMaterialRequestList,
    productionReportList: ctxProductionReportList,
    employeeList: ctxEmployeeList,
    attendanceList: ctxAttendanceList,
    quotationList: ctxQuotationList,
    poList: ctxPoList,
    stockOutList: ctxStockOutList,
    stockItemList
  } = useApp();
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("All");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showQuotationListModal, setShowQuotationListModal] = useState(false);
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);
  const [projectTab, setProjectTab] = useState<ProjectTab>("overview");
  const [terminologyMode, setTerminologyMode] = useState<"RAB" | "SOW">("RAB");
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Sub-modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddWorkOrderModal, setShowAddWorkOrderModal] = useState(false);
  const [showAddBOQItemModal, setShowAddBOQItemModal] = useState(false);
  const [showEditBoqItemModal, setShowEditBoqItemModal] = useState(false);
  const [editingBoqRow, setEditingBoqRow] = useState<any | null>(null);
  const [expandedBoqCategories, setExpandedBoqCategories] = useState<Record<BoqCategoryKey, boolean>>({
    manpower: true,
    equipment: true,
    consumable: true,
    material: true,
    other: true,
  });
  const [showMaterialUsageModal, setShowMaterialUsageModal] = useState(false);
  const [editingMaterialUsageReport, setEditingMaterialUsageReport] = useState<any | null>(null);
  const [materialUsageModalMode, setMaterialUsageModalMode] = useState<"create" | "edit" | "view">("create");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const projectSourceFetchInFlightRef = useRef(false);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverQuotationList, setServerQuotationList] = useState<any[] | null>(null);
  const [serverPoList, setServerPoList] = useState<any[] | null>(null);
  const [serverAttendanceList, setServerAttendanceList] = useState<any[] | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<any[] | null>(null);
  const [serverStockOutList, setServerStockOutList] = useState<any[] | null>(null);
  const [serverWorkOrderList, setServerWorkOrderList] = useState<any[] | null>(null);
  const [serverMaterialRequestList, setServerMaterialRequestList] = useState<any[] | null>(null);
  const [serverProductionReportList, setServerProductionReportList] = useState<any[] | null>(null);
  const [serverFleetHealthList, setServerFleetHealthList] = useState<any[] | null>(null);
  const [projectSummaryMetrics, setProjectSummaryMetrics] = useState<{
    totalProjects: number;
    activeProjects: number;
    approvedProjects: number;
    rejectedProjects: number;
    totalContractValue: number;
    avgProgress: number;
  } | null>(null);
  const [projectFinancialsById, setProjectFinancialsById] = useState<Record<string, {
    contractValue: number;
    pettyCash: number;
    poCommitted: number;
    stockUsage: number;
    laborCost: number;
    equipmentCost: number;
    actualSpent: number;
    marginNominal: number;
    marginPercent: number;
    budgetUtilizationPercent: number;
    boqBudget: number;
    materialRequestEstimated: number;
    materialRequestUsagePercent: number;
  }>>({});

  const projectList = serverProjectList ?? ctxProjectList;
  const quotationList = serverQuotationList ?? ctxQuotationList;
  const poList = serverPoList ?? ctxPoList;
  const attendanceList = serverAttendanceList ?? ctxAttendanceList;
  const employeeList = serverEmployeeList ?? ctxEmployeeList;
  const stockOutList = serverStockOutList ?? ctxStockOutList;
  const workOrderList = serverWorkOrderList ?? ctxWorkOrderList;
  const materialRequestList = serverMaterialRequestList ?? ctxMaterialRequestList;
  const productionReportList = serverProductionReportList ?? ctxProductionReportList;
  const fleetHealthList = serverFleetHealthList ?? [];

  // Get approved quotations for project creation
  const approvedQuotations = quotationList.filter((q) => {
    const status = String(q.status || "").toUpperCase();
    return status === "SENT" || status === "APPROVED";
  });

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload;
      if (payload && typeof payload === "object" && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return (payload ?? row) as T;
    });

  const fetchProjectSources = async () => {
    if (projectSourceFetchInFlightRef.current) return;
    projectSourceFetchInFlightRef.current = true;
    try {
      setIsRefreshing(true);
      const [projectRes, quotationRes, poRes, attendanceRes, employeeRes, stockOutRes, workOrderRes, materialRequestRes, productionReportRes, fleetHealthRes, summaryRes] = await Promise.all([
        api.get("/projects"),
        api.get("/quotations"),
        api.get("/purchase-orders"),
        api.get("/attendances"),
        api.get("/employees"),
        api.get("/inventory/stock-outs"),
        api.get("/work-orders"),
        api.get("/material-requests"),
        api.get("/production-reports"),
        api.get("/fleet-health"),
        api.get<{ metrics?: any }>("/projects/metrics/summary"),
      ]);

      setServerProjectList(Array.isArray(projectRes.data) ? (projectRes.data as Project[]) : []);
      setServerQuotationList(Array.isArray(quotationRes.data) ? (quotationRes.data as any[]) : []);
      setServerPoList(Array.isArray(poRes.data) ? (poRes.data as any[]) : []);
      setServerAttendanceList(normalizeEntityRows<any>(Array.isArray(attendanceRes.data) ? attendanceRes.data : []));
      setServerEmployeeList(normalizeEntityRows<any>(Array.isArray(employeeRes.data) ? employeeRes.data : []));
      setServerStockOutList(normalizeEntityRows<any>(Array.isArray(stockOutRes.data) ? stockOutRes.data : []));
      setServerWorkOrderList(normalizeEntityRows<any>(Array.isArray(workOrderRes.data) ? workOrderRes.data : []));
      setServerMaterialRequestList(normalizeEntityRows<any>(Array.isArray(materialRequestRes.data) ? materialRequestRes.data : []));
      setServerProductionReportList(normalizeEntityRows<any>(Array.isArray(productionReportRes.data) ? productionReportRes.data : []));
      setServerFleetHealthList(normalizeEntityRows<any>(Array.isArray(fleetHealthRes.data) ? fleetHealthRes.data : []));
      setProjectSummaryMetrics(summaryRes.data?.metrics || null);
    } catch {
      setServerProjectList(null);
      setServerQuotationList(null);
      setServerPoList(null);
      setServerAttendanceList(null);
      setServerEmployeeList(null);
      setServerStockOutList(null);
      setServerWorkOrderList(null);
      setServerMaterialRequestList(null);
      setServerProductionReportList(null);
      setServerFleetHealthList(null);
      setProjectSummaryMetrics(null);
    } finally {
      projectSourceFetchInFlightRef.current = false;
      setIsRefreshing(false);
    }
  };
  const lastAutoRefreshAtRef = useRef(0);

  const [boqFormData, setBoqFormData] = useState(createInitialVoFormData());

  const [expenseFormData, setExpenseFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    nominal: 0,
    category: "Operational",
    hasNota: true
  });

  const [woFormData, setWoFormData] = useState({
    woNumber: `SPK/GTP/${new Date().getFullYear()}/000`,
    itemToProduce: "",
    targetQty: 1,
    leadTechnician: "",
    deadline: "",
    priority: "Normal" as any
  });

  // Sync selected project with global projectList
  useEffect(() => {
    if (selectedProject) {
      const updated = (projectList || []).find(p => p.id === selectedProject.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
        setSelectedProject(updated);
      }
    }
  }, [projectList, selectedProject]);

  useEffect(() => {
    void fetchProjectSources();
  }, []);

  useEffect(() => {
    const PROJECT_REALTIME_INTERVAL_MS = 30000;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      if (location.pathname !== "/project") return;
      if (!isRefreshing) {
        void fetchProjectSources();
      }
    }, PROJECT_REALTIME_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [isRefreshing, location.pathname]);

  useEffect(() => {
    const unsubscribe = subscribeDataSync(() => {
      if (!isRefreshing) {
        void fetchProjectSources();
      }
    });
    return unsubscribe;
  }, [isRefreshing]);

  useEffect(() => {
    const AUTO_REFRESH_COOLDOWN_MS = 3000;

    const refreshOnFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (isRefreshing) return;
      if (now - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) return;
      lastAutoRefreshAtRef.current = now;
      void fetchProjectSources();
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [isRefreshing]);

  useEffect(() => {
    if (!selectedProject?.id) return;
    let cancelled = false;

    api
      .get<{ financials?: any }>(`/projects/${selectedProject.id}/financials`)
      .then((res) => {
        if (cancelled) return;
        const next = res.data?.financials;
        if (!next) return;
        setProjectFinancialsById((prev) => ({
          ...prev,
          [selectedProject.id]: {
            contractValue: Number(next.contractValue || 0),
            pettyCash: Number(next.pettyCash || 0),
            poCommitted: Number(next.poCommitted || 0),
            stockUsage: Number(next.stockUsage || 0),
            laborCost: Number(next.laborCost || 0),
            equipmentCost: Number(next.equipmentCost || 0),
            actualSpent: Number(next.actualSpent || 0),
            marginNominal: Number(next.marginNominal || 0),
            marginPercent: Number(next.marginPercent || 0),
            budgetUtilizationPercent: Number(next.budgetUtilizationPercent || 0),
            boqBudget: Number(next.boqBudget || 0),
            materialRequestEstimated: Number(next.materialRequestEstimated || 0),
            materialRequestUsagePercent: Number(next.materialRequestUsagePercent || 0),
          },
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id]);

  const [formData, setFormData] = useState({
    namaProject: "",
    customer: "",
    nilaiKontrak: 0,
    startDate: "",
    endDate: "",
    status: "Planning" as Project["status"],
    location: "",
    projectManager: "",
    description: "",
    progress: 0,
    kategori: "",
    tipePekerjaan: "",
    jenisKontrak: "",
    quotationId: "", // Track linked quotation
  });

  const [projectFormMaterials, setProjectFormMaterials] = useState<any[]>([]);

  const isProjectApproved = (project?: Project | null) =>
    String(project?.approvalStatus || "").toUpperCase() === "APPROVED";
  const isProjectLockedForEdit = (project?: Project | null) => isProjectApproved(project);

  const guardApprovedProject = (project?: Project | null) => {
    if (!isProjectApproved(project)) {
      toast.error("Project belum Approved oleh OWNER/SPV. Selesaikan approval project dulu.");
      return false;
    }
    return true;
  };

  const canGenerateWorkOrder = (project?: Project | null) => {
    if (!project) return false;
    if (isProjectApproved(project)) return true;
    const linkedQuotationStatus = String(getQuotationStatusByProject(project) || "").toUpperCase();
    return linkedQuotationStatus === "APPROVED";
  };

  // Function to handle selection from quotation
  const handleSelectQuotation = (quo: any) => {
    if (quo) {
      setFormData({
        ...formData,
        namaProject: quo.perihal || "",
        customer: quo.kepada || "",
        nilaiKontrak: quo.grandTotal || 0,
        location: quo.lokasi || "",
        quotationId: quo.id,
        kategori: quo.jenisQuotation === 'Material' ? 'Material Supply' : 'Installation',
        tipePekerjaan: "New Installation",
        jenisKontrak: "Lump Sum",
        startDate: quo.tanggal || new Date().toISOString().split('T')[0],
      });
      
      // Auto-map BOQ materials from quotation sections
      const mappedMaterials: any[] = [];
      if (quo.sections && Array.isArray(quo.sections)) {
        quo.sections.forEach((section: any) => {
          if (section.items && Array.isArray(section.items)) {
            section.items.forEach((item: any) => {
              mappedMaterials.push({
                materialName: item.keterangan || item.description || "",
                itemKode: `MAT-${Math.floor(Math.random() * 900) + 100}`,
                qtyEstimate: item.jumlah || 1,
                qtyActual: 0,
                unit: item.satuan || "Unit",
                unitPrice: item.hargaUnit || 0,
                supplier: "",
                status: "Not Ordered",
                category: section.title || "General"
              });
            });
          }
        });
      }
      setProjectFormMaterials(mappedMaterials);
      
      setShowQuotationListModal(false);
      setShowProjectModal(true);
      
      toast.success('Data quotation berhasil dimuat', {
        description: `Terisi otomatis dari ${quo.noPenawaran}`
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const normalizeBoqCategory = (item: any): BoqCategoryKey => {
    const rawCategory = String(
      item?.sourceCategory || item?.category || item?.section || item?.group || ""
    ).toLowerCase();
    const itemCode = String(item?.itemKode || "").toUpperCase();
    const name = String(item?.materialName || "").toLowerCase();
    if (rawCategory.includes("manpower") || rawCategory.includes("jasa") || itemCode.startsWith("MP-")) return "manpower";
    if (rawCategory.includes("equipment") || rawCategory.includes("alat") || itemCode.startsWith("EQ-")) return "equipment";
    if (
      rawCategory.includes("consumable") ||
      rawCategory.includes("consumables") ||
      rawCategory.includes("consum") ||
      itemCode.startsWith("CON-")
    ) return "consumable";
    if (
      rawCategory.includes("material") ||
      rawCategory.includes("materials") ||
      itemCode.startsWith("MAT-")
    ) return "material";
    if (name.includes("manpower") || name.includes("teknisi")) return "manpower";
    if (name.includes("equipment") || name.includes("alat")) return "equipment";
    if (name.includes("consumable")) return "consumable";
    if (name.includes("material")) return "material";
    return "other";
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "Planning": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "In Progress": return "bg-blue-100 text-blue-700 border-blue-200";
      case "On Hold": return "bg-orange-100 text-orange-700 border-orange-200";
      case "Completed": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getApprovalStatusColor = (approvalStatus?: string) => {
    switch (String(approvalStatus || "Pending").toUpperCase()) {
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getQuotationStatusByProject = (project: Project) => {
    const fromProject = String((project as any)?.quotationStatus || "").trim();
    if (fromProject) return fromProject;
    if (!project.quotationId) return "No Quotation";
    const linked = quotationList.find((q) => q.id === project.quotationId);
    return String(linked?.status || "Unknown");
  };

  const getQuotationStatusColor = (quotationStatus?: string) => {
    switch (String(quotationStatus || "").toUpperCase()) {
      case "APPROVED":
        return "bg-emerald-600 text-white border-emerald-700";
      case "REJECTED":
      case "CANCELLED":
      case "LOST":
        return "bg-rose-600 text-white border-rose-700";
      case "SENT":
        return "bg-blue-600 text-white border-blue-700";
      case "DRAFT":
        return "bg-slate-700 text-white border-slate-800";
      case "NO QUOTATION":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-amber-500 text-white border-amber-600";
    }
  };

  const projectDisplayPool = projectList.filter((item) => {
    const sourceType = String((item as any).sourceType || "").toLowerCase();
    const linkedQuotationStatus = String(getQuotationStatusByProject(item) || "").toUpperCase();
    // Hide auto-created quotation projects until quotation is fully approved.
    if (sourceType === "quotation" && linkedQuotationStatus && linkedQuotationStatus !== "APPROVED") {
      return false;
    }
    return true;
  });

  const filteredProjects = projectDisplayPool.filter((item) => {

    const matchesSearch =
      (item.kodeProject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.namaProject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.customer || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const approval = String(item.approvalStatus || "Pending").toUpperCase();
    if (projectFilter === "All") return true;
    if (projectFilter === "Approved") return approval === "APPROVED";
    if (projectFilter === "Rejected") return approval === "REJECTED";
    return item.status === projectFilter;
  });

  const activeProjectsCount = projectDisplayPool.filter(
    (p) => String(p.status || "").toUpperCase() !== "COMPLETED"
  ).length;
  const totalValueDisplay = projectDisplayPool.reduce(
    (sum, p) => sum + Number((p as any).nilaiKontrak || 0),
    0
  );

  const selectedQuotationSnapshot = (selectedProject as any)?.quotationSnapshot || null;
  const selectedQuotationPreview = (selectedProject as any)?.quotationPreview || null;
  const selectedSnapshotScope: string[] = Array.isArray(selectedQuotationSnapshot?.commercialTerms?.scopeOfWork)
    ? selectedQuotationSnapshot.commercialTerms.scopeOfWork
    : [];
  const selectedSnapshotExclusions: string[] = Array.isArray(selectedQuotationSnapshot?.commercialTerms?.exclusions)
    ? selectedQuotationSnapshot.commercialTerms.exclusions
    : [];
  const selectedPreviewScope: string[] = Array.isArray(selectedQuotationPreview?.scopeOfWork)
    ? selectedQuotationPreview.scopeOfWork
    : [];
  const selectedPreviewExclusions: string[] = Array.isArray(selectedQuotationPreview?.exclusions)
    ? selectedQuotationPreview.exclusions
    : [];
  const handleViewProjectDetail = async (project: Project) => {
    setSelectedProject(project);
    setShowProjectDetailModal(true);
    setProjectDetailLoading(true);
    try {
      const res = await api.get(`/projects/${project.id}`);
      if (res?.data) {
        setSelectedProject(res.data as Project);
      }
    } catch {
      toast.error("Gagal memuat detail project terbaru.");
    } finally {
      setProjectDetailLoading(false);
    }
  };

  const handleCreateProject = () => {
    setIsEditMode(false);
    setFormData({
      namaProject: "",
      customer: "",
      nilaiKontrak: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      status: "Planning",
      location: "",
      projectManager: "",
      description: "",
      progress: 0,
      kategori: "",
      tipePekerjaan: "",
      jenisKontrak: "",
      quotationId: "",
    });
    setProjectFormMaterials([]);
    setShowProjectModal(true);
  };

  const handleSaveProject = () => {
    const validatedProgress = Math.min(100, Math.max(0, formData.progress || 0));
    const finalFormData = { ...formData, progress: validatedProgress };

    if (isEditMode && selectedProject) {
      if (isProjectLockedForEdit(selectedProject)) {
        toast.error("Project sudah Approved. Edit field inti dikunci.");
        return;
      }
      updateProject(selectedProject.id, {
        ...finalFormData,
        boq: projectFormMaterials,
      });
    } else {
      const newProject: Project = {
        id: `prj-${Date.now()}`,
        kodeProject: `PRJ-${new Date().getFullYear()}-${String(projectList.length + 1).padStart(3, "0")}`,
        ...finalFormData,
        boq: projectFormMaterials,
        quotationId: formData.quotationId || undefined,
        approvalStatus: 'Pending'
      };
      addProject(newProject);
    }
    setShowProjectModal(false);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteProject(projectId);
    }
  };

  const handleAddExpense = () => {
    if (!selectedProject) return;
    const newExpense = {
      id: `EXP-${Date.now()}`,
      projectId: selectedProject.id,
      ...expenseFormData
    };
    
    const updatedExpenses = [...(selectedProject.workingExpenses || []), newExpense];
    updateProject(selectedProject.id, { workingExpenses: updatedExpenses });
    setShowAddExpenseModal(false);
    setExpenseFormData({
      date: new Date().toISOString().split('T')[0],
      description: "",
      nominal: 0,
      category: "Operational",
      hasNota: true
    });
    toast.success("Biaya berhasil ditambahkan ke ledger project");
  };

  const handleAddWorkOrder = () => {
    if (!selectedProject) return;
    if (!canGenerateWorkOrder(selectedProject)) {
      toast.error("SPK hanya bisa dibuat jika Project atau Quotation sudah Approved.");
      return;
    }
    const normalizedWoNumber = String(woFormData.woNumber || "").trim() || `WO-${Date.now()}`;
    const normalizedSpkNumber = normalizedWoNumber.toUpperCase().startsWith("SPK")
      ? normalizedWoNumber
      : normalizedWoNumber.replace(/^WO/i, "SPK");
    const spkId = `SPK-${Date.now()}`;
    const newWO: any = {
      id: `WO-${Date.now()}`,
      projectId: selectedProject.id,
      projectName: selectedProject.namaProject,
      woNumber: normalizedWoNumber,
      noSPK: normalizedSpkNumber,
      spkId,
      status: 'Draft',
      completedQty: 0,
      ...woFormData
    };

    const existingSpkList = ((selectedProject as any).spkList || []) as any[];
    const hasSameSpk = existingSpkList.some(
      (spk: any) =>
        String(spk?.noSPK || "").trim().toUpperCase() === normalizedSpkNumber.trim().toUpperCase()
    );
    if (!hasSameSpk) {
      const linkedSpk = {
        id: spkId,
        noSPK: normalizedSpkNumber,
        tanggal: new Date().toISOString().slice(0, 10),
        pekerjaan: String(woFormData.itemToProduce || "").trim(),
        teknisi: String(woFormData.leadTechnician || "").trim(),
        status: "Active",
        urgent: String(woFormData.priority || "").toLowerCase() === "urgent",
        createdAt: new Date().toISOString(),
        source: "WORK_ORDER",
      };
      updateProject(selectedProject.id, { spkList: [...existingSpkList, linkedSpk] } as any);
    }

    addWorkOrder(newWO);
    toast.success("Work Order (SPK) berhasil dibuat");
    setShowAddWorkOrderModal(false);
  };

  const handleAddBOQItem = () => {
    if (!selectedProject) return;
    if (!guardApprovedProject(selectedProject)) return;
    const isManpower = boqFormData.category === "Manpower";
    const manpowerDays = Math.max(1, Number((boqFormData as any).manpowerDays || 1));
    const manpowerPersons = Math.max(1, Number((boqFormData as any).manpowerPersons || 1));
    const qtyEstimate = isManpower
      ? manpowerDays * manpowerPersons
      : Number(boqFormData.qtyEstimate || 0);
    const newItem = {
      ...boqFormData,
      qtyEstimate,
      manpowerDays: isManpower ? manpowerDays : undefined,
      manpowerPersons: isManpower ? manpowerPersons : undefined,
      qtyActual: 0,
      id: `BOQ-${Date.now()}`,
      status: 'Pending Approval', // VOs should be approved
      isVariationOrder: true
    };
    
    const updatedBOQ = [...(selectedProject.boq || []), newItem];
    // Don't update nilaiKontrak yet, wait for approval
    
    updateProject(selectedProject.id, { 
      boq: updatedBOQ
    });
    
    setShowAddBOQItemModal(false);
    setBoqFormData(createInitialVoFormData());
    toast.info("Variation Order (VO) ditambahkan dan menunggu approval eksekutif.");
  };

  const handleOpenEditBoqItem = (row: any) => {
    const isManpower = String(row?.category || "").toLowerCase() === "manpower";
    const budgetQty = Number(row?.budgetQty || row?.qtyEstimate || 0);
    const manpowerDays = Number(row?.manpowerDays || row?.hari || (isManpower ? Math.max(1, budgetQty) : 1));
    const manpowerPersons = Number(row?.manpowerPersons || row?.orang || 1);
    setEditingBoqRow({
      sourceIndex: Number(row?.sourceIndex ?? -1),
      itemKode: String(row?.itemKode || ""),
      materialName: String(row?.materialName || ""),
      unit: String(row?.unit || "Mandays"),
      qtyEstimate: budgetQty,
      manpowerDays: isManpower ? Math.max(1, manpowerDays) : 1,
      manpowerPersons: isManpower ? Math.max(1, manpowerPersons) : 1,
      unitPrice: Number(row?.unitPrice || 0),
      category: String(row?.category || "Manpower"),
    });
    setShowEditBoqItemModal(true);
  };

  const handleSaveEditBoqItem = () => {
    if (!selectedProject || !editingBoqRow) return;
    const index = Number(editingBoqRow.sourceIndex ?? -1);
    if (index < 0) return;

    const nextBoq = [...(selectedProject.boq || [])];
    if (!nextBoq[index]) return;
    const isManpower = String(editingBoqRow.category || "").toLowerCase() === "manpower";
    const manpowerDays = Math.max(1, Number(editingBoqRow.manpowerDays || 1));
    const manpowerPersons = Math.max(1, Number(editingBoqRow.manpowerPersons || 1));
    const qtyEstimate = isManpower
      ? manpowerDays * manpowerPersons
      : Number(editingBoqRow.qtyEstimate || 0);

    nextBoq[index] = {
      ...nextBoq[index],
      materialName: String(editingBoqRow.materialName || "").trim(),
      unit: String(editingBoqRow.unit || "Mandays").trim(),
      qtyEstimate,
      manpowerDays: isManpower ? manpowerDays : undefined,
      manpowerPersons: isManpower ? manpowerPersons : undefined,
      unitPrice: Number(editingBoqRow.unitPrice || 0),
    } as any;

    updateProject(selectedProject.id, { boq: nextBoq });
    setShowEditBoqItemModal(false);
    setEditingBoqRow(null);
    toast.success("Item manpower BOQ berhasil diperbarui.");
  };

  const handleDeleteBoqItem = (row: any) => {
    if (!selectedProject) return;
    const index = Number(row?.sourceIndex ?? -1);
    if (index < 0) return;
    const confirmed = window.confirm(`Hapus item manpower "${row?.materialName || "-"}"?`);
    if (!confirmed) return;

    const nextBoq = (selectedProject.boq || []).filter((_, i) => i !== index);
    updateProject(selectedProject.id, { boq: nextBoq });
    toast.success("Item manpower BOQ berhasil dihapus.");
  };

  const getProjectFinancials = (projectId: string) =>
    projectFinancialsById[projectId] || {
      contractValue: 0,
      pettyCash: 0,
      poCommitted: 0,
      stockUsage: 0,
      laborCost: 0,
      equipmentCost: 0,
      actualSpent: 0,
      marginNominal: 0,
      marginPercent: 0,
      budgetUtilizationPercent: 0,
      boqBudget: 0,
      materialRequestEstimated: 0,
      materialRequestUsagePercent: 0,
    };

  const handleExportReport = async (project: Project, format: "word" | "excel") => {
    if (!isProjectApproved(project)) {
      toast.error("Export final hanya bisa untuk project yang sudah Approved.");
      return;
    }

    try {
      const ext = format === "word" ? "doc" : "xls";
      const url = format === "word"
        ? `/exports/projects/${project.id}/word`
        : `/exports/projects/${project.id}/excel`;

      const response = await api.get(url, { responseType: "blob" });
      const contentType =
        response.headers["content-type"] ||
        (format === "word"
          ? "application/msword; charset=utf-8"
          : "application/vnd.ms-excel; charset=utf-8");
      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${project.kodeProject || project.id}-summary.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`Ringkasan project (${format.toUpperCase()}) berhasil diexport`);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        `Gagal export ${format.toUpperCase()} project`;
      toast.error(message);
    }
  };

  const selectedProjectMaterialUsageReports = selectedProject
    ? (productionReportList || []).filter(
        (row: any) => String(row?.projectId || "").trim() === String(selectedProject.id).trim()
      )
    : [];

  const selectedProjectEquipmentUsage = selectedProject
    ? (fleetHealthList || []).filter(
        (row: any) => String(row?.projectId || "").trim() === String(selectedProject.id).trim()
      )
    : [];

  const selectedProjectMaterialRequests = selectedProject
    ? (materialRequestList || []).filter(
        (row: any) => String(row?.projectId || "").trim() === String(selectedProject.id).trim()
      )
    : [];

  const getMaterialRequestEstimatedCost = (mr: any) => {
    if (Number.isFinite(Number(mr?.estimatedCost))) return Number(mr.estimatedCost);
    const items = Array.isArray(mr?.items) ? mr.items : [];
    return items.reduce((sum: number, item: any) => {
      const qty = Number(item?.qty || 0);
      const unitPrice = Number(item?.unitPrice || 0);
      return sum + qty * unitPrice;
    }, 0);
  };

  const getMaterialRequestQuantity = (mr: any) => {
    if (Number.isFinite(Number(mr?.quantity))) return Number(mr.quantity);
    const items = Array.isArray(mr?.items) ? mr.items : [];
    return items.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0);
  };

  const getMaterialRequestUnit = (mr: any) =>
    String(mr?.unit || mr?.items?.[0]?.unit || "-");

  const getMaterialRequestItemName = (mr: any) =>
    String(mr?.itemName || mr?.items?.[0]?.itemNama || "-");

  const handleSaveMaterialUsageReport = async (report: any) => {
    if (!selectedProject) return;
    const existing = selectedProjectMaterialUsageReports || [];
    const idx = existing.findIndex((r: any) => r.id === report.id);
    try {
      if (idx >= 0) {
        await api.patch(`/production-reports/${report.id}`, report);
        setServerProductionReportList((prev) =>
          (prev || []).map((item: any) => (item.id === report.id ? { ...item, ...report } : item))
        );
      } else {
        await api.post("/production-reports", report);
        setServerProductionReportList((prev) => [report, ...(prev || [])]);
      }
      setEditingMaterialUsageReport(null);
      setShowMaterialUsageModal(false);
      toast.success(idx >= 0 ? "Laporan material berhasil diperbarui" : "Laporan material berhasil dibuat");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Gagal menyimpan laporan material");
    }
  };

  const selectedProjectBoqRows = (selectedProject?.boq || []).map((item: any, sourceIndex: number) => {
    const projectStockOuts = stockOutList.filter((so) => so.projectId === selectedProject?.id);
    const actualUsage = projectStockOuts.reduce((sum, so) => {
      const matchedItem = (so.items || []).find((si: any) => si.kode === item.itemKode);
      return sum + Number(matchedItem?.qty || 0);
    }, 0);
    const budgetQty = Number(item.qtyEstimate || 0);
    const manpowerDays = Number(item.manpowerDays || item.hari || 0);
    const manpowerPersons = Number(item.manpowerPersons || item.orang || 0);
    const unitPrice = Number(item.unitPrice || 0);
    return {
      ...item,
      sourceIndex,
      categoryKey: normalizeBoqCategory(item),
      actualUsage,
      budgetQty,
      manpowerDays,
      manpowerPersons,
      unitPrice,
      totalBudget: budgetQty * unitPrice,
    };
  });

  const boqCategorySummary = (Object.keys(BOQ_CATEGORY_META) as BoqCategoryKey[]).map((key) => {
    const rows = selectedProjectBoqRows.filter((row: any) => row.categoryKey === key);
    const subtotal = rows.reduce((acc: number, row: any) => acc + Number(row.totalBudget || 0), 0);
    const usage = rows.reduce((acc: number, row: any) => acc + Number(row.actualUsage || 0), 0);
    return { key, rows, subtotal, usage, count: rows.length };
  });

  const boqGrandTotal = boqCategorySummary.reduce((acc, c) => acc + c.subtotal, 0);

  const selectedProjectFinancial = selectedProject ? getProjectFinancials(selectedProject.id) : null;
  const selectedProjectSpkHistory = selectedProject
    ? Array.from(
        new Set(
          [
            ...((selectedProject as any).spkList || []).map((spk: any) => String(spk?.noSPK || "").trim()),
            ...workOrderList
              .filter((wo: any) => wo.projectId === selectedProject.id)
              .map((wo: any) => String(wo?.noSPK || wo?.woNumber || "").trim()),
            ...((selectedProjectMaterialUsageReports || []).map((r: any) => String(r?.spkNumber || "").trim())),
          ].filter((value) => value.length > 0)
        )
      )
    : [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 min-h-screen">
      {/* Premium Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
              <Briefcase size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Project Ledger</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">PT GTP Execution & Performance Monitoring</p>
          </div>
        </div>

        <div className="relative z-10">
          <button
            onClick={() => void fetchProjectSources()}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900 italic tracking-tighter">{activeProjectsCount}</span>
              <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase italic">In Execution</span>
            </div>
          </div>
          <div className="bg-emerald-500 p-6 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-2">Total Value</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black italic tracking-tighter">
                {formatCurrency(totalValueDisplay)}
              </span>
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-2">Efficiency</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black italic tracking-tighter">98.2%</span>
              <span className="text-[10px] font-bold text-white/40 mb-2 uppercase italic">Target Met</span>
            </div>
          </div>
        </div>

      <FlowHintBar
        title="Alur Project:"
        badges={[
          { label: "Pending", tone: "warning" },
          { label: "Approved", tone: "success" },
          { label: "Rejected", tone: "danger" },
          { label: "Unlock/Relock oleh OWNER/SPV", tone: "info" },
        ]}
        helper="Export final project hanya aktif saat approvalStatus = Approved."
        actions={[
          { label: "Buka Approval Hub", onClick: () => navigate("/finance/approvals") },
          { label: "Buka Quotation", onClick: () => navigate("/sales/quotation") },
        ]}
      />

      <div className="bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Cari project berdasarkan nama, kode atau customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[2rem] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
          />
        </div>
        <div className="flex gap-2 p-1">
          {["All", "Planning", "In Progress", "Completed", "Approved", "Rejected"].map((filter) => (
             <button 
               key={filter}
               onClick={() => setProjectFilter(filter as ProjectFilter)}
               className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 projectFilter === filter
                   ? "bg-slate-900 text-white"
                   : "text-slate-400 hover:bg-slate-900 hover:text-white"
               }`}
             >
               {filter}
             </button>
          ))}
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all cursor-pointer group flex flex-col h-full"
              onClick={() => handleViewProjectDetail(project)}
            >
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1 flex-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{project.kodeProject}</span>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter group-hover:text-blue-600 transition-colors leading-tight">
                      {project.namaProject}
                    </h3>
                    {/* Lineage Badges */}
                    {project.quotationId && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5">
                          <DollarSign size={12} className="text-emerald-600" />
                          <span className="text-[8px] font-black text-emerald-700 uppercase">From Quotation</span>
                        </div>
                        {(() => {
                          const linkedQuo = quotationList.find(q => q.id === project.quotationId);
                          return linkedQuo && (linkedQuo as any).dataCollectionId ? (
                            <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5">
                              <FileText size={12} className="text-blue-600" />
                              <span className="text-[8px] font-black text-blue-700 uppercase">From Survey</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getProjectStatusColor(project.status)}`}
                    >
                      {project.status}
                    </span>
                    <span
                      className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getApprovalStatusColor(project.approvalStatus)}`}
                    >
                      {project.approvalStatus || "Pending"}
                    </span>
                    <span
                      className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getQuotationStatusColor(getQuotationStatusByProject(project))}`}
                      title="Status quotation terbaru"
                    >
                      QUO: {getQuotationStatusByProject(project)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase truncate">{project.customer}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget Val.</p>
                    <p className="text-[10px] font-black text-blue-600 italic">{formatCurrency(project.nilaiKontrak)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-slate-400 italic">Execution Load</span>
                    <span className="text-slate-900">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                     <Users size={14} className="text-slate-400" />
                   </div>
                   <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center -ml-4">
                     <Wrench size={14} className="text-slate-400" />
                   </div>
                   <span className="text-[8px] font-bold text-slate-400 uppercase ml-1">Team Assigned</span>
                </div>
                <div className="flex gap-1">
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleViewProjectDetail(project); }}
                     className="p-3 bg-white text-slate-900 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200"
                   >
                     <Maximize2 size={16} />
                   </button>
                   <button 
                     onClick={(e) => {
                        e.stopPropagation();
                        if (isProjectLockedForEdit(project)) {
                          toast.error("Project sudah Approved. Edit field inti dikunci.");
                          return;
                        }
                        setSelectedProject(project);
                        setIsEditMode(true);
                        setFormData({
                          namaProject: project.namaProject,
                          customer: project.customer,
                          nilaiKontrak: project.nilaiKontrak,
                          startDate: project.startDate || "",
                          endDate: project.endDate,
                          status: project.status,
                          location: project.location || "",
                          projectManager: project.projectManager || "",
                          description: project.description || "",
                          progress: project.progress,
                          kategori: project.kategori || "",
                          tipePekerjaan: project.tipePekerjaan || "",
                          jenisKontrak: project.jenisKontrak || "",
                          quotationId: project.quotationId || "",
                        });
                        setProjectFormMaterials(project.boq || []);
                        setShowProjectModal(true);
                     }}
                     disabled={isProjectLockedForEdit(project)}
                     className={`p-3 rounded-xl transition-all shadow-sm border ${
                       isProjectLockedForEdit(project)
                         ? "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed"
                         : "bg-white text-slate-900 hover:bg-slate-900 hover:text-white border-slate-200"
                     }`}
                   >
                     <Edit size={16} />
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Basic Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black uppercase italic tracking-tighter">
                {isEditMode ? "Edit Project Details" : "Register New Project"}
              </h2>
              <button onClick={() => setShowProjectModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {isEditMode && selectedProject && isProjectLockedForEdit(selectedProject) && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Project sudah Approved. Field inti terkunci dan tidak bisa diubah.
                </div>
              )}
              {/* Quotation Reference Display */}
              {!isEditMode && formData.quotationId && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <FileText className="text-emerald-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Linked to Quotation</p>
                      <p className="text-sm font-black text-slate-900">
                        {quotationList.find(q => q.id === formData.quotationId)?.noPenawaran || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Project Name</label>
                  <input
                    value={formData.namaProject}
                    onChange={(e) => setFormData({ ...formData, namaProject: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Customer</label>
                  <input
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nilai Kontrak</label>
                  <input
                    type="number"
                    value={formData.nilaiKontrak}
                    onChange={(e) => setFormData({ ...formData, nilaiKontrak: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowProjectModal(false)} className="px-6 py-2 font-bold text-slate-400 uppercase text-[10px]">Cancel</button>
              <button onClick={handleSaveProject} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-100">Save Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation List Modal */}
      {showQuotationListModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-[4rem] overflow-hidden shadow-2xl">
            <div className="p-10 bg-gradient-to-r from-emerald-600 to-green-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center shadow-xl">
                  <DollarSign size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tight">Select Quotation (Draft/Sent)</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-90">Convert Quotation to Project</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowQuotationListModal(false)} 
                className="p-4 bg-white/20 hover:bg-white/30 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-10 max-h-[60vh] overflow-auto">
              {approvedQuotations.length === 0 ? (
                <div className="text-center py-20">
                  <FileText size={64} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold uppercase text-sm">No quotations available</p>
                  <p className="text-slate-400 text-xs mt-2">Buat quotation dulu dari Data Collection atau Manual</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {approvedQuotations.map((quo) => (
                    <div 
                      key={quo.id}
                      className="bg-gradient-to-r from-slate-50 to-white p-6 rounded-[2rem] border-2 border-slate-200 hover:border-emerald-400 transition-all cursor-pointer group"
                      onClick={() => handleSelectQuotation(quo)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="px-4 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">
                              {quo.status}
                            </span>
                            <span className="text-xs font-black text-blue-600 uppercase italic">{quo.noPenawaran}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Customer</p>
                              <p className="text-sm font-black text-slate-900">{quo.kepada}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Location</p>
                              <p className="text-sm font-bold text-slate-600">{quo.lokasi}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Perihal</p>
                              <p className="text-xs font-bold text-slate-600">{quo.perihal}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Grand Total</p>
                              <p className="text-xs font-black text-emerald-600">Rp {quo.grandTotal.toLocaleString('id-ID')}</p>
                            </div>
                          </div>

                          {quo.sections && quo.sections.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Items Preview</p>
                              <p className="text-xs text-slate-600">
                                {quo.sections.length} section(s), {quo.sections.reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0)} item(s)
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="ml-6 p-4 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-all">
                          <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowQuotationListModal(false)} 
                className="px-10 py-5 bg-white border border-slate-200 text-slate-600 rounded-[2rem] font-black uppercase text-sm tracking-widest hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Project Detail Modal */}
      {showProjectDetailModal && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            {(() => {
              const linkedQuotationStatus = String(getQuotationStatusByProject(selectedProject) || "").toUpperCase();
              const quotationReadyForProjectApproval = linkedQuotationStatus === "APPROVED";
              return (
                <div className="mx-10 mt-6 p-3 rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Flow:</span>
                    <span className="px-2 py-1 text-[10px] rounded border bg-blue-50 text-blue-700 border-blue-200">Quotation: {linkedQuotationStatus || "UNKNOWN"}</span>
                    <span className="px-2 py-1 text-[10px] rounded border bg-amber-50 text-amber-700 border-amber-200">Project: {String(selectedProject.approvalStatus || "Pending")}</span>
                    <span className={`px-2 py-1 text-[10px] rounded border ${
                      quotationReadyForProjectApproval
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {quotationReadyForProjectApproval ? "Project approval ready" : "Approve quotation dulu"}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div className="p-10 border-b border-slate-100 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="px-4 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">{selectedProject.kodeProject}</span>
                    <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getProjectStatusColor(selectedProject.status)}`}>
                      {selectedProject.status}
                    </span>
                    <span
                      className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        String(selectedProject.approvalStatus || "Pending").toUpperCase() === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : String(selectedProject.approvalStatus || "Pending").toUpperCase() === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {selectedProject.approvalStatus || "Pending"}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">{selectedProject.namaProject}</h2>
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 size={18} className="text-slate-400" />
                      <span className="font-bold uppercase tracking-widest text-[10px]">{selectedProject.customer}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600">
                      <Receipt size={18} />
                      <span className="font-black italic text-lg tracking-tighter">{formatCurrency(selectedProject.nilaiKontrak)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approval Log:</span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase">
                      {selectedProject.approvedBy ? `By ${selectedProject.approvedBy}` : "By -"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {formatDateTime(selectedProject.approvedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/finance/approvals')}
                    className="px-4 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest bg-slate-50 text-slate-700 hover:bg-slate-900 hover:text-white"
                    title="Approval/Reject project dilakukan dari Finance Approval"
                  >
                    Buka Finance Approval
                  </button>
                  <button
                    onClick={() => handleExportReport(selectedProject, "word")}
                    disabled={!isProjectApproved(selectedProject)}
                    className={`p-4 rounded-2xl transition-all group ${
                      isProjectApproved(selectedProject)
                        ? "bg-slate-50 hover:bg-slate-900 hover:text-white"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    }`}
                    title={
                      isProjectApproved(selectedProject)
                        ? "Export Summary (Word)"
                        : "Project harus Approved dulu untuk export final"
                    }
                  >
                    <FileText size={20} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <button
                    onClick={() => handleExportReport(selectedProject, "excel")}
                    disabled={!isProjectApproved(selectedProject)}
                    className={`p-4 rounded-2xl transition-all group ${
                      isProjectApproved(selectedProject)
                        ? "bg-slate-50 hover:bg-emerald-600 hover:text-white"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    }`}
                    title={
                      isProjectApproved(selectedProject)
                        ? "Export Summary (Excel)"
                        : "Project harus Approved dulu untuk export final"
                    }
                  >
                    <FileSpreadsheet size={20} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setShowProjectDetailModal(false)}
                    className="p-4 bg-slate-100 hover:bg-red-500 hover:text-white rounded-2xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-100 px-10 bg-white overflow-x-auto">
              {(["overview", "boq", "work-order", "field-records", "procurement", "financials"] as ProjectTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProjectTab(tab)}
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${
                    projectTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
                  }`}
                >
                  {tab.replace("-", " ")}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
              {projectDetailLoading && (
                <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-700">
                  Sinkronisasi detail project dari server...
                </div>
              )}
              {projectTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4">Execution Roadmap</h3>
                      <TimelineTracker 
                        project={selectedProject} 
                        workOrders={workOrderList.filter(wo => wo.projectId === selectedProject.id)} 
                      />
                    </div>
                    {selectedQuotationSnapshot && (
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4">
                          Quotation Snapshot (Locked At Approval)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">No Penawaran</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationSnapshot.noPenawaran || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationSnapshot.tanggal || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Perihal</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationSnapshot.perihal || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                            <p className="text-[11px] font-black text-blue-600">
                              {formatCurrency(Number(selectedQuotationSnapshot.grandTotal || 0))}
                            </p>
                          </div>
                        </div>

                        {(selectedSnapshotScope.length > 0 || selectedSnapshotExclusions.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">Scope Of Work</p>
                              {selectedSnapshotScope.length === 0 ? (
                                <p className="text-[10px] text-slate-500">-</p>
                              ) : (
                                <ul className="list-disc pl-4 space-y-1">
                                  {selectedSnapshotScope.slice(0, 6).map((item, idx) => (
                                    <li key={`scope-${idx}`} className="text-[10px] font-bold text-slate-700">{item}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                              <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-2">Exclusions</p>
                              {selectedSnapshotExclusions.length === 0 ? (
                                <p className="text-[10px] text-slate-500">-</p>
                              ) : (
                                <ul className="list-disc pl-4 space-y-1">
                                  {selectedSnapshotExclusions.slice(0, 6).map((item, idx) => (
                                    <li key={`exc-${idx}`} className="text-[10px] font-bold text-slate-700">{item}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Snapshot By</span>
                          <span className="text-[10px] font-bold text-slate-700">{selectedProject.quotationSnapshotBy || "-"}</span>
                          <span className="text-[10px] font-bold text-slate-500">{formatDateTime(selectedProject.quotationSnapshotAt)}</span>
                        </div>
                      </div>
                    )}
                    {!selectedQuotationSnapshot && selectedQuotationPreview && (
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4">
                          Quotation Linked Preview
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">No Penawaran</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationPreview.noPenawaran || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Quotation</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationPreview.status || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Perihal</p>
                            <p className="text-[11px] font-black text-slate-900">{selectedQuotationPreview.perihal || "-"}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                            <p className="text-[11px] font-black text-blue-600">
                              {formatCurrency(Number(selectedQuotationPreview.grandTotal || 0))}
                            </p>
                          </div>
                        </div>
                        {(selectedPreviewScope.length > 0 || selectedPreviewExclusions.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">Scope Of Work</p>
                              {selectedPreviewScope.length === 0 ? (
                                <p className="text-[10px] text-slate-500">-</p>
                              ) : (
                                <ul className="list-disc pl-4 space-y-1">
                                  {selectedPreviewScope.slice(0, 6).map((item, idx) => (
                                    <li key={`preview-scope-${idx}`} className="text-[10px] font-bold text-slate-700">{item}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                              <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-2">Exclusions</p>
                              {selectedPreviewExclusions.length === 0 ? (
                                <p className="text-[10px] text-slate-500">-</p>
                              ) : (
                                <ul className="list-disc pl-4 space-y-1">
                                  {selectedPreviewExclusions.slice(0, 6).map((item, idx) => (
                                    <li key={`preview-exc-${idx}`} className="text-[10px] font-bold text-slate-700">{item}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4 italic">Budget Health (Real-time)</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Contract Value</span>
                          <span className="font-black text-slate-900">{formatCurrency(selectedProject.nilaiKontrak)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Actual Spent (COGS)</span>
                          <span className="font-black text-emerald-600">{formatCurrency(Number(selectedProjectFinancial?.actualSpent || 0))}</span>
                        </div>
                        {(() => {
                          const perc = Number(selectedProjectFinancial?.budgetUtilizationPercent || 0);
                          return (
                            <div className="space-y-2">
                              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mt-4">
                                <div className={`h-full ${perc > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, perc)}%` }}></div>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase text-center italic">Budget Utilization: {perc.toFixed(1)}%</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {projectTab === "financials" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Petty Cash / Exp.</p>
                       <h3 className="text-xl font-black text-slate-900">
                         {formatCurrency(Number(selectedProjectFinancial?.pettyCash || 0))}
                       </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Committed (POs)</p>
                       <h3 className="text-xl font-black text-slate-900">
                         {formatCurrency(Number(selectedProjectFinancial?.poCommitted || 0))}
                       </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Stock Usage (Actual)</p>
                       <h3 className="text-xl font-black text-indigo-600">
                         {formatCurrency(Number(selectedProjectFinancial?.stockUsage || 0))}
                       </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Labor Cost (Synced)</p>
                       <h3 className="text-xl font-black text-rose-600">
                         {formatCurrency(Number(selectedProjectFinancial?.laborCost || 0))}
                       </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Equipment Cost (Actual)</p>
                       <h3 className="text-xl font-black text-emerald-600">
                         {formatCurrency(Number(selectedProjectFinancial?.equipmentCost || 0))}
                       </h3>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-200">
                       <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">Current Margin</p>
                       <div className="flex items-center justify-between">
                         <h3 className="text-xl font-black italic">{formatCurrency(Number(selectedProjectFinancial?.marginNominal || 0))}</h3>
                         <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md">
                           {Number(selectedProjectFinancial?.marginPercent || 0).toFixed(1)}%
                         </span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Petty Cash Table */}
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] italic">Petty Cash Ledger</h3>
                        <button 
                          onClick={() => setShowAddExpenseModal(true)}
                          className="px-4 py-2 bg-slate-100 text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all"
                        >
                          <Plus size={14} /> New Entry
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[400px]">
                         {(selectedProject.workingExpenses || []).length === 0 ? (
                           <div className="py-10 text-center italic text-slate-400 text-xs uppercase font-bold tracking-widest">No local expenses recorded.</div>
                         ) : (
                           <table className="w-full text-left">
                              <thead>
                                <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                  <th className="pb-4">Date</th>
                                  <th className="pb-4">Scope / Description</th>
                                  <th className="pb-4 text-right">Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {selectedProject.workingExpenses?.map((exp, i) => (
                                  <tr key={i} className="text-[10px] font-black text-slate-600">
                                    <td className="py-4 opacity-50">{exp.date}</td>
                                    <td className="py-4 uppercase italic tracking-tighter">{exp.description}</td>
                                    <td className="py-4 text-right text-slate-900">{formatCurrency(exp.nominal || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                           </table>
                         )}
                      </div>
                    </div>

                    {/* Stock Consumption Table */}
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-indigo-600">Material Consumption (Stock Out)</h3>
                        <div className="text-[8px] font-bold text-slate-400 uppercase">Synced with Warehouse Ledger</div>
                      </div>
                      <div className="overflow-x-auto max-h-[400px]">
                         {stockOutList.filter(so => so.projectId === selectedProject.id).length === 0 ? (
                           <div className="py-10 text-center italic text-slate-400 text-xs uppercase font-bold tracking-widest">No warehouse releases for this project.</div>
                         ) : (
                           <table className="w-full text-left">
                              <thead>
                                <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                  <th className="pb-4">SO No.</th>
                                  <th className="pb-4">Material / SKU</th>
                                  <th className="pb-4 text-center">Qty</th>
                                  <th className="pb-4 text-right">Valuation</th>
                                </tr>
                              </thead>
                              {stockOutList.filter(so => so.projectId === selectedProject.id).map((so) => (
                                <tbody key={so.id} className="divide-y divide-slate-50 border-b border-slate-50 last:border-0">
                                  {(so.items || []).map((item, idx) => {
                                    const master = stockItemList.find(s => s.kode === item.kode);
                                    const valuation = item.qty * (master?.hargaSatuan || 0);
                                    return (
                                      <tr key={`${so.id}-${idx}`} className="text-[10px] font-black text-slate-600">
                                        <td className="py-4 opacity-50">{so.noStockOut}</td>
                                        <td className="py-4">
                                          <div className="uppercase italic tracking-tighter">{item.nama}</div>
                                          <div className="text-[7px] text-slate-400 font-bold">{item.kode}</div>
                                        </td>
                                        <td className="py-4 text-center">{item.qty} {item.unit}</td>
                                        <td className="py-4 text-right text-indigo-600">{formatCurrency(valuation)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              ))}
                           </table>
                         )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {projectTab === "work-order" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="text-sm font-black uppercase tracking-widest italic">Work Orders (Active SPK)</h3>
                         <button 
                           onClick={() => {
                             if (!canGenerateWorkOrder(selectedProject)) {
                               toast.error("SPK hanya bisa dibuat jika Project atau Quotation sudah Approved.");
                               return;
                             }
                             setShowAddWorkOrderModal(true);
                           }}
                           disabled={!canGenerateWorkOrder(selectedProject)}
                           className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                             canGenerateWorkOrder(selectedProject)
                               ? "bg-blue-600 text-white"
                               : "bg-slate-200 text-slate-400 cursor-not-allowed"
                           }`}
                         >
                           <Plus size={14} /> Generate New SPK
                         </button>
                      </div>
                      <div className="space-y-4">
                        {workOrderList.filter(wo => wo.projectId === selectedProject.id).length === 0 ? (
                           <div className="py-10 text-center italic text-slate-400 text-xs">Belum ada Work Order aktif untuk proyek ini.</div>
                        ) : (
                          workOrderList.filter(wo => wo.projectId === selectedProject.id).map((wo) => (
                            <div key={wo.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-lg transition-all">
                               <div>
                                  <p className="text-[9px] font-black text-blue-600 uppercase mb-1">{wo.woNumber}</p>
                                  <h4 className="text-sm font-black text-slate-900 uppercase italic">{wo.itemToProduce}</h4>
                                  <div className="flex gap-4 mt-2">
                                     <span className="text-[8px] font-bold text-slate-400 uppercase">Technician: {wo.leadTechnician}</span>
                                     <span className="text-[8px] font-bold text-slate-400 uppercase">Deadline: {wo.deadline}</span>
                                  </div>
                               </div>
                               <div className="flex flex-col items-end gap-2">
                                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                                     wo.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                  }`}>{wo.status}</span>
                                  <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                     <div className="h-full bg-blue-600" style={{ width: `${(wo.completedQty || 0) / wo.targetQty * 100}%` }}></div>
                                  </div>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                   </div>
                </div>
              )}

              {projectTab === "field-records" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Attendance Logs</p>
                      <h3 className="text-2xl font-black text-slate-900">
                        {attendanceList.filter((a: any) => a.projectId === selectedProject.id).length}
                      </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Material Usage Reports</p>
                      <h3 className="text-2xl font-black text-blue-600">
                        {selectedProjectMaterialUsageReports.length}
                      </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Equipment Usage Entries</p>
                      <h3 className="text-2xl font-black text-emerald-600">
                        {selectedProjectEquipmentUsage.length}
                      </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Equipment Hours</p>
                      <h3 className="text-2xl font-black text-indigo-600">
                        {(selectedProjectEquipmentUsage.reduce((sum: number, row: any) => sum + Number(row?.hoursUsed || 0), 0)).toFixed(1)}h
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Material Usage Reports</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data dari project payload (DB)</p>
                      </div>
                      <button
                        onClick={() => {
                          setMaterialUsageModalMode("create");
                          setEditingMaterialUsageReport(null);
                          setShowMaterialUsageModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 transition-all"
                      >
                        <Plus size={14} /> New Material Report
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Report No</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">No SPK</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Items</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedProjectMaterialUsageReports.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-all">
                              <td className="px-8 py-5 text-[11px] font-black text-blue-600">{r.reportNumber || "-"}</td>
                              <td className="px-8 py-5 text-[11px] font-black text-slate-700">{r.spkNumber || "-"}</td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{r.date || "-"}</td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-700 uppercase">{r.location || "-"}</td>
                              <td className="px-8 py-5 text-center text-[11px] font-black text-slate-900">{(r.items || []).length}</td>
                              <td className="px-8 py-5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setMaterialUsageModalMode("view");
                                      setEditingMaterialUsageReport(r);
                                      setShowMaterialUsageModal(true);
                                    }}
                                    className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                    title="Detail"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMaterialUsageModalMode("edit");
                                      setEditingMaterialUsageReport(r);
                                      setShowMaterialUsageModal(true);
                                    }}
                                    className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                                    title="Edit"
                                  >
                                    <Edit size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {selectedProjectMaterialUsageReports.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-8 py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                Belum ada material usage report untuk project ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {projectTab === "procurement" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <Package size={120} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total BOQ Budget</p>
                      <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">
                        {formatCurrency((selectedProject.boq || []).reduce((acc, item) => acc + ((item.qtyEstimate || 0) * (item.unitPrice || 0)), 0))}
                      </h3>
                      <div className="mt-6 flex items-center gap-3">
                        <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
                             style={{ width: `${Math.min(100, ((selectedProjectMaterialRequests.reduce((acc, r) => acc + getMaterialRequestEstimatedCost(r), 0) / ((selectedProject.boq || []).reduce((acc, item) => acc + ((item.qtyEstimate || 0) * (item.unitPrice || 0)), 0)) || 1) * 100))}%` }} 
                           />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 italic">
                           {Math.round(((selectedProjectMaterialRequests.reduce((acc, r) => acc + getMaterialRequestEstimatedCost(r), 0) / ((selectedProject.boq || []).reduce((acc, item) => acc + ((item.qtyEstimate || 0) * (item.unitPrice || 0)), 0)) || 0) * 100))}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700 text-amber-500">
                        <ShoppingCart size={120} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Pending Requests</p>
                      <h3 className="text-3xl font-black text-amber-600 italic tracking-tighter">
                        {selectedProjectMaterialRequests.filter((r: any) => String(r?.status || "").toUpperCase() === "PENDING").length} <span className="text-sm font-bold uppercase text-slate-300 ml-1">Entries</span>
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-[0.1em]">Awaiting Exec. Approval</p>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp size={120} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Procurement Performance</p>
                      <h3 className="text-3xl font-black text-emerald-400 italic tracking-tighter">+12.4%</h3>
                      <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-[0.1em]">Above Efficiency Target</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Field Material Requests (MR)</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sinkronisasi Otomatis Lapangan & Procurement</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10">
                          Download MR Batch
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Request Date</th>
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Material Description</th>
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Req. Qty</th>
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Est. Cost</th>
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                            <th className="px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedProjectMaterialRequests.map((mr: any) => (
                            <tr key={mr.id} className="hover:bg-slate-50/50 transition-all group">
                              <td className="px-10 py-6 text-[10px] font-black text-slate-400">{mr.requestDate || mr.requestedAt || "-"}</td>
                              <td className="px-10 py-6">
                                <p className="text-xs font-black text-slate-900 uppercase italic">{getMaterialRequestItemName(mr)}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Requester: {mr.requestedBy}</p>
                              </td>
                              <td className="px-10 py-6 text-center text-xs font-black text-slate-900">
                                {getMaterialRequestQuantity(mr)} <span className="text-[9px] text-slate-400 lowercase">{getMaterialRequestUnit(mr)}</span>
                              </td>
                              <td className="px-10 py-6 text-right text-xs font-black text-slate-900 italic font-mono">
                                {formatCurrency(getMaterialRequestEstimatedCost(mr))}
                              </td>
                              <td className="px-10 py-6">
                                <div className="flex justify-center">
                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${
                                    mr.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    mr.status === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    mr.status === 'Ordered' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                                  }`}>
                                    {mr.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-10 py-6 text-right">
                                {mr.status === 'Pending' && (
                                  <button 
                                    onClick={() => {
                                      if (!guardApprovedProject(selectedProject)) return;
                                      updateMaterialRequestStatus(selectedProject.id, mr.id, 'Approved');
                                      toast.success(`MR for ${getMaterialRequestItemName(mr)} approved and pushed to Procurement.`);
                                    }}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-slate-900 transition-all transform active:scale-95"
                                  >
                                    Approve MR
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {selectedProjectMaterialRequests.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-10 py-24 text-center">
                                 <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6 border border-dashed border-slate-200 group-hover:scale-110 transition-transform">
                                    <ShoppingCart size={32} />
                                 </div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic mb-1">Queue is Empty</p>
                                 <p className="text-[9px] font-bold text-slate-300 uppercase">No pending field material requests found.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {projectTab === "boq" && (
                <div className="animate-in fade-in duration-500">
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                            <Package size={18} className="text-blue-600" /> Bill of Quantities (Project Ledger)
                         </h3>
                         <div className="flex gap-2">
                            <button className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest">
                               Export BOQ
                            </button>
                            <button 
                              onClick={() => {
                                if (!guardApprovedProject(selectedProject)) return;
                                setBoqFormData(createInitialVoFormData());
                                setShowAddBOQItemModal(true);
                              }}
                              disabled={!isProjectApproved(selectedProject)}
                              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                isProjectApproved(selectedProject)
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:scale-105"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                               <Plus size={14} /> Variation Order
                            </button>
                         </div>
                      </div>
                      {selectedProjectBoqRows.length === 0 ? (
                        <div className="py-20 text-center border border-dashed border-slate-200 rounded-3xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] italic mb-1">BOQ Kosong</p>
                          <p className="text-[10px] font-bold text-slate-500">Tambahkan item dari quotation atau buat variation order.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                            {boqCategorySummary.map((cat) => {
                              const meta = BOQ_CATEGORY_META[cat.key];
                              const share = boqGrandTotal > 0 ? Math.round((cat.subtotal / boqGrandTotal) * 100) : 0;
                              return (
                                <div key={cat.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                                  <span className={`inline-flex px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${meta.badge}`}>
                                    {meta.label}
                                  </span>
                                  <p className="mt-2 text-lg font-black text-slate-900">{formatCurrency(cat.subtotal)}</p>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {cat.count} item • {share}% total
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          {boqCategorySummary.map((cat) => {
                            if (cat.count === 0) return null;
                            const meta = BOQ_CATEGORY_META[cat.key];
                            const isOpen = expandedBoqCategories[cat.key];
                            return (
                              <div key={`section-${cat.key}`} className="rounded-2xl border border-slate-100 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedBoqCategories((prev) => ({ ...prev, [cat.key]: !prev[cat.key] }))
                                  }
                                  className="w-full px-4 py-3 bg-white flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3 text-left">
                                    <span className={`inline-flex px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${meta.badge}`}>
                                      {meta.label}
                                    </span>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                      {cat.count} Item • {formatCurrency(cat.subtotal)}
                                    </p>
                                    {cat.key === "manpower" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!guardApprovedProject(selectedProject)) return;
                                          setBoqFormData(createInitialVoFormData("Manpower"));
                                          setShowAddBOQItemModal(true);
                                        }}
                                        className="px-2.5 py-1 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                                      >
                                        + Add Manpower
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                                    {isOpen ? "Hide Detail" : "Show Detail"}
                                  </span>
                                </button>

                                {isOpen && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-y border-slate-100">
                                          <th className="p-4">Item Code</th>
                                          <th className="p-4">Description</th>
                                          <th className="p-4 text-center">Unit</th>
                                          {cat.key === "manpower" && <th className="p-4 text-center">Hari</th>}
                                          {cat.key === "manpower" && <th className="p-4 text-center">Orang</th>}
                                          <th className="p-4 text-center">Budget Qty</th>
                                          {cat.key !== "manpower" && <th className="p-4 text-center">Used Qty</th>}
                                          <th className="p-4 text-right">Unit Price</th>
                                          <th className="p-4 text-right">Total Budget</th>
                                          {cat.key === "manpower" && <th className="p-4 text-right">Action</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {cat.rows.map((row: any, i: number) => (
                                          <tr key={`${cat.key}-${i}`} className="text-xs font-bold hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-slate-400 font-mono text-[10px]">{row.itemKode || "-"}</td>
                                            <td className="p-4 uppercase text-slate-900">{row.materialName}</td>
                                            <td className="p-4 text-center text-slate-500">{row.unit}</td>
                                            {cat.key === "manpower" && (
                                              <td className="p-4 text-center text-slate-700 font-black">{Number(row.manpowerDays || 0) || 1}</td>
                                            )}
                                            {cat.key === "manpower" && (
                                              <td className="p-4 text-center text-slate-700 font-black">{Number(row.manpowerPersons || 0) || 1}</td>
                                            )}
                                            <td className="p-4 text-center text-slate-900 font-black">{row.budgetQty}</td>
                                            {cat.key !== "manpower" && (
                                              <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${row.actualUsage > row.budgetQty ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                                                  {row.actualUsage}
                                                </span>
                                              </td>
                                            )}
                                            <td className="p-4 text-right text-slate-600">{formatCurrency(row.unitPrice)}</td>
                                            <td className="p-4 text-right font-black text-blue-600">{formatCurrency(row.totalBudget)}</td>
                                            {cat.key === "manpower" && (
                                              <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditBoqItem(row)}
                                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-900 hover:text-white transition-all"
                                                    aria-label="Edit manpower item"
                                                  >
                                                    <Edit size={14} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteBoqItem(row)}
                                                    className="p-2 rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"
                                                    aria-label="Delete manpower item"
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal for Adding Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-sm font-black uppercase tracking-widest italic">Add Project Expense</h3>
               <button onClick={() => setShowAddExpenseModal(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                  <input 
                    type="text" 
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({...expenseFormData, description: e.target.value})}
                    placeholder="e.g. Pembelian Material Mendadak" 
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nominal (IDR)</label>
                    <input 
                      type="number" 
                      value={expenseFormData.nominal}
                      onChange={(e) => setExpenseFormData({...expenseFormData, nominal: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                    <input 
                      type="date" 
                      value={expenseFormData.date}
                      onChange={(e) => setExpenseFormData({...expenseFormData, date: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                  <select 
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({...expenseFormData, category: e.target.value})}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  >
                    <option>Operational</option>
                    <option>Material</option>
                    <option>Manpower</option>
                    <option>Tools</option>
                  </select>
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setShowAddExpenseModal(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
               <button onClick={handleAddExpense} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200">Confirm Ledger Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Adding Work Order */}
      {showAddWorkOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
               <h3 className="text-sm font-black uppercase tracking-widest italic">Generate New Work Order (SPK)</h3>
               <button onClick={() => setShowAddWorkOrderModal(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Item / Scope of Work</label>
                  <input 
                    type="text" 
                    value={woFormData.itemToProduce}
                    onChange={(e) => setWoFormData({...woFormData, itemToProduce: e.target.value})}
                    placeholder="e.g. Pemasangan Bata Api Dinding Timur" 
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Quantity</label>
                    <input 
                      type="number" 
                      value={woFormData.targetQty}
                      onChange={(e) => setWoFormData({...woFormData, targetQty: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Deadline</label>
                    <input 
                      type="date" 
                      value={woFormData.deadline}
                      onChange={(e) => setWoFormData({...woFormData, deadline: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lead Technician</label>
                  <input 
                    type="text" 
                    value={woFormData.leadTechnician}
                    onChange={(e) => setWoFormData({...woFormData, leadTechnician: e.target.value})}
                    placeholder="Nama Teknisi Utama" 
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Priority Level</label>
                  <div className="flex gap-2">
                    {['Normal', 'Urgent'].map(p => (
                      <button 
                        key={p}
                        onClick={() => setWoFormData({...woFormData, priority: p as any})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          woFormData.priority === p ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setShowAddWorkOrderModal(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
               <button onClick={handleAddWorkOrder} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100">Issue SPK Now</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal for Variation Order (Add BOQ Item) */}
      {showAddBOQItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-blue-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
               <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                 <Package size={18} /> New Variation Order (VO)
               </h3>
               <button onClick={() => setShowAddBOQItemModal(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
                  <p className="text-[10px] font-bold text-blue-600 uppercase italic">Catatan: VO akan menambah item baru ke dalam Bill of Quantities proyek ini secara permanen.</p>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                  <select
                    value={boqFormData.category}
                    onChange={(e) => {
                      const nextCategory = (e.target.value as VoCategory) || "Material";
                      setBoqFormData({
                        ...boqFormData,
                        category: nextCategory,
                        itemKode: createVoItemCode(nextCategory),
                        unit: VO_CATEGORY_CONFIG[nextCategory].defaultUnit,
                      });
                    }}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  >
                    <option value="Manpower">Manpower</option>
                    <option value="Material">Material</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Consumable">Consumable</option>
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Item Code</label>
                    <input 
                      type="text" 
                      readOnly
                      value={boqFormData.itemKode}
                      className="w-full p-3 bg-slate-100 border-none rounded-xl font-mono text-xs text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                    <select 
                      value={boqFormData.unit}
                      onChange={(e) => setBoqFormData({...boqFormData, unit: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    >
                      <option>Sack</option>
                      <option>Pcs</option>
                      <option>M3</option>
                      <option>Kg</option>
                      <option>Unit</option>
                      <option>Lot</option>
                      <option>Mandays</option>
                    </select>
                  </div>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Item Description</label>
                  <input 
                    type="text" 
                    value={boqFormData.materialName}
                    onChange={(e) => setBoqFormData({...boqFormData, materialName: e.target.value})}
                    placeholder="e.g. Semen Tiga Roda (Extra)" 
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Qty Estimate</label>
                    <input 
                      type="number" 
                      value={boqFormData.qtyEstimate}
                      onChange={(e) => setBoqFormData({...boqFormData, qtyEstimate: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit Price (IDR)</label>
                    <input 
                      type="number" 
                      value={boqFormData.unitPrice}
                      onChange={(e) => setBoqFormData({...boqFormData, unitPrice: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                 </div>
               </div>
               {boqFormData.category === "Manpower" && (
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hari</label>
                     <input
                       type="number"
                       min={1}
                       value={(boqFormData as any).manpowerDays || 1}
                       onChange={(e) =>
                         setBoqFormData({
                           ...boqFormData,
                           manpowerDays: Math.max(1, Number(e.target.value || 1)),
                         } as any)
                       }
                       className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                     />
                   </div>
                   <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Orang</label>
                     <input
                       type="number"
                       min={1}
                       value={(boqFormData as any).manpowerPersons || 1}
                       onChange={(e) =>
                         setBoqFormData({
                           ...boqFormData,
                           manpowerPersons: Math.max(1, Number(e.target.value || 1)),
                         } as any)
                       }
                       className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                     />
                   </div>
                 </div>
               )}
               <div className="pt-4 border-t border-slate-50 mt-4 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Subtotal VO:</span>
                  <span className="text-xl font-black text-blue-600 italic">
                    {formatCurrency(
                      (boqFormData.category === "Manpower"
                        ? Math.max(1, Number((boqFormData as any).manpowerDays || 1)) *
                          Math.max(1, Number((boqFormData as any).manpowerPersons || 1))
                        : Number(boqFormData.qtyEstimate || 0)) * Number(boqFormData.unitPrice || 0)
                    )}
                  </span>
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setShowAddBOQItemModal(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
               <button onClick={handleAddBOQItem} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100">Add to BOQ Ledger</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Edit BOQ Manpower Item */}
      {showEditBoqItemModal && editingBoqRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="text-sm font-black uppercase tracking-widest italic">Edit BOQ Manpower</h3>
              <button
                onClick={() => {
                  setShowEditBoqItemModal(false);
                  setEditingBoqRow(null);
                }}
                className="text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Item Code</label>
                  <input
                    type="text"
                    value={editingBoqRow.itemKode}
                    readOnly
                    className="w-full p-3 bg-slate-100 border-none rounded-xl font-mono text-xs text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                  <select
                    value={editingBoqRow.unit}
                    onChange={(e) => setEditingBoqRow({ ...editingBoqRow, unit: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  >
                    <option>Orang</option>
                    <option>Mandays</option>
                    <option>Jam</option>
                    <option>Shift</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama/Deskripsi</label>
                <input
                  type="text"
                  value={editingBoqRow.materialName}
                  onChange={(e) => setEditingBoqRow({ ...editingBoqRow, materialName: e.target.value })}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Budget Qty</label>
                  <input
                    type="number"
                    value={editingBoqRow.qtyEstimate}
                    onChange={(e) => setEditingBoqRow({ ...editingBoqRow, qtyEstimate: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit Price</label>
                  <input
                    type="number"
                    value={editingBoqRow.unitPrice}
                    onChange={(e) => setEditingBoqRow({ ...editingBoqRow, unitPrice: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  />
                </div>
              </div>
              {String(editingBoqRow.category || "").toLowerCase() === "manpower" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hari</label>
                    <input
                      type="number"
                      min={1}
                      value={Number(editingBoqRow.manpowerDays || 1)}
                      onChange={(e) => setEditingBoqRow({ ...editingBoqRow, manpowerDays: Math.max(1, Number(e.target.value || 1)) })}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Orang</label>
                    <input
                      type="number"
                      min={1}
                      value={Number(editingBoqRow.manpowerPersons || 1)}
                      onChange={(e) => setEditingBoqRow({ ...editingBoqRow, manpowerPersons: Math.max(1, Number(e.target.value || 1)) })}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    />
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Total Budget</span>
                <span className="text-xl font-black text-blue-600 italic">
                  {formatCurrency(
                    (String(editingBoqRow.category || "").toLowerCase() === "manpower"
                      ? Math.max(1, Number(editingBoqRow.manpowerDays || 1)) *
                        Math.max(1, Number(editingBoqRow.manpowerPersons || 1))
                      : Number(editingBoqRow.qtyEstimate || 0)) * Number(editingBoqRow.unitPrice || 0)
                  )}
                </span>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditBoqItemModal(false);
                  setEditingBoqRow(null);
                }}
                className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditBoqItem}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <MaterialUsageReportModal
          projectId={selectedProject.id}
          projectName={selectedProject.namaProject}
          customerName={selectedProject.customer}
          spkOptions={selectedProjectSpkHistory}
          isOpen={showMaterialUsageModal}
          mode={materialUsageModalMode}
          onClose={() => {
            setEditingMaterialUsageReport(null);
            setShowMaterialUsageModal(false);
            setMaterialUsageModalMode("create");
          }}
          onSave={handleSaveMaterialUsageReport}
          editingReport={editingMaterialUsageReport}
        />
      )}
    </div>
  );
}
