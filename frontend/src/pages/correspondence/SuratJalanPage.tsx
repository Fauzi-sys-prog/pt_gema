import { useEffect, useState, useMemo } from 'react'; import { useApp } from '../../contexts/AppContext';
import type { SuratJalan } from '../../contexts/AppContext';
import { 
  Search, 
  Truck, 
  Plus, 
  Filter, 
  Eye, 
  Download, 
  ChevronRight, 
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
  UserCheck,
  AlertCircle,
  FileSignature,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function SuratJalanPage() {
  const navigate = useNavigate();
  const { 
    suratJalanList, 
    addSuratJalan, 
    projectList, 
    assetList,
    createStockOut,
    addAuditLog
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSJ, setSelectedSJ] = useState<SuratJalan | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archiveMode, setArchiveMode] = useState<'active' | 'archived'>('active');
  const [serverSuratJalanList, setServerSuratJalanList] = useState<SuratJalan[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<any[] | null>(null);
  const [serverAssetList, setServerAssetList] = useState<any[] | null>(null);
  const effectiveSuratJalanList = useMemo(() => {
    const byId = new Map<string, SuratJalan>();
    for (const sj of suratJalanList) byId.set(sj.id, sj);
    for (const sj of serverSuratJalanList || []) byId.set(sj.id, sj);
    return Array.from(byId.values());
  }, [suratJalanList, serverSuratJalanList]);
  const effectiveProjectList = useMemo(() => {
    const byId = new Map<string, any>();
    for (const project of projectList) byId.set(project.id, project);
    for (const project of serverProjectList || []) byId.set(project.id, project);
    return Array.from(byId.values());
  }, [projectList, serverProjectList]);
  const effectiveAssetList = useMemo(() => {
    const byId = new Map<string, any>();
    for (const asset of assetList || []) byId.set(asset.id, asset);
    for (const asset of serverAssetList || []) byId.set(asset.id, asset);
    return Array.from(byId.values());
  }, [assetList, serverAssetList]);

  const [formData, setFormData] = useState({
    noSurat: `SJ/${new Date().getFullYear()}/${(effectiveSuratJalanList.length + 1).toString().padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    sjType: 'Material Delivery' as 'Material Delivery' | 'Equipment Loan',
    projectId: '',
    assetId: '',
    tujuan: '',
    alamat: '',
    upPerson: '',
    sopir: '',
    noPolisi: '',
    pengirim: 'Gudang GTP',
    expectedReturnDate: '',
    items: [{ namaItem: '', itemKode: '', jumlah: 1, satuan: 'Pcs', batchNo: '', keterangan: '' }]
  });

  const generateBatchNo = () => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `GTP/${date}/${random}`;
  };

  const fetchSuratJalan = async () => {
    try {
      setIsRefreshing(true);
      const normalizeEntityRows = <T,>(rows: unknown): T[] => {
        if (!Array.isArray(rows)) return [];
        return rows.map((row: any) => {
          const payload = row?.payload;
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            return { id: row?.entityId || payload?.id, ...payload } as T;
          }
          return row as T;
        });
      };
      const [sjRes, projectRes] = await Promise.all([
        api.get('/surat-jalan'),
        api.get('/projects'),
      ]);
      const assetsRes = await api.get('/assets');
      const mapped = normalizeEntityRows<SuratJalan>(sjRes.data);
      const projects = Array.isArray(projectRes.data) ? projectRes.data : [];
      const assets = normalizeEntityRows<any>(assetsRes.data);
      setServerSuratJalanList(mapped);
      setServerProjectList(projects);
      setServerAssetList(assets);
    } catch {
      setServerSuratJalanList(null);
      setServerProjectList(null);
      setServerAssetList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuratJalan();
  }, []);

  const handleProjectChange = (projectId: string) => {
    const project = effectiveProjectList.find(p => p.id === projectId);
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

  const handleEquipmentAssetChange = (assetId: string) => {
    const asset = effectiveAssetList.find((a) => a.id === assetId);
    if (!asset) {
      setFormData((prev) => ({ ...prev, assetId: '', noPolisi: '' }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      assetId,
      projectId: asset.projectId || prev.projectId,
      noPolisi: asset.assetCode || prev.noPolisi,
      items:
        prev.items.length === 0
          ? [{ namaItem: asset.name || '', itemKode: asset.assetCode || '', jumlah: 1, satuan: 'Unit', batchNo: '', keterangan: '' }]
          : prev.items.map((item, idx) =>
              idx === 0
                ? {
                    ...item,
                    namaItem: asset.name || item.namaItem,
                    itemKode: asset.assetCode || item.itemKode,
                    satuan: item.satuan || 'Unit',
                  }
                : item
            ),
    }));
  };

  const handleCreateSJ = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.sjType === 'Equipment Loan' && !formData.assetId) {
      toast.error('Untuk Equipment Loan, pilih asset unit dulu.');
      return;
    }
    setIsSubmitting(true);

    const newSJ: SuratJalan = {
      id: `SJ-${Date.now()}`,
      ...formData,
      deliveryStatus: 'Pending',
      createdAt: new Date().toISOString()
    };

      // 1. Add Surat Jalan
      addSuratJalan(newSJ);

      // 2. Automated Stock Out (ONLY for Material Delivery, skip for Equipment Loan)
      if (formData.sjType === 'Material Delivery') {
      const stockOutItems = formData.items
        .filter(item => item.itemKode && item.jumlah > 0)
        .map(item => ({
          kode: item.itemKode,
          nama: item.namaItem,
          qty: item.jumlah,
          satuan: item.satuan,
          batchNo: item.batchNo
        }));

      if (stockOutItems.length > 0) {
        const newStockOut = {
          id: `SO-${Date.now()}`,
          noStockOut: `SO-AUTO-${formData.noSurat.replace(/\//g, '-')}`,
          projectId: formData.projectId,
          projectName: effectiveProjectList.find((p) => p.id === formData.projectId)?.namaProject || undefined,
          penerima: formData.sopir || 'Logistics Officer',
          tanggal: formData.tanggal,
          type: 'Project Issue' as const,
          status: 'Posted' as const,
          createdBy: 'Logistics Command Center',
          items: stockOutItems,
          notes: `Auto-generated from SJ ${formData.noSurat}`
        };
        // Centralized stock logic is handled inside createStockOut (inventory + movement + API sync)
        createStockOut(newStockOut as any);
      }
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
      noSurat: `SJ/${new Date().getFullYear()}/${(effectiveSuratJalanList.length + 2).toString().padStart(3, '0')}`,
      tanggal: new Date().toISOString().split('T')[0],
      sjType: 'Material Delivery',
      projectId: '',
      assetId: '',
      tujuan: '',
      alamat: '',
      upPerson: '',
      sopir: '',
      noPolisi: '',
      pengirim: 'Gudang GTP',
      expectedReturnDate: '',
      items: [{ namaItem: '', itemKode: '', jumlah: 1, satuan: 'Pcs', batchNo: '', keterangan: '' }]
    });
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
    return effectiveSuratJalanList.filter(sj => 
      (
        (sj.noSurat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sj.tujuan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sj.sopir || "").toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (
        archiveMode === 'active'
          ? sj.deliveryStatus !== 'Delivered' && sj.deliveryStatus !== 'Returned'
          : sj.deliveryStatus === 'Delivered' || sj.deliveryStatus === 'Returned'
      )
    );
  }, [effectiveSuratJalanList, searchTerm, archiveMode]);

  const handlePrint = () => {
    toast.success('Mengirim ke antrian cetak...');
    window.print();
  };

  const handleDownloadWord = async () => {
    if (!selectedSJ) return;
    const id = String(selectedSJ.id || '').trim();
    if (!id) {
      toast.error('ID Surat Jalan tidak valid untuk export');
      return;
    }
    const safeNo = String(selectedSJ.noSurat || id).replace(/[^\w.-]+/g, '_');
    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/surat-jalan/${id}/word`, { responseType: 'blob' }),
        api.get(`/exports/surat-jalan/${id}/excel`, { responseType: 'blob' }),
      ]);
      const wordBlob = new Blob([wordResponse.data], { type: 'application/msword' });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `surat_jalan_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `surat_jalan_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);
      toast.success('Export Word + Excel Surat Jalan berhasil');
    } catch {
      toast.error('Export Word + Excel Surat Jalan gagal');
    }
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
            onClick={fetchSuratJalan}
            disabled={isRefreshing}
            className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> Refresh
          </button>
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
          { label: 'Material Delivery', val: effectiveSuratJalanList.filter(s => s.sjType === 'Material Delivery').length, color: 'text-indigo-600', icon: <Package size={24} />, bg: 'bg-white' },
          { label: 'Equipment Loan', val: effectiveSuratJalanList.filter(s => s.sjType === 'Equipment Loan').length, color: 'text-purple-600', icon: <Layers size={24} />, bg: 'bg-white' },
          { label: 'Live Delivery', val: effectiveSuratJalanList.filter(s => s.deliveryStatus === 'In Transit').length, color: 'text-amber-600', icon: <Truck size={24} />, bg: 'bg-white' },
          { label: 'Completed', val: effectiveSuratJalanList.filter(s => s.deliveryStatus === 'Delivered').length, color: 'text-emerald-600', icon: <CheckCircle2 size={24} />, bg: 'bg-white' },
          { label: 'Overdue Return', val: effectiveSuratJalanList.filter(s => s.sjType === 'Equipment Loan' && s.returnStatus === 'Pending').length, color: 'text-rose-600', icon: <AlertCircle size={24} />, bg: 'bg-rose-50' },
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
             <button
               onClick={() => setArchiveMode('active')}
               className={`px-4 sm:px-6 py-2 sm:py-3 text-[10px] font-black uppercase rounded-xl shadow-sm whitespace-nowrap transition-all ${
                 archiveMode === 'active'
                   ? 'bg-white text-indigo-600 border border-indigo-100'
                   : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               Active
             </button>
             <button
               onClick={() => setArchiveMode('archived')}
               className={`px-4 sm:px-6 py-2 sm:py-3 text-[10px] font-black uppercase rounded-xl shadow-sm whitespace-nowrap transition-all ${
                 archiveMode === 'archived'
                   ? 'bg-white text-indigo-600 border border-indigo-100'
                   : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               Archived
             </button>
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
                  <td className="px-10 py-8 text-center">
                    <span className={`inline-flex px-6 py-2 rounded-full text-[9px] font-black uppercase italic border-2 ${getStatusColor(sj.deliveryStatus)}`}>
                      {sj.deliveryStatus || 'Pending'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex justify-end gap-2">
                       <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/logistics/delivery/${sj.id}`);
                          }}
                          className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all shadow-sm"
                       >
                          <QrCode size={20} />
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
      <AnimatePresence>
        {showPreview && selectedSJ && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-start justify-center p-4 overflow-y-auto">
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
                <div className="flex gap-4">
                   <button 
                     onClick={() => {
                       navigate('/surat-menyurat/berita-acara');
                       toast.info('Silakan gunakan Auto-fill dari Surat Jalan untuk generate BAST');
                     }}
                     className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl hover:shadow-lg transition-all flex items-center gap-2 text-sm font-black uppercase"
                   >
                      <FileSignature size={20} /> Generate BAST
                   </button>
                   <button onClick={handlePrint} className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all shadow-sm">
                      <Printer size={24} />
                   </button>
                   <button onClick={handleDownloadWord} className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="Export Word + Excel">
                      <Download size={24} />
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
      </AnimatePresence>
      
      {/* Create SJ Modal (Commander View) */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-5xl rounded-[4rem] overflow-hidden shadow-2xl flex flex-col h-[95vh] max-h-[95vh] my-auto"
            >
              <form onSubmit={handleCreateSJ} className="flex flex-col h-full min-h-0">
                <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl -rotate-3">
                      <Plus size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Commander Dispatch Interface</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Zero Re-typing Logistics Automation</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="p-4 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border border-slate-100">
                    <X size={24} />
                  </button>
                </div>

                <div className="px-12 pt-4 pb-2 bg-white border-b border-slate-100 shrink-0">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                    <ChevronRight size={12} className="rotate-90" /> Scroll untuk lanjut isi form
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden custom-scrollbar p-12 pt-6 pr-8">
                  {/* TYPE TOGGLE - NEW */}
                  <div className="mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-[2.5rem] shadow-2xl">
                    <h4 className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-6 italic">Pilih Jenis Dokumen Surat Jalan:</h4>
                    <div className="flex gap-6">
                      <label className={`flex-1 p-8 rounded-[2rem] border-4 cursor-pointer transition-all ${formData.sjType === 'Material Delivery' ? 'bg-white border-white shadow-2xl' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                        <input 
                          type="radio" 
                          name="sjType" 
                          value="Material Delivery" 
                          checked={formData.sjType === 'Material Delivery'}
                          onChange={(e) => setFormData({...formData, sjType: e.target.value as 'Material Delivery' | 'Equipment Loan'})}
                          className="hidden"
                        />
                        <div className="flex items-center gap-4">
                          <Package size={32} className={formData.sjType === 'Material Delivery' ? 'text-indigo-600' : 'text-white'} />
                          <div>
                            <h5 className={`text-sm font-black uppercase italic ${formData.sjType === 'Material Delivery' ? 'text-slate-900' : 'text-white'}`}>Material Delivery</h5>
                            <p className={`text-[9px] font-bold uppercase mt-1 ${formData.sjType === 'Material Delivery' ? 'text-slate-400' : 'text-white/60'}`}>Untuk pengiriman material project (auto stock out)</p>
                          </div>
                        </div>
                      </label>
                      <label className={`flex-1 p-8 rounded-[2rem] border-4 cursor-pointer transition-all ${formData.sjType === 'Equipment Loan' ? 'bg-white border-white shadow-2xl' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                        <input 
                          type="radio" 
                          name="sjType" 
                          value="Equipment Loan" 
                          checked={formData.sjType === 'Equipment Loan'}
                          onChange={(e) => setFormData({...formData, sjType: e.target.value as 'Material Delivery' | 'Equipment Loan'})}
                          className="hidden"
                        />
                        <div className="flex items-center gap-4">
                          <Layers size={32} className={formData.sjType === 'Equipment Loan' ? 'text-purple-600' : 'text-white'} />
                          <div>
                            <h5 className={`text-sm font-black uppercase italic ${formData.sjType === 'Equipment Loan' ? 'text-slate-900' : 'text-white'}`}>Equipment Loan</h5>
                            <p className={`text-[9px] font-bold uppercase mt-1 ${formData.sjType === 'Equipment Loan' ? 'text-slate-400' : 'text-white/60'}`}>Untuk pinjam/rental alat kerja (tracking return)</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                    <div className="space-y-8">
                      <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 italic flex items-center gap-2">
                             <Layers size={14} /> {formData.sjType === 'Material Delivery' ? 'Project Intelligence Link' : 'Manual Entry'}
                          </h4>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Connect to Project Record</label>
                            <select 
                              value={formData.projectId}
                              onChange={(e) => handleProjectChange(e.target.value)}
                              className="w-full px-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none ring-2 ring-indigo-100 focus:ring-4 focus:ring-indigo-200 transition-all appearance-none"
                            >
                              <option value="">-- Manual Input / Search Project --</option>
                              {effectiveProjectList.map(p => (
                                <option key={p.id} value={p.id}>{p.namaProject} ({p.customer})</option>
                              ))}
                            </select>
                          </div>
                          {formData.sjType === 'Equipment Loan' && (
                            <div className="space-y-2 mt-5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Asset Unit</label>
                              <select
                                value={formData.assetId}
                                onChange={(e) => handleEquipmentAssetChange(e.target.value)}
                                className="w-full px-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none ring-2 ring-indigo-100 focus:ring-4 focus:ring-indigo-200 transition-all appearance-none"
                              >
                                <option value="">-- Select Asset Unit --</option>
                                {effectiveAssetList.map((asset) => (
                                  <option key={asset.id} value={asset.id}>
                                    {asset.assetCode} - {asset.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                       </div>

                       <div className="space-y-6 px-2">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document No.</label>
                              <input type="text" required value={formData.noSurat} onChange={(e) => setFormData({...formData, noSurat: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dispatch Date</label>
                              <input type="date" required value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consignee Name</label>
                            <input type="text" required placeholder="PT Example Indonesia" value={formData.tujuan} onChange={(e) => setFormData({...formData, tujuan: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Destination Address</label>
                            <textarea required placeholder="Full site address..." value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} rows={3} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-100 transition-all resize-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UP/ (Attention To)</label>
                            <input type="text" placeholder="Contact person name (optional)" value={formData.upPerson} onChange={(e) => setFormData({...formData, upPerson: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                          </div>
                          {formData.sjType === 'Equipment Loan' && (
                            <div className="space-y-2 bg-amber-50 p-6 rounded-2xl border border-amber-200">
                              <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Clock size={12} /> Expected Return Date
                              </label>
                              <input type="date" required value={formData.expectedReturnDate} onChange={(e) => setFormData({...formData, expectedReturnDate: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-amber-200 transition-all" />
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="space-y-8">
                       <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 italic flex items-center gap-2">
                             <Truck size={14} /> Logistics Assignment
                          </h4>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                {formData.sjType === 'Material Delivery' ? 'Assign Driver / Officer' : 'PIC Pembuat Surat'}
                              </label>
                              <input type="text" required placeholder="Full Name" value={formData.sopir} onChange={(e) => setFormData({...formData, sopir: e.target.value})} className="w-full px-6 py-4 bg-white/5 border-none rounded-2xl text-sm font-bold uppercase italic text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500 transition-all" />
                            </div>
                            {formData.sjType === 'Material Delivery' && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vehicle Plate No.</label>
                                <input type="text" required placeholder="B 1234 GTP" value={formData.noPolisi} onChange={(e) => setFormData({...formData, noPolisi: e.target.value})} className="w-full px-6 py-4 bg-white/5 border-none rounded-2xl text-sm font-bold uppercase italic text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500 transition-all" />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                {formData.sjType === 'Material Delivery' ? 'Dispatch Authority (Signer)' : 'Pihak Menyetujui'}
                              </label>
                              <input type="text" required value={formData.pengirim} onChange={(e) => setFormData({...formData, pengirim: e.target.value})} className="w-full px-6 py-4 bg-white/5 border-none rounded-2xl text-sm font-bold uppercase italic text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500 transition-all" />
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Items Grid */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-[12px] font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-3">
                        <Package className="text-indigo-600" size={20} /> 
                        {formData.sjType === 'Material Delivery' ? 'Material Manifest Content' : 'Daftar Peralatan / Equipment List'}
                      </h4>
                      <button type="button" onClick={addItem} className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-all">
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                      {formData.items.map((item, idx) => (
                        <div key={idx} className={`grid ${formData.sjType === 'Material Delivery' ? 'grid-cols-12' : 'grid-cols-11'} gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group`}>
                          <div className={formData.sjType === 'Material Delivery' ? 'col-span-5' : 'col-span-4'}>
                            <input type="text" required placeholder={formData.sjType === 'Material Delivery' ? 'Material Description' : 'Nama Barang / Equipment'} value={item.namaItem} onChange={(e) => updateItem(idx, 'namaItem', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border-none rounded-lg text-xs font-black uppercase italic outline-none" />
                          </div>
                          <div className="col-span-2 text-center">
                            <input type="number" required placeholder="Qty" value={item.jumlah} onChange={(e) => updateItem(idx, 'jumlah', parseFloat(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border-none rounded-lg text-xs font-black text-center outline-none" />
                          </div>
                          <div className="col-span-2">
                            <input type="text" required placeholder="Unit" value={item.satuan} onChange={(e) => updateItem(idx, 'satuan', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border-none rounded-lg text-xs font-black uppercase text-center outline-none" />
                          </div>
                          {formData.sjType === 'Material Delivery' ? (
                            <div className="col-span-2">
                              <input type="text" placeholder="Batch ID" value={item.batchNo} readOnly className="w-full px-4 py-2 bg-indigo-50 border-none rounded-lg text-[9px] font-black text-indigo-600 uppercase text-center outline-none" />
                            </div>
                          ) : (
                            <div className="col-span-3">
                              <input type="text" placeholder="Keterangan (optional)" value={item.keterangan || ''} onChange={(e) => updateItem(idx, 'keterangan', e.target.value)} className="w-full px-4 py-2 bg-amber-50 border-none rounded-lg text-[9px] font-bold italic outline-none" />
                            </div>
                          )}
                          <div className="col-span-1 text-right">
                            <button type="button" onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-12 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 sticky bottom-0">
                  <button type="submit" disabled={isSubmitting} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 flex items-center gap-4 hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {isSubmitting ? <Activity className="animate-spin" size={20} /> : <Truck size={20} />}
                    Finalize & Dispatch Manifest
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
