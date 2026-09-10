import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router";
import {
  Wrench,
  ClipboardList,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  MoreHorizontal,
  Settings,
  Users,
  Box,
  Check,
  X,
  ArrowLeft,
  AlertTriangle,
  Package,
  Trash2,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import {
  useApp,
  type WorkOrder,
  type Project,
  type StockItem,
} from "../../contexts/AppContext";
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TeknisiRow { nama: string; keterangan: string; qty: number; }
const DEMO_MODE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';
const emptyTeknisiRow = (): TeknisiRow => ({ nama: '', keterangan: '', qty: 1 });
const PRODUCTION_UNITS = ['Pcs', 'Unit', 'Set', 'Sack', 'Kg', 'Ton', 'Liter', 'M', 'M²', 'Job', 'Lot'];
const woDefaults = (woCount = 0) => ({
  woNumber: `WO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(woCount + 1).padStart(4, "0")}`,
  projectId: "",
  projectName: "",
  spkId: "",
  itemToProduce: "",
  targetQty: 1,
  targetUnit: "Pcs",
  jenisSPK: "Biasa" as string,
  jamMasuk: "08:00",
  jamKeluar: "17:00",
  priority: "Normal" as WorkOrder["priority"],
  startDate: new Date().toISOString().split("T")[0],
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  leadTechnician: "",
  teknisiRows: [emptyTeknisiRow()] as TeknisiRow[],
  teknisiInput: "",
  machineId: "",
  bom: [] as any[],
});

export default function ProductionDashboard() {
  const {
    workOrderList,
    updateWorkOrder,
    addWorkOrder,
    deleteWorkOrder,
    stockItemList,
    projectList,
    assetList,
    resetAllData,
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();

  const [selectedWO, setSelectedWO] =
    useState<WorkOrder | null>(null);
  const [showBOM, setShowBOM] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] =
    useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedWO, setExpandedWO] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Form State for new WO
  const [formData, setFormData] = useState(() => woDefaults(0));

  useEscapeKey([
    { condition: showBOM, close: () => setShowBOM(false) },
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
  ]);


  useEffect(() => {
    if (location.state && (location.state as any).createWO) {
      const state = location.state as any;
      const project = projectList.find(
        (p) => p.id === state.projectId,
      );

      setFormData((prev) => ({
        ...prev,
        projectId: state.projectId || "",
        projectName: state.projectName || "",
        itemToProduce: state.itemToProduce || "",
        targetQty: state.targetQty || 1,
        bom:
          state.bom ||
          project?.boq?.map((item) => ({
            kode: item.itemKode || "",
            nama: item.materialName,
            qty: item.qtyEstimate,
            unit: item.unit,
          })) ||
          [],
      }));
      setShowCreateModal(true);

      // Clear state to prevent modal reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, projectList]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Progress":
        return "text-blue-600 bg-blue-50 border-blue-100";
      case "QC":
        return "text-amber-600 bg-amber-50 border-amber-100";
      case "Completed":
        return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "Draft":
        return "text-slate-500 bg-slate-50 border-slate-100";
      default:
        return "text-slate-500 bg-slate-50 border-slate-100";
    }
  };

  const checkStockAvailability = (bom: any[]) => {
    if (!bom || bom.length === 0) return false;
    return bom.every((item) => {
      const stockItem = stockItemList.find(
        (s) => s.kode === item.kode,
      );
      return stockItem && stockItem.stok >= item.qty;
    });
  };

  const handleStartProduction = (wo: WorkOrder) => {
    if (processingId) return;
    if (!wo.bom || wo.bom.length === 0) {
      toast.error("BOM belum ditentukan untuk Work Order ini.");
      return;
    }

    const isStockAvailable = checkStockAvailability(wo.bom);
    if (!isStockAvailable) {
      toast.error(
        "Stok tidak mencukupi untuk memulai produksi. Silakan cek inventory.",
      );
      return;
    }

    setProcessingId(wo.id);
    try {
      updateWorkOrder(wo.id, { status: "In Progress" });
      toast.success(
        `Produksi dimulai untuk ${wo.woNumber}. Catat pemakaian aktual dan output melalui LHP.`,
      );
      setSelectedWO(null);
      setShowBOM(false);
    } catch (err) {
      toast.error('Gagal memulai produksi: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateWO = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const filledRows = formData.teknisiRows.filter(r => r.nama.trim());
    if (!formData.itemToProduce || filledRows.length === 0 || Number(formData.targetQty) <= 0) {
      toast.error("Item pekerjaan, target hasil produksi, dan minimal 1 teknisi wajib diisi.");
      return;
    }

    const newWO: WorkOrder = {
      id: `wo-${Date.now()}`,
      woNumber: formData.woNumber,
      nomorSPK: (formData as any).nomorSPK || undefined,
      projectId: formData.projectId || "INTERNAL",
      projectName: formData.projectName || "INTERNAL PRODUKSI",
      spkId: formData.spkId || undefined,
      itemToProduce: formData.itemToProduce,
      targetQty: Number(formData.targetQty),
      targetUnit: formData.targetUnit,
      completedQty: 0,
      status: "Draft",
      priority: formData.priority,
      startDate: formData.startDate,
      deadline: formData.deadline,
      leadTechnician: filledRows[0].nama,
      teknisi: filledRows.map(r => r.nama),
      teknisiRows: filledRows,
      jenisSPK: formData.jenisSPK,
      jamMasuk: formData.jamMasuk,
      jamKeluar: formData.jamKeluar,
      machineId: formData.machineId,
      bom: formData.bom,
    };

    setIsSubmitting(true);
    try {
      addWorkOrder(newWO);
      toast.success("Work Order berhasil dibuat.");
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      toast.error('Gagal membuat Work Order: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => setFormData(woDefaults(workOrderList?.length ?? 0));

  const handleProjectSelect = (projectId: string) => {
    if (projectId === "INTERNAL") {
      setFormData({
        ...formData,
        projectId: "INTERNAL",
        projectName: "INTERNAL PRODUKSI",
        bom: [],
      });
      return;
    }
    const project = projectList.find((p) => p.id === projectId);
    if (project) {
      setFormData({
        ...formData,
        projectId: project.id,
        projectName: project.namaProject,
        bom:
          project.boq?.map((item) => ({
            kode: item.itemKode || "",
            nama: item.materialName,
            qty: item.qtyEstimate,
            unit: item.unit,
          })) || [],
      });
    }
  };

  const handleSpkSelect = (spkId: string) => {
    if (!spkId) { setFormData(prev => ({ ...prev, spkId: "" })); return; }
    const allSpk = projectList.flatMap(p => (p.spkList || []).map((s: any) => ({ ...s, projectId: p.id, projectName: p.namaProject })));
    const spk = allSpk.find((s: any) => s.id === spkId);
    if (!spk) return;
    const rows: TeknisiRow[] = spk.teknisiRows?.length
      ? spk.teknisiRows
      : (Array.isArray(spk.teknisi) ? spk.teknisi : (spk.teknisi || '').split(',').map((n: string) => n.trim()).filter(Boolean))
          .map((n: string) => ({ nama: n, keterangan: spk.pekerjaan || '', qty: 1 }));
    setFormData(prev => ({
      ...prev,
      spkId,
      nomorSPK: spk.noSPK || spk.nomorSPK || prev.nomorSPK || '',
      itemToProduce: spk.pekerjaan || prev.itemToProduce,
      jenisSPK: spk.jenisSPK || prev.jenisSPK,
      jamMasuk: spk.jamMasuk || prev.jamMasuk,
      jamKeluar: spk.jamKeluar || prev.jamKeluar,
      teknisiRows: rows.length ? rows : [emptyTeknisiRow()],
      targetQty: Number(spk.targetQty) > 0 ? Number(spk.targetQty) : prev.targetQty,
      targetUnit: spk.targetUnit || spk.satuan || prev.targetUnit,
    } as any));
  };

  const updateTeknisiRow = (i: number, patch: Partial<TeknisiRow>) =>
    setFormData(prev => ({ ...prev, teknisiRows: prev.teknisiRows.map((r, idx) => idx === i ? { ...r, ...patch } : r) }));
  const addTeknisiRow = () =>
    setFormData(prev => ({ ...prev, teknisiRows: [...prev.teknisiRows, emptyTeknisiRow()] }));
  const removeTeknisiRow = (i: number) =>
    setFormData(prev => ({ ...prev, teknisiRows: prev.teknisiRows.filter((_, idx) => idx !== i) }));

  const handleAddMaterialToBOM = (item: StockItem) => {
    const existing = formData.bom.find(
      (b) => b.kode === item.kode,
    );
    if (existing) {
      setFormData({
        ...formData,
        bom: formData.bom.map((b) =>
          b.kode === item.kode ? { ...b, qty: b.qty + 1 } : b,
        ),
      });
    } else {
      setFormData({
        ...formData,
        bom: [
          ...formData.bom,
          {
            kode: item.kode,
            nama: item.nama,
            qty: 1,
            unit: item.satuan,
          },
        ],
      });
    }
    toast.success(`${item.nama} ditambahkan ke BOM`);
  };

  const handleAddMaterialToSelectedWO = (item: StockItem) => {
    if (!selectedWO) return;
    const currentBOM = selectedWO.bom || [];
    const existing = currentBOM.find(
      (b) => b.kode === item.kode,
    );
    let newBOM;
    if (existing) {
      newBOM = currentBOM.map((b) =>
        b.kode === item.kode ? { ...b, qty: b.qty + 1 } : b,
      );
    } else {
      newBOM = [
        ...currentBOM,
        {
          kode: item.kode,
          nama: item.nama,
          qty: 1,
          unit: item.satuan,
        },
      ];
    }

    try {
      updateWorkOrder(selectedWO.id, { bom: newBOM });
      setSelectedWO({ ...selectedWO, bom: newBOM });
      toast.success(`${item.nama} ditambahkan ke BOM`);
    } catch (err) {
      toast.error('Gagal menambahkan material: ' + (err instanceof Error ? err.message : 'Error'));
    }
  };

  const filteredMaterials = stockItemList.filter(
    (item) =>
      item.nama
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.kode
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  const toggleExpand = (id: string) => {
    setExpandedWO(expandedWO === id ? null : id);
  };

  const calculateBOMProgress = (wo: WorkOrder) => {
    if (!wo.bom || wo.bom.length === 0)
      return wo.status === "Completed" ? 100 : 0;
    const totalItems = wo.bom.length;
    const totalProgress = wo.bom.reduce((acc, item) => {
      const itemProgress = Math.min(
        100,
        ((item.completedQty || 0) / item.qty) * 100,
      );
      return acc + itemProgress;
    }, 0);
    return Math.round(totalProgress / totalItems);
  };

  if (showBOM && selectedWO) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBOM(false)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase">
                Verification Bill of Materials (BOM)
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {selectedWO.woNumber} -{" "}
                {selectedWO.itemToProduce}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all"
          >
            <Plus size={14} /> Add Material
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Material Kode & Nama
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Butuh (QTY)
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Stok Saat Ini
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedWO.bom &&
                  selectedWO.bom.length > 0 ? (
                    selectedWO.bom.map((item, idx) => {
                      const stockItem = stockItemList.find(
                        (s) => s.kode === item.kode,
                      );
                      const isAvailable =
                        stockItem && stockItem.stok >= item.qty;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900">
                                {item.nama}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                {item.kode}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <input
                              type="number"
                              value={item.qty}
                              step="0.01"
                              onChange={(e) => {
                                const newQty =
                                  parseFloat(e.target.value) ||
                                  0;
                                const newBOM =
                                  selectedWO.bom?.map((b, i) =>
                                    i === idx
                                      ? { ...b, qty: newQty }
                                      : b,
                                  );
                                updateWorkOrder(selectedWO.id, {
                                  bom: newBOM,
                                });
                                setSelectedWO({
                                  ...selectedWO,
                                  bom: newBOM,
                                });
                              }}
                              className="w-16 px-2 py-1 text-center text-sm font-black text-blue-600 border-b-2 border-transparent focus:border-blue-500 outline-none"
                            />
                            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                              {item.unit}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span
                              className={`text-sm font-bold ${isAvailable ? "text-slate-600" : "text-rose-500"}`}
                            >
                              {stockItem
                                ? `${stockItem.stok} ${stockItem.satuan}`
                                : "Not Found"}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {isAvailable ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                                <Check size={16} />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                                <AlertTriangle size={16} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-20 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <Package size={32} />
                          </div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                            TIDAK ADA ITEM BOM UNTUK WORK ORDER
                            INI.
                          </p>
                          <button
                            onClick={() =>
                              setShowAddItemModal(true)
                            }
                            className="text-blue-600 text-[10px] font-black uppercase hover:underline"
                          >
                            + Klik disini untuk menambahkan
                            material manual
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0">
                <Box size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-blue-900 uppercase italic">
                  Sinkronisasi Real-time Inventory
                </h4>
                <p className="text-xs text-blue-700/70 mt-1 leading-relaxed font-medium">
                  Saat "Mulai Produksi" diklik, sistem hanya
                  memvalidasi BOM dan ketersediaan stok.
                  Pengurangan stok aktual dilakukan saat material
                  benar-benar dicatat pada LHP, lalu tercatat
                  sebagai pengeluaran produksi di Kartu Stok.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-900/20">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 italic underline">
                Ringkasan Produksi
              </h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Item Produksi
                  </span>
                  <span className="font-black">
                    {selectedWO.itemToProduce}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Lead Tech
                  </span>
                  <span className="font-black">
                    {selectedWO.leadTechnician}
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  handleStartProduction(selectedWO)
                }
                disabled={
                  !checkStockAvailability(selectedWO.bom || [])
                }
                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                <Play size={18} fill="currentColor" />
                MULAI PRODUKSI SEKARANG
              </button>
              {!checkStockAvailability(
                selectedWO.bom || [],
              ) && (
                <p className="text-[10px] text-rose-400 font-bold uppercase mt-4 text-center leading-relaxed">
                  TOMBOL TERKUNCI: HARAP PENUHI KEBUTUHAN
                  MATERIAL DI GUDANG TERLEBIH DAHULU.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ADD ITEM MODAL */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col border border-slate-200">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase italic tracking-tighter">
                  Add Material to BOM
                </h3>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 border-b border-slate-50">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search material code or name..."
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerm(e.target.value)
                    }
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {filteredMaterials.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (selectedWO)
                        handleAddMaterialToSelectedWO(item);
                      else handleAddMaterialToBOM(item);
                    }}
                    className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition-all group text-left"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 group-hover:text-blue-600">
                        {item.nama}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        {item.kode} • Stok: {item.stok}{" "}
                        {item.satuan}
                      </span>
                    </div>
                    <Plus
                      size={18}
                      className="text-slate-300 group-hover:text-blue-600"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Production Control
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Workshop & Fabrication Management
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {DEMO_MODE_ENABLED && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Ingin mereset data demo ke kondisi awal?",
                  )
                ) {
                  resetAllData();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase hover:border-rose-500 hover:text-rose-600 transition-all"
            >
              Reset Data Demo
            </button>
          )}
          <Link
            to="/produksi/guide"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black shadow-lg transition-all"
          >
            <BookOpen size={18} /> Guide
          </Link>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Create Work Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active WO",
            value: workOrderList
              .filter((wo) => wo.status === "In Progress")
              .length.toString(),
            icon: Play,
            color: "text-blue-600",
          },
          {
            label: "Pending QC",
            value: workOrderList
              .filter((wo) => wo.status === "QC")
              .length.toString(),
            icon: AlertCircle,
            color: "text-amber-500",
          },
          {
            label: "Draft WO",
            value: workOrderList
              .filter((wo) => wo.status === "Draft")
              .length.toString(),
            icon: ClipboardList,
            color: "text-slate-500",
          },
          {
            label: "Finished",
            value: workOrderList
              .filter((wo) => wo.status === "Completed")
              .length.toString(),
            icon: CheckCircle2,
            color: "text-emerald-600",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
          >
            <stat.icon
              size={20}
              className={`${stat.color} mb-3`}
            />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {stat.label}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <ClipboardList
              size={18}
              className="text-blue-600"
            />
            Live Production Floor
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Real-time Tracking
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Work Order Info
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Production Progress
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Assignment
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Action
                </th>
              </tr>
            </thead>
            {(workOrderList || []).length > 0 ? (
              (workOrderList || []).map((wo) => (
                <tbody
                  key={wo.id}
                  className="divide-y divide-slate-50 border-b border-slate-50 last:border-0"
                >
                  <tr className="group hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleExpand(wo.id)}
                          className="mt-1 p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"
                        >
                          {expandedWO === wo.id ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-blue-600 tracking-tighter">
                            {wo.woNumber}
                          </span>
                          <span className="text-sm font-black text-slate-900 mt-0.5">
                            {wo.itemToProduce}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                            Project: {wo.projectName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-[180px]">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            {calculateBOMProgress(wo)}% BOM
                            Progress
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            DL: {wo.deadline}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${wo.priority === "Urgent" ? "bg-rose-500" : "bg-blue-600"}`}
                            style={{
                              width: `${calculateBOMProgress(wo)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          <Users size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">
                            {wo.leadTechnician}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">
                            Team Lead
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(wo.status)}`}
                      >
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {wo.status === "In Progress" && (
                          <button
                            disabled={processingId !== null}
                            onClick={() => {
                              if (processingId) return;
                              if ((wo.completedQty || 0) < wo.targetQty) {
                                toast.error(`Output ${wo.woNumber} belum mencapai target ${wo.targetQty}.`);
                                return;
                              }
                              setProcessingId(wo.id);
                              try {
                                updateWorkOrder(wo.id, { status: "QC" });
                                toast.success(`${wo.woNumber} dikirim ke antrian QC.`);
                              } catch (err) {
                                toast.error('Gagal mengirim ke QC: ' + (err instanceof Error ? err.message : 'Error'));
                              } finally {
                                setProcessingId(null);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-all shadow-md shadow-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ShieldCheck size={14} /> Send to QC
                          </button>
                        )}
                        {wo.status === "Draft" && (
                          <button
                            onClick={() => {
                              setSelectedWO(wo);
                              setShowBOM(true);
                            }}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Verifikasi BOM & Mulai Produksi"
                          >
                            <Layers size={16} />
                          </button>
                        )}
                        {wo.status === "QC" && <span className="px-3 py-1.5 text-[9px] font-black uppercase text-amber-700 bg-amber-50 rounded-lg">Menunggu QC</span>}
                        {wo.status === "In Progress" && (
                          <button
                            onClick={() => navigate("/produksi/report", { state: { woId: wo.id } })}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Input LHP"
                          >
                            <ClipboardList size={16} />
                          </button>
                        )}
                        <button
                          disabled={processingId !== null}
                          onClick={() => {
                            if (processingId) return;
                            if (!window.confirm(`Hapus Work Order ${wo.woNumber}? Tindakan ini tidak dapat dibatalkan.`)) return;
                            setProcessingId(wo.id);
                            try {
                              deleteWorkOrder(wo.id);
                              toast.success(`Work Order ${wo.woNumber} dihapus.`);
                            } catch (err) {
                              toast.error('Gagal menghapus WO: ' + (err instanceof Error ? err.message : 'Error'));
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedWO === wo.id && (
                    <tr className="bg-slate-50/50">
                      <td
                        colSpan={5}
                        className="px-12 py-6 border-b border-slate-100"
                      >
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 italic">
                            <Layers
                              size={16}
                              className="text-blue-600"
                            />{" "}
                            Issued BOM
                          </h4>
                          {wo.bom && wo.bom.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {wo.bom.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700">
                                      {item.nama}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                                      {item.kode}
                                    </span>
                                  </div>
                                  <span className="text-xs font-black text-blue-600">
                                    {item.qty} {item.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-4">
                              No materials assigned.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))
            ) : (
              <tbody className="divide-y divide-slate-50">
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-xs"
                  >
                    Belum ada Work Order.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* MODALS REMOVED FOR BREVITY - PRESERVED IN REAL IMPLEMENTATION */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-slate-200 text-slate-900">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-center z-10">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                Create Work Order
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateWO}
              className="p-8 space-y-5"
            >
              {/* Reference Project */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Reference Project</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                >
                  <option value="">-- Select Project --</option>
                  <option value="INTERNAL">⚙️ INTERNAL PRODUKSI (Tanpa Project)</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>{p.namaProject}</option>
                  ))}
                </select>
              </div>

              {/* SPK — auto-fill */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                  No. SPK <span className="text-slate-300 normal-case font-medium">(opsional — auto-fill data)</span>
                </label>
                <select
                  value={formData.spkId}
                  onChange={(e) => handleSpkSelect(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                >
                  <option value="">— Tanpa SPK —</option>
                  {projectList
                    .filter(p => !formData.projectId || p.id === formData.projectId || formData.projectId === "INTERNAL")
                    .flatMap(p => (p.spkList || []).filter((s: any) => s.status === 'Approved' || s.status === 'Active').map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.noSPK} — {s.pekerjaan} {s.jenisSPK && s.jenisSPK !== 'Biasa' ? `[${s.jenisSPK}]` : ''}
                      </option>
                    )))}
                </select>
                {formData.spkId && (
                  <p className="text-[10px] text-emerald-600 font-black mt-1.5 uppercase tracking-wide">✅ Data otomatis diisi dari SPK</p>
                )}
              </div>

              {/* Item / Pekerjaan */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Item / Pekerjaan</label>
                <input
                  type="text"
                  value={formData.itemToProduce}
                  onChange={(e) => setFormData({ ...formData, itemToProduce: e.target.value })}
                  placeholder="Contoh: REPAIR BOILER NO.2"
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black placeholder:text-slate-300"
                  required
                />
              </div>

              {/* Target hasil produksi dipisahkan dari QTY teknisi */}
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Target Hasil Produksi</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.targetQty}
                    onChange={(e) => setFormData({ ...formData, targetQty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Satuan</label>
                  <select
                    value={formData.targetUnit}
                    onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                    className="w-full px-3 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                  >
                    {PRODUCTION_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 -mt-3">QTY pada tabel teknisi hanya menunjukkan jumlah personel/penugasan, bukan target output.</p>

              {/* Jam Masuk + Jam Keluar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Clock size={11} /> Jam Masuk
                  </label>
                  <input
                    type="time"
                    value={formData.jamMasuk}
                    onChange={(e) => setFormData({ ...formData, jamMasuk: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Clock size={11} /> Jam Keluar
                  </label>
                  <input
                    type="time"
                    value={formData.jamKeluar}
                    onChange={(e) => setFormData({ ...formData, jamKeluar: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black"
                  />
                </div>
              </div>

              {/* Tabel Teknisi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                    <Users size={11} /> Daftar Teknisi
                  </label>
                  <button type="button" onClick={addTeknisiRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-700 transition-colors">
                    <Plus size={12} /> Tambah
                  </button>
                </div>
                <div className="grid grid-cols-[1.5rem_1fr_1fr_4.5rem_1.5rem] gap-2 mb-1 px-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase text-center">No</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Nama</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Keterangan</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase text-center">QTY</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {(formData.teknisiRows || []).map((row, i) => (
                    <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_4.5rem_1.5rem] gap-2 items-center">
                      <span className="text-[10px] font-black text-slate-400 text-center">{i + 1}</span>
                      <input type="text" value={row.nama}
                        onChange={(e) => updateTeknisiRow(i, { nama: e.target.value })}
                        placeholder="Nama..."
                        className="px-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-black uppercase placeholder:text-slate-300 focus:border-blue-400 outline-none" />
                      <input type="text" value={row.keterangan}
                        onChange={(e) => updateTeknisiRow(i, { keterangan: e.target.value })}
                        placeholder="Keterangan..."
                        className="px-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold text-black placeholder:text-slate-300 focus:border-blue-400 outline-none" />
                      <input type="number" min={1} value={row.qty}
                        onChange={(e) => updateTeknisiRow(i, { qty: Number(e.target.value) })}
                        className="px-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-black text-center focus:border-blue-400 outline-none" />
                      <button type="button" onClick={() => removeTeknisiRow(i)}
                        disabled={(formData.teknisiRows || []).length === 1}
                        className="flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-20">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Date + Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Deadline</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'MEMPROSES...' : 'CREATE WORK ORDER'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black uppercase italic tracking-tighter">
                Select Material
              </h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {filteredMaterials.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddMaterialToBOM(item)}
                  className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900">
                      {item.nama}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {item.kode} • Stok: {item.stok}
                    </span>
                  </div>
                  <Plus size={18} className="text-blue-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
