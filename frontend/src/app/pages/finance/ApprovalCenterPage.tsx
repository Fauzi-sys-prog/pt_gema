import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Info,
  TrendingDown
} from 'lucide-react';
import { useApp, type PurchaseOrder, type Quotation, type Invoice, type CustomerInvoice, type VendorInvoice, type VendorExpense } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { api } from '../../services/api';

export default function ApprovalCenterPage() {
  const {
    poList,
    updatePO,
    quotationList,
    updateQuotation,
    invoiceList,
    updateInvoice,
    customerInvoiceList,
    updateCustomerInvoice,
    vendorInvoiceList = [],
    updateVendorInvoice,
    expenseList,
    approveExpense,
    rejectExpense,
    stockItemList,
    addAuditLog
  } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'po' | 'ap' | 'invoice' | 'expense'>('po');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PurchaseOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);


  // Customer Invoice action modal
  const [invActionTarget, setInvActionTarget] = useState<CustomerInvoice | null>(null);
  const [invActionType, setInvActionType] = useState<'Rejected' | 'Revision' | null>(null);
  const [invActionReason, setInvActionReason] = useState('');

  // Expense action modal
  const [expRejectTarget, setExpRejectTarget] = useState<VendorExpense | null>(null);
  const [expRejectReason, setExpRejectReason] = useState('');

  // AP (Vendor Invoice) action modal
  const [apActionTarget, setApActionTarget] = useState<VendorInvoice | null>(null);
  const [apActionType, setApActionType] = useState<'approve' | 'reject' | null>(null);
  const [apActionReason, setApActionReason] = useState('');
  const [apDetailTarget, setApDetailTarget] = useState<VendorInvoice | null>(null);

  // 1. Filter Pending POs
  const pendingPOs = useMemo(() => {
    return poList.filter(po =>
      po.status === 'Sent' &&
      ((po.noPO || '').toLowerCase().includes(searchTerm.toLowerCase()) || (po.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [poList, searchTerm]);

  // 2. Filter Pending Quotations
  const pendingQuotations = useMemo(() => {
    return quotationList.filter(q => 
      q.status === 'Draft' && 
      ((q.nomorQuotation || '').toLowerCase().includes(searchTerm.toLowerCase()) || (q.customer?.nama || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [quotationList, searchTerm]);

  // 3. Filter Unpaid Invoices (vendor + customer)
  const pendingInvoices = useMemo(() => {
    return invoiceList.filter(inv =>
      inv.status === 'Unpaid' &&
      ((inv.noInvoice || '').toLowerCase().includes(searchTerm.toLowerCase()) || (inv.customer || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [invoiceList, searchTerm]);

  const pendingCustomerInvoices = useMemo(() => {
    return customerInvoiceList.filter(inv =>
      (inv.status === 'Pending' || inv.status === 'Draft') &&
      ((inv.noInvoice || '').toLowerCase().includes(searchTerm.toLowerCase()) || (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customerInvoiceList, searchTerm]);

  // 4. Filter Pending Vendor Invoices (AP)
  const pendingVendorInvoices = useMemo(() => {
    return vendorInvoiceList.filter(vi =>
      vi.status === 'Pending' &&
      ((vi.noInvoiceVendor || '').toLowerCase().includes(searchTerm.toLowerCase()) || (vi.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [vendorInvoiceList, searchTerm]);

  // 5. Filter Pending Expenses (Tambahan Biaya Proyek)
  const pendingExpenses = useMemo(() => {
    return (expenseList || []).filter(e =>
      e.status === 'Pending Approval' &&
      ((e.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (e.keterangan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (e.noExpense || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [expenseList, searchTerm]);

  // Handlers
  const processPO = async (po: PurchaseOrder, action: 'APPROVE' | 'REJECT', reason = '') => {
    if (action === 'REJECT' && reason.trim().length < 5) {
      toast.error('Alasan penolakan minimal 5 karakter.');
      return;
    }
    setProcessingId(po.id);
    try {
      await api.request('/dashboard/finance-approval-action', {
        method: 'POST',
        body: JSON.stringify({ documentType: 'PO', documentId: po.id, action, reason: reason.trim() }),
      });
      toast.success(action === 'APPROVE' ? `PO ${po.noPO} disetujui.` : `PO ${po.noPO} ditolak.`);
      setRejectTarget(null);
      setRejectReason('');
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval PO gagal diproses.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveQuotation = async (q: Quotation) => {
    setProcessingId(q.id);
    try {
      const oldStatus = q.status;
      updateQuotation(q.id, { ...q, status: 'Approved' });
      try {
        addAuditLog({
          action: 'QUO_APPROVED',
          module: 'Sales',
          details: `Quotation ${q.nomorQuotation} disetujui secara teknis oleh ${currentUser?.fullName}`,
          status: 'Success'
        });
      } catch (auditErr) {
        updateQuotation(q.id, { ...q, status: oldStatus });
        throw auditErr;
      }
      toast.success(`Dokumen ${q.nomorQuotation} telah disetujui teknis.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui quotation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleVerifyInvoice = async (inv: Invoice) => {
    setProcessingId(inv.id);
    try {
      const oldStatus = inv.status;
      const oldTanggalBayar = inv.tanggalBayar;
      updateInvoice(inv.id, { ...inv, status: 'Paid', tanggalBayar: new Date().toISOString().split('T')[0] });
      try {
        addAuditLog({
          action: 'INV_VERIFIED',
          module: 'Finance',
          details: `Pembayaran Invoice ${inv.noInvoice} diverifikasi oleh ${currentUser?.fullName}`,
          status: 'Success'
        });
      } catch (auditErr) {
        updateInvoice(inv.id, { ...inv, status: oldStatus, tanggalBayar: oldTanggalBayar });
        throw auditErr;
      }
      toast.success(`Invoice ${inv.noInvoice} telah diverifikasi lunas.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal verifikasi invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const canApproveInvoice = ['Admin', 'Owner', 'SPV', 'Manager', 'Finance & Accounting', 'Sales & Marketing', 'Operasional & Produksi', 'HR', 'HSE']
    .includes(currentUser?.role || '');

  const handleApproveCustomerInvoice = async (inv: CustomerInvoice) => {
    if (!canApproveInvoice) {
      toast.error('Hanya Admin atau Owner yang dapat menyetujui invoice.');
      return;
    }
    setProcessingId(inv.id);
    try {
      const oldStatus = inv.status;
      const oldApprovedAt = inv.approvedAt;
      const oldApprovedBy = inv.approvedBy;
      const oldApprovalHistory = inv.approvalHistory;
      const historyEntry = { action: 'Approved' as const, by: currentUser?.fullName || 'Approver', date: new Date().toISOString() };
      updateCustomerInvoice(inv.id, {
        status: 'Approved',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.fullName,
        approvalHistory: [...(inv.approvalHistory || []), historyEntry],
      });
      try {
        addAuditLog({ action: 'CUSTOMER_INV_APPROVED', module: 'Finance', details: `Invoice ${inv.noInvoice} disetujui oleh ${currentUser?.fullName}`, status: 'Success' });
      } catch (auditErr) {
        updateCustomerInvoice(inv.id, {
          status: oldStatus,
          approvedAt: oldApprovedAt,
          approvedBy: oldApprovedBy,
          approvalHistory: oldApprovalHistory,
        });
        throw auditErr;
      }
      toast.success(`Invoice ${inv.noInvoice} disetujui oleh ${currentUser?.fullName}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmitInvAction = () => {
    if (!invActionTarget || !invActionType) return;
    if (!invActionReason.trim()) { toast.error('Alasan wajib diisi'); return; }
    const historyEntry = { action: invActionType, by: currentUser?.fullName || 'Approver', date: new Date().toISOString(), reason: invActionReason.trim() };
    updateCustomerInvoice(invActionTarget.id, {
      status: invActionType === 'Rejected' ? 'Rejected' : 'Revision',
      approvalHistory: [...(invActionTarget.approvalHistory || []), historyEntry],
    });
    toast.error(invActionType === 'Rejected' ? `Invoice ${invActionTarget.noInvoice} ditolak.` : `Invoice ${invActionTarget.noInvoice} diminta revisi.`);
    setInvActionTarget(null); setInvActionType(null); setInvActionReason('');
  };

  const totalInvoicePending = pendingInvoices.length + pendingCustomerInvoices.length;

  const handleApproveVendorInvoice = async (vi: VendorInvoice) => {
    if (!canApproveInvoice) { toast.error('Hanya Admin atau Owner yang dapat menyetujui hutang.'); return; }
    const linkedPO = poList.find(po =>
      (vi.purchaseOrderId && po.id === vi.purchaseOrderId) ||
      (!vi.purchaseOrderId && vi.noPO && po.noPO === vi.noPO)
    );
    if (linkedPO && linkedPO.status !== 'Received') {
      toast.error(`PO ${linkedPO.noPO} belum diterima`, {
        description: 'Selesaikan Receiving Barang sebelum invoice vendor disetujui.',
      });
      return;
    }
    setProcessingId(vi.id);
    try {
      const oldStatus = vi.status;
      const oldApprovedBy = vi.approvedBy;
      const oldApprovedAt = vi.approvedAt;
      const oldApprovalHistory = vi.approvalHistory;
      const entry = { action: 'Approved' as const, by: currentUser?.fullName || 'Approver', date: new Date().toISOString() };
      updateVendorInvoice(vi.id, {
        status: 'Approved',
        approvedBy: currentUser?.fullName,
        approvedAt: new Date().toISOString(),
        approvalHistory: [...(vi.approvalHistory || []), entry],
      });
      try {
        addAuditLog({ action: 'AP_APPROVED', module: 'Finance', details: `Hutang vendor ${vi.noInvoiceVendor} (${vi.supplier}) disetujui oleh ${currentUser?.fullName}`, status: 'Success' });
      } catch (auditErr) {
        updateVendorInvoice(vi.id, {
          status: oldStatus,
          approvedBy: oldApprovedBy,
          approvedAt: oldApprovedAt,
          approvalHistory: oldApprovalHistory,
        });
        throw auditErr;
      }
      toast.success(`Hutang ${vi.noInvoiceVendor} disetujui — siap dibayar.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui hutang vendor');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmitApAction = () => {
    if (!apActionTarget || !apActionReason.trim()) { toast.error('Alasan wajib diisi'); return; }
    const entry = { action: 'Rejected' as const, by: currentUser?.fullName || 'Approver', date: new Date().toISOString(), reason: apActionReason.trim() };
    updateVendorInvoice(apActionTarget.id, {
      status: 'Rejected',
      rejectedBy: currentUser?.fullName,
      rejectedReason: apActionReason.trim(),
      approvalHistory: [...(apActionTarget.approvalHistory || []), entry],
    });
    toast.error(`Hutang ${apActionTarget.noInvoiceVendor} ditolak.`);
    setApActionTarget(null); setApActionType(null); setApActionReason('');
  };

  const handleApproveExpense = async (exp: VendorExpense) => {
    setProcessingId(exp.id);
    try {
      approveExpense(exp.id, currentUser?.fullName || 'Approver');
      try {
        addAuditLog({ action: 'EXPENSE_APPROVED', module: 'Finance', details: `Expense ${exp.noExpense} (${exp.vendorName}) disetujui oleh ${currentUser?.fullName}`, status: 'Success' });
      } catch (auditErr) {
        throw auditErr;
      }
      toast.success(`Expense ${exp.noExpense} disetujui.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui expense');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectExpense = async () => {
    if (!expRejectTarget) return;
    if (!expRejectReason.trim()) { toast.error('Alasan wajib diisi'); return; }
    setProcessingId(expRejectTarget.id);
    try {
      rejectExpense(expRejectTarget.id, expRejectReason.trim());
      try {
        addAuditLog({ action: 'EXPENSE_REJECTED', module: 'Finance', details: `Expense ${expRejectTarget.noExpense} ditolak oleh ${currentUser?.fullName}: ${expRejectReason.trim()}`, status: 'Warning' });
      } catch (auditErr) {
        throw auditErr;
      }
      toast.error(`Expense ${expRejectTarget.noExpense} ditolak.`);
      setExpRejectTarget(null); setExpRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menolak expense');
    } finally {
      setProcessingId(null);
    }
  };

  const stats = {
    total: pendingPOs.length + totalInvoicePending + pendingVendorInvoices.length + pendingExpenses.length,
    highValue: pendingPOs.filter(p => p.total > 10000000).length
  };

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-slate-900 rounded-full -mr-40 -mt-40 opacity-[0.02]" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Approval Command Center</h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase tracking-widest border border-emerald-200">System Secure</span>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] italic">PT GTP Fiscal & Operational Control</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Pending Tasks</p>
              <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter">{stats.total} <span className="text-sm font-bold not-italic text-slate-300 uppercase ml-1">Docs</span></h3>
           </div>
           {stats.highValue > 0 && (
             <div className="px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="text-amber-500" size={18} />
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest italic">{stats.highValue} High-Value POs</span>
             </div>
           )}
        </div>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {([
          { type: 'po',        label: 'Purchase Orders',      icon: <DollarSign />,   color: 'indigo',  count: pendingPOs.length,            path: '/purchasing/purchase-order' },
          { type: 'invoice',   label: 'Invoices AR',          icon: <UserCheck />,    color: 'emerald', count: totalInvoicePending,           path: '/finance/accounts-receivable' },
          { type: 'ap',        label: 'AP Hutang',            icon: <TrendingDown />, color: 'rose',    count: pendingVendorInvoices.length,  path: '/finance/accounts-payable' },
          { type: 'expense',   label: 'Tambahan Biaya Proyek',icon: <FileText />,     color: 'amber',   count: pendingExpenses.length,        path: '/finance/tambahan-biaya-proyek' },
        ] as const).map(({ type, label, icon, color, count, path }) => (
          <motion.div
            key={type}
            whileHover={{ y: -5 }}
            onClick={() => setActiveTab(type)}
            className={`p-8 rounded-[2.5rem] border bg-white shadow-sm cursor-pointer transition-all ${activeTab === type ? `border-${color}-500 ring-4 ring-${color}-50` : 'border-slate-100'}`}
          >
            <div className="flex items-start justify-between mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === type ? `bg-${color}-500 text-white` : `bg-${color}-50 text-${color}-500`}`}>
                {icon}
              </div>
              <button
                onClick={e => { e.stopPropagation(); navigate(path); }}
                className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
              >
                Lihat Semua <ChevronRight size={12} />
              </button>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
            <h4 className="text-2xl font-black italic text-slate-900 leading-none">{count} Pending</h4>
          </motion.div>
        ))}
      </div>

      {/* Main Approval Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Cari Dokumen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Details</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value Impact</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit Status</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* PO Tab */}
                  {activeTab === 'po' && pendingPOs.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{po.noPO}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Vendor: {po.supplier}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-slate-900 italic">Rp {po.total.toLocaleString('id-ID')}</span>
                          {po.total > 10000000 && <div className="text-[8px] font-black text-amber-600 uppercase mt-1 italic tracking-widest">High Value Threshold</div>}
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${po.total > 10000000 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                             {po.total > 10000000 ? 'Director Review' : 'Manager Approval'}
                          </span>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                             <button disabled={processingId === po.id} onClick={() => processPO(po, 'APPROVE')} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50"><ThumbsUp size={18} /></button>
                             <button disabled={processingId === po.id} onClick={() => { setRejectTarget(po); setRejectReason(''); }} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50" title="Tolak PO"><ThumbsDown size={18} /></button>
                             <button onClick={() => navigate('/purchasing/purchase-order')} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all" title="Buka halaman PO"><ChevronRight size={18} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}


                  {/* Invoice Tab */}
                  {activeTab === 'invoice' && pendingInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{inv.noInvoice}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Buyer: {inv.customer}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-emerald-600 italic">Rp {inv.totalBayar.toLocaleString('id-ID')}</span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-emerald-50 text-emerald-600 border-emerald-100">
                             Payment Verification
                          </span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleVerifyInvoice(inv)} disabled={processingId === inv.id} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50">
                               <UserCheck size={16} /> Mark as Paid
                            </button>
                            <button onClick={() => navigate('/finance/accounts-receivable')} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all" title="Buka AR Page"><ChevronRight size={18} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}

                  {/* Customer Invoice rows */}
                  {activeTab === 'invoice' && pendingCustomerInvoices.map(inv => (
                    <tr key={`cinv-${inv.id}`} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{inv.noInvoice}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Customer: {inv.customerName}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-emerald-600 italic">Rp {(inv.totalNominal || 0).toLocaleString('id-ID')}</span>
                          <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{inv.status}</div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-blue-50 text-blue-600 border-blue-100">
                               Customer Invoice
                            </span>
                            <span className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase ${inv.status === 'Draft' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                              {inv.status === 'Draft' ? 'Draft — belum dikirim' : 'Menunggu Approval'}
                            </span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleApproveCustomerInvoice(inv)}
                              disabled={processingId === inv.id}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${canApproveInvoice ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} disabled:opacity-50`}
                              title={canApproveInvoice ? 'Setujui Invoice' : 'Hanya Admin / Owner'}
                            ><ThumbsUp size={18} /></button>
                            <button onClick={() => { setInvActionTarget(inv); setInvActionType('Revision'); setInvActionReason(''); }} className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all" title="Minta Revisi"><RotateCcw size={16} /></button>
                            <button onClick={() => { setInvActionTarget(inv); setInvActionType('Rejected'); setInvActionReason(''); }} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all" title="Tolak"><ThumbsDown size={18} /></button>
                            <button onClick={() => navigate('/finance/accounts-receivable')} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all" title="Buka AR Page"><ChevronRight size={18} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}

                  {/* AP Hutang rows */}
                  {activeTab === 'ap' && pendingVendorInvoices.map(vi => (
                    <tr key={`vi-${vi.id}`} onClick={() => setApDetailTarget(vi)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{vi.noInvoiceVendor}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Supplier: {vi.supplier}</span>
                             {vi.noPO && <span className="text-[9px] text-slate-400 mt-0.5">PO: {vi.noPO}</span>}
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-rose-600 italic">Rp {(vi.totalAmount || 0).toLocaleString('id-ID')}</span>
                          <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Jatuh Tempo: {vi.jatuhTempo}</div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-amber-50 text-amber-600 border-amber-100">
                            Menunggu Approval
                          </span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); handleApproveVendorInvoice(vi); }}
                              disabled={processingId === vi.id}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${canApproveInvoice ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} disabled:opacity-50`}
                              title={canApproveInvoice ? 'Setujui Hutang' : 'Hanya Admin / Owner'}
                            ><ThumbsUp size={18} /></button>
                            <button onClick={e => { e.stopPropagation(); setApActionTarget(vi); setApActionType('Rejected'); setApActionReason(''); }} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all" title="Tolak"><ThumbsDown size={18} /></button>
                            <button onClick={e => { e.stopPropagation(); navigate('/finance/accounts-payable'); }} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all" title="Buka AP Page"><ChevronRight size={18} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}

                  {/* Tambahan Biaya Proyek rows */}
                  {activeTab === 'expense' && pendingExpenses.map(exp => (
                    <tr key={`exp-${exp.id}`} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{exp.noExpense}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Vendor: {exp.vendorName}</span>
                          {exp.projectName && <span className="text-[9px] text-slate-400 mt-0.5">Project: {exp.projectName}</span>}
                          <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-xs">{exp.keterangan}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <span className="text-sm font-black text-amber-700 italic">Rp {exp.totalNominal.toLocaleString('id-ID')}</span>
                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{exp.kategori} · {exp.tanggal}</div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border bg-amber-50 text-amber-600 border-amber-100">
                          Menunggu Approval
                        </span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApproveExpense(exp)}
                            disabled={processingId === exp.id}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${canApproveInvoice ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} disabled:opacity-50`}
                            title={canApproveInvoice ? 'Setujui Expense' : 'Hanya Admin / Owner'}
                          ><ThumbsUp size={18} /></button>
                          <button
                            onClick={() => { setExpRejectTarget(exp); setExpRejectReason(''); }}
                            className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"
                            title="Tolak"
                          ><ThumbsDown size={18} /></button>
                          <button onClick={() => navigate('/finance/tambahan-biaya-proyek')} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all" title="Buka Tambahan Biaya Proyek"><ChevronRight size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {countActiveTab() === 0 && (
                    <tr>
                       <td colSpan={4} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center opacity-20">
                             <ShieldCheck size={80} className="mb-4 text-slate-300" />
                             <p className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Antrean Bersih</p>
                             <p className="text-xs font-bold uppercase text-slate-400 mt-2">Semua dokumen telah diproses untuk kategori ini</p>
                          </div>
                       </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
        </div>
      </div>


      {/* Modal Tolak PO */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">Tolak Purchase Order</h3>
            <p className="text-xs text-slate-500 mb-4">PO: <span className="font-bold text-slate-700">{rejectTarget.noPO}</span></p>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Alasan Penolakan <span className="text-rose-500">*</span></label>
            <textarea autoFocus rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Minimal 5 karakter..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl">Batal</button>
              <button disabled={processingId === rejectTarget.id} onClick={() => processPO(rejectTarget, 'REJECT', rejectReason)} className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-rose-600 disabled:opacity-50">Tolak PO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Reject / Revision Invoice */}
      {invActionTarget && invActionType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">
              {invActionType === 'Rejected' ? 'Tolak Invoice' : 'Minta Revisi'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Invoice: <span className="font-bold text-slate-700">{invActionTarget.noInvoice}</span></p>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Alasan <span className="text-rose-500">*</span></label>
            <textarea
              autoFocus
              rows={3}
              value={invActionReason}
              onChange={e => setInvActionReason(e.target.value)}
              placeholder={invActionType === 'Rejected' ? 'Tuliskan alasan penolakan...' : 'Tuliskan hal yang perlu direvisi...'}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setInvActionTarget(null); setInvActionType(null); setInvActionReason(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button
                onClick={handleSubmitInvAction}
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl ${invActionType === 'Rejected' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {invActionType === 'Rejected' ? 'Tolak Invoice' : 'Kirim Permintaan Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail AP Hutang */}
      {apDetailTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setApDetailTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-rose-600 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-1">AP Hutang · Detail Invoice</p>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{apDetailTarget.noInvoiceVendor}</h3>
                <p className="text-sm text-rose-200 mt-0.5">{apDetailTarget.supplier}</p>
              </div>
              <button onClick={() => setApDetailTarget(null)} className="text-rose-200 hover:text-white mt-1"><XCircle size={20} /></button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tagihan</p>
                  <p className="text-xl font-black text-rose-600 italic">Rp {(apDetailTarget.totalAmount || 0).toLocaleString('id-ID')}</p>
                  {(apDetailTarget.ppn || 0) > 0 && <p className="text-[9px] text-slate-400 mt-1">Sudah termasuk PPN {apDetailTarget.ppn}%</p>}
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jatuh Tempo</p>
                  <p className="text-base font-black text-slate-900">{apDetailTarget.jatuhTempo}</p>
                  <p className="text-[9px] text-slate-400 mt-1">Tanggal: {apDetailTarget.tanggal || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">No. PO</p>
                  <p className="font-bold text-slate-700">{apDetailTarget.noPO || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-100">
                    {apDetailTarget.status}
                  </span>
                </div>
                {apDetailTarget.projectId && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Project ID</p>
                    <p className="font-bold text-slate-700">{apDetailTarget.projectId}</p>
                  </div>
                )}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sudah Dibayar</p>
                  <p className="font-bold text-slate-700">Rp {(apDetailTarget.paidAmount || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
              {/* Approval History */}
              {(apDetailTarget.approvalHistory || []).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Riwayat Approval</p>
                  <div className="space-y-2">
                    {apDetailTarget.approvalHistory!.map((h, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-xs ${h.action === 'Approved' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <span className={`mt-0.5 font-black uppercase text-[9px] px-2 py-0.5 rounded-full ${h.action === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{h.action}</span>
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
              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { handleApproveVendorInvoice(apDetailTarget); setApDetailTarget(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide ${canApproveInvoice ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'} disabled:opacity-50`}
                  disabled={!canApproveInvoice || processingId === apDetailTarget?.id}
                >Setujui</button>
                <button
                  onClick={() => { setApDetailTarget(null); setApActionTarget(apDetailTarget); setApActionType('Rejected'); setApActionReason(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                >Tolak</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Expense */}
      {expRejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">Tolak Expense</h3>
            <p className="text-xs text-slate-500 mb-4">
              {expRejectTarget.noExpense} · <span className="font-bold text-slate-700">{expRejectTarget.vendorName}</span>
            </p>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Alasan Penolakan <span className="text-rose-500">*</span></label>
            <textarea
              autoFocus
              rows={3}
              value={expRejectReason}
              onChange={e => setExpRejectReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setExpRejectTarget(null); setExpRejectReason(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button
                onClick={handleRejectExpense}
                disabled={processingId === expRejectTarget?.id}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >Tolak Expense</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak AP Hutang */}
      {apActionTarget && apActionType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">Tolak Hutang Vendor</h3>
            <p className="text-xs text-slate-500 mb-4">
              Invoice: <span className="font-bold text-slate-700">{apActionTarget.noInvoiceVendor}</span>
              {' · '}<span className="font-bold text-slate-700">{apActionTarget.supplier}</span>
            </p>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Alasan Penolakan <span className="text-rose-500">*</span></label>
            <textarea
              autoFocus
              rows={3}
              value={apActionReason}
              onChange={e => setApActionReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => { setApActionTarget(null); setApActionType(null); setApActionReason(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmitApAction} className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-700">Tolak Hutang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function countActiveTab() {
    if (activeTab === 'po') return pendingPOs.length;
    if (activeTab === 'invoice') return totalInvoicePending;
    if (activeTab === 'ap') return pendingVendorInvoices.length;
    if (activeTab === 'expense') return pendingExpenses.length;
    return 0;
  }
}
