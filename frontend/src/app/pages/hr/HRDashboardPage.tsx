import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Users, Clock, CalendarOff, Wallet, BarChart2, ArrowRight, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../contexts/AppContext';

export default function HRDashboardPage() {
  const navigate = useNavigate();
  const {
    employeeList,
    attendanceList,
    leaveList,
    employeeAdvanceList,
    payrollRunList,
  } = useApp();

  const today = new Date().toISOString().split('T')[0];

  const karyawanAktif = useMemo(
    () => employeeList.filter(e => e.status === 'Active').length,
    [employeeList]
  );

  const hadirHariIni = useMemo(
    () => attendanceList.filter(a => a.date === today && !!a.checkIn).length,
    [attendanceList, today]
  );

  const cutiMenunggu = useMemo(
    () => leaveList.filter(l => l.status === 'Pending').length,
    [leaveList]
  );

  const kasbonMenunggu = useMemo(
    () => employeeAdvanceList.filter(a => a.status === 'Submitted').length,
    [employeeAdvanceList]
  );

  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    employeeList
      .filter(e => e.status === 'Active')
      .forEach(e => {
        const dept = e.department || 'Lainnya';
        counts[dept] = (counts[dept] ?? 0) + 1;
      });
    return Object.entries(counts).map(([department, total]) => ({ department, total }));
  }, [employeeList]);

  const lastRun = payrollRunList.length > 0 ? payrollRunList[0] : null;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'Disbursed': return 'bg-green-100 text-green-700';
      case 'Approved': return 'bg-blue-100 text-blue-700';
      case 'Calculated':
      case 'Reviewed': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const kpiCards = [
    {
      label: 'Karyawan Aktif',
      value: karyawanAktif,
      icon: <Users className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Hadir Hari Ini',
      value: hadirHariIni,
      icon: <Clock className="w-6 h-6 text-green-500" />,
      bg: 'bg-green-50',
    },
    {
      label: 'Cuti Menunggu',
      value: cutiMenunggu,
      icon: <CalendarOff className="w-6 h-6 text-yellow-500" />,
      bg: 'bg-yellow-50',
    },
    {
      label: 'Kasbon Menunggu',
      value: kasbonMenunggu,
      icon: <Wallet className="w-6 h-6 text-red-500" />,
      bg: 'bg-red-50',
    },
  ];

  const quickActions = [
    { label: 'Absensi Hari Ini', path: '/hr/attendance-today', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Check In / Out', path: '/hr/check-in-out', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Payroll Pro', path: '/hr/payroll-pro', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Kasbon Karyawan', path: '/hr/employee-advance', color: 'bg-orange-600 hover:bg-orange-700' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard HR</h1>
        <p className="text-sm text-gray-500 mt-1">Ringkasan data sumber daya manusia hari ini</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className={`rounded-xl p-4 ${card.bg} border border-white shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">{card.label}</span>
              {card.icon}
            </div>
            <p className="text-3xl font-bold text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts + Last Payroll */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Karyawan per Departemen</h2>
          </div>
          {departmentData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Belum ada data karyawan aktif
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={departmentData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid key="hr-grid" strokeDasharray="3 3" vertical={false} />
                <XAxis key="hr-x" dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis key="hr-y" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  key="hr-tip"
                  formatter={(value: number) => [value, 'Karyawan']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar key="hr-bar" dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Last Payroll Run */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-700">Payroll Terakhir</h2>
            </div>
            {lastRun ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Periode</p>
                  <p className="font-semibold text-gray-800">{lastRun.periodLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total THP</p>
                  <p className="font-semibold text-gray-800">{formatCurrency(lastRun.totalTHP)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Jumlah Karyawan</p>
                  <p className="font-semibold text-gray-800">{lastRun.employeeCount} orang</p>
                </div>
                <div>
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${getRunStatusColor(lastRun.status)}`}>
                    {lastRun.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-4">Belum ada data payroll</p>
            )}
          </div>
          <button
            onClick={() => navigate('/hr/payroll-pro')}
            className="mt-4 flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
          >
            Lihat Payroll <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white text-sm font-medium rounded-lg px-4 py-3 flex items-center justify-between transition-colors`}
            >
              {action.label}
              <ArrowRight className="w-4 h-4 ml-1 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
