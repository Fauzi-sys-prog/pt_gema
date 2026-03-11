import { useState, useEffect, useMemo } from 'react'; import { useNavigate, useLocation } from 'react-router-dom'; import {    Plus, Search, Eye, Edit, Trash2, FileText, Download, CheckCircle2, Clock, XCircle, AlertCircle, ClipboardList, FileCheck, Calculator, UserCheck, Construction, HardHat, Layers, Zap, ChevronRight, Info, Calendar, X } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Quotation } from '../../contexts/AppContext';
import { toast } from "sonner@2.0.3"
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';

export default function PenawaranPage() {
  const { 
    quotationList = [], 
    addQuotation, 
    updateQuotation, 
    deleteQuotation, 
    addProject, 
    projectList = [], 
    deleteProject,
    dataCollectionList = [],
    currentUser
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation(); // Already imported
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'materials' | 'manpower' | 'equipment' | 'consumables'>('materials');
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveQuotationList = useMemo(() => {
    const merged = new Map<string, Quotation>();
    for (const row of serverQuotationList || []) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      merged.set(key, row);
    }
    for (const row of quotationList || []) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      // Context wins for immediate UI updates after create/update/delete.
      merged.set(key, row);
    }
    return Array.from(merged.values());
  }, [serverQuotationList, quotationList]);

  const [formData, setFormData] = useState({
    noPenawaran: '',
    tanggal: new Date().toISOString().split('T')[0],
    validUntil: '',
    customer: '',
    alamat: '',
    project: '',
    nilai: 0,
    notes: '',
    terminology: 'RAB' as 'RAB' | 'SOW',
    type: 'Project' as 'Direct' | 'Project',
    dataCollectionId: '',
    kotaPenempatan: '',
    untukPerhatian: ''
  });

  const [editableMaterials, setEditableMaterials] = useState<any[]>([]);
  const [editableManpower, setEditableManpower] = useState<any[]>([]);
  const [editableEquipment, setEditableEquipment] = useState<any[]>([]);
  const [editableConsumables, setEditableConsumables] = useState<any[]>([]);

  // Calculate totals
  const subtotal = useMemo(() => {
    const mat = editableMaterials.reduce((sum, i) => sum + ((i.unitPrice || 0) * (i.quantity || 0)), 0);
    const man = editableManpower.reduce((sum, i) => sum + ((i.unitPrice || 0) * (i.quantity || 0) * (i.duration || 1)), 0);
    const eq = editableEquipment.reduce((sum, i) => sum + ((i.unitPrice || 0) * (i.quantity || 0) * (i.duration || 1)), 0);
    const cons = editableConsumables.reduce((sum, i) => sum + ((i.unitPrice || 0) * (i.quantity || 0)), 0);
    return mat + man + eq + cons;
  }, [editableMaterials, editableManpower, editableEquipment, editableConsumables]);

  const ppn = subtotal * 0.11;
  const grandTotal = subtotal + ppn;

  // ✨ NEW: Auto-load Data Collection when navigating from Data Collection page
  useEffect(() => {
    if (location.state?.openQuotationModal && location.state?.selectedDataCollectionId) {
      // Open modal
      setShowModal(true);
      
      // Auto-load data collection
      handleSelectDataCollection(location.state.selectedDataCollectionId);
      
      // Show success toast
      toast.success('🎯 Data Collection loaded! Silakan input harga untuk setiap item.');
      
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchQuotationList = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/quotations');
      const rows = Array.isArray(response.data) ? (response.data as Quotation[]) : [];
      setServerQuotationList(rows);
    } catch {
      setServerQuotationList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotationList();
  }, []);

  const handleSelectDataCollection = (dcId: string) => {
    const dc = dataCollectionList.find((d: any) => d.id === dcId);
    if (dc) {
      setFormData({
        ...formData,
        customer: dc.namaResponden || "",
        alamat: dc.lokasi || "",
        project: `${dc.tipePekerjaan} - ${dc.namaResponden}`,
        dataCollectionId: dc.id,
        notes: dc.notes || ""
      });

      setEditableMaterials(dc.materials?.map((m: any) => ({ ...m, quantity: m.qtyEstimate || 0, unitPrice: 0, unit: m.unit || "Pcs" })) || []);
      setEditableManpower(dc.manpower?.map((mp: any) => ({ ...mp, unitPrice: 0 })) || []);
      setEditableEquipment(dc.equipment?.map((eq: any) => ({ ...eq, unitPrice: 0 })) || []);
      setEditableConsumables(dc.consumables?.map((c: any) => ({ ...c, unitPrice: 0 })) || []);

      toast.info(`Data disinkronkan dari Koleksi ${dc.noKoleksi}`);
    } else {
      setFormData({ ...formData, dataCollectionId: "" });
      setEditableMaterials([]);
      setEditableManpower([]);
      setEditableEquipment([]);
      setEditableConsumables([]);
    }
  };

  const handleExportExcel = async () => {
    if (!filteredData.length) {
      toast.info('Tidak ada data quotation untuk diekspor.');
      return;
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const totalNilai = filteredData.reduce((sum: number, q: any) => sum + Number(q.grandTotal || 0), 0);
    const payload = {
      filename: `quotation-registry-${dateKey}`,
      title: 'Quotation Registry Report',
      subtitle: `Tanggal ${dateKey} | Status ${selectedStatus} | Total quotation ${filteredData.length}`,
      columns: ['No. Penawaran', 'Tanggal', 'Customer', 'Perihal', 'Nilai', 'Status'],
      rows: filteredData.map((q: any) => [
        String(q.nomorQuotation || ''),
        String(q.tanggal || ''),
        String(q.customer?.nama || 'N/A'),
        String(q.perihal || '-'),
        Number(q.grandTotal || 0),
        String(q.status || 'Draft'),
      ]),
      notes: `Ringkasan quotation: total nilai penawaran Rp ${totalNilai.toLocaleString('id-ID')}, hasil export mengikuti filter dan pencarian yang aktif di halaman registry.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Quotation Hub',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `quotation-registry-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `quotation-registry-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Quotation Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Gagal export quotation.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQuo: Quotation = {
      id: `quo-${Date.now()}`,
      nomorQuotation: formData.noPenawaran || `${String(effectiveQuotationList.length + 1).padStart(3, '0')}/QO/GTP/${new Date().getFullYear()}`,
      tanggal: formData.tanggal,
      perihal: formData.project,
      customer: { nama: formData.customer, alamat: formData.alamat },
      subtotal,
      ppn,
      grandTotal,
      status: 'Draft',
      terminology: formData.terminology,
      type: formData.type,
      notes: formData.notes,
      dataCollectionId: formData.dataCollectionId,
      kotaPenempatan: formData.kotaPenempatan,
      untukPerhatian: formData.untukPerhatian,
      materials: editableMaterials,
      manpower: editableManpower,
      equipment: editableEquipment,
      consumables: editableConsumables,
    };
    try {
      await addQuotation(newQuo);
      toast.success("✅ Quotation berhasil dibuat!");
      setShowModal(false);
      resetForm();
    } catch {
      // error toast from AppContext
    }
  };

  const resetForm = () => {
    setFormData({
      noPenawaran: '',
      tanggal: new Date().toISOString().split('T')[0],
      validUntil: '',
      customer: '',
      alamat: '',
      project: '',
      nilai: 0,
      notes: '',
      terminology: 'RAB',
      type: 'Project',
      dataCollectionId: '',
      kotaPenempatan: '',
      untukPerhatian: ''
    });
    setEditableMaterials([]);
    setEditableManpower([]);
    setEditableEquipment([]);
    setEditableConsumables([]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const filteredData = effectiveQuotationList.filter((item: any) => {
    const matchesSearch = 
      (item.nomorQuotation || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.customer?.nama || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.perihal || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Project Quotation Hub</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Commercial & Technical Alignment Center</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchQuotationList}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-sm cursor-pointer"
          >
            <Plus size={16} /> Buat Quotation
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Download size={16} /> Export Word + Excel
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b-2 border-slate-50 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-6 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Approved">Approved (Legacy)</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-6">Quotation No</th>
                <th className="px-8 py-6">Customer & Project</th>
                <th className="px-8 py-6 text-right">Value (IDR)</th>
                <th className="px-8 py-6 text-center">Status</th>
                <th className="px-8 py-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {filteredData.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-all group cursor-pointer">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-900 uppercase italic tracking-tighter">{item.nomorQuotation}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{item.tanggal}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-900 uppercase italic leading-tight mb-1">{item.customer?.nama || 'N/A'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-xs">{item.perihal || '-'}</p>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 italic">
                    {formatCurrency(item.grandTotal || 0)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${
                      item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      item.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      item.status === 'Sent' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                      {item.status || 'Draft'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/penawaran/${item.id}`)} className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 shadow-sm transition-all cursor-pointer">
                        <ChevronRight size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm("Hapus quotation ini?")) return;
                          deleteQuotation(item.id);
                          toast.success("Quotation dihapus");
                        }}
                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-rose-600 shadow-sm transition-all cursor-pointer"
                        title="Hapus quotation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest italic">
                    Belum ada data quotation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Buat Quotation Baru */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-blue-600 px-10 py-8 flex justify-between items-center text-white shrink-0">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Buat Quotation Baru</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-blue-300 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 opacity-80">Sales & Estimator Control System</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all group cursor-pointer">
                  <X size={24} className="group-hover:rotate-90 transition-transform" />
                </button>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                {/* ✨ NEW: Visual Indicator untuk Synced Data Collection */}
                {formData.dataCollectionId && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-[2rem] p-6 mb-8 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500 text-white rounded-2xl shrink-0 shadow-lg">
                        <Zap size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xs font-black text-purple-900 uppercase italic tracking-wider">🔗 Data Collection Tersinkronisasi</h3>
                          <span className="px-3 py-1 bg-purple-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">ACTIVE SYNC</span>
                        </div>
                        <p className="text-[10px] font-bold text-purple-800 uppercase leading-relaxed">
                          Semua data (Materials, Manpower, Equipment, Consumables) sudah di-load otomatis dari Data Collection.
                          <span className="font-black text-purple-900"> Tinggal input harga satuan di tabel bawah!</span>
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Collection ID:</span>
                          <code className="px-3 py-1 bg-white border border-purple-200 rounded-lg text-[10px] font-mono font-bold text-purple-700">
                            {formData.dataCollectionId}
                          </code>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <form id="quoForm" onSubmit={handleSubmit} className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
                    {/* Main Form Fields */}
                    <div className="lg:col-span-2 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Data Collection *</label>
                          <select 
                            value={formData.dataCollectionId}
                            onChange={(e) => handleSelectDataCollection(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase italic focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="">-- Pilih Data Collection --</option>
                            {dataCollectionList.filter((d: any) => d.status === 'Verified' || d.status === 'Completed').map((dc: any) => (
                              <option key={dc.id} value={dc.id}>{dc.noKoleksi} - {dc.namaResponden}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                            <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:border-blue-500" />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Berlaku Sampai</label>
                            <input type="date" value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:border-blue-500" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Quotation *</label>
                          <input type="text" placeholder="QO/GTP/2026/002" value={formData.noPenawaran} onChange={e => setFormData({...formData, noPenawaran: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black italic tracking-wider focus:border-blue-500 outline-none" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Customer</label>
                          <input type="text" placeholder="Contoh: PT. Krakatau Posco" value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perihal / Nama Project</label>
                        <textarea rows={2} placeholder="Perihal quotation" value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none resize-none" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kota Penempatan (DI)</label>
                          <input type="text" placeholder="Contoh: Bekasi" value={formData.kotaPenempatan} onChange={e => setFormData({...formData, kotaPenempatan: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Untuk Perhatian (U/P)</label>
                          <input type="text" placeholder="Nama atau Jabatan PIC" value={formData.untukPerhatian} onChange={e => setFormData({...formData, untukPerhatian: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Terminology Format</label>
                        <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border-2 border-slate-100 w-fit">
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, terminology: 'RAB'})}
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.terminology === 'RAB' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            RAB (Teknis)
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, terminology: 'SOW'})}
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${formData.terminology === 'SOW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            SOW (Komersial)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Calculation Summary Card */}
                    <div className="lg:col-span-1 space-y-6">
                      <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
                          <Calculator size={80} />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-8">Kalkulasi Otomatis (BOQ)</p>
                          <h3 className="text-4xl font-black italic tracking-tighter mb-2">{formatCurrency(subtotal)}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Subtotal Terkalkulasi</p>
                          
                          <div className="mt-12 pt-10 border-t border-white/20 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">PPN 11% Included</span>
                              <span className="text-xs font-black italic">{formatCurrency(ppn)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black uppercase tracking-widest">Total Penawaran</span>
                              <span className="text-xl font-black italic text-blue-200">{formatCurrency(grandTotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-50 border-2 border-amber-100 p-8 rounded-[2.5rem] flex items-start gap-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shrink-0">
                          <Info size={20} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Input Harga Satuan (BOQ SYNC)</p>
                          <p className="text-[10px] font-bold text-amber-900 leading-relaxed uppercase">Sesuaikan harga per item dari data survey lapangan di tabel rincian bawah.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div className="space-y-6">
                    <div className="flex gap-4 border-b-2 border-slate-50">
                      {[
                        { id: 'materials', label: 'Materials', icon: Layers },
                        { id: 'manpower', label: 'Manpower', icon: HardHat },
                        { id: 'equipment', label: 'Equipment', icon: Construction },
                        { id: 'consumables', label: 'Consumables', icon: ClipboardList }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 cursor-pointer ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                          <tab.icon size={14} />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-50/50 rounded-[2.5rem] border-2 border-slate-100 overflow-hidden">
                       <div className="p-8 bg-white border-b-2 border-slate-50 flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-2">
                             <Zap size={14} className="text-blue-600" /> Rincian {activeTab}
                          </h4>
                          <button type="button" className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all cursor-pointer">
                             <Plus size={14} /> Tambah Item
                          </button>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="w-full text-left">
                             <thead>
                                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                   <th className="px-8 py-5">Deskripsi Item</th>
                                   <th className="px-8 py-5 text-center">Qty</th>
                                   <th className="px-8 py-5 text-center">Unit</th>
                                   <th className="px-8 py-5 text-right">Harga Satuan (IDR)</th>
                                   <th className="px-8 py-5 text-right">Total</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y-2 divide-slate-50">
                                {activeTab === 'materials' && editableMaterials.map((item: any, idx: number) => (
                                   <tr key={idx} className="bg-white hover:bg-blue-50/30 transition-all">
                                      <td className="px-8 py-4">
                                         <input type="text" value={item.materialName} onChange={(e) => {
                                           const n = [...editableMaterials]; n[idx].materialName = e.target.value; setEditableMaterials(n);
                                         }} className="w-full bg-transparent font-black text-slate-900 uppercase italic text-xs outline-none" />
                                      </td>
                                      <td className="px-8 py-4 text-center">
                                         <input type="number" value={item.quantity} onChange={(e) => {
                                           const n = [...editableMaterials]; n[idx].quantity = parseFloat(e.target.value); setEditableMaterials(n);
                                         }} className="w-16 bg-transparent font-black text-slate-900 text-center text-xs outline-none" />
                                      </td>
                                      <td className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.unit}</td>
                                      <td className="px-8 py-4 text-right">
                                         <input type="number" value={item.unitPrice} onChange={(e) => {
                                           const n = [...editableMaterials]; n[idx].unitPrice = parseFloat(e.target.value); setEditableMaterials(n);
                                         }} className="w-32 bg-slate-50 px-3 py-1.5 rounded-lg font-black text-blue-600 text-right text-xs outline-none border border-slate-100" />
                                      </td>
                                      <td className="px-8 py-4 text-right font-black text-slate-900 italic text-xs">
                                         {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
                                      </td>
                                   </tr>
                                ))}
                                {((activeTab === 'materials' && editableMaterials.length === 0) || (activeTab === 'manpower' && editableManpower.length === 0) || (activeTab === 'equipment' && editableEquipment.length === 0) || (activeTab === 'consumables' && editableConsumables.length === 0)) && (
                                   <tr>
                                      <td colSpan={5} className="px-8 py-16 text-center">
                                         <p className="text-xs font-black text-slate-300 uppercase italic tracking-widest">Belum ada item {activeTab}. Klik "Tambah Item" atau pilih Data Collection.</p>
                                      </td>
                                   </tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex justify-end gap-4 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer">Batal</button>
                <button type="submit" form="quoForm" className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 cursor-pointer">Simpan & Generate Quotation</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
