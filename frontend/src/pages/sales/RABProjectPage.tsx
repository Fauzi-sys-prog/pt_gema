import { useEffect, useState, useMemo } from 'react'; import { Plus, Search, Eye, Edit, Trash2, Calculator, ArrowLeft, Filter, Download, Building2, TrendingUp, FileSpreadsheet, Zap, Hammer, Truck, Wallet, CheckCircle2, X, Maximize2, ChevronRight, ChevronDown, FileText, Printer, MoreVertical, ArrowUpRight, AlertCircle, Clock, LayoutDashboard, Save, Trash, Construction, HardHat, Layers, RefreshCw } from 'lucide-react'; import { useNavigate } from 'react-router-dom'; import { useApp } from '../../contexts/AppContext';
import type { Quotation } from '../../types/quotation';
import type { DataCollection } from '../../contexts/AppContext';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from "sonner@2.0.3";
import api from '../../services/api';

export default function RABProjectPage() {
  const { 
    quotationList, 
    addQuotation, 
    updateQuotation, 
    deleteQuotation, 
    stockItemList, 
    employeeList,
    dataCollectionList,
    currentUser
  } = useApp();
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const [serverDataCollectionList, setServerDataCollectionList] = useState<DataCollection[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveQuotationList = serverQuotationList ?? quotationList;
  const effectiveDataCollectionList = serverDataCollectionList ?? dataCollectionList;
  
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeTab, setActiveTab] = useState<'materials' | 'manpower' | 'equipment' | 'consumables'>('materials');
  
  // Form State for New/Edit Quotation
  const [formState, setFormState] = useState<Partial<Quotation>>({
    nomorQuotation: `QO/GTP/${new Date().getFullYear()}/${(effectiveQuotationList.length + 1).toString().padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    customer: { nama: '', alamat: '', pic: '' },
    perihal: '',
    materials: [],
    manpower: [],
    equipment: [],
    consumables: [],
    status: 'Draft',
    // @ts-ignore
    dataCollectionId: '',
    terminologyFormat: 'RAB',
    location: '',
    validUntil: '',
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const fetchRabSources = async () => {
    try {
      setIsRefreshing(true);
      const [quotationRes, dataCollectionRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/data-collections'),
      ]);
      const quotations = Array.isArray(quotationRes.data) ? (quotationRes.data as Quotation[]) : [];
      const dataCollections = Array.isArray(dataCollectionRes.data) ? (dataCollectionRes.data as DataCollection[]) : [];
      setServerQuotationList(quotations);
      setServerDataCollectionList(dataCollections);
    } catch {
      setServerQuotationList(null);
      setServerDataCollectionList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRabSources();
  }, []);

  const calculateGrandTotal = (state: Partial<Quotation>) => {
    const matTotal = (state.materials || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const manTotal = (state.manpower || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const eqTotal = (state.equipment || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const conTotal = (state.consumables || []).reduce((sum, item) => sum + (item.total || 0), 0);
    return matTotal + manTotal + eqTotal + conTotal;
  };

  const handleAddItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables') => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      qty: 1,
      unit: type === 'materials' ? 'Sack' : type === 'manpower' ? 'Man-Day' : 'Unit',
      unitPrice: 0,
      total: 0,
      code: ''
    };

    setFormState(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), newItem]
    }));
  };

  const updateItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables', id: string, updates: any) => {
    setFormState(prev => {
      const updatedList = (prev[type] || []).map((item: any) => {
        if (item.id === id) {
          const newItem = { ...item, ...updates };
          newItem.total = newItem.qty * newItem.unitPrice;
          return newItem;
        }
        return item;
      });
      return { ...prev, [type]: updatedList };
    });
  };

  const removeItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables', id: string) => {
    setFormState(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter((item: any) => item.id !== id)
    }));
  };

  const handleSaveQuotation = async () => {
    if (!formState.customer?.nama || !formState.perihal) {
      toast.error("Mohon isi Nama Customer dan Perihal");
      return;
    }

    const finalQuotation: Quotation = {
      ...(formState as Quotation),
      id: `QO-${Date.now()}`,
      grandTotal: calculateGrandTotal(formState)
    };

    try {
      await addQuotation(finalQuotation);
      toast.success("Quotation Berhasil Disimpan");
      setView('list');
    } catch {
      // error toast from AppContext
    }
  };

  const handleConvertToProject = async (quo: Quotation) => {
    try {
      await updateQuotation(quo.id, { status: 'Sent' });
      toast.success("Quotation disinkronkan. Approval final lewat Project Ledger.");
      setView('list');
      navigate('/project');
    } catch {
      // error toast from AppContext
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    if (!selectedQuotation) return;
    if (String(selectedQuotation.status || '').trim().toUpperCase() !== 'APPROVED') {
      toast.error('Export final quotation hanya diizinkan untuk status Approved.');
      return;
    }
    const quotationId = String(selectedQuotation.id || '').trim();
    if (!quotationId) {
      toast.error('ID quotation tidak valid untuk export');
      return;
    }
    const safeNo = String(selectedQuotation.nomorQuotation || quotationId).replace(/[^\w.-]+/g, '_');
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.get(`/exports/quotations/${quotationId}/excel`, { responseType: 'blob' }),
        api.get(`/exports/quotations/${quotationId}/word`, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `Penawaran_GTP_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `Penawaran_GTP_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Data penawaran berhasil diekspor Word + Excel');
    } catch {
      toast.error('Export data penawaran gagal');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #printable-area, #printable-area * { visibility: visible !important; }
          #printable-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 40px !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 8px !important; font-size: 10pt !important; }
          .document-header { border-bottom: 4px solid #1e293b !important; margin-bottom: 20px !important; padding-bottom: 10px !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}} />

      {view === 'list' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-black text-slate-900 uppercase">Project Quotation Hub</h1>
               <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Commercial & Technical Alignment Center</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchRabSources}
                disabled={isRefreshing}
                className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={() => setView('create')}
                className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all"
              >
                <Plus size={16} /> Buat Quotation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {effectiveQuotationList.map(q => (
              <div 
                key={q.id} 
                className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-blue-500 transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <FileText size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    q.status === 'Rejected'
                      ? 'bg-rose-50 text-rose-600'
                      : q.status === 'Sent'
                        ? 'bg-blue-50 text-blue-600'
                        : q.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-600'
                  }`}>{q.status}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase mb-1 line-clamp-1">{q.customer?.nama || 'N/A'}</h3>
                <p className="text-xs text-slate-500 font-bold mb-4 line-clamp-2 h-8">{q.perihal}</p>
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase">Quotation Value</p>
                    <p className="text-md font-black text-blue-600">{formatCurrency(q.grandTotal || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setSelectedQuotation(q); setView('detail'); }}
                      className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        if (!window.confirm("Hapus quotation ini?")) return;
                        try {
                          await deleteQuotation(q.id);
                          toast.success("Quotation dihapus");
                        } catch {
                          // Error toast handled in AppContext
                        }
                      }}
                      className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                      title="Hapus quotation"
                    >
                      <Trash2 size={16} />
                    </button>
                    {q.status !== 'Rejected' && (
                      <button 
                        onClick={() => handleConvertToProject(q)}
                        className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                        title="Sync to Project Ledger"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {effectiveQuotationList.length === 0 && (
              <div className="col-span-full bg-white rounded-[2.5rem] border-2 border-slate-100 p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest italic">
                Belum ada quotation. Klik "Buat Quotation".
              </div>
            )}
          </div>
        </div>
      ) : view === 'create' ? (
        <div className="space-y-6 pb-20">
          <div className="flex items-center justify-end gap-4">
            <button 
              onClick={() => setView('list')}
              className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleSaveQuotation}
              className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
            >
              <Save size={18} /> Simpan Quotation
            </button>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm space-y-8">
            <div className="bg-blue-600 p-6 rounded-[2rem] text-white flex justify-between items-center -mx-4 -mt-4 mb-8">
               <h2 className="text-xl font-black uppercase tracking-tighter italic">Buat Quotation Baru</h2>
               <button onClick={() => setView('list')} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X size={24} />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Pilih Data Collection *</label>
                   <select 
                     className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none"
                     // @ts-ignore
                     value={formState.dataCollectionId}
                     onChange={(e) => {
                        const dc = dataCollectionList.find(d => d.id === e.target.value);
                        if (dc) {
                           setFormState(prev => ({
                              ...prev,
                              dataCollectionId: dc.id,
                              perihal: `${dc.tipePekerjaan} - ${dc.namaResponden}`,
                              customer: {
                                nama: dc.namaResponden,
                                alamat: dc.lokasi,
                                pic: dc.namaResponden // PIC default to respondent
                              },
                              location: dc.lokasi,
                              materials: (dc.materials || []).map((m: any) => ({
                                id: m.id || Math.random().toString(36).substr(2, 9),
                                description: m.materialName,
                                qty: m.qtyEstimate || m.quantity || 0,
                                unit: m.unit || "Unit",
                                unitPrice: 0,
                                total: 0
                              })),
                              manpower: (dc.manpower || []).map((mp: any) => ({
                                id: Math.random().toString(36).substr(2, 9),
                                description: mp.position,
                                qty: (mp.quantity || 0) * (mp.duration || 1),
                                unit: "Man-Day",
                                unitPrice: 0,
                                total: 0
                              })),
                              equipment: (dc.equipment || []).map((eq: any) => ({
                                id: eq.id || Math.random().toString(36).substr(2, 9),
                                description: eq.equipmentName,
                                qty: (eq.quantity || 0) * (eq.duration || 1),
                                unit: eq.durationType || "Days",
                                unitPrice: 0,
                                total: 0
                              })),
                              consumables: (dc.consumables || []).map((c: any) => ({
                                id: c.id || Math.random().toString(36).substr(2, 9),
                                description: c.materialName || c.name,
                                qty: c.quantity || 1,
                                unit: c.unit || "Lot",
                                unitPrice: 0,
                                total: 0
                              }))
                           }));
                           toast.success(`Data disinkronkan dari Survey ${dc.noKoleksi}`);
                        }
                     }}
                   >
                     <option value="">-- Pilih Data Collection --</option>
                     {effectiveDataCollectionList.map(dc => (
                        <option key={dc.id} value={dc.id}>{dc.noKoleksi} - {dc.tipePekerjaan}</option>
                     ))}
                   </select>
                </div>

                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nomor Quotation *</label>
                   <input 
                     placeholder="Contoh: 005/GTP/EXT/I/2026"
                     className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none"
                     value={formState.nomorQuotation}
                     onChange={(e) => setFormState(prev => ({ ...prev, nomorQuotation: e.target.value }))}
                   />
                </div>

                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Perihal / Nama Project</label>
                   <textarea 
                     placeholder="Perihal quotation"
                     className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none h-24"
                     value={formState.perihal}
                     onChange={(e) => setFormState(prev => ({ ...prev, perihal: e.target.value }))}
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Kota Penempatan (DI)</label>
                      <input 
                        placeholder="Contoh: Bekasi"
                        className="w-full p-4 bg-amber-50/30 border-2 border-amber-100 rounded-2xl font-bold focus:border-amber-500 outline-none"
                        // @ts-ignore
                        value={formState.location}
                        onChange={(e) => setFormState(prev => ({ ...prev, location: e.target.value }))}
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Untuk Perhatian (U/P)</label>
                      <input 
                        placeholder="Nama atau Jabatan PIC"
                        className="w-full p-4 bg-amber-50/30 border-2 border-amber-100 rounded-2xl font-bold focus:border-amber-500 outline-none"
                        value={formState.customer?.pic}
                        onChange={(e) => setFormState(prev => ({ ...prev, customer: { ...prev.customer!, pic: e.target.value } }))}
                      />
                   </div>
                </div>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal</label>
                       <input 
                         type="date"
                         className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none"
                         value={formState.tanggal}
                         onChange={(e) => setFormState(prev => ({ ...prev, tanggal: e.target.value }))}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Berlaku Sampai</label>
                       <input 
                         type="date"
                         className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none"
                         // @ts-ignore
                         value={formState.validUntil}
                         onChange={(e) => setFormState(prev => ({ ...prev, validUntil: e.target.value }))}
                       />
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nama Customer</label>
                    <input 
                      placeholder="Contoh: PT. Krakatau Posco"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none"
                      value={formState.customer?.nama}
                      onChange={(e) => setFormState(prev => ({ ...prev, customer: { ...prev.customer!, nama: e.target.value } }))}
                    />
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terminology Format</p>
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                       <button 
                         // @ts-ignore
                         onClick={() => setFormState(prev => ({ ...prev, terminologyFormat: 'RAB' }))}
                         // @ts-ignore
                         className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formState.terminologyFormat === 'RAB' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                       >
                          RAB (TEKNIS)
                       </button>
                       <button 
                         // @ts-ignore
                         onClick={() => setFormState(prev => ({ ...prev, terminologyFormat: 'SOW' }))}
                         // @ts-ignore
                         className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formState.terminologyFormat === 'SOW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                       >
                          SOW (KOMERSIAL)
                       </button>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nilai Penawaran (RP)</p>
                    <h2 className="text-5xl font-black text-blue-600 italic tracking-tighter mb-1">{formatCurrency(calculateGrandTotal(formState))}</h2>
                 </div>
              </div>
            </div>

            <div className="pt-8 border-t-2 border-slate-50 space-y-8">
               <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  {(['materials', 'manpower', 'equipment', 'consumables'] as const).map(tab => (
                     <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                           activeTab === tab 
                           ? 'bg-white text-blue-600 shadow-md border border-slate-200' 
                           : 'text-slate-400 hover:text-slate-600'
                        }`}
                     >
                        {tab === 'materials' && <Construction size={14} />}
                        {tab === 'manpower' && <HardHat size={14} />}
                        {tab === 'equipment' && <Calculator size={14} />}
                        {tab === 'consumables' && <Layers size={14} />}
                        {tab}
                     </button>
                  ))}
               </div>

               <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                        {activeTab === 'materials' && <Construction size={16} className="text-blue-600" />}
                        {activeTab === 'manpower' && <HardHat size={16} className="text-emerald-600" />}
                        {activeTab === 'equipment' && <Calculator size={16} className="text-purple-600" />}
                        {activeTab === 'consumables' && <Layers size={16} className="text-orange-600" />}
                        Rincian {activeTab}
                     </h4>
                     <button 
                        type="button"
                        onClick={() => handleAddItem(activeTab)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                     >
                        <Plus size={14} /> Tambah Item
                     </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Deskripsi Item</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Qty</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Unit</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-48">Harga Satuan (IDR)</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                              <th className="px-6 py-4 text-center w-16"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {(formState[activeTab] || []).map((item: any) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4">
                                    <input 
                                       type="text"
                                       placeholder="Deskripsi..."
                                       className="w-full bg-transparent border-none outline-none font-bold text-slate-800 text-sm"
                                       value={item.description || item.materialName || item.position || item.equipmentName || item.name}
                                       onChange={(e) => updateItem(activeTab, item.id, { description: e.target.value })}
                                    />
                                 </td>
                                 <td className="px-6 py-4">
                                    <input 
                                       type="number"
                                       className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1 px-2 text-center font-bold text-sm"
                                       value={item.qty || item.quantity}
                                       onChange={(e) => updateItem(activeTab, item.id, { qty: Number(e.target.value), quantity: Number(e.target.value) })}
                                    />
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <input 
                                       type="text"
                                       className="w-full bg-transparent border-none outline-none text-center font-bold text-slate-400 text-[10px] uppercase"
                                       value={item.unit}
                                       onChange={(e) => updateItem(activeTab, item.id, { unit: e.target.value })}
                                    />
                                 </td>
                                 <td className="px-6 py-4">
                                    <input 
                                       type="number"
                                       className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1 px-3 text-right font-black text-blue-600 text-sm"
                                       value={item.unitPrice}
                                       onChange={(e) => updateItem(activeTab, item.id, { unitPrice: Number(e.target.value) })}
                                    />
                                 </td>
                                 <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                                    {formatCurrency(item.total || (item.qty * item.unitPrice))}
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <button 
                                       type="button"
                                       onClick={() => removeItem(activeTab, item.id)}
                                       className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                       <Trash size={14} />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {(formState[activeTab] || []).length === 0 && (
                              <tr>
                                 <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic text-xs">
                                    Belum ada item {activeTab}. Klik "Tambah Item" atau pilih Data Collection.
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          <button 
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest mb-4 no-print"
          >
            <ArrowLeft size={16} /> Kembali ke Hub
          </button>

          <div id="printable-area" className="space-y-8">
            {/* Professional Header for Print */}
            <div className="hidden @media-print:block document-header flex justify-between items-start pb-6 mb-8 border-b-4 border-slate-900">
               <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">PT GEMA TEKNIK PERKASA</h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">General Contractor, Supplier & Technical Services</p>
                  <p className="text-[9px] text-slate-400 mt-2 italic leading-tight">Jl. Raya Alternatif Cibubur, No. 88, Bekasi, Jawa Barat<br/>Telp: (021) 8888-XXXX | Email: info@gemateknikperkasa.co.id</p>
               </div>
               <div className="text-right">
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block font-black text-xs uppercase tracking-widest mb-2">Official Quotation</div>
                  <p className="text-[10px] font-black text-slate-900 uppercase">No: {selectedQuotation?.nomorQuotation}</p>
                  <p className="text-[10px] font-bold text-slate-500">Tanggal: {selectedQuotation?.tanggal}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start no-print">
              <div className="lg:col-span-8 flex flex-col md:flex-row items-center gap-8 bg-white p-10 rounded-[4rem] border-2 border-slate-100 shadow-sm overflow-hidden relative">
                 <div className="flex-1 space-y-6 relative z-10">
                    <div>
                       <span className="px-3 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-widest">{selectedQuotation?.nomorQuotation}</span>
                       <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic mt-4 leading-none">{selectedQuotation?.customer?.nama || 'N/A'}</h2>
                       <p className="text-slate-500 font-bold text-sm uppercase italic mt-2">{selectedQuotation?.perihal}</p>
                    </div>
                    
                    <div className="flex items-center gap-10">
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest">Total Quotation</p>
                          <h2 className="text-2xl font-black text-blue-600 italic tracking-tighter">
                             {formatCurrency(selectedQuotation?.grandTotal || 0)}
                          </h2>
                       </div>
                       <div className="text-right">
                          <span className="text-2xl font-black text-emerald-500 italic uppercase">{selectedQuotation?.status}</span>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Status</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-4 no-print">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 italic text-blue-400">Hub Actions</h4>
                  <div className="space-y-3">
                     {selectedQuotation?.status !== 'Rejected' && (
                       <button 
                          onClick={() => handleConvertToProject(selectedQuotation!)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl flex items-center justify-between group transition-all"
                       >
                          <div className="flex items-center gap-3">
                             <CheckCircle2 size={18} />
                             <span className="text-[11px] font-black uppercase">Sync ke Project Ledger</span>
                          </div>
                          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                       </button>
                     )}
                     <button 
                        onClick={handlePrint}
                        className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center justify-between group transition-all"
                     >
                        <div className="flex items-center gap-3">
                           <Printer className="text-blue-400" size={18} />
                           <span className="text-[11px] font-black uppercase tracking-widest">Cetak / Export PDF</span>
                        </div>
                        <Download size={16} />
                     </button>
                     <button 
                        onClick={handleExportExcel}
                        className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center justify-between group transition-all"
                     >
                        <div className="flex items-center gap-3">
                           <FileSpreadsheet className="text-emerald-400" size={18} />
                           <span className="text-[11px] font-black uppercase tracking-widest">Export Word + Excel</span>
                        </div>
                        <ChevronRight size={16} />
                     </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Info Section (Visible in Print & Screen) */}
            <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
              <div className="p-8 border-b-2 border-slate-50 bg-slate-50/50 flex gap-4 overflow-x-auto no-print">
                 {(['materials', 'manpower', 'equipment', 'consumables'] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                    >
                      {tab}
                    </button>
                 ))}
              </div>
              
              <div className="p-8 space-y-12">
                 <div className="grid grid-cols-2 gap-20">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Kepada Yth:</h4>
                       <div className="text-sm font-black text-slate-900 uppercase italic">
                          <p>{selectedQuotation?.customer?.nama || 'N/A'}</p>
                          <p className="text-xs text-slate-500 font-bold not-italic">{selectedQuotation?.customer?.alamat || 'Alamat Customer'}</p>
                          <p className="mt-2">U/P: {selectedQuotation?.customer?.pic || '-'}</p>
                       </div>
                    </div>
                    <div className="space-y-4 text-right">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 text-right">Informasi Penawaran:</h4>
                       <div className="text-[10px] font-bold text-slate-600 space-y-1">
                          <p>NOMOR: <span className="font-black text-slate-900">{selectedQuotation?.nomorQuotation}</span></p>
                          <p>TANGGAL: <span className="font-black text-slate-900">{selectedQuotation?.tanggal}</span></p>
                          <p>BERLAKU S/D: <span className="font-black text-slate-900">{(selectedQuotation as any)?.validUntil || '-'}</span></p>
                          <p>LOKASI: <span className="font-black text-slate-900">{(selectedQuotation as any)?.location || '-'}</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h3 className="text-lg font-black text-slate-900 uppercase italic underline decoration-blue-500 underline-offset-8">Rincian Penawaran (RAB)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border border-slate-700">Description</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center border border-slate-700 w-20">Qty</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center border border-slate-700 w-24">Unit</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right border border-slate-700">Unit Price</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right border border-slate-700">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {/* We show all items in print, but only active tab on screen for better UX */}
                          {['materials', 'manpower', 'equipment', 'consumables'].map(cat => (
                             <div key={cat} className="contents no-print-hidden">
                                {selectedQuotation?.[cat as any]?.length > 0 && (
                                   <tr className="bg-slate-50">
                                      <td colSpan={5} className="p-3 text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50/50">{cat}</td>
                                   </tr>
                                )}
                                {selectedQuotation?.[cat as any]?.map((item: any) => (
                                   <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4"><span className="font-bold text-slate-900 uppercase">{item.description}</span></td>
                                      <td className="p-4 text-center font-bold">{item.qty}</td>
                                      <td className="p-4 text-center text-slate-500">{item.unit}</td>
                                      <td className="p-4 text-right font-bold">{formatCurrency(item.unitPrice)}</td>
                                      <td className="p-4 text-right font-black text-slate-900">{formatCurrency(item.total)}</td>
                                   </tr>
                                ))}
                             </div>
                          ))}
                        </tbody>
                        <tfoot>
                           <tr className="bg-slate-900 text-white">
                              <td colSpan={4} className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Grand Total (Excl. PPN 11%)</td>
                              <td className="p-4 text-right font-black text-lg italic">{formatCurrency(selectedQuotation?.grandTotal || 0)}</td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>
                 </div>

                 {/* Signature Section */}
                 <div className="grid grid-cols-2 gap-20 pt-12 pb-20">
                    <div className="text-center space-y-20">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Disetujui Oleh,</p>
                          <p className="text-[10px] font-bold text-slate-900 uppercase">{selectedQuotation?.customer?.nama || 'N/A'}</p>
                       </div>
                       <div className="w-48 h-[1px] bg-slate-400 mx-auto"></div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase">(Tanda Tangan & Stempel)</p>
                    </div>
                    <div className="text-center space-y-20">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hormat Kami,</p>
                          <p className="text-[10px] font-bold text-slate-900 uppercase">PT Gema Teknik Perkasa</p>
                       </div>
                       <div className="w-48 h-[1px] bg-slate-400 mx-auto relative flex justify-center items-center">
                          {/* Placeholder for Stamp */}
                          <div className="absolute -top-12 border-4 border-blue-600/20 text-blue-600/20 rounded-full px-4 py-1 font-black text-xs rotate-[-15deg] uppercase">GTP OFFICIAL STAMP</div>
                       </div>
                       <p className="text-[10px] font-black text-slate-900 uppercase">Direktur Utama / Manager</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
