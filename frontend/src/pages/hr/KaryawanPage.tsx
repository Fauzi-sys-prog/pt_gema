import { useEffect, useState } from 'react'; import { Plus, Search, Eye, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import type { Employee } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

type HrSummaryResponse = {
  employees?: {
    active?: number;
    permanent?: number;
    contract?: number;
    thl?: number;
  };
};

export default function KaryawanPage() {
  const getApiErrorMessage = (err: any, fallback: string) =>
    String(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const [employeeRows, setEmployeeRows] = useState<Employee[]>([]);
  const safeEmployeeList = employeeRows.filter(Boolean);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hrSummary, setHrSummary] = useState<HrSummaryResponse | null>(null);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [syncingEmployees, setSyncingEmployees] = useState(false);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    identityType: 'KTP',
    identityNumber: '',
    familyStatusCode: '',
    gender: 'L',
    birthDate: '',
    birthPlace: '',
    motherName: '',
    occupationTypeCode: '',
    occupationName: '',
    alternativeOccupationName: '',
    startWorkDate: new Date().toISOString().split('T')[0],
    position: '',
    department: '',
    employmentType: 'Permanent',
    joinDate: new Date().toISOString().split('T')[0],
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    salary: 0,
    status: 'Active',
    leaveQuota: 12
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Inactive': return 'bg-yellow-100 text-yellow-700';
      case 'Resigned': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Permanent': return 'text-blue-600';
      case 'Contract': return 'text-purple-600';
      case 'THL': return 'text-orange-600';
      case 'Internship': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const filteredData = safeEmployeeList.filter(item => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchSearch = String(item.name || '').toLowerCase().includes(keyword) ||
                       String(item.employeeId || '').toLowerCase().includes(keyword) ||
                       String(item.position || '').toLowerCase().includes(keyword);
    const matchType = filterType === 'all' || item.employmentType === filterType;
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleCreate = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      identityType: 'KTP',
      identityNumber: '',
      familyStatusCode: '',
      gender: 'L',
      birthDate: '',
      birthPlace: '',
      motherName: '',
      occupationTypeCode: '',
      occupationName: '',
      alternativeOccupationName: '',
      startWorkDate: new Date().toISOString().split('T')[0],
      position: '',
      department: '',
      employmentType: 'Permanent',
      joinDate: new Date().toISOString().split('T')[0],
      email: '',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      salary: 0,
      status: 'Active'
    });
    setShowModal(true);
  };

  const handleEdit = (employee: Employee) => {
    setIsEditMode(true);
    setFormData(employee);
    setShowModal(true);
  };

  const handleViewDetail = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDetailModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditMode && formData.id) {
        await api.patch(`/employees/${formData.id}`, formData);
        toast.success(`Data karyawan ${formData.name} berhasil diupdate`);
      } else {
        const prefix = formData.employmentType === 'THL' ? 'THL' :
                       formData.employmentType === 'Contract' ? 'CON' :
                       formData.employmentType === 'Internship' ? 'INT' : 'EMP';
        const newEmployee: Employee = {
          ...formData,
          id: `EMP-${Date.now()}`,
          joinDate: String(formData.startWorkDate || formData.joinDate || new Date().toISOString().split('T')[0]),
          employeeId: `${prefix}-${String(safeEmployeeList.filter(e => e.employmentType === formData.employmentType).length + 1).padStart(3, '0')}`
        } as Employee;

        await api.post('/employees', newEmployee);
        toast.success(`Karyawan ${newEmployee.name} berhasil ditambahkan`);
      }
      await Promise.all([loadEmployees(true), loadSummary(true)]);
      setShowModal(false);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Gagal menyimpan data karyawan ke server'));
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (window.confirm(`Hapus data karyawan ${employee.name}?`)) {
      try {
        await api.delete(`/employees/${employee.id}`);
        await Promise.all([loadEmployees(true), loadSummary(true)]);
        toast.success('Data karyawan berhasil dihapus');
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, 'Gagal menghapus data karyawan'));
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const activeEmployees = safeEmployeeList.filter(e => e.status === 'Active').length;
  const permanentEmployees = safeEmployeeList.filter(e => e.employmentType === 'Permanent' && e.status === 'Active').length;
  const contractEmployees = safeEmployeeList.filter(e => e.employmentType === 'Contract' && e.status === 'Active').length;
  const thlEmployees = safeEmployeeList.filter(e => e.employmentType === 'THL' && e.status === 'Active').length;

  const normalizeEmployeeList = (rows: any[]): Employee[] =>
    (Array.isArray(rows) ? rows : []).map((row: any, idx: number) => {
      const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
      const fallbackId = row?.entityId || row?.id || `EMP-ROW-${idx + 1}`;
      return {
        id: payload?.id || fallbackId,
        ...(payload || {}),
      } as Employee;
    });

  const loadEmployees = async (silent = true) => {
    if (!silent) setSyncingEmployees(true);
    try {
      const { data } = await api.get<any[]>('/employees');
      setEmployeeRows(normalizeEmployeeList(data));
      if (!silent) toast.success('Data karyawan berhasil disinkronkan');
    } catch (err: any) {
      if (!silent) toast.error(getApiErrorMessage(err, 'Gagal memuat data karyawan dari server'));
      setEmployeeRows([]);
    } finally {
      if (!silent) setSyncingEmployees(false);
    }
  };

  const loadSummary = async (silent = true) => {
    if (!silent) setSummaryRefreshing(true);
    try {
      const { data } = await api.get<HrSummaryResponse>('/dashboard/hr-summary');
      setHrSummary(data);
      if (!silent) toast.success('HR summary diperbarui');
    } catch (err: any) {
      if (!silent) toast.error(getApiErrorMessage(err, 'Gagal refresh HR summary'));
    } finally {
      if (!silent) setSummaryRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmployees(true);
    loadSummary(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Data Karyawan</h1>
          <p className="text-gray-600">Kelola master data karyawan perusahaan</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadEmployees(false)}
            disabled={syncingEmployees}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {syncingEmployees ? 'Syncing...' : 'Refresh Karyawan'}
          </button>
          <button
            onClick={() => loadSummary(false)}
            disabled={summaryRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {summaryRefreshing ? 'Refreshing...' : 'Refresh Summary'}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Tambah Karyawan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="text-green-600" size={24} />
            </div>
          </div>
          <div className="text-gray-600 mb-2">Total Active</div>
          <div className="text-gray-900">{hrSummary?.employees?.active ?? activeEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Permanent</div>
          <div className="text-gray-900">{hrSummary?.employees?.permanent ?? permanentEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-purple-600 mb-2">Contract</div>
          <div className="text-gray-900">{hrSummary?.employees?.contract ?? contractEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-orange-600 mb-2">THL</div>
          <div className="text-gray-900">{hrSummary?.employees?.thl ?? thlEmployees} Karyawan</div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari karyawan..."
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
            <option value="Permanent">Permanent</option>
            <option value="Contract">Contract</option>
            <option value="THL">THL</option>
            <option value="Internship">Internship</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Resigned">Resigned</option>
          </select>
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
                <th className="px-6 py-3 text-left text-gray-600">NIK</th>
                <th className="px-6 py-3 text-left text-gray-600">Gender</th>
                <th className="px-6 py-3 text-left text-gray-600">TTL</th>
                <th className="px-6 py-3 text-left text-gray-600">Family</th>
                <th className="px-6 py-3 text-left text-gray-600">Position</th>
                <th className="px-6 py-3 text-left text-gray-600">Department</th>
                <th className="px-6 py-3 text-left text-gray-600">Type</th>
                <th className="px-6 py-3 text-left text-gray-600">Join Date</th>
                <th className="px-6 py-3 text-left text-gray-600">Phone</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{employee.employeeId}</td>
                  <td className="px-6 py-4 text-gray-900">{employee.name}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.identityNumber || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.gender || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.birthPlace || '-'}{employee.birthDate ? `, ${employee.birthDate}` : ''}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.familyStatusCode || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.position}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.department}</td>
                  <td className="px-6 py-4">
                    <span className={getTypeColor(employee.employmentType)}>
                      {employee.employmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{employee.joinDate}</td>
                  <td className="px-6 py-4 text-gray-600">{employee.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(employee.status)}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleViewDetail(employee)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                        title="View Detail"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleEdit(employee)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors" 
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteEmployee(employee)}
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
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h2 className="text-gray-900">
                {isEditMode ? `Edit Karyawan - ${formData.employeeId}` : 'Tambah Karyawan Baru'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="text-gray-900 mb-4">Data Pribadi</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Jenis Identitas</label>
                    <select
                      value={formData.identityType || 'KTP'}
                      onChange={(e) => setFormData({ ...formData, identityType: e.target.value as Employee['identityType'] })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="KTP">KTP</option>
                      <option value="SIM">SIM</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Nomor Identitas</label>
                    <input
                      type="text"
                      value={formData.identityNumber || ''}
                      onChange={(e) => setFormData({ ...formData, identityNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Jenis Kelamin</label>
                    <select
                      value={formData.gender || 'L'}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as Employee['gender'] })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="L">L</option>
                      <option value="P">P</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Status Keluarga (K/x)</label>
                    <input
                      type="text"
                      value={formData.familyStatusCode || ''}
                      onChange={(e) => setFormData({ ...formData, familyStatusCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="K/1, TK/0, dst"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.birthDate || ''}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Tempat Lahir</label>
                    <input
                      type="text"
                      value={formData.birthPlace || ''}
                      onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Nama Ibu Kandung</label>
                    <input
                      type="text"
                      value={formData.motherName || ''}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Email</label>
                    <input 
                      type="email" 
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">No. Telepon</label>
                    <input 
                      type="text" 
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Alamat</label>
                    <input 
                      type="text" 
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Employment Info */}
              <div>
                <h3 className="text-gray-900 mb-4">Data Pekerjaan</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Posisi/Jabatan</label>
                    <input 
                      type="text" 
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Department</label>
                    <input 
                      type="text" 
                      value={formData.department || ''}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Jenis Pekerjaan (Kode)</label>
                    <input
                      type="text"
                      value={formData.occupationTypeCode || ''}
                      onChange={(e) => setFormData({ ...formData, occupationTypeCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="contoh: 10 / 21 / 7"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Nama Pekerjaan</label>
                    <input
                      type="text"
                      value={formData.occupationName || ''}
                      onChange={(e) => setFormData({ ...formData, occupationName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Nama Pekerjaan Lain</label>
                    <input
                      type="text"
                      value={formData.alternativeOccupationName || ''}
                      onChange={(e) => setFormData({ ...formData, alternativeOccupationName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Mulai Bekerja</label>
                    <input
                      type="date"
                      value={formData.startWorkDate || formData.joinDate || ''}
                      onChange={(e) => setFormData({ ...formData, startWorkDate: e.target.value, joinDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Tipe Karyawan</label>
                    <select 
                      value={formData.employmentType || 'Permanent'}
                      onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as Employee['employmentType'] })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="THL">THL</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Tanggal Masuk</label>
                    <input 
                      type="date" 
                      value={formData.joinDate || ''}
                      onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Gaji (IDR)</label>
                    <input 
                      type="number" 
                      value={formData.salary || 0}
                      onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Status</label>
                    <select 
                      value={formData.status || 'Active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Employee['status'] })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-gray-900 mb-4">Kontak Darurat</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Nama Kontak Darurat</label>
                    <input 
                      type="text" 
                      value={formData.emergencyContact || ''}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">No. Telepon Darurat</label>
                    <input 
                      type="text" 
                      value={formData.emergencyPhone || ''}
                      onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
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
                  {isEditMode ? 'Update Karyawan' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-gray-900">{selectedEmployee.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedEmployee.employeeId} - {selectedEmployee.position}</p>
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
              {/* Status & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-2">Status</div>
                  <span className={`inline-block px-3 py-1 rounded-full ${getStatusColor(selectedEmployee.status)}`}>
                    {selectedEmployee.status}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-2">Tipe Karyawan</div>
                  <span className={getTypeColor(selectedEmployee.employmentType)}>
                    {selectedEmployee.employmentType}
                  </span>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h3 className="text-gray-900 mb-4">Data Pribadi</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-gray-600 mb-1">Jenis Identitas</div>
                    <div className="text-gray-900">{selectedEmployee.identityType || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Nomor Identitas</div>
                    <div className="text-gray-900">{selectedEmployee.identityNumber || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Jenis Kelamin</div>
                    <div className="text-gray-900">{selectedEmployee.gender || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Status Keluarga</div>
                    <div className="text-gray-900">{selectedEmployee.familyStatusCode || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Tempat, Tanggal Lahir</div>
                    <div className="text-gray-900">
                      {selectedEmployee.birthPlace || '-'}{selectedEmployee.birthDate ? `, ${selectedEmployee.birthDate}` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Nama Ibu Kandung</div>
                    <div className="text-gray-900">{selectedEmployee.motherName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Email</div>
                    <div className="text-gray-900">{selectedEmployee.email}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">No. Telepon</div>
                    <div className="text-gray-900">{selectedEmployee.phone}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-600 mb-1">Alamat</div>
                    <div className="text-gray-900">{selectedEmployee.address}</div>
                  </div>
                </div>
              </div>

              {/* Employment Info */}
              <div>
                <h3 className="text-gray-900 mb-4">Data Pekerjaan</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-gray-600 mb-1">Department</div>
                    <div className="text-gray-900">{selectedEmployee.department}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Jenis Pekerjaan (Kode)</div>
                    <div className="text-gray-900">{selectedEmployee.occupationTypeCode || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Nama Pekerjaan</div>
                    <div className="text-gray-900">{selectedEmployee.occupationName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Nama Pekerjaan Lain</div>
                    <div className="text-gray-900">{selectedEmployee.alternativeOccupationName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Mulai Bekerja</div>
                    <div className="text-gray-900">{selectedEmployee.startWorkDate || selectedEmployee.joinDate || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Tanggal Masuk</div>
                    <div className="text-gray-900">{selectedEmployee.joinDate}</div>
                  </div>
                  {selectedEmployee.endDate && (
                    <div>
                      <div className="text-gray-600 mb-1">Tanggal Berakhir</div>
                      <div className="text-gray-900">{selectedEmployee.endDate}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-600 mb-1">Gaji</div>
                    <div className="text-gray-900">{formatCurrency(selectedEmployee.salary)}</div>
                    <div className="text-gray-500 text-xs mt-1">
                      {selectedEmployee.employmentType === 'THL' ? 'per hari' : 'per bulan'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-gray-900 mb-4">Kontak Darurat</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-gray-600 mb-1">Nama</div>
                    <div className="text-gray-900">{selectedEmployee.emergencyContact}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">No. Telepon</div>
                    <div className="text-gray-900">{selectedEmployee.emergencyPhone}</div>
                  </div>
                </div>
              </div>

              {/* Bank & Government ID */}
              {(selectedEmployee.bank || selectedEmployee.npwp || selectedEmployee.bpjsKesehatan) && (
                <div>
                  <h3 className="text-gray-900 mb-4">Data Bank & Pemerintah</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedEmployee.bank && (
                      <>
                        <div>
                          <div className="text-gray-600 mb-1">Bank</div>
                          <div className="text-gray-900">{selectedEmployee.bank}</div>
                        </div>
                        <div>
                          <div className="text-gray-600 mb-1">No. Rekening</div>
                          <div className="text-gray-900">{selectedEmployee.bankAccount}</div>
                        </div>
                      </>
                    )}
                    {selectedEmployee.npwp && (
                      <div>
                        <div className="text-gray-600 mb-1">NPWP</div>
                        <div className="text-gray-900">{selectedEmployee.npwp}</div>
                      </div>
                    )}
                    {selectedEmployee.bpjsKesehatan && (
                      <div>
                        <div className="text-gray-600 mb-1">BPJS Kesehatan</div>
                        <div className="text-gray-900">{selectedEmployee.bpjsKesehatan}</div>
                      </div>
                    )}
                    {selectedEmployee.bpjsKetenagakerjaan && (
                      <div>
                        <div className="text-gray-600 mb-1">BPJS Ketenagakerjaan</div>
                        <div className="text-gray-900">{selectedEmployee.bpjsKetenagakerjaan}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedEmployee);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit size={18} />
                  Edit Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
