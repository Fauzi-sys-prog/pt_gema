import { useEffect, useState } from 'react'; import { Plus, Search, Package, ArrowDownRight, X, Eye, FileText, History, Download } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { StockOut } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner@2.0.3";
import api from '../../services/api';
import { normalizeEntityRows } from '../../utils/normalizeEntityRows';
// Logo asset from user screenshot 1
import logoGema from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

export default function StockOutPage() {
  const navigate = useNavigate();
  const { 
    stockOutList: ctxStockOutList, 
    stockItemList: ctxStockItemList, 
    stockMovementList: ctxStockMovementList,
    createStockOut,
    updateProject,
    currentUser,
    projectList: ctxProjectList,
    workOrderList
  } = useApp();
  const [serverStockOutList, setServerStockOutList] = useState<StockOut[] | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<typeof ctxStockItemList | null>(null);
  const [serverStockMovementList, setServerStockMovementList] = useState<typeof ctxStockMovementList | null>(null);
  const [serverProjectList, setServerProjectList] = useState<typeof ctxProjectList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const stockOutList = serverStockOutList ?? ctxStockOutList;
  const stockItemList = serverStockItemList ?? ctxStockItemList;
  const stockMovementList = serverStockMovementList ?? ctxStockMovementList;
  const projectList = serverProjectList ?? ctxProjectList;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStockOut, setSelectedStockOut] = useState<StockOut | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);

  const fetchStockOutSources = async () => {
    try {
      setIsRefreshing(true);
      const [stockOutRes, stockItemRes, stockMovementRes, projectRes] = await Promise.all([
        api.get('/inventory/stock-outs'),
        api.get('/inventory/items'),
        api.get('/inventory/movements'),
        api.get('/projects'),
      ]);
      setServerStockOutList(normalizeEntityRows<StockOut>(stockOutRes.data));
      setServerStockItemList(normalizeEntityRows<any>(stockItemRes.data));
      setServerStockMovementList(normalizeEntityRows<any>(stockMovementRes.data));
      setServerProjectList(Array.isArray(projectRes.data) ? projectRes.data : []);
    } catch {
      setServerStockOutList(null);
      setServerStockItemList(null);
      setServerStockMovementList(null);
      setServerProjectList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStockOutSources();
  }, []);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    type: 'Project Issue' as StockOut['type'],
    noWorkOrder: '',
    penerima: '',
    items: [{ kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '' }],
    notes: '',
  });

  const exportToWord = async () => {
    if (!selectedStockOut) return;
    const stockOutId = String((selectedStockOut as any).__entityId || selectedStockOut.id || "").trim();
    if (!stockOutId) {
      toast.error("ID Stock Out tidak valid untuk export.");
      return;
    }
    try {
      const safeNo = String(selectedStockOut.noStockOut || stockOutId).replace(/[^\w.-]+/g, "_");
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/stock-outs/${stockOutId}/word`, { responseType: "blob" }),
        api.get(`/exports/stock-outs/${stockOutId}/excel`, { responseType: "blob" }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: "application/msword" });
      const excelBlob = new Blob([excelResponse.data], { type: "application/vnd.ms-excel" });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `StockOut_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `StockOut_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);
      toast.success("File Word + Excel berhasil diunduh.");
    } catch {
      toast.error("Export Word + Excel Stock Out gagal.");
    }
  };

  const filteredStockOut = stockOutList.filter(so => {
    const noStockOut = so.noStockOut || so.id || '';
    const wo = so.noWorkOrder || '';
    const penerima = so.penerima || '';
    const keyword = String(searchTerm || '').toLowerCase();
    
    const matchSearch = String(noStockOut).toLowerCase().includes(keyword) ||
      String(wo).toLowerCase().includes(keyword) ||
      String(penerima).toLowerCase().includes(keyword) ||
      (so.items || []).some(item => String(item.nama || '').toLowerCase().includes(keyword));
      
    const matchType = filterType === 'all' || so.type === filterType;
    return matchSearch && matchType;
  });

  const resolveWorkOrderRef = (ref?: string) => {
    const key = String(ref || '').trim();
    if (!key || key === 'GENERAL') return undefined;
    return workOrderList.find((wo) => {
      const candidates = [wo.id, (wo as any).woNumber, (wo as any).number]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      return candidates.includes(key);
    });
  };

  const resolveProjectByWorkOrderRef = (ref?: string) => {
    const key = String(ref || '').trim();
    if (!key || key === 'GENERAL') return undefined;
    const linkedWO = resolveWorkOrderRef(key);
    if (linkedWO?.projectId) {
      return projectList.find((p) => p.id === linkedWO.projectId);
    }
    return projectList.find((p) => p.id === key || p.kodeProject === key);
  };

  const actorRoleLabel = String(currentUser?.role || 'USER').trim().toUpperCase() || 'USER';
  const hasExpiredDate = (value?: string) => Boolean(value) && new Date(value as string) < new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validations
    const linkedWO = resolveWorkOrderRef(formData.noWorkOrder);
    const project = resolveProjectByWorkOrderRef(formData.noWorkOrder);
    
    for (const item of formData.items) {
      const match = stockItemList.find(s => s.kode === item.kode);
      
      // Stock availability check
      if (match && match.stok < item.qty) {
        toast.error(`Stok tidak mencukupi untuk ${item.nama}. Sisa: ${match.stok}`);
        return;
      }

      // Expiry check
      if (match && match.expiryDate && new Date(match.expiryDate) < new Date()) {
        toast.error(`❌ Material ${item.nama} sudah EXPIRED (${match.expiryDate}). Tidak boleh dikeluarkan!`);
        return;
      }

      // BOQ Budget Overrun Warning
      if (project && project.boq) {
        const boqItem = project.boq.find(b => b.itemKode === item.kode || b.materialName.toLowerCase() === item.nama.toLowerCase());
        if (boqItem && item.qty > boqItem.qtyEstimate) {
          const proceed = window.confirm(`⚠️ Warning: Jumlah pengeluaran (${item.qty} ${item.unit}) melebihi estimasi RAB/BOQ (${boqItem.qtyEstimate} ${boqItem.unit}).\n\nHal ini akan berdampak pada margin proyek. Lanjutkan?`);
          if (!proceed) return;
        }
      }
    }

    // 2. Prepare Data
    const stockOut: StockOut = {
      id: `SO-${Date.now()}`,
      noStockOut: `SO-${new Date().getFullYear()}-${String(stockOutList.length + 1).padStart(3, '0')}`,
      noWorkOrder: formData.noWorkOrder,
      workOrderId: linkedWO?.id,
      projectId: project?.id,
      projectName: project?.namaProject,
      penerima: formData.penerima,
      tanggal: formData.tanggal,
      type: formData.type,
      status: 'Posted',
      createdBy: actorRoleLabel,
      items: formData.items.filter(item => item.nama && item.qty > 0),
      notes: formData.notes,
    };
    
    // 3. Execution (Centralized in AppContext)
    try {
      await createStockOut(stockOut);
      setServerStockOutList((prev) => (prev ? [stockOut, ...prev] : prev));
    
      // 4. Update BOQ Status if applicable
      if (project && project.boq) {
        const updatedBOQ = project.boq.map(boqItem => {
          const matchedItem = formData.items.find(pi => 
            (pi.kode && pi.kode === boqItem.itemKode) || 
            (pi.nama.toLowerCase() === boqItem.materialName.toLowerCase())
          );
          
          if (matchedItem) {
            return { ...boqItem, status: 'Used' as const };
          }
          return boqItem;
        });
        updateProject(project.id, { boq: updatedBOQ });
      }

      toast.success("Jurnal stok keluar berhasil diposting.");
      setShowModal(false);
      resetForm();
    } catch {
      // toast handled in AppContext
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      type: 'Project Issue',
      noWorkOrder: '',
      penerima: '',
      items: [{ kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '' }],
      notes: '',
    });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '' }],
    });
  };

  const removeItemRow = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'kode') {
      const stockItem = stockItemList.find(
        (s) => String(s.kode || '').toLowerCase() === String(value || '').toLowerCase()
      );
      if (stockItem) {
        updatedItems[index].nama = stockItem.nama;
        updatedItems[index].unit = stockItem.satuan;
        updatedItems[index].lokasi = stockItem.lokasi;
        
        // 🔥 FEFO LOGIC: Find oldest unconsumed batch that isn't expired
        const batchMovements = stockMovementList
          .filter(m => m.itemKode === stockItem.kode && m.type === 'IN' && m.batchNo && m.batchNo !== '-')
          .sort((a, b) => {
            // Priority 1: Expiry Date (if available)
            if (a.expiryDate && b.expiryDate) {
              return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }
            // Priority 2: Arrival Date (FIFO if no expiry)
            return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
          });
          
        if (batchMovements.length > 0) {
          const recommendedBatch = batchMovements[0];
          updatedItems[index].batchNo = recommendedBatch.batchNo || '';
          
          if (recommendedBatch.expiryDate) {
            const expDate = new Date(recommendedBatch.expiryDate);
            const today = new Date();
            const daysDiff = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < 0) {
               toast.error(`⚠️ BATCH TERDETEKSI EXPIRED: ${recommendedBatch.batchNo} (${recommendedBatch.expiryDate})`);
            } else if (daysDiff < 30) {
               toast.warning(`⚠️ BATCH DEKAT EXPIRED: ${recommendedBatch.batchNo} dalam ${daysDiff} hari!`);
            }
          }
        }
      }
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 opacity-50" />
        
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200 rotate-3">
            <ArrowDownRight size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight italic uppercase">Stok Keluar (Outbound)</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Project Issue & material release</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchStockOutSources()}
            disabled={isRefreshing}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={() => navigate('/inventory/stock-journal')}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <History size={18} /> Mutasi
          </button>
          <button 
            onClick={() => setShowModal(true)}
          className="relative px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus size={20} /> Entry Stok Keluar
        </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari No Jurnal, WO, atau Penerima..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 outline-none"
          >
            <option value="all">Semua Tipe</option>
            <option value="Project Issue">Pemakaian Proyek</option>
            <option value="Sales">Penjualan</option>
            <option value="Adjustment">Penyesuaian</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No Jurnal</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No WO / Proyek</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Penerima</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Item</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStockOut.map((so) => (
                <tr key={so.id} className="hover:bg-slate-50/80 transition-all">
                  <td className="px-8 py-5 font-black text-slate-900 italic tracking-tight">{so.noStockOut}</td>
                  <td className="px-8 py-5 font-bold text-slate-500 uppercase text-xs">
                    {so.noWorkOrder || '-'}
                    {so.projectId && projectList.find(p => p.id === so.projectId)?.namaProject && (
                      <span className="block text-[9px] text-blue-500 normal-case italic">
                        {projectList.find(p => p.id === so.projectId)?.namaProject}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 font-bold text-slate-900 uppercase text-xs">{so.penerima || '-'}</td>
                  <td className="px-8 py-5 text-slate-500 font-bold text-sm">
                    {new Date(so.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-8 py-5 text-slate-900 font-black text-sm italic">
                    {so.items?.length || 0} SKU
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button
                      onClick={() => { setSelectedStockOut(so); setShowDetailModal(true); }}
                      className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all mx-auto"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-center z-10">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Entry Stok Keluar Baru</h3>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between">
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-3">Project / Work Order</label>
                  <div className="flex gap-2">
                    <select 
                      value={formData.noWorkOrder} 
                      onChange={(e) => setFormData({ ...formData, noWorkOrder: e.target.value })} 
                      className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic uppercase tracking-tighter outline-none focus:border-indigo-500 transition-colors" 
                      required
                    >
                      <option value="">-- Pilih Proyek / WO --</option>
                      <option value="GENERAL">PENGELUARAN UMUM (NON-PROYEK)</option>
                      {workOrderList.map((wo) => (
                        <option key={wo.id} value={wo.id}>
                          {String((wo as any).woNumber || wo.id)} - {wo.projectName || '-'}
                        </option>
                      ))}
                      {projectList.map(p => (
                        <option key={p.id} value={p.kodeProject || p.id}>
                          {p.kodeProject} - {p.namaProject || p.customer}
                        </option>
                      ))}
                    </select>
                    {formData.noWorkOrder && formData.noWorkOrder !== 'GENERAL' && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const project = resolveProjectByWorkOrderRef(formData.noWorkOrder);
                          if (project && project.boq) {
                            const boqItems = project.boq
                              .filter(item => item.status !== 'Used')
                              .map(item => ({
                                kode: item.itemKode || '',
                                nama: item.materialName,
                                qty: item.qtyEstimate,
                                unit: item.unit,
                                lokasi: 'Gudang Utama',
                                batchNo: ''
                              }));
                            
                            if (boqItems.length > 0) {
                              setFormData(prev => ({ ...prev, items: boqItems }));
                              toast.success(`Berhasil menarik ${boqItems.length} item dari BOQ Proyek.`);
                            } else {
                              toast.warning("Tidak ada item BOQ yang tersedia untuk dikeluarkan.");
                            }
                          }
                        }}
                        className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black italic uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200 shrink-0"
                      >
                        <Package size={14} className="text-indigo-400" /> Tarik BOQ
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-3">Nama Penerima</label>
                  <input type="text" value={formData.penerima} onChange={(e) => setFormData({ ...formData, penerima: e.target.value })} className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic uppercase tracking-tighter outline-none focus:border-indigo-500 transition-colors" placeholder="Nama Personel" required />
                </div>
                <div className="flex-1 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-3">Tanggal Pengeluaran</label>
                  <input type="date" value={formData.tanggal} onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })} className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic outline-none focus:border-indigo-500 transition-colors" required />
                </div>
                <div className="flex-1 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-3">Tipe Transaksi</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as StockOut['type'] })} className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic uppercase tracking-tighter outline-none focus:border-indigo-500 transition-colors" required >
                    <option value="Project Issue">Pemakaian Proyek</option>
                    <option value="Sales">Penjualan</option>
                    <option value="Adjustment">Penyesuaian (Opname)</option>
                  </select>
                </div>
              </div>

              {/* REAL-TIME COST IMPACT (Executive Feature) */}
              <div className="bg-indigo-900 p-6 rounded-[2rem] text-white flex justify-between items-center shadow-xl shadow-indigo-100 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-1">Estimated Material Cost Release</p>
                   <p className="text-2xl font-black italic tracking-tighter">
                     Rp {formData.items.reduce((sum, item) => {
                       const master = stockItemList.find(s => s.kode === item.kode);
                       return sum + (item.qty * (master?.hargaSatuan || 0));
                     }, 0).toLocaleString('id-ID')}
                   </p>
                </div>
                <div className="text-right relative z-10">
                   <p className="text-[9px] font-bold uppercase text-indigo-400">Project Target</p>
                   <p className="text-xs font-black uppercase italic">{formData.noWorkOrder || 'GENERAL ISSUE'}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4 px-2">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Daftar Barang yang Dikeluarkan</h4>
                  <button type="button" onClick={addItemRow} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Plus size={14} /> Tambah Baris
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <div className="col-span-3">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex justify-between">
                          SKU
                          <div className="flex gap-1">
                            {item.kode && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                                (stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.stok || 0) > 0 
                                  ? 'bg-emerald-50 text-emerald-600' 
                                  : 'bg-rose-50 text-rose-600'
                              }`}>
                                Stok: {stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.stok || 0}
                              </span>
                            )}
                            {item.kode && stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.expiryDate && (
                               <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                                 hasExpiredDate(stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.expiryDate)
                                   ? 'bg-rose-600 text-white' 
                                   : 'bg-blue-50 text-blue-600'
                               }`}>
                                 Exp: {stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.expiryDate}
                               </span>
                            )}
                          </div>
                        </label>
                        <input 
                          list="stock-items-list" 
                          type="text" 
                          value={item.kode} 
                          onChange={(e) => updateItem(index, 'kode', e.target.value)} 
                          className={`w-full px-4 py-2.5 bg-white border-2 rounded-xl text-xs font-bold outline-none transition-all ${
                            item.kode && (stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.stok || 0) <= 0
                              ? 'border-rose-300 focus:border-rose-500 text-rose-700 bg-rose-50/30'
                              : item.kode && stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.expiryDate && hasExpiredDate(stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.expiryDate)
                                ? 'border-rose-600 bg-rose-50'
                                : stockItemList.some(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())
                                  ? 'border-emerald-200 focus:border-emerald-500 text-emerald-700'
                                  : 'border-slate-100 focus:border-indigo-500'
                          }`} 
                          placeholder="Kode" 
                          required 
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Deskripsi Barang</label>
                        <input type="text" value={item.nama} onChange={(e) => updateItem(index, 'nama', e.target.value)} className="w-full px-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-colors" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Batch #</label>
                        <input type="text" value={item.batchNo} onChange={(e) => updateItem(index, 'batchNo', e.target.value)} className="w-full px-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-colors" placeholder="Lot (Optional)" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Qty</label>
                        <input 
                          type="number" 
                          value={item.qty || ''} 
                          onChange={(e) => updateItem(index, 'qty', Number(e.target.value))} 
                          className={`w-full px-4 py-2.5 bg-white border-2 rounded-xl text-xs font-black outline-none transition-all ${
                            item.kode && item.qty > (stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.stok || 0)
                              ? 'border-rose-400 text-rose-600 focus:border-rose-600'
                              : (resolveProjectByWorkOrderRef(formData.noWorkOrder)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) > 0 && item.qty > (resolveProjectByWorkOrderRef(formData.noWorkOrder)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0)
                                ? 'border-amber-400 text-amber-600'
                                : 'border-slate-100 focus:border-indigo-500'
                          }`}
                          required 
                        />
                        {item.kode && item.qty > (stockItemList.find(s => String(s.kode || '').toLowerCase() === String(item.kode || '').toLowerCase())?.stok || 0) && (
                          <span className="absolute text-[7px] text-rose-500 font-bold uppercase mt-1">Stok Kurang!</span>
                        )}
                        {(resolveProjectByWorkOrderRef(formData.noWorkOrder)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) > 0 && item.qty > (resolveProjectByWorkOrderRef(formData.noWorkOrder)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) && (
                          <span className="absolute text-[7px] text-amber-500 font-bold uppercase mt-1">Melebihi BOQ!</span>
                        )}
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Satuan</label>
                        <input type="text" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-colors" required />
                      </div>
                      <div className="col-span-1">
                        <button type="button" onClick={() => removeItemRow(index)} className="w-full h-10 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-30" disabled={formData.items.length === 1}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Keterangan / Tujuan Penggunaan</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none h-24 resize-none focus:border-indigo-500 transition-colors" placeholder="Contoh: Digunakan untuk proyek perbaikan Kiln 1..." />
              </div>

              <datalist id="stock-items-list">
                {stockItemList.map(item => (
                  <option key={item.id} value={item.kode}>
                    {item.nama} ({item.stok} {item.satuan})
                  </option>
                ))}
              </datalist>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100">Posting Pengeluaran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedStockOut && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Detail Pengeluaran</h3>
                <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-1">{selectedStockOut.noStockOut}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tgl Keluar</p>
                  <p className="font-black text-slate-900 italic">{new Date(selectedStockOut.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">No Work Order</p>
                  <p className="font-black text-slate-900 italic uppercase">{selectedStockOut.noWorkOrder || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Penerima</p>
                  <p className="font-black text-slate-900 italic uppercase">{selectedStockOut.penerima}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                  <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded">POSTED</span>
                </div>
              </div>
              
              <div className="border border-slate-100 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">SKU / Nama</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedStockOut.items?.map((item, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-900 italic uppercase">{item.nama}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{item.kode}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-rose-600 italic">-{item.qty}</span>
                          <span className="ml-1 text-[9px] font-black text-slate-300 uppercase">{item.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedStockOut.notes && (
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Catatan:</p>
                  <p className="text-xs font-bold text-slate-600">{selectedStockOut.notes}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowPrintView(true)}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-black transition-all"
                >
                  <FileText size={16} /> Cetak Surat Jalan
                </button>
                <button onClick={() => setShowDetailModal(false)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print View Overlay */}
      {showPrintView && selectedStockOut && (
        <div className="fixed inset-0 bg-white z-[200] overflow-auto p-8 md:p-16 print:p-0">
          <div className="max-w-4xl mx-auto border border-slate-100 p-12 shadow-xl print:shadow-none print:border-none font-sans text-black bg-white">
            {/* Layout matches Screenshot 2 */}
            {/* Row 1: Logo & Title */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col">
                <img src={logoGema} alt="Logo" className="w-28 h-auto mb-4" />
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-bold text-black uppercase">SURAT JALAN</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest -mt-1">Delivery Order</p>
              </div>
            </div>

            {/* Row 2 & 3: Company Name & Address */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-black mb-1">PT GEMA TEKNIK PERKASA</h2>
              <div className="text-[11px] font-medium text-slate-800 leading-tight">
                General Contractor & Industrial Maintenance Service<br/>
                Office: Central Industrial Park, Sidoarjo, Indonesia
              </div>
            </div>

            {/* Row 4, 5, 6: Info Grid */}
            <div className="grid grid-cols-2 gap-x-12 mb-10 text-sm font-bold text-black">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase text-slate-500">Kepada Yth:</p>
                  <p className="text-2xl font-bold uppercase">{selectedStockOut.penerima}</p>
                </div>
                <div className="pt-2">
                  <p className="uppercase italic">PROYEK: {selectedStockOut.noWorkOrder || '-'}</p>
                </div>
              </div>
              <div className="space-y-6 text-right flex flex-col items-end pt-1">
                <div className="flex gap-4">
                  <span className="uppercase">No. Dokumen:</span>
                  <span className="font-normal">{selectedStockOut.noStockOut}</span>
                </div>
                <div className="flex gap-4">
                  <span className="uppercase">Tanggal:</span>
                  <span className="font-normal">{new Date(selectedStockOut.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Item Table */}
            <div className="border-[2px] border-black">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border-r border-black px-4 py-4 text-[11px] font-bold uppercase text-center w-12">No</th>
                    <th className="border-r border-black px-4 py-4 text-[11px] font-bold uppercase text-left">Deskripsi Material / SKU</th>
                    <th className="border-r border-black px-4 py-4 text-[11px] font-bold uppercase text-center w-32">Jumlah</th>
                    <th className="px-4 py-4 text-[11px] font-bold uppercase text-center w-32">Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStockOut.items.map((item, idx) => (
                    <tr key={idx} className="border-t-[2px] border-black">
                      <td className="border-r border-black px-4 py-6 text-sm text-center font-medium">{idx + 1}</td>
                      <td className="border-r border-black px-4 py-6">
                        <p className="text-sm font-bold text-black uppercase">{item.nama}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase mt-2">{item.kode} {item.batchNo ? `| BATCH: ${item.batchNo}` : ''}</p>
                      </td>
                      <td className="border-r border-black px-4 py-6 text-base font-bold text-black text-center">{item.qty}</td>
                      <td className="px-4 py-6 text-sm font-bold text-black text-center uppercase">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div className="mt-4 mb-20 font-bold text-sm">
              <p className="uppercase">Catatan: <span className="font-normal normal-case">{selectedStockOut.notes || '-'}</span></p>
            </div>

            {/* Signature Area matches Screenshot 2 */}
            <div className="grid grid-cols-3 gap-8 text-center mt-auto mb-10">
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-black mb-20 lowercase italic">( {String(selectedStockOut.penerima || '').toLowerCase()} )</p>
                <p className="text-xs font-bold text-black uppercase">Diterima Oleh</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-black mb-20 lowercase italic">( ............................ )</p>
                <p className="text-xs font-bold text-black uppercase">Gudang</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-black mb-20 lowercase italic">( ............................ )</p>
                <p className="text-xs font-bold text-black uppercase">Disetujui Oleh</p>
              </div>
            </div>

            {/* Print Controls - Hidden in print */}
            <div className="flex flex-col md:flex-row gap-4 mt-24 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all"
              >
                <FileText size={20} /> Print Ke PDF / Kertas
              </button>
              <button 
                onClick={exportToWord}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all"
              >
                <Download size={20} className="text-blue-200" /> Export Word + Excel
              </button>
              <button 
                onClick={() => setShowPrintView(false)}
                className="flex-1 py-4 border-2 border-slate-900 text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
