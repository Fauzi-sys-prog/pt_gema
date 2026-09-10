import { useState, useMemo } from 'react';
import { Users, Clock, CalendarOff, AlertTriangle, LogIn, LogOut, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp, type Employee, type Attendance, type Leave, type ShiftSchedule } from '../../contexts/AppContext';

type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Check Out' | 'Cuti' | 'Sakit' | 'Izin' | 'Belum Check In';

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  'Hadir': 'bg-green-100 text-green-700',
  'Terlambat': 'bg-yellow-100 text-yellow-700',
  'Check Out': 'bg-blue-100 text-blue-700',
  'Cuti': 'bg-purple-100 text-purple-700',
  'Sakit': 'bg-red-100 text-red-700',
  'Izin': 'bg-orange-100 text-orange-700',
  'Belum Check In': 'bg-gray-100 text-gray-500',
};

function generateId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowTimeString(): string {
  return new Date().toTimeString().slice(0, 5);
}

function nowISOTime(): string {
  return new Date().toISOString();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcWorkHours(checkIn: string, checkOut: string): number {
  const inMin = timeToMinutes(checkIn.length === 5 ? checkIn : new Date(checkIn).toTimeString().slice(0, 5));
  const outMin = timeToMinutes(checkOut.length === 5 ? checkOut : new Date(checkOut).toTimeString().slice(0, 5));
  return Math.max(0, (outMin - inMin) / 60);
}

function formatTime(timeStr: string | undefined): string {
  if (!timeStr) return '-';
  return timeStr.includes('T') ? new Date(timeStr).toTimeString().slice(0, 5) : timeStr.slice(0, 5);
}

function calcDuration(checkIn: string | undefined, checkOut: string | undefined): string {
  if (!checkIn || !checkOut) return '-';
  const parse = (s: string) => {
    if (s.includes('T')) return new Date(s).getTime();
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const inVal = parse(checkIn);
  const outVal = parse(checkOut);
  if (checkIn.includes('T') && checkOut.includes('T')) {
    const diffMin = Math.round((outVal - inVal) / 60000);
    if (diffMin < 0) return '-';
    return `${Math.floor(diffMin / 60)}j ${diffMin % 60}m`;
  }
  const diffMin = outVal - inVal;
  if (diffMin < 0) return '-';
  return `${Math.floor(diffMin / 60)}j ${diffMin % 60}m`;
}

interface EmployeeAttendanceRow {
  employee: Employee;
  attendance: Attendance | undefined;
  leave: Leave | undefined;
  shift: ShiftSchedule | undefined;
  displayStatus: AttendanceStatus;
}

function MessageBanner({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
      msg.type === 'success'
        ? 'bg-green-50 border border-green-200 text-green-700'
        : 'bg-red-50 border border-red-200 text-red-700'
    }`}>
      {msg.type === 'success'
        ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      {msg.text}
    </div>
  );
}

export default function AttendanceTodayPage() {
  const {
    employeeList, attendanceList, leaveList, shiftScheduleList,
    addAttendance, updateAttendance, payrollPolicy,
  } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = today.split('-').reverse().join('/');

  // Check In state
  const [ciEmployee, setCiEmployee] = useState('');
  const [ciDate, setCiDate] = useState(today);
  const [ciMessage, setCiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check Out state
  const [coEmployee, setCoEmployee] = useState('');
  const [coDate, setCoDate] = useState(today);
  const [coMessage, setCoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Absen Lembur state
  const [olEmployee, setOlEmployee] = useState('');
  const [olDate, setOlDate] = useState(today);
  const [olHours, setOlHours] = useState('');
  const [olMinutes, setOlMinutes] = useState('');
  const [olMessage, setOlMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeEmployees = useMemo(() => employeeList.filter(e => e.status === 'Active'), [employeeList]);

  const rows: EmployeeAttendanceRow[] = useMemo(() => {
    return activeEmployees.map(emp => {
      const attendance = attendanceList.find(a => a.employeeId === emp.id && a.date === today);
      const leave = leaveList.find(
        l => l.employeeId === emp.id && l.status === 'Approved' && l.startDate <= today && l.endDate >= today
      );
      const shift = shiftScheduleList.find(s => s.employeeId === emp.id && s.date === today);

      let displayStatus: AttendanceStatus = 'Belum Check In';
      if (leave) {
        const t = leave.leaveType;
        displayStatus = t === 'Sick' ? 'Sakit' : t === 'Permission' ? 'Izin' : 'Cuti';
      } else if (attendance?.checkIn) {
        if (attendance.checkOut) displayStatus = 'Check Out';
        else if (attendance.status === 'Late') displayStatus = 'Terlambat';
        else displayStatus = 'Hadir';
      }

      return { employee: emp, attendance, leave, shift, displayStatus };
    });
  }, [employeeList, attendanceList, leaveList, shiftScheduleList, today]);

  const kpiHadir = rows.filter(r => r.displayStatus === 'Hadir' || r.displayStatus === 'Check Out').length;
  const kpiTerlambat = rows.filter(r => r.displayStatus === 'Terlambat').length;
  const kpiBelum = rows.filter(r => r.displayStatus === 'Belum Check In').length;
  const kpiCuti = rows.filter(r => ['Cuti', 'Sakit', 'Izin'].includes(r.displayStatus)).length;

  function handleCheckIn() {
    setCiMessage(null);
    if (!ciEmployee) { setCiMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu' }); return; }
    const existing = attendanceList.find(a => a.employeeId === ciEmployee && a.date === ciDate);
    if (existing?.checkIn) { setCiMessage({ type: 'error', text: 'Karyawan sudah check in hari ini' }); return; }
    const employee = employeeList.find(e => e.id === ciEmployee);
    if (!employee) return;

    const currentTime = nowTimeString();
    const shift = shiftScheduleList.find(s => s.employeeId === ciEmployee && s.date === ciDate);
    let status: Attendance['status'] = 'Present';
    if (shift && timeToMinutes(currentTime) > timeToMinutes(shift.startTime) + 15) status = 'Late';

    if (existing) {
      updateAttendance(existing.id, { checkIn: nowISOTime(), status });
    } else {
      addAttendance({ id: generateId(), employeeId: ciEmployee, employeeName: employee.name, date: ciDate, checkIn: nowISOTime(), status });
    }
    setCiMessage({ type: 'success', text: `Check in berhasil — ${employee.name} pukul ${currentTime}` });
    setCiEmployee('');
  }

  function handleCheckOut() {
    setCoMessage(null);
    if (!coEmployee) { setCoMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu' }); return; }
    const existing = attendanceList.find(a => a.employeeId === coEmployee && a.date === coDate);
    if (!existing?.checkIn) { setCoMessage({ type: 'error', text: 'Karyawan belum check in' }); return; }
    if (existing.checkOut) { setCoMessage({ type: 'error', text: 'Karyawan sudah check out hari ini' }); return; }

    const currentTime = nowISOTime();
    const checkInTime = existing.checkIn.includes('T') ? new Date(existing.checkIn).toTimeString().slice(0, 5) : existing.checkIn.slice(0, 5);
    const checkOutTime = new Date(currentTime).toTimeString().slice(0, 5);
    const workHours = calcWorkHours(checkInTime, checkOutTime);
    const overtimeHours = Math.max(0, workHours - (payrollPolicy?.standardWorkHours ?? 8));

    updateAttendance(existing.id, { checkOut: currentTime, workHours, overtime: overtimeHours > 0 ? overtimeHours : undefined });

    const employee = employeeList.find(e => e.id === coEmployee);
    setCoMessage({ type: 'success', text: `Check out berhasil — ${employee?.name ?? coEmployee} pukul ${checkOutTime}. Durasi: ${workHours.toFixed(1)} jam${overtimeHours > 0 ? `, lembur ${overtimeHours.toFixed(1)} jam` : ''}` });
    setCoEmployee('');
  }

  function handleOvertimeSubmit() {
    setOlMessage(null);
    if (!olEmployee) { setOlMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu' }); return; }
    const hoursPart = Number(olHours || 0);
    const minutesPart = Number(olMinutes || 0);
    if (!Number.isInteger(hoursPart) || hoursPart < 0 || !Number.isInteger(minutesPart) || minutesPart < 0 || minutesPart > 59 || (hoursPart === 0 && minutesPart === 0)) {
      setOlMessage({ type: 'error', text: 'Masukkan durasi lembur yang valid (menit 0–59)' }); return;
    }
    const hours = hoursPart + minutesPart / 60;
    const existing = attendanceList.find(a => a.employeeId === olEmployee && a.date === olDate);
    const employee = employeeList.find(e => e.id === olEmployee);
    if (!employee) return;
    if (existing) {
      updateAttendance(existing.id, { overtime: hours });
    } else {
      addAttendance({ id: generateId(), employeeId: olEmployee, employeeName: employee.name, date: olDate, status: 'Present', overtime: hours });
    }
    setOlMessage({ type: 'success', text: `Lembur ${employee.name} — ${hoursPart} jam ${minutesPart} menit tercatat` });
    setOlEmployee('');
    setOlHours('');
    setOlMinutes('');
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Kehadiran Hari Ini</h1>
        <p className="text-sm text-gray-500 mt-1">{todayFormatted}</p>
      </div>

      {/* Check In / Check Out Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Check In */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogIn className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-700">Check In</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
              <select
                value={ciEmployee}
                onChange={e => { setCiEmployee(e.target.value); setCiMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
              <input type="date" value={ciDate} onChange={e => { setCiDate(e.target.value); setCiMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <MessageBanner msg={ciMessage} />
            <button onClick={handleCheckIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <LogIn className="w-4 h-4" /> Check In Sekarang
            </button>
          </div>
        </div>

        {/* Check Out */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogOut className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-700">Check Out</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
              <select
                value={coEmployee}
                onChange={e => { setCoEmployee(e.target.value); setCoMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
              <input type="date" value={coDate} onChange={e => { setCoDate(e.target.value); setCoMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <MessageBanner msg={coMessage} />
            <button onClick={handleCheckOut}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" /> Check Out Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Absen Lembur */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-gray-700 text-sm">Input Lembur</h2>
          <span className="text-xs text-gray-400 ml-1">— jam lembur akan dipakai saat proses payroll</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
            <select
              value={olEmployee}
              onChange={e => { setOlEmployee(e.target.value); setOlMessage(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">-- Pilih Karyawan --</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
            <input type="date" value={olDate} onChange={e => { setOlDate(e.target.value); setOlMessage(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jam</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="2"
              value={olHours}
              onChange={e => { setOlHours(e.target.value); setOlMessage(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Menit</label>
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              placeholder="30"
              value={olMinutes}
              onChange={e => { setOlMinutes(e.target.value); setOlMessage(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button onClick={handleOvertimeSubmit}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">
            <Clock className="w-4 h-4" /> Simpan Lembur
          </button>
        </div>
        {olMessage && (
          <div className="mt-3">
            <MessageBanner msg={olMessage} />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Hadir</span>
            <Users className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-800">{kpiHadir}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Belum Check In</span>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-800">{kpiBelum}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Cuti / Sakit / Izin</span>
            <CalendarOff className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-800">{kpiCuti}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Terlambat</span>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-gray-800">{kpiTerlambat}</p>
        </div>
      </div>

      {/* Status Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Daftar Kehadiran — {todayFormatted}</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">No. Karyawan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Jabatan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Check In</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Check Out</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Durasi</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Lembur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Belum ada data karyawan aktif</td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.employee.name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.employee.employeeId}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.employee.position}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(row.attendance?.checkIn)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(row.attendance?.checkOut)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {calcDuration(row.attendance?.checkIn, row.attendance?.checkOut)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.attendance?.overtime
                      ? <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">{row.attendance.overtime} jam</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${STATUS_BADGE[row.displayStatus]}`}>
                      {row.displayStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
