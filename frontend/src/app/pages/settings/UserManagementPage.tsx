import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Shield, User as UserIcon, Mail, Phone } from 'lucide-react';
import { useApp, type User } from '../../contexts/AppContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { toast } from 'sonner';

export default function UserManagementPage() {
  const { userList, addUser, updateUser, deleteUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: 'User',
    department: '',
    phone: '',
    status: 'Active',
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
  ]);


  const filteredUsers = userList.filter((user) => {
    const matchSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || user.role === filterRole;
    const matchStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const username = formData.username?.trim().toLowerCase() || '';
    const email = formData.email?.trim().toLowerCase() || '';
    const fullName = formData.fullName?.trim() || '';
    const password = formData.password?.trim() || '';
    setFormError(null);

    if (!fullName || !username || !email) {
      setFormError('Nama lengkap, username, dan email wajib diisi.');
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      setFormError('Username 3-32 karakter: huruf kecil, angka, titik, underscore, atau dash.');
      return;
    }
    if (!editingUser && (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      setFormError('Password minimal 10 karakter serta harus mengandung huruf dan angka.');
      return;
    }
    if (!editingUser) {
      const duplicate = userList.find((user) =>
        user.username.trim().toLowerCase() === username || user.email.trim().toLowerCase() === email
      );
      if (duplicate) {
        setFormError(`Username atau email sudah dipakai oleh ${duplicate.fullName}. Gunakan data lain.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        updateUser(editingUser.id, { ...formData, username, email, fullName });
        toast.success('User berhasil diupdate.');
      } else {
        await addUser({
          ...formData,
          username,
          email,
          fullName,
          password,
          id: `user-${Date.now()}`,
          createdAt: new Date().toISOString().split('T')[0],
        } as User);
      }
      setShowModal(false);
      setEditingUser(null);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kesalahan server';
      setFormError(message);
      toast.error(`User gagal ditambahkan: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormError(null);
    setFormData({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      phone: user.phone,
      status: user.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (user: User) => {
    if (isSubmitting) return;
    const confirmed = window.confirm(
      `HAPUS PERMANEN user ${user.fullName}?\n\nData user akan dihapus dari database dan tidak bisa dikembalikan.`
    );
    if (!confirmed) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await deleteUser(user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kesalahan server';
      setFormError(message);
      toast.error(`User gagal dihapus: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      email: '',
      fullName: '',
      role: 'Operasional & Produksi',
      department: '',
      phone: '',
      status: 'Active',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':                return 'bg-purple-100 text-purple-700';
      case 'Owner':                return 'bg-amber-100 text-amber-700';
      case 'Finance & Accounting': return 'bg-emerald-100 text-emerald-700';
      case 'Sales & Marketing':    return 'bg-blue-100 text-blue-700';
      case 'Operasional & Produksi': return 'bg-orange-100 text-orange-700';
      case 'HR':                   return 'bg-pink-100 text-pink-700';
      case 'HSE':                  return 'bg-teal-100 text-teal-700';
      default:                     return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'Active'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">User Management</h1>
          <p className="text-gray-600">Kelola user dan hak akses sistem</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormError(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Tambah User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2 text-sm font-bold">Total Users</div>
          <div className="text-gray-900 text-xl font-black">{userList.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-green-600 mb-2 text-sm font-bold">Active</div>
          <div className="text-gray-900 text-xl font-black">{userList.filter((u) => u.status === 'Active').length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-purple-600 mb-2 text-sm font-bold">Admin / Owner</div>
          <div className="text-gray-900 text-xl font-black">{userList.filter((u) => u.role === 'Admin' || u.role === 'Owner').length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-slate-500 mb-2 text-sm font-bold">Inactive</div>
          <div className="text-gray-900 text-xl font-black">{userList.filter((u) => u.status !== 'Active').length}</div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Cari user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Role</option>
            <option value="Finance & Accounting">Finance & Accounting</option>
            <option value="Sales & Marketing">Sales & Marketing</option>
            <option value="Operasional & Produksi">Operasional & Produksi</option>
            <option value="HR">HR</option>
            <option value="HSE">HSE</option>
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">User</th>
                <th className="px-6 py-3 text-left text-gray-600">Username</th>
                <th className="px-6 py-3 text-left text-gray-600">Email</th>
                <th className="px-6 py-3 text-left text-gray-600">Role</th>
                <th className="px-6 py-3 text-left text-gray-600">Department</th>
                <th className="px-6 py-3 text-left text-gray-600">Phone</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Last Login</th>
                <th className="px-6 py-3 text-left text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="text-blue-600" size={20} />
                      </div>
                      <div>
                        <div className="text-gray-900">{user.fullName}</div>
                        <div className="text-gray-500 text-xs">{user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{user.username}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={16} />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full flex items-center gap-1 w-fit ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      <Shield size={14} />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.department}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={16} />
                      {user.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full ${getStatusBadgeColor(
                        user.status
                      )}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString('id-ID')
                      : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={isSubmitting}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title="Hapus permanen user"
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
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">
                {editingUser ? 'Edit User' : 'Tambah User Baru'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-gray-700 mb-2">Password * <span className="text-xs text-gray-500">(min. 10 karakter, huruf & angka)</span></label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    minLength={10}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as User['role'],
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Finance & Accounting">Finance & Accounting</option>
                    <option value="Sales & Marketing">Sales & Marketing</option>
                    <option value="Operasional & Produksi">Operasional & Produksi</option>
                    <option value="HR">HR</option>
                    <option value="HSE">HSE</option>
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Department *</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'Active' | 'Inactive',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    setFormError(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : `${editingUser ? 'Update' : 'Tambah'} User`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
