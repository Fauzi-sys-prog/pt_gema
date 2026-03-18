import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

type LeaveType = 'Annual' | 'Sick' | 'Permission' | 'Unpaid' | 'Marriage' | 'Maternity';
type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

type Leave = {
  id: string;
  leaveNo: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
};

type LeaveEntity = {
  id?: string;
  leaveNo?: string;
  employeeId?: string;
  employeeName?: string;
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  reason?: string;
  status?: LeaveStatus;
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
};

const DEFAULT_FORM: Omit<Leave, 'id' | 'leaveNo' | 'totalDays' | 'approvedBy' | 'approvedDate'> = {
  employeeId: '',
  employeeName: '',
  leaveType: 'Annual',
  startDate: '',
  endDate: '',
  reason: '',
  status: 'Pending',
  notes: '',
};

function toIsoDate(dateLike: string): string {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function calcTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function mapEntityToLeave(row: LeaveEntity): Leave | null {
  const payload = row ?? {};
  const id = payload.id;
  if (!id) return null;

  const startDate = typeof payload.startDate === 'string' ? toIsoDate(payload.startDate) : '';
  const endDate = typeof payload.endDate === 'string' ? toIsoDate(payload.endDate) : '';
  const totalDaysRaw = Number(payload.totalDays);
  const totalDays = Number.isFinite(totalDaysRaw) && totalDaysRaw > 0 ? totalDaysRaw : calcTotalDays(startDate, endDate);

  return {
    id,
    leaveNo: String(payload.leaveNo || `LV-${String(id).slice(-6)}`),
    employeeId: String(payload.employeeId || ''),
    employeeName: String(payload.employeeName || '-'),
    leaveType: (payload.leaveType as LeaveType) || 'Annual',
    startDate,
    endDate,
    totalDays,
    reason: String(payload.reason || ''),
    status: (payload.status as LeaveStatus) || 'Pending',
    notes: typeof payload.notes === 'string' ? payload.notes : '',
    approvedBy: typeof payload.approvedBy === 'string' ? payload.approvedBy : undefined,
    approvedDate: typeof payload.approvedDate === 'string' ? payload.approvedDate : undefined,
  };
}

export default function CutiPage() {
  const { currentUser, employeeList } = useApp();
  const [leaveList, setLeaveList] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Annual': return 'text-blue-600';
      case 'Sick': return 'text-purple-600';
      case 'Permission': return 'text-orange-600';
      case 'Unpaid': return 'text-gray-600';
      case 'Marriage': return 'text-pink-600';
      case 'Maternity': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const loadLeaves = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/hr-leaves');
      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows
        .map((row: LeaveEntity) => mapEntityToLeave(row))
        .filter((v: Leave | null): v is Leave => !!v)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      setLeaveList(mapped);
      if (!silent) toast.success('Data cuti diperbarui');
    } catch {
      if (!silent) toast.error('Gagal memuat data cuti');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves(true);
  }, []);

  const filteredData = useMemo(() => {
    return leaveList.filter((item) => {
      const term = String(searchTerm || '').toLowerCase();
      const matchSearch =
        String(item.employeeName || '').toLowerCase().includes(term) ||
        String(item.employeeId || '').toLowerCase().includes(term) ||
        String(item.leaveNo || '').toLowerCase().includes(term);
      const matchType = filterType === 'all' || item.leaveType === filterType;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [filterStatus, filterType, leaveList, searchTerm]);

  const handleViewDetail = (leave: Leave) => {
    setSelectedLeave(leave);
    setShowDetailModal(true);
  };

  const persistLeaveUpdate = async (leave: Leave) => {
    const payload: Leave = {
      ...leave,
      startDate: toIsoDate(leave.startDate),
      endDate: toIsoDate(leave.endDate),
    };
    const res = await api.patch(`/hr-leaves/${leave.id}`, payload);
    return mapEntityToLeave(res?.data as LeaveEntity) || payload;
  };

  const handleApprove = async (leave: Leave) => {
    try {
      const updated: Leave = {
        ...leave,
        status: 'Approved',
        approvedBy: currentUser?.fullName || currentUser?.name || currentUser?.username || 'System',
        approvedDate: new Date().toISOString(),
      };
      const saved = await persistLeaveUpdate(updated);
      setLeaveList((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setSelectedLeave((prev) => (prev && prev.id === saved.id ? saved : prev));
      toast.success(`Cuti ${saved.leaveNo} disetujui`);
    } catch {
      toast.error('Gagal approve cuti');
    }
  };

  const handleReject = async (leave: Leave) => {
    const reason = window.prompt('Alasan penolakan:')?.trim();
    if (!reason) return;

    try {
      const actorName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'System';
      const rejectedAt = new Date().toISOString();
      const updated: Leave = {
        ...leave,
        status: 'Rejected',
        notes: `Rejected by ${actorName} at ${rejectedAt}: ${reason}`,
      };
      const saved = await persistLeaveUpdate(updated);
      setLeaveList((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setSelectedLeave((prev) => (prev && prev.id === saved.id ? saved : prev));
      toast.success(`Cuti ${saved.leaveNo} ditolak`);
    } catch {
      toast.error('Gagal reject cuti');
    }
  };

  const buildLeaveNo = () => {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const seq = String(leaveList.filter((l) => l.leaveNo.startsWith(`LV-${ym}-`)).length + 1).padStart(3, '0');
    return `LV-${ym}-${seq}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startDate = toIsoDate(formData.startDate);
    const endDate = toIsoDate(formData.endDate);
    const totalDays = calcTotalDays(startDate, endDate);

    if (!startDate || !endDate || totalDays <= 0) {
      toast.error('Tanggal cuti tidak valid');
      return;
    }

    const id = `leave-${Date.now()}`;
    const newLeave: Leave = {
      ...formData,
      id,
      leaveNo: buildLeaveNo(),
      startDate,
      endDate,
      totalDays,
      notes: formData.notes || '',
    };

    try {
      const res = await api.post('/hr-leaves', newLeave);
      const saved = mapEntityToLeave(res?.data as LeaveEntity) || newLeave;
      setLeaveList((prev) => [saved, ...prev]);
      toast.success('Pengajuan cuti berhasil disubmit');
      setShowModal(false);
      setFormData(DEFAULT_FORM);
    } catch {
      toast.error('Gagal submit pengajuan cuti');
    }
  };

  const pendingCount = leaveList.filter((l) => l.status === 'Pending').length;
  const approvedCount = leaveList.filter((l) => l.status === 'Approved').length;
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonthLeaves = leaveList.filter((l) => l.startDate.startsWith(thisMonthPrefix)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Cuti & Izin</h1>
          <p className="text-gray-600">Kelola pengajuan cuti, izin, dan surat sakit karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLeaves(false)}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ajukan Cuti/Izin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Pengajuan</div>
          <div className="text-gray-900">{leaveList.length} Requests</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-yellow-600 mb-2">Pending</div>
          <div className="text-gray-900">{pendingCount} Requests</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-green-600 mb-2">Approved</div>
          <div className="text-gray-900">{approvedCount} Requests</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Bulan Ini</div>
          <div className="text-gray-900">{thisMonthLeaves} Requests</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari karyawan atau nomor cuti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Tipe</option>
            <option value="Annual">Annual Leave</option>
            <option value="Sick">Sick Leave</option>
            <option value="Permission">Permission</option>
            <option value="Unpaid">Unpaid Leave</option>
            <option value="Marriage">Marriage Leave</option>
            <option value="Maternity">Maternity Leave</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Leave No</th>
                <th className="px-6 py-3 text-left text-gray-600">Employee</th>
                <th className="px-6 py-3 text-left text-gray-600">Leave Type</th>
                <th className="px-6 py-3 text-left text-gray-600">Start Date</th>
                <th className="px-6 py-3 text-left text-gray-600">End Date</th>
                <th className="px-6 py-3 text-left text-gray-600">Total Days</th>
                <th className="px-6 py-3 text-left text-gray-600">Reason</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((leave) => (
                <tr key={leave.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{leave.leaveNo}</td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{leave.employeeName}</div>
                    <div className="text-gray-500 text-xs">{leave.employeeId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={getTypeColor(leave.leaveType)}>{leave.leaveType}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{leave.startDate}</td>
                  <td className="px-6 py-4 text-gray-600">{leave.endDate}</td>
                  <td className="px-6 py-4 text-gray-600">{leave.totalDays} hari</td>
                  <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{leave.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(leave.status)}`}>{leave.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(leave)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Detail"
                      >
                        <Eye size={18} />
                      </button>
                      {leave.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(leave)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleReject(leave)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">Ajukan Cuti/Izin</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Employee ID</label>
                  <input
                    type="text"
                    list="employee-id-options"
                    value={formData.employeeId}
                    onChange={(e) => {
                      const employeeId = e.target.value;
                      const hit = employeeList.find((emp) => emp.employeeId === employeeId);
                      setFormData((prev) => ({
                        ...prev,
                        employeeId,
                        employeeName: hit?.name || prev.employeeName,
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                  <datalist id="employee-id-options">
                    {employeeList.map((emp) => (
                      <option key={emp.id} value={emp.employeeId}>{emp.name}</option>
                    ))}
                  </datalist>
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

              <div>
                <label className="block text-gray-700 mb-2">Tipe Cuti/Izin</label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value as LeaveType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Permission">Permission</option>
                  <option value="Unpaid">Unpaid Leave</option>
                  <option value="Marriage">Marriage Leave</option>
                  <option value="Maternity">Maternity Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Alasan</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
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
                  Submit Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-gray-900">Detail Cuti - {selectedLeave.leaveNo}</h2>
                  <p className="text-gray-600 mt-1">{selectedLeave.employeeName}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-gray-600 mb-1">Employee ID</div>
                  <div className="text-gray-900">{selectedLeave.employeeId}</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Leave Type</div>
                  <span className={getTypeColor(selectedLeave.leaveType)}>{selectedLeave.leaveType}</span>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Start Date</div>
                  <div className="text-gray-900">{selectedLeave.startDate}</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">End Date</div>
                  <div className="text-gray-900">{selectedLeave.endDate}</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Total Days</div>
                  <div className="text-gray-900">{selectedLeave.totalDays} hari</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Status</div>
                  <span className={`inline-block px-3 py-1 rounded-full ${getStatusColor(selectedLeave.status)}`}>
                    {selectedLeave.status}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-gray-600 mb-1">Alasan</div>
                <div className="text-gray-900">{selectedLeave.reason}</div>
              </div>

              {selectedLeave.approvedBy && (
                <div className="grid grid-cols-2 gap-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="text-green-700 mb-1">Approved By</div>
                    <div className="text-green-900">{selectedLeave.approvedBy}</div>
                  </div>
                  <div>
                    <div className="text-green-700 mb-1">Approved Date</div>
                    <div className="text-green-900">{selectedLeave.approvedDate}</div>
                  </div>
                </div>
              )}

              {selectedLeave.notes && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-yellow-700 mb-1">Notes</div>
                  <div className="text-yellow-900">{selectedLeave.notes}</div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Tutup
                </button>
                {selectedLeave.status === 'Pending' && (
                  <>
                    <button
                      onClick={async () => {
                        await handleReject(selectedLeave);
                        setShowDetailModal(false);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                    <button
                      onClick={async () => {
                        await handleApprove(selectedLeave);
                        setShowDetailModal(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
