import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Circle, Clock, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

type OnlineState = 'online' | 'away' | 'busy' | 'offline';

type OnlineEmployee = {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  status: OnlineState;
  lastSeen: string;
  location?: string;
  activeMinutes?: number;
  email?: string;
  phone?: string;
};

type Row = {
  id?: string;
  employeeId?: string;
  name?: string;
  position?: string;
  department?: string;
  status?: OnlineState;
  lastSeen?: string;
  location?: string;
  activeMinutes?: number;
  email?: string;
  phone?: string;
};

function statusBadge(status: OnlineState) {
  switch (status) {
    case 'online':
      return { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Online' };
    case 'away':
      return { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Away' };
    case 'busy':
      return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Busy' };
    default:
      return { dot: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50', label: 'Offline' };
  }
}

function formatLastSeen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return date.toLocaleString('id-ID');
}

function toOnlineEmployee(row: Row): OnlineEmployee | null {
  const p = row;
  const id = p.id;
  if (!id || !p.employeeId) return null;

  return {
    id,
    employeeId: String(p.employeeId),
    name: String(p.name || '-'),
    position: String(p.position || '-'),
    department: String(p.department || '-'),
    status: (p.status as OnlineState) || 'offline',
    lastSeen: typeof p.lastSeen === 'string' ? p.lastSeen : new Date().toISOString(),
    location: typeof p.location === 'string' ? p.location : undefined,
    activeMinutes: Number.isFinite(Number(p.activeMinutes)) ? Number(p.activeMinutes) : undefined,
    email: typeof p.email === 'string' ? p.email : undefined,
    phone: typeof p.phone === 'string' ? p.phone : undefined,
  };
}

export default function KaryawanOnlinePage() {
  const { employeeList } = useApp();
  const [rows, setRows] = useState<OnlineEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OnlineState>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadStatuses = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/hr-online-status');
      const apiRows = Array.isArray(res.data) ? res.data : [];
      const mapped = apiRows
        .map((r: Row) => toOnlineEmployee(r))
        .filter((v: OnlineEmployee | null): v is OnlineEmployee => !!v);

      if (mapped.length > 0) {
        setRows(mapped);
      } else if (employeeList.length > 0) {
        const seed = employeeList.map((emp, i) => {
          const id = `online-${emp.id}`;
          return {
            id,
            employeeId: emp.employeeId,
            name: emp.name,
            position: emp.position,
            department: emp.department,
            status: 'offline' as OnlineState,
            lastSeen: new Date(Date.now() - i * 60_000).toISOString(),
            location: undefined,
            activeMinutes: 0,
            email: emp.email,
            phone: emp.phone,
          };
        });
        setRows(seed);

        await api.put(
          '/hr-online-status/bulk',
          seed
        );
      }

      setLastUpdate(new Date());
      if (!silent) toast.success('Status online diperbarui');
    } catch {
      if (!silent) toast.error('Gagal memuat status online');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeList.length]);

  const filteredRows = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase();
    return rows.filter((r) => {
      const matchSearch =
        String(r.name || '').toLowerCase().includes(term) ||
        String(r.position || '').toLowerCase().includes(term) ||
        String(r.department || '').toLowerCase().includes(term);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchDepartment = departmentFilter === 'all' || r.department === departmentFilter;
      return matchSearch && matchStatus && matchDepartment;
    });
  }, [departmentFilter, rows, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      online: rows.filter((e) => e.status === 'online').length,
      away: rows.filter((e) => e.status === 'away').length,
      busy: rows.filter((e) => e.status === 'busy').length,
      offline: rows.filter((e) => e.status === 'offline').length,
      total: rows.length,
    }),
    [rows]
  );

  const departments = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((e) => e.department)))],
    [rows]
  );

  const updateStatus = async (row: OnlineEmployee, status: OnlineState) => {
    const next = { ...row, status, lastSeen: new Date().toISOString() };
    setRows((prev) => prev.map((r) => (r.id === row.id ? next : r)));

    try {
      await api.patch(`/hr-online-status/${row.id}`, next);
      toast.success(`Status ${row.name} => ${status}`);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      toast.error('Gagal update status online');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Karyawan Online</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Real-time employee presence (DB persisted)</p>
        </div>
        <button
          onClick={() => loadStatuses(false)}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw size={18} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4"><div className="text-sm text-gray-600">Online</div><div className="text-2xl font-bold">{stats.online}</div></div>
        <div className="bg-white border border-gray-200 rounded-lg p-4"><div className="text-sm text-gray-600">Away</div><div className="text-2xl font-bold">{stats.away}</div></div>
        <div className="bg-white border border-gray-200 rounded-lg p-4"><div className="text-sm text-gray-600">Busy</div><div className="text-2xl font-bold">{stats.busy}</div></div>
        <div className="bg-white border border-gray-200 rounded-lg p-4"><div className="text-sm text-gray-600">Offline</div><div className="text-2xl font-bold">{stats.offline}</div></div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg p-4"><div className="text-sm opacity-90">Total</div><div className="text-2xl font-bold">{stats.total}</div></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, position, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OnlineState)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="away">Away</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
          <p>Showing {filteredRows.length} of {stats.total} employees</p>
          <p>Last update: {lastUpdate.toLocaleTimeString('id-ID')}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">Employee</th>
                <th className="px-4 py-3 text-left text-gray-600">Position</th>
                <th className="px-4 py-3 text-left text-gray-600">Department</th>
                <th className="px-4 py-3 text-left text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-gray-600">Last Seen</th>
                <th className="px-4 py-3 text-left text-gray-600">Location</th>
                <th className="px-4 py-3 text-left text-gray-600">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((emp) => {
                const b = statusBadge(emp.status);
                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.employeeId}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{emp.position}</td>
                    <td className="px-4 py-3 text-gray-700">{emp.department}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs ${b.bg} ${b.text}`}>
                        <Circle className={`${b.dot} text-transparent`} size={10} />
                        {b.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700"><span className="inline-flex items-center gap-1"><Clock size={14} />{formatLastSeen(emp.lastSeen)}</span></td>
                    <td className="px-4 py-3 text-gray-700"><span className="inline-flex items-center gap-1"><MapPin size={14} />{emp.location || '-'}</span></td>
                    <td className="px-4 py-3">
                      <select
                        value={emp.status}
                        onChange={(e) => updateStatus(emp, e.target.value as OnlineState)}
                        className="px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="online">Online</option>
                        <option value="away">Away</option>
                        <option value="busy">Busy</option>
                        <option value="offline">Offline</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Users className="mx-auto mb-2" size={24} />
            No employees found
          </div>
        )}
      </div>
    </div>
  );
}
