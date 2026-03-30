import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner@2.0.3';
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
  Clock,
  Menu,
  X,
  Hammer,
  Truck,
  GitBranch,
  Mail,
  Home,
  Grid,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Shield,
  Database,
  ClipboardList,
  Building2,
  DollarSign,
  Book,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, hasRoleAccess, isOwnerLike } from '../utils/roles';
import logoImage from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

// Using a standard URL or SVG for local build compatibility
const LOGO_URL = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/factory.svg';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  path?: string;
  submenu?: { title: string; path: string }[];
}

const GUIDE_BOOK_ROLES = ['SALES', 'FINANCE', 'HR', 'SUPPLY_CHAIN', 'PRODUKSI', 'USER'] as const;
const DASHBOARD_ROLES = ['FINANCE', 'HR', 'SALES', 'SUPPLY_CHAIN', 'PRODUKSI', 'USER'] as const;
const PROJECT_ROLES = ['SALES', 'FINANCE', 'HR', 'SUPPLY_CHAIN', 'PRODUKSI'] as const;
const PRODUCTION_ROLES = ['PRODUKSI'] as const;
const INVENTORY_ROLES = ['SUPPLY_CHAIN', 'PRODUKSI', 'FINANCE'] as const;
const PROCUREMENT_ROLES = ['PURCHASING', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'] as const;
const SALES_ROLES = ['SALES', 'FINANCE'] as const;
const FINANCE_ROLES = ['FINANCE'] as const;
const CORRESPONDENCE_ROLES = ['HR', 'SALES', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'] as const;
const SURAT_JALAN_ROLES = ['WAREHOUSE', 'SALES', 'PRODUKSI'] as const;
const SPK_ROLES = ['HR', 'SALES', 'WAREHOUSE', 'PRODUKSI'] as const;
const LOGISTICS_HUB_ROLES = ['WAREHOUSE', 'SALES', 'PRODUKSI'] as const;
const ASSET_ROLES = ['FINANCE', 'WAREHOUSE', 'PRODUKSI'] as const;
const MAINTENANCE_ROLES = ['WAREHOUSE', 'PRODUKSI'] as const;
const HUMAN_CAPITAL_ROLES = ['HR', 'FINANCE'] as const;
const DATA_COLLECTION_ROLES = ['HR', 'SALES'] as const;
const SETTINGS_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

const PATH_ACCESS_MAP: Record<string, readonly string[]> = {
  '/guide-book': GUIDE_BOOK_ROLES,
  '/dashboard': DASHBOARD_ROLES,
  '/project': PROJECT_ROLES,
  '/produksi/dashboard': PRODUCTION_ROLES,
  '/produksi/report': PRODUCTION_ROLES,
  '/produksi/timeline': PRODUCTION_ROLES,
  '/produksi/qc': PRODUCTION_ROLES,
  '/purchasing/purchase-order': PROCUREMENT_ROLES,
  '/inventory/stock-in': INVENTORY_ROLES,
  '/inventory/stock-out': INVENTORY_ROLES,
  '/inventory/center': INVENTORY_ROLES,
  '/inventory/aging': INVENTORY_ROLES,
  '/inventory/stock-report': INVENTORY_ROLES,
  '/sales/quotation': SALES_ROLES,
  '/sales/invoice': SALES_ROLES,
  '/sales/analytics': SALES_ROLES,
  '/finance/executive-dashboard': FINANCE_ROLES,
  '/finance/approvals': FINANCE_ROLES,
  '/finance/cashflow-command': FINANCE_ROLES,
  '/finance/project-analysis': FINANCE_ROLES,
  '/finance/cashflow': FINANCE_ROLES,
  '/finance/ledger': FINANCE_ROLES,
  '/finance/ppn': FINANCE_ROLES,
  '/finance/accounts-receivable': FINANCE_ROLES,
  '/finance/accounts-payable': FINANCE_ROLES,
  '/finance/bank-reconciliation': FINANCE_ROLES,
  '/finance/petty-cash': FINANCE_ROLES,
  '/finance/working-expense': FINANCE_ROLES,
  '/finance/vendor-payment': FINANCE_ROLES,
  '/finance/year-end': FINANCE_ROLES,
  '/finance/archive': FINANCE_ROLES,
  '/surat-menyurat/dashboard': CORRESPONDENCE_ROLES,
  '/surat-menyurat/berita-acara': CORRESPONDENCE_ROLES,
  '/surat-menyurat/surat-jalan': SURAT_JALAN_ROLES,
  '/surat-menyurat/spk': SPK_ROLES,
  '/logistics/hub': LOGISTICS_HUB_ROLES,
  '/asset/equipment': ASSET_ROLES,
  '/asset/maintenance': MAINTENANCE_ROLES,
  '/hr/karyawan': HUMAN_CAPITAL_ROLES,
  '/hr/absensi': HUMAN_CAPITAL_ROLES,
  '/hr/field-record': HUMAN_CAPITAL_ROLES,
  '/hr/attendance-recap': HUMAN_CAPITAL_ROLES,
  '/hr/payroll': HUMAN_CAPITAL_ROLES,
  '/data-collection': DATA_COLLECTION_ROLES,
  '/settings/user-management': SETTINGS_ROLES,
  '/settings/audit-trail': SETTINGS_ROLES,
};

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const displayName = currentUser?.fullName || (currentUser as any)?.name || currentUser?.username || 'User';
  const displayInitial = String(displayName || "U").charAt(0).toUpperCase();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed for mobile
  const [openMenus, setOpenMenus] = useState<string[]>(['Dashboard']);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true); // Auto open on desktop
      } else {
        setSidebarOpen(false); // Auto close on mobile
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setShowMobileMenu(false);
    }
  }, [location.pathname, isMobile]);

  const role = String(currentUser?.role || '').toUpperCase();
  const hasPrivilegedAccess = role === 'ADMIN' || role === 'MANAGER' || isOwnerLike(role);

  const hasAccessToPath = (path?: string): boolean => {
    if (!currentUser || !path) return false;
    if (hasPrivilegedAccess) return true;
    const allowedRoles = PATH_ACCESS_MAP[path];
    return Array.isArray(allowedRoles) ? hasRoleAccess(role, allowedRoles) : false;
  };

  const getVisibleSubmenu = (submenu?: MenuItem['submenu']) =>
    (submenu || []).filter((subItem) => hasAccessToPath(subItem.path));

  const canRenderMenuItem = (item: MenuItem): boolean =>
    item.path ? hasAccessToPath(item.path) : getVisibleSubmenu(item.submenu).length > 0;

  const menuItems: MenuItem[] = [
    {
      title: 'Panduan Sistem',
      icon: <Book size={20} />,
      path: '/guide-book'
    },
    {
      title: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      path: '/dashboard'
    },
    {
      title: 'Project',
      icon: <Briefcase size={20} />,
      path: '/project'
    },
    {
      title: 'Production',
      icon: <Hammer size={20} />,
      submenu: [
        { title: 'Control Center', path: '/produksi/dashboard' },
        { title: 'Laporan Harian (LHP)', path: '/produksi/report' },
        { title: 'Timeline & Tracker', path: '/produksi/timeline' },
        { title: 'Quality Control (QC)', path: '/produksi/qc' }
      ]
    },
    {
      title: 'Pengadaan & Gudang',
      icon: <Package size={20} />,
      submenu: [
        { title: 'Purchase Order', path: '/purchasing/purchase-order' },
        { title: 'Stok Masuk (Receiving)', path: '/inventory/stock-in' },
        { title: 'Stok Keluar (Issue)', path: '/inventory/stock-out' },
        { title: 'Monitoring Gudang', path: '/inventory/center' },
        { title: 'Stock Aging (FEFO)', path: '/inventory/aging' }
      ]
    },
    {
      title: 'Penawaran & Penjualan',
      icon: <Calculator size={20} />,
      submenu: [
        { title: 'Quotation', path: '/sales/quotation' },
        { title: 'Invoicing & Penagihan', path: '/sales/invoice' },
        { title: 'Sales Analytics', path: '/sales/analytics' }
      ]
    },
    {
      title: 'Finance & Penagihan',
      icon: <Wallet size={20} />,
      submenu: [
        { title: 'Executive Command Center', path: '/finance/executive-dashboard' },
        { title: 'Approval Hub (PO/Quo/Inv/MR)', path: '/finance/approvals' },
        { title: 'AR/AP Cash Flow Command', path: '/finance/cashflow-command' },
        { title: 'Project Profit & Loss', path: '/finance/project-analysis' },
        { title: 'Cashflow Statement', path: '/finance/cashflow' },
        { title: 'General Ledger', path: '/finance/ledger' },
        { title: 'Laporan Pajak PPN', path: '/finance/ppn' },
        { title: 'Accounts Receivable (AR)', path: '/finance/accounts-receivable' },
        { title: 'Buku Hutang & Kewajiban', path: '/finance/accounts-payable' },
        { title: 'Rekonsiliasi Bank', path: '/finance/bank-reconciliation' },
        { title: 'Kas Kecil (Petty Cash)', path: '/finance/petty-cash' },
        { title: 'Biaya Kerja (Field Exp)', path: '/finance/working-expense' },
        { title: 'Vendor Payment & Expenses', path: '/finance/vendor-payment' },
        { title: 'Year-End Closing', path: '/finance/year-end' },
        { title: 'Arsip Digital Ledger', path: '/finance/archive' }
      ]
    },
    {
      title: 'Dokumen Proyek',
      icon: <Mail size={20} />,
      submenu: [
        { title: 'Dokumen Masuk & Keluar', path: '/surat-menyurat/dashboard' },
        { title: 'Berita Acara', path: '/surat-menyurat/berita-acara' },
        { title: 'Surat Jalan', path: '/surat-menyurat/surat-jalan' },
        { title: 'Surat Perintah Kerja', path: '/surat-menyurat/spk' }
      ]
    },
    {
      title: 'Pengiriman & Logistik',
      icon: <Truck size={20} />,
      submenu: [
        { title: 'Ringkasan Logistik', path: '/logistics/hub' },
        { title: 'Kesehatan Armada', path: '/asset/maintenance' },
        { title: 'Proof of Delivery', path: '/surat-menyurat/surat-jalan' }
      ]
    },
    {
      title: 'Assets',
      icon: <Truck size={20} />,
      submenu: [
        { title: 'Daftar Asset', path: '/asset/equipment' },
        { title: 'Maintenance', path: '/asset/maintenance' }
      ]
    },
    {
      title: 'HR & Absensi',
      icon: <Users size={20} />,
      submenu: [
        { title: 'Karyawan', path: '/hr/karyawan' },
        { title: 'Absensi (Daily)', path: '/hr/absensi' },
        { title: 'Absen & Kasbon (Field)', path: '/hr/field-record' },
        { title: 'Rekap Kehadiran', path: '/hr/attendance-recap' },
        { title: 'Payroll', path: '/hr/payroll' }
      ]
    },
    {
      title: 'Survey Lapangan',
      icon: <Database size={20} />,
      path: '/data-collection'
    },
    {
      title: 'Settings',
      icon: <Settings size={20} />,
      submenu: [
        { title: 'User Management', path: '/settings/user-management' },
        { title: 'Audit Trail (Forensic)', path: '/settings/audit-trail' }
      ]
    }
  ];

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  // Quick access items for bottom navigation (mobile)
  const quickAccessItems = [
    { icon: <Home size={24} />, label: 'Home', path: '/dashboard' },
    { icon: <Briefcase size={24} />, label: 'Project', path: '/project' },
    { icon: <Package size={24} />, label: 'Stock', path: '/inventory/stock-report' },
    { icon: <Users size={24} />, label: 'HR', path: '/hr/absensi' },
    { icon: <Grid size={24} />, label: 'Menu', action: () => setShowMobileMenu(!showMobileMenu) }
  ];
  const visibleQuickAccessItems = quickAccessItems.filter((item) => !item.path || hasAccessToPath(item.path));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Overlay */}
      {(sidebarOpen || showMobileMenu) && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setShowMobileMenu(false);
          }}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white border-r border-gray-200 
          transition-all duration-300 ease-in-out
          ${sidebarOpen || showMobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isMobile ? 'w-80' : (sidebarOpen ? 'w-64' : 'w-0')}
          overflow-hidden
        `}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-4 lg:p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-10 bg-white rounded-lg shadow-sm p-1 flex-shrink-0 flex items-center justify-center border border-gray-100">
                <img src={logoImage} alt="GM Teknik" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-red-600 leading-none">GM TEKNIK</h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">Dashboard System</p>
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  setShowMobileMenu(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 lg:p-4">
            {menuItems.map((item) => {
              const visibleSubmenu = getVisibleSubmenu(item.submenu);
              if (!canRenderMenuItem(item)) return null;
              return (
                <div key={item.title} className="mb-1">
                  {item.path ? (
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                        location.pathname === item.path
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      {item.icon}
                      <span className="text-sm lg:text-base">{item.title}</span>
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleMenu(item.title)}
                        className="w-full flex items-center justify-between gap-3 px-3 lg:px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="text-sm lg:text-base">{item.title}</span>
                        </div>
                        {openMenus.includes(item.title) ? (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                      </button>
                      {openMenus.includes(item.title) && visibleSubmenu.length > 0 && (
                        <div className="ml-3 lg:ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                          {visibleSubmenu.map((subItem) => (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`block px-3 lg:px-4 py-2.5 rounded-lg transition-colors text-sm touch-manipulation ${
                                location.pathname === subItem.path
                                  ? 'bg-blue-50 text-blue-600 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                              }`}
                            >
                              {subItem.title}</Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-3 lg:p-4 border-t border-gray-200">
            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowMobileMenu(false);
                logout();
                navigate('/login', { replace: true });
              }}
              className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
            >
              <LogOut size={20} />
              <span className="text-sm lg:text-base">Logout</span>
            </button>
          </div>

          {/* User Info (Mobile) - moved below logout */}
          {isMobile && currentUser && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {displayInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{displayName}</div>
                  <div className="text-sm text-gray-600 truncate">{currentUser.email}</div>
                  <div className="text-xs text-blue-600 mt-0.5">{getRoleLabel(currentUser.role)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation lg:block hidden"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile: Show logo/title */}
            {isMobile && (
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">ERP System</h2>
              </div>
            )}

            {/* Desktop: Show user */}
            <div className="hidden lg:flex items-center gap-4 ml-auto">
              {currentUser && (
                <>
                  <div className="text-right">
                    <div className="text-sm text-gray-900">{displayName}</div>
                    <div className="text-xs text-gray-500">{getRoleLabel(currentUser.role)}</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    {displayInitial}
                  </div>
                </>
              )}
            </div>

            {/* Mobile: Show menu button */}
            {isMobile && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation lg:hidden"
              >
                <Menu size={20} />
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom Navigation (Mobile Only) */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 lg:hidden safe-area-bottom">
            <div className="grid grid-cols-5 gap-1">
              {visibleQuickAccessItems.map((item, index) => (
                item.path ? (
                  <Link
                    key={index}
                    to={item.path}
                    className={`flex flex-col items-center justify-center py-2 px-2 transition-colors touch-manipulation ${
                      location.pathname === item.path
                        ? 'text-blue-600'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs mt-1">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    key={index}
                    onClick={item.action}
                    className={`flex flex-col items-center justify-center py-2 px-2 transition-colors touch-manipulation ${
                      showMobileMenu
                        ? 'text-blue-600'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                )
              ))}
            </div>
          </div>
        )}
      </div>
      <Toaster position="top-right" expand={true} richColors />
    </div>
  );
}
