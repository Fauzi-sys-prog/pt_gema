import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import { FileText, Plus, X, Save, Download, FileSignature, ChevronDown, Layers, Package, CheckCircle2, Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { downloadWordDocument } from '../../components/BeritaAcaraWordExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useAuth } from '../../contexts/AuthContext';
import ownerSignature from '../../../assets/owner-signature.png';

export default function BeritaAcaraPage() {
  const { beritaAcaraList, addBeritaAcara, updateBeritaAcara, deleteBeritaAcara, addAuditLog, suratJalanList } = useApp();
  const { currentUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBA, setSelectedBA] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    noBA: `BA/${new Date().getFullYear()}/${(beritaAcaraList.length + 1).toString().padStart(3, '0')}`,
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
    refProject: '',
    saksi1: '',
    saksi2: '',
  });

  const [editableContent, setEditableContent] = useState('');

  useEscapeKey([
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
    { condition: showPreview, close: () => setShowPreview(false) },
  ]);


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
    setEditableContent(generateTemplate(type, formData));
  };

  const handleAutoFillFromSJ = (sjId: string) => {
    const sj = suratJalanList.find(s => s.id === sjId);
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

    setEditableContent(autoContent);
    setFormData(prev => ({
      ...prev,
      pihakKedua: sj.tujuan,
      lokasi: sj.alamat,
      refSuratJalan: sj.id,
      refProject: sj.projectId || '',
      jenisBA: sj.sjType === 'Equipment Loan' ? 'Pengembalian Alat' : 'Serah Terima Barang'
    }));

    toast.success('Data berhasil di-load dari Surat Jalan!', {
      description: `No: ${sj.noSurat}`
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const newBA = {
      id: `BA-${Date.now()}`,
      ...formData,
      contentHTML: contentRef.current?.innerHTML || editableContent,
      // Referensi project diwariskan dari Surat Jalan saat memakai Quick Fill.
      refProject: (formData as any).refProject || undefined,
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      status: 'Pending Approval' as const
    };

    try {
      addBeritaAcara(newBA);
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
      noBA: `BA/${new Date().getFullYear()}/${(beritaAcaraList.length + 2).toString().padStart(3, '0')}`,
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
    } catch (err) {
      toast.error('Berita Acara gagal disimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!selectedBA) return;

    await downloadWordDocument(
      selectedBA,
      `${selectedBA.noBA.replace(/\//g, '-')}_Berita_Acara.doc`
    );

    toast.success('Download Word Berhasil!', {
      description: `File: ${selectedBA.noBA}_Berita_Acara.doc`
    });

    addAuditLog({
      action: 'DOWNLOAD_BA_WORD',
      module: 'Correspondence',
      details: `Download Berita Acara ${selectedBA.noBA} as Word document`,
      status: 'Success'
    });
  };

  const handleDownloadWord_OLD = () => {
    if (!selectedBA) return;

    // OLD CODE - Create a complete HTML document for Word
    const wordContent = `
      <!DOCTYPE html>
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${selectedBA.noBA} - Berita Acara</title>
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
          }
          table, th, td {
            border: 1px solid black;
          }
          th, td {
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .header {
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .company-info {
            font-size: 9pt;
            color: #666;
          }
          .doc-number {
            background-color: #000;
            color: white;
            padding: 8px 15px;
            font-size: 10pt;
            font-weight: bold;
            display: inline-block;
          }
          .signature-area {
            margin-top: 60px;
            display: table;
            width: 100%;
          }
          .signature-col {
            display: table-cell;
            width: 50%;
            text-align: center;
            vertical-align: top;
            padding: 0 20px;
          }
          .signature-line {
            border-top: 2px solid #000;
            margin-top: 100px;
            padding-top: 10px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <table style="border: none; margin: 0;">
            <tr style="border: none;">
              <td style="border: none; width: 70%;">
                <div class="company-name">PT GEMA TEKNIK PERKASA</div>
                <div class="company-info">
                  Jl. Nurnishoba II No 13 Setia Mekar<br/>
                  Tambun Selatan, Bekasi, West Java<br/>
                  Tel: +62 21 8899 7766
                </div>
              </td>
              <td style="border: none; text-align: right; vertical-align: top;">
                <div class="doc-number">${selectedBA.noBA}</div>
              </td>
            </tr>
          </table>
        </div>

        ${selectedBA.contentHTML}

        <div class="signature-area">
          <div class="signature-col">
            <p style="font-size: 11pt; margin-bottom: 5px;">Pihak Pertama,</p>
            <p style="font-size: 11pt; font-weight: bold; margin-bottom: 100px;">${selectedBA.pihakPertama}</p>
            <div class="signature-line">
              ( ............................ )
            </div>
          </div>
          <div class="signature-col">
            <p style="font-size: 11pt; margin-bottom: 5px;">Pihak Kedua,</p>
            <p style="font-size: 11pt; font-weight: bold; margin-bottom: 100px;">${selectedBA.pihakKedua}</p>
            <div class="signature-line">
              ( ............................ )
            </div>
          </div>
        </div>

        ${(selectedBA.saksi1 || selectedBA.saksi2) ? `
          <div class="signature-area" style="margin-top: 40px;">
            ${selectedBA.saksi1 ? `
              <div class="signature-col">
                <p style="font-size: 11pt; margin-bottom: 100px;">Saksi 1</p>
                <div class="signature-line">
                  ( ${selectedBA.saksi1} )
                </div>
              </div>
            ` : ''}
            ${selectedBA.saksi2 ? `
              <div class="signature-col">
                <p style="font-size: 11pt; margin-bottom: 100px;">Saksi 2</p>
                <div class="signature-line">
                  ( ${selectedBA.saksi2} )
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob(['\ufeff', wordContent], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBA.noBA.replace(/\//g, '-')}_Berita_Acara.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Download Word Berhasil!', {
      description: `File: ${selectedBA.noBA}_Berita_Acara.doc`
    });

    addAuditLog({
      action: 'DOWNLOAD_BA_WORD',
      module: 'Correspondence',
      details: `Download Berita Acara ${selectedBA.noBA} as Word document`,
      status: 'Success'
    });
  };

  const filteredBA = beritaAcaraList.filter(ba => 
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
                <p className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-wider lg:tracking-[0.2em] mt-1">Official Document Management System</p>
              </div>
            </div>
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
            { label: 'Total BA', val: beritaAcaraList.length, color: 'text-slate-900', icon: <FileText size={24} />, bg: 'bg-white' },
            { label: 'Serah Terima', val: beritaAcaraList.filter(b => b.jenisBA === 'Serah Terima Barang').length, color: 'text-indigo-600', icon: <Package size={24} />, bg: 'bg-white' },
            { label: 'Pengembalian', val: beritaAcaraList.filter(b => b.jenisBA === 'Pengembalian Alat').length, color: 'text-purple-600', icon: <Layers size={24} />, bg: 'bg-white' },
            { label: 'Inspeksi', val: beritaAcaraList.filter(b => b.jenisBA === 'Inspeksi').length, color: 'text-emerald-600', icon: <CheckCircle2 size={24} />, bg: 'bg-white' },
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
                        <span className={`inline-flex mb-2 px-3 py-1 rounded-full text-[9px] font-black uppercase ${ba.status === 'Approved' || !ba.status ? 'bg-emerald-50 text-emerald-700' : ba.status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{ba.status || 'Approved'}</span>
                        {ba.status === 'Pending Approval' && currentUser?.role === 'Owner' && (
                          <>
                            <button
                              disabled={isSubmitting}
                              onClick={() => {
                                if (!window.confirm(`Approve Berita Acara ${ba.noBA}? Dokumen akan difinalkan dengan tanda tangan Owner.`)) return;
                                setIsSubmitting(true);
                                try {
                                  updateBeritaAcara(ba.id, { status: 'Approved', approvedBy: currentUser.name, approvedAt: new Date().toISOString(), ttdPihakPertama: currentUser.signatureUrl || ownerSignature });
                                  toast.success(`BA ${ba.noBA} disetujui Owner.`);
                                } catch (err) {
                                  toast.error('Approve gagal: ' + (err instanceof Error ? err.message : 'Error'));
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }}
                              className="block mx-auto mb-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50">Approve Owner</button>
                            <button
                              disabled={isSubmitting}
                              onClick={() => {
                                const reason = window.prompt('Alasan penolakan BAST:');
                                if (!reason?.trim()) return;
                                setIsSubmitting(true);
                                try {
                                  updateBeritaAcara(ba.id, { status: 'Rejected', rejectionReason: reason.trim(), approvedBy: currentUser.name, approvedAt: new Date().toISOString() });
                                  toast.success(`BA ${ba.noBA} ditolak.`);
                                } catch (err) {
                                  toast.error('Penolakan gagal disimpan: ' + (err instanceof Error ? err.message : 'Error'));
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }}
                              className="block mx-auto mb-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-[9px] font-black uppercase disabled:opacity-50">Tolak</button>
                          </>
                        )}
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
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-white w-full sm:max-w-4xl rounded-t-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95dvh]"
          >
            <form onSubmit={handleCreate} className="flex flex-col min-h-0 h-full">

              {/* Header */}
              <div className="px-5 py-4 sm:px-8 sm:py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-2 shrink-0">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase italic tracking-tight leading-none">Buat Berita Acara</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 hidden sm:block">Word-Style Document Editor</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-5">

                  {/* Metadata Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">No. BA</label>
                        <input type="text" required value={formData.noBA} onChange={(e) => setFormData({...formData, noBA: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                        <input type="date" required value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis BA</label>
                        <select value={formData.jenisBA} onChange={(e) => handleTypeChange(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all appearance-none">
                          <option value="Serah Terima Barang">Serah Terima Barang</option>
                          <option value="Pengembalian Alat">Pengembalian Alat</option>
                          <option value="Inspeksi">Inspeksi</option>
                          <option value="Rapat">Rapat</option>
                          <option value="Penerimaan Pekerjaan">Penerimaan Pekerjaan</option>
                        </select>
                      </div>

                      {/* Auto-fill from SJ */}
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Copy size={12} /> Quick Fill dari Surat Jalan
                        </label>
                        <select onChange={(e) => handleAutoFillFromSJ(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border-none rounded-xl text-xs font-bold text-black outline-none focus:ring-2 focus:ring-indigo-200 transition-all appearance-none">
                          <option value="">-- Pilih Surat Jalan --</option>
                          {suratJalanList.map(sj => (
                            <option key={sj.id} value={sj.id}>{sj.noSurat} – {sj.tujuan}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pihak Pertama</label>
                        <input type="text" required value={formData.pihakPertama} onChange={(e) => setFormData({...formData, pihakPertama: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold uppercase text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan Pihak Pertama</label>
                        <input type="text" value={formData.pihakPertamaJabatan} onChange={(e) => setFormData({...formData, pihakPertamaJabatan: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pihak Kedua</label>
                        <input type="text" required value={formData.pihakKedua} onChange={(e) => setFormData({...formData, pihakKedua: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold uppercase text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi</label>
                        <input type="text" value={formData.lokasi} onChange={(e) => setFormData({...formData, lokasi: e.target.value})}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Word-like Editor */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <h3 className="text-[10px] font-black text-slate-700 uppercase italic tracking-widest">Dokumen Editor</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase hidden sm:block">✏️ Klik untuk edit langsung</p>
                    </div>
                    <div
                      ref={contentRef}
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: editableContent }}
                      className="min-h-[280px] sm:min-h-[420px] p-4 sm:p-8 bg-white prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px', lineHeight: '1.8', color: '#000' }}
                    />
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saksi 1 <span className="font-medium normal-case">(opsional)</span></label>
                      <input type="text" value={formData.saksi1} onChange={(e) => setFormData({...formData, saksi1: e.target.value})}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saksi 2 <span className="font-medium normal-case">(opsional)</span></label>
                      <input type="text" value={formData.saksi2} onChange={(e) => setFormData({...formData, saksi2: e.target.value})}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold text-black outline-none focus:border-indigo-300 transition-all" />
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3.5 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">
                  Batal
                </button>
                <button type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save size={15} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Berita Acara'}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

      {/* Preview & Print Modal */}
      {showPreview && selectedBA && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-white w-full sm:max-w-4xl rounded-t-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95dvh]"
          >
            <div className="px-5 py-4 sm:px-8 sm:py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-2 shrink-0">
                  <FileSignature size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase italic tracking-tight leading-none">Preview & Print</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{selectedBA.noBA}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={handleDownloadWord}
                  className="flex items-center gap-1.5 px-4 py-2.5 sm:px-6 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm">
                  <Download size={14} /> <span className="hidden sm:inline">Export to Word</span><span className="sm:hidden">Word</span>
                </button>
                <button onClick={() => setShowPreview(false)}
                  className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0" id="ba-print">
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
                      dangerouslySetInnerHTML={{ __html: selectedBA.contentHTML }}
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
