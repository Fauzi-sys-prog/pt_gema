import { useEffect, useState } from 'react'; import { useNavigate } from 'react-router-dom'; import {   Mail, Send, FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Calendar, User, Building, Search, Download, Eye, Truck, Archive, Maximize2, Zap, RefreshCw } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { BeritaAcara, SuratJalan, SuratKeluar, SuratMasuk } from '../../types/correspondence';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { hasRoleAccess } from '../../utils/roles';

// Physical Archive preview is optimized for faster dashboard loads.
import physicalArchivePreviewImg from '../../assets/8a215f70fe30661dded39794b547f89ef79421a3.webp';

const physicalArchiveDownloadImg = '/archive/physical-archive-reference.png';

const STAT_STYLES = {
  blue: {
    icon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    sub: 'text-blue-600',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    sub: 'text-emerald-600',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    sub: 'text-purple-600',
  },
  orange: {
    icon: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white',
    sub: 'text-orange-600',
  },
} as const;

const CORRESPONDENCE_READ_ROLES = {
  'surat-masuk': ['OWNER', 'ADMIN', 'HR', 'SALES', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'],
  'surat-keluar': ['OWNER', 'ADMIN', 'HR', 'SALES', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'],
  'berita-acara': ['OWNER', 'ADMIN', 'HR', 'SALES', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'],
  'surat-jalan': ['OWNER', 'ADMIN', 'WAREHOUSE', 'SALES', 'PRODUKSI'],
} as const;

const isAccessDeniedError = (error: unknown): boolean =>
  Number((error as any)?.response?.status) === 403;

export default function DashboardSurat() {
  const navigate = useNavigate();
  const { 
    suratMasukList = [], 
    suratKeluarList = [], 
    beritaAcaraList = [], 
    suratJalanList = [],
    currentUser
  } = useApp();
  const [serverSuratMasukList, setServerSuratMasukList] = useState<SuratMasuk[] | null>(null);
  const [serverSuratKeluarList, setServerSuratKeluarList] = useState<SuratKeluar[] | null>(null);
  const [serverBeritaAcaraList, setServerBeritaAcaraList] = useState<BeritaAcara[] | null>(null);
  const [serverSuratJalanList, setServerSuratJalanList] = useState<SuratJalan[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveSuratMasukList = serverSuratMasukList ?? suratMasukList;
  const effectiveSuratKeluarList = serverSuratKeluarList ?? suratKeluarList;
  const effectiveBeritaAcaraList = serverBeritaAcaraList ?? beritaAcaraList;
  const effectiveSuratJalanList = serverSuratJalanList ?? suratJalanList;
  const [showGallery, setShowGallery] = useState(false);
  const currentRole = String(currentUser?.role || '').trim().toUpperCase();
  const hasPrivilegedAccess = currentRole === 'ADMIN' || currentRole === 'MANAGER' || hasRoleAccess(currentRole, ['OWNER']);

  const mapEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload;
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return (payload ?? row) as T;
    });

  const fetchDashboardSuratSources = async () => {
    const canRead = (resource: keyof typeof CORRESPONDENCE_READ_ROLES) =>
      hasPrivilegedAccess || hasRoleAccess(currentRole, CORRESPONDENCE_READ_ROLES[resource]);

    const fetchIfAllowed = async <T,>(
      resource: keyof typeof CORRESPONDENCE_READ_ROLES,
      request: () => Promise<{ data: T }>
    ): Promise<T | []> => {
      if (!canRead(resource)) {
        return [];
      }

      try {
        const res = await request();
        return res.data;
      } catch (error) {
        if (isAccessDeniedError(error)) {
          return [];
        }
        throw error;
      }
    };

    try {
      setIsRefreshing(true);
      const [masukRows, keluarRows, baRows, sjRowsRaw] = await Promise.all([
        fetchIfAllowed('surat-masuk', () => api.get('/surat-masuk')),
        fetchIfAllowed('surat-keluar', () => api.get('/surat-keluar')),
        fetchIfAllowed('berita-acara', () => api.get('/berita-acara')),
        fetchIfAllowed('surat-jalan', () => api.get('/surat-jalan')),
      ]);
      const sjRows = mapEntityRows<SuratJalan>(sjRowsRaw);
      setServerSuratMasukList(mapEntityRows<SuratMasuk>(masukRows));
      setServerSuratKeluarList(mapEntityRows<SuratKeluar>(keluarRows));
      setServerBeritaAcaraList(mapEntityRows<BeritaAcara>(baRows));
      setServerSuratJalanList(sjRows);
    } catch {
      setServerSuratMasukList(null);
      setServerSuratKeluarList(null);
      setServerBeritaAcaraList(null);
      setServerSuratJalanList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardSuratSources();
  }, [currentRole, hasPrivilegedAccess]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusMasukColor = (status: string) => {
    switch (status) {
      case 'Baru': return 'bg-yellow-100 text-yellow-700';
      case 'Disposisi': return 'bg-blue-100 text-blue-700';
      case 'Proses': return 'bg-purple-100 text-purple-700';
      case 'Selesai': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Recent activity aggregated from all types
  const allActivity = [
    ...(effectiveSuratMasukList || []).map(s => ({ type: 'masuk', action: `Surat masuk dari ${s.pengirim}`, time: s.createdAt || s.tanggalTerima, icon: Mail, color: 'text-blue-600' })),
    ...(effectiveSuratKeluarList || []).filter(s => s && s.status === 'Sent').map(s => ({ type: 'keluar', action: `Surat ${s.noSurat} telah dikirim ke ${s.tujuan}`, time: s.tglKirim || s.tanggalSurat, icon: Send, color: 'text-green-600' })),
    ...(effectiveBeritaAcaraList || []).map(ba => ({ type: 'ba', action: `BAST ${ba.noBeritaAcara} dibuat`, time: ba.createdAt || ba.tanggal, icon: FileText, color: 'text-purple-600' })),
    ...(effectiveSuratJalanList || []).map(sj => ({ type: 'sj', action: `Surat Jalan ${sj.noSurat} diterbitkan`, time: sj.createdAt || sj.tanggal, icon: Truck, color: 'text-orange-600' }))
  ].filter(act => act.time).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

  const dashboardStats = [
    {
      label: 'Surat Masuk',
      val: effectiveSuratMasukList.filter((s) => String(s.status || '').toUpperCase() !== 'SELESAI').length,
      icon: Mail,
      color: 'blue' as const,
      sub: 'Butuh Tindak Lanjut',
    },
    {
      label: 'Surat Keluar',
      val: effectiveSuratKeluarList.filter((s) => String(s.status || '').toUpperCase() === 'SENT').length,
      icon: Send,
      color: 'emerald' as const,
      sub: 'Terkirim',
    },
    {
      label: 'Berita Acara',
      val: effectiveBeritaAcaraList.length,
      icon: FileText,
      color: 'purple' as const,
      sub: effectiveBeritaAcaraList.length > 0 ? 'Arsip Tersimpan' : 'Belum Ada Arsip',
    },
    {
      label: 'Surat Jalan',
      val: effectiveSuratJalanList.filter((s) => !s.archived && String(s.deliveryStatus || '').toUpperCase() !== 'DELIVERED').length,
      icon: Truck,
      color: 'orange' as const,
      sub: 'Pengiriman Aktif',
    },
  ];

  const handleExportArchive = async () => {
    const rows = [
      ['Module', 'Document No', 'Date', 'Party', 'Status'],
      ...effectiveSuratMasukList.map((s: any) => ['Surat Masuk', s.noSurat || '', s.tanggalTerima || '', s.pengirim || '', s.status || '']),
      ...effectiveSuratKeluarList.map((s: any) => ['Surat Keluar', s.noSurat || '', s.tanggalSurat || '', s.tujuan || '', s.status || '']),
      ...effectiveBeritaAcaraList.map((b: any) => ['Berita Acara', b.noBA || b.noBeritaAcara || '', b.tanggal || '', b.pihakKedua || '', b.status || 'Draft']),
      ...effectiveSuratJalanList.map((s: any) => ['Surat Jalan', s.noSurat || '', s.tanggal || '', s.tujuan || '', s.deliveryStatus || 'Pending']),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `correspondence-archive-${dateKey}`,
      title: 'Correspondence Archive Report',
      subtitle: `Tanggal ${dateKey} | Surat Masuk ${effectiveSuratMasukList.length} | Surat Keluar ${effectiveSuratKeluarList.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Arsip korespondensi mencakup ${effectiveBeritaAcaraList.length} berita acara dan ${effectiveSuratJalanList.length} surat jalan. Dokumen ini dipakai sebagai register administrasi terpusat.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Correspondence Hub',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `correspondence-archive-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `correspondence-archive-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Archive correspondence Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export archive correspondence gagal.');
    }
  };

  const handleDownloadArchiveImage = async () => {
    try {
      const response = await fetch(physicalArchiveDownloadImg);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `physical-archive-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Preview archive image berhasil diunduh.');
    } catch {
      toast.error('Gagal mengunduh archive image.');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic uppercase">
            <Archive className="text-blue-600" size={32} />
            Correspondence Hub
          </h1>
          <p className="text-slate-500 font-medium italic">Digital Archive & Correspondence Management PT Gema Teknik Perkasa</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDashboardSuratSources} disabled={isRefreshing} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={handleExportArchive} className="px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all">
            <Download size={14} /> Export Archive
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {dashboardStats.map((stat, i) => (
          <div key={i} className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm group hover:border-blue-500/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${STAT_STYLES[stat.color].icon}`}>
                <stat.icon size={24} />
              </div>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{stat.val}</span>
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
            <div className={`mt-1 text-[10px] font-bold italic uppercase ${STAT_STYLES[stat.color].sub}`}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Physical Archive */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden group">
            <div className="p-5 border-b-2 border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-slate-900 font-black text-[12px] uppercase tracking-widest flex items-center gap-2 italic">
                <FileText className="text-blue-600" size={18} />
                Recent Physical Scans Archive
              </h2>
              <button 
                onClick={() => setShowGallery(!showGallery)}
                className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest"
              >
                {showGallery ? 'Close Preview' : 'Expand View'}
              </button>
            </div>
            <div className={`p-6 transition-all duration-500 ${showGallery ? 'max-h-[1000px]' : 'max-h-[320px]'} overflow-hidden relative`}>
              <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-center cursor-pointer group/img relative" onClick={() => setShowGallery(!showGallery)}>
                 <ImageWithFallback 
                   src={physicalArchivePreviewImg} 
                   className="w-full h-auto rounded-lg shadow-2xl border border-slate-200" 
                 />
                 {!showGallery && (
                   <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <div className="bg-white p-3 rounded-full text-slate-900 shadow-xl">
                         <Maximize2 size={24} />
                      </div>
                   </div>
                 )}
              </div>
              {!showGallery && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Digitalized Documents</p>
                 <p className="text-[11px] font-bold italic opacity-80 uppercase">SPK Workshop & Customer Purchase Order (IHI)</p>
               </div>
               <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-500">Scan Status</p>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Verified</p>
                  </div>
                  <button onClick={handleDownloadArchiveImage} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                    <Download size={14} />
                  </button>
               </div>
            </div>
          </div>

          {/* Quick Actions (SPK ADDED) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'surat-masuk', label: 'Surat Masuk', icon: Mail, color: 'blue' },
              { id: 'surat-keluar', label: 'Surat Keluar', icon: Send, color: 'emerald' },
              { id: 'berita-acara', label: 'Berita Acara', icon: FileText, color: 'purple' },
              { id: 'surat-jalan', label: 'Surat Jalan', icon: Truck, color: 'orange' },
              { id: 'spk', label: 'SPK Workshop', icon: Zap, color: 'amber' },
            ].map(act => (
              <button 
                key={act.id}
                onClick={() => navigate(`/surat-menyurat/${act.id}`)} 
                className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center gap-3 group"
              >
                <div className={`p-3 bg-${act.color}-50 text-${act.color}-600 rounded-xl group-hover:bg-${act.color}-600 group-hover:text-white transition-all shadow-sm`}>
                  <act.icon size={20} />
                </div>
                <span className="font-black text-[8px] text-slate-700 uppercase tracking-widest text-center">{act.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b-2 border-slate-50 bg-slate-50/50">
              <h2 className="text-slate-900 font-black text-[12px] uppercase tracking-widest flex items-center gap-2 italic">
                <Clock className="text-slate-500" size={18} />
                System Activity
              </h2>
            </div>
            <div className="p-5 space-y-6">
              {allActivity.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">No Activity</div>
                  <div className="mt-2 text-[11px] text-slate-400 font-medium italic">
                    Belum ada aktivitas korespondensi yang cukup untuk ditampilkan.
                  </div>
                </div>
              )}
              {allActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-start gap-4 group">
                    <div className={`p-3 rounded-xl bg-slate-50 ${activity.color} shadow-sm group-hover:scale-110 transition-transform`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-slate-800 uppercase leading-tight tracking-tight mb-1 line-clamp-2">{activity.action}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-2">
                        <span>{new Date(activity.time).toLocaleTimeString('id-ID')}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>{formatDate(activity.time)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
             <Archive className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48 group-hover:scale-110 transition-transform duration-700" />
             <div className="relative z-10">
                <div className="w-12 h-1.5 bg-blue-500 rounded-full mb-6"></div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-4 leading-tight">Secure Digital Correspondence</h3>
                <p className="text-slate-400 text-[11px] font-medium leading-relaxed italic border-l-2 border-slate-800 pl-4">
                   "Pencatatan persuratan digital menjamin integritas data operasional dan mempermudah akses dokumen fisik kapan pun dibutuhkan."
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
