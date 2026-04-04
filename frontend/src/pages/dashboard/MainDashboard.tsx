import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Project } from '../../contexts/AppContext';
import api from '../../services/api';
import FlowHintBar from '../../components/ui/FlowHintBar';
import { getRoleLabel, hasRoleAccess, isOwnerLike } from '../../utils/roles';

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MainDashboard() {
  const {
    currentUser,
    projectList = [],
    invoiceList = [],
    stockItemList = [],
    attendanceList = [],
    quotationList = [],
    poList = [],
    suratJalanList = [],
    beritaAcaraList = [],
    employeeList = [],
    workOrderList = [],
    materialRequestList = [],
  } = useApp();
  const [serverProjects, setServerProjects] = useState<Project[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    projects?: { approved?: number; pending?: number; inProgress?: number; completed?: number; total?: number };
    finance?: { revenue?: number };
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadDashboardData = async () => {
      try {
        const [projectsRes, summaryRes] = await Promise.all([
          api.get('/projects'),
          api.get('/dashboard/summary'),
        ]);
        if (!mounted) return;
        setServerProjects(Array.isArray(projectsRes.data) ? (projectsRes.data as Project[]) : []);
        setSummaryMetrics(summaryRes.data ?? null);
      } catch {
        if (!mounted) return;
        setServerProjects([]);
        setSummaryMetrics(null);
      }
    };
    void loadDashboardData();
    return () => {
      mounted = false;
    };
  }, []);

  const projects = useMemo(
    () => safeArray(serverProjects.length > 0 ? serverProjects : projectList),
    [serverProjects, projectList]
  );
  const invoices = safeArray(invoiceList);
  const stocks = safeArray(stockItemList);
  const attendances = safeArray(attendanceList);
  const quotations = safeArray(quotationList);
  const purchaseOrders = safeArray(poList);
  const deliveries = safeArray(suratJalanList);
  const beritaAcaras = safeArray(beritaAcaraList);
  const employees = safeArray(employeeList);
  const workOrders = safeArray(workOrderList);
  const materialRequests = safeArray(materialRequestList);
  const currentRole = String(currentUser?.role || '').toUpperCase();

  const localRevenue = invoices.reduce((sum, inv: any) => sum + toNumber(inv?.totalBayar), 0);
  const totalRevenue = toNumber(summaryMetrics?.finance?.revenue) || localRevenue;
  const localActiveProjects = projects.filter((p: any) => String(p?.status || '').toLowerCase() !== 'completed').length;
  const serverActiveProjects = toNumber(summaryMetrics?.projects?.inProgress) + toNumber(summaryMetrics?.projects?.pending);
  const activeProjects = serverActiveProjects || localActiveProjects;
  const lowStockCount = stocks.filter((s: any) => toNumber(s?.stok) <= toNumber(s?.minStock || 0)).length;
  const totalHours = attendances.reduce((sum, a: any) => sum + toNumber(a?.workHours), 0);
  const today = new Date().toISOString().slice(0, 10);
  const attendanceToday = attendances.filter((item: any) => String(item?.tanggal || item?.date || item?.createdAt || '').slice(0, 10) === today).length;
  const pendingProjectApprovals = projects.filter((project: any) => normalizeStatus(project?.approvalStatus || 'pending') === 'pending').length;
  const approvedProjects = projects.filter((project: any) => normalizeStatus(project?.approvalStatus) === 'approved').length;
  const draftQuotations = quotations.filter((item: any) => ['draft', 'review'].includes(normalizeStatus(item?.status))).length;
  const sentQuotations = quotations.filter((item: any) => normalizeStatus(item?.status) === 'sent').length;
  const openPurchaseOrders = purchaseOrders.filter((item: any) => !['approved', 'received', 'rejected', 'cancelled'].includes(normalizeStatus(item?.status))).length;
  const activeWorkOrders = workOrders.filter((item: any) => !['done', 'completed'].includes(normalizeStatus(item?.status || item?.workflowStatus))).length;
  const openMaterialRequests = materialRequests.filter((item: any) => !['closed', 'delivered', 'issued'].includes(normalizeStatus(item?.status || item?.workflowStatus))).length;
  const activeDeliveries = deliveries.filter((item: any) => ['pending', 'on delivery', 'in transit'].includes(normalizeStatus(item?.deliveryStatus))).length;
  const completedButNoBa = (() => {
    const baRefs = new Set(beritaAcaras.map((item: any) => String(item?.refSuratJalan || '').trim()).filter(Boolean));
    return deliveries.filter((item: any) => normalizeStatus(item?.deliveryStatus) === 'delivered' && !baRefs.has(String(item?.id || '').trim())).length;
  })();
  const unpaidInvoices = invoices.filter((item: any) => !['paid'].includes(normalizeStatus(item?.status))).length;

  const topProjects = projects.slice(0, 4);
  const roleLabel = getRoleLabel(currentRole);

  const roleDashboard = useMemo(() => {
    const base = {
      title: `Dashboard ${roleLabel}`,
      description: 'Lihat tugas paling penting hari ini, cek titik yang masih pending, lalu lanjut ke modul yang paling relevan untuk peranmu.',
      badges: [
        { label: `Role ${roleLabel}`, tone: 'info' as const },
        { label: `${activeProjects} project aktif`, tone: 'neutral' as const },
      ],
      checks: [
        { label: 'Project aktif', value: String(activeProjects) },
        { label: 'Low stock', value: String(lowStockCount) },
        { label: 'Invoice terbuka', value: String(unpaidInvoices) },
      ],
      focusItems: [
        'Mulai dari tugas yang statusnya masih pending atau draft.',
        'Pastikan dokumen tidak lompat urutan sebelum approval selesai.',
        'Pakai quick action di kanan supaya user tidak muter menu terlalu jauh.',
      ],
      quickLinks: [
        { label: 'Project', path: '/project', tone: 'bg-slate-900 text-white' },
        { label: 'Panduan Sistem', path: '/guide-book', tone: 'bg-white border border-slate-200 text-slate-700' },
      ],
    };

    if (isOwnerLike(currentRole) || ['SPV', 'ADMIN', 'MANAGER'].includes(currentRole)) {
      return {
        title: 'Approval & Kontrol Operasional',
        description: 'Pantau approval, buka bottleneck operasional, dan pastikan project yang sudah deal cepat bergerak ke tahap eksekusi.',
        badges: [
          { label: `${pendingProjectApprovals} project pending`, tone: pendingProjectApprovals > 0 ? 'warning' as const : 'success' as const },
          { label: `${sentQuotations} quotation menunggu keputusan`, tone: sentQuotations > 0 ? 'info' as const : 'neutral' as const },
          { label: `${openMaterialRequests} material request aktif`, tone: openMaterialRequests > 0 ? 'warning' as const : 'neutral' as const },
        ],
        checks: [
          { label: 'Approval project', value: String(pendingProjectApprovals) },
          { label: 'Quotation sent', value: String(sentQuotations) },
          { label: 'WO aktif', value: String(activeWorkOrders) },
        ],
        focusItems: [
          'Buka Approval Hub untuk project, quotation, invoice, dan material request yang tertahan.',
          'Pastikan quotation approved cepat dikonversi jadi project yang siap jalan.',
          'Pantau surat jalan delivered yang belum ditutup dengan Berita Acara.',
        ],
        quickLinks: [
          { label: 'Approval Hub', path: '/finance/approvals', tone: 'bg-slate-900 text-white' },
          { label: 'Project', path: '/project', tone: 'bg-blue-600 text-white' },
          { label: 'Audit Trail', path: '/settings/audit-trail', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (currentRole === 'SALES') {
      return {
        title: 'Data Masuk, Quotation, dan Follow Up',
        description: 'Fokus utama Sales ada di survey lapangan, quotation yang masih draft atau sent, lalu project yang sudah approved untuk ditindaklanjuti.',
        badges: [
          { label: `${draftQuotations} quotation draft/review`, tone: draftQuotations > 0 ? 'warning' as const : 'neutral' as const },
          { label: `${sentQuotations} quotation sent`, tone: sentQuotations > 0 ? 'info' as const : 'neutral' as const },
          { label: `${approvedProjects} project approved`, tone: approvedProjects > 0 ? 'success' as const : 'neutral' as const },
        ],
        checks: [
          { label: 'Quotation draft', value: String(draftQuotations) },
          { label: 'Quotation sent', value: String(sentQuotations) },
          { label: 'Project approved', value: String(approvedProjects) },
        ],
        focusItems: [
          'Pastikan data collection yang layak langsung dinaikkan jadi quotation.',
          'Quotation yang sudah sent perlu follow up sampai jadi approved atau revisi.',
          'Project approved wajib dipantau sampai invoice dan dokumen serah terima siap.',
        ],
        quickLinks: [
          { label: 'Survey Lapangan', path: '/data-collection', tone: 'bg-slate-900 text-white' },
          { label: 'Quotation', path: '/sales/quotation', tone: 'bg-blue-600 text-white' },
          { label: 'Invoice', path: '/sales/invoice', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (currentRole === 'FINANCE') {
      return {
        title: 'Approval, Penagihan, dan Arus Kas',
        description: 'Mulai dari approval yang tertahan, cek invoice yang belum lunas, lalu tutup pekerjaan finance harian dari cashflow sampai pajak.',
        badges: [
          { label: `${unpaidInvoices} invoice terbuka`, tone: unpaidInvoices > 0 ? 'warning' as const : 'neutral' as const },
          { label: `${sentQuotations} quotation perlu approval`, tone: sentQuotations > 0 ? 'info' as const : 'neutral' as const },
          { label: `${formatRupiah(totalRevenue)} revenue`, tone: 'success' as const },
        ],
        checks: [
          { label: 'Invoice terbuka', value: String(unpaidInvoices) },
          { label: 'Approval antre', value: String(sentQuotations + pendingProjectApprovals) },
          { label: 'Revenue', value: formatRupiah(totalRevenue) },
        ],
        focusItems: [
          'Approval yang tertahan harus dibereskan lebih dulu agar alur operasional tidak macet.',
          'Pastikan invoice yang belum lunas tetap terpantau dan tidak lompat dokumen.',
          'Cashflow, PPN, dan ledger dipakai untuk menutup loop finance harian.',
        ],
        quickLinks: [
          { label: 'Approval Hub', path: '/finance/approvals', tone: 'bg-slate-900 text-white' },
          { label: 'Vendor Payment', path: '/finance/vendor-payment', tone: 'bg-blue-600 text-white' },
          { label: 'Cashflow', path: '/finance/cashflow-command', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (currentRole === 'PURCHASING' || hasRoleAccess(currentRole, ['SUPPLY_CHAIN'])) {
      return {
        title: 'Pengadaan Material & Kontrol PO',
        description: 'Bandingkan kebutuhan proyek, buat PO supplier, dan pantau material request supaya tidak nyangkut sebelum receiving.',
        badges: [
          { label: `${openMaterialRequests} material request aktif`, tone: openMaterialRequests > 0 ? 'warning' as const : 'neutral' as const },
          { label: `${openPurchaseOrders} PO aktif`, tone: openPurchaseOrders > 0 ? 'info' as const : 'neutral' as const },
          { label: `${lowStockCount} item low stock`, tone: lowStockCount > 0 ? 'danger' as const : 'success' as const },
        ],
        checks: [
          { label: 'MR aktif', value: String(openMaterialRequests) },
          { label: 'PO aktif', value: String(openPurchaseOrders) },
          { label: 'Low stock', value: String(lowStockCount) },
        ],
        focusItems: [
          'Mulai dari material request yang butuh harga atau keputusan pembelian.',
          'PO yang sudah diterbitkan harus dipantau sampai barang diterima gudang.',
          'Item low stock perlu diprioritaskan supaya pekerjaan produksi tidak tertunda.',
        ],
        quickLinks: [
          { label: 'Purchase Order', path: '/purchasing/purchase-order', tone: 'bg-slate-900 text-white' },
          { label: 'Stok Masuk', path: '/inventory/stock-in', tone: 'bg-blue-600 text-white' },
          { label: 'Gudang', path: '/inventory/center', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (currentRole === 'WAREHOUSE') {
      return {
        title: 'Receiving, Stok, dan Pengiriman',
        description: 'Gudang perlu pegang tiga hal utama: barang masuk, stok aman, dan pengiriman selesai dengan dokumen yang lengkap.',
        badges: [
          { label: `${activeDeliveries} kiriman aktif`, tone: activeDeliveries > 0 ? 'info' as const : 'neutral' as const },
          { label: `${completedButNoBa} delivered belum BA`, tone: completedButNoBa > 0 ? 'warning' as const : 'success' as const },
          { label: `${lowStockCount} item low stock`, tone: lowStockCount > 0 ? 'danger' as const : 'success' as const },
        ],
        checks: [
          { label: 'Kiriman aktif', value: String(activeDeliveries) },
          { label: 'Butuh BA', value: String(completedButNoBa) },
          { label: 'Low stock', value: String(lowStockCount) },
        ],
        focusItems: [
          'Barang yang datang harus langsung dicatat receiving agar stok tidak selisih.',
          'Surat Jalan yang delivered sebaiknya cepat ditutup dengan Berita Acara.',
          'Cek low stock harian untuk cegah pekerjaan berhenti di lapangan.',
        ],
        quickLinks: [
          { label: 'Stok Masuk', path: '/inventory/stock-in', tone: 'bg-slate-900 text-white' },
          { label: 'Surat Jalan', path: '/surat-menyurat/surat-jalan', tone: 'bg-blue-600 text-white' },
          { label: 'Berita Acara', path: '/surat-menyurat/berita-acara', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (hasRoleAccess(currentRole, ['PRODUKSI'])) {
      return {
        title: 'Work Order, Progres, dan Penyelesaian Lapangan',
        description: 'Produksi perlu mulai dari work order yang aktif, update progres lapangan, lalu pastikan dokumen serah terima ditutup rapi.',
        badges: [
          { label: `${activeWorkOrders} work order aktif`, tone: activeWorkOrders > 0 ? 'info' as const : 'neutral' as const },
          { label: `${activeDeliveries} kiriman berjalan`, tone: activeDeliveries > 0 ? 'warning' as const : 'neutral' as const },
          { label: `${completedButNoBa} delivered belum BA`, tone: completedButNoBa > 0 ? 'warning' as const : 'success' as const },
        ],
        checks: [
          { label: 'WO aktif', value: String(activeWorkOrders) },
          { label: 'Kiriman aktif', value: String(activeDeliveries) },
          { label: 'BA tertunda', value: String(completedButNoBa) },
        ],
        focusItems: [
          'Mulai dari work order yang belum selesai lalu update progresnya rutin.',
          'Jika barang atau hasil kerja sudah sampai, jangan lupa lanjutkan BA.',
          'Stock out dan surat jalan harus tetap nyambung ke project yang benar.',
        ],
        quickLinks: [
          { label: 'Dashboard Produksi', path: '/produksi/dashboard', tone: 'bg-slate-900 text-white' },
          { label: 'Laporan Harian', path: '/produksi/report', tone: 'bg-blue-600 text-white' },
          { label: 'Berita Acara', path: '/surat-menyurat/berita-acara', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    if (currentRole === 'HR') {
      return {
        title: 'Absensi, Field Record, dan Payroll',
        description: 'HR lebih efektif kalau mulai dari kehadiran hari ini, lanjut ke field record, lalu tutup administrasi payroll setelah data tenaga kerja rapi.',
        badges: [
          { label: `${attendanceToday} absensi hari ini`, tone: attendanceToday > 0 ? 'info' as const : 'neutral' as const },
          { label: `${employees.length} karyawan aktif`, tone: 'success' as const },
          { label: `${totalHours.toLocaleString('id-ID')} jam kerja`, tone: 'neutral' as const },
        ],
        checks: [
          { label: 'Absensi hari ini', value: String(attendanceToday) },
          { label: 'Karyawan', value: String(employees.length) },
          { label: 'Jam kerja', value: totalHours.toLocaleString('id-ID') },
        ],
        focusItems: [
          'Cek absensi harian dulu untuk memastikan data hadir masuk dengan benar.',
          'Field record dipakai untuk sinkron kerja lapangan sebelum payroll.',
          'Payroll sebaiknya ditutup setelah data kehadiran dan tenaga kerja konsisten.',
        ],
        quickLinks: [
          { label: 'Absensi', path: '/hr/absensi', tone: 'bg-slate-900 text-white' },
          { label: 'Field Record', path: '/hr/field-record', tone: 'bg-blue-600 text-white' },
          { label: 'Payroll', path: '/hr/payroll', tone: 'bg-white border border-slate-200 text-slate-700' },
        ],
      };
    }

    return base;
  }, [
    roleLabel,
    activeProjects,
    lowStockCount,
    unpaidInvoices,
    currentRole,
    pendingProjectApprovals,
    sentQuotations,
    openMaterialRequests,
    activeWorkOrders,
    draftQuotations,
    approvedProjects,
    totalRevenue,
    openPurchaseOrders,
    activeDeliveries,
    completedButNoBa,
    attendanceToday,
    employees.length,
    totalHours,
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,transparent_35%),radial-gradient(circle_at_85%_10%,#ede9fe_0%,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-16 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />

      <div className="relative z-10 space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Dashboard {roleLabel}</p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-black italic tracking-tight text-slate-900">
                {roleDashboard.title} <span className="text-blue-600">app_gema</span>
              </h1>
              <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Welcome, {currentUser?.name || currentUser?.username || 'User'}
              </p>
              <p className="mt-4 max-w-2xl text-sm text-slate-600 leading-relaxed">
                {roleDashboard.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:min-w-[420px]">
              {roleDashboard.checks.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-black italic text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <FlowHintBar
            className="mt-6"
            title="Fokus Hari Ini:"
            badges={roleDashboard.badges}
            helper={roleDashboard.focusItems[0]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-slate-900 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Briefcase size={20} />
              <span className="text-[10px] uppercase tracking-widest">Projects</span>
            </div>
            <p className="mt-4 text-3xl font-black">{activeProjects}</p>
            <p className="text-xs text-slate-300">Active Projects</p>
          </div>

          <div className="rounded-3xl bg-emerald-600 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <DollarSign size={20} />
              <span className="text-[10px] uppercase tracking-widest">Revenue</span>
            </div>
            <p className="mt-4 text-2xl font-black">{formatRupiah(totalRevenue)}</p>
            <p className="text-xs text-emerald-100">Total Invoice</p>
          </div>

          <div className="rounded-3xl bg-amber-500 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <AlertTriangle size={20} />
              <span className="text-[10px] uppercase tracking-widest">Inventory</span>
            </div>
            <p className="mt-4 text-3xl font-black">{lowStockCount}</p>
            <p className="text-xs text-amber-100">Low Stock Items</p>
          </div>

          <div className="rounded-3xl bg-blue-600 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Clock size={20} />
              <span className="text-[10px] uppercase tracking-widest">Man Hours</span>
            </div>
            <p className="mt-4 text-3xl font-black">{totalHours.toLocaleString('id-ID')}</p>
            <p className="text-xs text-blue-100">Accumulated Hours</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black italic text-slate-900">Project Snapshot</h2>
              <Link to="/project" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-blue-600 hover:underline">
                Manage <ArrowRight size={12} />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {topProjects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Belum ada project.
                </div>
              )}

              {topProjects.map((p: any) => (
                <div key={String(p?.id || Math.random())} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase italic text-slate-900">
                        {String(p?.namaProject || 'Untitled Project')}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {String(p?.customer || '-')}
                      </p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {String(p?.status || 'Unknown')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
              <h2 className="text-xl font-black italic text-slate-900">Fokus Kerja</h2>
              <div className="mt-4 space-y-3">
                {roleDashboard.focusItems.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <p className="text-xs font-semibold text-slate-600 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
              <h2 className="text-xl font-black italic text-slate-900">Aksi Cepat</h2>
              <div className="mt-4 space-y-3">
                {roleDashboard.quickLinks.map((item) => (
                  <Link key={item.path} to={item.path} className={`flex items-center justify-between rounded-2xl p-4 ${item.tone}`}>
                    <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
