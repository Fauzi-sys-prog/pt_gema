import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { 
  Search, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Banknote, 
  Calendar,
  CreditCard,
  Download,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

interface PaymentRecord {
  id: string;
  noReferansi: string; // No. Invoice or PO
  tanggal: string;
  customerVendor: string;
  amount: number;
  type: 'Inbound' | 'Outbound';
  method: 'Bank Transfer' | 'Cash' | 'Cheque';
  bank: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  category: 'Sales Receipt' | 'Procurement Payment' | 'Operational' | 'Payroll';
  projectName?: string;
}

export default function PaymentRegistryPage() {
  const { customerInvoiceList, expenseList, addAuditLog, currentUser } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [serverCustomerInvoices, setServerCustomerInvoices] = useState<any[]>([]);
  const [serverExpenses, setServerExpenses] = useState<any[]>([]);
  const [serverPaymentSummary, setServerPaymentSummary] = useState<{
    arOutstanding: number;
    paidIn: number;
    paidOut: number;
    pendingVendor: number;
    netCashRealized: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Inbound' | 'Outbound'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Verified' | 'Pending' | 'Rejected'>('All');
  const [reconciliationCheck, setReconciliationCheck] = useState<{
    generatedAt: string;
    periodStartDate: string;
    paymentRegistryConsistent: boolean;
    pettyCashConsistent: boolean;
  } | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const fetchPaymentRegistryData = async (silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const [summaryRes, invoiceRes, expenseRes, reconciliationRes] = await Promise.all([
        api.get<{
          summary?: {
            arOutstanding?: number;
            paidIn?: number;
            paidOut?: number;
            pendingVendor?: number;
            netCashRealized?: number;
          };
        }>('/dashboard/finance-payment-summary'),
        api.get<any[]>('/finance/customer-invoices'),
        api.get<any[]>('/finance/vendor-expenses'),
        api.get<{
          generatedAt?: string;
          period?: { startDate?: string };
          checks?: {
            paymentRegistry?: { isConsistentSource?: boolean; isNetCashConsistent?: boolean };
            pettyCash?: { isConsistentSource?: boolean };
          };
        }>('/dashboard/finance-reconciliation-check?startDate=2026-01-01'),
      ]);
      setServerCustomerInvoices((invoiceRes.data || []).map((row: any) => ({ id: row.id, ...row })));
      setServerExpenses((expenseRes.data || []).map((row: any) => ({ id: row.id, ...row })));
      if (summaryRes.data?.summary) {
        setServerPaymentSummary({
          arOutstanding: Number(summaryRes.data.summary.arOutstanding || 0),
          paidIn: Number(summaryRes.data.summary.paidIn || 0),
          paidOut: Number(summaryRes.data.summary.paidOut || 0),
          pendingVendor: Number(summaryRes.data.summary.pendingVendor || 0),
          netCashRealized: Number(summaryRes.data.summary.netCashRealized || 0),
        });
      } else {
        setServerPaymentSummary(null);
      }
      setReconciliationCheck({
        generatedAt: String(reconciliationRes.data?.generatedAt || ''),
        periodStartDate: String(reconciliationRes.data?.period?.startDate || '2026-01-01'),
        paymentRegistryConsistent:
          Boolean(reconciliationRes.data?.checks?.paymentRegistry?.isConsistentSource) &&
          Boolean(reconciliationRes.data?.checks?.paymentRegistry?.isNetCashConsistent),
        pettyCashConsistent: Boolean(reconciliationRes.data?.checks?.pettyCash?.isConsistentSource),
      });
      if (!silent) toast.success('Payment registry disinkronkan.');
    } catch {
      setServerPaymentSummary(null);
      setReconciliationCheck(null);
      if (!silent) toast.error('Gagal refresh payment registry.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPaymentRegistryData(true);
  }, []);

  const liveCustomerInvoiceList = serverCustomerInvoices.length > 0 ? serverCustomerInvoices : customerInvoiceList;
  const liveExpenseList = serverExpenses.length > 0 ? serverExpenses : expenseList;

  const payments = useMemo<PaymentRecord[]>(() => {
    const inbound: PaymentRecord[] = liveCustomerInvoiceList.flatMap((inv) =>
      (inv.paymentHistory || []).map((pay) => ({
        id: `IN-${inv.id}-${pay.id}`,
        noReferansi: inv.noInvoice,
        tanggal: pay.tanggal,
        customerVendor: inv.customerName,
        amount: Number(pay.nominal || 0),
        type: 'Inbound',
        method: String(pay.metodeBayar || 'Bank Transfer') as PaymentRecord['method'],
        bank: pay.bankName || '-',
        status: 'Verified',
        category: 'Sales Receipt',
        projectName: inv.projectName,
      }))
    );

    const outbound: PaymentRecord[] = liveExpenseList
      .filter((exp) => ['Approved', 'Paid', 'Pending Approval', 'Rejected'].includes(exp.status))
      .map((exp) => ({
        id: `OUT-${exp.id}`,
        noReferansi: exp.noExpense || exp.noKwitansi || '-',
        tanggal: exp.tanggal,
        customerVendor: exp.vendorName,
        amount: Number(exp.totalNominal || exp.nominal || 0),
        type: 'Outbound' as const,
        method: String(exp.metodeBayar || 'Bank Transfer') as PaymentRecord['method'],
        bank: '-',
        status:
          exp.status === 'Rejected'
            ? 'Rejected'
            : exp.status === 'Pending Approval'
            ? 'Pending'
            : 'Verified',
        category: exp.kategori === 'Service' || exp.kategori === 'Material' || exp.kategori === 'Equipment'
          ? 'Procurement Payment'
          : exp.kategori === 'Manpower'
          ? 'Payroll'
          : 'Operational',
        projectName: exp.projectName,
      }));

    return [...inbound, ...outbound].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  }, [liveCustomerInvoiceList, liveExpenseList]);

  const filteredPayments = payments.filter((p) => {
    const tabPass = activeTab === 'All' ? true : p.type === activeTab;
    if (!tabPass) return false;
    const statusPass = statusFilter === 'All' ? true : p.status === statusFilter;
    if (!statusPass) return false;
    if (!searchTerm.trim()) return true;
    const haystack = `${p.noReferansi} ${p.customerVendor} ${p.projectName || ''}`.toLowerCase();
    return haystack.includes(searchTerm.trim().toLowerCase());
  });

  const handleExport = async () => {
    if (!filteredPayments.length) {
      toast.info('Tidak ada data payment untuk diekspor.');
      return;
    }
    const rows = [
      ['No Referensi', 'Tanggal', 'Tipe', 'Entitas', 'Kategori', 'Amount', 'Method', 'Bank', 'Status'],
      ...filteredPayments.map((p) => [
        p.noReferansi,
        p.tanggal,
        p.type,
        p.customerVendor,
        p.category,
        String(p.amount),
        p.method,
        p.bank,
        p.status,
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `payment-registry-${dateKey}`,
      title: 'Payment Registry Report',
      subtitle: `Filter ${activeTab} / ${statusFilter} | Total pembayaran ${filteredPayments.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Register pembayaran dengan realisasi inbound ${totalInboundMonth.toLocaleString('id-ID')} dan outbound ${totalOutboundMonth.toLocaleString('id-ID')} pada periode berjalan.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Payment Registry',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `payment-registry-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `payment-registry-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'PAYMENT_REGISTRY_EXPORTED',
        module: 'Finance',
        details: `Export payment registry (${filteredPayments.length} baris)`,
        status: 'Success',
      });
      toast.success('Payment registry Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export payment registry gagal.');
    }
  };

  const monthNow = new Date().toISOString().slice(0, 7);
  const monthPayments = payments.filter((p) => String(p.tanggal || '').slice(0, 7) === monthNow);
  const localInboundMonth = monthPayments
    .filter((p) => p.type === 'Inbound' && p.status !== 'Rejected')
    .reduce((sum, p) => sum + p.amount, 0);
  const localOutboundMonth = monthPayments
    .filter((p) => p.type === 'Outbound' && p.status !== 'Rejected')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalInboundMonth = Number(serverPaymentSummary?.paidIn ?? localInboundMonth);
  const totalOutboundMonth = Number(serverPaymentSummary?.paidOut ?? localOutboundMonth);
  const runningBalance = Number(serverPaymentSummary?.netCashRealized ?? (localInboundMonth - localOutboundMonth));
  const pendingCount = payments.filter((p) => p.status === 'Pending').length;
  const reconciliationPassed = Boolean(
    reconciliationCheck?.paymentRegistryConsistent && reconciliationCheck?.pettyCashConsistent
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Registry</h1>
          <p className="text-gray-500">Registri kas dan bank untuk rekonsiliasi transaksi</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPaymentRegistryData(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium">
            <Download size={18} />
            Export Word + Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg font-medium opacity-70 cursor-not-allowed">
            <Plus size={18} />
            Catat Transaksi
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 ${
          reconciliationCheck
            ? reconciliationPassed
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="text-sm font-bold text-gray-800">
          Reconciliation Check (mulai {reconciliationCheck?.periodStartDate || '2026-01-01'}):{' '}
          <span className={reconciliationPassed ? 'text-emerald-700' : 'text-amber-700'}>
            {reconciliationCheck ? (reconciliationPassed ? 'PASS' : 'FAIL') : 'N/A'}
          </span>
        </div>
        <div className="text-[11px] font-medium text-gray-600">
          Payment Registry: {reconciliationCheck?.paymentRegistryConsistent ? 'OK' : 'Mismatch'} | Petty Cash:{' '}
          {reconciliationCheck?.pettyCashConsistent ? 'OK' : 'Mismatch'}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <ArrowDownLeft size={80} className="text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Total Kas Masuk (Bulan Ini)</p>
          <h3 className="text-2xl font-bold text-green-600">{formatCurrency(totalInboundMonth)}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 w-fit px-2 py-1 rounded-md">
            <span>Data real invoice payment</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <ArrowUpRight size={80} className="text-red-600" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">Total Kas Keluar (Bulan Ini)</p>
          <h3 className="text-2xl font-bold text-red-600">{formatCurrency(totalOutboundMonth)}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 w-fit px-2 py-1 rounded-md">
            <span>Data real vendor expense</span>
          </div>
        </div>

        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Banknote size={80} className="text-white" />
          </div>
          <p className="text-sm font-medium text-blue-100 mb-1">Saldo Berjalan (Bank)</p>
          <h3 className="text-2xl font-bold text-white">{formatCurrency(runningBalance)}</h3>
          <p className="mt-4 text-xs text-blue-100 italic">Pending verifikasi: {pendingCount} transaksi</p>
        </div>
      </div>

      {/* Main Registry */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('All')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'All' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Semua
            </button>
            <button 
              onClick={() => setActiveTab('Inbound')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Inbound' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Uang Masuk
            </button>
            <button 
              onClick={() => setActiveTab('Outbound')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Outbound' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Uang Keluar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari transaksi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full md:w-64"
              />
            </div>
            <button
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === 'All' ? 'Verified' : prev === 'Verified' ? 'Pending' : prev === 'Pending' ? 'Rejected' : 'All'
                )
              }
              title={`Filter status: ${statusFilter}`}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Filter size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 text-gray-500 text-[10px] uppercase font-black tracking-widest italic">
              <tr>
                <th className="px-6 py-4 border-b border-gray-100">Tanggal & Ref</th>
                <th className="px-6 py-4 border-b border-gray-100">Entitas</th>
                <th className="px-6 py-4 border-b border-gray-100">Kategori & Bank</th>
                <th className="px-6 py-4 border-b border-gray-100 text-right">Nominal</th>
                <th className="px-6 py-4 border-b border-gray-100 text-center">Status</th>
                <th className="px-6 py-4 border-b border-gray-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${p.type === 'Inbound' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {p.type === 'Inbound' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight italic">{p.tanggal}</div>
                        <div className="text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:underline cursor-pointer">
                          {p.noReferansi} <ExternalLink size={10} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-black text-slate-700 uppercase italic">{p.customerVendor}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{p.projectName || p.method}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.category}</div>
                    <div className="text-[10px] text-slate-400 italic font-medium">{p.bank}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-black italic ${p.type === 'Inbound' ? 'text-green-600' : 'text-red-600'}`}>
                      {p.type === 'Inbound' ? '+' : '-'} {formatCurrency(p.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase italic tracking-widest border ${
                      p.status === 'Verified' ? 'bg-green-50 text-green-600 border-green-100' : 
                      p.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toast.info(`${p.noReferansi} • ${formatCurrency(p.amount)} • ${p.status}`)}
                      className="p-2 text-slate-400 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase italic">Menampilkan {filteredPayments.length} transaksi</p>
          <button
            onClick={() => toast.info(`Menampilkan ${filteredPayments.length} transaksi sesuai filter`)}
            className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase italic hover:gap-2 transition-all"
          >
            Lihat Semua Riwayat <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
