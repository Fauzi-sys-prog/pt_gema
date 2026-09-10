import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  User,
  Clock,
  Settings as Machine,
  ChevronRight,
  Printer,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  X,
  Target,
  Briefcase,
  BookOpen,
  FileDown
} from 'lucide-react';
import { useApp, type ProductionReport, type WorkOrder } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { 
  exportDataCollectionToWord, 
  exportSPKToWord, 
  exportLHPToWord 
} from "../../utils/exportToWord";
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function ProductionReportPage() {
  const {
    productionReportList,
    addProductionReport,
    workOrderList,
    assetList,
    createStockOut,
    stockItemList,
  } = useApp();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [lhpTeknisiList, setLhpTeknisiList] = useState<string[]>([]);
  const [newTeknisiInput, setNewTeknisiInput] = useState('');
  const [manualMaterials, setManualMaterials] = useState<{ itemId: string; qty: number }[]>([{ itemId: '', qty: 0 }]);

  // WO baru berstatus Draft juga harus dapat dipilih untuk input LHP awal.
  // Setelah LHP tersimpan, engine produksi akan menaikkan status/progress WO.
  const activeWorkOrders = workOrderList.filter(wo => ['Draft', 'In Progress', 'QC'].includes(wo.status));

  const [newReport, setNewReport] = useState<Partial<ProductionReport & { woId?: string, selectedItem?: string }>>({
    tanggal: new Date().toISOString().split('T')[0],
    shift: '1',
    workshop: 'Gema Teknik Workshop',
    unit: 'Pcs',
    startTime: '08:00',
    endTime: '17:00'
  });

  useEscapeKey([
    { condition: showAddModal, close: () => setShowAddModal(false) },
  ]);

  
  // Only show machines that are Available OR currently used by the selected WO
  const availableAssets = useMemo(() => {
    const selectedWO = workOrderList.find(w => w.id === newReport.woId);
    return assetList.filter(a => 
      (a.category === 'Machine' || a.category === 'Heavy Equipment') && 
      (a.status === 'Available' || a.id === selectedWO?.machineId || a.id === newReport.machineId)
    );
  }, [assetList, newReport.woId, newReport.machineId, workOrderList]);

  const filteredReports = productionReportList.filter(report => 
    report.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.activity.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const handleWOSelect = (woId: string) => {
    const wo = workOrderList.find(w => w.id === woId);
    if (wo) {
      setNewReport(prev => ({
        ...prev,
        woId: wo.id,
        selectedItem: 'auto',
        namaBarang: wo.itemToProduce,
        activity: `Produksi ${wo.itemToProduce} (${wo.woNumber})`,
        unit: wo.bom?.[0]?.unit || 'Unit',
        nomorSPK: wo.nomorSPK || '',
      } as any));
      // Auto-fill teknisi from WO
      const fromRows = (wo.teknisiRows as any[])?.map((r: any) => r.nama).filter(Boolean) || [];
      const fromLead = wo.leadTechnician ? [wo.leadTechnician] : [];
      setLhpTeknisiList(fromRows.length > 0 ? fromRows : fromLead);
    } else {
      setNewReport(prev => ({
        ...prev,
        woId: undefined,
        selectedItem: '',
        namaBarang: '',
        activity: '',
        unit: 'Pcs',
        nomorSPK: '',
      } as any));
      setLhpTeknisiList([]);
    }
  };

  // Auto-open form with pre-selected WO when navigated from project detail / control center
  useEffect(() => {
    const woId = (location.state as any)?.woId;
    if (woId) {
      handleWOSelect(woId);
      setShowAddModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItemSelect = (itemName: string) => {
    const wo = workOrderList.find(w => w.id === newReport.woId);
    if (wo) {
      const bomItem = wo.bom?.find(b => b.nama === itemName);
      setNewReport({
        ...newReport,
        selectedItem: itemName,
        unit: bomItem?.unit || (itemName ? 'Pcs' : 'Unit'),
        activity: itemName 
          ? `Pengerjaan ${itemName} untuk ${wo.itemToProduce} (${wo.woNumber})`
          : `Produksi ${wo.itemToProduce} (${wo.woNumber})`
      });
    }
  };

  const handleAddReport = async () => {
    const resolvedWorker = lhpTeknisiList.length > 0 ? lhpTeknisiList.join(', ') : newTeknisiInput.trim();
    if (!resolvedWorker || !newReport.activity || !newReport.outputQty) {
      toast.error('Mohon lengkapi data teknisi, aktivitas, dan qty');
      return;
    }

    const selectedWO = workOrderList.find(w => w.id === newReport.woId);

    const report: ProductionReport = {
      id: `lhp-${Date.now()}`,
      tanggal: newReport.tanggal!,
      shift: newReport.shift!,
      workshop: newReport.workshop!,
      workerName: resolvedWorker,
      activity: newReport.activity!,
      machineNo: newReport.machineId,
      startTime: newReport.startTime || '08:00',
      endTime: newReport.endTime || '17:00',
      outputQty: Number(newReport.outputQty),
      unit: newReport.unit!,
      remarks: newReport.remarks || 'Selesai',
      photoUrl: newReport.photoUrl
    };

    const finalReport = {
      ...report,
      projectId: selectedWO?.projectId,
      workOrderId: selectedWO?.id,
      woNumber: selectedWO?.woNumber,
      nomorSPK: (newReport as any).nomorSPK || selectedWO?.nomorSPK || undefined,
      selectedItem: newReport.selectedItem,
      namaBarang: (newReport as any).namaBarang || undefined,
      // Manual LHP (no WO) goes straight to QC queue
      qcStatus: selectedWO ? undefined : 'Pending' as const,
    };

    try {
      await addProductionReport(finalReport as any);
    } catch {
      return;
    }

    // Manual mode: deduct selected stock items directly
    if (!newReport.woId) {
      const deductItems = manualMaterials
        .filter(m => m.itemId && m.qty > 0)
        .map(m => {
          const si = stockItemList.find(s => s.id === m.itemId);
          return si ? { kode: si.kode, nama: si.nama, qty: m.qty, satuan: si.satuan } : null;
        })
        .filter(Boolean) as { kode: string; nama: string; qty: number; satuan: string }[];

      if (deductItems.length > 0) {
        createStockOut({
          id: `SO-LHP-${Date.now()}`,
          noStockOut: `SO-LHP-${report.id}`,
          penerima: resolvedWorker,
          tanggal: report.tanggal,
          type: 'Project Issue',
          status: 'Posted',
          createdBy: resolvedWorker,
          items: deductItems,
          notes: `LHP Manual: ${report.activity}`,
        } as any);
      }
    }

    setShowAddModal(false);
    resetForm();
    toast.success('LHP berhasil disimpan. Stok bahan baku telah dipotong otomatis dan progress diperbarui!');
  };

  const resetForm = () => {
    setNewReport({
      tanggal: new Date().toISOString().split('T')[0],
      shift: '1',
      workshop: 'Gema Teknik Workshop',
      unit: 'Pcs',
      startTime: '08:00',
      endTime: '17:00'
    });
    setLhpTeknisiList([]);
    setNewTeknisiInput('');
    setManualMaterials([{ itemId: '', qty: 0 }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File terlalu besar. Maksimal 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setNewReport({ ...newReport, photoUrl: reader.result as string });
        toast.success('Foto berhasil diambil dari device');
      };
      reader.readAsDataURL(file);
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Laporan Harian Produksi (LHP)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Workshop Progress & Productivity Logs</p>
          </div>
        </div>
        <div className="flex gap-3 print:hidden">
          <Link 
            to="/produksi/guide"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black shadow-lg transition-all"
          >
            <BookOpen size={18} /> Guide
          </Link>
          <button 
            onClick={() => {
              if (productionReportList.length > 0) {
                exportLHPToWord(productionReportList[0]);
              } else {
                toast.error('Belum ada data laporan untuk di-export!');
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-sm"
          >
            <FileDown size={18} />
            Export Word
          </button>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-black hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:scale-95"
          >
            <Plus size={18} />
            Input LHP Baru
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div className="relative w-80">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Laporan (Teknisi/Aktivitas)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm font-bold text-black border border-slate-200 focus:border-rose-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
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
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal & Shift</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">No. SPK</th>
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
                      {(report as any).nomorSPK ? (
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-wide">
                          {(report as any).nomorSPK}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-black text-xs">
                          {report.workerName.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{report.workerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 leading-tight">{report.activity}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(report as any).woNumber ? (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black border border-blue-100">
                              {(report as any).woNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wide">
                              Tanpa WO
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{report.workshop}</span>
                          {report.machineNo && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black">
                              {assetList.find(a => a.id === report.machineNo || a.assetCode === report.machineNo)?.name || report.machineNo}
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
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Output</p>
              <p className="text-2xl font-black">{productionReportList.reduce((sum, r) => sum + r.outputQty, 0)} <span className="text-xs text-slate-500 font-bold uppercase">Unit</span></p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mesin Beroperasi</p>
              <p className="text-2xl font-black">{new Set(productionReportList.filter(r => r.machineNo).map(r => r.machineNo)).size} <span className="text-xs text-slate-500 font-bold uppercase">Unit</span></p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Teknisi Aktif</p>
              <p className="text-2xl font-black">{new Set(productionReportList.map(r => r.workerName)).size} <span className="text-xs text-slate-500 font-bold uppercase">Orang</span></p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Buat Laporan Harian (LHP)</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Input Progress Pekerjaan Workshop</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setNewReport({
                      ...newReport,
                      woId: workOrderList.find(wo => wo.woNumber === 'WO-2026-001')?.id,
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
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                  <Camera size={14} /> Simulasi dari Foto
                </button>
                <button onClick={() => setShowAddModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-7">

              {/* ── SECTION 1: IDENTITAS PEKERJAAN ── */}
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">① Identitas Pekerjaan</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Order</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.woId || ''}
                      onChange={(e) => handleWOSelect(e.target.value)}
                    >
                      <option value="">-- Manual (tanpa WO) --</option>
                      {activeWorkOrders.map(wo => (
                        <option key={wo.id} value={wo.id}>{wo.woNumber}{wo.nomorSPK ? ` — SPK: ${wo.nomorSPK}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. SPK</label>
                    <input
                      type="text"
                      placeholder="Contoh: SPK/GTP/2026/001"
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={(newReport as any).nomorSPK || ''}
                      onChange={(e) => setNewReport({ ...newReport, nomorSPK: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Barang / Item yang Dikerjakan <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="Contoh: Castable Refractory, Brick Lining, Repair Boiler..."
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={(newReport as any).namaBarang || ''}
                      onChange={(e) => setNewReport({ ...newReport, namaBarang: e.target.value } as any)}
                    />
                  </div>
                </div>

              </div>

              {/* ── SECTION 2: PELAKSANA & WAKTU ── */}
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">② Pelaksana & Waktu</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Teknisi Pelaksana <span className="text-rose-400">*</span>
                      {lhpTeknisiList.length > 0 && (
                        <span className="ml-2 text-blue-500 normal-case font-bold">({lhpTeknisiList.length} orang)</span>
                      )}
                    </label>
                    {/* Chips */}
                    {lhpTeknisiList.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {lhpTeknisiList.map((nama, idx) => (
                          <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-black text-blue-700 uppercase tracking-wide">
                            <User size={11} />
                            {nama}
                            <button
                              type="button"
                              onClick={() => setLhpTeknisiList(prev => prev.filter((_, i) => i !== idx))}
                              className="ml-0.5 text-blue-400 hover:text-rose-500 transition-colors"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Add teknisi input */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder={lhpTeknisiList.length === 0 ? "Nama teknisi..." : "Tambah teknisi lain..."}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                          value={newTeknisiInput}
                          onChange={(e) => setNewTeknisiInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nama = newTeknisiInput.trim();
                              if (nama && !lhpTeknisiList.includes(nama)) {
                                setLhpTeknisiList(prev => [...prev, nama]);
                                setNewTeknisiInput('');
                              }
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nama = newTeknisiInput.trim();
                          if (nama && !lhpTeknisiList.includes(nama)) {
                            setLhpTeknisiList(prev => [...prev, nama]);
                            setNewTeknisiInput('');
                          }
                        }}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-colors"
                      >
                        + Add
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 ml-1 mt-1">Tekan Enter atau klik + Add. Jika ada WO, nama teknisi otomatis terisi dari WO.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.shift}
                      onChange={(e) => setNewReport({ ...newReport, shift: e.target.value })}
                    >
                      <option value="1">Shift 1</option>
                      <option value="2">Shift 2</option>
                      <option value="3">Shift 3</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.tanggal}
                      onChange={(e) => setNewReport({ ...newReport, tanggal: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Workshop / Lokasi</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.workshop}
                      onChange={(e) => setNewReport({ ...newReport, workshop: e.target.value })}
                    >
                      <option value="Gema Teknik Workshop">Gema Teknik Workshop</option>
                      <option value="Project Site">Project Site</option>
                      <option value="External Workshop">External Workshop</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mesin / Alat</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-blue-500 transition-colors outline-none"
                      value={newReport.machineId || ''}
                      onChange={(e) => setNewReport({ ...newReport, machineId: e.target.value })}
                    >
                      <option value="">-- Tanpa Mesin --</option>
                      {availableAssets.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.status})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: HASIL KERJA ── */}
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">③ Hasil Kerja</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Aktivitas</label>
                    <textarea
                      rows={2}
                      placeholder="Detail progres yang dikerjakan hari ini..."
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none resize-none"
                      value={newReport.activity || ''}
                      onChange={(e) => setNewReport({ ...newReport, activity: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Output Qty <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                        <input
                          type="number"
                          placeholder="0"
                          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-black focus:border-rose-500 transition-colors outline-none"
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
                        placeholder="Contoh: Selesai / Kurang Material / On Progress"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                        value={newReport.remarks || ''}
                        onChange={(e) => setNewReport({ ...newReport, remarks: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION 4: MATERIAL TERPAKAI ── */}
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">④ Material Terpakai <span className="text-slate-300 normal-case font-medium">(stok berkurang sesuai output LHP)</span></p>

                {newReport.woId ? (
                  /* WO mode — pilih dari BOM WO */
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Item BOM</label>
                    <select
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                      value={newReport.selectedItem || ''}
                      onChange={(e) => handleItemSelect(e.target.value)}
                    >
                      <option value="auto">-- Auto-Deduct Semua BOM --</option>
                      {workOrderList.find(w => w.id === newReport.woId)?.bom?.map((item, idx) => (
                        <option key={idx} value={item.nama}>{item.nama} — {item.qty} {item.unit}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 ml-1">Auto memakai seluruh BOM secara proporsional terhadap output LHP. Pilih item tertentu hanya jika pemakaian hari ini memang terbatas pada item tersebut.</p>
                  </div>
                ) : (
                  /* Manual mode — pilih bebas dari stockItemList */
                  <div className="space-y-3">
                    {manualMaterials.map((row, idx) => {
                      const selectedStock = stockItemList.find(s => s.id === row.itemId);
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_5rem_2rem] gap-2 items-center">
                          <select
                            className="w-full px-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black focus:border-rose-500 transition-colors outline-none"
                            value={row.itemId}
                            onChange={(e) => {
                              const updated = [...manualMaterials];
                              updated[idx] = { ...updated[idx], itemId: e.target.value };
                              setManualMaterials(updated);
                            }}
                          >
                            <option value="">-- Pilih material --</option>
                            {stockItemList.map(s => (
                              <option key={s.id} value={s.id}>{s.nama} (stok: {s.stok} {s.satuan})</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            placeholder="Qty"
                            className="w-full px-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-black text-center focus:border-rose-500 outline-none"
                            value={row.qty || ''}
                            onChange={(e) => {
                              const updated = [...manualMaterials];
                              updated[idx] = { ...updated[idx], qty: Number(e.target.value) };
                              setManualMaterials(updated);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setManualMaterials(prev => prev.filter((_, i) => i !== idx))}
                            disabled={manualMaterials.length === 1}
                            className="flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-20"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setManualMaterials(prev => [...prev, { itemId: '', qty: 0 }])}
                      className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                    >
                      + Tambah Material
                    </button>
                    <p className="text-[9px] text-slate-400">Pilih item dari gudang yang dipakai. Stok akan terpotong otomatis saat LHP disimpan.</p>
                  </div>
                )}
              </div>

              {/* ── SECTION 5: BUKTI FOTO ── */}
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">⑤ Bukti Foto</p>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                      {newReport.photoUrl ? (
                        <ImageWithFallback src={newReport.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={22} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Evidence Foto Hasil Kerja</h4>
                      <p className="text-[9px] text-slate-400 font-bold">Opsional — untuk verifikasi QC</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={triggerCamera}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all"
                  >
                    {newReport.photoUrl ? 'Ganti Foto' : 'Ambil Foto'}
                  </button>
                </div>
              </div>

            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4 sticky bottom-0">
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
                SIMPAN & UPDATE PROGRESS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Foto Fullscreen */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-8" onClick={() => setSelectedPhoto(null)}>
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
