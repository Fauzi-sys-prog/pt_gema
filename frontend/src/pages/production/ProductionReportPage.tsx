import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom'; import { ClipboardList, Plus, Search, Filter, Download, Calendar, User, Clock, Settings as Machine, ChevronRight, Printer, ArrowRight, Camera, Image as ImageIcon, X, Target, Briefcase, BookOpen, FileDown } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { ProductionReport, WorkOrder } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { normalizeEntityRows } from '../../utils/normalizeEntityRows';

const MANUAL_LHP_PROJECT_ID = 'PRJ-STOCK-UMUM';
const MANUAL_LHP_PROJECT_NAME = 'STOK UMUM INTERNAL';
const MANUAL_ISSUE_LABEL = 'Material Issue Manual';
const MANUAL_ISSUE_HELP =
  'Mode ini untuk stok keluar dari gudang. Kalau hasil produksi berupa barang jadi masuk gudang, gunakan menu Stock In.';
const FINISHED_GOODS_LABEL = 'Finished Goods Stock In';
const FINISHED_GOODS_HELP =
  'Mode ini untuk hasil produksi berupa barang jadi yang masuk ke gudang. Stok item akan bertambah saat LHP disimpan.';
const DEFAULT_MANUAL_MODE = 'material-issue';

export default function ProductionReportPage() {
  const location = useLocation();
  const { 
    productionReportList, 
    addProductionReport, 
    workOrderList, 
    stockItemList,
    assetList
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [serverReports, setServerReports] = useState<ProductionReport[]>([]);
  const [serverWorkOrders, setServerWorkOrders] = useState<WorkOrder[]>([]);
  const [serverStockItems, setServerStockItems] = useState<any[]>([]);
  const [serverAssets, setServerAssets] = useState<any[]>([]);
  const isFinishedGoodsFlow = location.pathname === '/produksi/hasil-produksi';

  const normalizeAssets = (rows: unknown): any[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
        const payload =
          rec.payload && typeof rec.payload === 'object' && !Array.isArray(rec.payload)
            ? (rec.payload as Record<string, unknown>)
            : rec;
        const payloadId = typeof payload.id === 'string' && payload.id.trim() ? payload.id : '';
        const entityId = typeof rec.entityId === 'string' && rec.entityId.trim() ? rec.entityId : '';
        const rowId = typeof rec.id === 'string' && rec.id.trim() ? rec.id : '';
        return {
          ...payload,
          id: payloadId || entityId || rowId,
        };
      })
      .filter((item) => String(item.id || '').trim());
  };

  const fetchServerData = async (silent = true) => {
    setSyncing(true);
    try {
      const [reportsRes, workOrdersRes, stockItemsRes, assetsRes] = await Promise.all([
        api.get<ProductionReport[]>('/production-reports'),
        api.get<WorkOrder[]>('/work-orders'),
        api.get<any[]>('/inventory/items'),
        api.get<Array<{ entityId: string; payload: any }>>('/assets'),
      ]);

      const mappedReports = normalizeEntityRows<ProductionReport>(reportsRes.data || []);
      const mappedWorkOrders = normalizeEntityRows<WorkOrder>(workOrdersRes.data || []);
      const mappedStockItems = normalizeEntityRows<any>(stockItemsRes.data || []);

      const mappedAssets = normalizeAssets(assetsRes.data || []);

      setServerReports(mappedReports);
      setServerWorkOrders(mappedWorkOrders);
      setServerStockItems(mappedStockItems);
      setServerAssets(mappedAssets);
      if (!silent) toast.success('Production report data refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh data produksi');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchServerData(true);
  }, []);

  useEffect(() => {
    if (!isFinishedGoodsFlow) return;
    setShowAddModal(true);
    setNewReport((prev) => ({
      ...prev,
      woId: '',
      selectedItem: '',
      selectedItemCode: '',
      selectedItemName: '',
      activity: '',
      manualModeType: 'finished-goods',
      unit: prev.unit || 'Pcs',
    }));
  }, [isFinishedGoodsFlow]);

  const effectiveReports = useMemo(
    () => (serverReports.length > 0 ? serverReports : productionReportList),
    [serverReports, productionReportList]
  );
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

  const activeWorkOrders = effectiveWorkOrders.filter(wo => wo.status === 'In Progress' || wo.status === 'QC');

  const [newReport, setNewReport] = useState<Partial<ProductionReport & {
    woId?: string;
    selectedItem?: string;
    selectedItemCode?: string;
    selectedItemName?: string;
    machineId?: string;
    manualModeType?: 'material-issue' | 'finished-goods';
  }>>({
    tanggal: new Date().toISOString().split('T')[0],
    shift: '1',
    workshop: 'Gema Teknik Workshop',
    unit: 'Pcs',
    startTime: '08:00',
    endTime: '17:00',
    manualModeType: DEFAULT_MANUAL_MODE,
  });
  
  // Show all operational assets from DB (fallback to all non-scrapped if category is inconsistent).
  const availableAssets = useMemo(() => {
    const selectedWO = effectiveWorkOrders.find(w => w.id === newReport.woId);
    const normalized = (effectiveAssets || []).filter((a) => String(a?.id || '').trim());
    const machineLike = normalized.filter((a) => {
      const category = String(a?.category || '').trim().toLowerCase();
      return (
        category.includes('machine') ||
        category.includes('heavy') ||
        category.includes('equipment') ||
        category.includes('vehicle') ||
        category.includes('tools')
      );
    });
    const candidatePool = machineLike.length > 0 ? machineLike : normalized;
    const selectedIds = new Set(
      [selectedWO?.machineId, newReport.machineId]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    );
    return candidatePool.filter((a) => {
      const status = String(a?.status || '').trim().toLowerCase();
      const id = String(a?.id || '').trim();
      if (selectedIds.has(id)) return true;
      return status !== 'scrapped';
    });
  }, [effectiveAssets, newReport.woId, newReport.machineId, effectiveWorkOrders]);

  const filteredReports = effectiveReports
    .filter((report) => {
      const keyword = String(searchTerm || "").toLowerCase();
      return (
        String(report.workerName || "").toLowerCase().includes(keyword) ||
        String(report.activity || "").toLowerCase().includes(keyword)
      );
    })
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const selectedWorkOrder = useMemo(
    () => effectiveWorkOrders.find((wo) => wo.id === newReport.woId),
    [effectiveWorkOrders, newReport.woId]
  );
  const currentManualModeType =
    !newReport.woId && newReport.manualModeType === 'finished-goods'
      ? 'finished-goods'
      : 'material-issue';
  const manualModeHelp =
    currentManualModeType === 'finished-goods' ? FINISHED_GOODS_HELP : MANUAL_ISSUE_HELP;

  const selectableWarehouseItems = useMemo(() => {
    const stockedItems = effectiveStockItems || [];
    const allowZeroStockSelection = !selectedWorkOrder && currentManualModeType === 'finished-goods';
    const stockByCode = new Map(
      stockedItems
        .map((item) => {
          const code = String(item?.kode || '').trim();
          return code ? [code, item] as const : null;
        })
        .filter((entry): entry is readonly [string, any] => Boolean(entry))
    );
    const stockByName = new Map(
      stockedItems
        .map((item) => {
          const name = String(item?.nama || '').trim().toLowerCase();
          return name ? [name, item] as const : null;
        })
        .filter((entry): entry is readonly [string, any] => Boolean(entry))
    );

    const bomItems = (selectedWorkOrder?.bom || [])
      .map((item) => {
        const code = String(item?.kode || '').trim();
        const name = String(item?.nama || item?.materialName || '').trim();
        const stockMatch =
          (code ? stockByCode.get(code) : undefined) ||
          (name ? stockByName.get(name.toLowerCase()) : undefined);
        return {
          id: code || name,
          value: code || name,
          code,
          name,
          unit: String(item?.unit || stockMatch?.satuan || 'Unit'),
          stock: Number(stockMatch?.stok || 0),
          disabled: allowZeroStockSelection ? false : Number(stockMatch?.stok || 0) <= 0,
          source: 'bom' as const,
        };
      })
      .filter((item) => item.id);

    if (bomItems.length > 0) {
      return bomItems.sort((a, b) => a.name.localeCompare(b.name));
    }

    return stockedItems
      .map((item) => ({
        id: String(item?.id || item?.kode || item?.nama || ''),
        value: String(item?.kode || item?.nama || ''),
        code: String(item?.kode || '').trim(),
        name: String(item?.nama || '').trim(),
        unit: String(item?.satuan || 'Unit'),
        stock: Number(item?.stok || 0),
        disabled: allowZeroStockSelection ? false : Number(item?.stok || 0) <= 0,
        source: 'stock' as const,
      }))
      .filter((item) => item.id && item.value)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentManualModeType, effectiveStockItems, selectedWorkOrder]);

  const handleWOSelect = (woId: string) => {
    const wo = effectiveWorkOrders.find(w => w.id === woId);
    if (wo) {
      setNewReport({
        ...newReport,
        woId: wo.id,
        selectedItem: '', // Reset item selection when WO changes
        selectedItemCode: '',
        selectedItemName: '',
        activity: `Produksi ${wo.itemToProduce} (${wo.woNumber})`,
        unit: wo.bom?.[0]?.unit || 'Unit'
      });
    } else {
      setNewReport({
        ...newReport,
        woId: undefined,
        selectedItem: '',
        selectedItemCode: '',
        selectedItemName: '',
        activity: '',
        unit: 'Pcs',
        manualModeType: newReport.manualModeType || DEFAULT_MANUAL_MODE,
      });
    }
  };

  const handleManualModeChange = (mode: 'material-issue' | 'finished-goods') => {
    setNewReport((prev) => ({
      ...prev,
      manualModeType: mode,
      selectedItem: '',
      selectedItemCode: '',
      selectedItemName: '',
      unit: 'Pcs',
      activity: '',
    }));
  };

  const handleItemSelect = (itemValue: string) => {
    const wo = effectiveWorkOrders.find(w => w.id === newReport.woId);
    const normalizedValue = String(itemValue || '').trim();
    const selectedOption = selectableWarehouseItems.find((item) => item.value === normalizedValue);
    if (selectedOption?.disabled) {
      toast.error('Item ini belum tersedia di gudang atau stoknya habis');
      return;
    }
    const itemLabel = selectedOption?.name || normalizedValue;
    if (wo) {
      const bomItem = wo.bom?.find((b) => {
        const bomName = String(b.nama || b.materialName || '').trim();
        const bomCode = String(b.kode || '').trim();
        return bomName === itemLabel || bomCode === normalizedValue;
      });
      setNewReport({
        ...newReport,
        selectedItem: normalizedValue,
        selectedItemCode: selectedOption?.code || normalizedValue,
        selectedItemName: itemLabel,
        unit: bomItem?.unit || selectedOption?.unit || (normalizedValue ? 'Pcs' : 'Unit'),
        activity: normalizedValue
          ? `Pengerjaan ${itemLabel} untuk ${wo.itemToProduce} (${wo.woNumber})`
          : `Produksi ${wo.itemToProduce} (${wo.woNumber})`
      });
    } else {
      setNewReport({
        ...newReport,
        selectedItem: normalizedValue,
        selectedItemCode: selectedOption?.code || normalizedValue,
        selectedItemName: itemLabel,
        unit: selectedOption?.unit || (normalizedValue ? 'Pcs' : 'Unit'),
        activity: normalizedValue
          ? currentManualModeType === 'finished-goods'
            ? `Finished goods ${itemLabel}`
            : `Material issue ${itemLabel}`
          : ''
      });
    }
  };

  const handleAddReport = async () => {
    if (!newReport.workerName || !newReport.activity || !newReport.outputQty) {
      toast.error('Mohon lengkapi data teknisi, aktivitas, dan qty');
      return;
    }

    const selectedWO = effectiveWorkOrders.find(w => w.id === newReport.woId);
    const isManualMode = !selectedWO;
    const manualModeType =
      isManualMode && newReport.manualModeType === 'finished-goods'
        ? 'finished-goods'
        : 'material-issue';
    if (isManualMode && !newReport.selectedItemCode && !newReport.selectedItem) {
      toast.error(
        manualModeType === 'finished-goods'
          ? 'Pilih item gudang untuk finished goods stock in.'
          : 'Pilih item gudang untuk material issue manual.'
      );
      return;
    }

    const report: ProductionReport = {
      id: `lhp-${Date.now()}`,
      tanggal: newReport.tanggal!,
      shift: newReport.shift!,
      workshop: newReport.workshop!,
      workerName: newReport.workerName!,
      activity: newReport.activity!,
      machineNo: newReport.machineId, // Add machineId here
      startTime: newReport.startTime || '08:00',
      endTime: newReport.endTime || '17:00',
      outputQty: Number(newReport.outputQty),
      unit: newReport.unit!,
      remarks: newReport.remarks || 'Selesai',
      photoUrl: newReport.photoUrl,
      photoAssetId: newReport.photoAssetId,
      woNumber: selectedWO?.woNumber,
      manualMode: isManualMode,
      manualModeType: isManualMode ? manualModeType : undefined,
      projectId: selectedWO?.projectId || (isManualMode ? MANUAL_LHP_PROJECT_ID : undefined),
      projectName: selectedWO?.projectName || (isManualMode ? MANUAL_LHP_PROJECT_NAME : undefined),
      selectedItemCode: newReport.selectedItemCode,
      selectedItemName: newReport.selectedItemName,
    };

    // We pass the WO number in a way the AppContext can parse if needed, 
    // but we'll manually ensure the connection here if we could. 
    // Actually addProductionReport in AppContext already handles updating WO by parsing activity.
    // Let's make sure it's clear.
    
    // Add custom field for context update if needed, but let's stick to the current AppContext implementation
    // which looks for WO number in activity.
    const finalReport: ProductionReport = {
      ...report,
      woId: selectedWO?.id,
      selectedItem: newReport.selectedItem
    };

    // Use centralized logic: addProductionReport now handles handleProductionOutput internally
    const ok = await addProductionReport(finalReport);
    if (!ok) return;

    setShowAddModal(false);
    resetForm();
    toast.success(
      isManualMode
        ? manualModeType === 'finished-goods'
          ? 'Finished goods berhasil disimpan. Stok gudang bertambah sesuai item yang dipilih.'
          : 'Material issue manual berhasil disimpan. Stok gudang berkurang sesuai item yang dipilih.'
        : 'LHP berhasil disimpan. Stok bahan baku telah dipotong otomatis dan progress diperbarui!'
    );
  };

  const resetForm = () => {
    setNewReport({
      tanggal: new Date().toISOString().split('T')[0],
      shift: '1',
      workshop: 'Gema Teknik Workshop',
      unit: 'Pcs',
      startTime: '08:00',
      endTime: '17:00',
      selectedItem: '',
      selectedItemCode: '',
      selectedItemName: '',
      manualModeType: DEFAULT_MANUAL_MODE,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File terlalu besar. Maksimal 5MB.');
      return;
    }

    const selectedWO = effectiveWorkOrders.find((wo) => wo.id === newReport.woId);
    const projectId = selectedWO?.projectId || MANUAL_LHP_PROJECT_ID;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploadingPhoto(true);
        const response = await api.post('/media/lhp-photos', {
          projectId,
          workOrderId: selectedWO?.id,
          fileName: file.name,
          dataUrl: reader.result,
        });
        setNewReport((prev) => ({
          ...prev,
          photoUrl: response.data?.publicUrl,
          photoAssetId: response.data?.id,
        }));
        toast.success('Foto LHP berhasil diunggah');
      } catch (error) {
        console.error('Failed to upload LHP photo', error);
        toast.error('Gagal upload foto LHP');
      } finally {
        setUploadingPhoto(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Laporan Harian Produksi (LHP)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              {isFinishedGoodsFlow ? 'Flow Barang Jadi Siap Masuk Monitoring Gudang' : 'Workshop Progress & Productivity Logs'}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap lg:w-auto">
          <button
            onClick={() => fetchServerData(false)}
            disabled={syncing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
          >
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
          <Link 
            to="/produksi/guide"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-black sm:w-auto"
          >
            <BookOpen size={18} /> Guide
          </Link>
          <button 
            onClick={() => {
              window.print();
              toast.success('Laporan siap disimpan sebagai PDF.');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 sm:w-auto"
          >
            <Printer size={18} />
            Export PDF
          </button>
          <button 
            onClick={async () => {
              if (effectiveReports.length === 0) {
                toast.error('Belum ada laporan untuk diekspor');
                return;
              }
              const report = effectiveReports[0];
              const id = String((report as any)?.__entityId || report?.id || '').trim();
              if (!id) {
                toast.error('ID laporan produksi tidak valid');
                return;
              }
              try {
                const response = await api.get(`/exports/production-reports/${id}/word`, {
                  responseType: 'blob',
                });
                const blob = new Blob([response.data], { type: 'application/msword' });
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = `LHP-${id}.doc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
                toast.success('LHP terbaru berhasil diekspor ke Word');
              } catch {
                toast.error('Gagal export LHP dari backend');
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-blue-600 shadow-sm transition-all hover:bg-blue-50 sm:w-auto"
          >
            <FileDown size={18} />
            Word
          </button>
          <button
            onClick={async () => {
              if (effectiveReports.length === 0) {
                toast.error('Belum ada laporan untuk diekspor');
                return;
              }
              const report = effectiveReports[0];
              const id = String((report as any)?.__entityId || report?.id || '').trim();
              if (!id) {
                toast.error('ID laporan produksi tidak valid');
                return;
              }
              try {
                const response = await api.get(`/exports/production-reports/${id}/excel`, {
                  responseType: 'blob',
                });
                const blob = new Blob([response.data], { type: 'application/vnd.ms-excel' });
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = `LHP-${id}.xls`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
                toast.success('LHP terbaru berhasil diekspor ke Excel');
              } catch {
                toast.error('Gagal export LHP Excel dari backend');
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 sm:w-auto"
          >
            <Download size={18} />
            Excel
          </button>
          <button 
            onClick={() => {
              resetForm();
              if (isFinishedGoodsFlow) {
                setNewReport((prev) => ({
                  ...prev,
                  manualModeType: 'finished-goods',
                  woId: '',
                }));
              }
              setShowAddModal(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-200 transition-all active:scale-95 hover:bg-rose-700 sm:w-auto"
          >
            <Plus size={18} />
            {isFinishedGoodsFlow ? 'Input Hasil Produksi' : 'Input LHP Baru'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-50 bg-slate-50/30 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Laporan (Teknisi/Aktivitas)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm font-bold border border-slate-200 focus:border-rose-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Updates Enabled</span>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={16} />
              <span className="text-xs font-bold uppercase">Januari 2026</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal & Shift</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Worker</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aktivitas / Work Order</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Output</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Evidence</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <tr key={report.id} className="group hover:bg-rose-50/20 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900">{report.tanggal}</span>
                        <span className="text-[10px] text-rose-600 font-bold uppercase">Shift {report.shift}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-black text-xs">
                          {String(report.workerName || "?").charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{report.workerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 leading-tight">{report.activity}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Workshop: {report.workshop}</span>
                          {report.manualMode && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                report.manualModeType === 'finished-goods'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {report.manualModeType === 'finished-goods'
                                ? FINISHED_GOODS_LABEL
                                : MANUAL_ISSUE_LABEL}
                            </span>
                          )}
                          {report.machineNo && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black">
                                {effectiveAssets.find(a => a.id === report.machineNo || a.assetCode === report.machineNo)?.name || report.machineNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-blue-600">+{report.outputQty}</span>
                        <span className="text-[9px] text-slate-400 font-black uppercase">{report.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {report.photoUrl ? (
                        <button 
                          onClick={() => setSelectedPhoto(report.photoUrl!)}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-rose-500 transition-all inline-block group-hover:scale-110"
                        >
                          <ImageWithFallback src={report.photoUrl} alt="Hasil Kerja" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 mx-auto">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                        {report.remarks || 'Success'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <ClipboardList size={48} />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Belum ada laporan aktivitas hari ini.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white md:col-span-2 shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-black uppercase italic italic tracking-tight">Kapasitas Produksi Harian</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Output</p>
              <p className="text-2xl font-black">{effectiveReports.reduce((sum, r) => sum + r.outputQty, 0)} <span className="text-xs text-slate-500 font-bold uppercase">Unit</span></p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mesin Beroperasi</p>
              <p className="text-2xl font-black">{new Set(effectiveReports.filter(r => r.machineNo).map(r => r.machineNo)).size} <span className="text-xs text-slate-500 font-bold uppercase">Unit</span></p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Teknisi Aktif</p>
              <p className="text-2xl font-black">{new Set(effectiveReports.map(r => r.workerName)).size} <span className="text-xs text-slate-500 font-bold uppercase">Orang</span></p>
            </div>
          </div>
        </div>
        
        <div className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-2">Automated Progress</h3>
            <p className="text-xs text-rose-700/70 font-medium leading-relaxed">Setiap laporan yang Anda input akan langsung memproses persentase di Timeline & Tracker secara otomatis tanpa intervensi manual.</p>
          </div>
          <Link 
            to="/produksi/timeline"
            className="w-full py-4 bg-white text-rose-600 rounded-2xl text-[10px] font-black uppercase shadow-sm border border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
          >
            Lihat Tracker Detail <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Modal Tambah LHP */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative z-10 my-3 flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl sm:my-0 sm:max-h-[90vh]">
            <div className="sticky top-0 flex flex-col gap-4 border-b border-slate-100 bg-white p-5 sm:p-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Buat Laporan Harian (LHP)</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                  {newReport.woId
                    ? 'Input Progress Pekerjaan Workshop'
                    : currentManualModeType === 'finished-goods'
                      ? 'Mode finished goods stock in / stok masuk gudang'
                      : 'Mode material issue manual / stok keluar gudang'}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button 
                  onClick={() => {
                    setNewReport({
                      ...newReport,
                      woId: effectiveWorkOrders.find(wo => wo.woNumber === 'WO-2026-001')?.id,
                      workerName: 'Soleh',
                      activity: 'Cutting Plate S-400 untuk PT Mustika (WO-2026-001)',
                      machineId: 'M-01',
                      outputQty: 200,
                      unit: 'Pcs',
                      remarks: 'Selesai tepat waktu',
                      workshop: 'Gema Teknik Workshop'
                    });
                    toast.success('Data dari Foto LHP berhasil disimulasikan!');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase text-emerald-600 transition-all hover:bg-emerald-100 sm:w-auto"
                >
                  <Camera size={14} /> Simulasi dari Foto
                </button>
                <button onClick={() => setShowAddModal(false)} className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 sm:w-10">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-6 p-5 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Order</label>
                  <select 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                    value={newReport.woId || ''}
                    onChange={(e) => handleWOSelect(e.target.value)}
                  >
                    <option value="">-- Tanpa WO / Manual --</option>
                    {activeWorkOrders.map(wo => (
                      <option key={wo.id} value={wo.id}>{wo.woNumber}</option>
                    ))}
                  </select>
                </div>
                {!newReport.woId && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flow Manual</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                      value={currentManualModeType}
                      onChange={(e) => handleManualModeChange(e.target.value as 'material-issue' | 'finished-goods')}
                    >
                      <option value="material-issue">{MANUAL_ISSUE_LABEL}</option>
                      <option value="finished-goods">{FINISHED_GOODS_LABEL}</option>
                    </select>
                  </div>
                )}
                {/* WO Stats Preview */}
                {newReport.woId && (
                  <div className="flex flex-col gap-4 rounded-2xl border-2 border-blue-100 bg-blue-50 p-4 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                     {(() => {
                       const wo = effectiveWorkOrders.find(w => w.id === newReport.woId);
                       const selectedBOMItem = wo?.bom?.find(b => b.nama === newReport.selectedItem);
                       
                       // Priority: selected item target, then wo targetQty
                       const target = selectedBOMItem ? selectedBOMItem.qty : (wo?.targetQty || 0);
                       const current = selectedBOMItem ? (selectedBOMItem.completedQty || 0) : (wo?.completedQty || 0);
                       const unit = selectedBOMItem ? selectedBOMItem.unit : (wo?.bom?.[0]?.unit || 'Unit');
                       const progress = Math.min(100, (current / (target || 1)) * 100);

                       return (
                         <>
                           <div>
                              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Target Produksi</p>
                              <p className="text-xl font-black text-slate-900">
                                {target} 
                                <span className="text-xs text-slate-500 font-bold ml-1 uppercase">{unit}</span>
                              </p>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Tercapai (Current)</p>
                              <p className="text-xl font-black text-emerald-700">
                                {current}
                              </p>
                           </div>
                           <div className="h-10 w-px bg-blue-100 mx-2"></div>
                           <div className="flex-1 max-w-[120px]">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Progress {newReport.selectedItem ? 'Item' : 'Overall'}
                              </p>
                              <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                                 <div 
                                   className="h-full bg-blue-600 transition-all duration-500" 
                                   style={{ width: `${progress}%` }}
                                 ></div>
                              </div>
                           </div>
                         </>
                       );
                     })()}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mesin / Alat</label>
                  <select 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-500 transition-colors outline-none"
                    value={newReport.machineId || ''}
                    onChange={(e) => setNewReport({ ...newReport, machineId: e.target.value })}
                  >
                    <option value="">-- Tanpa Mesin --</option>
                    {availableAssets.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.assetCode || m.id} ({m.status || 'Unknown'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Item (Gudang)</label>
                  <select 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                    value={newReport.selectedItem || ''}
                    onChange={(e) => handleItemSelect(e.target.value)}
                  >
                    <option value="">
                      {newReport.woId
                        ? '-- Pilih Item Gudang --'
                        : currentManualModeType === 'finished-goods'
                          ? '-- Pilih Item Finished Goods --'
                          : '-- Pilih Item untuk Material Issue --'}
                    </option>
                    {newReport.woId && <option value="auto">-- Auto-Deduct All BOM (opsional) --</option>}
                    {selectableWarehouseItems.map((item) => (
                      <option key={item.id} value={item.value} disabled={item.disabled}>
                        {item.name} ({item.code || '-'} • Stok {item.stock} {item.unit}{item.disabled ? ' • HABIS' : ''})
                      </option>
                    ))}
                  </select>
                  {!newReport.woId && (
                    <div
                      className={`space-y-2 rounded-2xl px-4 py-3 ${
                        currentManualModeType === 'finished-goods'
                          ? 'border border-emerald-200 bg-emerald-50'
                          : 'border border-amber-200 bg-amber-50'
                      }`}
                    >
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          currentManualModeType === 'finished-goods' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {currentManualModeType === 'finished-goods'
                          ? `${FINISHED_GOODS_LABEL}: qty output akan dicatat sebagai stok masuk / barang jadi.`
                          : `${MANUAL_ISSUE_LABEL}: qty output akan dipakai sebagai stok keluar / material issue.`}
                      </p>
                      <p
                        className={`text-[11px] font-medium leading-relaxed ${
                          currentManualModeType === 'finished-goods' ? 'text-emerald-800' : 'text-amber-800'
                        }`}
                      >
                        {manualModeHelp}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          to="/inventory/stock-out"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          Buka Stock Out
                        </Link>
                        <Link
                          to="/inventory/stock-in"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          Barang Jadi? Pakai Stock In
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift & Tanggal</label>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                      value={newReport.shift}
                      onChange={(e) => setNewReport({ ...newReport, shift: e.target.value })}
                    >
                      <option value="1">Shift 1</option>
                      <option value="2">Shift 2</option>
                      <option value="3">Shift 3</option>
                    </select>
                    <input 
                      type="date" 
                      className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                      value={newReport.tanggal}
                      onChange={(e) => setNewReport({ ...newReport, tanggal: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Aktivitas Pekerjaan</label>
                <textarea 
                  rows={3}
                  placeholder="Detail progres yang dikerjakan hari ini..."
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none resize-none"
                  value={newReport.activity || ''}
                  onChange={(e) => setNewReport({ ...newReport, activity: e.target.value })}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Teknisi Pelaksana</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Contoh: Soleh / Team A"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                      value={newReport.workerName || ''}
                      onChange={(e) => setNewReport({ ...newReport, workerName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Workshop / Lokasi</label>
                  <select 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                    value={newReport.workshop}
                    onChange={(e) => setNewReport({ ...newReport, workshop: e.target.value })}
                  >
                    <option value="Gema Teknik Workshop">Gema Teknik Workshop</option>
                    <option value="Project Site">Project Site</option>
                    <option value="External Workshop">External Workshop</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasil Output (Qty)</label>
                  <div className="relative">
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.outputQty || ''}
                      onChange={(e) => setNewReport({ ...newReport, outputQty: e.target.value })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">{newReport.unit}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Status</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Selesai / Kurang Material"
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-500 transition-colors outline-none"
                    value={newReport.remarks || ''}
                    onChange={(e) => setNewReport({ ...newReport, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                    {newReport.photoUrl ? (
                      <ImageWithFallback src={newReport.photoUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Camera size={24} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Evidence Foto Hasil</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Wajib diunggah untuk verifikasi QC</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={triggerCamera}
                  disabled={uploadingPhoto}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-black sm:w-auto"
                >
                  {uploadingPhoto ? 'UPLOAD...' : newReport.photoUrl ? 'GANTI FOTO' : 'AMBIL FOTO'}
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-4 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:p-8">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={handleAddReport}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all flex items-center justify-center gap-2"
              >
                <ClipboardList size={16} />
                {newReport.woId
                  ? 'SIMPAN & UPDATE PROGRESS'
                  : currentManualModeType === 'finished-goods'
                    ? 'SIMPAN FINISHED GOODS'
                    : 'SIMPAN MATERIAL ISSUE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Foto Fullscreen */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md sm:p-8" onClick={() => setSelectedPhoto(null)}>
          <div className="max-w-4xl w-full relative" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedPhoto(null)} className="absolute -top-12 right-0 text-white flex items-center gap-2 font-black uppercase text-xs">
               Close <X size={20} />
             </button>
             <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
                <ImageWithFallback src={selectedPhoto} alt="Hasil Kerja Full" className="w-full h-full object-contain bg-black" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
