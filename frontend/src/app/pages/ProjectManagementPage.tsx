import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import {
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
  DollarSign,
  Plus,
  Camera,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  Layers,
  AlertCircle,
  Truck,
  FileText,
  CreditCard,
  Store,
  BadgeCheck,
  CircleDot,
  SendHorizonal,
} from "lucide-react";
import {
  useApp,
  type Project,
  type WorkOrder,
  type VendorExpense,
  type CustomerInvoice,
  type ProjectMilestone,
  type ProjectMutation,
} from "../contexts/AppContext";
import { toast } from 'sonner';
import { BOQMaterialModal } from "../components/project/BOQMaterialModal";
import logoGTP from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

type ProjectTab = "overview" | "boq" | "work-order" | "field-records" | "vendor-biaya" | "invoice" | "peminjaman-alat";

import { TimelineTracker } from "../components/project/TimelineTracker";
import { MaterialUsageReportModal } from "../components/project/MaterialUsageReportModal";
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function ProjectManagementPage() {
  const {
    projectList,
    addProject,
    updateProject,
    deleteProject,
    workOrderList,
    qcInspectionList,
    updateWorkOrder,
    addWorkOrder,
    deleteWorkOrder,
    approveProject,
    employeeList,
    attendanceList,
    quotationList,
    poList,
    stockOutList,
    stockItemList,
    addStockOut,
    expenseList,
    addExpense,
    approveExpense,
    updateExpense,
    vendorList,
    customerInvoiceList,
    workingExpenseSheets,
    suratJalanList,
    updateSuratJalan,
    beritaAcaraList,
  } = useApp();
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectFinancials, setProjectFinancials] = useState<{
    projectId: string;
    financials: { actualSpent: number; boqBudget: number; contractValue: number; marginNominal: number; marginPercent: number; budgetUtilizationPercent: number };
  } | null>(null);
  const [financialError, setFinancialError] = useState('');
  const [financialReload, setFinancialReload] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectTab, setProjectTab] = useState<ProjectTab>("overview");
  const [statusFilter, setStatusFilter] = useState<"All" | "Planning" | "In Progress" | "Completed">("All");
  const [terminologyMode, setTerminologyMode] = useState<"RAB" | "SOW">("RAB");
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Vendor expense form state (hoisted for Rules of Hooks)
  const [showVendorExpenseForm, setShowVendorExpenseForm] = useState(false);
  const [vendorExpenseForm, setVendorExpenseForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    vendorId: '', vendorName: '',
    kategori: 'Material' as VendorExpense['kategori'],
    keterangan: '',
    nominal: 0,
    ppn: 0,
    metodeBayar: 'Transfer' as VendorExpense['metodeBayar'],
    bank: 'BCA',
    hasKwitansi: false,
    noKwitansi: '',
  });

  // Sub-modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddWorkOrderModal, setShowAddWorkOrderModal] = useState(false);
  const [expandedWO, setExpandedWO] = useState<string | null>(null);
  const [showAddUsageModal, setShowAddUsageModal] = useState(false);
  const [usageSearch, setUsageSearch] = useState('');
  const [usageForm, setUsageForm] = useState<{ kode: string; nama: string; satuan: string; hargaSatuan: number; qty: number; keterangan: string } | null>(null);

  const [biayaProyekList, setBiayaProyekList] = useState<{id: string; tanggal: string; keterangan: string; nominal: number; kategori: string; bonUrl?: string}[]>([]);
  const [biayaForm, setBiayaForm] = useState({ tanggal: new Date().toISOString().split('T')[0], keterangan: '', nominal: 0, kategori: 'Material', kategoriCustom: '', bonUrl: '' });
  const [showBiayaForm, setShowBiayaForm] = useState(false);

  const [expenseFormData, setExpenseFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    nominal: 0,
    category: "Operational",
    hasNota: true,
    kategoriCustom: "",
    bonUrl: ""
  });
  const expenseBonInputRef = useRef<HTMLInputElement | null>(null);
  const biayaBonInputRef = useRef<HTMLInputElement | null>(null);

  const [woFormData, setWoFormData] = useState({
    itemToProduce: "",
    targetQty: 1,
    leadTechnician: "",
    startDate: new Date().toISOString().split('T')[0],
    deadline: "",
    priority: "Normal" as any,
    jamMasuk: "08:00",
    jamKeluar: "17:00"
  });
  const [woTeknisiRows, setWoTeknisiRows] = useState([{ nama: "", keterangan: "", qty: 1 }]);

  const addWoTeknisiRow = () => setWoTeknisiRows(prev => [...prev, { nama: "", keterangan: "", qty: 1 }]);
  const updateWoTeknisiRow = (index: number, updates: Partial<{ nama: string; keterangan: string; qty: number }>) =>
    setWoTeknisiRows(prev => prev.map((row, i) => i === index ? { ...row, ...updates } : row));
  const removeWoTeknisiRow = (index: number) =>
    setWoTeknisiRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);

  // Sync selected project with global projectList
  useEffect(() => {
    if (selectedProject) {
      const updated = (projectList || []).find(p => p.id === selectedProject.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
        setSelectedProject(updated);
      }
    }
  }, [projectList, selectedProject]);

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


  // Handle navigation from Quotation page with location.state
  useEffect(() => {
    if (location.state && (location.state as any).fromQuotation) {
      const state = location.state as any;
      
      setFormData({
        namaProject: state.perihal || "",
        customer: state.customerName || "",
        nilaiKontrak: state.budget || 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        status: "Planning",
        location: state.customerAddress || "",
        projectManager: "",
        description: `Converted from Quotation ${state.quotationNumber}`,
        progress: 0,
        kategori: "Installation",
        tipePekerjaan: "New Installation",
        jenisKontrak: "Lump Sum",
        quotationId: state.quotationId || "",
      });
      
      // Auto-map BOQ materials from quotation
      const mappedMaterials: any[] = [];
      if (state.materials && Array.isArray(state.materials)) {
        state.materials.forEach((item: any) => {
          mappedMaterials.push({
            materialName: item.namaItem || item.materialName || "",
            itemKode: `MAT-${Math.floor(Math.random() * 900) + 100}`,
            qtyEstimate: item.qty || item.qtyEstimate || 1,
            qtyActual: 0,
            unit: item.unit || "Unit",
            unitPrice: item.unitPrice || 0,
            supplier: "",
            status: "Not Ordered",
            category: "From Quotation"
          });
        });
      }
      setProjectFormMaterials(mappedMaterials);
      
      setShowProjectModal(true);
      
      toast.success('✅ Quotation data loaded!', {
        description: `Auto-populated from ${state.quotationNumber}`
      });
      
      // Clear location state after processing
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
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

  const filteredProjects = projectList.filter(
    (item) =>
      (statusFilter === "All" || item.status === statusFilter) &&
      (
        (item.kodeProject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.namaProject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customer || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
  );

  const handleViewProjectDetail = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDetailModal(true);
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

  const handleSaveProject = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const validatedProgress = Math.min(100, Math.max(0, formData.progress || 0));
    const finalFormData = { ...formData, progress: validatedProgress };

    try {
      if (isEditMode && selectedProject) {
        const saved = await updateProject(selectedProject.id, {
          ...finalFormData,
          boq: projectFormMaterials,
        });
        if (!saved) return;
        toast.success("Project updated successfully");
      } else {
        const newProject: Project = {
          id: `prj-${Date.now()}`,
          kodeProject: `PRJ-${new Date().getFullYear()}-${String(projectList.length + 1).padStart(3, "0")}`,
          ...finalFormData,
          boq: projectFormMaterials,
          quotationId: formData.quotationId || undefined,
          approvalStatus: 'Pending'
        };
        const createdProject = await addProject(newProject);
        if (!createdProject) {
          toast.error("Project gagal disimpan ke server.");
          return;
        }
        toast.success("New project created successfully");
      }
      setShowProjectModal(false);
    } catch (err) {
      toast.error("Project gagal disimpan: " + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject(projectId);
      toast.success("Project deleted");
    }
  };

  const handleAddExpense = async () => {
    if (!selectedProject || isSubmitting) return;
    setIsSubmitting(true);
    const finalCategory = expenseFormData.category === 'Lain-lain' && expenseFormData.kategoriCustom
      ? expenseFormData.kategoriCustom
      : expenseFormData.category;
    const newExpense = {
      id: `EXP-${Date.now()}`,
      projectId: selectedProject.id,
      ...expenseFormData,
      category: finalCategory
    };

    try {
      const updatedExpenses = [...(selectedProject.workingExpenses || []), newExpense];
      const saved = await updateProject(selectedProject.id, { workingExpenses: updatedExpenses });
      if (!saved) return;
      setShowAddExpenseModal(false);
    setExpenseFormData({
      date: new Date().toISOString().split('T')[0],
      description: "",
      nominal: 0,
      category: "Operational",
      hasNota: true,
      kategoriCustom: "",
      bonUrl: ""
    });
      toast.success("Expense added to project ledger");
    } catch (err) {
      toast.error("Expense gagal ditambahkan: " + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWorkOrder = () => {
    if (!selectedProject || isSubmitting) return;
    if (!woFormData.itemToProduce.trim()) {
      toast.error("Isi nama pekerjaan Work Order");
      return;
    }
    setIsSubmitting(true);
    const ts = Date.now();
    const seq = String(workOrderList.filter(w => w.projectId === selectedProject.id).length + 1).padStart(3, '0');
    const teknisiRows = woTeknisiRows.filter(row => row.nama.trim());
    const newWO: any = {
      id: `WO-${ts}`,
      projectId: selectedProject.id,
      projectName: selectedProject.namaProject,
      status: 'Draft',
      completedQty: 0,
      bom: [],
      ...woFormData,
      woNumber: `WO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${seq}`,
      teknisiRows,
      teknisi: teknisiRows.map(row => row.nama),
      leadTechnician: teknisiRows[0]?.nama || woFormData.leadTechnician
    };

    try {
      addWorkOrder(newWO);
      toast.success("Work Order berhasil dibuat");
      setShowAddWorkOrderModal(false);
      setWoFormData({ itemToProduce: '', targetQty: 1, leadTechnician: '', startDate: new Date().toISOString().split('T')[0], deadline: '', priority: 'Normal' as any, jamMasuk: '08:00', jamKeluar: '17:00' });
      setWoTeknisiRows([{ nama: '', keterangan: '', qty: 1 }]);
    } catch (err) {
      toast.error("Work Order gagal dibuat: " + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUsage = () => {
    if (!selectedProject || !usageForm || usageForm.qty <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    const so = {
      id: `SO-FR-${Date.now()}`,
      noStockOut: `SO-FR-${Date.now()}`,
      projectId: selectedProject.id,
      penerima: selectedProject.name,
      tanggal: new Date().toISOString().split('T')[0],
      type: 'Project Issue' as const,
      status: 'Posted' as const,
      createdBy: 'Field Record',
      items: [{ kode: usageForm.kode, nama: usageForm.nama, satuan: usageForm.satuan, qty: usageForm.qty, hargaSatuan: usageForm.hargaSatuan, keterangan: usageForm.keterangan }],
    };
    try {
      addStockOut(so);
      setShowAddUsageModal(false);
      setUsageForm(null);
      setUsageSearch('');
      toast.success('Pemakaian barang berhasil dicatat');
    } catch (err) {
      toast.error('Pemakaian barang gagal dicatat: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!selectedProject || !showProjectDetailModal) return;
    let cancelled = false;
    setProjectFinancials(null);
    setFinancialError('');
    api.request<NonNullable<typeof projectFinancials>>(
      `/projects/${encodeURIComponent(selectedProject.id)}/financials`
    ).then(result => {
      if (!cancelled) setProjectFinancials(result);
    }).catch(error => {
      if (!cancelled) setFinancialError(error instanceof Error ? error.message : 'Gagal memuat biaya aktual');
    });
    return () => { cancelled = true; };
  }, [selectedProject, showProjectDetailModal, expenseList, stockOutList, attendanceList, employeeList, financialReload]);

  const handleExportReport = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Generating PDF Executive Report...',
        success: 'Report downloaded successfully',
        error: 'Failed to generate report',
      }
    );
  };

  useEscapeKey([
    { condition: showProjectModal, close: () => setShowProjectModal(false) },
    { condition: showProjectDetailModal, close: () => setShowProjectDetailModal(false) },
    { condition: showAddExpenseModal, close: () => setShowAddExpenseModal(false) },
    { condition: showAddWorkOrderModal, close: () => setShowAddWorkOrderModal(false) },
    { condition: showAddUsageModal, close: () => setShowAddUsageModal(false) },
    { condition: showBiayaForm, close: () => setShowBiayaForm(false) },
  ]);

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


      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900 italic tracking-tighter">{projectList.filter(p => p.status !== 'Completed').length}</span>
              <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase italic">In Execution</span>
            </div>
          </div>
          <div className="bg-emerald-500 p-6 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-2">Total Value</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black italic tracking-tighter">
                {formatCurrency(projectList.reduce((sum, p) => sum + p.nilaiKontrak, 0))}
              </span>
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-2">Efficiency</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black italic tracking-tighter">{workOrderList.length > 0 ? `${Math.round(workOrderList.filter(wo => wo.status === 'Completed').length / workOrderList.length * 100)}%` : '0%'}</span>
              <span className="text-[10px] font-bold text-white/40 mb-2 uppercase italic">WO selesai</span>
            </div>
          </div>
        </div>

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
          {(["All", "Planning", "In Progress", "Completed"] as const).map((filter) => (
             <button 
               key={filter}
               onClick={() => setStatusFilter(filter)}
               className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all ${
                 statusFilter === filter ? "bg-slate-900 text-white" : "text-slate-400"
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
                  <span
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getProjectStatusColor(project.status)}`}
                  >
                    {project.status}
                  </span>
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
                     className="p-3 bg-white text-slate-900 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
               <button onClick={handleSaveProject} disabled={isSubmitting} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Save Project'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Project Detail Modal */}
      {showProjectDetailModal && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[60] p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-[3rem] w-full max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-4 sm:p-8 md:p-10 border-b border-slate-100 bg-white">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start">
                <div className="flex-1 min-w-0 pr-0 sm:pr-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">{selectedProject.kodeProject}</span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getProjectStatusColor(selectedProject.status)}`}>
                      {selectedProject.status}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight break-words">{selectedProject.namaProject}</h2>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3">
                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                      <Building2 size={15} className="text-slate-400 shrink-0" />
                      <span className="font-bold uppercase tracking-widest text-[10px] truncate">{selectedProject.customer}</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600">
                      <Receipt size={15} className="shrink-0" />
                      <span className="font-black italic text-sm sm:text-lg tracking-tighter">{formatCurrency(selectedProject.nilaiKontrak)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 self-start">
                  <button
                    onClick={handleExportReport}
                    className="p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl transition-all group"
                    title="Export Executive Report"
                  >
                    <Download size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <button
                    onClick={() => setShowProjectDetailModal(false)}
                    className="p-2.5 sm:p-3 bg-slate-100 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-100 px-3 sm:px-6 md:px-10 bg-white overflow-x-auto scrollbar-none">
              {(["overview", "boq", "work-order", "field-records", "vendor-biaya", "invoice", "peminjaman-alat"] as ProjectTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProjectTab(tab)}
                  className={`px-3 sm:px-5 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all whitespace-nowrap ${
                    projectTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
                  }`}
                >
                  {tab === "vendor-biaya" ? "Realisasi & Tambahan Biaya"
                    : tab === "invoice" ? "Invoice"
                    : tab === "field-records" ? "Field"
                    : tab === "work-order" ? "Work Order"
                    : tab === "peminjaman-alat" ? "Peminjaman Alat"
                    : tab === "boq" ? "RAB / BOQ"
                    : tab.replace("-", " ")}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 bg-slate-50/50">
              {projectTab === "overview" && (() => {
                if (!projectFinancials || projectFinancials.projectId !== selectedProject.id) {
                  return <div role="status" className="p-6 text-sm text-slate-600">
                    {financialError || 'Memuat perhitungan project dari database…'}
                    {financialError && <button className="ml-3 underline" onClick={() => setFinancialReload(value => value + 1)}>Coba lagi</button>}
                  </div>;
                }
                const financials = projectFinancials.financials;
                const spent = financials.actualSpent;
                const hppBudget = financials.boqBudget;
                const hppVariance = hppBudget - spent;
                const plannedProfit = selectedProject.nilaiKontrak - hppBudget;
                const plannedMargin = selectedProject.nilaiKontrak > 0 ? (plannedProfit / selectedProject.nilaiKontrak) * 100 : 0;
                const actualProfit = financials.marginNominal;
                const actualMargin = financials.marginPercent;
                const projectInvoices = customerInvoiceList.filter((inv: CustomerInvoice) => inv.projectId === selectedProject.id);
                const totalBilled = projectInvoices.reduce((sum: number, inv: CustomerInvoice) => sum + (inv.totalNominal || 0), 0);
                const totalReceived = projectInvoices.reduce((sum: number, inv: CustomerInvoice) => sum + (inv.paidAmount || 0), 0);
                const totalReceivable = Math.max(0, totalBilled - totalReceived);
                const budgetUsage = financials.budgetUtilizationPercent;
                const budgetStatus = hppVariance < 0 ? 'Overbudget' : budgetUsage >= 85 ? 'Mendekati Anggaran' : 'Aman';
                const milestonesDone = (selectedProject.milestones || []).filter(m => m.status === 'Selesai').length;
                const milestonesTotal = (selectedProject.milestones || []).length;

                // Progress Overview hanya berasal dari WO yang telah masuk eksekusi.
                // Draft tidak boleh mengubah progress maupun target proyek.
                const projectWOs = workOrderList.filter(wo => wo.projectId === selectedProject.id && wo.status !== 'Draft');
                const totalTarget = projectWOs.reduce((sum, wo) => sum + (wo.targetQty || 0), 0);
                const totalCompleted = projectWOs.reduce((sum, wo) => sum + (wo.completedQty || 0), 0);
                const woDone = projectWOs.filter(wo => ['Selesai', 'Done', 'Complete', 'Completed'].includes(wo.status)).length;

                const liveProgress = totalTarget > 0
                  ? Math.round((totalCompleted / totalTarget) * 100)
                  : projectWOs.length > 0
                    ? Math.round((woDone / projectWOs.length) * 100)
                    : (selectedProject.progress || 0);

                const progressLabel = projectWOs.length > 0 ? `${woDone}/${projectWOs.length} WO selesai` : null;
                const projectSuratJalans = suratJalanList.filter(sj =>
                  sj.projectId === selectedProject.id
                );
                const pendingDeliveries = projectSuratJalans.filter(sj => sj.deliveryStatus !== 'Delivered');
                const hasPendingDelivery = pendingDeliveries.length > 0;
                const projectBast = (beritaAcaraList || []).filter((ba: any) =>
                  ba.projectId === selectedProject.id || ba.refProject === selectedProject.id || projectSuratJalans.some(sj => ba.refSuratJalan === sj.id || ba.refSuratJalan === sj.noSurat)
                );
                const hasBast = projectBast.some((ba: any) =>
                  ['Penerimaan Pekerjaan', 'Penyelesaian Pekerjaan', 'Serah Terima Barang', 'Serah Terima'].includes(ba.jenisBA || ba.jenis) &&
                  ba.status === 'Approved'
                );
                // A newly converted project with no WO is still Planning, not
                // ready to close. Completion requires at least one finished WO.
                const productionComplete = projectWOs.length > 0 && !workOrderList.some(wo => wo.projectId === selectedProject.id && wo.status === 'Draft') && (
                  projectWOs.every(wo => ['Completed', 'Selesai', 'Done', 'Complete'].includes(wo.status)) &&
                  projectWOs.every(wo => (wo.targetQty || 0) <= 0 || (wo.completedQty || 0) >= (wo.targetQty || 0))
                );
                // Jika WO memiliki inspeksi QC, seluruh inspeksi terkait wajib Passed
                // sebelum project boleh ditutup. WO tanpa QC tetap mengikuti alur jasa.
                const projectQC = (qcInspectionList || []).filter(qc =>
                  qc.projectId === selectedProject.id || projectWOs.some(wo => wo.id === qc.workOrderId)
                );
                const qcComplete = projectQC.length === 0 || projectQC.every(qc => qc.status === 'Passed');
                const bastRequired = projectSuratJalans.length > 0 || projectWOs.length > 0;
                const canCompleteProject = productionComplete && qcComplete && !hasPendingDelivery && (!bastRequired || hasBast);

                return (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    {/* Project Financial Summary */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Project Financial Summary</h3>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">Perbandingan rencana, realisasi aktual, dan penagihan proyek</p>
                        </div>
                        <span className={`self-start px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                          budgetStatus === 'Overbudget' ? 'bg-red-100 text-red-700'
                            : budgetStatus === 'Mendekati Anggaran' ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {budgetStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                        <div className="p-5">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-4">Rencana / Budget</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              ['Nilai Kontrak', selectedProject.nilaiKontrak, 'text-slate-900'],
                              ['HPP Rencana', hppBudget, 'text-amber-600'],
                              ['Laba Rencana', plannedProfit, plannedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'],
                            ].map(([label, value, color]) => (
                              <div key={String(label)} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                                <p className={`text-sm font-black mt-1 ${color}`}>{formatCurrency(Number(value))}</p>
                              </div>
                            ))}
                            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                              <p className="text-[8px] font-black uppercase tracking-widest text-blue-400">Margin Rencana</p>
                              <p className="text-sm font-black text-blue-700 mt-1">{plannedMargin.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-5">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-4">Realisasi / Aktual</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Biaya Aktual</p>
                              <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(spent)}</p>
                              <p className="text-[8px] text-slate-400 mt-1">{budgetUsage.toFixed(1)}% dari HPP</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${hppVariance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                              <p className={`text-[8px] font-black uppercase tracking-widest ${hppVariance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                {hppVariance >= 0 ? 'Sisa Anggaran' : 'Overbudget'}
                              </p>
                              <p className={`text-sm font-black mt-1 ${hppVariance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(Math.abs(hppVariance))}</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${actualProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                              <p className={`text-[8px] font-black uppercase tracking-widest ${actualProfit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>Laba Berjalan</p>
                              <p className={`text-sm font-black mt-1 ${actualProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(actualProfit)}</p>
                            </div>
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                              <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Margin Aktual</p>
                              <p className="text-sm font-black text-emerald-700 mt-1">{actualMargin.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 p-5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-500 mb-3">Penagihan</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            ['Sudah Ditagihkan', totalBilled, 'text-slate-900'],
                            ['Sudah Dibayar', totalReceived, 'text-emerald-600'],
                            ['Piutang', totalReceivable, 'text-red-600'],
                          ].map(([label, value, color]) => (
                            <div key={String(label)} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                              <p className={`text-sm font-black mt-1 ${color}`}>{formatCurrency(Number(value))}</p>
                            </div>
                          ))}
                          <div className="rounded-xl bg-slate-900 p-3">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Progress</p>
                            <p className="text-sm font-black text-white mt-1">{liveProgress}%</p>
                            {progressLabel && <p className="text-[8px] text-slate-400 mt-1">{progressLabel}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline — desktop shows side layout, mobile stacks */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 border-b pb-3">Execution Roadmap</h3>
                        <div className="overflow-x-auto">
                          <TimelineTracker
                            project={selectedProject}
                            workOrders={workOrderList.filter(wo => wo.projectId === selectedProject.id)}
                          />
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b pb-3">Info Proyek</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedProject.customer}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kode Proyek</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedProject.kodeProject || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deadline</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedProject.endDate || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getProjectStatusColor(selectedProject.status)}`}>
                              {selectedProject.status}
                            </span>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approval</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                              {selectedProject.approvalStatus || (selectedProject.quotationId && quotationList.find(q => q.id === selectedProject.quotationId)?.status === 'Approved' ? 'Approved' : 'Pending')}
                            </p>
                          </div>
                          <div className={`rounded-xl border p-3 ${hasPendingDelivery ? 'bg-amber-50 border-amber-200' : projectSuratJalans.length ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pengiriman</p>
                            {projectSuratJalans.length === 0 ? (
                              <p className="text-xs font-bold text-slate-500 mt-1">Tidak ada Surat Jalan</p>
                            ) : (
                              <>
                                <p className={`text-xs font-black mt-1 ${hasPendingDelivery ? 'text-amber-700' : 'text-emerald-700'}`}>
                                  {hasPendingDelivery ? `${pendingDeliveries.length} SJ belum sampai` : 'Semua barang sudah sampai'}
                                </p>
                                {hasPendingDelivery && (
                                  <button
                                    onClick={() => pendingDeliveries.forEach(sj => updateSuratJalan(sj.id, { deliveryStatus: 'Delivered', deliveredAt: new Date().toISOString() }))}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700"
                                  >
                                    <Truck size={11} /> Barang Sudah Sampai
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <div className={`rounded-xl border p-3 ${hasBast ? 'bg-emerald-50 border-emerald-200' : bastRequired ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BAST</p>
                            <p className={`text-xs font-black mt-1 ${hasBast ? 'text-emerald-700' : bastRequired ? 'text-amber-700' : 'text-slate-500'}`}>
                              {hasBast ? `${projectBast.length} dokumen terhubung` : bastRequired ? 'Wajib dibuat sebelum project ditutup' : 'Belum diperlukan'}
                            </p>
                          </div>
                          <div className={`rounded-xl border p-3 ${canCompleteProject ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kesiapan Project</p>
                            <p className={`text-xs font-black mt-1 ${canCompleteProject ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {canCompleteProject ? 'Siap ditutup' : 'WO/QC atau pengiriman belum selesai'}
                            </p>
                            {canCompleteProject && selectedProject.status !== 'Completed' && (
                              <button
                                disabled={isSubmitting}
                                onClick={async () => {
                                  if (!window.confirm(`Tutup project ${selectedProject.kodeProject || selectedProject.namaProject}? Status akan menjadi Completed dan progress 100%.`)) return;
                                  setIsSubmitting(true);
                                  try {
                                    const saved = await updateProject(selectedProject.id, { status: 'Completed', progress: 100 });
                                    if (!saved) return;
                                    toast.success('Project ditutup (Completed).');
                                  } catch (err) {
                                    toast.error('Gagal menutup project: ' + (err instanceof Error ? err.message : 'Error'));
                                  } finally {
                                    setIsSubmitting(false);
                                  }
                                }}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <CheckCircle2 size={11} /> Tutup Project
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}


              {projectTab === "work-order" && (() => {
                // Read directly from workOrderList — this is the workshop execution list
                const projectWOs = workOrderList.filter(wo => wo.projectId === selectedProject.id);
                const woWorkshop = projectWOs.filter(wo => !['QC', 'Completed', 'Selesai', 'Done'].includes(wo.status));
                const woQC       = projectWOs.filter(wo => wo.status === 'QC');
                const woSelesai  = projectWOs.filter(wo => ['Completed', 'Selesai', 'Done'].includes(wo.status));

                const getWOStatusStyle = (status: string) => {
                  if (['Completed', 'Selesai', 'Done'].includes(status))
                    return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Selesai' };
                  if (status === 'QC')
                    return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'QC' };
                  if (status === 'In Progress')
                    return { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Workshop' };
                  return { dot: 'bg-slate-300', badge: 'bg-slate-50 text-slate-500 border-slate-200', label: status || 'Draft' };
                };

                return (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase italic">Work Order Project</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">WO dibuat langsung untuk project ini dan tidak memerlukan SPK.</p>
                      </div>
                      <button
                        onClick={() => setShowAddWorkOrderModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        <Plus size={14} /> Buat Work Order
                      </button>
                    </div>

                    {/* Pipeline stats — Workshop → QC → Selesai */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Workshop', val: woWorkshop.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', dot: 'bg-blue-500' },
                        { label: 'QC', val: woQC.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
                        { label: 'Selesai', val: woSelesai.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
                      ].map((s, i) => (
                        <div key={i} className={`${s.bg} border rounded-2xl p-3 sm:p-4 relative overflow-hidden`}>
                          <div className={`absolute top-2 right-3 w-2 h-2 rounded-full ${s.dot}`} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
                          <p className={`text-2xl font-black italic mt-0.5 ${s.color}`}>{s.val}</p>
                          <p className="text-[9px] text-slate-400 font-bold">work order</p>
                        </div>
                      ))}
                    </div>

                    {/* WO table */}
                    {projectWOs.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-100 py-14 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Wrench size={20} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase italic">Belum ada Work Order</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-1.5">Klik Buat Work Order untuk menambahkan pekerjaan ke project ini.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left min-w-[560px]">
                            <thead>
                              <tr className="bg-slate-50/60 border-b border-slate-100">
                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">No. WO</th>
                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pekerjaan</th>
                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Teknisi</th>
                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {projectWOs.map((wo) => {
                                const progress = wo.targetQty > 0 ? Math.round(((wo.completedQty || 0) / wo.targetQty) * 100) : 0;
                                const style = getWOStatusStyle(wo.status);
                                return (
                                  <tr key={wo.id} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                        <div>
                                          <p className="text-xs font-black text-slate-900 italic tracking-tighter">{wo.woNumber}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">{wo.itemToProduce}</p>
                                      {wo.deadline && <p className="text-[9px] text-slate-400 font-bold mt-0.5">DL: {wo.deadline}</p>}
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="flex -space-x-1.5">
                                        {(wo.teknisi || (wo.leadTechnician ? [wo.leadTechnician] : [])).slice(0, 4).map((t: string, idx: number) => (
                                          <div key={idx} title={t}
                                            className="w-7 h-7 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center text-[9px] font-black text-white">
                                            {t.charAt(0).toUpperCase()}
                                          </div>
                                        ))}
                                        {(wo.teknisi || []).length === 0 && !wo.leadTechnician && (
                                          <span className="text-[9px] text-slate-300 font-bold italic">—</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="w-28">
                                        <div className="flex justify-between mb-1">
                                          <span className="text-[9px] font-black text-slate-500">{wo.completedQty || 0}/{wo.targetQty}</span>
                                          <span className="text-[9px] font-bold text-slate-400">{progress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${style.dot}`}
                                            style={{ width: `${Math.min(100, progress)}%` }} />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                      <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border ${style.badge}`}>
                                        {style.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {projectTab === "field-records" && (
                <div className="animate-in fade-in duration-500 space-y-6">

                  {/* Inline form catat pemakaian */}
                  <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2 mb-6">
                      <Plus size={18} className="text-blue-600" /> Catat Pemakaian Barang
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {/* Search BOQ */}
                      <div className="md:col-span-2 relative">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Pilih Item dari BOQ Proyek</label>
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                          <input
                            type="text"
                            value={usageSearch}
                            onChange={e => { setUsageSearch(e.target.value); setUsageForm(null); }}
                            placeholder="Ketik nama atau kode item BOQ..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          {usageSearch && !usageForm && (() => {
                            const boqItems = (selectedProject?.boq || []).filter((b: any) =>
                              b.materialName?.toLowerCase().includes(usageSearch.toLowerCase()) ||
                              b.itemKode?.toLowerCase().includes(usageSearch.toLowerCase())
                            ).slice(0, 8);
                            return boqItems.length > 0 ? (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                {boqItems.map((item: any, i: number) => {
                                  const kodeKey = item.itemKode || item.materialName;
                                  const terpakaiQty = stockOutList
                                    .filter((so: any) => so.projectId === selectedProject?.id)
                                    .flatMap((so: any) => so.items || [])
                                    .filter((si: any) => (si.kode || si.nama) === kodeKey)
                                    .reduce((sum: number, si: any) => sum + (si.qty || 0), 0);
                                  const sisa = (item.qtyEstimate || 0) - terpakaiQty;
                                  return (
                                    <div key={i}
                                      onClick={() => { setUsageForm({ kode: kodeKey, nama: item.materialName, satuan: item.unit, hargaSatuan: item.unitPrice || 0, qty: 1, keterangan: '' }); setUsageSearch(item.materialName); }}
                                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0">
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <p className="text-[10px] font-mono font-bold text-blue-700">{item.itemKode || '-'}</p>
                                          <p className="text-sm font-bold text-neutral-900">{item.materialName}</p>
                                          {item.category && <p className="text-[9px] text-neutral-500 uppercase font-bold">{item.category}</p>}
                                        </div>
                                        <div className="text-right shrink-0 ml-4 space-y-0.5">
                                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold block">BOQ: {item.qtyEstimate} {item.unit}</span>
                                          <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-bold block">Terpakai: {terpakaiQty} {item.unit}</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold block ${sisa <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>Sisa: {sisa} {item.unit}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow px-4 py-3 text-[10px] text-slate-400 font-bold uppercase">
                                Item tidak ditemukan di BOQ
                              </div>
                            );
                          })()}
                        </div>
                        {usageForm && (
                          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-mono font-bold text-blue-600">{usageForm.kode}</p>
                              <p className="text-xs font-black text-slate-900">{usageForm.nama}</p>
                            </div>
                            <span className="text-[10px] text-blue-500 font-bold">{usageForm.satuan}</span>
                          </div>
                        )}
                      </div>

                      {/* Qty + Keterangan + submit */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Jumlah Dipakai</label>
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={usageForm?.qty ?? ''}
                            onChange={e => usageForm && setUsageForm({ ...usageForm, qty: parseFloat(e.target.value) || 0 })}
                            disabled={!usageForm}
                            placeholder="0"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Keterangan</label>
                          <input
                            type="text"
                            value={usageForm?.keterangan ?? ''}
                            onChange={e => usageForm && setUsageForm({ ...usageForm, keterangan: e.target.value })}
                            disabled={!usageForm}
                            placeholder="Opsional, misal: untuk area barat..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-300"
                          />
                        </div>
                        <button
                          onClick={handleAddUsage}
                          disabled={isSubmitting || !usageForm || (usageForm?.qty ?? 0) <= 0}
                          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabel usage report */}
                  <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                          <Package size={18} className="text-blue-600" /> Material Usage Report
                        </h3>
                        <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">Barang yang sudah dikeluarkan dari gudang untuk proyek ini</p>
                      </div>
                    </div>

                    {(() => {
                      const projectStockOuts = stockOutList.filter(so => so.projectId === selectedProject.id);
                      // flatten all items, merge by kode
                      const usageMap: Record<string, { kode: string; nama: string; unit: string; qty: number; totalValue: number; dates: string[] }> = {};
                      projectStockOuts.forEach(so => {
                        (so.items || []).forEach((item: any) => {
                          const key = item.kode || item.nama;
                          const master = stockItemList.find((s: any) => s.kode === item.kode);
                          const harga = master?.hargaSatuan || item.hargaSatuan || 0;
                          if (!usageMap[key]) {
                            usageMap[key] = { kode: item.kode || '-', nama: item.nama || item.kode, unit: item.satuan || master?.satuan || '-', qty: 0, totalValue: 0, dates: [], keterangan: item.keterangan || '' };
                          }
                          usageMap[key].qty += item.qty || 0;
                          usageMap[key].totalValue += (item.qty || 0) * harga;
                          if (so.tanggal && !usageMap[key].dates.includes(so.tanggal)) usageMap[key].dates.push(so.tanggal);
                        });
                      });
                      const rows = Object.values(usageMap);
                      if (rows.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                            <Package size={40} strokeWidth={1} />
                            <p className="text-sm font-bold uppercase tracking-widest mt-4">Belum ada pemakaian barang</p>
                          </div>
                        );
                      }
                      const grandTotal = rows.reduce((s, r) => s + r.totalValue, 0);
                      return (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-slate-50 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200">
                                  <th className="p-4">Item Code</th>
                                  <th className="p-4">Nama Material</th>
                                  <th className="p-4 text-center">Satuan</th>
                                  <th className="p-4 text-center">Total Qty Pakai</th>
                                  <th className="p-4">Keterangan</th>
                                  <th className="p-4">Tanggal Terakhir</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {rows.map((r, i) => (
                                  <tr key={i} className="text-xs font-bold hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 text-slate-400 font-mono text-[10px]">{r.kode}</td>
                                    <td className="p-4 uppercase text-slate-900">{r.nama}</td>
                                    <td className="p-4 text-center text-slate-500">{r.unit}</td>
                                    <td className="p-4 text-center">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700">{r.qty}</span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-[10px] italic">{r.keterangan || '-'}</td>
                                    <td className="p-4 text-slate-400 text-[10px]">{r.dates.slice(-1)[0] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}


              {projectTab === "boq" && (
                <div className="animate-in fade-in duration-500">
                   <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                            <Package size={18} className="text-blue-600" /> RAB / BOQ (Budget HPP Proyek)
                            {selectedProject.quotationId && (
                              <span className="ml-2 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                                🔒 Locked — dari Quotation
                              </span>
                            )}
                         </h3>
                         <div className="flex gap-2">
                            <button className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest">
                               Export RAB / BOQ
                            </button>
                         </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <th className="p-4">Item Code</th>
                              <th className="p-4">Description</th>
                              <th className="p-4 text-center">Unit</th>
                              <th className="p-4 text-center">Budget Qty</th>
                              <th className="p-4 text-right">Unit Price</th>
                              <th className="p-4 text-right">Total Budget</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const boqItems = selectedProject.boq || [];
                              // group by category
                              const grouped: Record<string, typeof boqItems> = {};
                              boqItems.forEach(item => {
                                // BOQ dari quotation lama memakai sourceCategory,
                                // sedangkan data baru memakai category. Prioritaskan
                                // kategori section quotation agar grouping tetap utuh.
                                const cat = item.category || (item as any).sourceCategory || (item as any).kategori || 'Lainnya';
                                if (!grouped[cat]) grouped[cat] = [];
                                grouped[cat].push(item);
                              });
                              return Object.entries(grouped).map(([cat, items]) => {
                                const catTotal = items.reduce((s, it) => s + (it.qtyEstimate * it.unitPrice), 0);
                                return (
                                  <React.Fragment key={`group-${cat}`}>
                                    <tr className="bg-blue-50/60">
                                      <td colSpan={4} className="px-4 py-2.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">{cat}</span>
                                        <span className="ml-2 text-[9px] text-blue-400 font-bold">{items.length} item</span>
                                      </td>
                                      <td colSpan={2} className="px-4 py-2.5 text-right text-[9px] font-black text-blue-700">
                                        {formatCurrency(catTotal)}
                                      </td>
                                    </tr>
                                    {items.map((item, i) => (
                                      <tr key={`${cat}-${i}`} className="text-xs font-bold hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-slate-400 font-mono text-[10px]">{item.itemKode || '-'}</td>
                                        <td className="p-4 uppercase text-slate-900">{item.materialName}</td>
                                        <td className="p-4 text-center text-slate-500">{item.unit}</td>
                                        <td className="p-4 text-center text-slate-900 font-black">{item.qtyEstimate}</td>
                                        <td className="p-4 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                                        <td className="p-4 text-right font-black text-blue-600">{formatCurrency(item.qtyEstimate * item.unitPrice)}</td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                   </div>
                </div>
              )}

              {projectTab === "vendor-biaya" && (() => {
                const projectExpenses = (expenseList || []).filter((e: VendorExpense) => e.projectId === selectedProject.id);
                const totalPaid    = projectExpenses.filter(e => e.status === 'Paid').reduce((s, e) => s + e.totalNominal, 0);
                const totalApproved= projectExpenses.filter(e => e.status === 'Approved').reduce((s, e) => s + e.totalNominal, 0);
                const totalPending = projectExpenses.filter(e => e.status === 'Pending Approval' || e.status === 'Draft').reduce((s, e) => s + e.totalNominal, 0);
                // RAB/BOQ is the source of truth for project categories. Seed the
                // recap from BOQ so a category is visible even before it has costs.
                const boqCategories = Array.from(new Set((selectedProject.boq || []).map((item: any) =>
                  String(item.category || item.sourceCategory || item.kategori || '').trim()
                ).filter(Boolean)));
                const categoryKey = (value: string) => {
                  const normalized = value.toLowerCase().replace(/[\s_-]+/g, ' ');
                  if (['jasa', 'service', 'manpower', 'tenaga kerja', 'jasa/manpower'].includes(normalized)) return 'jasa';
                  return normalized;
                };
                const categoryByKey = new Map(boqCategories.map(category => [categoryKey(category), category]));
                const expenseByCategory = boqCategories.reduce((acc, category) => {
                  acc[category] = { transactions: 0, pending: 0, actual: 0 };
                  return acc;
                }, {} as Record<string, { transactions: number; pending: number; actual: number }>);
                projectExpenses.reduce((acc, expense) => {
                  const rawCategory = String(expense.kategori || 'Biaya Lain').trim();
                  const category = categoryByKey.get(categoryKey(rawCategory)) || rawCategory;
                  if (!acc[category]) acc[category] = { transactions: 0, pending: 0, actual: 0 };
                  acc[category].transactions += 1;
                  if (expense.status === 'Draft' || expense.status === 'Pending Approval') {
                    acc[category].pending += expense.totalNominal || 0;
                  }
                  if (expense.status === 'Approved' || expense.status === 'Paid') {
                    acc[category].actual += expense.totalNominal || 0;
                  }
                  return acc;
                }, expenseByCategory);
                const fmtS = (n: number) => n >= 1_000_000 ? `Rp ${(n/1_000_000).toFixed(1)}jt` : `Rp ${n.toLocaleString('id-ID')}`;
                const BANKS = ['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN','Cash'];
                const KATEGORI: VendorExpense['kategori'][] = ['Material','Equipment','Service','Transport','Manpower','Tools','Consumables','Other'];
                const statusStyle: Record<string, string> = {
                  'Draft': 'bg-slate-100 text-slate-500',
                  'Pending Approval': 'bg-amber-100 text-amber-700',
                  'Approved': 'bg-blue-100 text-blue-700',
                  'Paid': 'bg-emerald-100 text-emerald-700',
                  'Rejected': 'bg-red-100 text-red-600',
                };

                const handleSaveExpense = () => {
                  if (!vendorExpenseForm.vendorName || !vendorExpenseForm.keterangan || vendorExpenseForm.nominal <= 0) {
                    toast.error('Vendor, keterangan, dan nominal wajib diisi'); return;
                  }
                  const ppn = vendorExpenseForm.ppn || 0;
                  const totalNominal = vendorExpenseForm.nominal + ppn;
                  const now = new Date().toISOString();
                  addExpense({
                    id: `EXP-${Date.now()}`,
                    noExpense: `EXP-${Date.now().toString().slice(-6)}`,
                    tanggal: vendorExpenseForm.tanggal,
                    vendorId: vendorExpenseForm.vendorId,
                    vendorName: vendorExpenseForm.vendorName,
                    projectId: selectedProject.id,
                    projectName: selectedProject.namaProject,
                    kategori: vendorExpenseForm.kategori,
                    keterangan: vendorExpenseForm.keterangan,
                    nominal: vendorExpenseForm.nominal,
                    ppn,
                    totalNominal,
                    hasKwitansi: vendorExpenseForm.hasKwitansi,
                    noKwitansi: vendorExpenseForm.noKwitansi,
                    metodeBayar: vendorExpenseForm.metodeBayar,
                    bank: vendorExpenseForm.bank,
                    status: 'Pending Approval',
                    createdBy: currentUser?.fullName || 'User',
                    createdAt: now,
                  });
                  setVendorExpenseForm({ tanggal: new Date().toISOString().split('T')[0], vendorId: '', vendorName: '', kategori: 'Material', keterangan: '', nominal: 0, ppn: 0, metodeBayar: 'Transfer', bank: 'BCA', hasKwitansi: false, noKwitansi: '' });
                  setShowVendorExpenseForm(false);
                  toast.success('Expense ditambahkan — menunggu approval');
                };

                return (
                  <div className="animate-in fade-in duration-500 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-800">Realisasi & Tambahan Biaya Proyek</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Biaya aktual proyek dari Finance, termasuk biaya pada pos RAB maupun biaya di luar RAB</p>
                      </div>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Transaksi</p>
                        <p className="text-lg font-black text-slate-900">{projectExpenses.length}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Pending</p>
                        <p className="text-base font-black text-amber-700">{fmtS(totalPending)}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Approved</p>
                        <p className="text-base font-black text-blue-700">{fmtS(totalApproved)}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Sudah Dibayar</p>
                        <p className="text-base font-black text-emerald-700">{fmtS(totalPaid)}</p>
                      </div>
                    </div>

                    {/* Category recap follows the RAB/BOQ sections. */}
                    {Object.keys(expenseByCategory).length > 0 && (
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Realisasi per Kategori</h4>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">Kategori mengikuti section RAB/BOQ; biaya di luar RAB masuk Biaya Lain</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left min-w-[520px]">
                            <thead>
                              <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-4 py-3">Kategori</th>
                                <th className="px-4 py-3 text-center">Transaksi</th>
                                <th className="px-4 py-3 text-right">Pending</th>
                                <th className="px-4 py-3 text-right">Aktual</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {Object.entries(expenseByCategory)
                                .map(([category, values]) => (
                                  <tr key={category} className="text-xs font-bold hover:bg-slate-50/50">
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase">{category}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500">{values.transactions}</td>
                                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(values.pending)}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700 font-black">{formatCurrency(values.actual)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Read-only expense list */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      {projectExpenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                          <Store size={40} className="mb-3 opacity-30" />
                          <p className="text-xs font-black uppercase tracking-widest">Belum ada realisasi atau tambahan biaya</p>
                          <p className="text-[10px] mt-1">Tambah data melalui menu Realisasi & Tambahan Biaya Proyek di Finance</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left" style={{ minWidth: '650px' }}>
                            <thead>
                              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Vendor</th>
                                <th className="px-4 py-3">Kategori</th>
                                <th className="px-4 py-3">Keterangan</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Bon / Kwitansi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {projectExpenses.map((e: VendorExpense) => (
                                <tr key={e.id} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="px-4 py-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">{e.tanggal}</td>
                                  <td className="px-4 py-3 text-xs font-black text-slate-800">{e.vendorName}</td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase">{e.kategori}</span>
                                    {e.rabItemName && <p className="text-[9px] text-slate-400 font-bold mt-1">Pos: {e.rabItemName}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-[11px] font-bold text-slate-600 max-w-[180px]">
                                    <p className="truncate">{e.keterangan}</p>
                                    {e.bank && <p className="text-[9px] text-slate-400">{e.bank}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-right font-black text-slate-800 whitespace-nowrap text-xs">
                                    Rp {e.totalNominal.toLocaleString("id-ID")}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${statusStyle[e.status] || "bg-slate-100 text-slate-500"}`}>
                                      {e.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {e.kwitansiUrl ? (
                                      <button
                                        type="button"
                                        onClick={() => window.open(e.kwitansiUrl, "_blank")}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[9px] font-black uppercase transition-colors"
                                        title={e.noKwitansi || "Lihat bon / kwitansi"}
                                      >
                                        <Receipt size={12} /> Lihat
                                      </button>
                                    ) : e.hasKwitansi ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600">
                                          <Receipt size={12} /> Ada
                                        </span>
                                        {e.noKwitansi && <p className="mt-1 text-[8px] font-bold text-slate-400">{e.noKwitansi}</p>}
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-bold text-slate-300">Tidak ada</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                              <tr>
                                <td colSpan={4} className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Total {projectExpenses.length} transaksi
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-900 text-xs whitespace-nowrap">
                                  Rp {projectExpenses.reduce((s, e) => s + e.totalNominal, 0).toLocaleString("id-ID")}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {projectTab === "invoice" && (() => {
                const projectInvoices = customerInvoiceList.filter((inv: CustomerInvoice) => inv.projectId === selectedProject.id);
                const totalTagihan = projectInvoices.reduce((sum: number, inv: CustomerInvoice) => sum + (inv.totalNominal || 0), 0);
                const totalPaid = projectInvoices.reduce((sum: number, inv: CustomerInvoice) => sum + (inv.paidAmount || 0), 0);
                const totalOutstanding = totalTagihan - totalPaid;
                const formatCurrencyShort = (n: number) => n >= 1_000_000 ? `Rp ${(n/1_000_000).toFixed(1)}jt` : `Rp ${n.toLocaleString('id-ID')}`;
                return (
                  <div className="animate-in fade-in duration-500 space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Tagihan</p>
                        <p className="text-lg font-black text-slate-900">{formatCurrencyShort(totalTagihan)}</p>
                        <p className="text-[9px] text-slate-400 mt-1">{projectInvoices.length} invoice</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Sudah Dibayar</p>
                        <p className="text-lg font-black text-emerald-700">{formatCurrencyShort(totalPaid)}</p>
                        <p className="text-[9px] text-emerald-400 mt-1">{projectInvoices.filter((i: CustomerInvoice) => (i.paidAmount || 0) >= (i.totalNominal || 0)).length} lunas</p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-1">Outstanding</p>
                        <p className="text-lg font-black text-red-700">{formatCurrencyShort(totalOutstanding)}</p>
                        <p className="text-[9px] text-red-400 mt-1">{projectInvoices.filter((i: CustomerInvoice) => (i.paidAmount || 0) < (i.totalNominal || 0)).length} belum lunas</p>
                      </div>
                    </div>
                    {/* Table */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-50">
                        <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                          <FileText size={16} className="text-blue-600" /> Invoice Customer
                        </h3>
                      </div>
                      {projectInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                          <FileText size={40} className="mb-3 opacity-30" />
                          <p className="text-xs font-black uppercase tracking-widest">Belum ada invoice untuk proyek ini</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="p-4">No Invoice</th>
                                <th className="p-4">Tanggal</th>
                                <th className="p-4">Perihal</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-right">Terbayar</th>
                                <th className="p-4 text-right">Outstanding</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {projectInvoices.map((inv: CustomerInvoice) => {
                                const outstanding = (inv.totalNominal || 0) - (inv.paidAmount || 0);
                                const isLunas = outstanding <= 0;
                                return (
                                  <tr key={inv.id} className="text-xs font-bold hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 font-mono text-slate-400 text-[10px]">{inv.noInvoice || inv.id?.slice(0, 8) || '-'}</td>
                                    <td className="p-4 text-slate-500 whitespace-nowrap">{inv.tanggal || inv.date || '-'}</td>
                                    <td className="p-4 text-slate-900 max-w-[180px] truncate">{inv.perihal || inv.description || '-'}</td>
                                    <td className="p-4 text-right font-black text-slate-900 whitespace-nowrap">Rp {(inv.totalNominal || 0).toLocaleString('id-ID')}</td>
                                    <td className="p-4 text-right text-emerald-600 whitespace-nowrap">Rp {(inv.paidAmount || 0).toLocaleString('id-ID')}</td>
                                    <td className="p-4 text-right text-red-500 whitespace-nowrap">Rp {Math.max(0, outstanding).toLocaleString('id-ID')}</td>
                                    <td className="p-4 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                        isLunas ? 'bg-emerald-50 text-emerald-700'
                                        : (inv.paidAmount || 0) > 0 ? 'bg-blue-50 text-blue-700'
                                        : 'bg-amber-50 text-amber-700'
                                      }`}>
                                        {isLunas ? 'Lunas' : (inv.paidAmount || 0) > 0 ? 'Partial' : 'Unpaid'}
                                      </span>
                                    </td>
                                    <td className="p-4 text-center">
                                      {!isLunas && (
                                        <button
                                          onClick={() => navigate('/finance/accounts-receivable', {
                                            state: { paymentInvoiceId: inv.id },
                                          })}
                                          className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-colors"
                                        >
                                          <CreditCard size={12} className="inline mr-1" />Bayar
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {projectTab === "peminjaman-alat" && (() => {
                const loans = (suratJalanList || []).filter(sj =>
                  sj.sjType === 'Equipment Loan' &&
                  (sj.projectId === selectedProject.id || sj.tujuan === selectedProject.namaProject)
                );
                const active = loans.filter(sj => !sj.returnStatus || sj.returnStatus === 'Pending' || sj.returnStatus === 'Partial');
                const returned = loans.filter(sj => sj.returnStatus === 'Complete');
                const today = new Date();
                const overdue = active.filter(sj => sj.expectedReturnDate && new Date(sj.expectedReturnDate) < today);
                const returnStatusColor: Record<string, string> = {
                  Pending:  'bg-amber-100 text-amber-700',
                  Partial:  'bg-blue-100 text-blue-700',
                  Complete: 'bg-emerald-100 text-emerald-700',
                };
                return (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Pinjaman</p>
                        <p className="text-lg font-black text-slate-900">{loans.length}</p>
                        <p className="text-[9px] text-slate-400 mt-1">{loans.reduce((s, sj) => s + sj.items.length, 0)} item alat</p>
                      </div>
                      <div className={`${overdue.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'} border rounded-2xl p-5 shadow-sm`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${overdue.length > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                          {overdue.length > 0 ? '⚠ Overdue' : 'Masih Dipinjam'}
                        </p>
                        <p className={`text-lg font-black ${overdue.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>{overdue.length > 0 ? overdue.length : active.length}</p>
                        <p className={`text-[9px] mt-1 ${overdue.length > 0 ? 'text-rose-400' : 'text-amber-400'}`}>{overdue.length > 0 ? 'Melewati batas kembali' : 'SJ belum dikembalikan'}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Sudah Kembali</p>
                        <p className="text-lg font-black text-emerald-700">{returned.length}</p>
                        <p className="text-[9px] text-emerald-400 mt-1">Complete return</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-50">
                        <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-700">Riwayat Peminjaman Alat</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Read only · Kelola di Correspondence → Surat Jalan</p>
                      </div>
                      {loans.length === 0 ? (
                        <div className="py-14 text-center text-slate-300">
                          <p className="text-xs font-black uppercase tracking-widest">Belum ada peminjaman alat untuk proyek ini</p>
                          <p className="text-[10px] mt-1">Buat SJ tipe Equipment Loan di Correspondence</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-5 py-3">No. SJ</th>
                                <th className="px-5 py-3">Tgl Keluar</th>
                                <th className="px-5 py-3">Alat</th>
                                <th className="px-5 py-3">Est. Kembali</th>
                                <th className="px-5 py-3">Tgl Kembali</th>
                                <th className="px-5 py-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {loans.map(sj => {
                                const isOverdue = sj.expectedReturnDate && new Date(sj.expectedReturnDate) < today && sj.returnStatus !== 'Complete';
                                return (
                                  <tr key={sj.id} className={`hover:bg-slate-50/50 ${isOverdue ? 'bg-rose-50/40' : ''}`}>
                                    <td className="px-5 py-3.5 text-xs font-black text-slate-800 uppercase">{sj.noSurat}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">{sj.tanggal}</td>
                                    <td className="px-5 py-3.5">
                                      {sj.items.slice(0, 2).map((item, i) => (
                                        <div key={i} className="text-[10px] text-slate-700 font-semibold">
                                          {item.jumlah}× {item.namaItem}
                                          {item.keterangan && <span className="text-slate-400 font-normal"> · {item.keterangan}</span>}
                                        </div>
                                      ))}
                                      {sj.items.length > 2 && <span className="text-[9px] text-slate-400 italic">+{sj.items.length - 2} alat lainnya</span>}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {sj.expectedReturnDate ? (
                                        <span className={`text-xs font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                                          {isOverdue && '⚠ '}{sj.expectedReturnDate}
                                        </span>
                                      ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {sj.actualReturnDate
                                        ? <span className="text-xs font-bold text-emerald-600">{sj.actualReturnDate}</span>
                                        : <span className="text-slate-300 text-xs">Belum kembali</span>}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${returnStatusColor[sj.returnStatus || 'Pending']}`}>
                                        {sj.returnStatus || 'Pending'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Modal for Adding Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900">
               <h3 className="text-sm font-black uppercase tracking-widest italic text-white">Add Project Expense</h3>
               <button onClick={() => setShowAddExpenseModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
               <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Description</label>
                  <input 
                    type="text" 
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({...expenseFormData, description: e.target.value})}
                    placeholder="e.g. Pembelian Material Mendadak" 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-slate-400"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Nominal (IDR)</label>
                    <input 
                      type="number" 
                      value={expenseFormData.nominal}
                      onChange={(e) => setExpenseFormData({...expenseFormData, nominal: Number(e.target.value)})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-slate-400"
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Date</label>
                    <input 
                      type="date" 
                      value={expenseFormData.date}
                      onChange={(e) => setExpenseFormData({...expenseFormData, date: e.target.value})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-slate-400"
                    />
                 </div>
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Category</label>
                  <select
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({...expenseFormData, category: e.target.value, kategoriCustom: ''})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-slate-400"
                  >
                    <option>Operational</option>
                    <option>Material</option>
                    <option>Manpower</option>
                    <option>Tools</option>
                    <option>Lain-lain</option>
                  </select>
                  {expenseFormData.category === 'Lain-lain' && (
                    <input
                      type="text"
                      value={expenseFormData.kategoriCustom}
                      onChange={e => setExpenseFormData(f => ({ ...f, kategoriCustom: e.target.value }))}
                      placeholder="Tuliskan kategori..."
                      className="w-full mt-2 p-3 bg-slate-50 border border-blue-300 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  )}
               </div>
               {/* Bon Upload */}
               <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Upload Bon</label>
                  <input
                    ref={expenseBonInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setExpenseFormData(f => ({ ...f, bonUrl: URL.createObjectURL(file) }));
                    }}
                  />
                  {expenseFormData.bonUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={expenseFormData.bonUrl}
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-pointer shadow hover:scale-105 transition-transform"
                        onClick={() => window.open(expenseFormData.bonUrl, '_blank')}
                      />
                      <button
                        type="button"
                        onClick={() => setExpenseFormData(f => ({ ...f, bonUrl: '' }))}
                        className="text-[9px] font-black text-red-500 uppercase hover:text-red-700"
                      >Hapus</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => expenseBonInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:border-blue-400 hover:text-blue-500 transition-all"
                    >
                      <Camera size={14} /> Pilih Foto Bon
                    </button>
                  )}
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => setShowAddExpenseModal(false)} className="px-6 py-2 text-[10px] font-black text-slate-700 uppercase">Cancel</button>
                <button onClick={handleAddExpense} disabled={isSubmitting} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Memproses...' : 'Confirm Ledger Entry'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Adding Work Order */}
      {showAddWorkOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
              <h3 className="text-sm font-black uppercase tracking-widest italic">Buat Work Order</h3>
              <button onClick={() => setShowAddWorkOrderModal(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Item / Pekerjaan */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Item / Pekerjaan</label>
                <input type="text" value={woFormData.itemToProduce}
                  onChange={(e) => setWoFormData({ ...woFormData, itemToProduce: e.target.value })}
                  placeholder="Contoh: REPAIR BOILER NO.2"
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black placeholder:text-slate-300"
                  required />
              </div>

              {/* Jam Masuk + Jam Keluar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 flex items-center gap-1"><Clock size={10} /> Jam Masuk</label>
                  <input type="time" value={woFormData.jamMasuk}
                    onChange={(e) => setWoFormData({ ...woFormData, jamMasuk: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 flex items-center gap-1"><Clock size={10} /> Jam Keluar</label>
                  <input type="time" value={woFormData.jamKeluar}
                    onChange={(e) => setWoFormData({ ...woFormData, jamKeluar: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black" />
                </div>
              </div>

              {/* Teknisi table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Users size={10} /> Daftar Teknisi</label>
                  <button type="button" onClick={addWoTeknisiRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-700 transition-colors">
                    <Plus size={12} /> Tambah
                  </button>
                </div>
                <div className="grid grid-cols-[1.5rem_1fr_1fr_4rem_1.5rem] gap-2 mb-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase text-center">#</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Nama</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Keterangan</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase text-center">QTY</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {woTeknisiRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_4rem_1.5rem] gap-2 items-center">
                      <span className="text-[10px] font-black text-slate-400 text-center">{i + 1}</span>
                      <input type="text" value={row.nama} onChange={(e) => updateWoTeknisiRow(i, { nama: e.target.value })}
                        placeholder="Nama..." className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-black uppercase placeholder:text-slate-300 focus:border-blue-400 outline-none" />
                      <input type="text" value={row.keterangan} onChange={(e) => updateWoTeknisiRow(i, { keterangan: e.target.value })}
                        placeholder="Keterangan..." className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold text-black placeholder:text-slate-300 focus:border-blue-400 outline-none" />
                      <input type="number" min={1} value={row.qty} onChange={(e) => updateWoTeknisiRow(i, { qty: Number(e.target.value) })}
                        className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-black text-center focus:border-blue-400 outline-none" />
                      <button type="button" onClick={() => removeWoTeknisiRow(i)} disabled={woTeknisiRows.length === 1}
                        className="flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-20">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Qty + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Target Quantity</label>
                  <input type="number" min={1} value={woFormData.targetQty}
                    onChange={(e) => setWoFormData({ ...woFormData, targetQty: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Priority</label>
                  <div className="flex gap-2 h-[46px]">
                    {['Normal', 'Urgent'].map(p => (
                      <button key={p} type="button" onClick={() => setWoFormData({ ...woFormData, priority: p as any })}
                        className={`flex-1 rounded-xl text-[10px] font-black uppercase border transition-all ${woFormData.priority === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tanggal Mulai + Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Tanggal Mulai</label>
                  <input type="date" value={woFormData.startDate}
                    onChange={(e) => setWoFormData({ ...woFormData, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Deadline</label>
                  <input type="date" value={woFormData.deadline}
                    onChange={(e) => setWoFormData({ ...woFormData, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black" required />
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowAddWorkOrderModal(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Batal</button>
               <button onClick={handleAddWorkOrder} disabled={isSubmitting} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Memproses...' : 'Create Work Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
