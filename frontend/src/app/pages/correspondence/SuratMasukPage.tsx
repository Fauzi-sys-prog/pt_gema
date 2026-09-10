import { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, FileText, Calendar, Filter, ArrowRight, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { SuratMasuk } from '../../contexts/AppContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function SuratMasukPage() {
  const { suratMasukList, addSuratMasuk, updateSuratMasuk, deleteSuratMasuk, projectList } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPrioritas, setFilterPrioritas] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDisposisiModal, setShowDisposisiModal] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratMasuk | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Partial<SuratMasuk>>({
    noSurat: '',
    tanggalTerima: new Date().toISOString().split('T')[0],
    tanggalSurat: new Date().toISOString().split('T')[0],
    pengirim: '',
    perihal: '',
    jenisSurat: '',
    prioritas: 'Normal',
    status: 'Baru',
    penerima: '',
    kategori: 'General',
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
    { condition: showDisposisiModal, close: () => setShowDisposisiModal(false) },
  ]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editMode && selectedSurat) {
        updateSuratMasuk(selectedSurat.id, formData);
      } else {
        const newSurat: SuratMasuk = {
          id: `SM-${Date.now()}`,
          createdBy: 'Current User',
          createdAt: new Date().toISOString(),
          ...formData as SuratMasuk,
        };
        addSuratMasuk(newSurat);
      }

      setShowModal(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (surat: SuratMasuk) => {
    setSelectedSurat(surat);
    setFormData(surat);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus surat ini?')) {
      deleteSuratMasuk(id);
    }
  };

  const handleDisposisi = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedSurat) {
      setIsSubmitting(true);
      try {
        updateSuratMasuk(selectedSurat.id, {
          status: 'Disposisi',
          disposisiKe: formData.disposisiKe,
          catatan: formData.catatan,
        });
        setShowDisposisiModal(false);
        resetForm();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      noSurat: '',
      tanggalTerima: new Date().toISOString().split('T')[0],
      tanggalSurat: new Date().toISOString().split('T')[0],
      pengirim: '',
      perihal: '',
      jenisSurat: '',
      prioritas: 'Normal',
      status: 'Baru',
      penerima: '',
      kategori: 'General',
    });
    setEditMode(false);
    setSelectedSurat(null);
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredSurat = suratMasukList.filter((surat) => {
    const matchesSearch =
      (surat.noSurat || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (surat.pengirim || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (surat.perihal || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || surat.status === filterStatus;
    const matchesPrioritas = filterPrioritas === 'all' || surat.prioritas === filterPrioritas;

    return matchesSearch && matchesStatus && matchesPrioritas;
  });

  const getPrioritasColor = (prioritas: string) => {
    switch (prioritas) {
      case 'Urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Baru': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Disposisi': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Proses': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'Selesai': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📥 Surat Masuk</h1>
        <p className="text-gray-600">Kelola surat dan dokumen yang diterima</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-medium">Total Surat</div>
          <div className="text-2xl font-bold text-blue-700">{suratMasukList.length}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-600 text-sm font-medium">Baru</div>
          <div className="text-2xl font-bold text-yellow-700">
            {suratMasukList.filter(s => s.status === 'Baru').length}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-medium">Proses</div>
          <div className="text-2xl font-bold text-purple-700">
            {suratMasukList.filter(s => s.status === 'Proses' || s.status === 'Disposisi').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 text-sm font-medium">Selesai</div>
          <div className="text-2xl font-bold text-green-700">
            {suratMasukList.filter(s => s.status === 'Selesai').length}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari nomor surat, pengirim, atau perihal..."
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
              <option value="Baru">Baru</option>
              <option value="Disposisi">Disposisi</option>
              <option value="Proses">Proses</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
          <div>
            <select
              value={filterPrioritas}
              onChange={(e) => setFilterPrioritas(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Prioritas</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mb-6">
        <button
          onClick={openModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <Plus size={20} />
          Tambah Surat Masuk
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
                  Pengirim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perihal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioritas
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
                    {new Date(surat.tanggalTerima).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{surat.pengirim}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">{surat.perihal}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getPrioritasColor(surat.prioritas)}`}>
                      {surat.prioritas}
                    </span>
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
                      <button
                        onClick={() => handleEdit(surat)}
                        className="text-green-600 hover:text-green-900"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      {(surat.status === 'Baru' || surat.status === 'Disposisi') && (
                        <button
                          onClick={() => {
                            setSelectedSurat(surat);
                            setFormData({ disposisiKe: surat.disposisiKe || '', catatan: surat.catatan || '' });
                            setShowDisposisiModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="Disposisi"
                        >
                          <ArrowRight size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(surat.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Hapus"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {editMode ? 'Edit Surat Masuk' : 'Tambah Surat Masuk'}
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
                      Jenis Surat *
                    </label>
                    <input
                      type="text"
                      name="jenisSurat"
                      value={formData.jenisSurat}
                      onChange={handleInputChange}
                      placeholder="Kontrak, Undangan, Permohonan, dll"
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
                      Tanggal Terima *
                    </label>
                    <input
                      type="date"
                      name="tanggalTerima"
                      value={formData.tanggalTerima}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pengirim *
                    </label>
                    <input
                      type="text"
                      name="pengirim"
                      value={formData.pengirim}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Penerima *
                    </label>
                    <input
                      type="text"
                      name="penerima"
                      value={formData.penerima}
                      onChange={handleInputChange}
                      placeholder="Direktur, Manager, dll"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioritas *
                    </label>
                    <select
                      name="prioritas"
                      value={formData.prioritas}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
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
                    rows={3}
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
                          {project.kodeProject} - {project.namaProject}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Menyimpan...' : editMode ? 'Update' : 'Simpan'}
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
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Detail Surat Masuk</h2>
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
                    <label className="text-sm font-medium text-gray-500">Tanggal Terima</label>
                    <div className="text-gray-900">{new Date(selectedSurat.tanggalTerima).toLocaleDateString('id-ID')}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Pengirim</label>
                    <div className="text-gray-900">{selectedSurat.pengirim}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Penerima</label>
                    <div className="text-gray-900">{selectedSurat.penerima}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Prioritas</label>
                    <div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getPrioritasColor(selectedSurat.prioritas)}`}>
                        {selectedSurat.prioritas}
                      </span>
                    </div>
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

                {selectedSurat.disposisiKe && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Disposisi Ke</label>
                    <div className="text-gray-900">{selectedSurat.disposisiKe}</div>
                  </div>
                )}

                {selectedSurat.catatan && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Catatan</label>
                    <div className="text-gray-900">{selectedSurat.catatan}</div>
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

      {/* Disposisi Modal */}
      {showDisposisiModal && selectedSurat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Disposisi Surat</h2>
                <button onClick={() => setShowDisposisiModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleDisposisi} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Surat
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                    {selectedSurat.noSurat}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disposisi Ke *
                  </label>
                  <input
                    type="text"
                    name="disposisiKe"
                    value={formData.disposisiKe}
                    onChange={handleInputChange}
                    placeholder="Nama Jabatan / Department"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan
                  </label>
                  <textarea
                    name="catatan"
                    value={formData.catatan}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Instruksi atau catatan tambahan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowDisposisiModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Disposisi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
