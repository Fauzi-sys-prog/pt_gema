import { useEffect, useState } from 'react'; import { Plus, Search, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import type { Attendance } from '../../contexts/AppContext';
import type { Employee } from '../../contexts/AppContext';
import api from '../../services/api';

export default function AbsensiPage() {
  const { attendanceList = [], addAttendance, employeeList = [] } = useApp();
  const [serverAttendanceList, setServerAttendanceList] = useState<Attendance[] | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<Employee[] | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Attendance>>({
    employeeId: '',
    employeeName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Present',
    checkIn: '',
    checkOut: '',
    notes: ''
  });

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) {
        return payload.map((row: any) => {
          if (row && typeof row === 'object' && 'payload' in row) {
            const item = (row as { payload?: any }).payload || {};
            const id = item.id || row.entityId || row.id;
            return { id, ...item } as T;
          }
          return row as T;
        });
      }
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return normalizeList<T>((payload as { items: unknown[] }).items);
      }
      return [];
    };

    const loadPageData = async () => {
      try {
        const [attendanceRes, employeesRes] = await Promise.all([
          api.get('/attendances'),
          api.get('/employees'),
        ]);
        if (!mounted) return;
        setServerAttendanceList(normalizeList<Attendance>(attendanceRes.data));
        setServerEmployeeList(normalizeList<Employee>(employeesRes.data));
      } catch {
        if (!mounted) return;
        setServerAttendanceList(null);
        setServerEmployeeList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveAttendanceList = serverAttendanceList ?? attendanceList;
  const effectiveEmployeeList = serverEmployeeList ?? employeeList;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-700';
      case 'Late': return 'bg-yellow-100 text-yellow-700';
      case 'Absent': return 'bg-red-100 text-red-700';
      case 'Leave': return 'bg-blue-100 text-blue-700';
      case 'Sick': return 'bg-purple-100 text-purple-700';
      case 'Permission': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Present': return <CheckCircle size={16} className="text-green-600" />;
      case 'Late': return <Clock size={16} className="text-yellow-600" />;
      case 'Absent': return <XCircle size={16} className="text-red-600" />;
      case 'Leave': return <AlertCircle size={16} className="text-blue-600" />;
      case 'Sick': return <AlertCircle size={16} className="text-purple-600" />;
      case 'Permission': return <AlertCircle size={16} className="text-orange-600" />;
      default: return null;
    }
  };

  const filteredData = (effectiveAttendanceList || []).filter(item => {
    const matchDate = item.date === selectedDate;
    const keyword = String(searchTerm || '').toLowerCase();
    const matchSearch = String(item.employeeName || '').toLowerCase().includes(keyword) ||
                       String(item.employeeId || '').toLowerCase().includes(keyword);
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchDate && matchSearch && matchStatus;
  });

  const handleCheckIn = () => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    toast.success(`Check-in berhasil pada ${time}`);
  };

  const handleCheckOut = () => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    toast.success(`Check-out berhasil pada ${time}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check Leave Quota validation
    if (formData.status === 'Leave') {
      const emp = effectiveEmployeeList.find(e => e.id === formData.employeeId || e.name === formData.employeeName);
      if (emp && emp.leaveQuota !== undefined) {
        const usedLeave = (effectiveAttendanceList || []).filter(a => a.employeeId === emp.id && a.status === 'Leave').length;
        if (usedLeave >= emp.leaveQuota) {
          toast.error(`Kuota cuti untuk ${emp.name} sudah habis (${emp.leaveQuota} hari).`);
          return;
        }
      }
    }

    const newAttendance: Attendance = {
      ...formData,
      id: `att-${Date.now()}`
    } as Attendance;

    // Calculate work hours if check-in and check-out exist
    if (formData.checkIn && formData.checkOut) {
      const [inHour, inMin] = formData.checkIn.split(':').map(Number);
      const [outHour, outMin] = formData.checkOut.split(':').map(Number);
      const hours = (outHour * 60 + outMin - inHour * 60 - inMin) / 60;
      newAttendance.workHours = hours;
      newAttendance.overtime = Math.max(0, hours - 9); // Assuming 9 hours standard shift (8 work + 1 break)
    }
    
    addAttendance(newAttendance);
    setServerAttendanceList((prev) => (prev ? [newAttendance, ...prev] : prev));
    toast.success('Data absensi berhasil ditambahkan');
    setShowModal(false);
  };

  const todayAttendance = (effectiveAttendanceList || []).filter(a => a.date === new Date().toISOString().split('T')[0]);
  const presentCount = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const absentCount = todayAttendance.filter(a => a.status === 'Absent').length;
  const leaveCount = todayAttendance.filter(a => a.status === 'Leave' || a.status === 'Sick' || a.status === 'Permission').length;
  const lateCount = todayAttendance.filter(a => a.status === 'Late').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Absensi Karyawan</h1>
          <p className="text-gray-600">Kelola absensi dan kehadiran karyawan</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleCheckIn}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle size={20} />
            Check In
          </button>
          <button 
            onClick={handleCheckOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <XCircle size={20} />
            Check Out
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Input Manual
          </button>
        </div>
      </div>

      {/* Stats for Today */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
          <div className="text-gray-600 mb-2">Hadir Hari Ini</div>
          <div className="text-gray-900">{presentCount} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-yellow-600 mb-2">Terlambat</div>
          <div className="text-gray-900">{lateCount} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Cuti/Izin/Sakit</div>
          <div className="text-gray-900">{leaveCount} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-red-600 mb-2">Tidak Hadir</div>
          <div className="text-gray-900">{absentCount} Karyawan</div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Tanggal</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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
            <label className="block text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="Present">Hadir</option>
              <option value="Late">Terlambat</option>
              <option value="Absent">Tidak Hadir</option>
              <option value="Leave">Cuti</option>
              <option value="Sick">Sakit</option>
              <option value="Permission">Izin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Employee ID</th>
                <th className="px-6 py-3 text-left text-gray-600">Name</th>
                <th className="px-6 py-3 text-left text-gray-600">Date</th>
                <th className="px-6 py-3 text-left text-gray-600">Check In</th>
                <th className="px-6 py-3 text-left text-gray-600">Check Out</th>
                <th className="px-6 py-3 text-left text-gray-600">Work Hours</th>
                <th className="px-6 py-3 text-left text-gray-600">Overtime</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Location</th>
                <th className="px-6 py-3 text-left text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.length > 0 ? (
                filteredData.map((attendance) => (
                  <tr key={attendance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{attendance.employeeId}</td>
                    <td className="px-6 py-4 text-gray-900">{attendance.employeeName}</td>
                    <td className="px-6 py-4 text-gray-600">{attendance.date}</td>
                    <td className="px-6 py-4 text-gray-900">
                      {attendance.checkIn || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {attendance.checkOut || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {attendance.workHours ? `${attendance.workHours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {attendance.overtime ? `${attendance.overtime.toFixed(1)}h` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full flex items-center gap-2 w-fit ${getStatusColor(attendance.status)}`}>
                        {getStatusIcon(attendance.status)}
                        {attendance.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{attendance.location || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{attendance.notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data absensi untuk tanggal {selectedDate}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Input Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h2 className="text-gray-900">Input Absensi Manual</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Employee ID</label>
                  <input 
                    type="text" 
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="EMP-XXX"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Nama Karyawan</label>
                  <input 
                    type="text" 
                    value={formData.employeeName}
                    onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Tanggal</label>
                  <input 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Attendance['status'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Present">Hadir</option>
                    <option value="Late">Terlambat</option>
                    <option value="Absent">Tidak Hadir</option>
                    <option value="Leave">Cuti</option>
                    <option value="Sick">Sakit</option>
                    <option value="Permission">Izin</option>
                  </select>
                </div>
              </div>

              {(formData.status === 'Present' || formData.status === 'Late') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Check In</label>
                    <input 
                      type="time" 
                      value={formData.checkIn}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Check Out</label>
                    <input 
                      type="time" 
                      value={formData.checkOut}
                      onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2">Location</label>
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Office, Site, Remote, etc."
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Notes / Keterangan</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder={formData.status === 'Leave' ? 'Contoh: Cuti Pribadi atau Cuti Bersama' : 'Catatan tambahan...'}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Absensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
