import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, LogOut, Info, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp, type Employee, type Attendance } from '../../contexts/AppContext';

function generateId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowTimeString(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 5); // HH:MM
}

function nowISOTime(): string {
  return new Date().toISOString();
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatTime(timeStr: string | undefined): string {
  if (!timeStr) return '-';
  if (timeStr.includes('T')) return new Date(timeStr).toTimeString().slice(0, 5);
  return timeStr.slice(0, 5);
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

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function CheckInOutPage() {
  const navigate = useNavigate();
  const {
    employeeList,
    attendanceList,
    addAttendance,
    updateAttendance,
    shiftScheduleList,
    payrollPolicy,
  } = useApp();

  const today = new Date().toISOString().split('T')[0];

  // Check In state
  const [ciEmployee, setCiEmployee] = useState('');
  const [ciDate, setCiDate] = useState(today);
  const [ciMessage, setCiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check Out state
  const [coEmployee, setCoEmployee] = useState('');
  const [coDate, setCoDate] = useState(today);
  const [coMessage, setCoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeEmployees = useMemo(
    () => employeeList.filter(e => e.status === 'Active'),
    [employeeList]
  );

  const todayRecords = useMemo(
    () => attendanceList.filter(a => a.date === today),
    [attendanceList, today]
  );

  function getEmployeeName(id: string): string {
    return employeeList.find(e => e.id === id)?.name ?? id;
  }

  function handleCheckIn() {
    setCiMessage(null);
    if (!ciEmployee) {
      setCiMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu' });
      return;
    }

    const existing = attendanceList.find(
      a => a.employeeId === ciEmployee && a.date === ciDate
    );

    if (existing?.checkIn) {
      setCiMessage({ type: 'error', text: 'Karyawan sudah check in hari ini' });
      return;
    }

    const employee = employeeList.find(e => e.id === ciEmployee);
    if (!employee) return;

    const currentTime = nowTimeString();
    const shift = shiftScheduleList.find(
      s => s.employeeId === ciEmployee && s.date === ciDate
    );

    let status: Attendance['status'] = 'Present';
    if (shift) {
      const scheduledMin = timeToMinutes(shift.startTime);
      const actualMin = timeToMinutes(currentTime);
      if (actualMin > scheduledMin + 15) {
        status = 'Late';
      }
    }

    if (existing) {
      updateAttendance(existing.id, { checkIn: nowISOTime(), status });
    } else {
      const newRecord: Attendance = {
        id: generateId(),
        employeeId: ciEmployee,
        employeeName: employee.name,
        date: ciDate,
        checkIn: nowISOTime(),
        status,
      };
      addAttendance(newRecord);
    }

    setCiMessage({ type: 'success', text: `Check in berhasil untuk ${employee.name} pukul ${currentTime}` });
    setCiEmployee('');
  }

  function handleCheckOut() {
    setCoMessage(null);
    if (!coEmployee) {
      setCoMessage({ type: 'error', text: 'Pilih karyawan terlebih dahulu' });
      return;
    }

    const existing = attendanceList.find(
      a => a.employeeId === coEmployee && a.date === coDate
    );

    if (!existing || !existing.checkIn) {
      setCoMessage({ type: 'error', text: 'Karyawan belum check in' });
      return;
    }

    if (existing.checkOut) {
      setCoMessage({ type: 'error', text: 'Karyawan sudah check out hari ini' });
      return;
    }

    const currentTime = nowISOTime();
    const checkInTime = existing.checkIn.includes('T')
      ? new Date(existing.checkIn).toTimeString().slice(0, 5)
      : existing.checkIn.slice(0, 5);
    const checkOutTime = new Date(currentTime).toTimeString().slice(0, 5);

    const workHours = calcWorkHours(checkInTime, checkOutTime);
    const standardHours = payrollPolicy?.standardWorkHours ?? 8;
    const overtimeHours = Math.max(0, workHours - standardHours);

    updateAttendance(existing.id, {
      checkOut: currentTime,
      workHours,
      overtime: overtimeHours > 0 ? overtimeHours : undefined,
    });

    const employee = employeeList.find(e => e.id === coEmployee);
    setCoMessage({
      type: 'success',
      text: `Check out berhasil untuk ${employee?.name ?? coEmployee} pukul ${checkOutTime}. Durasi: ${workHours.toFixed(1)} jam${overtimeHours > 0 ? `, lembur ${overtimeHours.toFixed(1)} jam` : ''}`,
    });
    setCoEmployee('');
  }

  const todayDisplayRecords = useMemo(() => {
    return todayRecords
      .map(r => {
        const emp = employeeList.find(e => e.id === r.employeeId);
        return { ...r, empName: emp?.name ?? r.employeeName, dept: emp?.department ?? '' };
      })
      .sort((a, b) => {
        const ta = a.checkIn ?? '';
        const tb = b.checkIn ?? '';
        return ta.localeCompare(tb);
      });
  }, [todayRecords, employeeList]);

  const MessageBanner = ({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) => {
    if (!msg) return null;
    return (
      <div
        className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
          msg.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}
      >
        {msg.type === 'success' ? (
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        )}
        {msg.text}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Check In / Check Out</h1>
        <p className="text-sm text-gray-500 mt-1">Catat kehadiran karyawan secara manual</p>
      </div>

      {/* Demo Banner */}
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-yellow-700">
          Mode Demo Lokal — status disimpan pada browser ini dan tidak tersinkron antarperangkat.
        </p>
      </div>

      {/* Two Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check In Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogIn className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-700 text-lg">Check In</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
              <select
                value={ciEmployee}
                onChange={e => { setCiEmployee(e.target.value); setCiMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
              <input
                type="date"
                value={ciDate}
                onChange={e => { setCiDate(e.target.value); setCiMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <MessageBanner msg={ciMessage} />

            <button
              onClick={handleCheckIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Check In Sekarang
            </button>
          </div>
        </div>

        {/* Check Out Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <LogOut className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-700 text-lg">Check Out</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
              <select
                value={coEmployee}
                onChange={e => { setCoEmployee(e.target.value); setCoMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Karyawan --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
              <input
                type="date"
                value={coDate}
                onChange={e => { setCoDate(e.target.value); setCoMessage(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <MessageBanner msg={coMessage} />

            <button
              onClick={handleCheckOut}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Check Out Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Today's Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Clock className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Log Absensi Hari Ini — {formatDateDisplay(today)}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Karyawan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Check In</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Check Out</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Durasi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Lembur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {todayDisplayRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Belum ada catatan absensi hari ini
                  </td>
                </tr>
              ) : (
                todayDisplayRecords.map(rec => {
                  const checkInTime = formatTime(rec.checkIn);
                  const checkOutTime = formatTime(rec.checkOut);
                  const inForCalc = rec.checkIn?.includes('T')
                    ? new Date(rec.checkIn).toTimeString().slice(0, 5)
                    : rec.checkIn?.slice(0, 5);
                  const outForCalc = rec.checkOut?.includes('T')
                    ? new Date(rec.checkOut).toTimeString().slice(0, 5)
                    : rec.checkOut?.slice(0, 5);
                  const workH = inForCalc && outForCalc
                    ? calcWorkHours(inForCalc, outForCalc).toFixed(1) + ' jam'
                    : '-';
                  const overtimeH = rec.overtime != null && rec.overtime > 0
                    ? rec.overtime.toFixed(1) + ' jam'
                    : '-';

                  const statusColor =
                    rec.status === 'Present' ? 'bg-green-100 text-green-700'
                    : rec.status === 'Late' ? 'bg-yellow-100 text-yellow-700'
                    : rec.status === 'Absent' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600';

                  return (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{rec.empName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{rec.dept}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{checkInTime}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{checkOutTime}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{workH}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{overtimeH}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
