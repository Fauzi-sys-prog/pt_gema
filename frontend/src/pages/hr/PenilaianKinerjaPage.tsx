import { useEffect, useMemo, useState } from 'react';
import { Star, TrendingUp, Award, Plus, Search, Calendar, Filter, Eye, Edit, Download, FileText, BarChart3 } from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';

interface Karyawan {
  nik: string;
  nama: string;
  jabatan: string;
  departemen: string;
  joinDate: string;
}

interface PenilaianKinerja {
  id: string;
  nik: string;
  nama: string;
  jabatan: string;
  departemen: string;
  periode: string;
  tahun: string;
  tanggalPenilaian: string;
  penilai: string;
  jabatanPenilai: string;
  
  // Kriteria Penilaian (Skala 1-5)
  kualitasKerja: number;
  kuantitasKerja: number;
  kehadiran: number;
  kedisiplinan: number;
  inisiatif: number;
  kerjasama: number;
  komunikasi: number;
  kepemimpinan: number;
  problemSolving: number;
  adaptasi: number;
  
  // Hasil
  totalScore: number;
  averageScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  kategori: 'Outstanding' | 'Excellent' | 'Good' | 'Fair' | 'Poor';
  
  // Catatan
  kelebihanKaryawan: string;
  kekuranganKaryawan: string;
  rekomendasiPengembangan: string;
  targetKedepan: string;
  
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvalDate?: string;
}

const PERFORMANCE_REVIEW_RESOURCE = 'hr-performance-reviews';

export default function PenilaianKinerjaPage() {
  const { employeeList = [] } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [filterDepartemen, setFilterDepartemen] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPenilaian, setSelectedPenilaian] = useState<PenilaianKinerja | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<PenilaianKinerja>>({
    kualitasKerja: 0,
    kuantitasKerja: 0,
    kehadiran: 0,
    kedisiplinan: 0,
    inisiatif: 0,
    kerjasama: 0,
    komunikasi: 0,
    kepemimpinan: 0,
    problemSolving: 0,
    adaptasi: 0,
    kelebihanKaryawan: '',
    kekuranganKaryawan: '',
    rekomendasiPengembangan: '',
    targetKedepan: '',
    status: 'Draft'
  });

  const karyawanList: Karyawan[] = useMemo(() =>
    employeeList.map((emp) => ({
      nik: String(emp.employeeId || emp.id || ''),
      nama: String(emp.name || ''),
      jabatan: String(emp.position || ''),
      departemen: String(emp.department || ''),
      joinDate: String(emp.joinDate || '')
    })),
  [employeeList]
  );

  const [penilaianList, setPenilaianList] = useState<PenilaianKinerja[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/${PERFORMANCE_REVIEW_RESOURCE}`);
        const rows = Array.isArray(res.data) ? res.data : [];
        const parsed = rows.map((row: any) => ({ ...(row.payload || {}), id: row.entityId } as PenilaianKinerja));
        setPenilaianList(parsed);
      } catch {
        // backend unavailable: keep current local state
      }
    };
    load();
  }, []);

  const savePenilaianList = async (next: PenilaianKinerja[]) => {
    const body = next.map((item) => ({
      entityId: item.id,
      payload: item
    }));
    await api.put(`/${PERFORMANCE_REVIEW_RESOURCE}/bulk`, body);
  };

  const calculateGrade = (avgScore: number): 'A' | 'B' | 'C' | 'D' | 'E' => {
    if (avgScore >= 4.5) return 'A';
    if (avgScore >= 3.5) return 'B';
    if (avgScore >= 2.5) return 'C';
    if (avgScore >= 1.5) return 'D';
    return 'E';
  };

  const calculateKategori = (grade: string, avgScore: number): 'Outstanding' | 'Excellent' | 'Good' | 'Fair' | 'Poor' => {
    switch (grade) {
      case 'A': return avgScore >= 4.8 ? 'Outstanding' : 'Excellent';
      case 'B': return 'Good';
      case 'C': return 'Fair';
      default: return 'Poor';
    }
  };

  const handleFormChange = (field: string, value: any) => {
    const updatedData = { ...formData, [field]: value };
    
    // Auto calculate scores
    const scores = [
      updatedData.kualitasKerja || 0,
      updatedData.kuantitasKerja || 0,
      updatedData.kehadiran || 0,
      updatedData.kedisiplinan || 0,
      updatedData.inisiatif || 0,
      updatedData.kerjasama || 0,
      updatedData.komunikasi || 0,
      updatedData.kepemimpinan || 0,
      updatedData.problemSolving || 0,
      updatedData.adaptasi || 0
    ];
    
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const averageScore = totalScore / 10;
    const grade = calculateGrade(averageScore);
    const kategori = calculateKategori(grade, averageScore);
    
    setFormData({
      ...updatedData,
      totalScore,
      averageScore: Math.round(averageScore * 10) / 10,
      grade,
      kategori
    });
  };

  const handleSubmit = async (nextStatus: PenilaianKinerja['status']) => {
    const payloadWithStatus = {
      ...formData,
      status: nextStatus
    } as Partial<PenilaianKinerja>;

    if (isEdit && selectedPenilaian) {
      // Update existing
      const next = penilaianList.map((p) =>
        p.id === selectedPenilaian.id ? ({ ...p, ...payloadWithStatus } as PenilaianKinerja) : p
      );
      setPenilaianList(next);
      await savePenilaianList(next);
    } else {
      // Create new
      const newPenilaian: PenilaianKinerja = {
        id: `PKK${String(penilaianList.length + 1).padStart(3, '0')}`,
        ...payloadWithStatus
      } as PenilaianKinerja;
      
      const next = [newPenilaian, ...penilaianList];
      setPenilaianList(next);
      await savePenilaianList(next);
    }
    
    setShowFormModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      kualitasKerja: 0,
      kuantitasKerja: 0,
      kehadiran: 0,
      kedisiplinan: 0,
      inisiatif: 0,
      kerjasama: 0,
      komunikasi: 0,
      kepemimpinan: 0,
      problemSolving: 0,
      adaptasi: 0,
      kelebihanKaryawan: '',
      kekuranganKaryawan: '',
      rekomendasiPengembangan: '',
      targetKedepan: '',
      status: 'Draft'
    });
    setSelectedPenilaian(null);
    setIsEdit(false);
  };

  const filteredPenilaian = penilaianList.filter(p => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchesSearch = 
      String(p.nama || '').toLowerCase().includes(keyword) ||
      String(p.nik || '').toLowerCase().includes(keyword) ||
      String(p.departemen || '').toLowerCase().includes(keyword);
    
    const matchesPeriode = filterPeriode === 'all' || `${p.periode} ${p.tahun}` === filterPeriode;
    const matchesDepartemen = filterDepartemen === 'all' || p.departemen === filterDepartemen;
    const matchesGrade = filterGrade === 'all' || p.grade === filterGrade;
    
    return matchesSearch && matchesPeriode && matchesDepartemen && matchesGrade;
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-orange-100 text-orange-800';
      case 'E': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Submitted': return 'bg-blue-100 text-blue-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Statistics
  const avgScore = penilaianList.length > 0
    ? Math.round((penilaianList.reduce((sum, p) => sum + p.averageScore, 0) / penilaianList.length) * 10) / 10
    : 0;
  const gradeACount = penilaianList.filter(p => p.grade === 'A').length;
  const gradeBCount = penilaianList.filter(p => p.grade === 'B').length;
  const gradeCCount = penilaianList.filter(p => p.grade === 'C').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">⭐ Penilaian Kinerja Karyawan</h1>
          <p className="text-gray-600">Sistem penilaian dan evaluasi kinerja karyawan</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowFormModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Penilaian Baru
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-sm mb-1">Total Penilaian</div>
              <div className="text-gray-900 text-2xl">{penilaianList.length}</div>
            </div>
            <FileText className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-sm mb-1">Rata-rata Score</div>
              <div className="text-gray-900 text-2xl">{avgScore}</div>
            </div>
            <TrendingUp className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-sm mb-1">Grade A</div>
              <div className="text-green-600 text-2xl">{gradeACount}</div>
            </div>
            <Award className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-sm mb-1">Grade B</div>
              <div className="text-blue-600 text-2xl">{gradeBCount}</div>
            </div>
            <Star className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-sm mb-1">Grade C</div>
              <div className="text-yellow-600 text-2xl">{gradeCCount}</div>
            </div>
            <BarChart3 className="text-yellow-600" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari karyawan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterPeriode}
            onChange={(e) => setFilterPeriode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Periode</option>
            <option value="Q4 2024">Q4 2024</option>
            <option value="Q3 2024">Q3 2024</option>
            <option value="Q2 2024">Q2 2024</option>
            <option value="Q1 2024">Q1 2024</option>
          </select>

          <select
            value={filterDepartemen}
            onChange={(e) => setFilterDepartemen(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Departemen</option>
            <option value="Engineering">Engineering</option>
            <option value="HRD">HRD</option>
            <option value="Finance">Finance</option>
            <option value="Purchasing">Purchasing</option>
            <option value="Warehouse">Warehouse</option>
          </select>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Grade</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
            <option value="D">Grade D</option>
            <option value="E">Grade E</option>
          </select>
        </div>
      </div>

      {/* Penilaian Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">NIK</th>
                <th className="px-6 py-3 text-left text-gray-600">Nama Karyawan</th>
                <th className="px-6 py-3 text-left text-gray-600">Jabatan</th>
                <th className="px-6 py-3 text-left text-gray-600">Departemen</th>
                <th className="px-6 py-3 text-left text-gray-600">Periode</th>
                <th className="px-6 py-3 text-left text-gray-600">Penilai</th>
                <th className="px-6 py-3 text-left text-gray-600">Score</th>
                <th className="px-6 py-3 text-left text-gray-600">Grade</th>
                <th className="px-6 py-3 text-left text-gray-600">Kategori</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPenilaian.map((penilaian) => (
                <tr key={penilaian.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{penilaian.nik}</td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{penilaian.nama}</div>
                    <div className="text-gray-600 text-sm">{penilaian.tanggalPenilaian}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{penilaian.jabatan}</td>
                  <td className="px-6 py-4 text-gray-900">{penilaian.departemen}</td>
                  <td className="px-6 py-4 text-gray-900">{penilaian.periode} {penilaian.tahun}</td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{penilaian.penilai}</div>
                    <div className="text-gray-600 text-sm">{penilaian.jabatanPenilai}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{penilaian.averageScore}</div>
                    <div className="text-gray-600 text-sm">({penilaian.totalScore}/50)</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(penilaian.grade)}`}>
                      {penilaian.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{penilaian.kategori}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(penilaian.status)}`}>
                      {penilaian.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedPenilaian(penilaian);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye size={18} />
                      </button>
                      {penilaian.status === 'Draft' && (
                        <button
                          onClick={() => {
                            setSelectedPenilaian(penilaian);
                            setFormData(penilaian);
                            setIsEdit(true);
                            setShowFormModal(true);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      <button
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-gray-900">{isEdit ? 'Edit' : 'Tambah'} Penilaian Kinerja</h2>
              <p className="text-gray-600 text-sm mt-1">Isi form penilaian karyawan berdasarkan kriteria yang telah ditentukan</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Data Karyawan */}
              <div>
                <h3 className="text-gray-900 mb-4">📋 Data Karyawan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Pilih Karyawan *</label>
                    <select
                      value={formData.nik || ''}
                      onChange={(e) => {
                        const karyawan = karyawanList.find(k => k.nik === e.target.value);
                        if (karyawan) {
                          handleFormChange('nik', karyawan.nik);
                          handleFormChange('nama', karyawan.nama);
                          handleFormChange('jabatan', karyawan.jabatan);
                          handleFormChange('departemen', karyawan.departemen);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Pilih Karyawan --</option>
                      {karyawanList.map(k => (
                        <option key={k.nik} value={k.nik}>
                          {k.nik} - {k.nama} ({k.jabatan})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Periode *</label>
                    <select
                      value={formData.periode || ''}
                      onChange={(e) => handleFormChange('periode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Pilih Periode --</option>
                      <option value="Q1">Q1 (Jan - Mar)</option>
                      <option value="Q2">Q2 (Apr - Jun)</option>
                      <option value="Q3">Q3 (Jul - Sep)</option>
                      <option value="Q4">Q4 (Okt - Des)</option>
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                      <option value="Tahunan">Tahunan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Tahun *</label>
                    <select
                      value={formData.tahun || ''}
                      onChange={(e) => handleFormChange('tahun', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Pilih Tahun --</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Tanggal Penilaian *</label>
                    <input
                      type="date"
                      value={formData.tanggalPenilaian || ''}
                      onChange={(e) => handleFormChange('tanggalPenilaian', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Nama Penilai *</label>
                    <input
                      type="text"
                      value={formData.penilai || ''}
                      onChange={(e) => handleFormChange('penilai', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nama atasan/penilai"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Jabatan Penilai *</label>
                    <input
                      type="text"
                      value={formData.jabatanPenilai || ''}
                      onChange={(e) => handleFormChange('jabatanPenilai', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Jabatan penilai"
                    />
                  </div>
                </div>
              </div>

              {/* Kriteria Penilaian */}
              <div>
                <h3 className="text-gray-900 mb-4">⭐ Kriteria Penilaian (Skala 1-5)</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-blue-800">
                    <strong>Panduan Penilaian:</strong><br/>
                    5 = Excellent (Sangat Baik) | 4 = Good (Baik) | 3 = Fair (Cukup) | 2 = Poor (Kurang) | 1 = Very Poor (Sangat Kurang)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'kualitasKerja', label: 'Kualitas Kerja' },
                    { key: 'kuantitasKerja', label: 'Kuantitas Kerja' },
                    { key: 'kehadiran', label: 'Kehadiran' },
                    { key: 'kedisiplinan', label: 'Kedisiplinan' },
                    { key: 'inisiatif', label: 'Inisiatif' },
                    { key: 'kerjasama', label: 'Kerjasama Tim' },
                    { key: 'komunikasi', label: 'Komunikasi' },
                    { key: 'kepemimpinan', label: 'Kepemimpinan' },
                    { key: 'problemSolving', label: 'Problem Solving' },
                    { key: 'adaptasi', label: 'Adaptasi & Fleksibilitas' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-gray-700 mb-2">{label} *</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => handleFormChange(key, score)}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                              formData[key as keyof typeof formData] === score
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hasil Penilaian */}
              {formData.totalScore > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-gray-900 mb-4">📊 Hasil Penilaian</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-gray-600 text-sm">Total Score</div>
                      <div className="text-gray-900 text-2xl">{formData.totalScore}/50</div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">Average Score</div>
                      <div className="text-gray-900 text-2xl">{formData.averageScore}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">Grade</div>
                      <div className={`text-2xl px-4 py-1 rounded-lg inline-block ${getGradeColor(formData.grade || '')}`}>
                        {formData.grade}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">Kategori</div>
                      <div className="text-gray-900">{formData.kategori}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan */}
              <div>
                <h3 className="text-gray-900 mb-4">📝 Catatan & Rekomendasi</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Kelebihan Karyawan *</label>
                    <textarea
                      rows={3}
                      value={formData.kelebihanKaryawan || ''}
                      onChange={(e) => handleFormChange('kelebihanKaryawan', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Uraikan kelebihan dan prestasi karyawan..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Kekurangan Karyawan *</label>
                    <textarea
                      rows={3}
                      value={formData.kekuranganKaryawan || ''}
                      onChange={(e) => handleFormChange('kekuranganKaryawan', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Uraikan area yang perlu diperbaiki..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Rekomendasi Pengembangan *</label>
                    <textarea
                      rows={3}
                      value={formData.rekomendasiPengembangan || ''}
                      onChange={(e) => handleFormChange('rekomendasiPengembangan', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Training, workshop, atau pengembangan yang direkomendasikan..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">Target Kedepan *</label>
                    <textarea
                      rows={3}
                      value={formData.targetKedepan || ''}
                      onChange={(e) => handleFormChange('targetKedepan', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Target dan goals untuk periode berikutnya..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFormModal(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleSubmit('Draft')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Simpan Draft
              </button>
              <button
                onClick={() => handleSubmit('Submitted')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Penilaian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPenilaian && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-gray-900">Detail Penilaian Kinerja</h2>
                  <p className="text-gray-600 text-sm mt-1">{selectedPenilaian.nama} - {selectedPenilaian.periode} {selectedPenilaian.tahun}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Data Karyawan */}
              <div>
                <h3 className="text-gray-900 mb-4">👤 Data Karyawan</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <div className="text-gray-600 text-sm">NIK</div>
                    <div className="text-gray-900">{selectedPenilaian.nik}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Nama</div>
                    <div className="text-gray-900">{selectedPenilaian.nama}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Jabatan</div>
                    <div className="text-gray-900">{selectedPenilaian.jabatan}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Departemen</div>
                    <div className="text-gray-900">{selectedPenilaian.departemen}</div>
                  </div>
                </div>
              </div>

              {/* Info Penilaian */}
              <div>
                <h3 className="text-gray-900 mb-4">📅 Informasi Penilaian</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <div className="text-gray-600 text-sm">Periode</div>
                    <div className="text-gray-900">{selectedPenilaian.periode} {selectedPenilaian.tahun}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Tanggal Penilaian</div>
                    <div className="text-gray-900">{selectedPenilaian.tanggalPenilaian}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Penilai</div>
                    <div className="text-gray-900">{selectedPenilaian.penilai}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Jabatan Penilai</div>
                    <div className="text-gray-900">{selectedPenilaian.jabatanPenilai}</div>
                  </div>
                </div>
              </div>

              {/* Score Detail */}
              <div>
                <h3 className="text-gray-900 mb-4">⭐ Detail Skor Penilaian</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Kualitas Kerja', value: selectedPenilaian.kualitasKerja },
                    { label: 'Kuantitas Kerja', value: selectedPenilaian.kuantitasKerja },
                    { label: 'Kehadiran', value: selectedPenilaian.kehadiran },
                    { label: 'Kedisiplinan', value: selectedPenilaian.kedisiplinan },
                    { label: 'Inisiatif', value: selectedPenilaian.inisiatif },
                    { label: 'Kerjasama Tim', value: selectedPenilaian.kerjasama },
                    { label: 'Komunikasi', value: selectedPenilaian.komunikasi },
                    { label: 'Kepemimpinan', value: selectedPenilaian.kepemimpinan },
                    { label: 'Problem Solving', value: selectedPenilaian.problemSolving },
                    { label: 'Adaptasi & Fleksibilitas', value: selectedPenilaian.adaptasi }
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star
                              key={star}
                              size={20}
                              className={star <= value ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                        <span className="text-gray-900 font-medium ml-2">{value}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hasil */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-gray-900 mb-4">📊 Hasil Penilaian</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-gray-600 text-sm">Total Score</div>
                    <div className="text-gray-900 text-2xl">{selectedPenilaian.totalScore}/50</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Average Score</div>
                    <div className="text-gray-900 text-2xl">{selectedPenilaian.averageScore}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Grade</div>
                    <div className={`text-2xl px-4 py-1 rounded-lg inline-block ${getGradeColor(selectedPenilaian.grade)}`}>
                      {selectedPenilaian.grade}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Kategori</div>
                    <div className="text-gray-900 text-xl">{selectedPenilaian.kategori}</div>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <h3 className="text-gray-900 mb-4">📝 Catatan & Rekomendasi</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-green-800 font-medium mb-2">✅ Kelebihan Karyawan:</div>
                    <div className="text-gray-700">{selectedPenilaian.kelebihanKaryawan}</div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-yellow-800 font-medium mb-2">⚠️ Kekurangan Karyawan:</div>
                    <div className="text-gray-700">{selectedPenilaian.kekuranganKaryawan}</div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-800 font-medium mb-2">💡 Rekomendasi Pengembangan:</div>
                    <div className="text-gray-700">{selectedPenilaian.rekomendasiPengembangan}</div>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-purple-800 font-medium mb-2">🎯 Target Kedepan:</div>
                    <div className="text-gray-700">{selectedPenilaian.targetKedepan}</div>
                  </div>
                </div>
              </div>

              {/* Status */}
              {selectedPenilaian.status === 'Approved' && selectedPenilaian.approvedBy && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-gray-600 text-sm">Status Approval</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedPenilaian.status)}`}>
                      {selectedPenilaian.status}
                    </span>
                    <span className="text-gray-600">oleh {selectedPenilaian.approvedBy}</span>
                    <span className="text-gray-600">pada {selectedPenilaian.approvalDate}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Tutup
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
