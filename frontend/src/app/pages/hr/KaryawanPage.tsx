import { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, type Employee, type EmployeeCompensation } from '../../contexts/AppContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function KaryawanPage() {
  const { employeeList, addEmployee, updateEmployee, deleteEmployee, employeeCompensations, setEmployeeCompensation, payrollPolicy } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
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
    leaveQuota: 12,
    bank: '', bankAccount: '', npwp: '', bpjsKesehatan: '', bpjsKetenagakerjaan: '',
    jatahKasbonAmount: 0, potonganPerKasbon: 0,
  });

  const defaultComp = { baseSalary: 0, transportAllowance: 0, mealAllowancePerDay: 25000, maximumIncentive: 0, positionAllowance: 0, overtimeRate: 0, bpjsKetEmployerPct: 0, bpjsKetEmployeePct: 0, bpjsKesPct: 0 };
  const [compForm, setCompForm] = useState(defaultComp);

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
  ]);


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

  const filteredData = employeeList.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || item.employmentType === filterType;
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleCreate = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
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
      status: 'Active', leaveQuota: 12,
      bank: '', bankAccount: '', npwp: '', bpjsKesehatan: '', bpjsKetenagakerjaan: '',
      jatahKasbonAmount: 0, potonganPerKasbon: 0,
    });
    setCompForm({ ...defaultComp });
    setShowModal(true);
  };

  const handleEdit = (employee: Employee) => {
    setIsEditMode(true);
    setFormData(employee);
    const existing = employeeCompensations.find(c => c.employeeId === employee.id);
    setCompForm(existing ? {
      baseSalary: existing.baseSalary,
      transportAllowance: existing.transportAllowance,
      mealAllowancePerDay: existing.mealAllowancePerDay,
      maximumIncentive: existing.maximumIncentive,
      positionAllowance: existing.positionAllowance,
      overtimeRate: existing.overtimeRate,
      bpjsKetEmployerPct: existing.bpjsKetEmployerAmount ?? existing.bpjsKetEmployerPct ?? 0,
      bpjsKetEmployeePct: existing.bpjsKetEmployeeAmount ?? existing.bpjsKetEmployeePct ?? 0,
      bpjsKesPct:         existing.bpjsKesEmployeeAmount ?? existing.bpjsKesPct ?? 0,
    } : { ...defaultComp, baseSalary: employee.salary ?? 0 });
    setShowModal(true);
  };

  const handleViewDetail = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDetailModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const empId = isEditMode && formData.id ? formData.id : String(Date.now());

    setIsSubmitting(true);
    try {
      if (isEditMode && formData.id) {
        updateEmployee(formData.id, formData);
      } else {
        const prefix = formData.employmentType === 'THL' ? 'THL' :
                       formData.employmentType === 'Contract' ? 'CON' :
                       formData.employmentType === 'Internship' ? 'INT' : 'EMP';
        const newEmployee: Employee = {
          ...formData,
          id: empId,
          employeeId: `${prefix}-${String(employeeList.filter(e => e.employmentType === formData.employmentType).length + 1).padStart(3, '0')}`
        } as Employee;
        addEmployee(newEmployee);
      }

      // Save compensation if any fields filled
      if (compForm.baseSalary > 0 || compForm.transportAllowance > 0 || compForm.maximumIncentive > 0) {
        const comp: EmployeeCompensation = {
          id: `COMP-${empId}`,
          employeeId: empId,
          baseSalary: compForm.baseSalary || formData.salary || 0,
          transportAllowance: compForm.transportAllowance,
          mealAllowancePerDay: compForm.mealAllowancePerDay,
          maximumIncentive: compForm.maximumIncentive,
          positionAllowance: compForm.positionAllowance,
          overtimeRate: compForm.overtimeRate,
          bpjsKetEmployerPct: compForm.bpjsKetEmployerPct,
          bpjsKetEmployeePct: compForm.bpjsKetEmployeePct,
          bpjsKesPct:         compForm.bpjsKesPct,
          bpjsKetEmployerAmount: compForm.bpjsKetEmployerPct,
          bpjsKetEmployeeAmount: compForm.bpjsKetEmployeePct,
          bpjsKesEmployeeAmount: compForm.bpjsKesPct,
          effectiveDate: new Date().toISOString().split('T')[0],
        };
        setEmployeeCompensation(comp);
      }

      toast.success(isEditMode ? `Data ${formData.name} diperbarui` : `Karyawan ${formData.name} ditambahkan`);
      setShowModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan data karyawan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = (employee: Employee) => {
    if (processingId) return;
    if (!window.confirm(`Hapus data karyawan ${employee.name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setProcessingId(employee.id);
    try {
      deleteEmployee(employee.id);
      toast.success(`Data ${employee.name} dihapus`);
    } catch (err) {
      toast.error('Gagal menghapus karyawan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const activeEmployees = employeeList.filter(e => e.status === 'Active').length;
  const permanentEmployees = employeeList.filter(e => e.employmentType === 'Permanent' && e.status === 'Active').length;
  const contractEmployees = employeeList.filter(e => e.employmentType === 'Contract' && e.status === 'Active').length;
  const thlEmployees = employeeList.filter(e => e.employmentType === 'THL' && e.status === 'Active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Data Karyawan</h1>
          <p className="text-gray-600">Kelola master data karyawan perusahaan</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Tambah Karyawan
        </button>
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
          <div className="text-gray-900">{activeEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Permanent</div>
          <div className="text-gray-900">{permanentEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-purple-600 mb-2">Contract</div>
          <div className="text-gray-900">{contractEmployees} Karyawan</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-orange-600 mb-2">THL</div>
          <div className="text-gray-900">{thlEmployees} Karyawan</div>
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
                        disabled={processingId !== null}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
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
                    <label className="block text-gray-700 mb-2">Gaji Pokok (IDR)</label>
                    <input
                      type="number"
                      value={formData.salary || 0}
                      onChange={(e) => { const v = Number(e.target.value); setFormData({ ...formData, salary: v }); setCompForm(f => ({ ...f, baseSalary: v })); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Rate Lembur / Jam (IDR)</label>
                    <input
                      type="number"
                      value={compForm.overtimeRate || 0}
                      onChange={(e) => setCompForm(f => ({ ...f, overtimeRate: Number(e.target.value) }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      min="0"
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
                  {(formData.employmentType === 'Contract' || formData.employmentType === 'THL' || formData.employmentType === 'Internship') && (
                    <div>
                      <label className="block text-gray-700 mb-2">Tanggal Akhir Kontrak</label>
                      <input
                        type="date"
                        value={(formData as any).endDate || ''}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value } as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                  {formData.status === 'Resigned' && (
                    <div>
                      <label className="block text-gray-700 mb-2">Tanggal Resign</label>
                      <input
                        type="date"
                        value={(formData as any).resignDate || ''}
                        onChange={(e) => setFormData({ ...formData, resignDate: e.target.value } as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-gray-900 mb-4">Data Payroll & Kepesertaan</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-gray-700 mb-2">Bank Payroll</label><input type="text" value={formData.bank || ''} onChange={e => setFormData({ ...formData, bank: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="BCA / Mandiri / BNI" /></div>
                  <div><label className="block text-gray-700 mb-2">Nomor Rekening</label><input type="text" value={formData.bankAccount || ''} onChange={e => setFormData({ ...formData, bankAccount: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">NPWP</label><input type="text" value={formData.npwp || ''} onChange={e => setFormData({ ...formData, npwp: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">No. BPJS Kesehatan</label><input type="text" value={formData.bpjsKesehatan || ''} onChange={e => setFormData({ ...formData, bpjsKesehatan: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">No. BPJS Ketenagakerjaan</label><input type="text" value={formData.bpjsKetenagakerjaan || ''} onChange={e => setFormData({ ...formData, bpjsKetenagakerjaan: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">Kuota Cuti / Tahun</label><input type="number" min="0" value={formData.leaveQuota ?? 12} onChange={e => setFormData({ ...formData, leaveQuota: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">Batas Kasbon (IDR)</label><input type="number" min="0" value={formData.jatahKasbonAmount ?? 0} onChange={e => setFormData({ ...formData, jatahKasbonAmount: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-gray-700 mb-2">Potongan Kasbon / Periode</label><input type="number" min="0" value={formData.potonganPerKasbon ?? 0} onChange={e => setFormData({ ...formData, potonganPerKasbon: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                </div>
              </div>

              {/* BPJS Deduction Inputs */}
              <div>
                <h3 className="text-gray-900 mb-4">Potongan</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Jenis Potongan</th>
                        <th className="px-3 py-2 text-right font-medium w-48">Nominal / Bulan (IDR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Potongan BPJSTK Perusahaan', key: 'bpjsKetEmployerPct' as const },
                        { label: 'Potongan BPJSTK Pekerja',    key: 'bpjsKetEmployeePct' as const },
                        { label: 'Potongan JKN - KIS',          key: 'bpjsKesPct'         as const },
                      ].map((row, i) => (
                        <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-700">{row.label}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              step="1000"
                              min="0"
                              value={compForm[row.key] ?? 0}
                              onChange={e => setCompForm(f => ({ ...f, [row.key]: parseFloat(e.target.value) || 0 }))}
                              className="w-40 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">Potongan Insentif Hari Kerja</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-400 italic">Otomatis dari Alpha / Izin / Sakit</td>
                      </tr>
                    </tbody>
                  </table>
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
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Menyimpan...' : isEditMode ? 'Update Karyawan' : 'Simpan Karyawan'}
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
