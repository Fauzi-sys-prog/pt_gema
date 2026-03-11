import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

interface Resignation {
  id: string;
  resignNo: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  joinDate: string;
  resignDate: string;
  lastWorkingDate: string;
  reason: string;
  status: 'Submitted' | 'Processing' | 'Completed' | 'Cancelled';
  submittedDate: string;
  noticePeriod: number;
  clearanceStatus?: 'Pending' | 'Completed';
  finalSettlement?: number;
  notes?: string;
}

const RESIGN_RESOURCE = 'hr-resignations';

export default function ResignPage() {
  const getApiErrorMessage = (err: any, fallback: string) =>
    String(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResignation, setSelectedResignation] = useState<Resignation | null>(null);
  const [resignationList, setResignationList] = useState<Resignation[]>([]);
  const [form, setForm] = useState<Partial<Resignation>>({
    employeeId: '',
    employeeName: '',
    position: '',
    department: '',
    joinDate: '',
    resignDate: '',
    lastWorkingDate: '',
    reason: '',
    noticePeriod: 30,
    notes: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/${RESIGN_RESOURCE}`);
        const rows = Array.isArray(res.data) ? res.data : [];
        const parsed = rows.map((row: any, idx: number) => {
          const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
          return { ...(payload || {}), id: payload?.id || row?.entityId || `RESIGN-ROW-${idx + 1}` } as Resignation;
        });
        setResignationList(parsed);
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, `Gagal load ${RESIGN_RESOURCE}`));
        setResignationList([]);
      }
    };
    load();
  }, []);

  const saveList = async (next: Resignation[]) => {
    const body = next.map((item) => ({ entityId: item.id, payload: item }));
    await api.put(`/${RESIGN_RESOURCE}/bulk`, body);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted': return 'bg-yellow-100 text-yellow-700';
      case 'Processing': return 'bg-blue-100 text-blue-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getClearanceColor = (status?: string) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600';
      case 'Completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const filteredData = useMemo(() => resignationList.filter(item => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchSearch = String(item.employeeName || '').toLowerCase().includes(keyword) ||
                       String(item.resignNo || '').toLowerCase().includes(keyword) ||
                       String(item.employeeId || '').toLowerCase().includes(keyword);
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchStatus;
  }), [resignationList, searchTerm, filterStatus]);

  const handleViewDetail = (resignation: Resignation) => {
    setSelectedResignation(resignation);
    setShowDetailModal(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const submittedCount = resignationList.filter(r => r.status === 'Submitted').length;
  const processingCount = resignationList.filter(r => r.status === 'Processing').length;
  const completedCount = resignationList.filter(r => r.status === 'Completed').length;

  const submitResign = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `RES-${Date.now()}`;
    const submittedDate = new Date().toISOString().slice(0, 10);
    const newItem: Resignation = {
      id,
      resignNo: `RES-${new Date().getFullYear()}-${String(resignationList.length + 1).padStart(3, '0')}`,
      employeeId: String(form.employeeId || '').trim(),
      employeeName: String(form.employeeName || '').trim(),
      position: String(form.position || '').trim(),
      department: String(form.department || '').trim(),
      joinDate: String(form.joinDate || ''),
      resignDate: String(form.resignDate || ''),
      lastWorkingDate: String(form.lastWorkingDate || ''),
      reason: String(form.reason || '').trim(),
      status: 'Submitted',
      submittedDate,
      noticePeriod: Number(form.noticePeriod || 30),
      clearanceStatus: 'Pending',
      notes: String(form.notes || '').trim()
    };

    try {
      const next = [newItem, ...resignationList];
      setResignationList(next);
      await saveList(next);
      toast.success(`Resign ${newItem.resignNo} berhasil disubmit`);
      setShowModal(false);
      setForm({ employeeId: '', employeeName: '', position: '', department: '', joinDate: '', resignDate: '', lastWorkingDate: '', reason: '', noticePeriod: 30, notes: '' });
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, `Gagal simpan ${RESIGN_RESOURCE}`));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Resign & Exit</h1>
          <p className="text-gray-600">Kelola proses resign dan exit clearance karyawan</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Submit Resign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Resignations</div>
          <div className="text-gray-900">{resignationList.length} Cases</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-yellow-600 mb-2">Submitted</div>
          <div className="text-gray-900">{submittedCount} Cases</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Processing</div>
          <div className="text-gray-900">{processingCount} Cases</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-green-600 mb-2">Completed</div>
          <div className="text-gray-900">{completedCount} Cases</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari karyawan atau nomor resign..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Status</option>
            <option value="Submitted">Submitted</option>
            <option value="Processing">Processing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">Resign No</th>
                <th className="px-6 py-3 text-left text-gray-600">Employee</th>
                <th className="px-6 py-3 text-left text-gray-600">Position</th>
                <th className="px-6 py-3 text-left text-gray-600">Resign Date</th>
                <th className="px-6 py-3 text-left text-gray-600">Last Working</th>
                <th className="px-6 py-3 text-left text-gray-600">Notice Period</th>
                <th className="px-6 py-3 text-left text-gray-600">Clearance</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((resignation) => (
                <tr key={resignation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{resignation.resignNo}</td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{resignation.employeeName}</div>
                    <div className="text-gray-500 text-xs">{resignation.employeeId}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{resignation.position}</td>
                  <td className="px-6 py-4 text-gray-600">{resignation.resignDate}</td>
                  <td className="px-6 py-4 text-gray-600">{resignation.lastWorkingDate}</td>
                  <td className="px-6 py-4 text-gray-600">{resignation.noticePeriod} days</td>
                  <td className="px-6 py-4">
                    {resignation.clearanceStatus ? (
                      <span className={getClearanceColor(resignation.clearanceStatus)}>
                        {resignation.clearanceStatus}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(resignation.status)}`}>
                      {resignation.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleViewDetail(resignation)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="View Detail"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailModal && selectedResignation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-gray-900">Resignation Detail - {selectedResignation.resignNo}</h2>
                  <p className="text-gray-600 mt-1">{selectedResignation.employeeName}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-gray-900 mb-4">Employee Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><div className="text-gray-600 mb-1">Employee ID</div><div className="text-gray-900">{selectedResignation.employeeId}</div></div>
                  <div><div className="text-gray-600 mb-1">Position</div><div className="text-gray-900">{selectedResignation.position}</div></div>
                  <div><div className="text-gray-600 mb-1">Department</div><div className="text-gray-900">{selectedResignation.department}</div></div>
                  <div><div className="text-gray-600 mb-1">Join Date</div><div className="text-gray-900">{selectedResignation.joinDate}</div></div>
                </div>
              </div>

              <div>
                <h3 className="text-gray-900 mb-4">Resignation Details</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><div className="text-gray-600 mb-1">Submitted Date</div><div className="text-gray-900">{selectedResignation.submittedDate}</div></div>
                  <div><div className="text-gray-600 mb-1">Resign Date</div><div className="text-gray-900">{selectedResignation.resignDate}</div></div>
                  <div><div className="text-gray-600 mb-1">Last Working Date</div><div className="text-gray-900">{selectedResignation.lastWorkingDate}</div></div>
                  <div><div className="text-gray-600 mb-1">Notice Period</div><div className="text-gray-900">{selectedResignation.noticePeriod} days</div></div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg"><div className="text-gray-600 mb-1">Resignation Reason</div><div className="text-gray-900">{selectedResignation.reason}</div></div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-2">Status</div>
                  <span className={`inline-block px-3 py-1 rounded-full ${getStatusColor(selectedResignation.status)}`}>{selectedResignation.status}</span>
                </div>
                {selectedResignation.clearanceStatus && (
                  <div className="p-4 bg-gray-50 rounded-lg"><div className="text-gray-600 mb-1">Exit Clearance</div><span className={getClearanceColor(selectedResignation.clearanceStatus)}>{selectedResignation.clearanceStatus}</span></div>
                )}
              </div>

              {selectedResignation.finalSettlement && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg"><div className="text-green-700 mb-1">Final Settlement</div><div className="text-green-900">{formatCurrency(selectedResignation.finalSettlement)}</div></div>
              )}

              {selectedResignation.notes && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg"><div className="text-blue-700 mb-1">Notes</div><div className="text-blue-900">{selectedResignation.notes}</div></div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <h2 className="text-gray-900 mb-4">Submit Resignation</h2>
            <form className="space-y-4" onSubmit={submitResign}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 mb-2">Employee ID</label><input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.employeeId || ''} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} required /></div>
                <div><label className="block text-gray-700 mb-2">Nama Karyawan</label><input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.employeeName || ''} onChange={(e) => setForm((p) => ({ ...p, employeeName: e.target.value }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 mb-2">Position</label><input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.position || ''} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} required /></div>
                <div><label className="block text-gray-700 mb-2">Department</label><input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.department || ''} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 mb-2">Join Date</label><input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.joinDate || ''} onChange={(e) => setForm((p) => ({ ...p, joinDate: e.target.value }))} required /></div>
                <div><label className="block text-gray-700 mb-2">Notice Period (days)</label><input type="number" min={0} className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.noticePeriod || 30} onChange={(e) => setForm((p) => ({ ...p, noticePeriod: Number(e.target.value) }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 mb-2">Resign Date</label><input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.resignDate || ''} onChange={(e) => setForm((p) => ({ ...p, resignDate: e.target.value }))} required /></div>
                <div><label className="block text-gray-700 mb-2">Last Working Date</label><input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.lastWorkingDate || ''} onChange={(e) => setForm((p) => ({ ...p, lastWorkingDate: e.target.value }))} required /></div>
              </div>
              <div><label className="block text-gray-700 mb-2">Alasan Resign</label><textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.reason || ''} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} required /></div>
              <div><label className="block text-gray-700 mb-2">Catatan</label><textarea rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.notes || ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Tutup</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
