import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { Wrench, ClipboardList, Play, CheckCircle2, Clock, AlertCircle, Plus, ArrowRight, MoreHorizontal, Settings, Users, Box, Check, X, ArrowLeft, AlertTriangle, Package, Trash2, Calendar, Search, ChevronDown, ChevronUp, Layers, BookOpen } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { WorkOrder, StockItem, Project } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { normalizeEntityRows } from '../../utils/normalizeEntityRows';

type ProductionSummaryResponse = {
  workOrders?: {
    draft?: number;
    inProgress?: number;
    qc?: number;
    completed?: number;
  };
};

export default function ProductionDashboard() {
  const { 
    workOrderList, 
    updateWorkOrder, 
    addWorkOrder, 
    deleteWorkOrder, 
    stockItemList, 
    assetList,
    resetAllData
  } = useApp();

  const navigate = useNavigate();
  
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showBOM, setShowBOM] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isCreatingWO, setIsCreatingWO] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWO, setExpandedWO] = useState<string | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummaryResponse | null>(null);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [serverWorkOrders, setServerWorkOrders] = useState<WorkOrder[]>([]);
  const [serverStockItems, setServerStockItems] = useState<StockItem[]>([]);
  const [serverAssets, setServerAssets] = useState<any[]>([]);
  const [serverProjects, setServerProjects] = useState<Project[]>([]);
  const creatingWORef = useRef(false);
  const dataLoadInFlightRef = useRef(false);
  const summaryLoadInFlightRef = useRef(false);
  const PRODUCTION_POLL_INTERVAL_MS = 15000;

  const generateWONumber = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const stamp = String(now.getTime()).slice(-6);
    return `WO-${year}${month}-${stamp}`;
  }, []);

  const effectiveWorkOrders = useMemo(
    () => (serverWorkOrders.length > 0 ? serverWorkOrders : workOrderList),
    [serverWorkOrders, workOrderList]
  );
  const effectiveStockItems = useMemo(
    () => (serverStockItems.length > 0 ? serverStockItems : stockItemList),
    [serverStockItems, stockItemList]
  );
  const effectiveAssets = useMemo(
    () => (serverAssets.length > 0 ? serverAssets : assetList),
    [serverAssets, assetList]
  );
  const effectiveProjects = useMemo(
    () => serverProjects.filter((project) => String(project?.id || '').trim() && String(project?.namaProject || '').trim()),
    [serverProjects]
  );

  // Form State for new WO
  const [formData, setFormData] = useState({
    woNumber: generateWONumber(),
    projectId: '',
    projectName: '',
    itemToProduce: '',
    targetQty: 1,
    priority: 'Normal' as WorkOrder['priority'],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    leadTechnician: '',
    machineId: '',
    bom: [] as any[]
  });

  const isNonMaterialBoqItem = useCallback((item: any) => {
    const unit = String(item?.unit || '').trim().toLowerCase();
    const category = String(item?.category || '').trim().toLowerCase();
    const name = String(item?.materialName || '').trim().toLowerCase();
    const manpowerUnits = new Set(['orang', 'man', 'mandays', 'man-day', 'man day', 'hari', 'day', 'jam', 'hour']);
    const manpowerCategories = ['manpower', 'jasa', 'service', 'labour', 'labor'];
    const manpowerKeywords = ['mandor', 'teknisi', 'helper', 'pekerja', 'operator', 'supervisor', 'welder', 'safety'];
    return (
      manpowerUnits.has(unit) ||
      manpowerCategories.some((k) => category.includes(k)) ||
      manpowerKeywords.some((k) => name.includes(k))
    );
  }, []);

  const normalizeKey = useCallback((value: unknown) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }, []);

  const findStockMatchForBomItem = useCallback((item: any) => {
    const sourceCode = String(item?.kode || item?.itemKode || "").trim();
    const sourceName = String(item?.nama || item?.materialName || "").trim();
    const sourceCodeNorm = normalizeKey(sourceCode);
    const sourceNameNorm = normalizeKey(sourceName);

    const byCode = effectiveStockItems.find((s) => {
      const codeNorm = normalizeKey(s?.kode);
      return !!sourceCodeNorm && codeNorm === sourceCodeNorm;
    });
    if (byCode) return byCode;

    const byExactName = effectiveStockItems.find((s) => {
      const stockNameNorm = normalizeKey(s?.nama);
      return !!sourceNameNorm && stockNameNorm === sourceNameNorm;
    });
    if (byExactName) return byExactName;

    const byContainsName = effectiveStockItems.find((s) => {
      const stockNameNorm = normalizeKey(s?.nama);
      return (
        !!sourceNameNorm &&
        !!stockNameNorm &&
        (stockNameNorm.includes(sourceNameNorm) || sourceNameNorm.includes(stockNameNorm))
      );
    });
    return byContainsName;
  }, [effectiveStockItems, normalizeKey]);

  const toMaterialBomItems = useCallback((rawBom: any[] | undefined) => {
    if (!Array.isArray(rawBom)) return [];

    return rawBom
      .filter((item) => !isNonMaterialBoqItem(item))
      .map((item) => {
        const match = findStockMatchForBomItem(item);
        const qtyValue = Number(item?.qty ?? item?.qtyEstimate ?? item?.jumlah ?? 0);
        const completedQty = Number(item?.completedQty ?? 0);
        const sourceName = String(item?.nama || item?.materialName || "").trim();
        const sourceCode = String(item?.kode || item?.itemKode || "").trim();
        const sourceUnit = String(item?.unit || item?.satuan || "").trim();

        return {
          kode: String(match?.kode || sourceCode || "").trim(),
          nama: String(match?.nama || sourceName || "-").trim(),
          qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
          completedQty: Number.isFinite(completedQty) && completedQty > 0 ? completedQty : 0,
          unit: String(match?.satuan || sourceUnit || "Unit").trim(),
        };
      })
      .filter((item) => item.nama && (item.kode || item.nama !== "-"));
  }, [findStockMatchForBomItem, isNonMaterialBoqItem]);

  const loadData = useCallback(async (silent = true) => {
    if (dataLoadInFlightRef.current) return;
    dataLoadInFlightRef.current = true;
    if (!silent) setSyncingData(true);
    try {
      const normalizeList = <T,>(rows: unknown): T[] => {
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => {
          const rec = (row && typeof row === 'object') ? (row as Record<string, any>) : {};
          if (rec.payload && typeof rec.payload === 'object' && !Array.isArray(rec.payload)) {
            return { id: rec.entityId || rec.id, ...(rec.payload as Record<string, any>) } as T;
          }
          return rec as T;
        });
      };

      const [woRes, stockRes, assetRes, projectRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/inventory/items'),
        api.get('/assets'),
        api.get('/projects'),
      ]);

      const nextStockItems = normalizeList<StockItem>(stockRes.data);
      const normalizeKeyForStock = (value: unknown) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      const findStockMatch = (item: any) => {
        const sourceCode = String(item?.kode || item?.itemKode || "").trim();
        const sourceName = String(item?.nama || item?.materialName || "").trim();
        const sourceCodeNorm = normalizeKeyForStock(sourceCode);
        const sourceNameNorm = normalizeKeyForStock(sourceName);

        const byCode = nextStockItems.find((s) => {
          const codeNorm = normalizeKeyForStock(s?.kode);
          return !!sourceCodeNorm && codeNorm === sourceCodeNorm;
        });
        if (byCode) return byCode;

        const byExactName = nextStockItems.find((s) => {
          const stockNameNorm = normalizeKeyForStock(s?.nama);
          return !!sourceNameNorm && stockNameNorm === sourceNameNorm;
        });
        if (byExactName) return byExactName;

        return nextStockItems.find((s) => {
          const stockNameNorm = normalizeKeyForStock(s?.nama);
          return (
            !!sourceNameNorm &&
            !!stockNameNorm &&
            (stockNameNorm.includes(sourceNameNorm) || sourceNameNorm.includes(stockNameNorm))
          );
        });
      };
      const mapMaterialBomItems = (rawBom: any[] | undefined) => {
        if (!Array.isArray(rawBom)) return [];
        return rawBom
          .filter((item) => !isNonMaterialBoqItem(item))
          .map((item) => {
            const match = findStockMatch(item);
            const qtyValue = Number(item?.qty ?? item?.qtyEstimate ?? item?.jumlah ?? 0);
            const completedQty = Number(item?.completedQty ?? 0);
            const sourceName = String(item?.nama || item?.materialName || "").trim();
            const sourceCode = String(item?.kode || item?.itemKode || "").trim();
            const sourceUnit = String(item?.unit || item?.satuan || "").trim();

            return {
              kode: String(match?.kode || sourceCode || "").trim(),
              nama: String(match?.nama || sourceName || "-").trim(),
              qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
              completedQty: Number.isFinite(completedQty) && completedQty > 0 ? completedQty : 0,
              unit: String(match?.satuan || sourceUnit || "Unit").trim(),
            };
          })
          .filter((item) => item.nama && (item.kode || item.nama !== "-"));
      };

      const nextWorkOrders = normalizeList<WorkOrder>(woRes.data).map((wo: any) => ({
        ...wo,
        bom: mapMaterialBomItems(Array.isArray(wo?.bom) ? wo.bom : []),
      }));

      setServerWorkOrders(nextWorkOrders);
      setServerStockItems(nextStockItems);
      setServerAssets(normalizeList(assetRes.data));
      setServerProjects(normalizeEntityRows<Project>(projectRes.data));
      if (!silent) toast.success('Production data diperbarui.');
    } catch {
      if (!silent) toast.error('Gagal refresh production data.');
    } finally {
      dataLoadInFlightRef.current = false;
      if (!silent) setSyncingData(false);
    }
  }, [isNonMaterialBoqItem]);

  const loadSummary = useCallback(async (silent = true) => {
    if (summaryLoadInFlightRef.current) return;
    summaryLoadInFlightRef.current = true;
    if (!silent) setSummaryRefreshing(true);
    try {
      const { data } = await api.get<ProductionSummaryResponse>('/dashboard/production-summary');
      setProductionSummary(data);
      if (!silent) toast.success("Production summary diperbarui.");
    } catch {
      if (!silent) toast.error("Gagal refresh production summary.");
      // fallback to local counters
    } finally {
      summaryLoadInFlightRef.current = false;
      if (!silent) setSummaryRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary(true);
    void loadData(true);
    // Initial load only; load callbacks intentionally not in deps to avoid re-trigger loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void loadData(true);
      void loadSummary(true);
    }, PRODUCTION_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadData, loadSummary]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'QC': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Completed': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'Draft': return 'text-slate-500 bg-slate-50 border-slate-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const checkStockAvailability = (bom: any[]) => {
    const sanitizedBom = toMaterialBomItems(bom);
    if (sanitizedBom.length === 0) return false;
    return sanitizedBom.every(item => {
      const itemCode = String(item?.kode || '').trim().toLowerCase();
      const itemName = String(item?.nama || item?.materialName || '').trim().toLowerCase();
      const stockItem = effectiveStockItems.find((s) => {
        const code = String(s?.kode || '').trim().toLowerCase();
        const name = String(s?.nama || '').trim().toLowerCase();
        return (itemCode && code === itemCode) || (itemName && name === itemName);
      });
      return stockItem && stockItem.stok >= item.qty;
    });
  };

  const handleStartProduction = async (wo: WorkOrder) => {
    const materialBom = toMaterialBomItems(wo.bom as any[]);
    if (materialBom.length === 0) {
      toast.error('BOM belum ditentukan untuk Work Order ini.');
      return;
    }

    const isStockAvailable = checkStockAvailability(materialBom);
    if (!isStockAvailable) {
      toast.error('Stok tidak mencukupi untuk memulai produksi. Silakan cek inventory.');
      return;
    }

    try {
      await updateWorkOrder(wo.id, { status: 'In Progress' });
      await loadData(true);
      await loadSummary(true);
      toast.success(`Produksi dimulai untuk ${wo.woNumber}. Stok otomatis terpotong.`);
      setSelectedWO(null);
      setShowBOM(false);
    } catch {
      // toast handled in context
    }
  };

  const handleCreateWO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingWORef.current || isCreatingWO) return;
    if (!formData.itemToProduce || !formData.leadTechnician) {
      toast.error("Harap isi semua field yang wajib.");
      return;
    }
    if (!formData.projectId || !formData.projectName) {
      toast.error("Work Order harus terhubung ke project yang valid.");
      return;
    }

    const newWO: WorkOrder = {
      id: `wo-${Date.now()}`,
      woNumber: formData.woNumber,
      projectId: formData.projectId,
      projectName: formData.projectName,
      itemToProduce: formData.itemToProduce,
      targetQty: formData.targetQty,
      completedQty: 0,
      status: 'Draft',
      priority: formData.priority,
      deadline: formData.deadline,
      leadTechnician: formData.leadTechnician,
      machineId: formData.machineId,
      bom: formData.bom
    };

    try {
      creatingWORef.current = true;
      setIsCreatingWO(true);
      await addWorkOrder(newWO);
      await loadData(true);
      await loadSummary(true);
      toast.success("Work Order berhasil dibuat.");
      setShowCreateModal(false);
      resetForm();
    } catch {
      // toast handled in context
    } finally {
      creatingWORef.current = false;
      setIsCreatingWO(false);
    }
  };

  const resetForm = () => {
    setFormData({
      woNumber: generateWONumber(),
      projectId: '',
      projectName: '',
      itemToProduce: '',
      targetQty: 1,
      priority: 'Normal',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      leadTechnician: '',
      machineId: '',
      bom: []
    });
  };

  const handleAddMaterialToBOM = (item: StockItem) => {
    const existing = formData.bom.find(b => b.kode === item.kode);
    if (existing) {
      setFormData({
        ...formData,
        bom: formData.bom.map(b => b.kode === item.kode ? { ...b, qty: b.qty + 1 } : b)
      });
    } else {
      setFormData({
        ...formData,
        bom: [...formData.bom, { kode: item.kode, nama: item.nama, qty: 1, unit: item.satuan }]
      });
    }
    setShowAddItemModal(false);
    toast.success(`${item.nama} ditambahkan ke BOM`);
  };

  const handleAddMaterialToSelectedWO = (item: StockItem) => {
    if (!selectedWO) return;
    const currentBOM = selectedWO.bom || [];
    const existing = currentBOM.find(b => b.kode === item.kode);
    let newBOM;
    if (existing) {
      newBOM = currentBOM.map(b => b.kode === item.kode ? { ...b, qty: b.qty + 1 } : b);
    } else {
      newBOM = [...currentBOM, { kode: item.kode, nama: item.nama, qty: 1, unit: item.satuan }];
    }
    
    updateWorkOrder(selectedWO.id, { bom: newBOM });
    setSelectedWO({ ...selectedWO, bom: newBOM });
    setShowAddItemModal(false);
    toast.success(`${item.nama} ditambahkan ke BOM`);
  };

  const filteredMaterials = effectiveStockItems.filter(item => {
    const keyword = String(searchTerm || '').toLowerCase();
    return (
      String(item.nama || '').toLowerCase().includes(keyword) ||
      String(item.kode || '').toLowerCase().includes(keyword)
    );
  });

  const toggleExpand = (id: string) => {
    setExpandedWO(expandedWO === id ? null : id);
  };

  const calculateBOMProgress = (wo: WorkOrder) => {
    const materialBom = toMaterialBomItems(wo.bom as any[]);
    if (materialBom.length === 0) return wo.status === 'Completed' ? 100 : 0;
    const totalItems = materialBom.length;
    const totalProgress = materialBom.reduce((acc, item) => {
      const itemProgress = Math.min(100, ((item.completedQty || 0) / item.qty) * 100);
      return acc + itemProgress;
    }, 0);
    return Math.round(totalProgress / totalItems);
  };

  const selectedMaterialBom = useMemo(
    () => toMaterialBomItems(selectedWO?.bom as any[]),
    [selectedWO?.bom, toMaterialBomItems]
  );

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
              <h1 className="text-xl font-black text-slate-900 uppercase">Verification Bill of Materials (BOM)</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedWO.woNumber} - {selectedWO.itemToProduce}</p>
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
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Kode & Nama</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Butuh (QTY)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stok Saat Ini</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedMaterialBom.length > 0 ? (
                    selectedMaterialBom.map((item, idx) => {
                      const itemCode = String(item?.kode || '').trim().toLowerCase();
                      const itemName = String(item?.nama || item?.materialName || '').trim().toLowerCase();
                      const stockItem = effectiveStockItems.find((s) => {
                        const code = String(s?.kode || '').trim().toLowerCase();
                        const name = String(s?.nama || '').trim().toLowerCase();
                        return (itemCode && code === itemCode) || (itemName && name === itemName);
                      });
                      const isAvailable = stockItem && stockItem.stok >= item.qty;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900">{item.nama}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{item.kode}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <input 
                              type="number" 
                              value={item.qty}
                              step="0.01"
                              onChange={(e) => {
                                const newQty = parseFloat(e.target.value) || 0;
                                const newBOM = (selectedWO.bom || []).map((b) => {
                                  const sameCode =
                                    String(b?.kode || '').trim().toLowerCase() ===
                                    String(item?.kode || '').trim().toLowerCase();
                                  const sameName =
                                    String(b?.nama || b?.materialName || '').trim().toLowerCase() ===
                                    String(item?.nama || item?.materialName || '').trim().toLowerCase();
                                  if (sameCode || sameName) {
                                    return { ...b, qty: newQty };
                                  }
                                  return b;
                                });
                                updateWorkOrder(selectedWO.id, { bom: newBOM });
                                setSelectedWO({ ...selectedWO, bom: newBOM });
                              }}
                              className="w-16 px-2 py-1 text-center text-sm font-black text-blue-600 border-b-2 border-transparent focus:border-blue-500 outline-none"
                            />
                            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">{item.unit}</span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`text-sm font-bold ${isAvailable ? 'text-slate-600' : 'text-amber-600'}`}>
                              {stockItem ? `${stockItem.stok} ${stockItem.satuan}` : 'Need Procurement'}
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
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <Package size={32} />
                          </div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">TIDAK ADA ITEM BOM UNTUK WORK ORDER INI.</p>
                          <button 
                            onClick={() => setShowAddItemModal(true)}
                            className="text-blue-600 text-[10px] font-black uppercase hover:underline"
                          >
                            + Klik disini untuk menambahkan SKU material dari gudang
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
                <h4 className="text-sm font-black text-blue-900 uppercase italic">Sinkronisasi Real-time Inventory</h4>
                <p className="text-xs text-blue-700/70 mt-1 leading-relaxed font-medium">
                  Dengan mengklik "Mulai Produksi", sistem akan otomatis melakukan **Inventory Issuance**. Stok akan berkurang seketika dan tercatat dalam Kartu Stok sebagai pengeluaran untuk produksi.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-900/20">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 italic underline">Ringkasan Produksi</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Item Produksi</span>
                  <span className="font-black">{selectedWO.itemToProduce}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Lead Tech</span>
                  <span className="font-black">{selectedWO.leadTechnician}</span>
                </div>
              </div>

              <button 
                onClick={() => handleStartProduction(selectedWO)}
                disabled={!checkStockAvailability(selectedMaterialBom)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                <Play size={18} fill="currentColor" />
                MULAI PRODUKSI SEKARANG
              </button>
              {!checkStockAvailability(selectedMaterialBom) && (
                <p className="text-[10px] text-rose-400 font-bold uppercase mt-4 text-center leading-relaxed">
                  TOMBOL TERKUNCI: HARAP PENUHI KEBUTUHAN MATERIAL DI GUDANG TERLEBIH DAHULU.
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
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Add Material to BOM</h3>
                <button onClick={() => setShowAddItemModal(false)} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 border-b border-slate-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search material code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {filteredMaterials.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      if (selectedWO) handleAddMaterialToSelectedWO(item);
                      else handleAddMaterialToBOM(item);
                    }}
                    className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition-all group text-left"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 group-hover:text-blue-600">{item.nama}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{item.kode} • Stok: {item.stok} {item.satuan}</span>
                    </div>
                    <Plus size={18} className="text-slate-300 group-hover:text-blue-600" />
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
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Production Control</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Workshop & Fabrication Management</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => loadData(false)}
            disabled={syncingData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-60"
          >
            {syncingData ? "Syncing..." : "Refresh Data"}
          </button>
          <button
            onClick={() => loadSummary(false)}
            disabled={summaryRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-60"
          >
            {summaryRefreshing ? "Refreshing..." : "Refresh Summary"}
          </button>
          <button 
            onClick={() => {
              if (window.confirm("Ingin mereset data demo ke kondisi awal?")) {
                 resetAllData();
                 toast.success("Data demo berhasil direset");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase hover:border-rose-500 hover:text-rose-600 transition-all"
          >
             Reset Data Demo
          </button>
          <Link 
            to="/produksi/guide"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black shadow-lg transition-all"
          >
            <BookOpen size={18} /> Guide
          </Link>
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Create Work Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active WO', value: String(productionSummary?.workOrders?.inProgress ?? effectiveWorkOrders.filter(wo => wo.status === 'In Progress').length), icon: Play, color: 'text-blue-600' },
          { label: 'Pending QC', value: String(productionSummary?.workOrders?.qc ?? effectiveWorkOrders.filter(wo => wo.status === 'QC').length), icon: AlertCircle, color: 'text-amber-500' },
          { label: 'Draft WO', value: String(productionSummary?.workOrders?.draft ?? effectiveWorkOrders.filter(wo => wo.status === 'Draft').length), icon: ClipboardList, color: 'text-slate-500' },
          { label: 'Finished', value: String(productionSummary?.workOrders?.completed ?? effectiveWorkOrders.filter(wo => wo.status === 'Completed').length), icon: CheckCircle2, color: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <stat.icon size={20} className={`${stat.color} mb-3`} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            Live Production Floor
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Real-time Tracking</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Order Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Progress</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignment</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            {effectiveWorkOrders.length > 0 ? (
              effectiveWorkOrders.map((wo) => (
                <tbody key={wo.id} className="divide-y divide-slate-50 border-b border-slate-50 last:border-0">
                  <tr className="group hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={() => toggleExpand(wo.id)}
                          className="mt-1 p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"
                        >
                          {expandedWO === wo.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-blue-600 tracking-tighter">{wo.woNumber}</span>
                          <span className="text-sm font-black text-slate-900 mt-0.5">{wo.itemToProduce}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                            {wo.projectName || 'Tanpa Project'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-[180px]">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-[10px] font-black text-slate-500 uppercase">{calculateBOMProgress(wo)}% BOM Progress</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">DL: {wo.deadline}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${wo.priority === 'Urgent' ? 'bg-rose-500' : 'bg-blue-600'}`}
                            style={{ width: `${calculateBOMProgress(wo)}%` }}
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
                          <span className="text-xs font-bold text-slate-700">{wo.leadTechnician}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Team Lead</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(wo.status)}`}>
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {wo.status === 'Draft' && (
                          <button 
                            onClick={() => { setSelectedWO(wo); setShowBOM(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                          >
                            Verify BOM
                          </button>
                        )}
                        {(wo.status === 'In Progress' || wo.status === 'QC') && (
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Konfirmasi penyelesaian ${wo.woNumber}?`)) {
                                try {
                                  await updateWorkOrder(wo.id, { status: 'Completed', completedQty: wo.targetQty });
                                  await loadData(true);
                                  await loadSummary(true);
                                  toast.success(`Work Order Completed!`);
                                } catch {
                                  // toast handled in context
                                }
                              }
                            }}
                             className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                          >
                            <CheckCircle2 size={14} /> Finish
                          </button>
                        )}
                        <button 
                          onClick={() => navigate('/produksi/report')}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Input LHP"
                        >
                          <ClipboardList size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!window.confirm(`Hapus ${wo.woNumber}?`)) return;
                            try {
                              await deleteWorkOrder(wo.id);
                              await loadData(true);
                              await loadSummary(true);
                              toast.success("Work Order dihapus.");
                            } catch {
                              // toast handled in context
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedWO === wo.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={5} className="px-12 py-6 border-b border-slate-100">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 italic">
                            <Layers size={16} className="text-blue-600" /> Issued BOM
                          </h4>
                          {wo.bom && wo.bom.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {wo.bom.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700">{item.nama}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.kode}</span>
                                  </div>
                                  <span className="text-xs font-black text-blue-600">{item.qty} {item.unit}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-4">No materials assigned.</p>
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
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-xs">
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
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-center z-10">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Create Work Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateWO} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Project</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => {
                      const project = effectiveProjects.find((item) => item.id === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        projectId: project?.id || '',
                        projectName: project?.namaProject || '',
                      }));
                    }}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold"
                    required
                  >
                    <option value="">-- Pilih Project --</option>
                    {effectiveProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.namaProject} ({project.customer || '-'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Item to Produce</label>
                  <input 
                    type="text" 
                    value={formData.itemToProduce}
                    onChange={(e) => setFormData({ ...formData, itemToProduce: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold"
                    required
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Lead Tech</label>
                   <input 
                    type="text" 
                    value={formData.leadTechnician}
                    onChange={(e) => setFormData({ ...formData, leadTechnician: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold"
                    required
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Deadline</label>
                   <input 
                    type="date" 
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold"
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={isCreatingWO}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreatingWO ? "CREATING..." : "CREATE WORK ORDER"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Select Material</h3>
              <button onClick={() => setShowAddItemModal(false)} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {filteredMaterials.map(item => (
                <button 
                  key={item.id}
                  onClick={() => handleAddMaterialToBOM(item)}
                  className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900">{item.nama}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.kode} • Stok: {item.stok}</span>
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
