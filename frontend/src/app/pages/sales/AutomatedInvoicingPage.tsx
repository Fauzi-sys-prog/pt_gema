import React, { useState, useMemo } from 'react';
import { useApp, type SuratJalan, type Invoice, type Project } from '../../contexts/AppContext';
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
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { motion } from 'motion/react';

export default function AutomatedInvoicingPage() {
  const { suratJalanList, projectList, invoiceList, addInvoice, stockItemList, quotationList } = useApp();
  const [selectedSJ, setSelectedSJ] = useState<SuratJalan[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const deliveredSJ = useMemo(() => {
    const unbilled = suratJalanList.filter(sj =>
      sj.deliveryStatus === 'Delivered' &&
      !invoiceList.some(inv => inv.items.some((item: any) => item.deskripsi.includes(sj.noSurat)))
    );
    if (!searchTerm.trim()) return unbilled;
    const q = searchTerm.toLowerCase();
    return unbilled.filter(sj =>
      sj.noSurat?.toLowerCase().includes(q) ||
      sj.tujuan?.toLowerCase().includes(q) ||
      sj.items.some(i => i.namaItem?.toLowerCase().includes(q))
    );
  }, [suratJalanList, invoiceList, searchTerm]);

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
    
    // Simulate multi-level approval and auto-generation
    toast.loading('Menganalisis data e-POD & memverifikasi Batch No...', { id: 'gen-inv' });
    
    setTimeout(() => {
      selectedSJ.forEach(sj => {
        // Find project → quotation for selling prices
        const project = projectList.find(p =>
          p.id === sj.projectId || p.namaProject === sj.tujuan || p.customer === sj.tujuan
        );
        const quotation = project?.quotationId
          ? (quotationList as any[]).find(q => q.id === project.quotationId)
          : null;

        // Build a lookup: item name → hargaJualUnit from quotation sections
        const quoItemPrices: Record<string, number> = {};
        if (quotation?.sections) {
          quotation.sections.forEach((sec: any) => {
            (sec.items || []).forEach((item: any) => {
              const key = (item.keterangan || '').toLowerCase();
              if (key) quoItemPrices[key] = item.hargaJualUnit || item.hargaJual || 0;
            });
          });
        }

        const resolveHarga = (namaItem: string, itemKode: string) => {
          // 1. Match by name in quotation sections
          const quoPrice = quoItemPrices[(namaItem || '').toLowerCase()];
          if (quoPrice > 0) return quoPrice;
          // 2. Fallback to stock item hargaSatuan (HPP — less ideal but prevents 0)
          const stockItem = stockItemList.find(s => s.kode === itemKode || s.nama === namaItem);
          return stockItem?.hargaSatuan || 0;
        };

        const invoiceItems = sj.items.map((item: any) => {
          const harga = resolveHarga(item.namaItem, item.itemKode);
          return {
            deskripsi: `${item.namaItem} (Ref: ${sj.noSurat} - Batch: ${item.batchNo || 'N/A'})`,
            qty: item.jumlah,
            unit: item.satuan,
            hargaSatuan: harga,
            total: item.jumlah * harga,
          };
        });

        const subtotal = invoiceItems.reduce((s: number, i: any) => s + i.total, 0);

        const newInvoice: Invoice = {
          id: `INV-AUTO-${Math.random().toString(36).substr(2, 9)}`,
          noInvoice: `INV/GTP/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`,
          tanggal: new Date().toISOString().split('T')[0],
          jatuhTempo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          customer: sj.tujuan,
          alamat: sj.alamat,
          noPO: sj.noPO || 'INTERNAL-REF',
          items: invoiceItems,
          subtotal,
          ppn: subtotal * 0.11,
          totalBayar: subtotal * 1.11,
          status: 'Unpaid',
          projectId: sj.projectId,
        };
        
        addInvoice(newInvoice);
      });
      
      setIsGenerating(false);
      setSelectedSJ([]);
      toast.success(`${selectedSJ.length} Invoice Otomatis Berhasil Diterbitkan & Dikirim ke Keuangan`, { id: 'gen-inv' });
    }, 2000);
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
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-[1.5rem] text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <button className="px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Filter: All Projects</button>
                <button 
                  onClick={() => setSelectedSJ(deliveredSJ)}
                  className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                >
                  Select All
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
                  {deliveredSJ.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <FileCheck size={40} />
                          </div>
                          <p className="text-slate-400 font-bold uppercase text-xs italic">Semua e-POD yang terverifikasi sudah diterbitkan invoicenya.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    deliveredSJ.map((sj) => (
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
                            {sj.items.map((item, idx) => (
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
                            <span className="text-sm font-black text-slate-900 italic">Rp {(sj.items.reduce((acc, i) => {
                              const stock = stockItemList.find(s => s.kode === i.itemKode || s.nama === i.namaItem);
                              return acc + (i.jumlah * (stock?.hargaSatuan || 0));
                            }, 0) * 1.11).toLocaleString('id-ID')}</span>
                            <span className="text-[9px] text-emerald-600 font-black uppercase italic tracking-tighter">incl. PPN 11%</span>
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
    </div>
  );
}
