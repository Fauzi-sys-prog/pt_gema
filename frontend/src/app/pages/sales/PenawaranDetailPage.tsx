import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  FileText,
  Wallet,
  Building2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  Check,
  Target,
  FileCheck,
  FileDown,
  ClipboardList,
  Plus,
  Eye
} from 'lucide-react';
import { useApp, type Quotation } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  VerticalAlign,
  HeightRule
} from 'docx';
import FileSaver from 'file-saver';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function PenawaranDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { quotationList, updateQuotation } = useApp();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey([
    { condition: showConvertModal, close: () => setShowConvertModal(false) },
  ]);


  const quotation = useMemo(() => quotationList.find(q => q.id === id), [quotationList, id]);

  const { projectList, addProject, deleteProject } = useApp();
  const linkedProject = useMemo(() => projectList.find(p => p.quotationId === id), [projectList, id]);

  // Compute subtotal/ppn/grandTotal from line items — handles both PenawaranPage & QuotationPage formats
  const computedSubtotal = useMemo(() => {
    if (!quotation) return 0;
    const stored = (quotation as any).subtotal;
    if (stored && !isNaN(stored)) return stored;
    const matTotal = (quotation.materials || []).reduce((s: number, m: any) =>
      s + (m.totalCost || (m.unitPrice || 0) * (m.quantity || 0)), 0);
    const mpTotal = (quotation.manpower || []).reduce((s: number, mp: any) =>
      s + (mp.totalPrice || (mp.unitPrice || 0) * (mp.quantity || 0) * (mp.duration || 1)), 0);
    const sectTotal = (quotation.sections || []).reduce((s: number, sec: any) =>
      s + (sec.items || []).reduce((ss: number, item: any) =>
        ss + (item.hargaJual || 0) * (item.qty || 0), 0), 0);
    const computed = matTotal + mpTotal + sectTotal;
    return computed || ((quotation as any).grandTotal || 0);
  }, [quotation]);

  const computedDiscountPercent = useMemo(() => {
    if (!quotation) return 0;
    return (quotation as any).pricingConfig?.discountPercent || (quotation as any).discountPercent || 0;
  }, [quotation]);

  const computedDiscount = useMemo(() => {
    if (!quotation) return 0;
    const stored = (quotation as any).discount;
    if (stored && !isNaN(stored)) return stored;
    return computedSubtotal * (computedDiscountPercent / 100);
  }, [quotation, computedSubtotal, computedDiscountPercent]);

  const computedAfterDiscount = useMemo(() => computedSubtotal - computedDiscount, [computedSubtotal, computedDiscount]);

  const computedPPN = useMemo(() => {
    if (!quotation) return 0;
    const stored = (quotation as any).ppn;
    if (stored && !isNaN(stored) && computedDiscountPercent === 0) return stored;
    const includePPN = (quotation as any).pricingConfig?.includePPN ?? (quotation as any).includePPN ?? true;
    if (!includePPN) return 0;
    return computedAfterDiscount * 0.11;
  }, [quotation, computedAfterDiscount, computedDiscountPercent]);

  const computedGrandTotal = useMemo(() => {
    if (!quotation) return 0;
    return computedAfterDiscount + computedPPN;
  }, [computedAfterDiscount, computedPPN]);

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle size={48} className="text-slate-300" />
        <h2 className="text-xl font-black text-slate-900 uppercase">Quotation Not Found</h2>
        <button onClick={() => navigate('/sales/quotation-approval')} className="text-blue-600 font-bold hover:underline uppercase text-xs">Back to List</button>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };


  const handleExportToWord = async () => {
    if (!quotation) return;
    const loadingToast = toast.loading("Preparing Word document...");

    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "PT GEMA TEKNIK PERKASA", bold: true, size: 28, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "REFRACTORY FURNACE AND BOILER", size: 16, font: "Arial", italic: true }),
            ],
            spacing: { after: 400 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: `No: ${quotation.nomorQuotation}`, bold: true, size: 20, font: "Arial" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Perihal: ${quotation.perihal}`, size: 18, font: "Arial" }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "Yth,", size: 18, font: "Arial" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: quotation.customer?.nama || 'N/A', bold: true, size: 18, font: "Arial" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: quotation.customer?.alamat || '', size: 16, font: "Arial" }),
            ],
            spacing: { after: 400 },
          }),

          // OPENING SENTENCE
          ...(quotation.openingSentence ? [
            new Paragraph({
              children: [
                new TextRun({ text: quotation.openingSentence, size: 18, font: "Arial", italic: true }),
              ],
              spacing: { after: 300 },
            })
          ] : []),

          // TABLE
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "No", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: "Item Deskripsi", children: [new TextRun({ bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: "Qty", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: "Total", alignment: AlignmentType.RIGHT, children: [new TextRun({ bold: true })] })] }),
                ]
              }),
              ...(quotation.materials || []).map((m: any, i: number) => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: String(i + 1), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: m.materialName })] }),
                  new TableCell({ children: [new Paragraph({ text: `${m.quantity} ${m.unit || 'Pcs'}`, alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: formatCurrency(m.totalCost || (m.unitPrice * m.quantity)), alignment: AlignmentType.RIGHT })] }),
                ]
              }))
            ]
          }),

          // CLOSING SENTENCE
          ...(quotation.closingSentence ? [
            new Paragraph({
              children: [
                new TextRun({ text: quotation.closingSentence, size: 18, font: "Arial", italic: true }),
              ],
              spacing: { before: 300, after: 300 },
            })
          ] : []),

          new Paragraph({
            children: [
              new TextRun({ text: `Total (Inc. PPN): ${formatCurrency(computedGrandTotal)}`, bold: true, size: 24, font: "Arial", color: "2563eb" }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    FileSaver.saveAs(blob, `Quotation_${quotation.nomorQuotation.replace(/\//g, '_')}.docx`);
    toast.dismiss(loadingToast);
    toast.success("Word document downloaded successfully!");
  };

  const isHighValue = computedGrandTotal > 500000000;
  const needsApproval = isHighValue && quotation.status === 'Draft';

  const handleRequestApproval = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const saved = await updateQuotation(quotation.id, { status: 'Sent' }); // Using 'Sent' as 'Waiting Approval' in this context or we could add a new status
      if (saved === undefined) return;
      toast.success("🚀 Permintaan persetujuan telah dikirim ke Manager!");
    } catch (err) {
      toast.error('Gagal mengirim permintaan approval: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToProject = async () => {
    if (linkedProject) {
      navigate('/project');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    const newProjectId = `prj-${Date.now()}`;
    // Carry the quotation's actual cost composition into the project budget.
    // Do not split the budget using arbitrary percentages: that makes project
    // margin and variance reports wrong as soon as the quotation mix changes.
    const sectionCost = (quotation.sections || []).reduce((acc: { material: number; labor: number; equipment: number; other: number }, sec: any) => {
      const key = String(sec.category || sec.title || sec.name || '').toLowerCase();
      const total = (sec.items || []).reduce((sum: number, item: any) =>
        sum + (Number(item.hargaUnit ?? item.unitPrice ?? item.hargaJual ?? 0) || 0) * (Number(item.qty ?? item.quantity ?? 0) || 0), 0);
      if (key.includes('manpower') || key.includes('tenaga') || key.includes('labor') || key.includes('jasa')) acc.labor += total;
      else if (key.includes('equipment') || key.includes('alat')) acc.equipment += total;
      else if (key.includes('material') || key.includes('bahan')) acc.material += total;
      else acc.other += total;
      return acc;
    }, { material: 0, labor: 0, equipment: 0, other: 0 });
    const budgetMaterial = (quotation.materials || []).reduce((sum: number, item: any) => sum + (Number(item.unitPrice ?? item.hargaUnit ?? 0) || 0) * (Number(item.quantity ?? item.qty ?? 0) || 0), 0) + sectionCost.material;
    const budgetLabor = (quotation.manpower || []).reduce((sum: number, item: any) => sum + (Number(item.unitPrice ?? item.hargaUnit ?? 0) || 0) * (Number(item.quantity ?? item.qty ?? 0) || 0) * (Number(item.duration ?? 1) || 1), 0) + sectionCost.labor;
    const budgetEquipment = (quotation.equipment || []).reduce((sum: number, item: any) => sum + (Number(item.unitPrice ?? item.hargaUnit ?? 0) || 0) * (Number(item.quantity ?? item.qty ?? 0) || 0) * (Number(item.duration ?? 1) || 1), 0) + sectionCost.equipment;
    const budgetOther = (quotation.consumables || []).reduce((sum: number, item: any) => sum + (Number(item.unitPrice ?? item.hargaUnit ?? 0) || 0) * (Number(item.quantity ?? item.qty ?? 0) || 0), 0) + sectionCost.other;
    const newProject = {
      id: newProjectId,
      kodeProject: `PRJ-${new Date().getFullYear()}-${String(projectList.length + 1).padStart(3, '0')}`,
      namaProject: quotation.perihal,
      customer: quotation.customer?.nama || 'N/A',
      customerId: (quotation as any).customerId || '',
      nilaiKontrak: computedGrandTotal,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
      status: 'Planning' as const,
      progress: 0,
      quotationId: quotation.id,
      budget: {
        total: computedSubtotal,
        material: budgetMaterial,
        labor: budgetLabor,
        equipment: budgetEquipment,
        overhead: 0,
        other: budgetOther,
      },
      boq: (quotation.materials || []).length > 0 
        ? quotation.materials.map((m: any, idx: number) => ({
            itemKode: m.itemKode || m.kode || `BOQ-${String(idx + 1).padStart(2, '0')}`,
            materialName: m.materialName || m.description,
            qtyEstimate: m.quantity || m.qty || 1,
            unit: m.unit || 'Unit',
            unitPrice: m.unitPrice || 0,
            status: 'Not Ordered' as const,
          }))
        : [
            {
              itemKode: 'BOQ-01',
              materialName: quotation.perihal,
              qtyEstimate: 1,
              unit: 'Lot',
              unitPrice: computedSubtotal || 0,
              status: 'Not Ordered' as const,
            }
          ]
    };

    try {
      // Urutan penting: project harus tersimpan dulu sebelum quotation ditautkan.
      const createdProject = await addProject(newProject as any);
      if (!createdProject) {
        toast.error('Gagal membuat project di server. Quotation tidak diubah.');
        return;
      }
      try {
        const saved = await updateQuotation(quotation.id, { projectId: newProjectId });
        if (saved === undefined) throw new Error('Update quotation gagal disimpan ke server');
      } catch (linkErr) {
        // Rollback: hapus project yang baru dibuat agar tidak ada project yatim
        // tanpa tautan quotation.
        try { deleteProject(newProjectId); } catch { /* best effort */ }
        throw linkErr;
      }
      toast.success("✅ Penawaran berhasil dikonversi menjadi Project Pipeline!");
      navigate('/project');
    } catch (err) {
      toast.error('Konversi ke Project gagal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Planning':        return 'bg-slate-200 text-slate-600';
      case 'Pending Approval':return 'bg-yellow-400 text-white';
      case 'Approved':        return 'bg-emerald-500 text-white';
      case 'In Progress':     return 'bg-blue-500 text-white';
      case 'Pending Review':  return 'bg-orange-400 text-white';
      case 'On Hold':         return 'bg-purple-500 text-white';
      case 'Complete':        return 'bg-teal-500 text-white';
      case 'Rejected':        return 'bg-rose-500 text-white';
      case 'Draft':           return 'bg-slate-200 text-slate-600';
      case 'Sent':            return 'bg-cyan-500 text-white';
      default:                return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 print:bg-white print:p-0">
      {/* Action Header - Hidden in Print */}
      <div className="p-6 lg:px-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/sales/quotation-approval')}
            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all shadow-sm group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                Quotation <span className="text-blue-600">Detail</span>
              </h1>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusStyle(quotation.status)}`}>
                {quotation.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dual-Terminology Integrated Document</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportToWord}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg"
          >
            <FileDown size={16} /> Export to Word
          </button>
          
          {needsApproval && (
            <button
              onClick={handleRequestApproval}
              disabled={isSubmitting}
              className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck size={16} /> Request Manager Approval
            </button>
          )}

          {quotation.status === 'Approved' && !linkedProject && (
            <button
              onClick={handleConvertToProject}
              disabled={isSubmitting}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={16} /> {isSubmitting ? 'Processing...' : 'Convert to Project'}
            </button>
          )}
          {linkedProject && (
            <button 
              onClick={() => navigate('/project')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              <Building2 size={16} /> View Project
            </button>
          )}
          {quotation.status === 'Draft' && (
            <button
              disabled={isSubmitting}
              onClick={async () => {
                if (!window.confirm(`Tandai quotation ${quotation.nomorQuotation || quotation.noPenawaran || ''} sebagai Approved?`)) return;
                setIsSubmitting(true);
                try {
                  const saved = await updateQuotation(quotation.id, { status: 'Approved' });
                  if (saved === undefined) return;
                  toast.success("Penawaran telah disetujui!");
                } catch (err) {
                  toast.error('Gagal approve: ' + (err instanceof Error ? err.message : 'Error'));
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} /> Mark Approved
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-8">
        {isHighValue && quotation.status !== 'Approved' && (
          <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl flex items-center gap-4 animate-pulse print:hidden">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0">
               <AlertCircle size={24} />
            </div>
            <div>
               <p className="text-xs font-black text-amber-900 uppercase tracking-widest leading-none">High Value Quotation Detect</p>
               <p className="text-[10px] text-amber-700 font-bold mt-1 uppercase">Nilai di atas Rp 500 Juta memerlukan verifikasi Direktur sebelum dikonversi menjadi Proyek.</p>
            </div>
          </div>
        )}

        {/* Document Header Info */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 print:border-none print:shadow-none">
          <div className="flex flex-col md:flex-row justify-between gap-10">
             <div className="space-y-6">
                <div>
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Customer Profile</h3>
                   <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0">
                         <Building2 size={24} />
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-none">{quotation.customer?.nama || 'N/A'}</h2>
                         <p className="text-sm text-slate-500 font-medium mt-2 max-w-md">{quotation.customer?.alamat || ''}</p>
                      </div>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quotation No.</p>
                      <p className="font-black text-slate-900 uppercase italic">{quotation.nomorQuotation}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Document Date</p>
                      <p className="font-black text-slate-900 uppercase italic">{new Date(quotation.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                   </div>
                </div>
             </div>

             <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-center min-w-[300px]">
                <div className="flex items-center gap-2 mb-4">
                   <Target size={16} className="text-blue-600" />
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Summary</h4>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic mb-6 leading-tight">{quotation.perihal}</h3>
                <div className="pt-4 border-t border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Total Commercial Value</p>
                   <p className="text-3xl font-black text-blue-600 italic tracking-tighter leading-none">{formatCurrency(computedGrandTotal)}</p>
                   {quotation.dataCollectionId && (
                     <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
                       <div className="w-8 h-8 bg-amber-500 text-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                         <ClipboardList size={14} />
                       </div>
                       <div className="flex-1">
                         <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">Linked Data Collection</p>
                         <p className="text-[10px] font-black text-amber-900 uppercase italic mt-1">Ref: {quotation.dataCollectionId}</p>
                       </div>
                       <button 
                         onClick={() => navigate('/data-collection')}
                         className="text-[8px] font-black uppercase text-amber-600 hover:underline"
                       >
                         View Source
                       </button>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Tab Selection - Hidden in Print */}
        <div className="flex gap-2 print:hidden">
           <button
             className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-xl flex items-center gap-3"
           >
              <Wallet size={16} /> Commercial (RAB)
           </button>
        </div>

        {/* Content Area */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <FileCheck size={20} className="text-blue-600" />
                      <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Bill of Quantities / RAB</h3>
                   </div>
                </div>
                
                <div className="p-8">
                   {quotation.openingSentence && (
                     <p className="text-sm font-bold text-slate-700 italic mb-6 leading-relaxed whitespace-pre-line border-l-4 border-blue-500 pl-4">
                        {quotation.openingSentence}
                     </p>
                   )}
                   
                   <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left">
                         <thead>
                            <tr className="bg-slate-900 text-white">
                               <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic w-16 text-center">No</th>
                               <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic">Item Deskripsi</th>
                               <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic text-center">Qty</th>
                               <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic text-right">Harga Satuan</th>
                               <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic text-right">Total Amount</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {/* Materials items */}
                            {quotation.materials && quotation.materials.length > 0 ? (
                              quotation.materials.map((item: any, idx: number) => (
                                <tr key={`mat-${idx}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                  <td className="px-8 py-4">
                                    <div className="font-black text-slate-900 italic uppercase">{item.materialName}</div>
                                    {item.specification && <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{item.specification}</div>}
                                    {item.kode && <div className="text-[9px] text-blue-500 font-bold uppercase mt-1">Ref: {item.kode}</div>}
                                  </td>
                                  <td className="px-8 py-4 text-center font-black text-slate-900">{item.quantity} <span className="text-[9px] font-bold text-slate-400 uppercase">{item.unit || 'Pcs'}</span></td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(item.unitPrice || 0)}</td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(item.totalCost || ((item.unitPrice || 0) * (item.quantity || 0)))}</td>
                                </tr>
                              ))
                            ) : null}

                            {/* Manpower items */}
                            {quotation.manpower && quotation.manpower.length > 0 && (
                              <>
                                <tr className="bg-slate-50/50">
                                  <td colSpan={5} className="px-8 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest italic border-y border-slate-100">Manpower & Services</td>
                                </tr>
                                {quotation.manpower.map((mp: any, idx: number) => (
                                  <tr key={`mp-${idx}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-4 text-center font-bold text-slate-400">-</td>
                                    <td className="px-8 py-4 font-black text-slate-900 italic uppercase">
                                      {mp.position}
                                      {mp.duration && <span className="ml-2 text-[9px] text-blue-500 font-bold lowercase">({mp.duration} days)</span>}
                                    </td>
                                    <td className="px-8 py-4 text-center font-black text-slate-900">{mp.quantity} <span className="text-[9px] font-bold text-slate-400 uppercase">Pax</span></td>
                                    <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(mp.unitPrice || 0)}</td>
                                    <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(mp.totalPrice || ((mp.unitPrice || 0) * (mp.quantity || 0) * (mp.duration || 1)))}</td>
                                  </tr>
                                ))}
                              </>
                            )}

                            {/* Section-based items from the commercial quotation form */}
                            {(quotation.sections || []).flatMap((sec: any) => sec.items || []).map((item: any, idx: number) => (
                              <tr key={`section-${idx}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="px-8 py-4 font-black text-slate-900 italic uppercase">{item.description || item.keterangan || item.name || 'Item'}</td>
                                <td className="px-8 py-4 text-center font-black text-slate-900">{item.qty || 0} <span className="text-[9px] font-bold text-slate-400 uppercase">{item.unit || 'Lot'}</span></td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(item.hargaJual || item.unitPrice || 0)}</td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency((item.hargaJual || item.unitPrice || 0) * (item.qty || 0))}</td>
                              </tr>
                            ))}

                            {(!quotation.materials || quotation.materials.length === 0) && (!quotation.manpower || quotation.manpower.length === 0) && (!quotation.sections || quotation.sections.length === 0) && (
                               <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-4 text-center font-bold text-slate-400">1</td>
                                  <td className="px-8 py-4 font-black text-slate-900 italic uppercase">Pekerjaan Jasa Bongkar Pasang & Refractory</td>
                                  <td className="px-8 py-4 text-center font-black text-slate-900">1 <span className="text-[9px] font-bold text-slate-400 uppercase">Lot</span></td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(computedSubtotal)}</td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(computedSubtotal)}</td>
                                </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="p-8 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                   <div className="flex-1">
                      {quotation.closingSentence && (
                        <div className="max-w-2xl">
                           <p className="text-sm font-bold text-slate-600 italic leading-relaxed whitespace-pre-line border-l-4 border-slate-300 pl-4">
                              {quotation.closingSentence}
                           </p>
                        </div>
                      )}
                   </div>
                   <div className="w-full md:w-auto space-y-3">
                      <div className="flex justify-between w-full md:min-w-[300px]">
                         <span className="text-[11px] font-black text-slate-400 uppercase italic">Subtotal</span>
                         <span className="text-sm font-black text-slate-900 italic tracking-tighter">{formatCurrency(computedSubtotal)}</span>
                      </div>
                      {computedDiscount > 0 && (
                        <div className="flex justify-between w-full">
                           <span className="text-[11px] font-black text-amber-500 uppercase italic">Diskon ({computedDiscountPercent}%)</span>
                           <span className="text-sm font-black text-amber-500 italic tracking-tighter">- {formatCurrency(computedDiscount)}</span>
                        </div>
                      )}
                      {computedDiscount > 0 && (
                        <div className="flex justify-between w-full border-t border-dashed border-slate-200 pt-2">
                           <span className="text-[11px] font-black text-slate-500 uppercase italic">Setelah Diskon</span>
                           <span className="text-sm font-black text-slate-700 italic tracking-tighter">{formatCurrency(computedAfterDiscount)}</span>
                        </div>
                      )}
                      {computedPPN > 0 && (
                        <div className="flex justify-between w-full">
                           <span className="text-[11px] font-black text-slate-400 uppercase italic">PPN (11%)</span>
                           <span className="text-sm font-black text-slate-900 italic tracking-tighter">{formatCurrency(computedPPN)}</span>
                        </div>
                      )}
                      <div className="w-full h-px bg-slate-200 my-2" />
                      <div className="flex justify-between w-full">
                         <span className="text-xs font-black text-blue-600 uppercase italic">Grand Total</span>
                         <span className="text-2xl font-black text-blue-600 italic tracking-tighter">{formatCurrency(computedGrandTotal)}</span>
                      </div>
                   </div>
                </div>
              </div>
          </motion.div>

        {/* Notes Section */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 print:mt-10">
           <div className="flex items-center gap-3 mb-6">
              <Info size={18} className="text-blue-600" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syarat & Ketentuan Umum</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <ul className="space-y-3">
                 {[
                   'Pembayaran dilakukan dalam 30 hari kalender setelah invoice diterima (TOP 30).',
                   'Harga di atas sudah termasuk biaya mobilisasi personil.',
                   'Penawaran berlaku selama 30 hari dari tanggal dokumen ini dikeluarkan.',
                 ].map((note, i) => (
                   <li key={i} className="flex gap-3 text-xs font-bold text-slate-600">
                      <span className="text-blue-600 font-black tracking-tighter">0{i+1}.</span>
                      {note}
                   </li>
                 ))}
              </ul>
              <div className="flex flex-col items-center md:items-end justify-center">
                 <div className="text-center w-56 space-y-1">
                    <p className="text-xs font-black text-slate-900 uppercase italic">PT Gema Teknik Perkasa</p>
                    <p className="text-[10px] font-bold text-slate-500">
                      Bekasi, {new Date(quotation.date || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600 pt-1">Hormat kami,</p>
                    <div className="h-16" />
                    <p className="text-sm font-black text-slate-900 italic border-b-2 border-slate-900 pb-1">Syamsudin</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex justify-center items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pb-10 print:hidden">
          <div className="w-8 h-px bg-slate-300" />
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" /> Premium Ledger Document Security
          </span>
          <div className="w-8 h-px bg-slate-300" />
        </div>
      </div>

      {/* CSS for print layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .min-h-screen { min-height: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
          thead tr { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-blue-600 { background-color: #2563eb !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-emerald-500 { background-color: #10b981 !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .text-blue-600 { color: #2563eb !important; }
        }
      `}} />
    </div>
  );
}
