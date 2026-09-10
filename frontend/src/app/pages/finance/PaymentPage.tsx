import { useState, useMemo } from 'react';
import { Search, Download, CheckCircle, Clock, AlertCircle, CreditCard, Wallet, TrendingDown, Filter } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';

type PaymentJenis = 'All' | 'PO' | 'Expense' | 'Payroll';
type PaymentStatus = 'All' | 'Pending' | 'Approved' | 'Paid';

export default function PaymentPage() {
  const { poList, expenseList, payrollList, approveExpense } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJenis, setFilterJenis] = useState<PaymentJenis>('All');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus>('All');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  // Consolidate all outgoing payment records
  const allPayments = useMemo(() => {
    const rows: {
      id: string; noPayment: string; tanggal: string; jenis: string;
      referensi: string; kepada: string; jumlah: number; status: string; sourceType: string;
    }[] = [];

    // PO payments
    poList.forEach(po => {
      rows.push({
        id: po.id, noPayment: po.noPO, tanggal: po.tanggal,
        jenis: 'PO', referensi: po.noPO, kepada: po.supplier,
        jumlah: po.total || 0,
        status: po.status === 'Received' || po.status === 'Completed' ? 'Paid'
          : po.status === 'Approved' ? 'Approved'
          : po.status === 'Rejected' ? 'Rejected' : 'Pending',
        sourceType: 'PO'
      });
    });

    // Vendor expense payments
    expenseList.forEach((exp: any) => {
      rows.push({
        id: exp.id, noPayment: exp.noBon || exp.id?.slice(0, 8) || '-',
        tanggal: exp.tanggal || exp.date || '-',
        jenis: 'Expense', referensi: exp.noBon || '-',
        kepada: exp.vendorName || exp.vendor || 'Vendor',
        jumlah: exp.totalNominal || exp.nominal || 0,
        status: exp.status === 'Paid' ? 'Paid' : exp.status === 'Approved' ? 'Approved' : 'Pending',
        sourceType: 'Expense'
      });
    });

    // Payroll payments
    (payrollList || []).forEach((p: any) => {
      const periode = p.periode || (p.month && p.year ? `${p.month}/${p.year}` : '-');
      rows.push({
        id: p.id, noPayment: `PAYROLL-${periode}`,
        tanggal: p.tanggalBayar || p.tanggal || '-',
        jenis: 'Payroll', referensi: periode,
        kepada: `Gaji Karyawan — Periode ${periode}`,
        jumlah: p.totalPayroll || 0,
        status: p.status === 'Disbursed' || p.status === 'Paid' ? 'Paid' : 'Pending',
        sourceType: 'Payroll'
      });
    });

    return rows;
  }, [poList, expenseList, payrollList]);

  const filtered = useMemo(() => {
    return allPayments.filter(p => {
      const matchSearch = p.kepada.toLowerCase().includes(searchTerm.toLowerCase())
        || p.noPayment.toLowerCase().includes(searchTerm.toLowerCase())
        || p.referensi.toLowerCase().includes(searchTerm.toLowerCase());
      const matchJenis = filterJenis === 'All' || p.jenis === filterJenis;
      const matchStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchSearch && matchJenis && matchStatus;
    }).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [allPayments, searchTerm, filterJenis, filterStatus]);

  const totalPaid = allPayments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.jumlah, 0);
  const totalPending = allPayments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.jumlah, 0);
  const totalApproved = allPayments.filter(p => p.status === 'Approved').reduce((s, p) => s + p.jumlah, 0);
  const totalAll = allPayments.reduce((s, p) => s + p.jumlah, 0);

  const statusBadge = (status: string) => {
    if (status === 'Paid') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Approved') return 'bg-blue-50 text-blue-700';
    if (status === 'Rejected') return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-700';
  };

  const jenisBadge = (jenis: string) => {
    if (jenis === 'PO') return 'bg-blue-50 text-blue-700';
    if (jenis === 'Expense') return 'bg-purple-50 text-purple-700';
    if (jenis === 'Payroll') return 'bg-emerald-50 text-emerald-700';
    return 'bg-slate-50 text-slate-700';
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl"><CreditCard className="w-7 h-7 text-blue-600" /></div>
            Payment Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-1">Rekap semua pengeluaran: PO, Vendor Expense, Payroll</p>
        </div>
        <button
          onClick={() => toast.info('Export coming soon')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium"
        >
          <Download size={16} /> Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Pengeluaran</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalAll)}</p>
          <p className="text-xs text-slate-400 mt-1">{allPayments.length} transaksi</p>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1"><CheckCircle size={11} /> Sudah Dibayar</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-emerald-400 mt-1">{allPayments.filter(p => p.status === 'Paid').length} transaksi</p>
        </div>
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1"><Wallet size={11} /> Disetujui</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalApproved)}</p>
          <p className="text-xs text-blue-400 mt-1">{allPayments.filter(p => p.status === 'Approved').length} transaksi</p>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm">
          <p className="text-xs text-amber-600 font-medium mb-1 flex items-center gap-1"><Clock size={11} /> Menunggu</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-amber-400 mt-1">{allPayments.filter(p => p.status === 'Pending').length} transaksi</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Cari vendor, no. referensi..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select value={filterJenis} onChange={e => setFilterJenis(e.target.value as PaymentJenis)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
            <option value="All">Semua Jenis</option>
            <option value="PO">PO</option>
            <option value="Expense">Expense</option>
            <option value="Payroll">Payroll</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PaymentStatus)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500">
            <option value="All">Semua Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} hasil</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-5 py-4">No. Referensi</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Jenis</th>
                <th className="px-5 py-4">Kepada</th>
                <th className="px-5 py-4 text-right">Jumlah</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <TrendingDown className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Tidak ada data</p>
                  </td>
                </tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{item.noPayment}</td>
                  <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{item.tanggal}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${jenisBadge(item.jenis)}`}>{item.jenis}</span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900 max-w-[180px] truncate">{item.kepada}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(item.jumlah)}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${statusBadge(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.status === 'Pending' && item.sourceType === 'Expense' && (
                      <button
                        onClick={async () => {
                          if (processingId) return;
                          setProcessingId(item.id);
                          try {
                            await approveExpense(item.id, 'Finance');
                            toast.success('Expense disetujui');
                          } catch (err) {
                            toast.error('Gagal approve: ' + (err instanceof Error ? err.message : 'Unknown error'));
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                        disabled={processingId === item.id}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === item.id ? '...' : 'Approve'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
