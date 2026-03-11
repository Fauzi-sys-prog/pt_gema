import { useMemo, useState } from 'react'; import { Plus, Search, Edit2, Trash2, Shield, User as UserIcon, Mail, Phone } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { User } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';
import { getRoleLabel, isOwnerLike } from '../../utils/roles';

export default function UserManagementPage() {
  const { userList, refreshAll } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    email: '',
    fullName: '',
    role: 'OWNER',
    phone: '',
    status: 'Active',
  });

  const ROLE_OPTIONS: Array<User['role']> = [
    'OWNER',
    'SPV',
    'ADMIN',
    'SALES',
    'FINANCE',
    'SUPPLY_CHAIN',
    'PRODUKSI',
  ];

  const normalizedUsers = useMemo(
    () =>
      (userList || []).map((user) => ({
        ...user,
        fullName: user.fullName || user.name || user.username || '-',
        status: user.status || (user.isActive ? 'Active' : 'Inactive'),
        phone: user.phone || '-',
      })),
    [userList]
  );

  const filteredUsers = normalizedUsers.filter((user) => {
    const matchSearch =
      String(user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || user.role === filterRole;
    const matchStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          email: String(formData.email || '').trim(),
          username: String(formData.username || '').trim(),
          name: String(formData.fullName || '').trim(),
          phone: String(formData.phone || '').trim(),
          role: formData.role,
          isActive: formData.status === 'Active',
        });
        toast.success('User berhasil diupdate');
      } else {
        const password = String((formData as any).password || '').trim();
        const hasLetter = /[A-Za-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (password.length < 10 || !hasLetter || !hasNumber) {
          toast.error('Password minimal 10 karakter dan wajib mengandung huruf + angka');
          return;
        }
        await api.post('/users', {
          email: String(formData.email || '').trim(),
          username: String(formData.username || '').trim(),
          name: String(formData.fullName || '').trim(),
          phone: String(formData.phone || '').trim(),
          password,
          role: formData.role,
        });
        toast.success('User berhasil ditambahkan');
      }

      await refreshAll();
      setShowModal(false);
      setEditingUser(null);
      resetForm();
    } catch (err: any) {
      const msg = String(err?.response?.data?.error || 'Gagal menyimpan user');
      toast.error(msg);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      status: user.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (user: User) => {
    if (window.confirm(`Nonaktifkan user ${user.fullName || user.username}?`)) {
      try {
        await api.delete(`/users/${user.id}`);
        toast.success('User berhasil dinonaktifkan');
        await refreshAll();
      } catch (err: any) {
        const msg = String(err?.response?.data?.error || 'Gagal menonaktifkan user');
        toast.error(msg);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      fullName: '',
      role: 'OWNER',
      phone: '',
      status: 'Active',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-slate-100 text-slate-700';
      case 'SPV':
        return 'bg-blue-100 text-blue-700';
      case 'PRODUKSI':
        return 'bg-indigo-100 text-indigo-700';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'FINANCE':
        return 'bg-green-100 text-green-700';
      case 'SUPPLY_CHAIN':
        return 'bg-yellow-100 text-yellow-700';
      case 'SALES':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Users</div>
          <div className="text-gray-900">{userList.length} users</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-green-600 mb-2">Active Users</div>
          <div className="text-gray-900">
            {normalizedUsers.filter((u) => u.status === 'Active').length} users
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-purple-600 mb-2">Admins</div>
          <div className="text-gray-900">
            {normalizedUsers.filter((u) => u.role === 'ADMIN').length} users
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-blue-600 mb-2">Owner / SPV</div>
          <div className="text-gray-900">
            {normalizedUsers.filter((u) => isOwnerLike(u.role)).length} users
          </div>
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
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role)}
              </option>
            ))}
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
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
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
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-gray-900">
                {editingUser ? 'Edit User' : 'Tambah User Baru'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  <label className="block text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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

              <div className="grid grid-cols-1 gap-4">
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
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>
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
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingUser ? 'Update' : 'Tambah'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
