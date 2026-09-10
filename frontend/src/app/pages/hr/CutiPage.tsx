import { useState } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle, X } from 'lucide-react';
import { useApp, type Leave } from '../../contexts/AppContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { toast } from 'sonner';

export default function CutiPage() {
  const { leaveList, addLeave, updateLeave, employeeList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Leave | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Leave>>({
    employeeId: '',
    employeeName: '',
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    reason: '',
    nominal: 0,
    status: 'Pending'
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
  ]);


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

  const filteredData = leaveList.filter(item => {
    const matchSearch = (item.employeeName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (item.employeeId && item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchType = filterType === 'all' || item.leaveType === filterType;
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });
  // Semua relasi HR memakai primary key internal. Nomor EMP hanya untuk tampilan.
  const selectedEmployee = employeeList.find(employee => employee.id === formData.employeeId);
  const leaveYear = formData.startDate?.slice(0, 4) || String(new Date().getFullYear());
  const annualQuota = selectedEmployee?.leaveQuota ?? 12;
  const annualUsed = leaveList
    .filter(leave => leave.employeeId === formData.employeeId && leave.leaveType === 'Annual' && leave.status === 'Approved' && leave.startDate.startsWith(leaveYear))
    .reduce((total, leave) => total + (leave.totalDays ?? leave.days ?? 0), 0);
  const requestedDays = formData.startDate && formData.endDate && formData.endDate >= formData.startDate
    ? Math.floor((Date.parse(`${formData.endDate}T00:00:00Z`) - Date.parse(`${formData.startDate}T00:00:00Z`)) / 86_400_000) + 1 : 0;
  const remainingLeave = Math.max(0, annualQuota - annualUsed);

  const handleViewDetail = (leave: Leave) => {
    setSelectedLeave(leave);
    setShowDetailModal(true);
  };

  const handleApprove = (leave: Leave) => {
    if (processingId) return;
    setProcessingId(leave.id);
    try {
      const updated = { status: 'Approved' as const, approvedBy: 'Manager', approvedDate: new Date().toISOString().split('T')[0] };
      updateLeave(leave.id, updated);
      if (selectedLeave?.id === leave.id) setSelectedLeave({ ...leave, ...updated });
      toast.success(`Pengajuan ${leave.employeeName} disetujui`);
    } catch (err) {
      toast.error('Gagal menyetujui: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (leave: Leave) => {
    setRejectTarget(leave);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!rejectTarget || processingId) return;
    setProcessingId(rejectTarget.id);
    try {
      const updated = { status: 'Rejected' as const, notes: rejectReason };
      updateLeave(rejectTarget.id, updated);
      if (selectedLeave?.id === rejectTarget.id) setSelectedLeave({ ...rejectTarget, ...updated });
      toast.error(`Pengajuan ${rejectTarget.employeeName} ditolak`);
      setShowRejectModal(false);
      setRejectTarget(null);
    } catch (err) {
      toast.error('Gagal menolak pengajuan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const employee = employeeList.find(item => item.id === formData.employeeId);
    const isIsoDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!employee || !isIsoDate(formData.startDate) || !isIsoDate(formData.endDate)) {
      toast.error('Karyawan dan periode cuti wajib diisi dengan benar');
      return;
    }

    const [startYear, startMonth, startDay] = formData.startDate!.split('-').map(Number);
    const [endYear, endMonth, endDay] = formData.endDate!.split('-').map(Number);
    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
    const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
    if (!Number.isFinite(startUtc) || !Number.isFinite(endUtc) || endUtc < startUtc) {
      toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }

    const totalDays = Math.floor((endUtc - startUtc) / 86_400_000) + 1;
    if (formData.leaveType === 'Annual' && totalDays > remainingLeave) {
      toast.error(`Sisa cuti tahunan ${employee.name} hanya ${remainingLeave} hari`);
      return;
    }
    const leaveNo = `LV/${startYear}/${String(startMonth).padStart(2, '0')}/${Date.now().toString().slice(-4)}`;
    const draft: Leave = {
      ...formData,
      id: `leave-${Date.now()}`,
      leaveNo,
      employeeId: employee.id,
      employeeName: employee.name,
      startDate: formData.startDate!,
      endDate: formData.endDate!,
      leaveType: formData.leaveType || 'Annual',
      reason: formData.reason || '',
      status: 'Pending',
      totalDays,
    } as Leave;

    try {
      setIsSubmitting(true);
      await addLeave(draft);
      toast.success('Pengajuan cuti/izin berhasil disubmit');
      setShowModal(false);
      setFormData({ employeeId: '', employeeName: '', leaveType: 'Annual', startDate: '', endDate: '', reason: '', nominal: 0, status: 'Pending' });
    } catch (error) {
      toast.error(`Pengajuan gagal disimpan: ${error instanceof Error ? error.message : 'kesalahan database'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = leaveList.filter(l => l.status === 'Pending').length;
  const approvedCount = leaveList.filter(l => l.status === 'Approved').length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthLeaves = leaveList.filter(l => typeof l.startDate === 'string' && l.startDate.startsWith(currentMonth)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Cuti & Izin</h1>
          <p className="text-gray-600">Kelola pengajuan cuti, izin, dan surat sakit karyawan</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Ajukan Cuti/Izin
        </button>
      </div>

      {/* Stats */}
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

      {/* Filter & Search */}
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

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Leave No</th>
                <th className="px-6 py-3 text-left text-gray-600">Employee</th>
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
                  <td className="px-6 py-4 text-gray-600">{leave.startDate}</td>
                  <td className="px-6 py-4 text-gray-600">{leave.endDate}</td>
                  <td className="px-6 py-4 text-gray-600">{leave.totalDays} hari</td>
                  <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{leave.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(leave.status)}`}>
                      {leave.status}
                    </span>
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
                            disabled={processingId !== null}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="Approve"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => handleReject(leave)}
                            disabled={processingId !== null}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">Ajukan Cuti/Izin</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Karyawan *</label>
                <select
                  value={formData.employeeId}
                  onChange={e => {
                    const emp = employeeList.find(e2 => e2.id === e.target.value);
                    setFormData({ ...formData, employeeId: e.target.value, employeeName: emp?.name ?? '' });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employeeList.filter(e => e.status === 'Active').map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.employeeId} · {e.position} ({e.employmentType})</option>
                  ))}
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
              {formData.employeeId && formData.leaveType === 'Annual' && (
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-center text-sm">
                  <div><p className="text-xs text-blue-600">Hak Tahun Ini</p><b>{annualQuota} hari</b></div>
                  <div><p className="text-xs text-blue-600">Sudah Dipakai</p><b>{annualUsed} hari</b></div>
                  <div><p className="text-xs text-blue-600">Sisa Setelah Pengajuan</p><b>{Math.max(0, remainingLeave - requestedDays)} hari</b></div>
                </div>
              )}

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

              <div>
                <label className="block text-gray-700 mb-2">Nominal (IDR)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.nominal ?? 0}
                  onChange={e => setFormData({ ...formData, nominal: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Submit Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Tolak Pengajuan</h2>
              <button onClick={() => setShowRejectModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Tolak pengajuan <strong>{rejectTarget.leaveType}</strong> dari <strong>{rejectTarget.employeeName}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Penolakan (Opsional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Tulis alasan penolakan..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={confirmReject} disabled={processingId !== null}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-gray-900">Detail Cuti - {selectedLeave.leaveNo}</h2>
                  <p className="text-gray-600 mt-1">{selectedLeave.employeeName}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
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
                  <span className={getTypeColor(selectedLeave.leaveType)}>
                    {selectedLeave.leaveType}
                  </span>
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
                      onClick={() => {
                        handleReject(selectedLeave);
                        setShowDetailModal(false);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        handleApprove(selectedLeave);
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
