import { useState, useMemo, useEffect } from 'react';
import { useApp, type SuratJalan } from '../../contexts/AppContext';
import {
  Search,
  Truck,
  Plus,
  Clock,
  CheckCircle2,
  MapPin,
  User as UserIcon,
  Package,
  FileText,
  X,
  Printer,
  QrCode,
  Layers,
  Activity,
  AlertCircle,
  FileSignature,
  RotateCcw,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { exportSuratJalanToXlsx } from '../../utils/suratJalanExcelExport';

export default function SuratJalanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    suratJalanList,
    createSuratJalanWithStockOut,
    updateSuratJalan,
    projectList,
    addAuditLog,
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSJ, setSelectedSJ] = useState<SuratJalan | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTarget, setReturnTarget] = useState<SuratJalan | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnNote, setReturnNote] = useState('');

  const [formData, setFormData] = useState({
    noSurat: `SJ/${new Date().getFullYear()}/${(suratJalanList.length + 1).toString().padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    sjType: 'Material Delivery' as 'Material Delivery' | 'Equipment Loan',
    projectId: '',
    tujuan: '',
    alamat: '',
    upPerson: '',
    sopir: '',
    noPolisi: '',
    pengirim: 'Gudang GTP',
    expectedReturnDate: '',
    items: [{ namaItem: '', itemKode: '', jumlah: 1, satuan: 'Pcs', batchNo: '', keterangan: '' }]
  });

  useEscapeKey([
    { condition: showReturnModal, close: () => setShowReturnModal(false) },
    { condition: showPreview, close: () => setShowPreview(false) },
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
  ]);


  const generateBatchNo = () => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `GTP/${date}/${random}`;
  };

  const handleProjectChange = (projectId: string) => {
    const project = projectList.find(p => p.id === projectId);
    if (project) {
      // Zero Re-typing: Pull data from project
      setFormData(prev => ({
        ...prev,
        projectId,
        tujuan: project.customer,
        alamat: project.namaProject, // Proxy for location
        // Auto-load items from BOQ if available (only for Material Delivery)
        items: prev.sjType === 'Material Delivery' && project.boq ? project.boq.map(b => ({
            namaItem: b.materialName,
            itemKode: b.itemKode || '',
            jumlah: b.qtyEstimate,
            satuan: b.unit,
            batchNo: generateBatchNo(),
            keterangan: ''
        })) : [{ namaItem: '', itemKode: '', jumlah: 1, satuan: 'Pcs', batchNo: prev.sjType === 'Material Delivery' ? generateBatchNo() : '', keterangan: '' }]
      }));
      toast.info(`Data BOQ Project ${project.namaProject} berhasil di-load otomatis.`);
    }
  };

  // Auto-open modal when navigated from Project or PO
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromProject && state?.projectId) {
      handleProjectChange(state.projectId);
      setShowCreateModal(true);
      window.history.replaceState({}, document.title);
    } else if (state?.fromPO && state?.poId) {
      setFormData(prev => ({
        ...prev,
        tujuan: state.supplier || '',
        projectId: state.projectId || '',
        items: (state.items || []).map((it: any) => ({
          namaItem: it.nama || it.materialName || '',
          itemKode: it.kode || it.itemKode || '',
          jumlah: it.qty || it.qtyEstimate || 1,
          satuan: it.unit || 'Pcs',
          batchNo: '',
          keterangan: `Dari PO: ${state.poNo || ''}`,
        })),
      }));
      setShowCreateModal(true);
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSJ = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(async () => {
      const newSJ: SuratJalan = {
        id: `SJ-${Date.now()}`,
        ...formData,
        deliveryStatus: 'Pending',
        createdAt: new Date().toISOString()
      };

      // Material Delivery posts the document and stock movement together.
      let newStockOut: Parameters<typeof createSuratJalanWithStockOut>[1];
      if (formData.sjType === 'Material Delivery') {
        const stockOutItems = formData.items
        .filter(item => item.itemKode && item.jumlah > 0)
        .map(item => ({
          kode: item.itemKode,
          nama: item.namaItem,
          qty: item.jumlah,
          unit: item.satuan,
          batchNo: item.batchNo
        }));

      if (stockOutItems.length > 0) {
        newStockOut = {
          id: `SO-${Date.now()}`,
          noStockOut: `SO-AUTO-${formData.noSurat.replace(/\//g, '-')}`,
          projectId: formData.projectId,
          penerima: formData.sopir || 'Logistics Officer',
          tanggal: formData.tanggal,
          type: 'Project Issue' as const,
          status: 'Posted' as const,
          createdBy: 'Logistics Command Center',
          items: stockOutItems,
          notes: `Auto-generated from SJ ${formData.noSurat}`
        };

        }
      }
      try {
        await createSuratJalanWithStockOut(newSJ, newStockOut);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Surat Jalan gagal disimpan');
        setIsSubmitting(false);
        return;
      }
      
      addAuditLog({
        action: "Digital SJ Generated",
        module: "Logistics",
        details: `Membuat Surat Jalan ${formData.noSurat} untuk ${formData.tujuan}`,
        status: "Success"
      });
      toast.success('Surat Jalan Berhasil Dibuat', {
        description: `No: ${formData.noSurat} tujuan ${formData.tujuan}`
      });
      setShowCreateModal(false);
      setIsSubmitting(false);
      // Reset form
      setFormData({
        noSurat: `SJ/${new Date().getFullYear()}/${(suratJalanList.length + 2).toString().padStart(3, '0')}`,
        tanggal: new Date().toISOString().split('T')[0],
        sjType: 'Material Delivery',
        projectId: '',
        tujuan: '',
        alamat: '',
        upPerson: '',
        sopir: '',
        noPolisi: '',
        pengirim: 'Gudang GTP',
        expectedReturnDate: '',
        items: [{ namaItem: '', itemKode: '', jumlah: 1, satuan: 'Pcs', batchNo: '', keterangan: '' }]
      });
    }, 1000);
  };

  const openReturnModal = (sj: SuratJalan) => {
    setReturnTarget(sj);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnNote('');
    setShowReturnModal(true);
  };

  const handleConfirmReturn = () => {
    if (!returnTarget || processingId) return;
    setProcessingId(returnTarget.id);
    try {
      updateSuratJalan(returnTarget.id, {
        returnStatus: 'Complete',
        actualReturnDate: returnDate,
        deliveryStatus: 'Returned',
      });
      addAuditLog({
        action: 'Equipment Returned',
        module: 'Logistics',
        details: `Alat dari SJ ${returnTarget.noSurat} telah dikembalikan pada ${returnDate}${returnNote ? ' — ' + returnNote : ''}`,
        status: 'Success',
      });
      toast.success(`Alat SJ ${returnTarget.noSurat} ditandai sudah kembali ✓`);
      setShowReturnModal(false);
      setReturnTarget(null);
      if (selectedSJ?.id === returnTarget.id) setShowPreview(false);
    } catch (err) {
      toast.error('Gagal menandai pengembalian: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleTransition = (sj: SuratJalan, updates: Partial<SuratJalan>, successMsg: string) => {
    if (processingId) return;
    setProcessingId(sj.id);
    try {
      updateSuratJalan(sj.id, updates);
      toast.success(successMsg);
    } catch (err) {
      toast.error('Gagal memperbarui status SJ: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        namaItem: '', 
        itemKode: '', 
        jumlah: 1, 
        satuan: 'Pcs', 
        batchNo: prev.sjType === 'Material Delivery' ? generateBatchNo() : '',
        keterangan: ''
      }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'namaItem' && !newItems[index].batchNo) {
        newItems[index].batchNo = generateBatchNo();
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const filteredSJ = useMemo(() => {
    return suratJalanList.filter(sj => 
      (sj.noSurat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sj.tujuan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sj.sopir || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suratJalanList, searchTerm]);

  const handlePrint = () => {
    toast.success('Mengirim ke antrian cetak...');
    window.print();
  };

  const getStatusColor = (status?: string) => {
    switch(status) {
      case 'Delivered': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'In Transit': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Returned': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
              <span className="px-2 sm:px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-200 whitespace-nowrap">Logistics Commander</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Digital Ledger</span>
           </div>
           <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2 sm:gap-3">
              <Truck className="text-indigo-600 flex-shrink-0" size={32} />
              <span className="truncate">Surat Jalan & Compliance</span>
           </h1>
           <p className="text-slate-500 font-bold text-xs sm:text-sm uppercase italic tracking-wide mt-1">Automated Document Dispatch & Field Integration</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto bg-slate-900 text-white px-6 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 hover:bg-black transition-all rotate-1"
          >
            <Plus size={20} className="flex-shrink-0" /> 
            <span className="hidden sm:inline">Generate New SJ</span>
            <span className="sm:hidden">New SJ</span>
          </button>
        </div>
      </div>

      {/* Logic Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        {[
          { label: 'Material Delivery', val: suratJalanList.filter(s => s.sjType === 'Material Delivery').length, color: 'text-indigo-600', icon: <Package size={24} />, bg: 'bg-white' },
          { label: 'Equipment Loan', val: suratJalanList.filter(s => s.sjType === 'Equipment Loan').length, color: 'text-purple-600', icon: <Layers size={24} />, bg: 'bg-white' },
          { label: 'Live Delivery', val: suratJalanList.filter(s => s.deliveryStatus === 'In Transit').length, color: 'text-amber-600', icon: <Truck size={24} />, bg: 'bg-white' },
          { label: 'Completed', val: suratJalanList.filter(s => s.deliveryStatus === 'Delivered').length, color: 'text-emerald-600', icon: <CheckCircle2 size={24} />, bg: 'bg-white' },
          { label: 'Overdue Return', val: suratJalanList.filter(s => s.sjType === 'Equipment Loan' && s.returnStatus === 'Pending').length, color: 'text-rose-600', icon: <AlertCircle size={24} />, bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:translate-y-[-4px] overflow-hidden`}>
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider lg:tracking-[0.2em] truncate">{stat.label}</p>
              <div className={`${stat.color} opacity-40 flex-shrink-0`}>{stat.icon}</div>
            </div>
            <h3 className={`text-xl sm:text-2xl lg:text-3xl font-black italic ${stat.color}`}>{stat.val}</h3>
          </div>
        ))}
      </div>

      {/* Document List */}
      <div className="bg-white rounded-2xl lg:rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4 sm:gap-6">
          <div className="relative flex-1 min-w-[200px] sm:min-w-[300px]">
            <Search size={20} className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-300 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Search by Document No, Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 sm:pl-16 pr-4 sm:pr-8 py-3 sm:py-5 bg-slate-50 border-none rounded-xl sm:rounded-2xl text-sm font-bold uppercase italic focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
             <button className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-xl shadow-sm border border-indigo-100 whitespace-nowrap">Active</button>
             <button className="px-4 sm:px-6 py-2 sm:py-3 text-slate-400 text-[10px] font-black uppercase hover:text-slate-600 transition-all whitespace-nowrap">Archived</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Ref / Date</th>
                <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination & Project</th>
                <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics Health</th>
                <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Execution Status</th>
                <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Commander</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSJ.map((sj) => (
                <tr key={sj.id} className="group hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => { setSelectedSJ(sj); setShowPreview(true); }}>
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-indigo-600 tracking-tighter uppercase italic group-hover:underline">{sj.noSurat}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${sj.sjType === 'Material Delivery' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                          {sj.sjType === 'Material Delivery' ? 'MTL' : 'EQP'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">{new Date(sj.tanggal).toLocaleDateString('id-ID')}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{sj.tujuan}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 truncate max-w-[250px] flex items-center gap-1">
                        <MapPin size={12} className="text-slate-300" /> {sj.alamat}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase">
                        <UserIcon size={14} className="text-indigo-400" /> {sj.sopir || 'UNASSIGNED'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase italic tracking-tight">
                        <Truck size={14} /> {sj.noPolisi || 'NO PLATE'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border-2 ${getStatusColor(sj.deliveryStatus)}`}>
                        {sj.deliveryStatus || 'Pending'}
                      </span>
                      {sj.deliveryStatus !== 'Delivered' && (
                        <div className="flex gap-1.5">
                          {(!sj.deliveryStatus || sj.deliveryStatus === 'Pending') && (
                            <button
                              disabled={!!processingId}
                              onClick={(e) => { e.stopPropagation(); handleTransition(sj, { deliveryStatus: 'In Transit' }, `SJ ${sj.noSurat} → In Transit`); }}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black hover:bg-blue-200 transition-all disabled:opacity-50"
                            >
                              Kirim
                            </button>
                          )}
                          {sj.deliveryStatus === 'In Transit' && (
                            <button
                              disabled={!!processingId}
                              onClick={(e) => { e.stopPropagation(); handleTransition(sj, { deliveryStatus: 'Delivered', deliveredAt: new Date().toISOString() }, `SJ ${sj.noSurat} → Delivered ✓`); }}
                              className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black hover:bg-emerald-200 transition-all disabled:opacity-50"
                            >
                              Terima ✓
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <div className="flex justify-end gap-2">
                      {sj.sjType === 'Equipment Loan' && sj.returnStatus !== 'Complete' && (
                        <button
                          onClick={e => { e.stopPropagation(); openReturnModal(sj); }}
                          className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-[9px] font-black uppercase tracking-wide hover:bg-purple-200 transition-all flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RotateCcw size={12} /> Kembalikan
                        </button>
                      )}
                      {sj.sjType === 'Equipment Loan' && sj.returnStatus === 'Complete' && (
                        <span className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> Sudah Kembali
                        </span>
                      )}
                      <button className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all shadow-sm">
                        <QrCode size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Document Preview Modal */}
        {showPreview && selectedSJ && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white w-full max-w-5xl rounded-[4rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]"
            >
              <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl rotate-3">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Digital Document Ledger</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Verified Logistics Transmission Record</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  {selectedSJ.sjType === 'Equipment Loan' && selectedSJ.returnStatus !== 'Complete' && (
                    <button
                      onClick={() => openReturnModal(selectedSJ)}
                      className="px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all flex items-center gap-2 text-sm font-black uppercase shadow-lg shadow-purple-200"
                    >
                      <RotateCcw size={18} /> Tandai Kembali
                    </button>
                  )}
                  {selectedSJ.sjType === 'Equipment Loan' && selectedSJ.returnStatus === 'Complete' && (
                    <span className="px-6 py-3 bg-emerald-100 text-emerald-700 rounded-2xl text-sm font-black uppercase flex items-center gap-2">
                      <CheckCircle2 size={18} /> Sudah Kembali {selectedSJ.actualReturnDate && `· ${selectedSJ.actualReturnDate}`}
                    </span>
                  )}
                  {selectedSJ.sjType === 'Material Delivery' && (
                    <button
                      onClick={() => {
                        navigate('/surat-menyurat/berita-acara');
                        toast.info('Silakan gunakan Auto-fill dari Surat Jalan untuk generate BAST');
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl hover:shadow-lg transition-all flex items-center gap-2 text-sm font-black uppercase"
                    >
                      <FileSignature size={20} /> Generate BAST
                    </button>
                  )}
                  <button onClick={handlePrint} className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all shadow-sm">
                    <Printer size={24} />
                  </button>
                  <button onClick={() => exportSuratJalanToXlsx(selectedSJ)} title="Download Surat Jalan Excel" className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-sm">
                    <FileSpreadsheet size={24} />
                  </button>
                  <button onClick={() => setShowPreview(false)} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-16 bg-slate-100 print:bg-white" id="sj-print">
                <div className="bg-white p-20 shadow-xl border border-slate-200 mx-auto max-w-[850px] min-h-[1100px] flex flex-col relative overflow-hidden">
                  {/* Watermark/Logo */}
                  <div className="absolute top-10 right-10 opacity-5 grayscale">
                    <Truck size={200} />
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start border-b-8 border-slate-900 pb-10 mb-12">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">PT GEMA TEKNIK PERKASA</h2>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Warehouse & Logistics Operations Division</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase mt-4 max-w-[350px] leading-relaxed">
                        Jl. Nurnishoba II No 13 Setia Mekar Tambun Selatan Bekasi <br/>
                        HQ: +62 21 8899 7766 • support@gemateknik.co.id
                      </p>
                    </div>
                    <div className="text-right">
                      <h1 className="text-5xl font-black text-slate-900 italic tracking-tighter uppercase mb-4">SURAT JALAN{selectedSJ.sjType === 'Equipment Loan' && ' ALAT'}</h1>
                      <div className="bg-slate-900 text-white px-8 py-2 text-[12px] font-black uppercase tracking-[0.2em] inline-block shadow-lg">
                        No: {selectedSJ.noSurat}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-3">Tanggal: Bekasi, {new Date(selectedSJ.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  
                  {/* Equipment Loan: Formal Letter Format */}
                  {selectedSJ.sjType === 'Equipment Loan' && (
                    <div className="mb-8">
                      <p className="text-xs font-bold text-slate-600 mb-2">Kepada Yth:</p>
                      <h4 className="text-lg font-black text-slate-900 uppercase mb-1">{selectedSJ.tujuan}</h4>
                      <p className="text-xs font-medium text-slate-500 mb-1">{selectedSJ.alamat}</p>
                      {selectedSJ.upPerson && <p className="text-xs font-bold text-slate-600">UP/ {selectedSJ.upPerson}</p>}
                      <p className="text-xs font-medium text-slate-600 mt-6 mb-4 leading-relaxed">Dengan hormat,<br/>Bersama ini kami kirimkan peralatan sebagai berikut:</p>
                    </div>
                  )}

                  {/* Info Grid - Only for Material Delivery */}
                  {selectedSJ.sjType === 'Material Delivery' && (
                    <div className="grid grid-cols-2 gap-20 mb-16">
                      <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 italic">Delivery Consignee:</p>
                        <h4 className="text-xl font-black text-slate-900 uppercase mb-2 italic">{selectedSJ.tujuan}</h4>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase">{selectedSJ.alamat}</p>
                        {selectedSJ.upPerson && <p className="text-[10px] font-black text-slate-600 mt-2">UP/ {selectedSJ.upPerson}</p>}
                      </div>
                      <div className="text-right space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Transmission Intel:</p>
                        <div className="space-y-1">
                          <div className="flex justify-end gap-4"><span className="text-[10px] font-black text-slate-400 uppercase">Dispatch Date</span> <span className="text-xs font-black text-slate-900">{new Date(selectedSJ.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                          <div className="flex justify-end gap-4"><span className="text-[10px] font-black text-slate-400 uppercase">Logistics Officer</span> <span className="text-xs font-black text-slate-900">{selectedSJ.sopir}</span></div>
                          <div className="flex justify-end gap-4"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle ID</span> <span className="text-xs font-black text-slate-900">{selectedSJ.noPolisi}</span></div>
                          <div className="flex justify-end gap-4"><span className="text-[10px] font-black text-slate-400 uppercase">Reference No</span> <span className="text-xs font-black text-indigo-600">{selectedSJ.noPO || 'INTERNAL DISPATCH'}</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="flex-1">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-4 border-slate-900">
                          <th className="py-6 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">No</th>
                          <th className="py-6 text-left text-[11px] font-black uppercase tracking-widest text-slate-900">
                            {selectedSJ.sjType === 'Material Delivery' ? 'Material Specification' : 'Nama Barang'}
                          </th>
                          <th className="py-6 text-center text-[11px] font-black uppercase tracking-widest text-slate-900">Jumlah</th>
                          <th className="py-6 text-center text-[11px] font-black uppercase tracking-widest text-slate-900">Unit</th>
                          <th className="py-6 text-left text-[11px] font-black uppercase tracking-widest text-slate-900">
                            {selectedSJ.sjType === 'Material Delivery' ? 'Batch ID' : 'Keterangan'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-100">
                        {selectedSJ.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-all">
                            <td className="py-6 text-[11px] font-black text-slate-300">{idx + 1}</td>
                            <td className="py-6">
                               <div className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{item.namaItem}</div>
                               {selectedSJ.sjType === 'Material Delivery' && (
                                 <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Verified Material Integrity Check: PASSED</div>
                               )}
                            </td>
                            <td className="py-6 text-center text-lg font-black italic text-slate-900">{item.jumlah}</td>
                            <td className="py-6 text-center text-[11px] font-black text-slate-500 uppercase">{item.satuan}</td>
                            <td className="py-6 text-left">
                              {selectedSJ.sjType === 'Material Delivery' ? (
                                <span className="text-[10px] font-black text-indigo-600 tracking-tighter">{item.batchNo || 'GTP-VERIFIED'}</span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-600 italic">{item.keterangan || '-'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Equipment Loan: Closing Statement */}
                  {selectedSJ.sjType === 'Equipment Loan' && (
                    <div className="mt-12 mb-8">
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        Demikian surat pengantar ini dibuat, untuk dipergunakan sebagaimana mestinya.<br/>
                        Atas bantuan dan perhatiannya kami sampaikan terima kasih.
                      </p>
                      {selectedSJ.expectedReturnDate && (
                        <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Expected Return Date:</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">{new Date(selectedSJ.expectedReturnDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Notes - Only for Material Delivery */}
                  {selectedSJ.sjType === 'Material Delivery' && (
                    <div className="mt-12 p-8 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between shadow-xl">
                        <div className="flex items-center gap-4">
                           <QrCode size={48} className="text-indigo-400" />
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Digital Proof of Delivery (e-POD)</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Scan to verify document authenticity & GPS coordinates.</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black uppercase italic text-indigo-400">Compliance Verified</p>
                           <p className="text-[11px] font-black uppercase italic tracking-tighter mt-1">GTP-SYSTEM-AUTO-AUTH</p>
                        </div>
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-12 mt-16 text-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-20">
                        {selectedSJ.sjType === 'Material Delivery' ? 'Recipient / Client' : 'Penerima'}
                      </p>
                      <div className="border-t-2 border-slate-900 pt-3">
                        <p className="text-xs font-black uppercase">( ............................ )</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-20">
                        {selectedSJ.sjType === 'Material Delivery' ? 'Logistics Officer / Driver' : 'Membuat'}
                      </p>
                      <div className="border-t-2 border-slate-900 pt-3">
                        <p className="text-xs font-black uppercase italic">( {selectedSJ.sopir} )</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-20">
                        {selectedSJ.sjType === 'Material Delivery' ? 'Dispatch Authority' : 'Menyetujui'}
                      </p>
                      <div className="border-t-2 border-slate-900 pt-3">
                        <p className="text-xs font-black uppercase italic">( {selectedSJ.pengirim} )</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      
      {/* Create SJ Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-white w-full sm:max-w-3xl rounded-t-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95dvh]"
          >
            <form onSubmit={handleCreateSJ} className="flex flex-col h-full min-h-0">

              {/* Modal header — fixed, never scrolls */}
              <div className="px-5 py-4 sm:px-8 sm:py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-2 shrink-0">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-none">Buat Surat Jalan</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 hidden sm:block">Zero Re-typing Logistics Automation</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-slate-100 shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-5">

                  {/* Type toggle */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 rounded-2xl">
                    <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-3">Jenis Surat Jalan</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {(['Material Delivery', 'Equipment Loan'] as const).map(type => (
                        <label key={type}
                          className={`flex-1 flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.sjType === type ? 'bg-white border-white shadow-lg' : 'bg-white/10 border-white/20 hover:bg-white/20'
                          }`}>
                          <input type="radio" name="sjType" value={type} checked={formData.sjType === type}
                            onChange={e => setFormData({...formData, sjType: e.target.value as typeof type})}
                            className="hidden" />
                          {type === 'Material Delivery'
                            ? <Package size={20} className={formData.sjType === type ? 'text-indigo-600 shrink-0' : 'text-white shrink-0'} />
                            : <Layers size={20} className={formData.sjType === type ? 'text-purple-600 shrink-0' : 'text-white shrink-0'} />}
                          <div>
                            <p className={`text-xs font-black uppercase ${formData.sjType === type ? 'text-slate-900' : 'text-white'}`}>{type}</p>
                            <p className={`text-[9px] mt-0.5 ${formData.sjType === type ? 'text-slate-400' : 'text-white/60'}`}>
                              {type === 'Material Delivery' ? 'Auto stock out saat kirim' : 'Tracking return alat'}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Project link */}
                  <div className="bg-indigo-50/60 rounded-2xl border border-indigo-100 p-4">
                    <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                      <Layers size={11} /> Tautan ke Project
                    </label>
                    <select value={formData.projectId} onChange={e => handleProjectChange(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none ring-2 ring-indigo-100 focus:ring-indigo-300 transition-all appearance-none">
                      <option value="">— Tanpa project / manual —</option>
                      {projectList.map(p => (
                        <option key={p.id} value={p.id}>{p.namaProject} ({p.customer})</option>
                      ))}
                    </select>
                  </div>

                  {/* Doc No + Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Dokumen</label>
                      <input type="text" required value={formData.noSurat}
                        onChange={e => setFormData({...formData, noSurat: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                      <input type="date" required value={formData.tanggal}
                        onChange={e => setFormData({...formData, tanggal: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                    </div>
                  </div>

                  {/* Tujuan + Alamat */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tujuan / Konsinyee</label>
                    <input type="text" required placeholder="PT Example Indonesia"
                      value={formData.tujuan} onChange={e => setFormData({...formData, tujuan: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat / Lokasi Proyek</label>
                    <textarea required placeholder="Alamat lengkap lokasi pengiriman..."
                      value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})}
                      rows={2} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all resize-none" />
                  </div>

                  {/* UP + Return date (Equipment Loan) */}
                  <div className={`grid gap-3 ${formData.sjType === 'Equipment Loan' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">UP / Attention To <span className="text-slate-300 normal-case font-medium">(opsional)</span></label>
                      <input type="text" placeholder="Nama contact person"
                        value={formData.upPerson} onChange={e => setFormData({...formData, upPerson: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                    </div>
                    {formData.sjType === 'Equipment Loan' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Clock size={10} /> Estimasi Kembali
                        </label>
                        <input type="date" required value={formData.expectedReturnDate}
                          onChange={e => setFormData({...formData, expectedReturnDate: e.target.value})}
                          className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm font-bold text-black outline-none focus:border-amber-400 transition-all" />
                      </div>
                    )}
                  </div>

                  {/* Logistics — dark card */}
                  <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck size={11} /> Logistics Assignment
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          {formData.sjType === 'Material Delivery' ? 'Sopir / Officer' : 'PIC Pembuat'}
                        </label>
                        <input type="text" required placeholder="Nama lengkap"
                          value={formData.sopir} onChange={e => setFormData({...formData, sopir: e.target.value})}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-400 transition-all placeholder:text-slate-600" />
                      </div>
                      {formData.sjType === 'Material Delivery' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">No. Polisi Kendaraan</label>
                          <input type="text" required placeholder="B 1234 GTP"
                            value={formData.noPolisi} onChange={e => setFormData({...formData, noPolisi: e.target.value})}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-400 transition-all placeholder:text-slate-600" />
                        </div>
                      )}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          {formData.sjType === 'Material Delivery' ? 'Dispatch Authority' : 'Pihak Menyetujui'}
                        </label>
                        <input type="text" required value={formData.pengirim}
                          onChange={e => setFormData({...formData, pengirim: e.target.value})}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-400 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                        <Package className="text-indigo-600" size={16} />
                        {formData.sjType === 'Material Delivery' ? 'Daftar Material' : 'Daftar Peralatan'}
                      </p>
                      <button type="button" onClick={addItem}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5 hover:bg-indigo-100 transition-all">
                        <Plus size={13} /> Tambah Item
                      </button>
                    </div>

                    <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {/* Column headers */}
                      <div className="hidden sm:grid grid-cols-[1fr_72px_72px_120px_32px] gap-2 px-2">
                        {['Nama Barang', 'Qty', 'Satuan', formData.sjType === 'Material Delivery' ? 'Batch ID' : 'Keterangan', ''].map((h, i) => (
                          <p key={i} className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center first:text-left">{h}</p>
                        ))}
                      </div>

                      {formData.items.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_72px_72px_120px_32px] sm:gap-2 sm:items-center group">
                          {/* Name */}
                          <input type="text" required
                            placeholder={formData.sjType === 'Material Delivery' ? 'Deskripsi material...' : 'Nama alat / equipment...'}
                            value={item.namaItem} onChange={e => updateItem(idx, 'namaItem', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-black outline-none focus:border-indigo-300 transition-all" />

                          {/* Qty + Unit — side by side on mobile */}
                          <div className="flex gap-2 sm:contents">
                            <input type="number" required placeholder="Qty" min={0}
                              value={item.jumlah} onChange={e => updateItem(idx, 'jumlah', parseFloat(e.target.value))}
                              className="w-1/3 sm:w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-center text-black outline-none focus:border-indigo-300 transition-all" />
                            <input type="text" required placeholder="Sat."
                              value={item.satuan} onChange={e => updateItem(idx, 'satuan', e.target.value)}
                              className="w-1/3 sm:w-full px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black uppercase text-center text-black outline-none focus:border-indigo-300 transition-all" />

                            {/* Batch / Keterangan — inline on mobile */}
                            {formData.sjType === 'Material Delivery' ? (
                              <input type="text" placeholder="Batch" value={item.batchNo} readOnly
                                className="w-1/3 sm:w-full px-2 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-600 uppercase text-center outline-none" />
                            ) : (
                              <input type="text" placeholder="Keterangan"
                                value={item.keterangan || ''} onChange={e => updateItem(idx, 'keterangan', e.target.value)}
                                className="flex-1 sm:w-full px-2 py-2 bg-amber-50 border border-amber-100 rounded-lg text-[9px] font-bold italic text-black outline-none focus:border-amber-300 transition-all" />
                            )}
                          </div>

                          {/* Delete */}
                          <div className="flex justify-end sm:block">
                            <button type="button" onClick={() => removeItem(idx)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-50">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>{/* end scrollable body */}
              </div>

              {/* Footer — always visible */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3.5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {isSubmitting ? <Activity className="animate-spin" size={16} /> : <Truck size={16} />}
                  Buat Surat Jalan
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

      {/* Return Confirmation Modal */}
      {showReturnModal && returnTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-8 pt-8 pb-7">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                    <RotateCcw size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">Konfirmasi Pengembalian Alat</h3>
                    <p className="text-purple-200 text-[11px] font-bold mt-0.5">{returnTarget.noSurat} · {returnTarget.tujuan}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-5">
              {/* Items list */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Daftar Alat yang Kembali</p>
                {returnTarget.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{item.namaItem}</span>
                    <span className="font-black text-slate-500">{item.jumlah} {item.satuan}</span>
                  </div>
                ))}
              </div>

              {/* Return date */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                  <Calendar size={10} /> Tanggal Kembali
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-400 transition-all"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Catatan <span className="text-slate-300 font-bold normal-case">(opsional)</span></label>
                <textarea
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                  placeholder="Contoh: Alat kondisi baik, tidak ada kerusakan..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-purple-400 transition-all resize-none placeholder:text-slate-300 font-medium"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmReturn}
                  disabled={!!processingId}
                  className="flex-[2] py-4 rounded-2xl bg-purple-600 text-white text-sm font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={16} /> {processingId ? 'Memproses...' : 'Konfirmasi Kembali'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
