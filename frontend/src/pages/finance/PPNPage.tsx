import { useEffect, useState, useMemo } from 'react'; import { FileText, Search, Download, Filter, ArrowUpRight, ArrowDownLeft, Calendar, ChevronRight, TrendingUp, Scale, ShieldCheck, ShieldAlert, Printer, FileCheck2, AlertCircle, RefreshCw } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Invoice, Quotation, VendorInvoice } from '../../contexts/AppContext';
import api from '../../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend,
  ResponsiveContainer,
  Tooltip,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';

export default function PPNPage() {
  const { invoiceList, vendorInvoiceList, quotationList, projectList, addAuditLog } = useApp();
  const [activeTab, setActiveTab] = useState<'summary' | 'keluaran' | 'masukan'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [serverInvoiceList, setServerInvoiceList] = useState<Invoice[] | null>(null);
  const [serverVendorInvoiceList, setServerVendorInvoiceList] = useState<VendorInvoice[] | null>(null);
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const [serverPpnSummary, setServerPpnSummary] = useState<{
    totalKeluaran: number;
    totalMasukan: number;
    ppnKurangBayar: number;
    ppnLebihBayar: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveInvoiceList = serverInvoiceList ?? invoiceList;
  const effectiveVendorInvoiceList = serverVendorInvoiceList ?? vendorInvoiceList;
  const effectiveQuotationList = serverQuotationList ?? quotationList;
  const safeInvoiceList = useMemo(() => (effectiveInvoiceList || []).filter(Boolean), [effectiveInvoiceList]);
  const safeVendorInvoiceList = useMemo(() => (effectiveVendorInvoiceList || []).filter(Boolean), [effectiveVendorInvoiceList]);
  const safeQuotationList = useMemo(() => (effectiveQuotationList || []).filter(Boolean), [effectiveQuotationList]);

  const fetchPpnSources = async () => {
    try {
      setIsRefreshing(true);
      const [ppnRes, salesRes, purchaseRes, quotationRes] = await Promise.all([
        api.get<{
          summary?: {
            totalKeluaran?: number;
            totalMasukan?: number;
            ppnKurangBayar?: number;
            ppnLebihBayar?: number;
          };
          keluaran?: Array<any>;
          masukan?: Array<any>;
        }>('/dashboard/finance-ppn-summary'),
        api.get('/invoices'),
        api.get('/finance/vendor-invoices'),
        api.get('/quotations'),
      ]);

      const normalizeRows = <T,>(rows: any[]): T[] =>
        rows.map((row: any) => {
          const payload = row?.payload ?? {};
          if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
            return { ...payload, id: row.entityId } as T;
          }
          return payload as T;
        });

      const salesRows = Array.isArray(salesRes.data) ? salesRes.data : [];
      const purchaseRows = Array.isArray(purchaseRes.data) ? purchaseRes.data : [];
      const quotationRows = Array.isArray(quotationRes.data)
        ? quotationRes.data
        : Array.isArray((quotationRes.data as { items?: unknown[] })?.items)
          ? ((quotationRes.data as { items?: unknown[] }).items as unknown[])
          : [];
      setServerInvoiceList(normalizeRows<Invoice>(salesRows));
      setServerVendorInvoiceList(normalizeRows<VendorInvoice>(purchaseRows));
      setServerQuotationList(normalizeRows<Quotation>(quotationRows as any[]));
      if (ppnRes.data?.summary) {
        setServerPpnSummary({
          totalKeluaran: Number(ppnRes.data.summary.totalKeluaran || 0),
          totalMasukan: Number(ppnRes.data.summary.totalMasukan || 0),
          ppnKurangBayar: Number(ppnRes.data.summary.ppnKurangBayar || 0),
          ppnLebihBayar: Number(ppnRes.data.summary.ppnLebihBayar || 0),
        });
      } else {
        setServerPpnSummary(null);
      }
    } catch {
      setServerInvoiceList(null);
      setServerVendorInvoiceList(null);
      setServerQuotationList(null);
      setServerPpnSummary(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPpnSources();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Process PPN Keluaran (from Sales Invoices)
  const ppnKeluaran = useMemo(() => {
    return safeInvoiceList.map(inv => ({
      id: inv.id,
      tanggal: inv.tanggal,
      nomor: inv.noInvoice,
      noFaktur: inv.noFakturPajak,
      pihak: inv.customer,
      dpp: inv.subtotal || 0,
      ppn: inv.ppn || 0,
      status: inv.status,
      tipe: 'Sales',
      projectId: inv.projectId
    }));
  }, [safeInvoiceList]);

  // Process PPN Masukan (from Vendor Invoices)
  const ppnMasukan = useMemo(() => {
    return safeVendorInvoiceList.map(vInv => ({
      id: vInv.id,
      tanggal: vInv.tanggal,
      nomor: vInv.noInvoiceVendor,
      noFaktur: vInv.noFakturPajak,
      pihak: vInv.supplier,
      dpp: vInv.subtotal || 0,
      ppn: vInv.ppn || 0,
      status: vInv.status,
      tipe: 'Purchase',
      projectId: vInv.projectId
    }));
  }, [safeVendorInvoiceList]);

  const ppnQuotation = useMemo(() => {
    const normalizePpnAmount = (q: Quotation) => {
      const dpp = Number(q.totalSebelumDiskon || 0);
      const ppnRaw = Number((q as any).ppn || 0);
      const grandTotal = Number(q.grandTotal || 0);
      if (ppnRaw > 100) return ppnRaw;
      if (grandTotal > dpp && dpp > 0) return grandTotal - dpp;
      return dpp * (ppnRaw / 100);
    };

    return safeQuotationList.map((q) => ({
      id: q.id,
      tanggal: q.tanggal,
      nomor: q.noPenawaran || q.nomorQuotation || q.id,
      noFaktur: '',
      pihak: q.kepada || q.perusahaan || q.customer?.nama || '-',
      dpp: Number(q.totalSebelumDiskon || 0),
      ppn: normalizePpnAmount(q),
      status: q.status || 'Draft',
      tipe: 'Quotation',
      projectId: q.projectId,
    }));
  }, [safeQuotationList]);

  const totalKeluaran = useMemo(
    () =>
      serverPpnSummary
        ? Number(serverPpnSummary.totalKeluaran || 0)
        : ppnKeluaran.reduce((sum, item) => sum + item.ppn, 0) +
          ppnQuotation.reduce((sum, item) => sum + item.ppn, 0),
    [ppnKeluaran, ppnQuotation, serverPpnSummary]
  );
  const totalMasukan = useMemo(
    () => Number(serverPpnSummary?.totalMasukan ?? ppnMasukan.reduce((sum, item) => sum + item.ppn, 0)),
    [ppnMasukan, serverPpnSummary]
  );
  const netPPN = totalKeluaran - totalMasukan;

  const complianceStats = useMemo(() => {
    const total = ppnKeluaran.length + ppnMasukan.length + ppnQuotation.length;
    const withFaktur = [...ppnKeluaran, ...ppnMasukan, ...ppnQuotation].filter(i => i.noFaktur).length;
    return {
      total,
      withFaktur,
      percentage: total > 0 ? Math.round((withFaktur / total) * 100) : 0
    };
  }, [ppnKeluaran, ppnMasukan, ppnQuotation]);

  // Monthly Chart Data (Mocking monthly distribution for demo)
  const chartData = useMemo(() => [
    { name: 'Jan', keluaran: totalKeluaran * 0.15, masukan: totalMasukan * 0.12 },
    { name: 'Feb', keluaran: totalKeluaran * 0.2, masukan: totalMasukan * 0.18 },
    { name: 'Mar', keluaran: totalKeluaran * 0.25, masukan: totalMasukan * 0.22 },
    { name: 'Apr', keluaran: totalKeluaran * 0.2, masukan: totalMasukan * 0.28 },
    { name: 'Mei', keluaran: totalKeluaran * 0.2, masukan: totalMasukan * 0.2 },
  ], [totalKeluaran, totalMasukan]);

  const filteredData = useMemo(() => {
    const all = [...ppnKeluaran, ...ppnQuotation, ...ppnMasukan];
    const keyword = String(searchTerm || '').toLowerCase();
    return all
      .filter(item => {
        if (activeTab === 'keluaran') return item.tipe === 'Sales' || item.tipe === 'Quotation';
        if (activeTab === 'masukan') return item.tipe === 'Purchase';
        return true;
      })
      .filter(item =>
        String(item.nomor || '').toLowerCase().includes(keyword) ||
        String(item.pihak || '').toLowerCase().includes(keyword) ||
        String(item.noFaktur || '').toLowerCase().includes(keyword)
      )
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [ppnKeluaran, ppnQuotation, ppnMasukan, activeTab, searchTerm]);

  const handleExportLedger = async () => {
    if (!filteredData.length) {
      toast.info('Tidak ada data PPN untuk diekspor.');
      return;
    }
    const payload = {
      tab: activeTab,
      items: filteredData,
      generatedBy: 'Finance Command Center',
      generatedAt: new Date().toISOString(),
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/ppn-ledger/excel', payload, { responseType: 'blob' }),
        api.post('/exports/ppn-ledger/word', payload, { responseType: 'blob' }),
      ]);
      const dateKey = new Date().toISOString().slice(0, 10);
      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `ppn-ledger-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `ppn-ledger-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);
    } catch {
      toast.error('Export PPN ledger gagal.');
      return;
    }
    addAuditLog({
      action: 'PPN_EXPORTED',
      module: 'Finance',
      details: `Export PPN ledger (${filteredData.length} baris) as Word+Excel`,
      status: 'Success',
    });
    toast.success('PPN ledger berhasil diekspor (.doc + .xls).');
  };

  const handleGenerateSpt = () => {
    window.print();
    addAuditLog({
      action: 'PPN_SPT_GENERATED',
      module: 'Finance',
      details: 'Generate SPT Masa (print view)',
      status: 'Success',
    });
    toast.success('SPT Masa siap disimpan sebagai PDF/print.');
  };

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-red-200">Tax Compliance</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Fiscal Intelligence</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-4">
              <Scale className="text-red-600" size={40} />
              PPN Reconciliation
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Penyelarasan Pajak Masukan & Keluaran secara Real-Time</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchPpnSources}
            disabled={isRefreshing}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExportLedger} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <Download size={16} /> Export Word + Excel
          </button>
          <button onClick={handleGenerateSpt} className="px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-xl shadow-red-200">
            <Printer size={16} /> Generate SPT Masa
          </button>
        </div>
      </div>

      {/* Financial Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
            <ArrowUpRight size={120} className="text-red-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Pajak Keluaran</p>
          <h3 className="text-3xl font-black italic text-red-600 mb-2">{formatCurrency(totalKeluaran)}</h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
             <TrendingUp size={14} className="text-emerald-500" />
             <span>Terintegrasi dengan {ppnKeluaran.length} Invoices + {ppnQuotation.length} Quotations</span>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
            <ArrowDownLeft size={120} className="text-indigo-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Pajak Masukan</p>
          <h3 className="text-3xl font-black italic text-indigo-600 mb-2">{formatCurrency(totalMasukan)}</h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
             <TrendingUp size={14} className="text-indigo-500" />
             <span>Diterima dari {ppnMasukan.length} Vendor Invoices</span>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
            <Scale size={120} className="text-white" />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Net Tax Position (Kurang Bayar)</p>
          <h3 className={`text-3xl font-black italic mb-2 ${netPPN >= 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {formatCurrency(Math.abs(netPPN))}
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
             <Calendar size={14} />
             <span>Periode Jan - Jan 2026</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compliance Score */}
        <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
           <div className="relative">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                <circle 
                  cx="80" cy="80" r="70" fill="none" stroke={complianceStats.percentage > 80 ? "#10B981" : "#F59E0B"} 
                  strokeWidth="12" strokeDasharray={440} strokeDashoffset={440 - (440 * complianceStats.percentage) / 100}
                  strokeLinecap="round" className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-4xl font-black italic text-slate-900 leading-none">{complianceStats.percentage}%</span>
                 <span className="text-[9px] font-black text-slate-400 uppercase mt-1">Compliant</span>
              </div>
           </div>
           <div>
              <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 mb-2">Faktur Pajak Health</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {complianceStats.withFaktur} dari {complianceStats.total} transaksi telah terlampir Faktur Pajak resmi.
              </p>
           </div>
           <div className="w-full pt-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                 <span className="text-slate-400 flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Validated Invoices</span>
                 <span className="text-slate-900">{complianceStats.withFaktur}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                 <span className="text-slate-400 flex items-center gap-1"><ShieldAlert size={12} className="text-rose-500" /> Missing Faktur</span>
                 <span className="text-slate-900">{complianceStats.total - complianceStats.withFaktur}</span>
              </div>
           </div>
        </div>

        {/* Analytics Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-10">
              <div>
                <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-red-600" size={24} />
                  Fiscan Trend Analysis
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Perbandingan PPN Bulanan</p>
              </div>
              <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-red-500">
                <option>Filter Tahun 2026</option>
              </select>
           </div>
           <div className="h-[300px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }}
                    tickFormatter={(val) => `Rp ${val/1000000}M`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">{payload[0].payload.name}</p>
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-3 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-[10px] font-bold text-white uppercase">{p.name}: {formatCurrency(p.value as number)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar name="Keluaran" dataKey="keluaran" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar name="Masukan" dataKey="masukan" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
           <div className="flex gap-2 p-1 bg-slate-100 rounded-[1.5rem]">
              {(['summary', 'keluaran', 'masukan'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'summary' ? 'All Ledger' : tab === 'keluaran' ? 'Pajak Keluaran' : 'Pajak Masukan'}
                </button>
              ))}
           </div>
           
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Cari Faktur, Customer, atau Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-red-500 transition-all outline-none"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Info</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Faktur Pajak</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pihak Terkait</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">DPP (Basis)</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Nilai PPN</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item) => (
                <tr key={`${item.id}-${item.tipe}`} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.tanggal}</span>
                       <span className="text-sm font-black text-slate-900 italic tracking-tight uppercase">{item.nomor}</span>
                       <span className={`text-[9px] font-bold mt-1 uppercase ${
                         item.tipe === 'Sales' || item.tipe === 'Quotation' ? 'text-rose-500' : 'text-indigo-500'
                       }`}>
                         {item.tipe === 'Purchase' ? 'Pajak Masukan' : 'Pajak Keluaran'}
                       </span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    {item.noFaktur ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 w-fit">
                         <FileCheck2 size={14} />
                         <span className="text-[10px] font-black tracking-tight">{item.noFaktur}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 w-fit">
                         <AlertCircle size={14} />
                         <span className="text-[10px] font-black uppercase tracking-tight italic">Belum Ada Faktur</span>
                      </div>
                    )}
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-xs font-black text-slate-700 uppercase italic leading-tight">{item.pihak}</span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <span className="text-xs font-bold text-slate-500">{formatCurrency(item.dpp)}</span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <span className={`text-sm font-black italic ${
                      item.tipe === 'Sales' || item.tipe === 'Quotation' ? 'text-red-600' : 'text-indigo-600'
                    }`}>
                      {formatCurrency(item.ppn)}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <button
                      onClick={() => toast.info(`${item.nomor} • ${item.pihak} • ${formatCurrency(item.ppn)}`)}
                      className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-red-600 rounded-xl transition-all shadow-sm"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <FileText size={64} className="mb-4 text-slate-400" />
                      <p className="text-xl font-black italic uppercase tracking-tighter text-slate-900">Tidak ada transaksi ditemukan</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
