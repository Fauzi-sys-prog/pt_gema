import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Send, Trash2, CheckCircle, XCircle, X, FileText, Download, Printer, RefreshCw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { SuratKeluar } from '../../types/correspondence';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { sanitizeRichHtml } from '../../utils/sanitizeRichHtml';

export default function SuratKeluarPage() {
  const { suratKeluarList, addSuratKeluar, updateSuratKeluar, deleteSuratKeluar, projectList, templateSuratList, applyTemplate, addAuditLog, currentUser } = useApp();
  const [serverSuratKeluarList, setServerSuratKeluarList] = useState<SuratKeluar[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveSuratKeluarList = serverSuratKeluarList ?? suratKeluarList;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratKeluar | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  const [formData, setFormData] = useState<Partial<SuratKeluar>>({
    noSurat: '',
    tanggalSurat: new Date().toISOString().split('T')[0],
    tujuan: '',
    perihal: '',
    jenisSurat: '',
    pembuat: currentUser?.fullName || currentUser?.username || 'System',
    status: 'Draft',
    kategori: 'General',
    isiSurat: '',
  });
  const sanitizedSelectedSuratBody = sanitizeRichHtml(selectedSurat?.isiSurat || '');

  const fetchSuratKeluar = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/surat-keluar');
      const rows = Array.isArray(response.data) ? response.data : [];
      const items = rows.map((row: any) => {
        const payload = row?.payload ?? {};
        if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
          return { ...payload, id: row.entityId } as SuratKeluar;
        }
        return payload as SuratKeluar;
      });
      setServerSuratKeluarList(items);
    } catch {
      setServerSuratKeluarList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuratKeluar();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedFormData: Partial<SuratKeluar> = {
      ...formData,
      isiSurat:
        typeof formData.isiSurat === 'string'
          ? sanitizeRichHtml(formData.isiSurat)
          : formData.isiSurat,
    };
    
    if (editMode && selectedSurat) {
      const ok = await updateSuratKeluar(selectedSurat.id, sanitizedFormData);
      if (!ok) return;
      addAuditLog({
        action: 'SURAT_KELUAR_UPDATED',
        module: 'Correspondence',
        details: `Surat keluar ${selectedSurat.noSurat} diperbarui`,
        status: 'Success',
      });
      toast.success('Surat keluar berhasil diperbarui');
    } else {
      const fallbackNo = `SK/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
      const newSurat: SuratKeluar = {
        id: `SK-${Date.now()}`,
        noSurat: (sanitizedFormData.noSurat || '').trim() || fallbackNo,
        pembuat: (sanitizedFormData.pembuat || '').trim() || currentUser?.fullName || currentUser?.username || 'System',
        ...sanitizedFormData as SuratKeluar,
      };
      const ok = await addSuratKeluar(newSurat);
      if (!ok) return;
      addAuditLog({
        action: 'SURAT_KELUAR_CREATED',
        module: 'Correspondence',
        details: `Surat keluar ${newSurat.noSurat} dibuat`,
        status: 'Success',
      });
      toast.success('Surat keluar berhasil dibuat');
    }
    
    setShowModal(false);
    resetForm();
  };

  const handleEdit = (surat: SuratKeluar) => {
    setSelectedSurat(surat);
    setFormData(surat);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus surat ini?')) {
      const deleted = effectiveSuratKeluarList.find((s) => s.id === id);
      const ok = await deleteSuratKeluar(id);
      if (!ok) return;
      addAuditLog({
        action: 'SURAT_KELUAR_DELETED',
        module: 'Correspondence',
        details: `Surat keluar ${deleted?.noSurat || id} dihapus`,
        status: 'Warning',
      });
      toast.success('Surat keluar berhasil dihapus');
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (selectedSurat) {
      const actorName = currentUser?.fullName || currentUser?.username || 'System';
      const actorRole = currentUser?.role || 'UNKNOWN';
      const reviewedAt = new Date().toISOString();
      if (approved) {
        const ok = await updateSuratKeluar(selectedSurat.id, {
          status: 'Approved',
          approvedBy: actorName,
          approvedByRole: actorRole,
          reviewedBy: actorName,
          reviewedByRole: actorRole,
          reviewedAt,
        });
        if (!ok) return;
        addAuditLog({
          action: 'SURAT_KELUAR_APPROVED',
          module: 'Correspondence',
          details: `Surat ${selectedSurat.noSurat} disetujui`,
          status: 'Success',
        });
        toast.success('Surat disetujui');
      } else {
        const ok = await updateSuratKeluar(selectedSurat.id, {
          status: 'Draft',
          reviewedBy: actorName,
          reviewedByRole: actorRole,
          reviewedAt,
          notes: `Perlu revisi · ${actorName} · ${new Date(reviewedAt).toLocaleString('id-ID')}`,
        });
        if (!ok) return;
        addAuditLog({
          action: 'SURAT_KELUAR_REJECTED',
          module: 'Correspondence',
          details: `Surat ${selectedSurat.noSurat} dikembalikan ke draft`,
          status: 'Warning',
        });
        toast.success('Surat dikembalikan ke Draft');
      }
      setShowApprovalModal(false);
      setSelectedSurat(null);
    }
  };

  const handleSend = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin mengirim surat ini?')) {
      const surat = effectiveSuratKeluarList.find((s) => s.id === id);
      const ok = await updateSuratKeluar(id, {
        status: 'Sent',
        tglKirim: new Date().toISOString().split('T')[0],
      });
      if (!ok) return;
      addAuditLog({
        action: 'SURAT_KELUAR_SENT',
        module: 'Correspondence',
        details: `Surat ${surat?.noSurat || id} dikirim`,
        status: 'Success',
      });
      toast.success('Surat berhasil dikirim');
    }
  };

  const handleUseTemplate = (templateId: string) => {
    const template = templateSuratList.find(t => t.id === templateId);
    if (template) {
      // Create a dialog to input variables
      const variables: Record<string, string> = {};
      template.variables?.forEach(variable => {
        const value = window.prompt(`Masukkan nilai untuk ${variable}:`);
        if (value) {
          variables[variable] = value;
        }
      });

      const content = applyTemplate(templateId, variables);
      setFormData(prev => ({
        ...prev,
        isiSurat: sanitizeRichHtml(content),
        jenisSurat: template.jenisSurat,
        templateId: template.id,
      }));
      addAuditLog({
        action: 'SURAT_TEMPLATE_APPLIED',
        module: 'Correspondence',
        details: `Template ${template.namaTemplate} diterapkan untuk surat keluar`,
        status: 'Success',
      });
      setShowTemplateModal(false);
      toast.success('Template berhasil diterapkan');
    }
  };

  const resetForm = () => {
    setFormData({
      noSurat: '',
      tanggalSurat: new Date().toISOString().split('T')[0],
      tujuan: '',
      perihal: '',
      jenisSurat: '',
      pembuat: currentUser?.fullName || currentUser?.username || 'System',
      status: 'Draft',
      kategori: 'General',
      isiSurat: '',
    });
    setEditMode(false);
    setSelectedSurat(null);
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredSurat = effectiveSuratKeluarList.filter((surat) => {
    const matchesSearch =
      (surat.noSurat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (surat.tujuan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (surat.perihal || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || surat.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'Review': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'Sent': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleExportCsv = async () => {
    if (!filteredSurat.length) {
      toast.info('Tidak ada data surat keluar untuk diekspor.');
      return;
    }
    const rows = [
      ['No Surat', 'Tanggal Surat', 'Tujuan', 'Perihal', 'Jenis Surat', 'Pembuat', 'Status', 'Kategori', 'Disetujui Oleh', 'Tanggal Kirim'],
      ...filteredSurat.map((s) => [
        s.noSurat || '',
        s.tanggalSurat || '',
        s.tujuan || '',
        s.perihal || '',
        s.jenisSurat || '',
        s.pembuat || '',
        s.status || '',
        s.kategori || '',
        s.approvedBy || '',
        s.tglKirim || '',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `surat-keluar-${dateKey}`,
      title: 'Register Surat Keluar',
      subtitle: `Per tanggal ${dateKey} | Filter status ${filterStatus === 'all' ? 'Semua status' : filterStatus}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Register administrasi surat keluar perusahaan dengan total ${filteredSurat.length} dokumen pada hasil filter saat ini.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Correspondence',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `surat-keluar-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `surat-keluar-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'SURAT_KELUAR_EXPORT',
        module: 'Correspondence',
        details: `Export surat keluar Word+Excel (${filteredSurat.length} baris)`,
        status: 'Success',
      });
      toast.success('Export surat keluar Word + Excel berhasil.');
    } catch {
      toast.error('Export surat keluar gagal.');
    }
  };

  const handlePrintList = () => {
    window.print();
    addAuditLog({
      action: 'SURAT_KELUAR_PRINT',
      module: 'Correspondence',
      details: 'Print daftar surat keluar',
      status: 'Success',
    });
    toast.success('Halaman siap disimpan sebagai PDF.');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📤 Surat Keluar</h1>
        <p className="text-gray-600">Kelola surat dan dokumen yang dikirim</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">Total Surat</div>
          <div className="text-2xl font-bold text-blue-700">{effectiveSuratKeluarList.length}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-gray-600 text-sm font-medium">Draft</div>
          <div className="text-2xl font-bold text-gray-700">
            {effectiveSuratKeluarList.filter(s => s.status === 'Draft').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 text-sm font-medium">Approved</div>
          <div className="text-2xl font-bold text-green-700">
            {effectiveSuratKeluarList.filter(s => s.status === 'Approved').length}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">Terkirim</div>
          <div className="text-2xl font-bold text-blue-700">
            {effectiveSuratKeluarList.filter(s => s.status === 'Sent').length}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari nomor surat, tujuan, atau perihal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="Draft">Draft</option>
              <option value="Review">Review</option>
              <option value="Approved">Approved</option>
              <option value="Sent">Sent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={fetchSuratKeluar}
          disabled={isRefreshing}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
        <button
          onClick={openModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <Plus size={20} />
          Buat Surat Baru
        </button>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <FileText size={20} />
          Gunakan Template
        </button>
        <button
          onClick={handleExportCsv}
          className="bg-slate-800 hover:bg-black text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <Download size={18} />
          Export Word + Excel
        </button>
        <button
          onClick={handlePrintList}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  No Surat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tujuan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perihal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pembuat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSurat.map((surat) => (
                <tr key={surat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{surat.noSurat}</div>
                    <div className="text-sm text-gray-500">{surat.jenisSurat}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(surat.tanggalSurat).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{surat.tujuan}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">{surat.perihal}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {surat.pembuat}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(surat.status)}`}>
                      {surat.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedSurat(surat);
                          setShowDetailModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Lihat Detail"
                      >
                        <Eye size={18} />
                      </button>
                      {surat.status === 'Draft' && (
                        <>
                          <button
                            onClick={() => handleEdit(surat)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSurat(surat);
                              setShowApprovalModal(true);
                            }}
                            className="text-purple-600 hover:text-purple-900"
                            title="Submit untuk Review"
                          >
                            <CheckCircle size={18} />
                          </button>
                        </>
                      )}
                      {surat.status === 'Approved' && (
                        <button
                          onClick={() => handleSend(surat.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Kirim Surat"
                        >
                          <Send size={18} />
                        </button>
                      )}
                      {(surat.status === 'Draft' || surat.status === 'Review') && (
                        <button
                          onClick={() => handleDelete(surat.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {editMode ? 'Edit Surat Keluar' : 'Buat Surat Keluar'}
                </h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nomor Surat *
                    </label>
                    <input
                      type="text"
                      name="noSurat"
                      value={formData.noSurat}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Surat *
                    </label>
                    <input
                      type="date"
                      name="tanggalSurat"
                      value={formData.tanggalSurat}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tujuan *
                    </label>
                    <input
                      type="text"
                      name="tujuan"
                      value={formData.tujuan}
                      onChange={handleInputChange}
                      placeholder="Nama Perusahaan/Instansi"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jenis Surat *
                    </label>
                    <input
                      type="text"
                      name="jenisSurat"
                      value={formData.jenisSurat}
                      onChange={handleInputChange}
                      placeholder="Penawaran, Konfirmasi, dll"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pembuat *
                    </label>
                    <input
                      type="text"
                      name="pembuat"
                      value={formData.pembuat}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategori *
                    </label>
                    <select
                      name="kategori"
                      value={formData.kategori}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="General">General</option>
                      <option value="Project">Project</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="Procurement">Procurement</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perihal *
                  </label>
                  <textarea
                    name="perihal"
                    value={formData.perihal}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {formData.kategori === 'Project' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Link ke Project (Opsional)
                    </label>
                    <select
                      name="projectId"
                      value={formData.projectId || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Pilih Project --</option>
                      {projectList.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.projectNo} - {project.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Isi Surat
                  </label>
                  <textarea
                    name="isiSurat"
                    value={formData.isiSurat}
                    onChange={handleInputChange}
                    rows={10}
                    placeholder="Isi surat atau gunakan template..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      📄 Gunakan Template
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editMode ? 'Update' : 'Simpan sebagai Draft'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSurat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Detail Surat Keluar</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nomor Surat</label>
                    <div className="text-gray-900 font-medium">{selectedSurat.noSurat}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Jenis Surat</label>
                    <div className="text-gray-900">{selectedSurat.jenisSurat}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tanggal Surat</label>
                    <div className="text-gray-900">{new Date(selectedSurat.tanggalSurat).toLocaleDateString('id-ID')}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tujuan</label>
                    <div className="text-gray-900">{selectedSurat.tujuan}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Pembuat</label>
                    <div className="text-gray-900">{selectedSurat.pembuat}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(selectedSurat.status)}`}>
                        {selectedSurat.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Perihal</label>
                  <div className="text-gray-900">{selectedSurat.perihal}</div>
                </div>

                {selectedSurat.isiSurat && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Isi Surat</label>
                    <div className="text-gray-900 bg-gray-50 p-4 rounded-lg border mt-2 whitespace-pre-wrap">
                      <div dangerouslySetInnerHTML={{ __html: sanitizedSelectedSuratBody }} />
                    </div>
                  </div>
                )}

                {selectedSurat.approvedBy && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Disetujui Oleh</label>
                    <div className="text-gray-900">{selectedSurat.approvedBy}</div>
                  </div>
                )}

                {selectedSurat.tglKirim && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tanggal Kirim</label>
                    <div className="text-gray-900">{new Date(selectedSurat.tglKirim).toLocaleDateString('id-ID')}</div>
                  </div>
                )}

                {selectedSurat.projectId && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Terkait Project</label>
                    <div className="text-blue-600">
                      {projectList.find(p => p.id === selectedSurat.projectId)?.projectName || 'Project tidak ditemukan'}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedSurat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Approval Surat</h2>
                <button onClick={() => setShowApprovalModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nomor Surat</label>
                  <div className="text-gray-900 font-medium">{selectedSurat.noSurat}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Perihal</label>
                  <div className="text-gray-900">{selectedSurat.perihal}</div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-yellow-800">
                    Apakah Anda ingin menyetujui surat ini?
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => handleApproval(false)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 inline-flex items-center gap-2"
                >
                  <XCircle size={18} />
                  Tolak
                </button>
                <button
                  onClick={() => handleApproval(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Setujui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Pilih Template Surat</h2>
                <button onClick={() => setShowTemplateModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="grid gap-4">
                {templateSuratList.filter(t => t.isActive).map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{template.namaTemplate}</h3>
                        <p className="text-sm text-gray-500 mt-1">{template.deskripsi}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {template.kategori}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            Digunakan {template.usageCount}x
                          </span>
                        </div>
                      </div>
                      <FileText className="text-gray-400" size={24} />
                    </div>
                  </div>
                ))}
              </div>

              {templateSuratList.filter(t => t.isActive).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada template yang tersedia
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
