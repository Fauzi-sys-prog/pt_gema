import { useState, useMemo } from 'react';
import { Search, Download, FileText, Calendar } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { exportAttendanceXlsx } from '../../utils/operationalExcelExports';

function getWorkingDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export default function RekapAbsensiPage() {
  const { attendanceList = [], employeeList = [], thlList = [] } = useApp();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const totalWorkDays = useMemo(() => getWorkingDaysInMonth(selectedMonth), [selectedMonth]);

  const attendanceSummary = useMemo(() => {
    const monthRecords = attendanceList.filter(a => (a.date || '').startsWith(selectedMonth));

    // Build summary for employees
    const empSummaries = employeeList
      .filter(e => e.status !== 'Resigned')
      .map(emp => {
        const records = monthRecords.filter(a => a.employeeId === emp.id);
        const present = records.filter(a => a.status === 'Present').length;
        const late = records.filter(a => a.status === 'Late').length;
        const absent = records.filter(a => a.status === 'Absent').length;
        const leave = records.filter(a => a.status === 'Leave').length;
        const sick = records.filter(a => a.status === 'Sick').length;
        const permission = records.filter(a => a.status === 'Permission').length;
        const totalWorkHours = records.reduce((s, a) => s + (a.workHours || 0), 0);
        const overtime = records.reduce((s, a) => s + (a.overtime || 0), 0);
        return {
          employeeId: emp.employeeId || emp.id,
          employeeName: emp.name,
          position: emp.position,
          employmentType: emp.employmentType || 'Permanent',
          totalDays: totalWorkDays,
          present: present + late,
          late,
          absent,
          leave,
          sick,
          permission,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          overtime: Math.round(overtime * 10) / 10,
          deduction: late * 0.5,
          status: 'Active' as const,
        };
      });

    // Build summary for THL
    const thlSummaries = thlList
      .filter(t => t.status === 'Active')
      .map(t => {
        const records = monthRecords.filter(a => a.employeeId === t.id);
        const present = records.filter(a => a.status === 'Present').length;
        const late = records.filter(a => a.status === 'Late').length;
        const absent = records.filter(a => a.status === 'Absent').length;
        const totalWorkHours = records.reduce((s, a) => s + (a.workHours || 0), 0);
        return {
          employeeId: t.id,
          employeeName: t.nama || t.name || '',
          position: t.jabatan || 'THL',
          employmentType: 'THL',
          totalDays: totalWorkDays,
          present: present + late,
          late,
          absent,
          leave: 0,
          sick: 0,
          permission: 0,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          overtime: 0,
          deduction: late * 0.5,
          status: 'Active' as const,
        };
      });

    return [...empSummaries, ...thlSummaries];
  }, [attendanceList, employeeList, thlList, selectedMonth, totalWorkDays]);

  const filteredData = attendanceSummary.filter(item => {
    const matchSearch = item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || item.employmentType === filterType;
    return matchSearch && matchType;
  });

  const totalEmployees = filteredData.length;
  const totalPresent = filteredData.reduce((sum, emp) => sum + emp.present, 0);
  const totalAbsent = filteredData.reduce((sum, emp) => sum + emp.absent, 0);
  const totalLeave = filteredData.reduce((sum, emp) => sum + emp.leave + emp.sick + emp.permission, 0);
  const totalOvertime = filteredData.reduce((sum, emp) => sum + emp.overtime, 0);

  const getAttendanceRate = (emp: typeof filteredData[0]) => {
    if (emp.totalDays === 0) return '0.0';
    return ((emp.present / emp.totalDays) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Rekap Absensi</h1>
          <p className="text-gray-600">Ringkasan absensi bulanan untuk payroll</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <FileText size={20} />
            Export PDF
          </button>
          <button onClick={() => exportAttendanceXlsx(filteredData, selectedMonth)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download size={20} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Karyawan</div>
          <div className="text-gray-900">{totalEmployees} Orang</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-green-600 mb-2">Total Hadir</div>
          <div className="text-gray-900">{totalPresent} Hari</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-red-600 mb-2">Total Absent</div>
          <div className="text-gray-900">{totalAbsent} Hari</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Cuti/Sakit/Izin</div>
          <div className="text-gray-900">{totalLeave} Hari</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-purple-600 mb-2">Total Overtime</div>
          <div className="text-gray-900">{totalOvertime.toFixed(1)} Jam</div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Periode Bulan</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-gray-700 mb-2">Cari Karyawan</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari nama atau ID karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Tipe Karyawan</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Tipe</option>
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
              <option value="THL">THL</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-gray-900">Rekap Absensi — {selectedMonth}</h3>
          <span className="text-xs text-gray-500">{totalWorkDays} hari kerja bulan ini</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">ID</th>
                <th className="px-6 py-3 text-left text-gray-600">Nama</th>
                <th className="px-6 py-3 text-left text-gray-600">Jabatan</th>
                <th className="px-6 py-3 text-left text-gray-600">Tipe</th>
                <th className="px-6 py-3 text-center text-gray-600">Hari Kerja</th>
                <th className="px-6 py-3 text-center text-green-600">Hadir</th>
                <th className="px-6 py-3 text-center text-yellow-600">Telat</th>
                <th className="px-6 py-3 text-center text-red-600">Absent</th>
                <th className="px-6 py-3 text-center text-blue-600">Cuti</th>
                <th className="px-6 py-3 text-center text-purple-600">Sakit</th>
                <th className="px-6 py-3 text-center text-orange-600">Izin</th>
                <th className="px-6 py-3 text-center text-gray-600">Jam Kerja</th>
                <th className="px-6 py-3 text-center text-purple-600">Lembur</th>
                <th className="px-6 py-3 text-center text-gray-600">Kehadiran %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data absensi untuk periode {selectedMonth}
                  </td>
                </tr>
              ) : filteredData.map((employee) => (
                <tr key={employee.employeeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900 text-sm">{employee.employeeId}</td>
                  <td className="px-6 py-4 text-gray-900">{employee.employeeName}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{employee.position}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{employee.employmentType}</td>
                  <td className="px-6 py-4 text-gray-600 text-center">{employee.totalDays}</td>
                  <td className="px-6 py-4 text-green-600 text-center font-medium">{employee.present}</td>
                  <td className="px-6 py-4 text-yellow-600 text-center">{employee.late}</td>
                  <td className="px-6 py-4 text-red-600 text-center">{employee.absent}</td>
                  <td className="px-6 py-4 text-blue-600 text-center">{employee.leave}</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{employee.sick}</td>
                  <td className="px-6 py-4 text-orange-600 text-center">{employee.permission}</td>
                  <td className="px-6 py-4 text-gray-900 text-center">{employee.totalWorkHours}h</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{employee.overtime}h</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      parseFloat(getAttendanceRate(employee)) >= 95 ? 'bg-green-100 text-green-700' :
                      parseFloat(getAttendanceRate(employee)) >= 85 ? 'bg-yellow-100 text-yellow-700' :
                      parseFloat(getAttendanceRate(employee)) > 0 ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {getAttendanceRate(employee)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={5} className="px-6 py-4 font-semibold text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-green-600 text-center font-semibold">{totalPresent}</td>
                  <td className="px-6 py-4 text-yellow-600 text-center">{filteredData.reduce((s, e) => s + e.late, 0)}</td>
                  <td className="px-6 py-4 text-red-600 text-center">{totalAbsent}</td>
                  <td className="px-6 py-4 text-blue-600 text-center">{filteredData.reduce((s, e) => s + e.leave, 0)}</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{filteredData.reduce((s, e) => s + e.sick, 0)}</td>
                  <td className="px-6 py-4 text-orange-600 text-center">{filteredData.reduce((s, e) => s + e.permission, 0)}</td>
                  <td className="px-6 py-4 text-gray-900 text-center">{filteredData.reduce((s, e) => s + e.totalWorkHours, 0).toFixed(1)}h</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{totalOvertime.toFixed(1)}h</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 mb-2 flex items-center gap-2">
          <Calendar size={20} />
          Integrasi Payroll
        </h3>
        <div className="text-blue-700 text-xs space-y-1">
          <p>• Data rekap absensi dihitung real-time dari catatan absensi harian</p>
          <p>• Overtime dikalkulasi otomatis dari jam masuk/keluar (standar 9 jam)</p>
          <p>• THL dihitung berdasarkan hari hadir × tarif harian</p>
        </div>
      </div>
    </div>
  );
}
