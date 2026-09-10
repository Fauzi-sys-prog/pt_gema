import React, { useState, useRef, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Camera,
  FileText,
  User,
  Clock,
  ArrowRight,
  Info,
  Maximize2,
  Printer,
  Plus,
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { useApp, type QCInspection, type WorkOrder, type DimensionMeasurement } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { InspectionReportPrint } from '../../components/InspectionReportPrint';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function QCInspectionPage() {
  const { workOrderList, qcInspectionList, addQCInspection, updateWorkOrder, productionReportList, updateProductionReport, stockItemList, extraCategories } = useApp();
  const warehouseCategories = useMemo(() => [...new Set([
    ...(extraCategories || []),
    ...(stockItemList || []).map(item => item.kategori).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [extraCategories, stockItemList]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<QCInspection | null>(null);
  const drawingFileRef = useRef<HTMLInputElement>(null);

  const handleDrawingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File terlalu besar. Maksimal 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setNewInspection(prev => ({ ...prev, drawingUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const [newInspection, setNewInspection] = useState<Partial<QCInspection>>({
    tanggal: new Date().toISOString().split('T')[0],
    visualCheck: true,
    dimensionCheck: true,
    materialCheck: true,
    status: 'Passed',
    notes: '',
    customerName: '',
    remark: '',
    dimensions: [],
    sendToWarehouse: true,
    warehouseLocation: 'Gudang Barang Jadi',
    stockCategory: ''
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showPrintPreview, close: () => setShowPrintPreview(false) },
  ]);


  // A WO is normally moved to `QC` by the production-output transaction.  Keep
  // a defensive fallback for legacy/local reports where the status projection
  // may lag behind: a linked report that has reached the target quantity should
  // still be visible in the QC queue (unless it was already completed).
  const waitingForQC = workOrderList.filter(wo => {
    if (wo.status === 'QC') return true;
    if (wo.status === 'Completed') return false;
    const linkedOutput = productionReportList
      .filter(report => (report as any).workOrderId === wo.id || (report as any).woNumber === wo.woNumber)
      .reduce((sum, report) => sum + (Number(report.outputQty) || 0), 0);
    return linkedOutput >= (Number(wo.targetQty) || 0) && linkedOutput > 0;
  });
  const manualLHPQueue = productionReportList.filter(r => !r.woNumber && (r as any).qcStatus === 'Pending');
  const [qcTab, setQcTab] = useState<'wo' | 'manual'>('wo');
  
  const filteredInspections = qcInspectionList.filter(inspection => 
    inspection.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.itemNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.woNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenInspection = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setNewInspection({
      tanggal: new Date().toISOString().split('T')[0],
      visualCheck: true,
      dimensionCheck: true,
      materialCheck: true,
      status: 'Passed',
      notes: '',
      itemNama: wo.itemToProduce,
      qtyInspected: wo.targetQty,
      qtyPassed: wo.targetQty,
      qtyRejected: 0,
      woNumber: wo.woNumber,
      workOrderId: wo.id,
      projectId: wo.projectId,
      // Pekerjaan jasa/repair tidak otomatis menjadi barang jadi.
      // User hanya mengaktifkan ini jika hasil QC memang berupa barang fisik.
      sendToWarehouse: false,
      warehouseLocation: 'Gudang Barang Jadi',
      stockCategory: warehouseCategories.includes('Barang Jadi') ? 'Barang Jadi' : (warehouseCategories[0] || ''),
      batchNo: `BATCH-${wo.woNumber.split('-').pop()}-${Date.now().toString().slice(-4)}`,
      customerName: wo.projectName || '',
      remark: '',
      dimensions: [
        { parameter: 'H', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'H1', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'W', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'W1', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'W2', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'R', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
        { parameter: 'D', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' },
      ]
    });
    setShowModal(true);
  };

  const handleAddDimension = () => {
    setNewInspection({
      ...newInspection,
      dimensions: [
        ...(newInspection.dimensions || []),
        { parameter: '', specification: '', sample1: '', sample2: '', sample3: '', sample4: '', result: 'OK' }
      ]
    });
  };

  const handleRemoveDimension = (index: number) => {
    const updatedDimensions = newInspection.dimensions?.filter((_, i) => i !== index);
    setNewInspection({ ...newInspection, dimensions: updatedDimensions });
  };

  const handleDimensionChange = (index: number, field: keyof DimensionMeasurement, value: string) => {
    const updatedDimensions = newInspection.dimensions?.map((dim, i) => 
      i === index ? { ...dim, [field]: value } : dim
    );
    setNewInspection({ ...newInspection, dimensions: updatedDimensions });
  };

  const handleSubmitQC = async () => {
    if (!newInspection.inspectorName || !newInspection.batchNo) {
      toast.error('Mohon lengkapi nama inspektor dan nomor batch');
      return;
    }
    if (newInspection.sendToWarehouse !== false && !newInspection.stockCategory) {
      toast.error('Pilih kategori stok yang sudah terdaftar di Monitoring Gudang');
      return;
    }
    const qtyInspected = Number(newInspection.qtyInspected || 0);
    const qtyPassed = Number(newInspection.qtyPassed || 0);
    const qtyRejected = Number(newInspection.qtyRejected || 0);
    if (qtyInspected <= 0 || qtyPassed < 0 || qtyRejected < 0 || qtyPassed + qtyRejected !== qtyInspected) {
      toast.error('Qty Passed + Qty Rejected harus sama dengan Qty Inspected');
      return;
    }

    const inspection: QCInspection = {
      id: `qc-${Date.now()}`,
      tanggal: newInspection.tanggal!,
      batchNo: newInspection.batchNo!,
      itemNama: newInspection.itemNama!,
      qtyInspected,
      qtyPassed,
      qtyRejected,
      inspectorName: newInspection.inspectorName!,
      status: newInspection.status as any,
      notes: newInspection.notes,
      visualCheck: !!newInspection.visualCheck,
      dimensionCheck: !!newInspection.dimensionCheck,
      materialCheck: !!newInspection.materialCheck,
      photoUrl: newInspection.photoUrl,
      drawingUrl: newInspection.drawingUrl,
      woNumber: newInspection.woNumber,
      workOrderId: newInspection.workOrderId,
      projectId: newInspection.projectId,
      sendToWarehouse: newInspection.sendToWarehouse !== false,
      warehouseLocation: newInspection.warehouseLocation || 'Gudang Barang Jadi',
      stockCategory: newInspection.stockCategory,
      customerName: newInspection.customerName,
      remark: newInspection.remark,
      dimensions: newInspection.dimensions
    };

    try {
      await addQCInspection(inspection);
    } catch {
      return;
    }

    // Status WO diturunkan oleh backend dari hasil QC. Jangan kirim PATCH
    // kedua dari browser karena dapat menimpa hasil kalkulasi server.

    setShowModal(false);
    if (inspection.status === 'Rejected') {
      toast.error(`QC Rejected untuk ${inspection.batchNo} — dikembalikan ke produksi.`);
    } else if (inspection.sendToWarehouse && inspection.qtyPassed > 0) {
      toast.success(`QC ${inspection.status} tersimpan — draft Stock In Barang Jadi menunggu verifikasi gudang.`);
    } else {
      toast.success(`QC ${inspection.status} tersimpan — pekerjaan jasa tidak masuk gudang.`);
    }
  };

  const handleManualQC = (report: any, result: 'Passed' | 'Failed') => {
    updateProductionReport(report.id, { qcStatus: result } as any);
    if (result === 'Passed' && report.outputQty > 0) {
      toast.success(`QC Passed — LHP manual tersimpan. Hubungkan ke WO terlebih dahulu jika hasilnya masuk gudang.`);
    } else {
      toast.error(`QC Failed — LHP ${report.id.slice(-6)} dikembalikan ke produksi`);
    }
  };

  const handlePrintInspection = (inspection: QCInspection) => {
    setSelectedInspection(inspection);
    setShowPrintPreview(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Quality Control (QC)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Inspection, Verification & Release</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* WAITING FOR QC */}
        <div className="xl:col-span-1 space-y-4">
          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setQcTab('wo')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${qcTab === 'wo' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Clock size={12} /> WO
              {waitingForQC.length > 0 && <span className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{waitingForQC.length}</span>}
            </button>
            <button
              onClick={() => setQcTab('manual')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${qcTab === 'manual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <User size={12} /> Manual
              {manualLHPQueue.length > 0 && <span className="bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{manualLHPQueue.length}</span>}
            </button>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {qcTab === 'wo' ? (
              waitingForQC.length > 0 ? (
                waitingForQC.map((wo) => (
                  <div key={wo.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-400 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{wo.woNumber}</span>
                        <h4 className="text-sm font-black text-slate-900 leading-tight mt-0.5">{wo.itemToProduce}</h4>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${wo.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {wo.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Target Qty</span>
                        <span className="text-sm font-black text-slate-700">{wo.targetQty} <span className="text-[10px]">Pcs</span></span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Teknisi</span>
                        <span className="text-sm font-black text-slate-700">{wo.leadTechnician}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenInspection(wo)}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                    >
                      Mulai Inspeksi <ArrowRight size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                    <ClipboardCheck size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada antrian WO</p>
                </div>
              )
            ) : (
              manualLHPQueue.length > 0 ? (
                manualLHPQueue.map((report) => (
                  <div key={report.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-rose-300 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LHP Manual — {report.tanggal}</span>
                        <h4 className="text-sm font-black text-slate-900 leading-tight mt-0.5 truncate">{(report as any).namaBarang || report.activity}</h4>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase ml-2 shrink-0">Pending QC</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                      <span className="font-bold">Output: <span className="text-slate-900">{report.outputQty} {report.unit}</span></span>
                      <span className="font-bold truncate">Oleh: <span className="text-slate-900">{report.workerName}</span></span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleManualQC(report, 'Passed')}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={13} /> Pass
                      </button>
                      <button
                        onClick={() => handleManualQC(report, 'Failed')}
                        className="flex-1 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        <XCircle size={13} /> Fail
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                    <ClipboardCheck size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada LHP manual pending</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* RECENT INSPECTIONS */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-indigo-600" /> Riwayat Inspeksi
            </h3>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari Batch / WO / Item..."
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl text-[10px] font-bold border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal & Batch</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item & Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspector</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInspections.length > 0 ? (
                    filteredInspections.map((qc) => (
                      <tr key={qc.id} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">{qc.batchNo}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{qc.tanggal}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{qc.itemNama}</span>
                            <span className="text-[10px] text-indigo-600 font-black uppercase">{qc.customerName || qc.woNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-emerald-500 font-black uppercase">Pass</span>
                              <span className="text-xs font-black">{qc.qtyPassed}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-red-500 font-black uppercase">Rej</span>
                              <span className="text-xs font-black">{qc.qtyRejected}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500">
                              {qc.inspectorName.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-700">{qc.inspectorName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase inline-flex items-center gap-1.5 ${
                            qc.status === 'Passed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            qc.status === 'Rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-orange-50 text-orange-600 border border-orange-100'
                          }`}>
                            {qc.status === 'Passed' ? <CheckCircle2 size={12} /> : qc.status === 'Rejected' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            {qc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {qc.status === 'Rejected' && (
                              <button
                                onClick={() => {
                                  const wo = (qc.workOrderId
                                    ? workOrderList.find(w => w.id === qc.workOrderId)
                                    : undefined) || workOrderList.find(w => w.woNumber === qc.woNumber);
                                  if (wo) {
                                    updateWorkOrder(wo.id, { status: 'In Progress' });
                                    toast.success(`WO ${qc.woNumber} dikembalikan ke produksi untuk rework.`);
                                  } else {
                                    toast.error('Work Order tidak ditemukan.');
                                  }
                                }}
                                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-600 transition-all inline-flex items-center gap-1.5"
                                title="Kembalikan ke produksi untuk rework"
                              >
                                ↩ Rework
                              </button>
                            )}
                            <button
                              onClick={() => handlePrintInspection(qc)}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-indigo-700 transition-all inline-flex items-center gap-1.5"
                            >
                              <Printer size={12} /> Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada data inspeksi terbaru</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* INSPECTION MODAL */}
      {showModal && selectedWO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-6xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Formulir Inspeksi QC</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Produksi Release Verification</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
              {/* WO INFO */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Name</p>
                  <p className="text-xs font-black text-slate-900 truncate">{selectedWO.itemToProduce}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">WO Number</p>
                  <p className="text-xs font-black text-indigo-600">{selectedWO.woNumber}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Qty</p>
                  <p className="text-xs font-black text-slate-900">{selectedWO.targetQty} Pcs</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teknisi</p>
                  <p className="text-xs font-black text-slate-900">{selectedWO.leadTechnician}</p>
                </div>
              </div>

              {/* BASIC INFO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 transition-colors outline-none"
                    value={newInspection.batchNo || ''}
                    onChange={(e) => setNewInspection({ ...newInspection, batchNo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                  <input 
                    type="text" 
                    placeholder="Nama customer..."
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 transition-colors outline-none"
                    value={newInspection.customerName || ''}
                    onChange={(e) => setNewInspection({ ...newInspection, customerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Inspector</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Nama anda..."
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 transition-colors outline-none"
                      value={newInspection.inspectorName || ''}
                      onChange={(e) => setNewInspection({ ...newInspection, inspectorName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* DRAWING FOTO UPLOAD */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Foto Drawing / Referensi (Opsional)</label>
                <input ref={drawingFileRef} type="file" accept="image/*" className="hidden" onChange={handleDrawingUpload} />
                {newInspection.drawingUrl ? (
                  <div className="relative w-full rounded-2xl overflow-hidden border-2 border-indigo-200">
                    <img src={newInspection.drawingUrl} alt="Drawing" className="w-full max-h-48 object-contain bg-slate-50" />
                    <button
                      type="button"
                      onClick={() => setNewInspection(prev => ({ ...prev, drawingUrl: undefined }))}
                      className="absolute top-2 right-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => drawingFileRef.current?.click()}
                    className="w-full py-5 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                  >
                    <Camera size={22} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Foto Drawing</span>
                    <span className="text-[9px] font-medium">JPG, PNG — maks 5MB</span>
                  </button>
                )}
              </div>

              {/* DIMENSION TABLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tabel Dimensi</label>
                  <button 
                    onClick={handleAddDimension}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-indigo-700 transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus size={12} /> Tambah Parameter
                  </button>
                </div>
                
                <div className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-left">Param</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-left">Spec</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">S1</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">S2</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">S3</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">S4</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">Result</th>
                          <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">Act</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {newInspection.dimensions && newInspection.dimensions.length > 0 ? (
                          newInspection.dimensions.map((dim, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-xs font-bold text-center text-black"
                                  value={dim.parameter}
                                  onChange={(e) => handleDimensionChange(idx, 'parameter', e.target.value)}
                                  placeholder="H"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-20 px-2 py-1 border border-slate-200 rounded text-xs text-black"
                                  value={dim.specification}
                                  onChange={(e) => handleDimensionChange(idx, 'specification', e.target.value)}
                                  placeholder="75mm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-center text-black"
                                  value={dim.sample1}
                                  onChange={(e) => handleDimensionChange(idx, 'sample1', e.target.value)}
                                  placeholder="74.8"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-center text-black"
                                  value={dim.sample2}
                                  onChange={(e) => handleDimensionChange(idx, 'sample2', e.target.value)}
                                  placeholder="75.1"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-center text-black"
                                  value={dim.sample3}
                                  onChange={(e) => handleDimensionChange(idx, 'sample3', e.target.value)}
                                  placeholder="75.0"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-center text-black"
                                  value={dim.sample4}
                                  onChange={(e) => handleDimensionChange(idx, 'sample4', e.target.value)}
                                  placeholder="74.9"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select
                                  className={`px-2 py-1 border rounded text-xs font-bold ${
                                    dim.result === 'OK' ? 'border-emerald-300 text-emerald-600' : 'border-red-300 text-red-600'
                                  }`}
                                  value={dim.result}
                                  onChange={(e) => handleDimensionChange(idx, 'result', e.target.value as 'OK' | 'NG')}
                                >
                                  <option value="OK">OK</option>
                                  <option value="NG">NG</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => handleRemoveDimension(idx)}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-xs">
                              Klik "Tambah Parameter" untuk menambahkan dimensi
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kriteria Pemeriksaan</label>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, visualCheck: !newInspection.visualCheck })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      newInspection.visualCheck ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <Maximize2 size={20} className="mb-2" />
                    <span className="text-[10px] font-black uppercase">Visual OK</span>
                  </button>
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, dimensionCheck: !newInspection.dimensionCheck })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      newInspection.dimensionCheck ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <Maximize2 size={20} className="mb-2" />
                    <span className="text-[10px] font-black uppercase">Dimensi OK</span>
                  </button>
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, materialCheck: !newInspection.materialCheck })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      newInspection.materialCheck ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <Maximize2 size={20} className="mb-2" />
                    <span className="text-[10px] font-black uppercase">Material OK</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inspected</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold"
                    value={newInspection.qtyInspected || 0}
                    onChange={(e) => setNewInspection({ ...newInspection, qtyInspected: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-600">Passed (Good)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-sm font-bold text-emerald-700"
                    value={newInspection.qtyPassed || 0}
                    onChange={(e) => setNewInspection({ ...newInspection, qtyPassed: Number(e.target.value), qtyRejected: (newInspection.qtyInspected || 0) - Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-red-600">Rejected (NG)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-red-50 border-2 border-red-100 rounded-2xl text-sm font-bold text-red-700"
                    value={newInspection.qtyRejected || 0}
                    onChange={(e) => setNewInspection({ ...newInspection, qtyRejected: Number(e.target.value), qtyPassed: (newInspection.qtyInspected || 0) - Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Final QC</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, status: 'Passed' })}
                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${
                      newInspection.status === 'Passed' ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    Release (Pass)
                  </button>
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, status: 'Partial' })}
                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${
                      newInspection.status === 'Partial' ? 'bg-orange-500 border-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    Partial Pass
                  </button>
                  <button 
                    onClick={() => setNewInspection({ ...newInspection, status: 'Rejected' })}
                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${
                      newInspection.status === 'Rejected' ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-200' : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    Hold (Reject)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tujuan hasil QC</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewInspection({ ...newInspection, sendToWarehouse: true })}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${newInspection.sendToWarehouse !== false ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500'}`}
                  >
                    <span className="block text-xs font-black uppercase">Masuk Gudang Barang Jadi</span>
                    <span className="block mt-1 text-[10px] font-bold opacity-70">QC membuat draft Stock In untuk diverifikasi gudang.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewInspection({ ...newInspection, sendToWarehouse: false })}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${newInspection.sendToWarehouse === false ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 text-slate-500'}`}
                  >
                    <span className="block text-xs font-black uppercase">Jasa / Pekerjaan Lapangan</span>
                    <span className="block mt-1 text-[10px] font-bold opacity-70">Selesai di proyek dan tidak menambah stok gudang.</span>
                  </button>
                </div>
                {newInspection.sendToWarehouse !== false && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori Stok Gudang *</label>
                      <select
                        value={newInspection.stockCategory || ''}
                        onChange={(e) => setNewInspection({ ...newInspection, stockCategory: e.target.value })}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none"
                      >
                        <option value="">— Pilih kategori dari Monitoring Gudang —</option>
                        {warehouseCategories.map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                      {warehouseCategories.length === 0 && (
                        <p className="text-[10px] font-bold text-rose-500 ml-1">Belum ada kategori. Daftarkan dahulu di Monitoring Gudang.</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Gudang</label>
                      <input
                        type="text"
                        value={newInspection.warehouseLocation || ''}
                        onChange={(e) => setNewInspection({ ...newInspection, warehouseLocation: e.target.value })}
                        placeholder="Lokasi gudang barang jadi"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remark / Catatan</label>
                <textarea 
                  rows={3}
                  placeholder="Detail temuan selama inspeksi..."
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 transition-colors outline-none resize-none"
                  value={newInspection.remark || ''}
                  onChange={(e) => setNewInspection({ ...newInspection, remark: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 sticky bottom-0">
              <div className="flex items-center gap-2 text-indigo-600">
                <Info size={16} />
                <span className="text-[10px] font-bold uppercase">QC Pass membuat draft Stock In; stok baru bertambah setelah gudang posting.</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl text-xs font-black uppercase hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSubmitQC}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Simpan & Rilis Batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreview && selectedInspection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPrintPreview(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-[220mm] relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">Print Preview</h3>
                <p className="text-xs text-slate-500 font-bold">Inspection Report - {selectedInspection.batchNo}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handlePrint}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition-all inline-flex items-center gap-2"
                >
                  <Printer size={16} /> Print Report
                </button>
                <button 
                  onClick={() => setShowPrintPreview(false)}
                  className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-6 bg-slate-100">
              <InspectionReportPrint inspection={selectedInspection} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
