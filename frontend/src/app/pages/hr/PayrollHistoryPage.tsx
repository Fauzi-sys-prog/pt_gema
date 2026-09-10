import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const fmtDate = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PAGE_SIZE = 20;

type FlatSlip = {
  runId: string;
  runNumber: string;
  periodLabel: string;
  period: string;
  employeeId: string;
  employeeName: string;
  grossIncome: number;
  totalDeductions: number;
  takeHomePay: number;
  status: string;
  disbursedAt?: string;
};

export default function PayrollHistoryPage() {
  const navigate = useNavigate();
  const { payrollRunList } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [page, setPage] = useState(1);

  const allSlips: FlatSlip[] = useMemo(() =>
    payrollRunList.flatMap(run =>
      run.slips.map(slip => ({
        runId: run.id,
        runNumber: run.runNumber,
        periodLabel: run.periodLabel,
        period: run.period,
        employeeId: slip.employeeId,
        employeeName: slip.employeeName,
        grossIncome: slip.grossIncome,
        totalDeductions: slip.totalDeductions,
        takeHomePay: slip.takeHomePay,
        status: slip.status,
        disbursedAt: slip.disbursedAt,
      }))
    ),
    [payrollRunList]
  );

  // Unique years for dropdown
  const years = useMemo(() => {
    const s = new Set(allSlips.map(sl => sl.period.substring(0, 4)));
    return Array.from(s).sort();
  }, [allSlips]);

  const filtered = useMemo(() => {
    return allSlips.filter(sl => {
      const matchName = sl.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
      const [slYear, slMonth] = sl.period.split('-');
      const matchMonth = filterMonth === '' || slMonth === filterMonth.padStart(2, '0');
      const matchYear = filterYear === '' || slYear === filterYear;
      return matchName && matchMonth && matchYear;
    });
  }, [allSlips, searchTerm, filterMonth, filterYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Riwayat Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">Histori slip gaji semua karyawan</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterMonth}
          onChange={handleFilterChange(setFilterMonth)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Semua Bulan</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={handleFilterChange(setFilterYear)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Semua Tahun</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Periode', 'No. Run', 'Nama', 'Gross Income', 'Total Potongan', 'THP', 'Status', 'Tgl Bayar', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              )}
              {pageData.map((sl, idx) => (
                <tr key={`${sl.runId}-${sl.employeeId}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{sl.periodLabel}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{sl.runNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{sl.employeeName}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(sl.grossIncome)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(sl.totalDeductions)}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fmt(sl.takeHomePay)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      sl.status === 'Disbursed' ? 'bg-green-100 text-green-700' :
                      sl.status === 'Approved' ? 'bg-indigo-100 text-indigo-700' :
                      sl.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {sl.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{sl.disbursedAt ? fmtDate(sl.disbursedAt) : '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/hr/payroll-slip/${sl.runId}/${sl.employeeId}`)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap"
                    >
                      <Eye size={14} /> Lihat Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              {filtered.length} data — Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
