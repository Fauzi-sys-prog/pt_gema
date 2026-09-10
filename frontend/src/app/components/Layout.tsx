import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Toaster, toast } from 'sonner';
import {
  LayoutDashboard,
  FileText,
  Calculator,
  Briefcase,
  Receipt,
  ShoppingCart,
  Package,
  Archive,
  BarChart3,
  Users,
  Wallet,
  Menu,
  X,
  Hammer,
  Truck,
  Mail,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Database,
  ClipboardList,
  Building2,
  DollarSign,
  Book,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

const FEATURES = { performanceReview: false };

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  path?: string;
  submenu?: { title: string; path: string }[];
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const handleChangePassword = async () => {
    if (pwdSubmitting) return;
    if (!pwdForm.current || !pwdForm.next || !pwdForm.confirm) {
      toast.error('Semua kolom wajib diisi');
      return;
    }
    if (pwdForm.next.length < 10 || !/[A-Za-z]/.test(pwdForm.next) || !/[0-9]/.test(pwdForm.next)) {
      toast.error('Password baru minimal 10 karakter, harus ada huruf dan angka');
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }
    if (pwdForm.next === pwdForm.current) {
      toast.error('Password baru harus berbeda dari password lama');
      return;
    }
    setPwdSubmitting(true);
    try {
      const { default: api } = await import('../services/api');
      await api.request('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
      });
      toast.success('Password berhasil diganti. Silakan login ulang dengan password baru.');
      setShowPwdModal(false);
      setPwdForm({ current: '', next: '', confirm: '' });
      setTimeout(() => { logout(); navigate('/login'); }, 1500);
    } catch (err) {
      toast.error('Gagal ganti password: ' + (err instanceof Error ? err.message : 'Password lama salah atau syarat belum terpenuhi'));
    } finally {
      setPwdSubmitting(false);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['Dashboard']);
  const [logoSrc, setLogoSrc] = useState('');

  useEffect(() => {
    import('figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png')
      .then((m: { default: string }) => setLogoSrc(m.default))
      .catch(() => {});
  }, []);

  // Auto-close sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);

  const hasAccessToMenu = (menuTitle: string): boolean => {
    if (!currentUser) return false;
    const role = currentUser.role;
    // Full access roles
    if ([
      'Admin',
      'Owner',
      'Manager',
      'SPV',
      'Finance & Accounting',
      'Sales & Marketing',
      'Operasional & Produksi',
      'HR',
      'HSE',
    ].includes(role)) return true;
    const accessMap: Record<string, string[]> = {
      'Dashboard':          ['Finance & Accounting', 'Sales & Marketing', 'Operasional & Produksi', 'HR', 'HSE'],
      'Project':            ['Sales & Marketing', 'Operasional & Produksi'],
      'Surat Menyurat':     ['HR', 'Operasional & Produksi'],
      'Supply Chain Hub':   ['Operasional & Produksi', 'Finance & Accounting'],
      'Production':         ['Operasional & Produksi', 'HSE'],
      'Asset & Rental':     ['Operasional & Produksi'],
      'HR':                 ['HR'],
      'Commercial & Sales': ['Sales & Marketing', 'Finance & Accounting'],
      'Finance & Ledger':   ['Finance & Accounting'],
      'Data Collection':    ['Sales & Marketing', 'Operasional & Produksi'],
      'HSE':                ['HSE', 'Operasional & Produksi'],
      'Settings':           ['Admin'],
    };
    return accessMap[menuTitle]?.includes(role) || false;
  };

  const menuItems: MenuItem[] = [
    { title: 'Guide Book', icon: <Book size={20} />, path: '/guide-book' },
    { title: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { title: 'Project', icon: <Briefcase size={20} />, path: '/project' },
    {
      title: 'Production', icon: <Hammer size={20} />,
      submenu: [
        { title: 'Control Center', path: '/produksi/dashboard' },
        { title: 'Laporan Harian (LHP)', path: '/produksi/report' },
        { title: 'Timeline & Tracker', path: '/produksi/timeline' },
        { title: 'Gantt Chart', path: '/produksi/gantt' },
        { title: 'Quality Control (QC)', path: '/produksi/qc' },
        { title: 'Production Guide', path: '/produksi/guide' },
      ]
    },
    {
      title: 'Supply Chain Hub', icon: <Package size={20} />,
      submenu: [
        { title: 'Purchase Order', path: '/purchasing/purchase-order' },
        { title: 'Receiving', path: '/purchasing/receiving' },
        { title: 'Stok Masuk (Receiving)', path: '/inventory/stock-in' },
        { title: 'Stok Keluar (Issue)', path: '/inventory/stock-out' },
        { title: 'Monitoring Gudang', path: '/inventory/center' },
      ]
    },
    {
      title: 'Commercial & Sales', icon: <Calculator size={20} />,
      submenu: [
        { title: 'Quotation Management', path: '/sales/quotation' },
        { title: 'Quotation Approval', path: '/sales/quotation-approval' },
        { title: 'Sales Analytics', path: '/sales/analytics' }
      ]
    },
    {
      title: 'Finance & Ledger', icon: <Wallet size={20} />,
      submenu: [
        { title: 'Executive Command Center', path: '/finance/executive-dashboard' },
        { title: 'Laporan Payroll Owner', path: '/finance/payroll-report' },
        { title: 'Financial Approval Center', path: '/finance/approvals' },
        { title: 'AR/AP Cash Flow Command', path: '/finance/cashflow-command' },
        { title: 'Project Profit & Loss', path: '/finance/project-analysis' },
        { title: 'General Ledger', path: '/finance/ledger' },
        { title: 'Laporan Pajak PPN', path: '/finance/ppn' },
        { title: 'Aging AR (Analisis Umur Piutang)', path: '/finance/aging-ar' },
        { title: 'Customer Invoice & AR', path: '/finance/accounts-receivable' },
        { title: 'Buku Hutang & Kewajiban', path: '/finance/accounts-payable' },
        { title: 'Rekonsiliasi Bank', path: '/finance/bank-reconciliation' },
        { title: 'Kas Kecil (Petty Cash)', path: '/finance/petty-cash' },
        { title: 'Kas Kecil Gudang', path: '/finance/petty-cash-gudang' },
        { title: 'Realisasi & Tambahan Biaya', path: '/finance/tambahan-biaya-proyek' },
        { title: 'Year-End Closing', path: '/finance/year-end' }
      ]
    },
    {
      title: 'Correspondence', icon: <Mail size={20} />,
      submenu: [
        { title: 'Dashboard Surat', path: '/surat-menyurat/dashboard' },
        { title: 'Surat Masuk', path: '/surat-menyurat/surat-masuk' },
        { title: 'Surat Keluar', path: '/surat-menyurat/surat-keluar' },
        { title: 'Berita Acara', path: '/surat-menyurat/berita-acara' },
        { title: 'Surat Jalan (DO)', path: '/surat-menyurat/surat-jalan' },
        { title: 'Surat Perintah Kerja', path: '/surat-menyurat/spk' }
      ]
    },
    {
      title: 'Logistics Control', icon: <Truck size={20} />,
      submenu: [
        { title: 'Command Center', path: '/logistics/hub' },
        { title: 'Fleet Health', path: '/asset/maintenance' },
        { title: 'Surat Jalan / DO', path: '/surat-menyurat/surat-jalan' }
      ]
    },
    {
      title: 'Assets', icon: <Truck size={20} />,
      submenu: [
        { title: 'Daftar Asset', path: '/asset/equipment' },
        { title: 'Maintenance', path: '/asset/maintenance' },
        { title: 'Rental Out', path: '/asset/rental-out' },
        { title: 'Internal Usage', path: '/asset/internal-usage' }
      ]
    },
    {
      title: 'Human Capital', icon: <Users size={20} />,
      submenu: [
        { title: 'Dashboard HR', path: '/hr/dashboard' },
        { title: 'Master Karyawan', path: '/hr/karyawan' },
        { title: 'Kehadiran Hari Ini', path: '/hr/attendance-today' },
        { title: 'Rekap Kehadiran Bulanan', path: '/hr/attendance-recap' },
        { title: 'Cuti & Izin', path: '/hr/cuti' },
        { title: 'Lembur', path: '/hr/lembur' },
        { title: 'Shift Management', path: '/hr/shift' },
        { title: 'THL / Harian Lepas', path: '/hr/thl' },
        { title: 'Timesheet THL', path: '/hr/thl-timesheet' },
        { title: 'Gajian THL', path: '/hr/gajian-thl' },
        { title: 'Kasbon THL', path: '/hr/employee-advance?type=thl' },
        { title: 'Kas Koperasi', path: '/hr/kas-koperasi' },
        { title: 'Tunjangan', path: '/hr/tunjangan' },
        { title: 'Proses Payroll', path: '/hr/payroll-pro' },
        { title: 'Resign & Offboarding', path: '/hr/resign' },
        { title: 'Laporan Human Capital', path: '/hr/laporan' },
        ...(FEATURES.performanceReview ? [{ title: 'Penilaian Kinerja', path: '/hr/penilaian-kinerja' }] : []),
      ]
    },
    { title: 'Data Collection', icon: <Database size={20} />, path: '/data-collection' },
    {
      title: 'Settings', icon: <Settings size={20} />,
      submenu: [
        { title: 'User Management', path: '/settings/user-management' },
        { title: 'Audit Trail (Forensic)', path: '/settings/audit-trail' }
      ]
    }
  ];

  const toggleMenu = (title: string) => {
    setOpenMenus(prev =>
      prev.includes(title) ? prev.filter(item => item !== title) : [...prev, title]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col flex-shrink-0
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0'}
          overflow-hidden
        `}
      >
        <div className="h-full flex flex-col w-64">
          {/* Logo */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm p-1 flex-shrink-0 flex items-center justify-center border border-gray-100">
                <img src={logoSrc || undefined} alt="GM Teknik" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-base font-bold text-red-600 leading-none">GM TEKNIK</h1>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter mt-0.5">Enterprise System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            {menuItems.map((item) => (
              (hasAccessToMenu(item.title) || (item.title === 'Settings' && currentUser)) && (
                <div key={item.title} className="mb-0.5">
                  {item.path ? (
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        location.pathname === item.path
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleMenu(item.title)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span>{item.title}</span>
                        </div>
                        {openMenus.includes(item.title)
                          ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        }
                      </button>
                      {openMenus.includes(item.title) && item.submenu && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-2">
                          {hasAccessToMenu(item.title) && item.submenu.map((subItem) => (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`block px-3 py-2 rounded-lg transition-colors text-xs ${
                                location.pathname === subItem.path
                                  ? 'bg-blue-50 text-blue-600 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {subItem.title}
                            </Link>
                          ))}
                          {item.title === 'Settings' && (
                            <button
                              type="button"
                              onClick={() => { setPwdForm({ current: '', next: '', confirm: '' }); setShowPwdModal(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-xs text-left"
                            >
                              <KeyRound size={14} />
                              <span>Ganti Password</span>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            ))}
          </nav>

          {/* User info */}
          {currentUser && (
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate">{currentUser.fullName}</div>
                  <div className="text-[10px] text-blue-600">{currentUser.role}</div>
                </div>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-medium"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <NotificationBell />
              {currentUser && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-900">{currentUser.fullName}</div>
                    <div className="text-[10px] text-gray-500">{currentUser.role}</div>
                  </div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {currentUser.fullName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => !pwdSubmitting && setShowPwdModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">Ganti Password</h3>
            <p className="text-xs text-slate-500 mb-4">Akun: <span className="font-bold text-slate-700">{currentUser?.fullName} ({currentUser?.username})</span></p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Password Lama</label>
                <input type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} disabled={pwdSubmitting}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Masukkan password lama" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Password Baru</label>
                <input type="password" value={pwdForm.next} onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))} disabled={pwdSubmitting}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Min. 10 karakter, huruf + angka" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Konfirmasi Password Baru</label>
                <input type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} disabled={pwdSubmitting}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Ulangi password baru" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowPwdModal(false)} disabled={pwdSubmitting}
                className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl disabled:opacity-50">Batal</button>
              <button onClick={handleChangePassword} disabled={pwdSubmitting}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {pwdSubmitting ? 'Menyimpan...' : 'Ganti Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" expand={true} richColors />
    </div>
  );
}
