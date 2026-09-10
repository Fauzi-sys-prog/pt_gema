import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, X, AlertTriangle, Clock, Package, FileText, TrendingDown, CheckCircle2, Briefcase, Users, Wallet, Receipt } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, type NotificationState } from '../services/notificationService';

interface Notification {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  category: 'stock' | 'invoice' | 'quotation' | 'wo' | 'qc' | 'po' | 'ar' | 'project' | 'leave' | 'payroll' | 'thl' | 'expense';
  title: string;
  message: string;
  path: string;
  timestamp: Date;
}

const categoryIcon = {
  stock: Package,
  invoice: FileText,
  quotation: FileText,
  wo: Clock,
  qc: CheckCircle2,
  po: TrendingDown,
  ar: Receipt,
  project: Briefcase,
  leave: Users,
  payroll: Wallet,
  thl: Wallet,
  expense: FileText,
};

const typeColors = {
  danger: 'bg-red-50 border-red-100 text-red-600',
  warning: 'bg-amber-50 border-amber-100 text-amber-600',
  info: 'bg-blue-50 border-blue-100 text-blue-600',
  success: 'bg-emerald-50 border-emerald-100 text-emerald-600',
};

const typeDot = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<Record<string, NotificationState>>({});
  const ref = useRef<HTMLDivElement>(null);

  const {
    stockItemList,
    invoiceList,
    workOrderList,
    poList,
    customerInvoiceList,
    projectList,
    leaveList,
    payrollRunList,
    expenseList,
    quotationList,
    qcInspectionList,
    thlPayrollRunList,
  } = useApp();

  const today = new Date();

  const stateStorageKey = `notification-state:${currentUser?.id || 'guest'}`;

  useEffect(() => {
    if (!currentUser?.id) return;
    const cached = localStorage.getItem(stateStorageKey);
    if (cached) {
      try { setStates(JSON.parse(cached)); } catch { /* abaikan cache rusak */ }
    }
    notificationService.getStates()
      .then(remote => {
        setStates(remote);
        localStorage.setItem(stateStorageKey, JSON.stringify(remote));
      })
      .catch(() => undefined);
  }, [currentUser?.id, stateStorageKey]);

  const roleVisibility: Record<Notification['category'], string[]> = {
    stock: ['Owner', 'Admin', 'Operasional & Produksi'],
    invoice: ['Owner', 'Admin', 'Finance & Accounting'],
    quotation: ['Owner', 'Admin', 'Sales & Marketing'],
    wo: ['Owner', 'Admin', 'Operasional & Produksi'],
    qc: ['Owner', 'Admin', 'Operasional & Produksi', 'HSE'],
    po: ['Owner', 'Admin', 'Finance & Accounting', 'Operasional & Produksi'],
    ar: ['Owner', 'Admin', 'Finance & Accounting', 'Sales & Marketing'],
    project: ['Owner', 'Admin', 'Sales & Marketing', 'Operasional & Produksi'],
    leave: ['Owner', 'Admin', 'HR'],
    payroll: ['Owner', 'Admin', 'Finance & Accounting', 'HR'],
    thl: ['Owner', 'Admin', 'Finance & Accounting', 'HR'],
    expense: ['Owner', 'Admin', 'Finance & Accounting', 'Operasional & Produksi'],
  };

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];

    // 1. Stock di bawah minimum
    stockItemList.forEach(s => {
      if (s.stok <= s.minStock) {
        items.push({
          id: `stock-low-${s.id}`,
          type: s.stok === 0 ? 'danger' : 'warning',
          category: 'stock',
          title: s.stok === 0 ? 'Stok Habis' : 'Stok Menipis',
          message: `${s.nama} — sisa ${s.stok} ${s.satuan} (min: ${s.minStock})`,
          path: '/inventory/center',
          timestamp: today,
        });
      }
    });

    // 2. Stock expiry < 30 hari
    stockItemList.forEach(s => {
      if (s.expiryDate) {
        const exp = new Date(s.expiryDate);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 30) {
          items.push({
            id: `stock-exp-${s.id}`,
            type: diffDays <= 7 ? 'danger' : 'warning',
            category: 'stock',
            title: 'Expiry Mendekati',
            message: `${s.nama} — kadaluarsa ${diffDays} hari lagi (${s.expiryDate})`,
            path: '/inventory/center',
            timestamp: today,
          });
        }
      }
    });

    // 3. Invoice overdue
    invoiceList.forEach(inv => {
      if (inv.status !== 'Paid' && inv.jatuhTempo) {
        const due = new Date(inv.jatuhTempo);
        const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          items.push({
            id: `inv-overdue-${inv.id}`,
            type: 'danger',
            category: 'invoice',
            title: 'Invoice Overdue',
            message: `${inv.noInvoice} — ${inv.customer}, telat ${diffDays} hari`,
            path: '/finance/piutang',
            timestamp: today,
          });
        } else if (diffDays > -7) {
          items.push({
            id: `inv-due-${inv.id}`,
            type: 'warning',
            category: 'invoice',
            title: 'Invoice Jatuh Tempo',
            message: `${inv.noInvoice} — ${inv.customer}, jatuh tempo ${Math.abs(diffDays)} hari lagi`,
            path: '/finance/piutang',
            timestamp: today,
          });
        }
      }
    });

    // 4. Work Order deadline < 3 hari & belum Completed
    workOrderList.forEach(wo => {
      if (wo.status !== 'Completed' && wo.deadline) {
        const dl = new Date(wo.deadline);
        const diffDays = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          items.push({
            id: `wo-late-${wo.id}`,
            type: 'danger',
            category: 'wo',
            title: 'WO Terlambat',
            message: `${wo.woNumber} — ${wo.itemToProduce}, telat ${Math.abs(diffDays)} hari`,
            path: '/produksi/dashboard',
            timestamp: today,
          });
        } else if (diffDays <= 3) {
          items.push({
            id: `wo-due-${wo.id}`,
            type: 'warning',
            category: 'wo',
            title: 'WO Deadline Dekat',
            message: `${wo.woNumber} — ${wo.itemToProduce}, sisa ${diffDays} hari`,
            path: '/produksi/dashboard',
            timestamp: today,
          });
        }
      }
    });

    quotationList.forEach(q => {
      if (q.status === 'Pending Approval' || q.internalApprovalStatus === 'Pending') {
        items.push({
          id: `quotation-approval-${q.id}`,
          type: 'info',
          category: 'quotation',
          title: 'Quotation Menunggu Approval',
          message: `${q.noPenawaran || q.nomorQuotation || q.id} — ${q.kepada || q.customer?.nama || 'Customer'}`,
          path: '/sales/quotation-approval',
          timestamp: today,
        });
      }
    });

    qcInspectionList.forEach(qc => {
      if (qc.status === 'Rejected' || qc.status === 'Partial') {
        items.push({
          id: `qc-result-${qc.id}-${qc.status}`,
          type: qc.status === 'Rejected' ? 'danger' : 'warning',
          category: 'qc',
          title: qc.status === 'Rejected' ? 'QC Ditolak' : 'QC Sebagian Lolos',
          message: `${qc.batchNo} — ${qc.itemNama}, reject ${qc.qtyRejected} dari ${qc.qtyInspected}`,
          path: '/produksi/qc',
          timestamp: today,
        });
      }
    });

    // 6. PO approved tapi belum ada receiving > 7 hari
    poList.forEach(po => {
      if (po.status === 'Sent' && po.tanggal) {
        const created = new Date(po.tanggal);
        const ageDays = Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= 7) {
          items.push({
            id: `po-norcv-${po.id}`,
            type: 'info',
            category: 'po',
            title: 'PO Belum Diterima',
            message: `${po.noPO} — ${po.supplier}, ${ageDays} hari sejak dikirim`,
            path: '/purchasing/receiving',
            timestamp: today,
          });
        }
      }
    });

    // 7. Customer Invoice AR overdue / jatuh tempo
    customerInvoiceList.forEach(inv => {
      if (inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Draft' && inv.status !== 'Pending' && inv.dueDate) {
        const due = new Date(inv.dueDate);
        const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          items.push({
            id: `ar-overdue-${inv.id}`,
            type: 'danger',
            category: 'ar',
            title: 'AR Overdue',
            message: `${inv.noInvoice} — ${inv.customerName}, telat ${diffDays} hari`,
            path: '/finance/accounts-receivable',
            timestamp: today,
          });
        } else if (diffDays > -7) {
          items.push({
            id: `ar-due-${inv.id}`,
            type: 'warning',
            category: 'ar',
            title: 'AR Jatuh Tempo',
            message: `${inv.noInvoice} — ${inv.customerName}, sisa ${Math.abs(diffDays)} hari`,
            path: '/finance/accounts-receivable',
            timestamp: today,
          });
        }
      }
    });

    // 8. Project deadline mendekati / terlewat
    projectList.filter(p => p.status === 'Active' || p.status === 'In Progress').forEach(p => {
      if (p.endDate) {
        const end = new Date(p.endDate);
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          items.push({
            id: `proj-late-${p.id}`,
            type: 'danger',
            category: 'project',
            title: 'Project Terlambat',
            message: `${p.kodeProject || p.id} — ${p.namaProject}, telat ${Math.abs(diffDays)} hari`,
            path: '/project',
            timestamp: today,
          });
        } else if (diffDays <= 7) {
          items.push({
            id: `proj-due-${p.id}`,
            type: 'warning',
            category: 'project',
            title: 'Project Deadline Dekat',
            message: `${p.kodeProject || p.id} — ${p.namaProject}, sisa ${diffDays} hari`,
            path: '/project',
            timestamp: today,
          });
        }
      }
    });

    // 9. Leave pending approval > 1 hari
    leaveList.forEach(lv => {
      if (lv.status === 'Pending') {
        const created = new Date(lv.startDate || today);
        const ageDays = Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= 1) {
          items.push({
            id: `leave-pending-${lv.id}`,
            type: 'warning',
            category: 'leave',
            title: 'Cuti Menunggu Approval',
            message: `${lv.employeeName} — ${lv.leaveType}, sudah ${ageDays} hari menunggu`,
            path: '/hr/cuti',
            timestamp: today,
          });
        }
      }
    });

    // 10. Payroll belum disbursed
    payrollRunList.forEach(p => {
      if (p.status === 'Approved') {
        items.push({
          id: `payroll-undisbursed-${p.id}`,
          type: 'warning',
          category: 'payroll',
          title: 'Payroll Belum Dibayar',
          message: `${p.runNumber} (${p.periodLabel}) — sudah disetujui, belum dicairkan`,
          path: '/hr/payroll-pro',
          timestamp: today,
        });
      } else if (p.status === 'Calculated') {
        items.push({
          id: `payroll-calculated-${p.id}`,
          type: 'info',
          category: 'payroll',
          title: 'Payroll Menunggu Approval',
          message: `${p.runNumber} (${p.periodLabel}) — hasil perhitungan siap disetujui`,
          path: '/hr/payroll-pro',
          timestamp: today,
        });
      }
    });

    thlPayrollRunList.forEach(run => {
      if (run.status === 'Approved') {
        items.push({
          id: `thl-payroll-undisbursed-${run.id}`,
          type: 'warning',
          category: 'thl',
          title: 'Gajian THL Belum Dibayar',
          message: `${run.periodLabel} — ${run.thlCount} THL, netto Rp ${run.totalNetto.toLocaleString('id-ID')}`,
          path: '/hr/gajian-thl',
          timestamp: today,
        });
      }
    });

    // 11. Vendor expense pending > 3 hari
    expenseList.forEach((exp: any) => {
      if (exp.status === 'Pending' && exp.tanggal) {
        const created = new Date(exp.tanggal);
        const ageDays = Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= 3) {
          items.push({
            id: `exp-pending-${exp.id}`,
            type: 'warning',
            category: 'expense',
            title: 'Expense Pending Approval',
            message: `${exp.noExpense || exp.id?.slice(0, 8)} — ${exp.vendorName}, sudah ${ageDays} hari`,
            path: '/finance/tambahan-biaya-proyek',
            timestamp: today,
          });
        }
      }
    });

    const role = currentUser?.role || '';
    const seesEverything = ['Owner', 'Admin', 'Manager', 'SPV'].includes(role);
    return items.filter(n => (seesEverything || roleVisibility[n.category].includes(role)) && states[n.id] !== 'DISMISSED');
  }, [stockItemList, invoiceList, workOrderList, poList, customerInvoiceList, projectList, leaveList, payrollRunList, expenseList, quotationList, qcInspectionList, thlPayrollRunList, states, currentUser?.role]);

  const dangerCount = notifications.filter(n => n.type === 'danger' && states[n.id] !== 'READ').length;
  const badgeCount = notifications.filter(n => states[n.id] !== 'READ').length;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const persistLocalState = (id: string, state: NotificationState) => {
    setStates(prev => {
      const next = { ...prev, [id]: state };
      localStorage.setItem(stateStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleClick = (notif: Notification) => {
    persistLocalState(notif.id, 'READ');
    void notificationService.read(notif.id).catch(() => undefined);
    setOpen(false);
    navigate(notif.path);
  };

  const dismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    persistLocalState(id, 'DISMISSED');
    void notificationService.dismiss(id).catch(() => undefined);
  };

  const dismissAll = () => {
    const ids = notifications.map(n => n.id);
    setStates(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = 'DISMISSED'; });
      localStorage.setItem(stateStorageKey, JSON.stringify(next));
      return next;
    });
    void notificationService.dismissAll(ids).catch(() => undefined);
  };

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    setStates(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] !== 'DISMISSED') next[id] = 'READ'; });
      localStorage.setItem(stateStorageKey, JSON.stringify(next));
      return next;
    });
    void notificationService.readAll(ids).catch(() => undefined);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    notifications.forEach(n => {
      if (!groups[n.category]) groups[n.category] = [];
      groups[n.category].push(n);
    });
    return groups;
  }, [notifications]);

  const categoryLabel: Record<string, string> = {
    stock: 'Inventory',
    invoice: 'Invoice Pembelian',
    quotation: 'Quotation Approval',
    wo: 'Work Order',
    qc: 'QC',
    po: 'Purchase Order',
    ar: 'AR / Customer Invoice',
    project: 'Project',
    leave: 'Cuti & Izin',
    payroll: 'Payroll',
    thl: 'Gajian THL',
    expense: 'Vendor Expense',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
      >
        <Bell size={20} className={dangerCount > 0 ? 'text-red-500' : 'text-slate-500'} />
        {badgeCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center ${dangerCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl shadow-slate-200/80 border border-slate-100 z-[200] overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={dangerCount > 0 ? 'text-red-500' : 'text-amber-500'} />
              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Notifikasi</span>
              {badgeCount > 0 && (
                <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{badgeCount} alert</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {badgeCount > 0 && <button onClick={markAllRead} className="text-[9px] font-black text-blue-500 uppercase hover:text-blue-700 tracking-widest">Baca Semua</button>}
              {notifications.length > 0 && <button onClick={dismissAll} className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors tracking-widest">Hapus Semua</button>}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Semua Clear!</p>
                <p className="text-[10px] text-slate-300 mt-1">Tidak ada alert aktif</p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-5 py-2 bg-slate-50/80">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{categoryLabel[cat] || cat}</span>
                  </div>
                  {items.map(notif => {
                    const Icon = categoryIcon[notif.category] || Bell;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className={`px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors group ${states[notif.id] === 'READ' ? 'opacity-60' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${typeColors[notif.type]}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${states[notif.id] === 'READ' ? 'bg-slate-300' : typeDot[notif.type]}`} />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{notif.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold leading-relaxed truncate">{notif.message}</p>
                        </div>
                        <button
                          onClick={(e) => dismiss(e, notif.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-500 transition-all flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {badgeCount > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-[9px] text-slate-400 font-bold uppercase text-center tracking-widest">
                {dangerCount > 0 && <span className="text-red-500">{dangerCount} critical · </span>}
                {notifications.filter(n => n.type === 'warning').length} warning · {notifications.filter(n => n.type === 'info').length} info
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
