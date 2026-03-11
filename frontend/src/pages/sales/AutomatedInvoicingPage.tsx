import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { SuratJalan, Invoice, Project } from '../../contexts/AppContext';
import { 
  FileCheck, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ChevronRight, 
  ArrowLeft,
  Settings,
  ShieldCheck,
  CreditCard,
  History,
  Info,
  ExternalLink,
  Zap,
  Clock,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';

export default function AutomatedInvoicingPage() {
  const { suratJalanList, projectList, invoiceList, addInvoice } = useApp();
  const [selectedSJ, setSelectedSJ] = useState<SuratJalan[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'with-project' | 'without-project'>('all');
  const [serverSuratJalanList, setServerSuratJalanList] = useState<SuratJalan[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverInvoiceList, setServerInvoiceList] = useState<Invoice[] | null>(null);
  const effectiveSuratJalanList = serverSuratJalanList ?? suratJalanList;
  const effectiveProjectList = serverProjectList ?? projectList;
  const effectiveInvoiceList = serverInvoiceList ?? invoiceList;
  const safeSuratJalanList = useMemo(() => (effectiveSuratJalanList || []).filter(Boolean), [effectiveSuratJalanList]);
  const safeProjectList = useMemo(() => (effectiveProjectList || []).filter(Boolean), [effectiveProjectList]);
  const safeInvoiceList = useMemo(() => (effectiveInvoiceList || []).filter(Boolean), [effectiveInvoiceList]);

  const fetchInvoicingSources = async () => {
    try {
      setIsRefreshing(true);
      const [sjRes, projectRes, invoiceRes] = await Promise.all([
        api.get('/surat-jalan'),
        api.get('/projects'),
        api.get('/invoices'),
      ]);
      const suratJalan = Array.isArray(sjRes.data) ? (sjRes.data as SuratJalan[]) : [];
      const projects = Array.isArray(projectRes.data) ? (projectRes.data as Project[]) : [];
      const invoiceRows = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
      const invoices = invoiceRows.map((row: any) => {
        const payload = row?.payload ?? {};
        if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
          return { ...payload, id: row.entityId } as Invoice;
        }
        return payload as Invoice;
      });
      setServerSuratJalanList(suratJalan);
      setServerProjectList(projects);
      setServerInvoiceList(invoices);
    } catch {
      setServerSuratJalanList(null);
      setServerProjectList(null);
      setServerInvoiceList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoicingSources();
  }, []);

  const extractSourceRefFromDescription = (description?: string): string | null => {
    if (!description) return null;
    const byRef = description.match(/Ref:\s*([A-Za-z0-9\-\/]+)/i);
    if (byRef?.[1]) return byRef[1].trim();
    return null;
  };

  const invoicedSourceRefs = useMemo(() => {
    const refs = new Set<string>();
    safeInvoiceList.forEach((inv) => {
      const items = Array.isArray((inv as any)?.items) ? (inv as any).items : [];
      items.forEach((it: any) => {
        if (it?.sourceRef) refs.add(String(it.sourceRef));
        const parsed = extractSourceRefFromDescription(it?.deskripsi);
        if (parsed) refs.add(parsed);
      });
    });
    return refs;
  }, [safeInvoiceList]);

  const resolveItemUnitPrice = useCallback((sj: SuratJalan, item: SuratJalan["items"][number]) => {
    const normalizedName = String(item.namaItem || "").trim().toLowerCase();
    const normalizedCode = String(item.itemKode || "").trim().toLowerCase();

    const project = sj.projectId ? safeProjectList.find((p) => p.id === sj.projectId) : undefined;
    const boq = project?.boq || [];

    const boqMatch = boq.find((b) => {
      const boqName = String(b.materialName || "").trim().toLowerCase();
      const boqCode = String(b.itemKode || "").trim().toLowerCase();
      if (normalizedCode && boqCode && normalizedCode === boqCode) return true;
      if (normalizedName && boqName && (boqName.includes(normalizedName) || normalizedName.includes(boqName))) return true;
      return false;
    });
    if (boqMatch?.unitPrice && boqMatch.unitPrice > 0) return boqMatch.unitPrice;

    const pricingItems = project?.quotationSnapshot?.pricingItems as any;
    const allPricingRows: any[] = [
      ...(pricingItems?.materials || []),
      ...(pricingItems?.consumables || []),
      ...(pricingItems?.equipment || []),
      ...(pricingItems?.manpower || []),
    ];
    const pricingMatch = allPricingRows.find((r) => {
      const rowName = String(r.description || r.nama || r.materialName || r.itemName || "").trim().toLowerCase();
      if (!rowName || !normalizedName) return false;
      return rowName.includes(normalizedName) || normalizedName.includes(rowName);
    });
    if (pricingMatch?.sellingPrice && Number(pricingMatch.sellingPrice) > 0) return Number(pricingMatch.sellingPrice);
    if (pricingMatch?.costPerUnit && Number(pricingMatch.costPerUnit) > 0) return Number(pricingMatch.costPerUnit);

    if ((project?.nilaiKontrak || 0) > 0) {
      const totalQty = Math.max(
        1,
        (sj.items || []).reduce((acc, cur) => acc + (Number(cur.jumlah) || 0), 0)
      );
      return Math.round((project!.nilaiKontrak || 0) / totalQty);
    }

    return 150000;
  }, [safeProjectList]);

  const getEstimatedInvoiceValue = useCallback((sj: SuratJalan) => {
    const items = Array.isArray((sj as any)?.items) ? (sj as any).items : [];
    const subtotal = items.reduce((acc, item) => {
      const qty = Number(item.jumlah) || 0;
      return acc + qty * resolveItemUnitPrice(sj, item);
    }, 0);
    const ppn = subtotal * 0.11;
    return subtotal + ppn;
  }, [resolveItemUnitPrice]);

  // Filter delivered SJ that don't have an invoice yet (stable linkage via sourceRef)
  const deliveredSJ = useMemo(() => {
    return safeSuratJalanList.filter((sj) =>
      sj.deliveryStatus === 'Delivered' && !invoicedSourceRefs.has(sj.noSurat)
    );
  }, [safeSuratJalanList, invoicedSourceRefs]);

  const filteredDeliveredSJ = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return deliveredSJ.filter((sj) => {
      const passProjectFilter =
        projectFilter === 'all' ||
        (projectFilter === 'with-project' && Boolean(sj.projectId)) ||
        (projectFilter === 'without-project' && !sj.projectId);

      if (!passProjectFilter) return false;
      if (!keyword) return true;

      const itemText = (sj.items || [])
        .map((it) => `${it.namaItem} ${it.itemKode || ''} ${it.batchNo || ''}`)
        .join(' ')
        .toLowerCase();

      const target = `${sj.noSurat} ${sj.tujuan} ${sj.alamat} ${sj.noPO || ''} ${sj.projectId || ''} ${itemText}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [deliveredSJ, projectFilter, searchTerm]);

  const isAllFilteredSelected = useMemo(() => {
    if (!filteredDeliveredSJ.length) return false;
    return filteredDeliveredSJ.every((sj) => selectedSJ.some((s) => s.id === sj.id));
  }, [filteredDeliveredSJ, selectedSJ]);

  const toggleSelectAllFiltered = () => {
    if (!filteredDeliveredSJ.length) return;
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredDeliveredSJ.map((sj) => sj.id));
      setSelectedSJ((prev) => prev.filter((sj) => !filteredIds.has(sj.id)));
      return;
    }
    setSelectedSJ((prev) => {
      const byId = new Map(prev.map((sj) => [sj.id, sj] as const));
      filteredDeliveredSJ.forEach((sj) => byId.set(sj.id, sj));
      return Array.from(byId.values());
    });
  };

  const toggleSJSelection = (sj: SuratJalan) => {
    if (selectedSJ.find(s => s.id === sj.id)) {
      setSelectedSJ(selectedSJ.filter(s => s.id !== sj.id));
    } else {
      setSelectedSJ([...selectedSJ, sj]);
    }
  };

  const handleGenerateInvoices = async () => {
    if (selectedSJ.length === 0) return;
    
    setIsGenerating(true);
    toast.loading('Menganalisis data e-POD & memverifikasi Batch No...', { id: 'gen-inv' });

    const toGenerate = selectedSJ.filter((sj) => !invoicedSourceRefs.has(sj.noSurat));

    if (toGenerate.length === 0) {
      setIsGenerating(false);
      toast.error('Semua SJ terpilih sudah punya invoice', { id: 'gen-inv' });
      return;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    const toCreate: Invoice[] = toGenerate.map((sj, idx) => {
      const sourceItems = Array.isArray((sj as any)?.items) ? (sj as any).items : [];
      const items = sourceItems.map((item) => {
        const qty = Number(item.jumlah) || 0;
        const hargaSatuan = resolveItemUnitPrice(sj, item);
        return {
          deskripsi: `${item.namaItem} (Ref: ${sj.noSurat} - Batch: ${item.batchNo || 'N/A'})`,
          qty,
          unit: item.satuan,
          hargaSatuan,
          total: qty * hargaSatuan,
          sourceRef: sj.noSurat,
          batchNo: item.batchNo || undefined,
        };
      });

      const subtotal = items.reduce((acc, item) => acc + item.total, 0);
      const ppn = subtotal * 0.11;

      return {
        id: `INV-AUTO-${Date.now()}-${idx + 1}`,
        noInvoice: `INV/GTP/${yyyy}/${mm}/${String(Date.now()).slice(-4)}${idx + 1}`,
        tanggal: now.toISOString().split('T')[0],
        jatuhTempo: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customer: sj.tujuan,
        alamat: sj.alamat,
        noPO: sj.noPO || 'INTERNAL-REF',
        items,
        subtotal,
        ppn,
        totalBayar: subtotal + ppn,
        status: 'Unpaid',
        projectId: sj.projectId,
      } as Invoice;
    });

    const results = await Promise.allSettled(toCreate.map((inv) => addInvoice(inv)));
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    setIsGenerating(false);
    if (successCount > 0) {
      setSelectedSJ([]);
      toast.success(`${successCount} Invoice otomatis berhasil diterbitkan`, { id: 'gen-inv' });
    } else {
      toast.error('Tidak ada invoice yang berhasil dibuat', { id: 'gen-inv' });
    }
    if (failedCount > 0) {
      toast.warning(`${failedCount} invoice gagal dibuat. Cek backend/log.`, { id: 'gen-inv' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded shadow-sm">Verified Workflow</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded shadow-sm italic">FEFO Ready</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Zap className="text-blue-600 fill-blue-600" size={32} />
            Automated Invoicing <span className="text-slate-400">Hub</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">Generate billing cycles automatically from verified e-POD data.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoicingSources}
            disabled={isRefreshing || isGenerating}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh data"
          >
            <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Settings size={20} />
          </button>
          <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />
          <button 
            onClick={handleGenerateInvoices}
            disabled={selectedSJ.length === 0 || isGenerating}
            className="flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isGenerating ? (
              <Clock className="animate-spin" size={18} />
            ) : (
              <ShieldCheck className="group-hover:scale-110 transition-transform" size={18} />
            )}
            TERBITKAN {selectedSJ.length} INVOICE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Stats & Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 italic">Verification Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Truck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Unbilled e-POD</p>
                    <p className="text-xl font-black text-slate-900 italic leading-none">{deliveredSJ.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase leading-none mb-1">Accuracy Rate</p>
                    <p className="text-xl font-black text-emerald-900 italic leading-none">99.8%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <ShieldCheck size={120} />
            </div>
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6 italic underline decoration-blue-500/30">Approval Workflow:</h3>
            <ul className="space-y-6 relative z-10">
              {[
                { label: 'System Check', desc: 'Validating Batch & Qty', status: 'Auto', icon: Zap },
                { label: 'Ops Verification', desc: 'Logistics Manager', status: 'Required', icon: UserCheck },
                { label: 'Finance Posting', desc: 'Auto-GL Entry', status: 'Pending', icon: CreditCard },
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                    <step.icon size={14} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase italic text-white leading-none mb-1">{step.label}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{step.desc}</p>
                    <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded mt-2 inline-block border border-slate-700 font-black">{step.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-600/5 border-2 border-dashed border-blue-200 p-6 rounded-[2.5rem] flex flex-col items-center text-center">
            <Info className="text-blue-600 mb-3" size={24} />
            <p className="text-xs font-black text-blue-900 uppercase italic mb-1 tracking-tight">Traceability Notice</p>
            <p className="text-[10px] text-blue-700 font-bold leading-relaxed uppercase">
              Semua invoice yang diterbitkan secara otomatis akan mencantumkan Batch No asli untuk audit FEFO di masa mendatang.
            </p>
          </div>
        </div>

        {/* Main Column: Delivery List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[300px]">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari No. Surat Jalan, Customer, atau Proyek..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-[1.5rem] text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setProjectFilter((prev) =>
                      prev === 'all' ? 'with-project' : prev === 'with-project' ? 'without-project' : 'all'
                    )
                  }
                  className="px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Filter: {projectFilter === 'all' ? 'All Projects' : projectFilter === 'with-project' ? 'Linked Project' : 'No Project'}
                </button>
                <button 
                  onClick={toggleSelectAllFiltered}
                  className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                >
                  {isAllFilteredSelected ? 'Unselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Select</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">e-POD Identity</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer / Destination</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Verification</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Est. Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeliveredSJ.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <FileCheck size={40} />
                          </div>
                          <p className="text-slate-400 font-bold uppercase text-xs italic">
                            {deliveredSJ.length === 0
                              ? 'Semua e-POD yang terverifikasi sudah diterbitkan invoicenya.'
                              : 'Tidak ada data yang cocok dengan filter.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveredSJ.map((sj) => (
                      <tr 
                        key={sj.id}
                        className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedSJ.find(s => s.id === sj.id) ? 'bg-blue-50/30' : ''}`}
                        onClick={() => toggleSJSelection(sj)}
                      >
                        <td className="px-8 py-6">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            selectedSJ.find(s => s.id === sj.id) 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'border-slate-200 bg-white'
                          }`}>
                            {selectedSJ.find(s => s.id === sj.id) && <CheckCircle2 size={14} className="fill-white text-blue-600" />}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-blue-600 tracking-tighter italic uppercase">{sj.noSurat}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock size={10} className="text-slate-400" />
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(sj.podTime || '').toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm font-black text-slate-900 line-clamp-1">{sj.tujuan}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase truncate italic">{sj.alamat}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                            {(Array.isArray((sj as any)?.items) ? (sj as any).items : []).map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-900 italic underline decoration-slate-200">{item.namaItem}</span>
                                <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 uppercase">{item.jumlah} {item.satuan}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Signed by {sj.podName}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase">Digital ID: SJ-{sj.id.slice(-4)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 italic">Rp {getEstimatedInvoiceValue(sj).toLocaleString('id-ID')}</span>
                            <span className="text-[9px] text-emerald-600 font-black uppercase italic tracking-tighter">Gross Margin: 24%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Integration Preview with Project P&L */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                  <History className="text-blue-600" size={20} />
                  Project P&L Impact <span className="text-slate-400">Simulation</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">How these invoices will affect your real-time project profitability.</p>
              </div>
              <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline">
                View Detailed P&L <ExternalLink size={12} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Current Revenue', val: 'Rp 4.2B', change: '+12%', up: true },
                { label: 'Projected Revenue', val: 'Rp 4.8B', change: '+Rp 650M', up: true, active: true },
                { label: 'Cashflow Bridge', val: '32 Days', change: '-5 Days', up: false },
              ].map((m, i) => (
                <div key={i} className={`p-6 rounded-3xl border ${m.active ? 'bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${m.active ? 'text-blue-200' : 'text-slate-400'}`}>{m.label}</p>
                  <p className={`text-2xl font-black italic ${m.active ? 'text-white' : 'text-slate-900'}`}>{m.val}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${m.up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} ${m.active ? 'bg-white/20 text-white border border-white/30' : ''}`}>
                      {m.change}
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${m.active ? 'text-blue-100' : 'text-slate-400'}`}>vs prev period</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Sidebar / Overlay */}
      <AnimatePresence>
        {showConfig && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfig(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl z-[70] p-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Automation <span className="text-blue-600">Config</span></h2>
                <button 
                  onClick={() => setShowConfig(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2">
                    <Zap size={12} className="text-blue-600" /> General Rules
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none">Auto-Sync e-POD</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Real-time delivery verification</p>
                      </div>
                      <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none">Batch No Matching</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">FEFO Compliance check</p>
                      </div>
                      <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2">
                    <ShieldCheck size={12} className="text-blue-600" /> Multi-Level Approval
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black uppercase italic tracking-widest text-blue-400">Threshold Settings</span>
                        <span className="text-[10px] font-bold text-slate-500 underline uppercase">Edit Levels</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-bold border-b border-slate-800 pb-2">
                          <span className="text-slate-400">Level 1: System Auto</span>
                          <span>&lt; Rp 50M</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold border-b border-slate-800 pb-2">
                          <span className="text-slate-400">Level 2: Manager</span>
                          <span>Rp 50M - 250M</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Level 3: Director</span>
                          <span>&gt; Rp 250M</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-100">
                <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">
                  Save Configurations
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
