import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, ChevronLeft, Eye, CheckCircle, DollarSign, Lock, AlertTriangle, Search, ChevronRight, Trash2, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp, type PayrollRun, type PayrollSlip } from '../../contexts/AppContext';
import { exportEmployeePayrollSlips } from '../../utils/payrollSlipExcelExport';

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'BTN'];

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const fmtDate = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700',
    Calculated: 'bg-blue-100 text-blue-700',
    Reviewed: 'bg-yellow-100 text-yellow-700',
    Approved: 'bg-indigo-100 text-indigo-700',
    Disbursed: 'bg-green-100 text-green-700',
    Closed: 'bg-slate-100 text-slate-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

const PAGE_SIZE = 20;

export default function PayrollProPage() {
  const navigate = useNavigate();
  const {
    payrollRunList, addPayrollRun, updatePayrollRun, disbursePayrollRun, deletePayrollRun, clearAllPayrollRuns,
    employeeList, attendanceList, leaveList, overtimeList, shiftScheduleList,
    employeeCompensations, payrollPolicy,
    employeeAdvanceList, updateEmployeeAdvance,
    koperasiMembers, koperasiPinjamanList,
  } = useApp();

  const [tab, setTab] = useState<'runs' | 'history'>('runs');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Payroll run filters (tanggal proses/gajian)
  const [runMonth, setRunMonth] = useState('');
  const [runYear, setRunYear] = useState('');
  const [runDateFrom, setRunDateFrom] = useState('');
  const [runDateTo, setRunDateTo] = useState('');
  const [runDateSort, setRunDateSort] = useState<'nearest' | 'farthest'>('nearest');

  const now = new Date();
  const [createMonth, setCreateMonth] = useState(now.getMonth() + 1);
  const [createYear, setCreateYear] = useState(now.getFullYear());
  const [createBank, setCreateBank] = useState('BCA');
  const [payrollScope, setPayrollScope] = useState<'single' | 'all'>('single');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [periodEnd, setPeriodEnd] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);

  // History filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [histPage, setHistPage] = useState(1);

  const selectedRun = payrollRunList.find(r => r.id === selectedRunId) ?? null;

  // ── helpers ──────────────────────────────────────────────────────────────
  const payrollEmployees = useMemo(
    () => employeeList.filter(e => e.status === 'Active' && e.employmentType !== 'THL'),
    [employeeList]
  );

  function buildSlips(period: string, startDate: string, endDate: string, employeeIds?: string[]): PayrollSlip[] {
    // Payroll karyawan tetap/kontrak dipisahkan dari payroll THL.
    const activeEmps = employeeIds?.length
      ? payrollEmployees.filter(e => employeeIds.includes(e.id))
      : payrollEmployees;
    const standardDays = payrollPolicy?.standardWorkDays ?? 25;

    return activeEmps.map(emp => {
      const comp = employeeCompensations.find(c => c.employeeId === emp.id);
      const baseSalary = comp?.baseSalary ?? emp.salary ?? 0;
      const transportAllowance = comp?.transportAllowance ?? 0;
      const maximumIncentive = comp?.maximumIncentive ?? 0;
      const positionAllowance = comp?.positionAllowance ?? 0;

      const inPeriod = (date: string) => date >= startDate && date <= endDate;
      const attendanceRecords = attendanceList.filter(a => inPeriod(a.date) && a.employeeId === emp.id);
      const attendanceDays = attendanceRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
      const lateMinutes = attendanceRecords.reduce((s, a) => {
        if (a.status === 'Late' && a.checkIn) {
          const timePart = a.checkIn.includes('T') ? a.checkIn.split('T')[1].substring(0, 5) : a.checkIn.substring(0, 5);
          const [h, m] = timePart.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return s;
          const schedule = shiftScheduleList.find(ss => ss.employeeId === emp.id && ss.date === a.date);
          const expected = schedule?.startTime ?? '08:00';
          const [eh, em] = expected.split(':').map(Number);
          return s + Math.max(0, (h * 60 + m) - (eh * 60 + em));
        }
        return s;
      }, 0);
      // Lembur dari approved overtime requests periode ini
      const approvedOvertimes = overtimeList.filter(
        r => r.employeeId === emp.id && r.status === 'Approved' && inPeriod(r.date)
      );
      const overtimeHours = approvedOvertimes.reduce((s, r) => s + r.hours, 0);
      const overtimeReferences = Array.from(new Set(approvedOvertimes.map(r => r.nomorSPK).filter(Boolean))) as string[];
      const overtimePay = overtimeHours * (comp?.overtimeRate ?? 0) * (payrollPolicy?.overtimeRateMultiplier ?? 1);
      const mealAllowance = attendanceDays * (comp?.mealAllowancePerDay || payrollPolicy?.mealAllowancePerDay || 25000);

      // Approved cuti di periode ini — hari yang di-cover cuti tidak kena potongan insentif
      const approvedLeaveDates = new Set(
        leaveList
          .filter(l => l.employeeId === emp.id && l.status === 'Approved' && l.leaveType === 'Annual')
          .flatMap(l => {
            const dates: string[] = [];
            const cur = new Date(l.startDate);
            const end = new Date(l.endDate);
            while (cur <= end) {
              dates.push(cur.toISOString().split('T')[0]);
              cur.setDate(cur.getDate() + 1);
            }
            return dates;
          })
          .filter(inPeriod)
      );

      const holidayDates = new Set((payrollPolicy?.holidayDates ?? []).filter(inPeriod));

      // Insentif dipotong per hari tidak masuk: Alpha + Izin + Sakit
      // Hari yang sudah di-cover approved cuti dikecualikan
      const alphaDays = attendanceRecords.filter(a => a.status === 'Absent' && !approvedLeaveDates.has(a.date) && !holidayDates.has(a.date)).length;
      const permissionDays = attendanceRecords.filter(a => a.status === 'Permission' && !approvedLeaveDates.has(a.date) && !holidayDates.has(a.date)).length;
      const sickDays = attendanceRecords.filter(a => a.status === 'Sick' && !approvedLeaveDates.has(a.date) && !holidayDates.has(a.date)).length;
      const leaveDays = approvedLeaveDates.size;
      const holidayDays = holidayDates.size;
      const absentRecords = alphaDays + permissionDays + sickDays;
      const deductionPctPerDay = payrollPolicy?.incentiveDeductionPerAbsencePercent ?? 25;
      const insentifRatePerDay = maximumIncentive * deductionPctPerDay / 100;
      const incentiveDeductionAmount = Math.min(maximumIncentive, absentRecords * insentifRatePerDay);

      // Pakai nominal IDR dari master karyawan kalau sudah diisi, fallback ke persentase global
      const legacyBpjsKetEmployeeAmount = (comp?.bpjsKetEmployeePct ?? 0) > 100 ? comp?.bpjsKetEmployeePct ?? 0 : 0;
      const legacyBpjsKesEmployeeAmount = (comp?.bpjsKesEmployeePct ?? 0) > 100 ? comp?.bpjsKesEmployeePct ?? 0 : 0;
      const legacyBpjsKetEmployerAmount = (comp?.bpjsKetEmployerPct ?? 0) > 100 ? comp?.bpjsKetEmployerPct ?? 0 : 0;
      const bpjsKetEmployee = ((comp?.bpjsKetEmployeeAmount ?? legacyBpjsKetEmployeeAmount) > 0)
        ? (comp?.bpjsKetEmployeeAmount ?? legacyBpjsKetEmployeeAmount)
        : baseSalary * ((payrollPolicy?.bpjsJHTEmployee ?? 2) + (payrollPolicy?.bpjsJPEmployee ?? 1)) / 100;
      const bpjsKesEmployee = ((comp?.bpjsKesEmployeeAmount ?? legacyBpjsKesEmployeeAmount) > 0)
        ? (comp?.bpjsKesEmployeeAmount ?? legacyBpjsKesEmployeeAmount)
        : baseSalary * (payrollPolicy?.bpjsKesEmployee ?? 1) / 100;
      const bpjsKetEmployer = ((comp?.bpjsKetEmployerAmount ?? legacyBpjsKetEmployerAmount) > 0)
        ? (comp?.bpjsKetEmployerAmount ?? legacyBpjsKetEmployerAmount)
        : baseSalary * ((payrollPolicy?.bpjsJHTEmployer ?? 3.7) + (payrollPolicy?.bpjsJPEmployer ?? 2) + (payrollPolicy?.bpjsJKKEmployer ?? 0.24) + (payrollPolicy?.bpjsJKMEmployer ?? 0.3)) / 100;
      const bpjsKesEmployer = baseSalary * (payrollPolicy?.bpjsKesEmployer ?? 4) / 100;

      // Satu cicilan kasbon terdiri dari pokok + biaya admin. Keduanya disimpan
      // terpisah supaya total Payroll Pro sama persis dengan Slip Gaji.
      const kasbonDetails = employeeAdvanceList
        .filter(a => a.employeeId === emp.id && ['Disbursed', 'Partially Deducted'].includes(a.status) && a.lastDeductionPeriod !== period)
        .map(a => {
          const installment = Math.min(a.installmentAmount || a.remainingBalanceAfter, a.remainingBalanceAfter);
          const rate = Math.max(0, a.adminFeePercent ?? 0) / 100;
          const principal = rate > 0 ? Math.round(installment / (1 + rate)) : installment;
          const admin = Math.max(0, installment - principal);
          return { advanceId: a.id, advanceNumber: a.advanceNumber, installmentNumber: (a.paidInstallments ?? 0) + 1, principal, admin, remainingAfter: Math.max(0, a.remainingBalanceAfter - installment) };
        });
      const kasbonDeduction = kasbonDetails.reduce((sum, row) => sum + row.principal, 0);
      const kasbonAdminFee = kasbonDetails.reduce((sum, row) => sum + row.admin, 0);

      const pph21 = comp?.pph21Amount ?? 0;
      const koperasiMember = koperasiMembers.find(member => member.employeeId === emp.id && member.status === 'Active');
      const koperasiLoans = koperasiMember ? koperasiPinjamanList.filter(loan => loan.memberId === koperasiMember.id && loan.status === 'Active') : [];
      const koperasiLoanDetails = koperasiLoans.map(loan => ({ loanId: loan.id, pinjamanNo: loan.pinjamanNo, installmentNumber: loan.paidInstallments + 1, installmentAmount: loan.installmentAmount, remainingAfter: Math.max(0, loan.totalAmount - ((loan.paidInstallments + 1) * loan.installmentAmount)) }));
      const koperasiLoanDeduction = koperasiLoanDetails.reduce((sum, row) => sum + row.installmentAmount, 0);
      const koperasiMandatorySavingDeduction = koperasiMember?.simpananWajibBulanan ?? 0;
      const koperasiDeduction = koperasiLoanDeduction + koperasiMandatorySavingDeduction;
      // JPK mengikuti format slip perusahaan: dicatat sebagai tunjangan lalu
      // dipotong kembali pada periode yang sama.
      const jpkAllowance = bpjsKetEmployer;
      const grossIncome = baseSalary + transportAllowance + mealAllowance + maximumIncentive + positionAllowance + overtimePay + jpkAllowance;
      const totalDeductions = kasbonDeduction + kasbonAdminFee + jpkAllowance + bpjsKetEmployee + bpjsKesEmployee + incentiveDeductionAmount + pph21 + koperasiDeduction;
      const takeHomePay = grossIncome - totalDeductions;

      return {
        employeeId: emp.id, employeeName: emp.name, employeeNumber: emp.employeeId,
        position: emp.position, department: emp.department, period, payrollRunId: '',
        baseSalary, transportAllowance, mealAllowance, maximumIncentive,
        positionAllowance, overtimePay, bonus: 0, otherIncome: 0, grossIncome,
        kasbonDeduction, bpjsKetEmployee, bpjsKesEmployee, pph21,
        incentiveDeductionAmount, absenceDeduction: 0, otherDeductions: 0, koperasiDeduction, koperasiLoanDeduction, koperasiMandatorySavingDeduction, koperasiLoanDetails, kasbonDetails, kasbonAdminFee, jpkAllowance, cutiAllowance: 0, totalDeductions,
        takeHomePay, attendanceDays, standardDays, lateMinutes, overtimeHours, overtimeReferences,
        insentifRatePerDay, alphaDays, permissionDays, sickDays, leaveDays, holidayDays,
        bpjsKetEmployer, bpjsKesEmployer,
        status: 'Calculated' as const,
        policySnapshot: payrollPolicy ?? undefined,
      } satisfies PayrollSlip;
    });
  }

  function handleHitungPayroll() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const mm = String(createMonth).padStart(2, '0');
      const period = `${createYear}-${mm}`;
      const periodLabel = `${MONTH_NAMES[createMonth - 1]} ${createYear}`;
      if (!periodStart || !periodEnd || periodStart > periodEnd) { toast.error('Periode payroll tidak valid'); return; }
      if (payrollScope === 'single' && !selectedEmployeeId) { toast.error('Pilih karyawan terlebih dahulu'); return; }

      const alreadyProcessedIds = new Set(
        payrollRunList
          // Payroll Pro is monthly: custom date inputs must not allow a second
          // run for the same employee/month with a slightly different range.
          .filter(r => r.period === period || (r.periodStart === periodStart && r.periodEnd === periodEnd))
          .flatMap(r => r.slips.map(s => s.employeeId))
      );
      const requestedIds = payrollScope === 'single'
        ? [selectedEmployeeId]
        : payrollEmployees.map(e => e.id).filter(id => !alreadyProcessedIds.has(id));

      if (payrollScope === 'single' && alreadyProcessedIds.has(selectedEmployeeId)) {
        toast.error('Payroll karyawan ini untuk periode tersebut sudah dibuat');
        return;
      }
      if (requestedIds.length === 0) {
        toast.error('Semua karyawan aktif pada periode ini sudah diproses');
        return;
      }

      const slips = buildSlips(period, periodStart, periodEnd, requestedIds);
      if (slips.length === 0) { toast.error('Tidak ada karyawan yang dapat diproses'); return; }
      const runId = `RUN-${Date.now()}`;
      const runNumber = `PR-${createYear}${mm}-${String(payrollRunList.length + 1).padStart(3, '0')}`;
      const patchedSlips = slips.map(s => ({ ...s, payrollRunId: runId }));

      addPayrollRun({
        id: runId, runNumber, period, periodLabel,
        processedDate: new Date().toISOString(),
        totalGross: patchedSlips.reduce((s, sl) => s + sl.grossIncome, 0),
        totalDeductions: patchedSlips.reduce((s, sl) => s + sl.totalDeductions, 0),
        totalTHP: patchedSlips.reduce((s, sl) => s + sl.takeHomePay, 0),
        employeeCount: patchedSlips.length,
        status: 'Calculated',
        slips: patchedSlips,
        processedBy: 'Current User',
        bank: createBank,
        periodStart, periodEnd,
      } satisfies PayrollRun);

      setShowCreateForm(false);
      setSelectedEmployeeId('');
      setSelectedRunId(runId);
    } finally {
      setIsSubmitting(false);
    }
  }

  function hasMismatch(run: PayrollRun) {
    return run.slips.some(s => Math.abs((s.grossIncome - s.totalDeductions) - s.takeHomePay) > 0.01);
  }

  function handleExportPayroll(run: PayrollRun) {
    const exportRows = run.slips.map(slip => {
      const employee = employeeList.find(e => e.id === slip.employeeId);
      const records = attendanceList.filter(a => a.employeeId === slip.employeeId && (run.periodStart && run.periodEnd ? a.date >= run.periodStart && a.date <= run.periodEnd : a.date.startsWith(run.period)));
      const approvedLeaveDates = new Set(
        leaveList
          .filter(l => l.employeeId === slip.employeeId && l.status === 'Approved' && l.leaveType === 'Annual')
          .flatMap(l => {
            const dates: string[] = [];
            const current = new Date(l.startDate);
            const end = new Date(l.endDate);
            while (current <= end) {
              dates.push(current.toISOString().split('T')[0]);
              current.setDate(current.getDate() + 1);
            }
            return dates;
          })
          .filter(date => date.startsWith(run.period))
      );

      return {
        ...slip,
        employmentType: employee?.employmentType ?? 'Permanent',
        alpha: slip.alphaDays ?? records.filter(a => a.status === 'Absent').length,
        izin: slip.permissionDays ?? records.filter(a => a.status === 'Permission').length,
        sakit: slip.sickDays ?? records.filter(a => a.status === 'Sick').length,
        cuti: slip.leaveDays ?? approvedLeaveDates.size,
        liburNasional: slip.holidayDays ?? 0,
      };
    });

    const exportPeriod = run.periodStart && run.periodEnd ? `${fmtDate(run.periodStart)} - ${fmtDate(run.periodEnd)}` : run.periodLabel;
    void exportEmployeePayrollSlips(exportRows, exportPeriod);
  }

  // ── History data ─────────────────────────────────────────────────────────
  const allSlips = useMemo(() =>
    payrollRunList.flatMap(run =>
      run.slips.map(slip => ({
        runId: run.id, runNumber: run.runNumber, periodLabel: run.periodLabel,
        period: run.period, employeeId: slip.employeeId, employeeName: slip.employeeName,
        grossIncome: slip.grossIncome, totalDeductions: slip.totalDeductions,
        takeHomePay: slip.takeHomePay, status: slip.status, disbursedAt: slip.disbursedAt,
      }))
    ), [payrollRunList]
  );

  const histYears = useMemo(() => Array.from(new Set(allSlips.map(s => s.period.substring(0, 4)))).sort(), [allSlips]);

  const filteredSlips = useMemo(() => allSlips.filter(sl => {
    const matchName = sl.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const [slYear, slMonth] = sl.period.split('-');
    const matchMonth = filterMonth === '' || slMonth === filterMonth.padStart(2, '0');
    const matchYear = filterYear === '' || slYear === filterYear;
    return matchName && matchMonth && matchYear;
  }), [allSlips, searchTerm, filterMonth, filterYear]);

  const totalHistPages = Math.max(1, Math.ceil(filteredSlips.length / PAGE_SIZE));
  const histPageData = filteredSlips.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  const runYears = useMemo(() => Array.from(new Set(payrollRunList.map(r => r.period.substring(0, 4)))).sort(), [payrollRunList]);
  const filteredPayrollRuns = useMemo(() => payrollRunList
    .filter(run => {
      const [year, month] = run.period.split('-');
      const date = (run.processedDate || run.periodStart || '').substring(0, 10);
      return (!runMonth || month === runMonth.padStart(2, '0'))
        && (!runYear || year === runYear)
        && (!runDateFrom || date >= runDateFrom)
        && (!runDateTo || date <= runDateTo);
    })
    .sort((a, b) => {
      const da = new Date(a.processedDate || a.periodStart || 0).getTime();
      const db = new Date(b.processedDate || b.periodStart || 0).getTime();
      return runDateSort === 'nearest' ? da - db : db - da;
    }), [payrollRunList, runMonth, runYear, runDateFrom, runDateTo, runDateSort]);

  // Keep pagination valid when runs are deleted or filters change externally.
  useEffect(() => {
    setHistPage(page => Math.min(page, totalHistPages));
  }, [totalHistPages]);

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedRun) {
    const mismatch = hasMismatch(selectedRun);
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedRunId(null)} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{selectedRun.runNumber}</h1>
            <p className="text-sm text-gray-500">{selectedRun.periodLabel}</p>
          </div>
          <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(selectedRun.status)}`}>
            {selectedRun.status}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleExportPayroll(selectedRun)}
              className="flex items-center gap-2 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100"
            >
              <Download size={16} /> Export Excel
            </button>
            <button
              disabled={mismatch || selectedRun.status !== 'Calculated' || isProcessingAction}
              onClick={() => {
                if (isProcessingAction) return;
                setIsProcessingAction(true);
                try {
                  updatePayrollRun(selectedRun.id, { status: 'Approved', approvedAt: new Date().toISOString(), approvedBy: 'Current User' });
                } finally {
                  setIsProcessingAction(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700"
            >
              <CheckCircle size={16} /> Approve
            </button>
            <button
              disabled={mismatch || selectedRun.status !== 'Approved' || isProcessingAction}
              onClick={async () => {
                if (isProcessingAction) return;
                setIsProcessingAction(true);
                const ts = new Date().toISOString();
                try {
                  await disbursePayrollRun(selectedRun.id, { status: 'Disbursed', disbursedAt: ts, slips: selectedRun.slips.map(s => ({ ...s, disbursedAt: ts, status: 'Disbursed' as const })) });
                  toast.success('Payroll dicairkan dan potongan koperasi diposting');
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Pencairan payroll gagal');
                } finally {
                  setIsProcessingAction(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700"
            >
              <DollarSign size={16} /> Disburse
            </button>
            <button
              disabled={selectedRun.status !== 'Disbursed' || isProcessingAction}
              onClick={() => {
                if (isProcessingAction) return;
                setIsProcessingAction(true);
                try {
                  updatePayrollRun(selectedRun.id, { status: 'Closed', closedAt: new Date().toISOString() });
                } finally {
                  setIsProcessingAction(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <Lock size={16} /> Close
            </button>
          </div>
        </div>

        {mismatch && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">Payroll Calculation Mismatch — Approve / Disburse / Close dinonaktifkan</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Karyawan', value: selectedRun.employeeCount.toString() },
            { label: 'Total Gross', value: fmt(selectedRun.totalGross) },
            { label: 'Total THP', value: fmt(selectedRun.totalTHP) },
            { label: 'Diproses', value: fmtDate(selectedRun.processedDate) },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nama', 'Gross Income', 'Total Potongan', 'THP', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedRun.slips.map(slip => (
                  <tr key={slip.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{slip.employeeName}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(slip.grossIncome)}</td>
                    <td className="px-4 py-3 text-red-600">{fmt(slip.totalDeductions)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(slip.takeHomePay)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(slip.status)}`}>{slip.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/hr/payroll-slip/${selectedRun.id}/${slip.employeeId}`)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        <Eye size={14} /> Lihat Slip
                      </button>
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

  // ── Main view (tabs) ──────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Proses penggajian & riwayat slip karyawan</p>
        </div>
        {tab === 'runs' && (
          <div className="flex items-center gap-2">
            {payrollRunList.length > 0 && (
              <button
                onClick={() => {
                  if (payrollRunList.some(run => ['Disbursed', 'Closed'].includes(run.status))) {
                    toast.error('Payroll Disbursed/Closed tidak boleh dihapus');
                    return;
                  }
                  if (confirm('Hapus semua payroll run? Tindakan ini tidak dapat dibatalkan.')) {
                    clearAllPayrollRuns();
                    setSelectedRunId(null);
                    toast.success('Semua payroll run berhasil dihapus');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                <Trash2 size={16} /> Hapus Semua
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Buat Payroll
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('runs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'runs' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Payroll Runs
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Riwayat Slip Gaji
        </button>
      </div>

      {/* ── Tab: Payroll Runs ── */}
      {tab === 'runs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-200 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500">Filter tanggal gajian:</span>
            <select value={runMonth} onChange={e => setRunMonth(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Semua Bulan</option>
              {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={runYear} onChange={e => setRunYear(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Semua Tahun</option>
              {runYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input type="date" value={runDateFrom} onChange={e => setRunDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" aria-label="Tanggal mulai" />
            <span className="text-xs text-gray-400">s/d</span>
            <input type="date" value={runDateTo} onChange={e => setRunDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" aria-label="Tanggal akhir" />
            <select value={runDateSort} onChange={e => setRunDateSort(e.target.value as 'nearest' | 'farthest')} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="nearest">Tanggal terdekat</option>
              <option value="farthest">Tanggal terjauh</option>
            </select>
            {(runMonth || runYear || runDateFrom || runDateTo) && <button onClick={() => { setRunMonth(''); setRunYear(''); setRunDateFrom(''); setRunDateTo(''); }} className="text-xs text-blue-600 hover:underline">Reset</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nomor Run', 'Periode', 'Jumlah Karyawan', 'Total Gross', 'Total THP', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayrollRuns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                      Belum ada payroll run. Klik "Buat Payroll" untuk memulai.
                    </td>
                  </tr>
                )}
                {filteredPayrollRuns.map(run => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{run.runNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{run.periodLabel}</td>
                    <td className="px-4 py-3 text-center">{run.employeeCount}</td>
                    <td className="px-4 py-3">{fmt(run.totalGross)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(run.totalTHP)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(run.status)}`}>{run.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedRunId(run.id)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <Eye size={14} /> Lihat Detail
                        </button>
                        <button
                          onClick={() => {
                            if (['Disbursed', 'Closed'].includes(run.status)) {
                              toast.error('Payroll yang sudah dicairkan/ditutup tidak boleh dihapus');
                              return;
                            }
                            if (confirm(`Hapus payroll run ${run.runNumber}?`)) {
                              deletePayrollRun(run.id);
                              if (selectedRunId === run.id) setSelectedRunId(null);
                              toast.success(`${run.runNumber} berhasil dihapus`);
                            }
                          }}
                          disabled={['Disbursed', 'Closed'].includes(run.status)}
                          className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={['Disbursed', 'Closed'].includes(run.status) ? 'Payroll final tidak dapat dihapus' : 'Hapus run ini'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Riwayat Slip ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Cari nama karyawan..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setHistPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setHistPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="">Semua Bulan</option>
              {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setHistPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="">Semua Tahun</option>
              {histYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

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
                  {histPageData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">Tidak ada data ditemukan.</td>
                    </tr>
                  )}
                  {histPageData.map((sl, idx) => (
                    <tr key={`${sl.runId}-${sl.employeeId}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{sl.periodLabel}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{sl.runNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{sl.employeeName}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(sl.grossIncome)}</td>
                      <td className="px-4 py-3 text-red-600">{fmt(sl.totalDeductions)}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmt(sl.takeHomePay)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(sl.status ?? '')}`}>{sl.status}</span>
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
            {totalHistPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">{filteredSlips.length} data — Halaman {histPage} dari {totalHistPages}</p>
                <div className="flex gap-2">
                  <button disabled={histPage === 1} onClick={() => setHistPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronLeft size={16} />
                  </button>
                  <button disabled={histPage === totalHistPages} onClick={() => setHistPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800">Buat Payroll Baru</h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Bulan</label>
                <select value={createMonth} onChange={e => { const m = Number(e.target.value); setCreateMonth(m); setPeriodStart(`${createYear}-${String(m).padStart(2, '0')}-01`); setPeriodEnd(new Date(createYear, m, 0).toISOString().split('T')[0]); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tahun</label>
                <select value={createYear} onChange={e => { const y = Number(e.target.value); setCreateYear(y); setPeriodStart(`${y}-${String(createMonth).padStart(2, '0')}-01`); setPeriodEnd(new Date(y, createMonth, 0).toISOString().split('T')[0]); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tanggal Mulai</label><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tanggal Selesai</label><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Cara Proses Payroll</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setPayrollScope('single')}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${payrollScope === 'single' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Satu Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setPayrollScope('all')}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${payrollScope === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Semua Karyawan
                </button>
              </div>
            </div>
            {payrollScope === 'single' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Karyawan</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">— Pilih Karyawan —</option>
                  {payrollEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employeeId} — {emp.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bank Pembayaran</label>
              <select value={createBank} onChange={e => setCreateBank(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <p className="text-sm text-gray-500">
              Akan menghitung payroll untuk{' '}
              <strong>
                {payrollScope === 'single'
                  ? (payrollEmployees.find(e => e.id === selectedEmployeeId)?.name || 'karyawan yang dipilih')
                  : `${payrollEmployees.length} karyawan aktif`}
              </strong>{' '}
              periode <strong>{MONTH_NAMES[createMonth - 1]} {createYear}</strong>.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleHitungPayroll} disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Memproses...' : 'Hitung Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
