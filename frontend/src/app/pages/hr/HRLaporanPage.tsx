import { useState, useMemo } from 'react';
import { Users, Clock, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

type SummaryCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
};

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4`}>
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function HRLaporanPage() {
  const {
    attendanceList,
    employeeList,
    payrollRunList,
    employeeAdvanceList,
    payrollPolicy,
  } = useApp();

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const period = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;

  // ── Attendance data ────────────────────────────────────────────────────
  const attendanceForPeriod = useMemo(() =>
    attendanceList.filter(a => a.date.startsWith(period)),
    [attendanceList, period]
  );

  const totalHadir = attendanceForPeriod.filter(
    a => a.status === 'Present' || a.status === 'Late'
  ).length;

  const standardDays = payrollPolicy?.standardWorkDays ?? 25;
  const activeEmpCount = employeeList.filter(e => e.status === 'Active').length;
  const rataKehadiran = activeEmpCount > 0
    ? ((totalHadir / (activeEmpCount * standardDays)) * 100).toFixed(1)
    : '0.0';

  const totalTerlambat = attendanceForPeriod.filter(a => a.status === 'Late').length;
  const totalLembur = attendanceForPeriod.reduce((s, a) => s + (a.overtime ?? 0), 0);

  // Bar chart by department
  const departments = useMemo(() => {
    const deps = new Set(employeeList.map(e => e.department).filter(Boolean));
    return Array.from(deps);
  }, [employeeList]);

  const attendanceByDept = useMemo(() =>
    departments.map(dept => {
      const empIds = new Set(
        employeeList.filter(e => e.department === dept).map(e => e.id)
      );
      const hadir = attendanceForPeriod.filter(
        a => empIds.has(a.employeeId) && (a.status === 'Present' || a.status === 'Late')
      ).length;
      const terlambat = attendanceForPeriod.filter(
        a => empIds.has(a.employeeId) && a.status === 'Late'
      ).length;
      return { dept: dept.length > 12 ? dept.substring(0, 12) + '…' : dept, hadir, terlambat };
    }),
    [departments, employeeList, attendanceForPeriod]
  );

  // ── Payroll data ───────────────────────────────────────────────────────
  const payrollForPeriod = useMemo(() =>
    payrollRunList.filter(r => r.period === period),
    [payrollRunList, period]
  );

  const totalGross = payrollForPeriod.reduce((s, r) => s + r.totalGross, 0);
  const totalTHP = payrollForPeriod.reduce((s, r) => s + r.totalTHP, 0);
  const totalKaryawanDibayar = payrollForPeriod.reduce((s, r) => s + r.employeeCount, 0);
  const payrollRuns = payrollForPeriod.length;

  // ── Kasbon data ────────────────────────────────────────────────────────
  const kasbonAktif = employeeAdvanceList.filter(
    a => a.status === 'Disbursed' || a.status === 'Partially Deducted'
  );
  const kasbonBaru = employeeAdvanceList.filter(a => a.requestDate.startsWith(period));
  const periodRun = payrollForPeriod[0];
  const totalCicilan = periodRun
    ? periodRun.slips.reduce((s, sl) => s + (sl.kasbonDeduction ?? 0), 0)
    : employeeAdvanceList.filter(a => a.status === 'Partially Deducted' || a.status === 'Settled').reduce((s, a) => s + a.deductionThisPeriod, 0);
  const sisaKasbon = kasbonAktif.reduce((s, a) => s + a.remainingBalanceAfter, 0);

  const years = useMemo(() => {
    const s = new Set<number>();
    attendanceList.forEach(a => s.add(new Date(a.date).getFullYear()));
    payrollRunList.forEach(r => s.add(Number(r.period.substring(0, 4))));
    s.add(now.getFullYear());
    return Array.from(s).sort();
  }, [attendanceList, payrollRunList]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan HR</h1>
          <p className="text-sm text-gray-500 mt-1">Ringkasan kehadiran, payroll, dan kasbon</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Kehadiran ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <Users size={18} className="text-blue-500" /> Kehadiran
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Hadir"
            value={totalHadir.toString()}
            icon={<Users size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <SummaryCard
            label="Rata-rata Kehadiran"
            value={`${rataKehadiran}%`}
            icon={<TrendingUp size={20} className="text-green-600" />}
            color="bg-green-50"
          />
          <SummaryCard
            label="Total Terlambat"
            value={totalTerlambat.toString()}
            icon={<Clock size={20} className="text-orange-600" />}
            color="bg-orange-50"
          />
          <SummaryCard
            label="Total Lembur (jam)"
            value={totalLembur.toFixed(1)}
            icon={<Clock size={20} className="text-purple-600" />}
            color="bg-purple-50"
          />
        </div>

        {attendanceByDept.length > 0 ? (() => {
          const maxHadir = Math.max(...attendanceByDept.map(d => d.hadir), 1);
          const maxTerlambat = Math.max(...attendanceByDept.map(d => d.terlambat), 1);
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Kehadiran per Departemen</h3>
              <div className="flex gap-4 mb-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />Hadir</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />Terlambat</span>
              </div>
              <div className="space-y-3">
                {attendanceByDept.map(d => (
                  <div key={d.dept}>
                    <p className="text-[11px] font-semibold text-gray-500 mb-1 truncate">{d.dept}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${(d.hadir / maxHadir) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-blue-600 w-6 text-right">{d.hadir}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all duration-500"
                          style={{ width: `${(d.terlambat / maxTerlambat) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-orange-500 w-6 text-right">{d.terlambat}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })() : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Tidak ada data kehadiran untuk periode ini.
          </div>
        )}
      </section>

      {/* ── Payroll ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign size={18} className="text-green-500" /> Payroll
        </h2>
        {payrollForPeriod.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Tidak ada payroll run untuk periode ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Gross"
              value={fmt(totalGross)}
              icon={<TrendingUp size={20} className="text-blue-600" />}
              color="bg-blue-50"
            />
            <SummaryCard
              label="Total THP"
              value={fmt(totalTHP)}
              icon={<DollarSign size={20} className="text-green-600" />}
              color="bg-green-50"
            />
            <SummaryCard
              label="Karyawan Dibayar"
              value={totalKaryawanDibayar.toString()}
              icon={<Users size={20} className="text-indigo-600" />}
              color="bg-indigo-50"
            />
            <SummaryCard
              label="Payroll Runs"
              value={payrollRuns.toString()}
              icon={<TrendingUp size={20} className="text-orange-600" />}
              color="bg-orange-50"
            />
          </div>
        )}
      </section>

      {/* ── Kasbon ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
          <CreditCard size={18} className="text-red-500" /> Kasbon
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Kasbon Aktif"
            value={kasbonAktif.length.toString()}
            icon={<CreditCard size={20} className="text-red-600" />}
            color="bg-red-50"
          />
          <SummaryCard
            label="Total Kasbon Baru"
            value={kasbonBaru.length.toString()}
            icon={<CreditCard size={20} className="text-orange-600" />}
            color="bg-orange-50"
          />
          <SummaryCard
            label="Total Cicilan (periode ini)"
            value={fmt(totalCicilan)}
            icon={<DollarSign size={20} className="text-yellow-600" />}
            color="bg-yellow-50"
          />
          <SummaryCard
            label="Saldo Tersisa"
            value={fmt(sisaKasbon)}
            icon={<DollarSign size={20} className="text-purple-600" />}
            color="bg-purple-50"
          />
        </div>
      </section>
    </div>
  );
}
