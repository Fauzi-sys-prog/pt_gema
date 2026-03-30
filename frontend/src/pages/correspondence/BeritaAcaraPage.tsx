import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { BeritaAcara, SuratJalan } from '../../contexts/AppContext';

import { motion, AnimatePresence } from 'motion/react';
import { FileText, Plus, X, Printer, Save, Download, FileSignature, ChevronDown, Layers, Package, CheckCircle2, Clock, Copy, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { sanitizeRichHtml } from '../../utils/sanitizeRichHtml';
import { hasRoleAccess } from '../../utils/roles';
import FlowHintBar from '../../components/ui/FlowHintBar';
import { useNavigate } from 'react-router-dom';

const BERITA_ACARA_PAGE_READ_ROLES = {
  'berita-acara': ['OWNER', 'ADMIN', 'HR', 'SALES', 'WAREHOUSE', 'FINANCE', 'PRODUKSI'],
  'surat-jalan': ['OWNER', 'ADMIN', 'WAREHOUSE', 'SALES', 'PRODUKSI'],
} as const;

const isAccessDeniedError = (error: unknown): boolean =>
  Number((error as any)?.response?.status) === 403;

export default function BeritaAcaraPage() {
  const { beritaAcaraList, addBeritaAcara, updateBeritaAcara, deleteBeritaAcara, addAuditLog, suratJalanList, currentUser } = useApp();
  const navigate = useNavigate();
  const [serverBeritaAcaraList, setServerBeritaAcaraList] = useState<BeritaAcara[] | null>(null);
  const [serverSuratJalanList, setServerSuratJalanList] = useState<SuratJalan[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveBeritaAcaraList = serverBeritaAcaraList ?? beritaAcaraList;
  const effectiveSuratJalanList = serverSuratJalanList ?? suratJalanList;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBA, setSelectedBA] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sjPickerOpen, setSjPickerOpen] = useState(false);
  const [sjPickerQuery, setSjPickerQuery] = useState('');
  const [sjQuickFilter, setSjQuickFilter] = useState<'all' | 'today' | 'week' | 'unused'>('all');
  const contentRef = useRef<HTMLDivElement>(null);
  const currentRole = String(currentUser?.role || '').trim().toUpperCase();
  const hasPrivilegedAccess = currentRole === 'ADMIN' || currentRole === 'MANAGER' || hasRoleAccess(currentRole, ['OWNER']);

  const [formData, setFormData] = useState({
    noBA: `BA/${new Date().getFullYear()}/${(effectiveBeritaAcaraList.length + 1).toString().padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    jenisBA: 'Serah Terima Barang' as any,
    pihakPertama: 'PT GEMA TEKNIK PERKASA',
    pihakPertamaNama: 'Syamsudin',
    pihakPertamaJabatan: 'Direktur Utama',
    pihakKedua: '',
    pihakKeduaNama: '',
    pihakKeduaJabatan: '',
    lokasi: '',
    refSuratJalan: '',
    saksi1: '',
    saksi2: '',
  });

  const [editableContent, setEditableContent] = useState('');
  const sanitizedEditableContent = sanitizeRichHtml(editableContent);
  const sanitizedSelectedContent = sanitizeRichHtml(selectedBA?.contentHTML || '');

  const fetchBeritaAcaraSources = async () => {
    const canRead = (resource: keyof typeof BERITA_ACARA_PAGE_READ_ROLES) =>
      hasPrivilegedAccess || hasRoleAccess(currentRole, BERITA_ACARA_PAGE_READ_ROLES[resource]);

    const fetchIfAllowed = async <T,>(
      resource: keyof typeof BERITA_ACARA_PAGE_READ_ROLES,
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
      const [baRows, sjRows] = await Promise.all([
        fetchIfAllowed('berita-acara', () => api.get('/berita-acara')),
        fetchIfAllowed('surat-jalan', () => api.get('/surat-jalan')),
      ]);
      setServerBeritaAcaraList(Array.isArray(baRows) ? (baRows as BeritaAcara[]) : []);
      setServerSuratJalanList(Array.isArray(sjRows) ? (sjRows as SuratJalan[]) : []);
    } catch {
      setServerBeritaAcaraList(null);
      setServerSuratJalanList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBeritaAcaraSources();
  }, [currentRole, hasPrivilegedAccess]);

  const usedSuratJalanSet = useMemo(() => {
    return new Set(
      (effectiveBeritaAcaraList || [])
        .map((ba) => String(ba.refSuratJalan || '').trim())
        .filter(Boolean),
    );
  }, [effectiveBeritaAcaraList]);

  const sortedSuratJalanList = useMemo(() => {
    const rows = [...(effectiveSuratJalanList || [])];
    rows.sort((a, b) => {
      const da = new Date(a.tanggal || a.createdAt || 0).getTime();
      const db = new Date(b.tanggal || b.createdAt || 0).getTime();
      return db - da;
    });
    return rows;
  }, [effectiveSuratJalanList]);

  const filteredSuratJalanList = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const q = sjPickerQuery.trim().toLowerCase();
    const rows = sortedSuratJalanList.filter((sj) => {
      const t = new Date(sj.tanggal || sj.createdAt || 0).getTime();
      if (sjQuickFilter === 'today' && t < startOfToday) return false;
      if (sjQuickFilter === 'week' && t < startOfWeek) return false;
      if (sjQuickFilter === 'unused' && usedSuratJalanSet.has(String(sj.id || ''))) return false;
      if (!q) return true;
      const bag = `${sj.noSurat || ''} ${sj.tujuan || ''} ${sj.tanggal || ''} ${sj.projectId || ''}`.toLowerCase();
      return bag.includes(q);
    });
    // Limit awal 20, sisanya lewat search
    if (!q) return rows.slice(0, 20);
    return rows;
  }, [sortedSuratJalanList, sjQuickFilter, sjPickerQuery, usedSuratJalanSet]);

  const selectedSuratJalan = useMemo(
    () => sortedSuratJalanList.find((sj) => sj.id === formData.refSuratJalan),
    [sortedSuratJalanList, formData.refSuratJalan],
  );

  const formatSjBadge = (sj: SuratJalan) => {
    if ((sj as any)?.archived) return { label: 'Archived', className: 'bg-slate-100 text-slate-600' };
    const status = String(sj.deliveryStatus || '').trim();
    if (status === 'Delivered') return { label: 'Delivered', className: 'bg-emerald-100 text-emerald-700' };
    if (status === 'Pending' || !status) return { label: 'Pending', className: 'bg-amber-100 text-amber-700' };
    return { label: status, className: 'bg-blue-100 text-blue-700' };
  };

  // Template Generator
  const generateTemplate = (type: string, data: any) => {
    const templates: any = {
      'Serah Terima Barang': `
        <p style="margin-bottom: 15px;">Dengan ini menyatakan bahwa pihak pertama telah menyelesaikan pekerjaan <strong contenteditable="true">Jasa Install Refractory LCM-450 PT. Hekikai Indonesia</strong></p>
        <p style="margin-bottom: 15px;">Pekerjaan dilakukan pada tanggal <strong contenteditable="true">4 s/d 15 ${new Date(data.tanggal).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong>.</p>
        
        <p style="margin-bottom: 15px;">Sesuai dengan No PO : <strong contenteditable="true">2-DAI-2511004</strong> tanggal <strong contenteditable="true">3 November 2025</strong>.</p>
        
        <p style="margin-bottom: 30px;">Pekerjaan tersebut telah dilaksanakan dan diselesaikan oleh pihak pertama, sesuai dengan kesepakatan dan schedule yang dikeluarkan oleh ${data.pihakKedua || 'PT. Daiki Aluminium Industry Indonesia'}.</p>
        
        <p style="margin-bottom: 40px;">Demikian berita acara ini kami buat untuk dipergunakan sebagaimana mestinya.</p>
      `,
      
      'Pengembalian Alat': `
        <p style="margin-bottom: 30px;">Dengan ini menyatakan bahwa pihak kedua telah mengembalikan peralatan kepada pihak pertama dalam kondisi <strong contenteditable="true">baik / rusak</strong>.</p>
        
        <p style="margin-bottom: 40px;">Demikian berita acara ini kami buat untuk dipergunakan sebagaimana mestinya.</p>
      `,
      
      'Inspeksi': `
        <p style="margin-bottom: 30px;">Pada hari ini telah dilaksanakan inspeksi di <strong contenteditable="true">${data.lokasi || '_______________'}</strong> dengan hasil sebagai berikut:</p>
        
        <p style="margin-bottom: 10px;"><strong>Temuan Inspeksi:</strong></p>
        <ol style="margin-bottom: 30px; line-height: 1.8;">
          <li contenteditable="true">_______________________________________________________________</li>
          <li contenteditable="true">_______________________________________________________________</li>
          <li contenteditable="true">_______________________________________________________________</li>
        </ol>
        
        <p style="margin-bottom: 10px;"><strong>Rekomendasi:</strong></p>
        <ol style="margin-bottom: 30px; line-height: 1.8;">
          <li contenteditable="true">_______________________________________________________________</li>
          <li contenteditable="true">_______________________________________________________________</li>
        </ol>
        
        <p style="margin-bottom: 40px;">Demikian berita acara ini kami buat untuk dipergunakan sebagaimana mestinya.</p>
      `
    };
    
    return templates[type] || templates['Serah Terima Barang'];
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, jenisBA: type }));
    setEditableContent(sanitizeRichHtml(generateTemplate(type, formData)));
  };

  const handleAutoFillFromSJ = (sjId: string) => {
    const sj = effectiveSuratJalanList.find(s => s.id === sjId);
    if (!sj) return;

    // Build item table from Surat Jalan
    const itemRows = sj.items.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 12px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 12px;"><strong>${item.namaItem}</strong></td>
        <td style="border: 1px solid #000; padding: 12px; text-align: center;"><strong>${item.jumlah}</strong></td>
        <td style="border: 1px solid #000; padding: 12px; text-align: center;">${item.satuan}</td>
        <td style="border: 1px solid #000; padding: 12px;">${item.keterangan || item.batchNo || '-'}</td>
      </tr>
    `).join('');

    const autoContent = `
      <p style="text-align: center; margin-bottom: 40px;"><strong style="font-size: 18px;">BERITA ACARA<br/>${sj.sjType === 'Equipment Loan' ? 'SERAH TERIMA PERALATAN' : 'SERAH TERIMA BARANG'}</strong></p>
      
      <p style="margin-bottom: 20px;">Pada hari ini <strong>${new Date(formData.tanggal).toLocaleDateString('id-ID', { weekday: 'long' })}</strong> tanggal <strong>${new Date(formData.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>, yang bertanda tangan di bawah ini:</p>
      
      <table style="width: 100%; margin-bottom: 30px; border: none;">
        <tr>
          <td style="width: 30%; vertical-align: top; padding: 8px 0;"><strong>Pihak Pertama</strong></td>
          <td style="width: 5%; vertical-align: top; padding: 8px 0;">:</td>
          <td style="width: 65%; vertical-align: top; padding: 8px 0;"><strong>${formData.pihakPertama}</strong><br/><span style="font-size: 12px; color: #666;">Dalam hal ini diwakili oleh <strong>${formData.pihakPertamaJabatan}</strong></span></td>
        </tr>
        <tr>
          <td style="width: 30%; vertical-align: top; padding: 8px 0;"><strong>Pihak Kedua</strong></td>
          <td style="width: 5%; vertical-align: top; padding: 8px 0;">:</td>
          <td style="width: 65%; vertical-align: top; padding: 8px 0;"><strong>${sj.tujuan}</strong><br/><span style="font-size: 12px; color: #666;">${sj.alamat}</span></td>
        </tr>
      </table>
      
      <p style="margin-bottom: 20px;">Dengan ini menyatakan bahwa <strong>Pihak Pertama</strong> telah menyerahkan dan <strong>Pihak Kedua</strong> telah menerima ${sj.sjType === 'Equipment Loan' ? 'peralatan' : 'barang-barang'} dengan rincian sebagai berikut:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 2px solid #000;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #000; padding: 12px; text-align: center; font-weight: bold;">No</th>
            <th style="border: 1px solid #000; padding: 12px; text-align: left; font-weight: bold;">Nama ${sj.sjType === 'Equipment Loan' ? 'Alat' : 'Barang'}</th>
            <th style="border: 1px solid #000; padding: 12px; text-align: center; font-weight: bold;">Jumlah</th>
            <th style="border: 1px solid #000; padding: 12px; text-align: center; font-weight: bold;">Satuan</th>
            <th style="border: 1px solid #000; padding: 12px; text-align: left; font-weight: bold;">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      
      <p style="margin-bottom: 20px;">${sj.sjType === 'Equipment Loan' ? 
        `Peralatan tersebut dipinjamkan dalam kondisi baik dan wajib dikembalikan paling lambat tanggal <strong>${sj.expectedReturnDate ? new Date(sj.expectedReturnDate).toLocaleDateString('id-ID') : '___________'}</strong>.` : 
        'Barang-barang tersebut diserahkan dalam kondisi baik dan sesuai dengan spesifikasi yang telah disepakati.'}</p>
      
      <p style="margin-bottom: 20px;"><strong>Referensi Dokumen:</strong> Surat Jalan No. ${sj.noSurat}</p>
      
      <p style="margin-bottom: 40px;">Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
    `;

    setEditableContent(sanitizeRichHtml(autoContent));
    setFormData(prev => ({
      ...prev,
      pihakKedua: sj.tujuan,
      lokasi: sj.alamat,
      refSuratJalan: sj.id,
      jenisBA: sj.sjType === 'Equipment Loan' ? 'Pengembalian Alat' : 'Serah Terima Barang'
    }));

    toast.success('Data berhasil di-load dari Surat Jalan!', {
      description: `No: ${sj.noSurat}`
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newBA = {
      id: `BA-${Date.now()}`,
      ...formData,
      contentHTML: sanitizeRichHtml(contentRef.current?.innerHTML || editableContent),
      createdBy: currentUser?.fullName || currentUser?.username || 'System',
      createdAt: new Date().toISOString()
    };

    const ok = await addBeritaAcara(newBA);
    if (!ok) return;
    addAuditLog({
      action: 'CREATE_BERITA_ACARA',
      module: 'Correspondence',
      details: `Membuat Berita Acara ${formData.noBA} - ${formData.jenisBA}`,
      status: 'Success'
    });

    toast.success('Berita Acara Berhasil Dibuat!', {
      description: `No: ${formData.noBA}`
    });

    setShowCreateModal(false);
    
    // Reset
    setFormData({
      noBA: `BA/${new Date().getFullYear()}/${(effectiveBeritaAcaraList.length + 2).toString().padStart(3, '0')}`,
      tanggal: new Date().toISOString().split('T')[0],
      jenisBA: 'Serah Terima Barang',
      pihakPertama: 'PT GEMA TEKNIK PERKASA',
      pihakPertamaNama: 'Syamsudin',
      pihakPertamaJabatan: 'Direktur Utama',
      pihakKedua: '',
      pihakKeduaNama: '',
      pihakKeduaJabatan: '',
      lokasi: '',
      refSuratJalan: '',
      saksi1: '',
      saksi2: '',
    });
    setEditableContent('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = async () => {
    if (!selectedBA) return;
    const id = String(selectedBA.id || '').trim();
    if (!id) {
      toast.error('ID Berita Acara tidak valid untuk export');
      return;
    }
    const safeNo = String(selectedBA.noBA || id).replace(/[^\w.-]+/g, '_');
    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/berita-acara/${id}/word`, { responseType: 'blob' }),
        api.get(`/exports/berita-acara/${id}/excel`, { responseType: 'blob' }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: 'application/msword' });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `${safeNo}_Berita_Acara.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `${safeNo}_Berita_Acara.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      toast.success('Download Word + Excel Berhasil!', {
        description: `File: ${safeNo}_Berita_Acara.doc dan .xls`
      });

      addAuditLog({
        action: 'DOWNLOAD_BA_WORD',
        module: 'Correspondence',
        details: `Download Berita Acara ${selectedBA.noBA} as Word document`,
        status: 'Success'
      });
    } catch {
      toast.error('Export Word + Excel BA gagal, silakan coba lagi');
    }
  };

  const filteredBA = effectiveBeritaAcaraList.filter(ba => 
    (ba.noBA || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ba.pihakKedua || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ba.jenisBA || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="px-3 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl lg:rounded-[2rem] flex items-center justify-center shadow-xl -rotate-3 flex-shrink-0">
                <FileSignature className="text-white" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase italic truncate">Berita Acara</h1>
                <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-wider lg:tracking-[0.2em] mt-1">Dokumen serah terima, penyelesaian kerja, dan bukti dasar untuk penagihan</p>
              </div>
            </div>
            <button 
              onClick={fetchBeritaAcaraSources}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-4 bg-white border border-slate-200 text-slate-700 rounded-xl lg:rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button 
              onClick={() => {
                setShowCreateModal(true);
                setEditableContent(generateTemplate('Serah Terima Barang', formData));
              }}
              className="w-full sm:w-auto px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl lg:rounded-[2rem] font-black uppercase text-xs sm:text-sm tracking-widest shadow-2xl hover:shadow-indigo-200 hover:scale-105 transition-all flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap"
            >
              <Plus size={16} className="sm:w-5 sm:h-5 flex-shrink-0" /> 
              <span className="hidden sm:inline">Buat Berita Acara Baru</span>
              <span className="sm:hidden">Buat BA Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 sm:px-6 lg:px-12 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          {[
            { label: 'Total BA', val: effectiveBeritaAcaraList.length, color: 'text-slate-900', icon: <FileText size={24} />, bg: 'bg-white' },
            { label: 'Serah Terima', val: effectiveBeritaAcaraList.filter(b => b.jenisBA === 'Serah Terima Barang').length, color: 'text-indigo-600', icon: <Package size={24} />, bg: 'bg-white' },
            { label: 'Pengembalian', val: effectiveBeritaAcaraList.filter(b => b.jenisBA === 'Pengembalian Alat').length, color: 'text-purple-600', icon: <Layers size={24} />, bg: 'bg-white' },
            { label: 'Inspeksi', val: effectiveBeritaAcaraList.filter(b => b.jenisBA === 'Inspeksi').length, color: 'text-emerald-600', icon: <CheckCircle2 size={24} />, bg: 'bg-white' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} p-4 sm:p-6 lg:p-8 rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:translate-y-[-4px] overflow-hidden`}>
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider lg:tracking-[0.2em] truncate">{stat.label}</p>
                <div className={`${stat.color} opacity-40 flex-shrink-0`}>{stat.icon}</div>
              </div>
              <h3 className={`text-xl sm:text-2xl lg:text-3xl font-black italic ${stat.color}`}>{stat.val}</h3>
            </div>
          ))}
        </div>

        <FlowHintBar
          className="mb-4 sm:mb-6 lg:mb-8"
          title="Alur Berita Acara:"
          badges={[
            { label: 'Pilih Surat Jalan / pekerjaan selesai', tone: 'info' },
            { label: 'Susun Berita Acara', tone: 'warning' },
            { label: 'Final / Disetujui', tone: 'success' },
            { label: 'Invoice siap dibuat', tone: 'neutral' },
          ]}
          helper="Berita Acara idealnya dibuat setelah kiriman sampai atau pekerjaan selesai. Dokumen final ini jadi pengikat sebelum invoice proyek diterbitkan."
          actions={[
            { label: 'Buka Surat Jalan', onClick: () => navigate('/surat-menyurat/surat-jalan') },
            { label: 'Buka Invoice', onClick: () => navigate('/sales/invoice') },
          ]}
        />

        {/* Search */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl lg:rounded-[2.5rem] border border-slate-100 mb-4 sm:mb-6 lg:mb-8">
          <input 
            type="text"
            placeholder="🔍 Search by No. BA, Pihak Kedua, atau Jenis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-none rounded-xl sm:rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl lg:rounded-[3rem] border border-slate-100 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-left text-[11px] font-black uppercase tracking-wider lg:tracking-[0.2em]">No. BA</th>
                  <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-left text-[11px] font-black uppercase tracking-wider lg:tracking-[0.2em]">Jenis BA</th>
                  <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-left text-[11px] font-black uppercase tracking-wider lg:tracking-[0.2em]">Pihak Kedua</th>
                  <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-center text-[11px] font-black uppercase tracking-wider lg:tracking-[0.2em]">Tanggal</th>
                  <th className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 text-center text-[11px] font-black uppercase tracking-wider lg:tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBA.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 lg:px-10 py-10 sm:py-15 lg:py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <FileText size={48} className="text-slate-200 sm:w-16 sm:h-16" />
                        <p className="text-slate-400 font-bold uppercase text-xs sm:text-sm">Belum ada Berita Acara</p>
                        <p className="max-w-md text-xs text-slate-500">
                          Mulai dari Surat Jalan atau pekerjaan yang sudah selesai, lalu buat Berita Acara sebagai bukti serah terima dan dasar dokumen tagihan.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBA.map((ba) => (
                    <tr key={ba.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="px-10 py-8">
                        <span className="text-sm font-black text-indigo-600 tracking-tighter uppercase italic">{ba.noBA}</span>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`inline-flex px-4 py-2 rounded-full text-[9px] font-black uppercase ${
                          ba.jenisBA === 'Serah Terima Barang' ? 'bg-indigo-50 text-indigo-600' :
                          ba.jenisBA === 'Pengembalian Alat' ? 'bg-purple-50 text-purple-600' :
                          ba.jenisBA === 'Inspeksi' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {ba.jenisBA}
                        </span>
                      </td>
                      <td className="px-10 py-8">
                        <span className="text-sm font-black text-slate-900 uppercase italic">{ba.pihakKedua}</span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(ba.tanggal).toLocaleDateString('id-ID')}</span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <button 
                          onClick={() => { setSelectedBA(ba); setShowPreview(true); }}
                          className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                        >
                          View & Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-6xl rounded-[4rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]"
            >
              <form onSubmit={handleCreate} className="flex flex-col h-full">
                <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl -rotate-3">
                      <Plus size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Buat Berita Acara Baru</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Word-Style Document Editor</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-2xl transition-all">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-12">
                  {/* Metadata Form */}
                  <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. BA</label>
                        <input type="text" required value={formData.noBA} onChange={(e) => setFormData({...formData, noBA: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                        <input type="date" required value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis BA</label>
                        <select value={formData.jenisBA} onChange={(e) => handleTypeChange(e.target.value)} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all appearance-none">
                          <option value="Serah Terima Barang">Serah Terima Barang</option>
                          <option value="Pengembalian Alat">Pengembalian Alat</option>
                          <option value="Inspeksi">Inspeksi</option>
                          <option value="Rapat">Rapat</option>
                          <option value="Penerimaan Pekerjaan">Penerimaan Pekerjaan</option>
                        </select>
                      </div>
                      
                      {/* Auto-fill from SJ */}
                      <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 block flex items-center gap-2">
                          <Copy size={14} /> Quick Fill dari Surat Jalan
                        </label>
                        <div className="space-y-3">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              value={sjPickerQuery}
                              onChange={(e) => {
                                setSjPickerQuery(e.target.value);
                                setSjPickerOpen(true);
                              }}
                              onFocus={() => setSjPickerOpen(true)}
                              placeholder="Cari No SJ / Customer / Tanggal..."
                              className="w-full pl-9 pr-4 py-3 bg-white border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: 'all', label: 'Semua' },
                              { key: 'today', label: 'Hari ini' },
                              { key: 'week', label: 'Minggu ini' },
                              { key: 'unused', label: 'Belum dipakai BA' },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => {
                                  setSjQuickFilter(opt.key as any);
                                  setSjPickerOpen(true);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  sjQuickFilter === opt.key
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {sjPickerOpen && (
                            <div className="max-h-56 overflow-auto bg-white rounded-xl border border-slate-200 shadow-xl">
                              {filteredSuratJalanList.length === 0 ? (
                                <div className="px-4 py-3 text-xs font-bold text-slate-400">Data Surat Jalan tidak ditemukan.</div>
                              ) : (
                                filteredSuratJalanList.map((sj) => {
                                  const badge = formatSjBadge(sj);
                                  const selected = formData.refSuratJalan === sj.id;
                                  return (
                                    <button
                                      key={sj.id}
                                      type="button"
                                      onClick={() => {
                                        handleAutoFillFromSJ(sj.id);
                                        setSjPickerQuery(`${sj.noSurat} • ${sj.tujuan} • ${new Date(sj.tanggal).toLocaleDateString('id-ID')}`);
                                        setSjPickerOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-all ${
                                        selected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-black text-slate-900">
                                          {sj.noSurat} • {sj.tujuan} • {new Date(sj.tanggal).toLocaleDateString('id-ID')}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${badge.className}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-[10px] text-slate-500 font-bold">
                                        {sj.sjType} {sj.projectId ? `• Project ${sj.projectId}` : ''}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                          {selectedSuratJalan && (
                            <div className="bg-white rounded-xl border border-indigo-100 p-3">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Ringkasan SJ Terpilih</p>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div><span className="text-slate-400 font-bold">No SJ:</span> <span className="font-black text-slate-900">{selectedSuratJalan.noSurat}</span></div>
                                <div><span className="text-slate-400 font-bold">Tanggal:</span> <span className="font-black text-slate-900">{new Date(selectedSuratJalan.tanggal).toLocaleDateString('id-ID')}</span></div>
                                <div><span className="text-slate-400 font-bold">Customer:</span> <span className="font-black text-slate-900">{selectedSuratJalan.tujuan}</span></div>
                                <div><span className="text-slate-400 font-bold">Items:</span> <span className="font-black text-slate-900">{selectedSuratJalan.items?.length || 0}</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pihak Pertama</label>
                        <input type="text" required value={formData.pihakPertama} onChange={(e) => setFormData({...formData, pihakPertama: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold uppercase outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan</label>
                        <input type="text" value={formData.pihakPertamaJabatan} onChange={(e) => setFormData({...formData, pihakPertamaJabatan: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pihak Kedua</label>
                        <input type="text" required value={formData.pihakKedua} onChange={(e) => setFormData({...formData, pihakKedua: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold uppercase outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi</label>
                        <input type="text" value={formData.lokasi} onChange={(e) => setFormData({...formData, lokasi: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Word-like Editor */}
                  <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-2xl">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 uppercase italic">Dokumen Editor</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">✏️ Click tabel untuk edit langsung</p>
                    </div>
                    <div 
                      ref={contentRef}
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: sanitizedEditableContent }}
                      className="min-h-[600px] p-16 bg-white border-2 border-slate-200 rounded-2xl shadow-inner prose prose-sm max-w-none focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                      style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.8',
                        color: '#000'
                      }}
                    />
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-8 mt-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saksi 1 (Optional)</label>
                      <input type="text" value={formData.saksi1} onChange={(e) => setFormData({...formData, saksi1: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saksi 2 (Optional)</label>
                      <input type="text" value={formData.saksi2} onChange={(e) => setFormData({...formData, saksi2: e.target.value})} className="w-full px-6 py-4 bg-white border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-10 py-5 bg-white border border-slate-200 text-slate-600 rounded-[2rem] font-black uppercase text-sm tracking-widest hover:bg-slate-100 transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl hover:shadow-indigo-200 hover:scale-105 transition-all flex items-center gap-3">
                    <Save size={20} /> Save Berita Acara
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview & Print Modal */}
      <AnimatePresence>
        {showPreview && selectedBA && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-5xl rounded-[4rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]"
            >
              <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0 print:hidden">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl -rotate-3">
                    <FileSignature size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Preview & Print</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{selectedBA.noBA}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={handlePrint} className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all shadow-sm" title="Print / Save as PDF">
                    <Printer size={24} />
                  </button>
                  <button onClick={handleDownloadWord} className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:shadow-lg transition-all shadow-sm flex items-center gap-2 font-black text-sm uppercase" title="Download sebagai Word + Excel Document">
                    <Download size={20} /> Word + Excel
                  </button>
                  <button onClick={() => setShowPreview(false)} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-16 bg-slate-100 print:bg-white print:p-0" id="ba-print">
                <div className="bg-white p-16 shadow-xl border border-slate-200 mx-auto max-w-[210mm] min-h-[297mm] print:shadow-none print:border-none">
                  {/* Header with Logo & Company Info */}
                  <div className="border-b-[3px] border-black pb-3 mb-4 flex gap-3">
                    {/* Logo Box */}
                    <div className="w-[90px] h-[60px] bg-red-700 border-2 border-black flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-[28px] tracking-wide" style={{ fontFamily: 'Arial Black, sans-serif' }}>GM</span>
                    </div>
                    
                    {/* Company Info */}
                    <div className="pl-2">
                      <h2 className="text-[12pt] font-bold text-red-700 leading-tight mb-0.5">GEMA TEKNIK PERKASA</h2>
                      <p className="text-[8pt] font-bold leading-tight mb-1">SPESIALIS FABRIKASI & JASA PEMASANGAN PIPA</p>
                      <p className="text-[7.5pt] leading-tight">
                        Jl. Nurushoba II No 13 Setia Mekar, Tambun Selatan Bekasi 17510<br/>
                        Telp : 0878396237, 081388788177 Fax : 02181012310
                      </p>
                    </div>
                  </div>
                  
                  {/* Date */}
                  <p className="text-[10pt] mb-5">Bekasi, {new Date(selectedBA.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  
                  {/* Title */}
                  <div className="text-center mb-1">
                    <h1 className="text-[12pt] font-bold tracking-[0.4em]">B E R I T A  -  A C A R A</h1>
                  </div>
                  <p className="text-center text-[10pt] mb-6">(    No : {selectedBA.noBA}   )</p>

                  {/* Content - Identity blocks */}
                  <div className="text-[10pt]" style={{ lineHeight: '1.4' }}>
                    <p className="mb-4">Yang bertanda tangan dibawah ini :</p>
                    
                    {/* Pihak Pertama */}
                    <div className="mb-4">
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Nama</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>{selectedBA.pihakPertamaNama || 'Syamsudin'}</span>
                      </div>
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Perusahaan</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>{selectedBA.pihakPertama}</span>
                      </div>
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Alamat</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>Jl Nurushoba II No 13 Setia Mekar  Tambun   Bekasi</span>
                      </div>
                    </div>
                    
                    <p className="mb-4 italic">Disebut sebagai pihak pertama</p>
                    
                    {/* Pihak Kedua */}
                    <div className="mb-4">
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Nama</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>{selectedBA.pihakKeduaNama || 'Shintaro Ohtake'}</span>
                      </div>
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Perusahaan</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>{selectedBA.pihakKedua}</span>
                      </div>
                      <div className="mb-1">
                        <span className="inline-block w-[120px]">Alamat</span>
                        <span className="inline-block w-[15px]">:</span>
                        <span>{selectedBA.lokasi || 'Jl.Maligi VIII Lot T-2 Kawasan Industri KIIC Teluk Jambe Barat Karawang'}</span>
                      </div>
                    </div>
                    
                    <p className="mb-4 italic">Disebut sebagai pihak kedua.</p>
                    
                    {/* Dynamic Content */}
                    <div 
                      dangerouslySetInnerHTML={{ __html: sanitizedSelectedContent }}
                      className="prose prose-sm max-w-none"
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '10pt',
                        lineHeight: '1.4'
                      }}
                    />
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-8 mt-12">
                    <div className="text-center">
                      <p className="text-[10pt] font-bold mb-1">Pihak pertama</p>
                      <p className="text-[10pt] mb-1">{selectedBA.pihakPertama}</p>
                      <div className="h-20"></div>
                      <div className="inline-block border-b border-black pb-1 min-w-[150px]">
                        <span className="text-[10pt]">{selectedBA.pihakPertamaNama || 'Syamsudin'}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10pt] font-bold mb-1">Pihak kedua</p>
                      <p className="text-[10pt] mb-1">{selectedBA.pihakKedua}</p>
                      <div className="h-20"></div>
                      <div className="inline-block border-b border-black pb-1 min-w-[150px]">
                        <span className="text-[10pt]">{selectedBA.pihakKeduaNama || 'Shintaro Ohtake'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-white {
            background: white !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
