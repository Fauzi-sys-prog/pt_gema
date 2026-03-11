import { useEffect, useState } from 'react';
import { Search, Download, FileText, Calendar } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';
import { useApp } from '../../contexts/AppContext';

interface MonthlyAttendance {
  employeeId: string;
  employeeName: string;
  position: string;
  employmentType: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  sick: number;
  permission: number;
  totalWorkHours: number;
  overtime: number;
  deduction: number;
  status: 'Active' | 'Inactive';
}

const ATTENDANCE_SUMMARY_RESOURCE = 'hr-attendance-summaries';

export default function RekapAbsensiPage() {
  const { currentUser } = useApp();
  const getApiErrorMessage = (err: any, fallback: string) =>
    String(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [attendanceSummary, setAttendanceSummary] = useState<MonthlyAttendance[]>([]);
  const [exportingPayroll, setExportingPayroll] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/${ATTENDANCE_SUMMARY_RESOURCE}`);
        const rows = Array.isArray(res.data) ? res.data : [];
        const parsed = rows.map((row: any, idx: number) => {
          const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
          return {
            ...(payload || {}),
            employeeId: payload?.employeeId || row?.entityId || `EMP-SUM-${idx + 1}`,
          } as MonthlyAttendance;
        });
        setAttendanceSummary(parsed);
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, `Gagal load ${ATTENDANCE_SUMMARY_RESOURCE}`));
        setAttendanceSummary([]);
      }
    };
    load();
  }, []);

  const filteredData = attendanceSummary.filter(item => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchSearch = String(item.employeeName || '').toLowerCase().includes(keyword) ||
                       String(item.employeeId || '').toLowerCase().includes(keyword);
    const matchType = filterType === 'all' || item.employmentType === filterType;
    return matchSearch && matchType;
  });

  const handleExportToPayroll = () => {
    const [yearRaw, monthRaw] = selectedMonth.split('-');
    const year = Number(yearRaw || new Date().getFullYear());
    const month = monthRaw || String(new Date().getMonth() + 1).padStart(2, '0');
    const payrollBatchId = `PAY-${year}-${month}`;
    const overtimeHours = filteredData.reduce((sum, emp) => sum + (emp.overtime || 0), 0);
    const attendanceFactor = filteredData.reduce((sum, emp) => {
      const netWorkDays = Math.max(0, (emp.present || 0) - (emp.absent || 0));
      return sum + netWorkDays;
    }, 0);
    const estimatedPayroll = Math.max(0, Math.round((attendanceFactor * 175000) + (overtimeHours * 35000)));

    const payload = {
      id: payrollBatchId,
      month,
      year,
      totalPayroll: estimatedPayroll,
      status: 'Pending',
      employeeCount: filteredData.length,
    };

    setExportingPayroll(true);
    api
      .put('/payrolls/bulk', [payload])
      .then(() => {
        toast.success(`Batch payroll ${month}/${year} tersimpan ke database.`);
      })
      .catch((err: any) => {
        toast.error(getApiErrorMessage(err, 'Gagal kirim batch payroll ke server'));
      })
      .finally(() => {
        setExportingPayroll(false);
      });
  };

  const handleExportPDF = () => {
    window.print();
    toast.success('Mode print PDF dibuka. Pilih Save as PDF di dialog print.');
  };

  const handleExportExcel = async () => {
    const headers = [
      'employeeId', 'employeeName', 'position', 'employmentType',
      'totalDays', 'present', 'late', 'absent', 'leave', 'sick', 'permission',
      'totalWorkHours', 'overtime', 'deduction', 'status'
    ];
    const rows = filteredData.map((r) => headers.map((h) => (r as any)[h]));
    if (!rows.length) {
      toast.info('Tidak ada data absensi untuk diekspor.');
      return;
    }
    const payload = {
      filename: `rekap-absensi-${selectedMonth}`,
      title: 'Monthly Attendance Summary',
      subtitle: `Periode ${selectedMonth} | Total karyawan ${totalEmployees}`,
      columns: headers,
      rows,
      notes: `Ringkasan periode: hadir ${totalPresent} hari, absen ${totalAbsent} hari, cuti/sakit/izin ${totalLeave} hari, lembur ${totalOvertime.toFixed(1)} jam.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'HR Rekap Absensi',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `rekap-absensi-${selectedMonth}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `rekap-absensi-${selectedMonth}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Rekap absensi Word + Excel berhasil di-export');
    } catch {
      toast.error('Export rekap absensi gagal');
    }
  };

  const totalEmployees = filteredData.length;
  const totalPresent = filteredData.reduce((sum, emp) => sum + emp.present, 0);
  const totalAbsent = filteredData.reduce((sum, emp) => sum + emp.absent, 0);
  const totalLeave = filteredData.reduce((sum, emp) => sum + emp.leave + emp.sick + emp.permission, 0);
  const totalOvertime = filteredData.reduce((sum, emp) => sum + emp.overtime, 0);

  const getAttendanceRate = (emp: MonthlyAttendance) => {
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
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText size={20} />
            Export PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={20} />
            Export Word + Excel
          </button>
          <button 
            onClick={handleExportToPayroll}
            disabled={exportingPayroll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar size={20} />
            {exportingPayroll ? 'Syncing Payroll...' : 'Export to Payroll'}
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Karyawan</div>
          <div className="text-gray-900">{totalEmployees} Karyawan</div>
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
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-gray-900">Rekap Absensi - {selectedMonth}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Employee ID</th>
                <th className="px-6 py-3 text-left text-gray-600">Name</th>
                <th className="px-6 py-3 text-left text-gray-600">Position</th>
                <th className="px-6 py-3 text-left text-gray-600">Type</th>
                <th className="px-6 py-3 text-left text-gray-600">Total Days</th>
                <th className="px-6 py-3 text-left text-gray-600">Present</th>
                <th className="px-6 py-3 text-left text-gray-600">Late</th>
                <th className="px-6 py-3 text-left text-gray-600">Absent</th>
                <th className="px-6 py-3 text-left text-gray-600">Leave</th>
                <th className="px-6 py-3 text-left text-gray-600">Sick</th>
                <th className="px-6 py-3 text-left text-gray-600">Permission</th>
                <th className="px-6 py-3 text-left text-gray-600">Work Hours</th>
                <th className="px-6 py-3 text-left text-gray-600">Overtime</th>
                <th className="px-6 py-3 text-left text-gray-600">Deduction</th>
                <th className="px-6 py-3 text-left text-gray-600">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((employee) => (
                <tr key={employee.employeeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{employee.employeeId}</td>
                  <td className="px-6 py-4 text-gray-900">{employee.employeeName}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.position}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.employmentType}</td>
                  <td className="px-6 py-4 text-gray-600 text-center">{employee.totalDays}</td>
                  <td className="px-6 py-4 text-green-600 text-center">{employee.present}</td>
                  <td className="px-6 py-4 text-yellow-600 text-center">{employee.late}</td>
                  <td className="px-6 py-4 text-red-600 text-center">{employee.absent}</td>
                  <td className="px-6 py-4 text-blue-600 text-center">{employee.leave}</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{employee.sick}</td>
                  <td className="px-6 py-4 text-orange-600 text-center">{employee.permission}</td>
                  <td className="px-6 py-4 text-gray-900 text-center">{employee.totalWorkHours}h</td>
                  <td className="px-6 py-4 text-purple-600 text-center">{employee.overtime}h</td>
                  <td className="px-6 py-4 text-red-600 text-center">{employee.deduction}h</td>
                  <td className="px-6 py-4 text-gray-900 text-center">
                    <span className={`px-3 py-1 rounded-full ${
                      parseFloat(getAttendanceRate(employee)) >= 95 ? 'bg-green-100 text-green-700' :
                      parseFloat(getAttendanceRate(employee)) >= 85 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {getAttendanceRate(employee)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-gray-900">TOTAL</td>
                <td className="px-6 py-4 text-green-600 text-center">{totalPresent}</td>
                <td className="px-6 py-4 text-yellow-600 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.late, 0)}
                </td>
                <td className="px-6 py-4 text-red-600 text-center">{totalAbsent}</td>
                <td className="px-6 py-4 text-blue-600 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.leave, 0)}
                </td>
                <td className="px-6 py-4 text-purple-600 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.sick, 0)}
                </td>
                <td className="px-6 py-4 text-orange-600 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.permission, 0)}
                </td>
                <td className="px-6 py-4 text-gray-900 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.totalWorkHours, 0)}h
                </td>
                <td className="px-6 py-4 text-purple-600 text-center">
                  {totalOvertime.toFixed(1)}h
                </td>
                <td className="px-6 py-4 text-red-600 text-center">
                  {filteredData.reduce((sum, emp) => sum + emp.deduction, 0).toFixed(1)}h
                </td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-gray-900 mb-3">Keterangan:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">Present: Hadir tepat waktu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-gray-600">Late: Terlambat masuk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">Absent: Tidak hadir tanpa keterangan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Leave: Cuti tahunan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-gray-600">Sick: Sakit dengan surat dokter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-gray-600">Permission: Izin keperluan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-gray-600">Overtime: Jam lembur</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">Deduction: Potongan keterlambatan</span>
          </div>
        </div>
      </div>

      {/* Payroll Integration Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 mb-2 flex items-center gap-2">
          <Calendar size={20} />
          Integrasi Payroll
        </h3>
        <div className="text-blue-700 text-xs space-y-1">
          <p>• Data rekap absensi ini akan diteruskan ke sistem Finance untuk perhitungan gaji</p>
          <p>• Overtime akan dikalkulasi dengan rate per jam sesuai jabatan</p>
          <p>• Deduction keterlambatan akan mengurangi gaji pokok</p>
          <p>• Cuti sakit dengan surat dokter tetap mendapat full salary</p>
          <p>• THL dihitung per hari kehadiran x tarif harian</p>
        </div>
      </div>
    </div>
  );
}
