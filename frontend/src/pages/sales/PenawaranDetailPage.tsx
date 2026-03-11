import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; import { ArrowLeft, Printer, CheckCircle2, Clock, XCircle, AlertCircle, FileText, Hammer, Wallet, Building2, ChevronRight, ShieldCheck, Zap, Info, Layers, Check, Target, FileCheck, FileDown, ClipboardList, Plus, Eye } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Quotation } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import type { Project } from '../../contexts/AppContext';
import api from '../../services/api';

export default function PenawaranDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { quotationList, updateQuotation, projectList } = useApp();
  const [activeTab, setActiveTab] = useState<'commercial' | 'technical'>('commercial');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [serverQuotation, setServerQuotation] = useState<Quotation | null>(null);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [quotationRes, projectRes] = await Promise.all([
          api.get(`/quotations/${id}`),
          api.get('/projects'),
        ]);
        if (cancelled) return;
        const q = quotationRes?.data as Quotation;
        setServerQuotation(q && typeof q === 'object' ? q : null);
        setServerProjectList(Array.isArray(projectRes.data) ? (projectRes.data as Project[]) : []);
      } catch {
        if (cancelled) return;
        setServerQuotation(null);
        setServerProjectList(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const quotation = useMemo(
    () => serverQuotation ?? quotationList.find(q => q.id === id),
    [serverQuotation, quotationList, id]
  );

  const effectiveProjectList = serverProjectList ?? projectList;
  const linkedProject = useMemo(() => effectiveProjectList.find(p => p.quotationId === id), [effectiveProjectList, id]);

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle size={48} className="text-slate-300" />
        <h2 className="text-xl font-black text-slate-900 uppercase">Quotation Not Found</h2>
        <button onClick={() => navigate('/sales/penawaran')} className="text-blue-600 font-bold hover:underline uppercase text-xs">Back to List</button>
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

  const sowMatrix = useMemo(() => {
    const base = [
      { item: 'Supply Refractory Material', gtp: true, customer: false, notes: 'Full supply by GTP' },
      { item: 'Manpower / Skilled Labor', gtp: true, customer: false, notes: 'Certified refractory team' },
      { item: 'Scaffolding & Tools', gtp: true, customer: false, notes: 'Standard site tools' },
      { item: 'Power & Water Source', gtp: false, customer: true, notes: 'Provided by client at site' },
      { item: 'Waste Disposal / Bin', gtp: false, customer: true, notes: 'Civil work by client' },
      { item: 'Site Security & Permits', gtp: false, customer: true, notes: 'K3 & Work permit by client' },
      { item: 'Installation Testing / QC', gtp: true, customer: true, notes: 'Joint inspection' },
    ];

    // Add specific equipment from Data Collection if exists
    if (quotation.equipment && quotation.equipment.length > 0) {
      quotation.equipment.forEach((eq: any) => {
        base.push({
          item: `Equipment: ${eq.equipmentName}`,
          gtp: eq.supplier === 'Internal',
          customer: eq.supplier === 'Client',
          notes: `${eq.quantity} ${eq.unit} - ${eq.duration} ${eq.durationType}`
        });
      });
    }

    return base;
  }, [quotation.equipment]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportToWord = async () => {
    if (!quotation) return;
    if (String(quotation.status || "").trim().toUpperCase() !== "APPROVED") {
      toast.error("Export final quotation hanya diizinkan untuk status Approved.");
      return;
    }
    const quotationId = String(quotation.id || id || '').trim();
    if (!quotationId) {
      toast.error('ID quotation tidak valid untuk export');
      return;
    }
    const loadingToast = toast.loading("Preparing Word + Excel document...");
    try {
      const safeNo = String(quotation.nomorQuotation || quotationId).replace(/[^\w.-]+/g, '_');
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/quotations/${quotationId}/word`, { responseType: 'blob' }),
        api.get(`/exports/quotations/${quotationId}/excel`, { responseType: 'blob' }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: 'application/msword' });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `Quotation_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `Quotation_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      toast.dismiss(loadingToast);
      toast.success("Word + Excel document downloaded successfully!");
    } catch {
      toast.dismiss(loadingToast);
      toast.error("Export Word + Excel gagal, silakan coba lagi.");
    }
  };

  const isHighValue = quotation.grandTotal > 500000000;
  const needsApproval = isHighValue && quotation.status === 'Draft';

  const handleRequestApproval = async () => {
    try {
      await updateQuotation(quotation.id, { status: 'Sent' }); // Using 'Sent' as 'Waiting Approval' in this context or we could add a new status
      toast.success("🚀 Permintaan persetujuan telah dikirim ke Manager!");
    } catch {
      // Error toast already handled in AppContext.
    }
  };

  const handleConvertToProject = async () => {
    if (linkedProject) {
      navigate('/project');
      return;
    }
    try {
      await updateQuotation(quotation.id, { status: 'Sent' });
      toast.success("✅ Quotation disinkronkan. Lanjut approval final di Project Ledger.");
      navigate('/project');
    } catch {
      // Error toast already handled in AppContext.
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-slate-200 text-slate-600';
      case 'Sent': return 'bg-blue-500 text-white';
      case 'Rejected': return 'bg-rose-500 text-white';
      case 'Approved': return 'bg-emerald-500 text-white'; // legacy
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 print:bg-white print:p-0">
      {/* Action Header - Hidden in Print */}
      <div className="p-6 lg:px-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/sales/penawaran')}
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
            onClick={handlePrint}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Printer size={16} /> Print Document
          </button>

          <button 
            onClick={handleExportToWord}
            className="px-6 py-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2 shadow-sm"
          >
            <FileDown size={16} /> Export Word + Excel
          </button>
          
          {needsApproval && (
            <button 
              onClick={() => { void handleRequestApproval(); }}
              className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2"
            >
              <ShieldCheck size={16} /> Send for Project Review
            </button>
          )}

          {!linkedProject && (
            <button 
              onClick={() => { void handleConvertToProject(); }}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
            >
              <Zap size={16} /> Convert to Project
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-8">
        {isHighValue && quotation.status !== 'Rejected' && (
          <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl flex items-center gap-4 animate-pulse print:hidden">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0">
               <AlertCircle size={24} />
            </div>
            <div>
               <p className="text-xs font-black text-amber-900 uppercase tracking-widest leading-none">High Value Quotation Detect</p>
               <p className="text-[10px] text-amber-700 font-bold mt-1 uppercase">Nilai tinggi wajib review tambahan sebelum approval final di Project Ledger.</p>
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
                   <p className="text-3xl font-black text-blue-600 italic tracking-tighter leading-none">{formatCurrency(quotation.grandTotal)}</p>
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
             onClick={() => setActiveTab('commercial')}
             className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'commercial' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
           >
              <Wallet size={16} /> Commercial (RAB)
           </button>
           <button 
             onClick={() => setActiveTab('technical')}
             className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'technical' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
           >
              <Hammer size={16} /> Technical (SOW)
           </button>
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'commercial' ? (
            <motion.div 
              key="commercial"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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

                            {(!quotation.materials || quotation.materials.length === 0) && (!quotation.manpower || quotation.manpower.length === 0) && (
                               <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-4 text-center font-bold text-slate-400">1</td>
                                  <td className="px-8 py-4 font-black text-slate-900 italic uppercase">Pekerjaan Jasa Bongkar Pasang & Refractory</td>
                                  <td className="px-8 py-4 text-center font-black text-slate-900">1 <span className="text-[9px] font-bold text-slate-400 uppercase">Lot</span></td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(quotation.subtotal)}</td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(quotation.subtotal)}</td>
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
                         <span className="text-sm font-black text-slate-900 italic tracking-tighter">{formatCurrency(quotation.subtotal)}</span>
                      </div>
                      <div className="flex justify-between w-full">
                         <span className="text-[11px] font-black text-slate-400 uppercase italic">PPN (11%)</span>
                         <span className="text-sm font-black text-slate-900 italic tracking-tighter">{formatCurrency(quotation.ppn)}</span>
                      </div>
                      <div className="w-full h-px bg-slate-200 my-2" />
                      <div className="flex justify-between w-full">
                         <span className="text-xs font-black text-blue-600 uppercase italic">Grand Total</span>
                         <span className="text-2xl font-black text-blue-600 italic tracking-tighter">{formatCurrency(quotation.grandTotal)}</span>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="technical"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <ShieldCheck size={20} className="text-blue-600" />
                            <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Responsibility Matrix (SOW)</h3>
                         </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                         <table className="w-full text-left">
                            <thead>
                               <tr className="bg-slate-900 text-white">
                                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic">Item Pekerjaan</th>
                                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic text-center">GTP</th>
                                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest italic text-center">Cust</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {sowMatrix.map((item, idx) => (
                                 <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-4">
                                       <div className="font-black text-slate-900 italic uppercase text-[11px]">{item.item}</div>
                                       <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{item.notes}</div>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                       {item.gtp ? (
                                         <div className="w-5 h-5 bg-blue-600 rounded-md mx-auto flex items-center justify-center text-white">
                                            <Check size={12} strokeWidth={4} />
                                         </div>
                                       ) : <div className="w-5 h-5 border-2 border-slate-100 rounded-md mx-auto" />}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       {item.customer ? (
                                         <div className="w-5 h-5 bg-amber-500 rounded-md mx-auto flex items-center justify-center text-white">
                                            <Check size={12} strokeWidth={4} />
                                         </div>
                                       ) : <div className="w-5 h-5 border-2 border-slate-100 rounded-md mx-auto" />}
                                    </td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                       <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                             <Layers size={18} className="text-blue-600" />
                             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Attachments</h3>
                          </div>
                          <button className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 transition-all"><Plus size={18} /></button>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="group relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                             <div className="aspect-video bg-slate-200 flex items-center justify-center">
                                <FileText size={32} className="text-slate-400" />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                   <button className="p-2 bg-white rounded-lg text-slate-900"><Eye size={16} /></button>
                                   <button className="p-2 bg-white rounded-lg text-rose-600"><XCircle size={16} /></button>
                                </div>
                             </div>
                             <div className="p-3">
                                <p className="text-[10px] font-black text-slate-900 uppercase italic">Sketch_Boiler_Section.pdf</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">2.4 MB • Drawing</p>
                             </div>
                          </div>

                          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center group hover:border-blue-300 transition-all cursor-pointer">
                             <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all mb-3">
                                <Plus size={20} />
                             </div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-all">Add Technical Draw / Photo</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                 <div className="text-center w-64 space-y-20">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hormat Kami,</p>
                       <p className="text-xs font-black text-slate-900 uppercase italic mt-1">PT Gema Teknik Perkasa</p>
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-900 uppercase italic border-b-2 border-slate-900 pb-1">Direktur Penjualan</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 italic">Authorized Signature</p>
                    </div>
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
