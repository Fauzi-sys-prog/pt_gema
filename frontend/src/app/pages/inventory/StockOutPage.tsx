import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  ArrowDownRight, 
  X, 
  Eye,
  FileText,
  History,
  Download,
  Warehouse
} from 'lucide-react';
import { useApp, type StockOut } from '../../contexts/AppContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
// Logo asset from user screenshot 1
import logoGema from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function StockOutPage() {
  const navigate = useNavigate();
  const { 
    stockOutList, 
    stockItemList, 
    stockMovementList,
    createStockOut,
    updateProject,
    currentUser,
    projectList,
    workOrderList
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStockOut, setSelectedStockOut] = useState<StockOut | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    type: 'Project Issue' as StockOut['type'],
    projectId: '',
    workOrderId: '',
    noWorkOrder: '',
    penerima: '',
    items: [{ kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '', hargaSatuan: 0 }],
    notes: '',
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
    { condition: showPrintView, close: () => setShowPrintView(false) },
  ]);


  const exportToWord = async () => {
    if (!selectedStockOut) return;
    
    // Function to convert image to base64 for embedding in Word
    const getBase64Image = async (imgUrl: string) => {
      try {
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to load logo for Word export", e);
        return "";
      }
    };

    const logoBase64 = await getBase64Image(logoGema);

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Surat Jalan</title>
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000; }
        .logo-img { width: 100px; height: auto; }
        .company-name { font-size: 14pt; font-weight: bold; margin-top: 15px; margin-bottom: 2px; }
        .company-address { font-size: 8pt; color: #333; margin: 0; line-height: 1.2; margin-bottom: 20px; }
        .doc-title { font-size: 20pt; font-weight: bold; text-align: right; }
        .doc-subtitle { font-size: 10pt; color: #666; text-align: right; margin-top: -5px; text-transform: uppercase; }
        
        .grid-table { width: 100%; border: none; margin-bottom: 20px; }
        .label-cell { font-size: 9pt; font-weight: bold; width: 15%; vertical-align: top; }
        .value-cell { font-size: 9pt; vertical-align: top; }
        .big-value { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
        
        .main-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 2px solid #000; }
        .main-table th { background-color: #000000; color: #ffffff; padding: 12px 10px; border: 1px solid #000; font-size: 9pt; text-transform: uppercase; text-align: center; }
        .main-table td { padding: 15px 10px; border: 1px solid #000; font-size: 9pt; vertical-align: middle; }
        .text-center { text-align: center; }
        
        .footer-table { width: 100%; border: none; margin-top: 80px; }
        .footer-table td { width: 33%; text-align: center; border: none; vertical-align: top; }
        .signature-line { font-weight: bold; font-size: 10pt; margin-bottom: 60px; }
        .signature-title { font-size: 9pt; color: #000; }
      </style>
      </head><body>
    `;
    
    const footer = "</body></html>";
    
    const content = `
      <table style="width:100%; border:none;">
        <tr>
          <td style="border:none;">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" width="100" />` : ''}
          </td>
          <td style="text-align: right; border:none; vertical-align: top;">
            <div class="doc-title">SURAT JALAN</div>
            <div class="doc-subtitle">DELIVERY ORDER</div>
          </td>
        </tr>
      </table>

      <div class="company-name">PT GEMA TEKNIK PERKASA</div>
      <p class="company-address">General Contractor & Industrial Maintenance Service<br/>Office: Central Industrial Park, Sidoarjo, Indonesia</p>

      <table class="grid-table">
        <tr>
          <td class="label-cell">Kepada Yth:</td>
          <td class="value-cell" style="width: 45%"></td>
          <td class="label-cell" style="text-align: right; width: 20%">No. Dokumen:</td>
          <td class="value-cell" style="text-align: right; font-weight: bold;">${selectedStockOut.noStockOut}</td>
        </tr>
        <tr>
          <td class="value-cell" colspan="2" style="padding-top: 5px;">
            <div class="big-value">${selectedStockOut.penerima}</div>
          </td>
          <td class="label-cell" style="text-align: right; padding-top: 5px;">Tanggal:</td>
          <td class="value-cell" style="text-align: right; font-weight: bold; padding-top: 5px;">${new Date(selectedStockOut.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</td>
        </tr>
        <tr>
          <td class="label-cell" style="padding-top: 15px;">PROYEK:</td>
          <td class="value-cell" style="padding-top: 15px; font-weight: bold;">${selectedStockOut.noWorkOrder || '-'}</td>
          <td colspan="2"></td>
        </tr>
      </table>
      
      <table class="main-table">
        <thead>
          <tr>
            <th style="width: 5%">NO</th>
            <th style="text-align: left">DESKRIPSI MATERIAL / SKU</th>
            <th style="width: 15%">JUMLAH</th>
            <th style="width: 15%">SATUAN</th>
          </tr>
        </thead>
        <tbody>
          ${selectedStockOut.items.map((item, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td>
                <div style="font-weight: bold; text-transform: uppercase;">${item.nama}</div>
                <div style="font-size: 7pt; color: #444; margin-top: 5px;">${item.kode} ${item.batchNo ? '| BATCH: ' + item.batchNo : ''}</div>
              </td>
              <td class="text-center"><strong>${item.qty}</strong></td>
              <td class="text-center">${item.unit.toUpperCase()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 5px; font-size: 10pt; font-weight: bold;">
        Catatan: <span style="font-weight: normal;">${selectedStockOut.notes || '-'}</span>
      </div>
      
      <table class="footer-table">
        <tr>
          <td>
            <div class="signature-line">( ${selectedStockOut.penerima.toLowerCase()} )</div>
            <div class="signature-title">Diterima Oleh</div>
          </td>
          <td>
            <div class="signature-line">( ............................ )</div>
            <div class="signature-title">Gudang</div>
          </td>
          <td>
            <div class="signature-line">( ............................ )</div>
            <div class="signature-title">Disetujui Oleh</div>
          </td>
        </tr>
      </table>
    `;

    const sourceHTML = header + content + footer;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Surat_Jalan_${selectedStockOut.noStockOut}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("File Word berhasil diunduh.");
  };

  const filteredStockOut = stockOutList.filter(so => {
    const noStockOut = so.noStockOut || so.id || '';
    const wo = so.noWorkOrder || '';
    const penerima = so.penerima || '';
    
    const matchSearch = noStockOut.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      penerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (so.items || []).some(item => item.nama?.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchType = filterType === 'all' || so.type === filterType;
    return matchSearch && matchType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // 1. Validations
    const project = projectList.find(p => p.id === formData.projectId);
    const workOrder = workOrderList.find(wo => wo.id === formData.workOrderId);
    if (formData.type === 'Project Issue' && !project) {
      toast.error('Project wajib dipilih untuk pemakaian proyek.');
      return;
    }
    if (workOrder && workOrder.projectId !== project?.id) {
      toast.error('Work Order tidak sesuai dengan project yang dipilih.');
      return;
    }
    
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
          const proceed = confirm(`⚠️ Warning: Jumlah pengeluaran (${item.qty} ${item.unit}) melebihi estimasi RAB/BOQ (${boqItem.qtyEstimate} ${boqItem.unit}).\n\nHal ini akan berdampak pada margin proyek. Lanjutkan?`);
          if (!proceed) return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // 2. Prepare Data
      const stockOut: StockOut = {
      id: `SO-${Date.now()}`,
      noStockOut: `SO-${new Date().getFullYear()}-${String(stockOutList.length + 1).padStart(3, '0')}`,
      noWorkOrder: workOrder?.woNumber || undefined,
      workOrderId: workOrder?.id,
      projectId: project?.id,
      penerima: formData.penerima,
      tanggal: formData.tanggal,
      type: formData.type,
      status: 'Posted',
      createdBy: currentUser?.fullName || 'User',
      items: formData.items.filter(item => item.nama && item.qty > 0).map(item => ({
        ...item,
        hargaSatuan: Number(item.hargaSatuan) || stockItemList.find(master => master.kode === item.kode)?.hargaSatuan || 0,
      })),
      notes: formData.notes,
    };
    
    // 3. Execution (Centralized in AppContext)
    createStockOut(stockOut);
    
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
    } catch (err) {
      toast.error('Gagal posting stok keluar: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      type: 'Project Issue',
      projectId: '',
      workOrderId: '',
      noWorkOrder: '',
      penerima: '',
      items: [{ kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '', hargaSatuan: 0 }],
      notes: '',
    });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { kode: '', nama: '', qty: 0, unit: '', lokasi: 'Gudang Utama', batchNo: '', hargaSatuan: 0 }],
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
      const stockItem = stockItemList.find(s => s.kode.toLowerCase() === value.toLowerCase());
      if (stockItem) {
        updatedItems[index].nama = stockItem.nama;
        updatedItems[index].unit = stockItem.satuan;
        updatedItems[index].lokasi = stockItem.lokasi;
        updatedItems[index].hargaSatuan = stockItem.hargaSatuan || 0;
        
        // FEFO: compute net qty per batch (IN minus OUT), pick oldest with remaining stock
        const itemMoves = stockMovementList.filter(m => m.itemKode === stockItem.kode && m.batchNo && m.batchNo !== '-');
        const batchMap = new Map<string, { qtyNet: number; expiryDate?: string; firstIn: string }>();
        itemMoves.forEach(m => {
          const key = m.batchNo!;
          const entry = batchMap.get(key) || { qtyNet: 0, expiryDate: m.expiryDate, firstIn: m.tanggal };
          entry.qtyNet += m.type === 'IN' ? m.qty : -m.qty;
          if (m.type === 'IN' && m.expiryDate) entry.expiryDate = m.expiryDate;
          if (m.type === 'IN' && m.tanggal < entry.firstIn) entry.firstIn = m.tanggal;
          batchMap.set(key, entry);
        });

        const availableBatches = Array.from(batchMap.entries())
          .filter(([, v]) => v.qtyNet > 0)
          .sort(([, a], [, b]) => {
            if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            return new Date(a.firstIn).getTime() - new Date(b.firstIn).getTime();
          });

        if (availableBatches.length > 0) {
          const [recommendedBatchNo, batchData] = availableBatches[0];
          updatedItems[index].batchNo = recommendedBatchNo;

          if (batchData.expiryDate) {
            const expDate = new Date(batchData.expiryDate);
            const today = new Date();
            const daysDiff = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 0) {
              toast.error(`Batch ${recommendedBatchNo} sudah EXPIRED (${batchData.expiryDate})`);
            } else if (daysDiff < 30) {
              toast.warning(`Batch ${recommendedBatchNo} akan expired dalam ${daysDiff} hari`);
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
            onClick={() => navigate('/inventory/center')}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Warehouse size={18} /> Monitoring Gudang
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
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-3">Project</label>
                  <div className="flex gap-2">
                    <select 
                      value={formData.projectId} 
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value, workOrderId: '', noWorkOrder: '' })} 
                      className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic uppercase tracking-tighter outline-none focus:border-indigo-500 transition-colors" 
                      required={formData.type === 'Project Issue'}
                    >
                      <option value="">-- Pilih Proyek --</option>
                      {projectList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.kodeProject} - {p.namaProject || p.customer}
                        </option>
                      ))}
                    </select>
                    {formData.projectId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const project = projectList.find(p => p.id === formData.projectId);
                          if (project && project.boq) {
                            const boqItems = project.boq
                              .filter(item => (item.status === 'Received' || item.status === 'Ordered' || item.status === 'Not Ordered'))
                              .map(item => ({
                                kode: item.itemKode || '',
                                nama: item.materialName,
                                qty: item.qtyEstimate,
                                unit: item.unit,
                                lokasi: 'Gudang Utama',
                                batchNo: '',
                                hargaSatuan: stockItemList.find(master => master.kode === item.itemKode)?.hargaSatuan || 0
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
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-4 mb-3">Work Order (opsional)</label>
                  <select
                    value={formData.workOrderId}
                    onChange={(e) => {
                      const workOrder = workOrderList.find(wo => wo.id === e.target.value);
                      setFormData({ ...formData, workOrderId: e.target.value, noWorkOrder: workOrder?.woNumber || '' });
                    }}
                    disabled={!formData.projectId}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-black italic uppercase tracking-tighter outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">-- Tanpa Work Order --</option>
                    {workOrderList.filter(wo => wo.projectId === formData.projectId).map(wo => (
                      <option key={wo.id} value={wo.id}>{wo.woNumber} - {wo.pekerjaan}</option>
                    ))}
                  </select>
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
                   <p className="text-xs font-black uppercase italic">{projectList.find(p => p.id === formData.projectId)?.kodeProject || 'GENERAL ISSUE'}</p>
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
                                stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.stok || 0 > 0 
                                  ? 'bg-emerald-50 text-emerald-600' 
                                  : 'bg-rose-50 text-rose-600'
                              }`}>
                                Stok: {stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.stok || 0}
                              </span>
                            )}
                            {item.kode && stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.expiryDate && (
                               <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                                 new Date(stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.expiryDate!) < new Date()
                                   ? 'bg-rose-600 text-white' 
                                   : 'bg-blue-50 text-blue-600'
                               }`}>
                                 Exp: {stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.expiryDate}
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
                            item.kode && (stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.stok || 0) <= 0
                              ? 'border-rose-300 focus:border-rose-500 text-rose-700 bg-rose-50/30'
                              : item.kode && stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.expiryDate && new Date(stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.expiryDate!) < new Date()
                                ? 'border-rose-600 bg-rose-50'
                                : stockItemList.some(s => s.kode.toLowerCase() === item.kode.toLowerCase())
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
                            item.kode && item.qty > (stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.stok || 0)
                              ? 'border-rose-400 text-rose-600 focus:border-rose-600'
                              : (projectList.find(p => p.id === formData.projectId)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) > 0 && item.qty > (projectList.find(p => p.id === formData.projectId)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0)
                                ? 'border-amber-400 text-amber-600'
                                : 'border-slate-100 focus:border-indigo-500'
                          }`}
                          required 
                        />
                        {item.kode && item.qty > (stockItemList.find(s => s.kode.toLowerCase() === item.kode.toLowerCase())?.stok || 0) && (
                          <span className="absolute text-[7px] text-rose-500 font-bold uppercase mt-1">Stok Kurang!</span>
                        )}
                        {(projectList.find(p => p.id === formData.projectId)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) > 0 && item.qty > (projectList.find(p => p.id === formData.projectId)?.boq?.find(b => b.itemKode === item.kode)?.qtyEstimate || 0) && (
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
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Memproses...' : 'Posting Pengeluaran'}</button>
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
                <p className="text-sm font-bold text-black mb-20 lowercase italic">( {selectedStockOut.penerima.toLowerCase()} )</p>
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
                onClick={exportToWord}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all"
              >
                <Download size={20} className="text-blue-200" /> Download MS Word
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
