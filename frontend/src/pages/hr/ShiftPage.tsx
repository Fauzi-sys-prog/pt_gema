import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Clock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

interface Shift {
  id: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  workHours: number;
  status: 'Active' | 'Inactive';
  description?: string;
}

interface ShiftSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  location: string;
}

const SHIFT_RESOURCE = 'hr-shifts';
const SHIFT_SCHEDULE_RESOURCE = 'hr-shift-schedules';

export default function ShiftPage() {
  const getApiErrorMessage = (err: any, fallback: string) =>
    String(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const [activeTab, setActiveTab] = useState<'shifts' | 'schedule'>('shifts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [shiftFormData, setShiftFormData] = useState<Partial<Shift>>({
    shiftName: '',
    startTime: '',
    endTime: '',
    breakDuration: 60,
    status: 'Active',
    description: ''
  });

  const [scheduleFormData, setScheduleFormData] = useState<Partial<ShiftSchedule>>({
    employeeId: '',
    employeeName: '',
    date: new Date().toISOString().split('T')[0],
    shiftCode: '',
    location: ''
  });

  const [shiftList, setShiftList] = useState<Shift[]>([]);
  const [scheduleList, setScheduleList] = useState<ShiftSchedule[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [shiftRes, scheduleRes] = await Promise.all([
          api.get(`/${SHIFT_RESOURCE}`),
          api.get(`/${SHIFT_SCHEDULE_RESOURCE}`)
        ]);

        const shifts = Array.isArray(shiftRes.data)
          ? shiftRes.data.map((row: any, idx: number) => {
              const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
              return { ...(payload || {}), id: payload?.id || row?.entityId || `SHIFT-ROW-${idx + 1}` } as Shift;
            })
          : [];
        const schedules = Array.isArray(scheduleRes.data)
          ? scheduleRes.data.map((row: any, idx: number) => {
              const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
              return { ...(payload || {}), id: payload?.id || row?.entityId || `SHIFT-SCHED-${idx + 1}` } as ShiftSchedule;
            })
          : [];

        setShiftList(shifts);
        setScheduleList(schedules);
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, `Gagal load ${SHIFT_RESOURCE}/${SHIFT_SCHEDULE_RESOURCE}`));
        setShiftList([]);
        setScheduleList([]);
      }
    };

    load();
  }, []);

  const saveShiftList = async (next: Shift[]) => {
    const body = next.map((item) => ({ entityId: item.id, payload: item }));
    await api.put(`/${SHIFT_RESOURCE}/bulk`, body);
  };

  const saveScheduleList = async (next: ShiftSchedule[]) => {
    const body = next.map((item) => ({ entityId: item.id, payload: item }));
    await api.put(`/${SHIFT_SCHEDULE_RESOURCE}/bulk`, body);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Inactive': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const shiftKeyword = String(searchTerm || '').toLowerCase();
  const filteredShifts = shiftList.filter(item =>
    String(item.shiftName || '').toLowerCase().includes(shiftKeyword) ||
    String(item.shiftCode || '').toLowerCase().includes(shiftKeyword)
  );

  const filteredSchedules = scheduleList.filter(item =>
    String(item.employeeName || '').toLowerCase().includes(shiftKeyword) ||
    String(item.employeeId || '').toLowerCase().includes(shiftKeyword)
  );

  const handleCreateShift = () => {
    setIsEditMode(false);
    setShiftFormData({
      shiftName: '',
      startTime: '',
      endTime: '',
      breakDuration: 60,
      status: 'Active',
      description: ''
    });
    setShowModal(true);
  };

  const handleEditShift = (shift: Shift) => {
    setIsEditMode(true);
    setShiftFormData(shift);
    setShowModal(true);
  };

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate work hours
    const [startHour, startMin] = shiftFormData.startTime!.split(':').map(Number);
    const [endHour, endMin] = shiftFormData.endTime!.split(':').map(Number);
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
    const workHours = (totalMinutes - shiftFormData.breakDuration!) / 60;
    
    try {
      if (isEditMode && shiftFormData.id) {
        const next = shiftList.map(s => s.id === shiftFormData.id ? { ...shiftFormData, workHours } as Shift : s);
        setShiftList(next);
        await saveShiftList(next);
        toast.success(`Shift ${shiftFormData.shiftName} berhasil diupdate`);
      } else {
        const newShift: Shift = {
          ...shiftFormData,
          id: `SHIFT-ITEM-${Date.now()}`,
          shiftCode: `SHIFT-${String(shiftList.length + 1).padStart(3, '0')}`,
          workHours
        } as Shift;
        
        const next = [...shiftList, newShift];
        setShiftList(next);
        await saveShiftList(next);
        toast.success(`Shift ${newShift.shiftName} berhasil ditambahkan`);
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, `Gagal simpan ${SHIFT_RESOURCE}`));
    }
  };

  const handleDeleteShift = async (shift: Shift) => {
    if (window.confirm(`Hapus shift ${shift.shiftName}?`)) {
      try {
        const next = shiftList.filter(s => s.id !== shift.id);
        setShiftList(next);
        await saveShiftList(next);
        toast.success('Shift berhasil dihapus');
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, `Gagal hapus dari ${SHIFT_RESOURCE}`));
      }
    }
  };

  const handleCreateSchedule = () => {
    setScheduleFormData({
      employeeId: '',
      employeeName: '',
      date: new Date().toISOString().split('T')[0],
      shiftCode: '',
      location: ''
    });
    setShowScheduleModal(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedShift = shiftList.find(s => s.shiftCode === scheduleFormData.shiftCode);
    
    const newSchedule: ShiftSchedule = {
      ...scheduleFormData,
      id: `SHIFT-SCHED-${Date.now()}`,
      shiftName: selectedShift?.shiftName || '',
      startTime: selectedShift?.startTime || '',
      endTime: selectedShift?.endTime || ''
    } as ShiftSchedule;
    
    try {
      const next = [...scheduleList, newSchedule];
      setScheduleList(next);
      await saveScheduleList(next);
      toast.success('Jadwal shift berhasil ditambahkan');
      setShowScheduleModal(false);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, `Gagal simpan ${SHIFT_SCHEDULE_RESOURCE}`));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Jam Kerja & Shift</h1>
          <p className="text-gray-600">Kelola master shift dan jadwal kerja karyawan</p>
        </div>
        <button 
          onClick={activeTab === 'shifts' ? handleCreateShift : handleCreateSchedule}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          {activeTab === 'shifts' ? 'Tambah Shift' : 'Buat Jadwal'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'shifts'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Master Shift
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Jadwal Shift
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={activeTab === 'shifts' ? 'Cari shift...' : 'Cari karyawan...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {activeTab === 'shifts' ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-600">Shift Code</th>
                  <th className="px-6 py-3 text-left text-gray-600">Shift Name</th>
                  <th className="px-6 py-3 text-left text-gray-600">Start Time</th>
                  <th className="px-6 py-3 text-left text-gray-600">End Time</th>
                  <th className="px-6 py-3 text-left text-gray-600">Break (min)</th>
                  <th className="px-6 py-3 text-left text-gray-600">Work Hours</th>
                  <th className="px-6 py-3 text-left text-gray-600">Status</th>
                  <th className="px-6 py-3 text-left text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{shift.shiftCode}</td>
                    <td className="px-6 py-4 text-gray-900">{shift.shiftName}</td>
                    <td className="px-6 py-4 text-gray-600">{shift.startTime}</td>
                    <td className="px-6 py-4 text-gray-600">{shift.endTime}</td>
                    <td className="px-6 py-4 text-gray-600">{shift.breakDuration} min</td>
                    <td className="px-6 py-4 text-gray-600">{shift.workHours}h</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full ${getStatusColor(shift.status)}`}>
                        {shift.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditShift(shift)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors" 
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteShift(shift)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" 
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-600">Date</th>
                  <th className="px-6 py-3 text-left text-gray-600">Employee ID</th>
                  <th className="px-6 py-3 text-left text-gray-600">Employee Name</th>
                  <th className="px-6 py-3 text-left text-gray-600">Shift</th>
                  <th className="px-6 py-3 text-left text-gray-600">Time</th>
                  <th className="px-6 py-3 text-left text-gray-600">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{schedule.date}</td>
                    <td className="px-6 py-4 text-gray-900">{schedule.employeeId}</td>
                    <td className="px-6 py-4 text-gray-900">{schedule.employeeName}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {schedule.shiftName}
                      <div className="text-xs text-gray-500">{schedule.shiftCode}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {schedule.startTime} - {schedule.endTime}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{schedule.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shift Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">
                {isEditMode ? `Edit Shift - ${shiftFormData.shiftCode}` : 'Tambah Shift Baru'}
              </h2>
            </div>

            <form onSubmit={handleSubmitShift} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Nama Shift</label>
                <input 
                  type="text" 
                  value={shiftFormData.shiftName}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, shiftName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Jam Mulai</label>
                  <input 
                    type="time" 
                    value={shiftFormData.startTime}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Jam Selesai</label>
                  <input 
                    type="time" 
                    value={shiftFormData.endTime}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Waktu Istirahat (menit)</label>
                  <input 
                    type="number" 
                    value={shiftFormData.breakDuration}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, breakDuration: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Status</label>
                  <select 
                    value={shiftFormData.status}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, status: e.target.value as Shift['status'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Deskripsi</label>
                <textarea 
                  value={shiftFormData.description}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, description: e.target.value })}
                  rows={3} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                  {isEditMode ? 'Update Shift' : 'Simpan Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">Buat Jadwal Shift</h2>
            </div>

            <form onSubmit={handleSubmitSchedule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Employee ID</label>
                  <input 
                    type="text" 
                    value={scheduleFormData.employeeId}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, employeeId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="EMP-XXX"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Nama Karyawan</label>
                  <input 
                    type="text" 
                    value={scheduleFormData.employeeName}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, employeeName: e.target.value })}
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
                    value={scheduleFormData.date}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Shift</label>
                  <select 
                    value={scheduleFormData.shiftCode}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, shiftCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Pilih Shift</option>
                    {shiftList.filter(s => s.status === 'Active').map(shift => (
                      <option key={shift.id} value={shift.shiftCode}>
                        {shift.shiftName} ({shift.startTime} - {shift.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Location</label>
                <input 
                  type="text" 
                  value={scheduleFormData.location}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Office, Site, etc."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
