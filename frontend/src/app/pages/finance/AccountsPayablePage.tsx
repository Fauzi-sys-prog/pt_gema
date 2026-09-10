import { useState, useMemo } from 'react';
import { useApp, type VendorInvoice } from '../../contexts/AppContext';
import { 
  Search, 
  Wallet, 
  Plus, 
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
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function AccountsPayablePage() {
  const { vendorInvoiceList = [], addVendorInvoice, updateVendorInvoice, payVendorInvoice, projectList = [], poList = [] } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');
  const [dueWindow, setDueWindow] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoice | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentForm, setPaymentForm] = useState({ metodeBayar: 'Transfer', noBukti: '', tanggalBayar: new Date().toISOString().split('T')[0], bank: 'BCA', noRekening: '', keterangan: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailInvoice, setDetailInvoice] = useState<VendorInvoice | null>(null);
  const [selectedPO, setSelectedPO] = useState<typeof poList[0] | null>(null);

  const approvedPOList = useMemo(() =>
    (poList || []).filter(po => po.status === 'Approved' || po.status === 'Received'),
  [poList]);

  const [newInvoice, setNewInvoice] = useState({
    supplier: '',
    noInvoiceVendor: '',
    noPO: '',
    totalAmount: 0,
    tanggal: new Date().toISOString().split('T')[0],
    jatuhTempo: new Date().toISOString().split('T')[0],
    projectId: '',
    ppn: 0,
    keterangan: '',
  });

  useEscapeKey([
    { condition: showPayModal, close: () => setShowPayModal(false) },
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
  ]);


  const filteredInvoices = useMemo(() => {
    return (vendorInvoiceList || [])
      .filter(inv =>
      inv && (
        (inv.noInvoiceVendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.noPO || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) &&
      (!filterMonth || new Date(inv.tanggal).getMonth() + 1 === Number(filterMonth)) &&
      (!filterYear || new Date(inv.tanggal).getFullYear() === Number(filterYear)) &&
      (!dueWindow || (() => {
        const due = new Date(inv.jatuhTempo || 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (dueWindow === 'overdue') return diffDays < 0;
        return diffDays >= 0 && diffDays <= Number(dueWindow);
      })())
      )
      .sort((a, b) => {
        const aDate = new Date(a.jatuhTempo || 0).getTime();
        const bDate = new Date(b.jatuhTempo || 0).getTime();
        return dateSort === 'newest' ? aDate - bDate : bDate - aDate;
      });
  }, [vendorInvoiceList, searchTerm, filterMonth, filterYear, dateSort, dueWindow]);

  const invoiceYears = useMemo(() => {
    return Array.from(new Set((vendorInvoiceList || [])
      .map(inv => new Date(inv.tanggal).getFullYear())
      .filter(year => Number.isFinite(year) && year > 1970)))
      .sort((a, b) => b - a);
  }, [vendorInvoiceList]);

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const stats = useMemo(() => {
    const list = vendorInvoiceList || [];
    const totalPayable = list.reduce((acc, inv) => acc + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    const overdue = list.filter(inv => inv.status === 'Overdue').reduce((acc, inv) => acc + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    const paidThisMonth = list.filter(inv => inv.status === 'Paid').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    
    return { totalPayable, overdue, paidThisMonth };
  }, [vendorInvoiceList]);

  const handlePay = async () => {
    if (!selectedInvoice || isSubmitting) return;
    const linkedPO = poList.find(po =>
      (selectedInvoice.purchaseOrderId && po.id === selectedInvoice.purchaseOrderId) ||
      (!selectedInvoice.purchaseOrderId && selectedInvoice.noPO && po.noPO === selectedInvoice.noPO)
    );
    if (linkedPO && linkedPO.status !== 'Received') {
      toast.error(`PO ${linkedPO.noPO} belum diterima`, {
        description: 'Pembayaran AP baru dapat diproses setelah Receiving Barang selesai.',
      });
      return;
    }
    if (paymentAmount <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0!');
      return;
    }
    const remaining = selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0);
    if (paymentAmount > remaining) {
      toast.error(`Nominal melebihi sisa hutang (Rp ${remaining.toLocaleString('id-ID')})!`);
      return;
    }
    if (!['Approved', 'Unpaid', 'Partial', 'Overdue'].includes(selectedInvoice.status)) {
      toast.error('Invoice belum boleh dibayar', { description: 'Selesaikan approval invoice vendor terlebih dahulu.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await payVendorInvoice(selectedInvoice.id, {
        tanggal: paymentForm.tanggalBayar,
        nominal: paymentAmount,
        metodeBayar: paymentForm.metodeBayar,
        noBukti: paymentForm.noBukti || undefined,
        bank: paymentForm.metodeBayar !== 'Cash' ? paymentForm.bank : undefined,
        noRekening: paymentForm.noRekening || undefined,
        keterangan: paymentForm.keterangan || undefined,
      });
      toast.success(`Berhasil membayar Rp ${paymentAmount.toLocaleString('id-ID')} ke ${selectedInvoice.supplier}`);
      setShowPayModal(false);
      setSelectedInvoice(null);
      setPaymentAmount(0);
      setPaymentForm({ metodeBayar: 'Transfer', noBukti: '', tanggalBayar: new Date().toISOString().split('T')[0], bank: 'BCA', noRekening: '', keterangan: '' });
    } catch (err) {
      toast.error('Gagal menyimpan pembayaran: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedInvoiceNumber = newInvoice.noInvoiceVendor.trim().toLowerCase();
    const normalizedSupplier = newInvoice.supplier.trim().toLowerCase();
    const isDuplicate = vendorInvoiceList.some(inv =>
      (inv.noInvoiceVendor || '').trim().toLowerCase() === normalizedInvoiceNumber &&
      (inv.supplier || '').trim().toLowerCase() === normalizedSupplier
    );
    if (isDuplicate) {
      toast.error('Invoice vendor sudah pernah dicatat!', {
        description: `${newInvoice.noInvoiceVendor} dari ${newInvoice.supplier}`,
      });
      return;
    }

    setIsSubmitting(true);
    
    setTimeout(() => {
      const entry: VendorInvoice = {
        id: `VINV-${Math.random().toString(36).substr(2, 9)}`,
        ...newInvoice,
        purchaseOrderId: selectedPO?.id,
        paidAmount: 0,
        outstandingAmount: newInvoice.totalAmount,
        status: 'Draft'
      };
      
      addVendorInvoice(entry);
      setShowCreateModal(false);
      setIsSubmitting(false);
      setNewInvoice({
        supplier: '',
        noInvoiceVendor: '',
        noPO: '',
        totalAmount: 0,
        tanggal: new Date().toISOString().split('T')[0],
        jatuhTempo: new Date().toISOString().split('T')[0],
        projectId: '',
        ppn: 0,
        keterangan: '',
      });
      setSelectedPO(null);
      toast.success(`Invoice ${entry.noInvoiceVendor} berhasil dicatat`);
    }, 1000);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Draft': return 'bg-slate-50 text-slate-500 border-slate-200';
      case 'Pending': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'Approved': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'Paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Unpaid': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Partial': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Overdue': return 'bg-red-50 text-red-700 border-red-200 animate-pulse';
      case 'Rejected': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
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
          <button className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
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
          <h3 className="text-3xl font-black italic text-slate-900 tracking-tight">{formatIDR(stats.totalPayable)}</h3>
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
          <h3 className="text-3xl font-black italic text-red-600 tracking-tight">{formatIDR(stats.overdue)}</h3>
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
          <h3 className="text-3xl font-black italic text-slate-900 tracking-tight">{formatIDR(stats.paidThisMonth)}</h3>
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
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} aria-label="Filter bulan invoice"
              className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-rose-500">
              <option value="">Semua Bulan</option>
              {monthNames.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} aria-label="Filter tahun invoice"
              className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-rose-500">
              <option value="">Semua Tahun</option>
              {invoiceYears.map(year => <option key={year} value={String(year)}>{year}</option>)}
            </select>
            <select value={dateSort} onChange={e => setDateSort(e.target.value as 'newest' | 'oldest')} aria-label="Urutkan tanggal invoice"
              className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-rose-500">
              <option value="newest">Jatuh tempo terdekat</option>
              <option value="oldest">Jatuh tempo terjauh</option>
            </select>
            <select value={dueWindow} onChange={e => setDueWindow(e.target.value)} aria-label="Filter rentang jatuh tempo"
              className="px-4 py-3 bg-rose-50 rounded-2xl border border-rose-100 text-xs font-bold text-rose-700 focus:ring-2 focus:ring-rose-500">
              <option value="">Semua Jatuh Tempo</option>
              <option value="7">Jatuh tempo ≤ 7 hari</option>
              <option value="14">Jatuh tempo ≤ 14 hari</option>
              <option value="30">Jatuh tempo ≤ 30 hari</option>
              <option value="overdue">Sudah lewat jatuh tempo</option>
            </select>
            {(filterMonth || filterYear || dueWindow) && <button onClick={() => { setFilterMonth(''); setFilterYear(''); setDueWindow(''); }} className="text-xs font-bold text-rose-600 hover:text-rose-800">Reset</button>}
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
                <tr key={inv.id} onClick={() => setDetailInvoice(inv)} className="group hover:bg-slate-50/30 transition-colors cursor-pointer">
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
                      <button onClick={e => { e.stopPropagation(); setDetailInvoice(inv); }} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm">
                        <Eye size={16} />
                      </button>
                      {(inv.status === 'Draft' || inv.status === 'Unpaid' || inv.status === 'Rejected') && (
                        <button
                          onClick={e => { e.stopPropagation(); updateVendorInvoice(inv.id, { status: 'Pending', sentAt: new Date().toISOString() }); }}
                          className="px-5 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2"
                          title="Kirim ke Approval Center"
                        >
                          <ArrowUpRight size={14} /> Kirim
                        </button>
                      )}
                      {inv.status === 'Pending' && (
                        <span className="px-5 py-3 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200">
                          Menunggu Approval
                        </span>
                      )}
                      {(inv.status === 'Approved' || inv.status === 'Partial') && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                            setPaymentAmount(inv.totalAmount - (inv.paidAmount || 0));
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

      {/* Detail Modal */}
      {detailInvoice && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDetailInvoice(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-8 py-6 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest mb-1">Buku Hutang · Detail Invoice</p>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tight leading-tight">{detailInvoice.supplier}</h3>
                <p className="text-sm text-rose-200 mt-1 font-mono">{detailInvoice.noInvoiceVendor}</p>
              </div>
              <button onClick={() => setDetailInvoice(null)} className="text-rose-200 hover:text-white mt-1 p-1"><X size={20} /></button>
            </div>
            {/* Body */}
            <div className="p-8 space-y-5">
              {/* Nominal */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tagihan</p>
                  <p className="text-2xl font-black text-rose-600 italic leading-none">{formatIDR(detailInvoice.totalAmount)}</p>
                  {(detailInvoice.ppn || 0) > 0 && <p className="text-[9px] text-slate-400 mt-1.5">Sudah termasuk PPN {detailInvoice.ppn}%</p>}
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Outstanding</p>
                  <p className="text-2xl font-black text-slate-900 italic leading-none">{formatIDR(detailInvoice.totalAmount - (detailInvoice.paidAmount || 0))}</p>
                  <p className="text-[9px] text-slate-400 mt-1.5">Dibayar: {formatIDR(detailInvoice.paidAmount || 0)}</p>
                </div>
              </div>
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: 'No. PO', value: detailInvoice.noPO || '-' },
                  { label: 'Tanggal Invoice', value: detailInvoice.tanggal || '-' },
                  { label: 'Jatuh Tempo', value: detailInvoice.jatuhTempo },
                  { label: 'Project ID', value: detailInvoice.projectId || '-' },
                  { label: 'Status', value: detailInvoice.status },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-slate-700">{value}</p>
                  </div>
                ))}
                {detailInvoice.approvedBy && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Disetujui Oleh</p>
                    <p className="text-sm font-bold text-emerald-600">{detailInvoice.approvedBy}</p>
                  </div>
                )}
                {detailInvoice.rejectedReason && (
                  <div className="col-span-2">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Alasan Penolakan</p>
                    <p className="text-sm font-bold text-rose-600 italic">"{detailInvoice.rejectedReason}"</p>
                  </div>
                )}
              </div>
              {/* Approval History */}
              {(detailInvoice.approvalHistory || []).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Riwayat Approval</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {detailInvoice.approvalHistory!.map((h, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-xs ${h.action === 'Approved' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <span className={`mt-0.5 font-black uppercase text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap ${h.action === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{h.action}</span>
                        <div>
                          <p className="font-bold text-slate-700">{h.by}</p>
                          <p className="text-slate-400">{new Date(h.date).toLocaleString('id-ID')}</p>
                          {h.reason && <p className="text-slate-500 mt-0.5 italic">"{h.reason}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                {(detailInvoice.status === 'Approved' || detailInvoice.status === 'Partial') && (
                  <button
                    onClick={() => { setSelectedInvoice(detailInvoice); setPaymentAmount(detailInvoice.totalAmount - (detailInvoice.paidAmount || 0)); setShowPayModal(true); setDetailInvoice(null); }}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                  ><CreditCard size={14} /> Bayar Sekarang</button>
                )}
                {(detailInvoice.status === 'Draft' || detailInvoice.status === 'Unpaid' || detailInvoice.status === 'Rejected') && (
                  <button
                    onClick={() => { updateVendorInvoice(detailInvoice.id, { status: 'Pending', sentAt: new Date().toISOString() }); setDetailInvoice(null); toast.success('Invoice dikirim ke Approval Center'); }}
                    className="flex-1 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                  ><ArrowUpRight size={14} /> Kirim ke Approval</button>
                )}
                <button onClick={() => setDetailInvoice(null)} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Tutup</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
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

              <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Detail tagihan */}
                <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
                  <div className="px-5 py-3 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Invoice</span>
                    <span className="text-xs font-black text-slate-800 font-mono">{selectedInvoice.noInvoiceVendor}</span>
                  </div>
                  {selectedInvoice.noPO && (
                    <div className="px-5 py-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. PO</span>
                      <span className="text-xs font-bold text-blue-600">{selectedInvoice.noPO}</span>
                    </div>
                  )}
                  {selectedInvoice.keterangan && (
                    <div className="px-5 py-3 flex justify-between items-start gap-4">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Keterangan</span>
                      <span className="text-xs font-bold text-slate-700 text-right">{selectedInvoice.keterangan}</span>
                    </div>
                  )}
                  <div className="px-5 py-3 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jatuh Tempo</span>
                    <span className="text-xs font-bold text-slate-700">{selectedInvoice.jatuhTempo}</span>
                  </div>
                  <div className="px-5 py-3 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</span>
                    <span className="text-xs font-black text-slate-900">{formatIDR(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="px-5 py-3 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sudah Dibayar</span>
                    <span className="text-xs font-bold text-emerald-600">{formatIDR(selectedInvoice.paidAmount || 0)}</span>
                  </div>
                  <div className="px-5 py-4 flex justify-between items-center bg-rose-50/50 rounded-b-2xl">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Sisa Tagihan</span>
                    <span className="text-lg font-black text-rose-600 italic">{formatIDR(selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0))}</span>
                  </div>
                </div>

                {/* Jumlah bayar */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah Pembayaran (IDR)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black italic">Rp</span>
                    <input
                      type="number"
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full pl-16 pr-8 py-4 bg-slate-50 rounded-2xl text-xl font-black text-slate-900 border-2 border-slate-100 focus:border-rose-400 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Metode & detail bayar */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Metode Bayar</label>
                    <select
                      value={paymentForm.metodeBayar}
                      onChange={e => setPaymentForm({ ...paymentForm, metodeBayar: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all appearance-none"
                    >
                      <option>Transfer</option>
                      <option>Cash</option>
                      <option>Cek/Giro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Bayar</label>
                    <input
                      type="date"
                      value={paymentForm.tanggalBayar}
                      onChange={e => setPaymentForm({ ...paymentForm, tanggalBayar: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all"
                    />
                  </div>
                </div>

                {paymentForm.metodeBayar !== 'Cash' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Pengirim</label>
                      <select
                        value={['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN'].includes(paymentForm.bank) || paymentForm.bank === '' ? paymentForm.bank : 'Lainnya'}
                        onChange={e => setPaymentForm({ ...paymentForm, bank: e.target.value === 'Lainnya' ? '' : e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all appearance-none"
                      >
                        <option value="">— Pilih Bank —</option>
                        {['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN','Lainnya'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {!['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN',''].includes(paymentForm.bank) && (
                        <input
                          autoFocus
                          type="text"
                          value={paymentForm.bank}
                          onChange={e => setPaymentForm({ ...paymentForm, bank: e.target.value })}
                          placeholder="Nama bank..."
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-rose-200 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all mt-1.5"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Rekening <span className="text-slate-300 font-bold normal-case">(opsional)</span></label>
                      <input
                        type="text"
                        placeholder="Contoh: 1234567890"
                        value={paymentForm.noRekening}
                        onChange={e => setPaymentForm({ ...paymentForm, noRekening: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Bukti / Referensi Transfer <span className="text-slate-300 font-bold normal-case">(opsional)</span></label>
                  <input
                    type="text"
                    placeholder="Contoh: TRF/BCA/20260812/001"
                    value={paymentForm.noBukti}
                    onChange={e => setPaymentForm({ ...paymentForm, noBukti: e.target.value })}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Catatan <span className="text-slate-300 font-bold normal-case">(opsional)</span></label>
                  <textarea
                    rows={2}
                    placeholder="Catatan pembayaran ini..."
                    value={paymentForm.keterangan}
                    onChange={e => setPaymentForm({ ...paymentForm, keterangan: e.target.value })}
                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button onClick={() => setShowPayModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Batal
                  </button>
                  <button onClick={handlePay} disabled={isSubmitting} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      {/* Create Invoice Modal */}
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
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Referensi PO <span className="text-slate-300 normal-case font-bold">(opsional)</span>
                      </label>
                      <select
                        value={newInvoice.noPO}
                        onChange={(e) => {
                          const po = approvedPOList.find(p => p.noPO === e.target.value);
                          setSelectedPO(po || null);
                          setNewInvoice({
                            ...newInvoice,
                            noPO: e.target.value,
                            supplier: po?.supplier || newInvoice.supplier,
                            projectId: po?.projectId || newInvoice.projectId,
                            totalAmount: po?.total || newInvoice.totalAmount,
                          });
                        }}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all appearance-none"
                      >
                        <option value="">Pilih PO (opsional)</option>
                        {approvedPOList.map(po => (
                          <option key={po.id} value={po.noPO}>{po.supplier} ({po.noPO})</option>
                        ))}
                      </select>
                      {approvedPOList.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic ml-1">Belum ada PO Approved/Received</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tautan Project <span className="text-slate-300 normal-case font-bold">(opsional)</span></label>
                      <select
                        value={newInvoice.projectId}
                        onChange={(e) => setNewInvoice({...newInvoice, projectId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all appearance-none"
                      >
                        <option value="">— Tanpa Project —</option>
                        {projectList.map(p => (
                          <option key={p.id} value={p.id}>{p.kodeProject} — {p.namaProject}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Invoice</label>
                      <div className="relative">
                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                          type="date"
                          required
                          value={newInvoice.tanggal}
                          onChange={(e) => setNewInvoice({...newInvoice, tanggal: e.target.value})}
                          className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all"
                        />
                      </div>
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Nilai Tagihan (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black italic text-slate-400">Rp</span>
                        <input
                          type="number"
                          required
                          min={1}
                          placeholder="0"
                          value={newInvoice.totalAmount || ''}
                          onChange={(e) => setNewInvoice({...newInvoice, totalAmount: Number(e.target.value)})}
                          className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PPN (%) <span className="text-slate-300 normal-case font-bold">(opsional)</span></label>
                      <select
                        value={newInvoice.ppn}
                        onChange={(e) => setNewInvoice({...newInvoice, ppn: Number(e.target.value)})}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all appearance-none"
                      >
                        <option value={0}>Tidak ada PPN</option>
                        <option value={11}>PPN 11%</option>
                        <option value={12}>PPN 12%</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan / Deskripsi Tagihan <span className="text-slate-300 normal-case font-bold">(opsional)</span></label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Pembelian material pipa galvanis untuk proyek Hydrant Area B"
                      value={newInvoice.keterangan}
                      onChange={(e) => setNewInvoice({...newInvoice, keterangan: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-500 transition-all resize-none"
                    />
                  </div>

                  {/* PO Items Preview */}
                  {selectedPO && (selectedPO.items || []).length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                        Item Barang dari PO {selectedPO.noPO} <span className="text-slate-300 normal-case font-bold">(referensi)</span>
                      </label>
                      <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl overflow-hidden">
                        <div className="grid grid-cols-[1fr_80px_80px_100px] px-4 py-2 bg-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Nama Barang</span>
                          <span className="text-right">Qty</span>
                          <span className="text-right">Satuan</span>
                          <span className="text-right">Harga</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                          {selectedPO.items.map((item: any, i: number) => (
                            <div key={i} className="grid grid-cols-[1fr_80px_80px_100px] px-4 py-3">
                              <span className="text-xs font-bold text-slate-800 truncate pr-2">
                                {item.deskripsi || item.materialName || item.namaItem || item.description || '-'}
                              </span>
                              <span className="text-xs font-bold text-slate-500 text-right">
                                {item.qty || item.qtyEstimate || item.jumlah || '-'}
                              </span>
                              <span className="text-xs font-bold text-slate-500 text-right">
                                {item.satuan || item.unit || '-'}
                              </span>
                              <span className="text-xs font-bold text-slate-700 text-right">
                                {(item.hargaSatuan || item.unitPrice || item.hargaUnit)
                                  ? `Rp ${(item.hargaSatuan || item.unitPrice || item.hargaUnit).toLocaleString('id-ID')}`
                                  : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 bg-slate-100 flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total PO</span>
                          <span className="text-sm font-black text-rose-600">Rp {selectedPO.total.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  )}
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
    </div>
  );
}
