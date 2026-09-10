import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter,
  Circle,
  Clock,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Eye,
  Activity,
  Wifi,
  WifiOff,
  Download,
  RefreshCw,
  X
} from 'lucide-react';
import { useIsMobile } from '../../components/mobile/ResponsiveView';
import { MobileCard } from '../../components/mobile/MobileCard';
import { useApp, type OnlineEmployee } from '../../contexts/AppContext';

export default function KaryawanOnlinePage() {
  const isMobile = useIsMobile();
  const { employeeList, onlineEmployeeList, addOnlineEmployee, updateOnlineEmployee } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'away' | 'busy' | 'offline'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<OnlineEmployee | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Initialize online employee status from employeeList
  useEffect(() => {
    if (onlineEmployeeList.length === 0 && employeeList.length > 0) {
      // Create initial online status for existing employees
      employeeList.forEach((emp, index) => {
        const statusOptions: ('online' | 'away' | 'busy' | 'offline')[] = ['online', 'away', 'busy', 'offline'];
        const randomStatus = statusOptions[index % 4]; // Distribute statuses
        
        const onlineEmp: OnlineEmployee = {
          id: `online-${emp.id}`,
          employeeId: emp.id,
          name: emp.name,
          position: emp.position,
          department: emp.department,
          status: randomStatus,
          lastSeen: new Date(),
          location: randomStatus === 'offline' ? undefined : (index % 2 === 0 ? 'Jakarta Office' : 'Remote'),
          device: randomStatus === 'offline' ? undefined : (index % 3 === 0 ? 'Windows Desktop' : index % 3 === 1 ? 'MacBook Pro' : 'iPhone'),
          ipAddress: randomStatus === 'offline' ? undefined : `192.168.1.${100 + index}`,
          loginTime: randomStatus === 'offline' ? undefined : new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
          activeTime: randomStatus === 'offline' ? undefined : (index + 1) * 30,
          email: emp.email,
          phone: emp.phone
        };
        
        addOnlineEmployee(onlineEmp);
      });
    }
  }, [employeeList, onlineEmployeeList, addOnlineEmployee]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      // Randomly update some employees' status  
      onlineEmployeeList.forEach(emp => {
        const random = Math.random();
        if (random > 0.95) { // 5% chance to change status
          const statuses: ('online' | 'away' | 'busy')[] = ['online', 'away', 'busy'];
          updateOnlineEmployee(emp.id, {
            status: statuses[Math.floor(Math.random() * statuses.length)],
            lastSeen: new Date()
          });
        }
        if (emp.status === 'online' && emp.activeTime) {
          updateOnlineEmployee(emp.id, {
            activeTime: emp.activeTime + 1
          });
        }
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [onlineEmployeeList, updateOnlineEmployee]);

  // Filter employees
  const filteredEmployees = onlineEmployeeList.filter(emp => {
    const name = (emp.name || '').toLowerCase();
    const position = (emp.position || '').toLowerCase();
    const department = (emp.department || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch = name.includes(q) || position.includes(q) || department.includes(q);
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || (emp.department || '') === departmentFilter;
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Statistics
  const stats = {
    online: onlineEmployeeList.filter(e => e.status === 'online').length,
    away: onlineEmployeeList.filter(e => e.status === 'away').length,
    busy: onlineEmployeeList.filter(e => e.status === 'busy').length,
    offline: onlineEmployeeList.filter(e => e.status === 'offline').length,
    total: onlineEmployeeList.length
  };

  const departments = ['all', ...Array.from(new Set(onlineEmployeeList.map(e => e.department)))];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'online':
        return { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Online' };
      case 'away':
        return { color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Away' };
      case 'busy':
        return { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Busy' };
      case 'offline':
        return { color: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50', label: 'Offline' };
      default:
        return { color: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50', label: 'Unknown' };
    }
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return date.toLocaleString('id-ID');
  };

  const formatActiveTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
    // Simulate refresh animation
  };

  const exportData = () => {
    const csv = [
      ['Name', 'Position', 'Department', 'Status', 'Last Seen', 'Location', 'Active Time'],
      ...filteredEmployees.map(emp => [
        emp.name,
        emp.position,
        emp.department,
        emp.status,
        formatLastSeen(emp.lastSeen),
        emp.location || '-',
        formatActiveTime(emp.activeTime || 0)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karyawan-online-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Karyawan Online</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Real-time employee presence monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            <span className="hidden lg:inline">Refresh</span>
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            <span className="hidden lg:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="fill-green-500 text-green-500" size={12} />
            <span className="text-sm text-gray-600">Online</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.online}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="fill-yellow-500 text-yellow-500" size={12} />
            <span className="text-sm text-gray-600">Away</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.away}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="fill-red-500 text-red-500" size={12} />
            <span className="text-sm text-gray-600">Busy</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.busy}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="fill-gray-400 text-gray-400" size={12} />
            <span className="text-sm text-gray-600">Offline</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.offline}</div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} />
            <span className="text-sm opacity-90">Total</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, position, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {filteredEmployees.length} of {stats.total} employees
          </p>
          <p className="text-xs text-gray-500">
            Last update: {lastUpdate.toLocaleTimeString('id-ID')}
          </p>
        </div>
      </div>

      {/* Employee List */}
      {isMobile ? (
        // Mobile Card View
        <div className="space-y-3">
          {filteredEmployees.map(emp => {
            const statusConfig = getStatusConfig(emp.status);
            return (
              <div
                key={emp.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
                onClick={() => setSelectedEmployee(emp)}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                      {((emp.name || '?').split(' ')).map(n => n[0]).join('')}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusConfig.color} border-2 border-white rounded-full`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                    <p className="text-sm text-gray-600">{emp.position}</p>
                    <p className="text-xs text-gray-500">{emp.department}</p>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock size={14} />
                        <span>{formatLastSeen(emp.lastSeen)}</span>
                      </div>
                      {emp.location && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin size={14} />
                          <span>{emp.location}</span>
                        </div>
                      )}
                      {emp.activeTime && emp.status !== 'offline' && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Activity size={14} />
                          <span>Active: {formatActiveTime(emp.activeTime)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                      {emp.device && (
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                          {emp.device}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop Table View
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map(emp => {
                  const statusConfig = getStatusConfig(emp.status);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                              {((emp.name || '?').split(' ')).map(n => n[0]).join('')}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusConfig.color} border-2 border-white rounded-full`} />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{emp.name}</div>
                            <div className="text-sm text-gray-600">{emp.position}</div>
                            <div className="text-xs text-gray-500">{emp.department}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          {formatLastSeen(emp.lastSeen)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} />
                          {emp.location || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {emp.device || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {emp.status !== 'offline' && emp.activeTime ? (
                          <div className="flex items-center gap-2">
                            <Activity size={14} className="text-green-600" />
                            {formatActiveTime(emp.activeTime)}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedEmployee(emp)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={`mailto:${emp.email}`}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Send Email"
                          >
                            <Mail size={16} />
                          </a>
                          <a
                            href={`tel:${emp.phone}`}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Call"
                          >
                            <Phone size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <WifiOff className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No employees found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                      {((selectedEmployee.name || '?').split(' ')).map(n => n[0]).join('')}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getStatusConfig(selectedEmployee.status).color} border-2 border-white rounded-full`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                    <p className="text-gray-600">{selectedEmployee.position}</p>
                    <p className="text-sm text-gray-500">{selectedEmployee.department}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Status Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Current Status</div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusConfig(selectedEmployee.status).bg} ${getStatusConfig(selectedEmployee.status).text}`}>
                      {getStatusConfig(selectedEmployee.status).label}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Last Seen</div>
                    <div className="font-medium text-gray-900">{formatLastSeen(selectedEmployee.lastSeen)}</div>
                  </div>
                  {selectedEmployee.loginTime && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Login Time</div>
                      <div className="font-medium text-gray-900">
                        {selectedEmployee.loginTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  {selectedEmployee.activeTime && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Active Time Today</div>
                      <div className="font-medium text-gray-900">{formatActiveTime(selectedEmployee.activeTime)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="text-gray-400" size={20} />
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">Email</div>
                      <a href={`mailto:${selectedEmployee.email}`} className="text-blue-600 hover:underline">
                        {selectedEmployee.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="text-gray-400" size={20} />
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">Phone</div>
                      <a href={`tel:${selectedEmployee.phone}`} className="text-blue-600 hover:underline">
                        {selectedEmployee.phone}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="text-gray-400" size={20} />
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">Location</div>
                      <div className="text-gray-900">{selectedEmployee.location || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Device Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Device</div>
                    <div className="font-medium text-gray-900">{selectedEmployee.device || '-'}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">IP Address</div>
                    <div className="font-mono text-sm text-gray-900">{selectedEmployee.ipAddress || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href={`mailto:${selectedEmployee.email}`}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
                >
                  <Mail size={18} className="inline mr-2" />
                  Send Email
                </a>
                <a
                  href={`tel:${selectedEmployee.phone}`}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
                >
                  <Phone size={18} className="inline mr-2" />
                  Call
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}