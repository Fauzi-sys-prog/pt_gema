import { useState, useMemo, useEffect } from 'react'; import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { VendorInvoice } from '../../contexts/AppContext';
import { 
  Search, 
  Wallet, 
  Plus, 
  Filter, 
  Eye, 
  Download, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  X,
  CreditCard,
  ArrowUpRight,
  TrendingDown,
  Building2,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';

export default function AccountsPayablePage() {
  const { vendorInvoiceList = [], addVendorInvoice, updateVendorInvoice, projectList = [], poList = [], vendorList = [], addAuditLog, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoice | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [serverStats, setServerStats] = useState<{
    totalPayable: number;
    overdue: number;
    paidThisMonth: number;
    invoiceCount?: number;
    overdueCount?: number;
  } | null>(null);

  const [newInvoice, setNewInvoice] = useState({
    supplier: '',
    noInvoiceVendor: '',
    noPO: '',
    totalAmount: 0,
    jatuhTempo: new Date().toISOString().split('T')[0],
    projectId: '',
    purchaseOrderId: '',
    vendorId: '',
  });

  const normalizedInvoices = useMemo(() => {
    const normalizeStatus = (status: unknown): VendorInvoice["status"] => {
      const s = String(status || "").trim().toUpperCase();
      if (s === "PAID") return "Paid";
      if (s === "PARTIAL") return "Partial";
      if (s === "OVERDUE") return "Overdue";
      return "Unpaid";
    };
    return (vendorInvoiceList || []).map((row) => {
      const inv = row as VendorInvoice & {
        amount?: number;
        noInvoice?: string;
        vendorName?: string;
        tanggal?: string;
      };
      const totalAmount = Number(inv.totalAmount ?? inv.amount ?? 0);
      const paidAmount = Number(inv.paidAmount ?? 0);
      return {
        ...inv,
        noInvoiceVendor: inv.noInvoiceVendor || inv.noInvoice || inv.id,
        supplier: inv.supplier || inv.vendorName || "-",
        noPO: inv.noPO || "-",
        jatuhTempo: inv.jatuhTempo || inv.tanggal || new Date().toISOString().split("T")[0],
        totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
        paidAmount: Number.isFinite(paidAmount) ? paidAmount : 0,
        status: normalizeStatus(inv.status),
      } as VendorInvoice;
    });
  }, [vendorInvoiceList]);

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter(inv => 
      inv && (
        (inv.noInvoiceVendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.noPO || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [normalizedInvoices, searchTerm]);

  const fetchApSummary = async (silent = true) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<{ stats?: typeof serverStats }>('/dashboard/finance-ap-summary');
      if (data?.stats) setServerStats(data.stats as NonNullable<typeof serverStats>);
      if (!silent) toast.success('AP summary refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh AP summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchApSummary(true);
  }, []);

  const effectiveStats = serverStats || { totalPayable: 0, overdue: 0, paidThisMonth: 0, invoiceCount: 0, overdueCount: 0 };

  const handlePay = async () => {
    if (!selectedInvoice) return;

    const totalAmount = Number(selectedInvoice.totalAmount || 0);
    const paidAmount = Number(selectedInvoice.paidAmount || 0);
    const safePayment = Math.max(0, Number(paymentAmount || 0));
    const newPaidAmount = Math.min(totalAmount, paidAmount + safePayment);
    let newStatus: VendorInvoice['status'] = 'Partial';
    
    if (newPaidAmount >= totalAmount) {
      newStatus = 'Paid';
    }

    const ok = await updateVendorInvoice(selectedInvoice.id, {
      paidAmount: newPaidAmount,
      status: newStatus
    });
    if (!ok) return;

    toast.success(`Berhasil membayar Rp ${safePayment.toLocaleString('id-ID')} ke ${selectedInvoice.supplier}`);
    setShowPayModal(false);
    setSelectedInvoice(null);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const entry: VendorInvoice = {
      id: `VINV-${Math.random().toString(36).substr(2, 9)}`,
      ...newInvoice,
      paidAmount: 0,
      status: 'Unpaid',
    };

    const ok = await addVendorInvoice(entry);
    setIsSubmitting(false);
    if (!ok) return;

    setShowCreateModal(false);
    setNewInvoice({
      supplier: '',
      noInvoiceVendor: '',
      noPO: '',
      totalAmount: 0,
      jatuhTempo: new Date().toISOString().split('T')[0],
      projectId: '',
      purchaseOrderId: '',
      vendorId: '',
    });
    toast.success(`Invoice ${entry.noInvoiceVendor} berhasil dicatat`);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Unpaid': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Partial': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Overdue': return 'bg-red-50 text-red-700 border-red-200 animate-pulse';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const handleExportPayableReport = async () => {
    if (filteredInvoices.length === 0) {
      toast.info('Tidak ada data hutang untuk diekspor.');
      return;
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalPayable: Number(effectiveStats.totalPayable || 0),
        overdue: Number(effectiveStats.overdue || 0),
        paidThisMonth: Number(effectiveStats.paidThisMonth || 0),
        invoiceCount: Number(effectiveStats.invoiceCount || filteredInvoices.length),
        overdueCount: Number(effectiveStats.overdueCount || 0),
      },
      rows: filteredInvoices.map((inv) => ({
        supplier: inv.supplier,
        noInvoiceVendor: inv.noInvoiceVendor,
        noPO: inv.noPO,
        projectId: inv.projectId || '',
        jatuhTempo: inv.jatuhTempo,
        totalAmount: Number(inv.totalAmount || 0),
        paidAmount: Number(inv.paidAmount || 0),
        outstandingAmount: Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0),
        status: inv.status,
      })),
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance AP',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/payable-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/payable-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `payable-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `payable-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'AP_REPORT_EXPORTED',
        module: 'Finance',
        details: `Export AP report (${filteredInvoices.length} invoice)`,
        status: 'Success',
      });
      toast.success('Laporan hutang Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export laporan hutang gagal.');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    toast.success('Filter pencarian hutang di-reset.');
  };

  const handleQuickView = (inv: VendorInvoice) => {
    toast.info(`${inv.noInvoiceVendor} • ${inv.supplier} • ${formatIDR(inv.totalAmount - inv.paidAmount)}`);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-rose-200">Financial Ledger</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Accounts Payable</span>
           </div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Wallet className="text-rose-600" size={32} />
              Buku Hutang Vendor
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Manajemen Kewajiban & Arus Kas Keluar</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchApSummary(false)}
            disabled={summaryLoading}
            className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60"
          >
            {summaryLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={handleExportPayableReport} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
            <Download size={18} /> Laporan Hutang
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-black transition-all"
          >
            <Plus size={18} /> Catat Invoice Vendor
          </button>
        </div>
      </div>

      {/* Financial Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingDown size={80} className="text-rose-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Clock size={12} /> Total Hutang Berjalan
          </p>
          <h3 className="text-3xl font-black italic text-slate-900 tracking-tight">{formatIDR(effectiveStats.totalPayable)}</h3>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ArrowUpRight size={10} /> Liabilities
            </span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-red-100 shadow-sm relative overflow-hidden group bg-gradient-to-br from-white to-red-50/30"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <AlertCircle size={80} className="text-red-500" />
          </div>
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <AlertCircle size={12} /> Hutang Jatuh Tempo
          </p>
          <h3 className="text-3xl font-black italic text-red-600 tracking-tight">{formatIDR(effectiveStats.overdue)}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">Perlu segera diselesaikan</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={80} className="text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <CreditCard size={12} /> Terbayar Bulan Ini
          </p>
          <h3 className="text-3xl font-black italic text-slate-900 tracking-tight">{formatIDR(effectiveStats.paidThisMonth)}</h3>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase italic">
            Arus Kas Keluar Terkendali
          </div>
        </motion.div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari No. Invoice, Supplier, atau No. PO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>
          <div className="flex gap-4">
            <button onClick={handleResetFilters} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Filter size={20} /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor & Invoice</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref PO / Project</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jatuh Tempo</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Tagihan</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="group hover:bg-slate-50/30 transition-colors">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{inv.supplier}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                        <FileText size={10} /> {inv.noInvoiceVendor}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{inv.noPO}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[150px]">
                        Project ID: {inv.projectId || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-300" />
                      <span className="text-[11px] font-bold text-slate-700">{new Date(inv.jatuhTempo).toLocaleDateString('id-ID')}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 tracking-tight">{formatIDR(inv.totalAmount)}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Sisa: {formatIDR(inv.totalAmount - inv.paidAmount)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${getStatusStyle(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleQuickView(inv)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm">
                        <Eye size={16} />
                      </button>
                      {inv.status !== 'Paid' && (
                        <button 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setPaymentAmount(Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)));
                            setShowPayModal(true);
                          }}
                          className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
                        >
                          <CreditCard size={14} /> Bayar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayModal && selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Pembayaran Hutang</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedInvoice.supplier}</p>
                  </div>
                </div>
                <button onClick={() => setShowPayModal(false)} className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-100">
                  <X size={20} />
                </button>
              </div>

              <div className="p-10 space-y-6">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tagihan Tersisa</p>
                  <h4 className="text-2xl font-black text-slate-900 italic tracking-tight">
                    {formatIDR(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}
                  </h4>
                  <div className="mt-4 pt-4 border-t border-slate-200/50 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                    <span>Invoice Vendor:</span>
                    <span className="text-slate-900">{selectedInvoice.noInvoiceVendor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah Pembayaran (IDR)</label>
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black italic">Rp</div>
                    <input 
                      type="number" 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[1.5rem] text-xl font-black text-slate-900 border-none focus:ring-2 focus:ring-rose-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={() => setShowPayModal(false)}
                    className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handlePay}
                    className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all"
                  >
                    Konfirmasi Pembayaran
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleCreateInvoice}>
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-3">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Pencatatan Invoice Vendor</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Masukan detail tagihan dari pemasok</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="p-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-slate-100">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Supplier / Vendor</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Contoh: PT Krakatau Steel"
                        value={newInvoice.supplier}
                        onChange={(e) => setNewInvoice({...newInvoice, supplier: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Invoice Vendor</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Contoh: INV/VND/2026/001"
                        value={newInvoice.noInvoiceVendor}
                        onChange={(e) => setNewInvoice({...newInvoice, noInvoiceVendor: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Referensi Purchase Order (PO)</label>
                        <select
                          required
                          value={newInvoice.noPO}
                          onChange={(e) => {
                            const po = poList.find(p => p.noPO === e.target.value);
                            const linkedVendor = vendorList.find((vendor) => {
                              const vendorName = String(vendor.namaVendor || '').trim().toLowerCase();
                              const supplierName = String(po?.supplier || '').trim().toLowerCase();
                              return vendorName && supplierName && vendorName === supplierName;
                            });
                            setNewInvoice({
                              ...newInvoice,
                              noPO: e.target.value,
                              purchaseOrderId: po?.id || '',
                              projectId: po?.projectId || '',
                              supplier: po?.supplier || newInvoice.supplier,
                              vendorId: linkedVendor?.id || '',
                            });
                          }}
                          className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all appearance-none"
                        >
                        <option value="">Pilih PO Terkait</option>
                        {poList.map(po => (
                          <option key={po.id} value={po.noPO}>{po.noPO} - {po.supplier}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tautan Project</label>
                      <select 
                        required
                        value={newInvoice.projectId}
                        onChange={(e) => setNewInvoice({...newInvoice, projectId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all appearance-none"
                      >
                        <option value="">Pilih Project</option>
                        {projectList.map(p => (
                          <option key={p.id} value={p.id}>{p.kodeProject} - {p.namaProject}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Jatuh Tempo</label>
                      <div className="relative">
                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                          type="date" 
                          required
                          value={newInvoice.jatuhTempo}
                          onChange={(e) => setNewInvoice({...newInvoice, jatuhTempo: e.target.value})}
                          className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Nilai Tagihan (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black italic text-slate-400">Rp</span>
                        <input 
                          type="number" 
                          required
                          placeholder="0"
                          value={newInvoice.totalAmount}
                          onChange={(e) => setNewInvoice({...newInvoice, totalAmount: Number(e.target.value)})}
                          className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    ) : <Plus size={16} />}
                    Simpan Invoice
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
