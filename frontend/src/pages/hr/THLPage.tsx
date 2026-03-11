import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Calendar } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

interface THL {
  id: string;
  noTHL: string;
  nama: string;
  posisi: string;
  project: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  upahHarian: number;
  jumlahHari: number;
  totalUpah: number;
  status: 'Active' | 'Completed' | 'Pending';
  notes?: string;
}

const THL_RESOURCE = 'hr-thl-contracts';

export default function THLPage() {
  const getApiErrorMessage = (err: any, fallback: string) =>
    String(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [thlList, setThlList] = useState<THL[]>([]);
  const [form, setForm] = useState<Partial<THL>>({
    nama: '',
    posisi: '',
    project: '',
    tanggalMulai: '',
    tanggalSelesai: '',
    upahHarian: 0,
    jumlahHari: 0,
    status: 'Pending',
    notes: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/${THL_RESOURCE}`);
        const rows = Array.isArray(res.data) ? res.data : [];
        const parsed = rows.map((row: any, idx: number) => {
          const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
          return { ...(payload || {}), id: payload?.id || row?.entityId || `THL-ROW-${idx + 1}` } as THL;
        });
        setThlList(parsed);
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, `Gagal load ${THL_RESOURCE}`));
        setThlList([]);
      }
    };
    load();
  }, []);

  const saveList = async (next: THL[]) => {
    const body = next.map((item) => ({ entityId: item.id, payload: item }));
    await api.put(`/${THL_RESOURCE}/bulk`, body);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Completed': return 'bg-blue-100 text-blue-700';
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredData = useMemo(() => {
    const keyword = String(searchTerm || '').toLowerCase();
    return thlList.filter(item =>
      String(item.noTHL || '').toLowerCase().includes(keyword) ||
      String(item.nama || '').toLowerCase().includes(keyword) ||
      String(item.posisi || '').toLowerCase().includes(keyword) ||
      String(item.project || '').toLowerCase().includes(keyword)
    );
  }, [thlList, searchTerm]);

  const activeTHL = thlList.filter(t => t.status === 'Active').length;
  const totalUpahBulanIni = thlList
    .filter(t => t.status === 'Active')
    .reduce((sum, t) => sum + t.totalUpah, 0);

  const submitTHL = async (e: React.FormEvent) => {
    e.preventDefault();
    const upahHarian = Number(form.upahHarian || 0);
    const jumlahHari = Number(form.jumlahHari || 0);
    const totalUpah = upahHarian * jumlahHari;
    const id = `THL-${Date.now()}`;
    const newItem: THL = {
      id,
      noTHL: `THL-${new Date().getFullYear()}-${String(thlList.length + 1).padStart(3, '0')}`,
      nama: String(form.nama || '').trim(),
      posisi: String(form.posisi || '').trim(),
      project: String(form.project || '').trim(),
      tanggalMulai: String(form.tanggalMulai || ''),
      tanggalSelesai: String(form.tanggalSelesai || ''),
      upahHarian,
      jumlahHari,
      totalUpah,
      status: (form.status as THL['status']) || 'Pending',
      notes: String(form.notes || '').trim()
    };

    try {
      const next = [newItem, ...thlList];
      setThlList(next);
      await saveList(next);
      toast.success(`Kontrak THL ${newItem.noTHL} berhasil disimpan`);
      setShowModal(false);
      setForm({
        nama: '', posisi: '', project: '', tanggalMulai: '', tanggalSelesai: '',
        upahHarian: 0, jumlahHari: 0, status: 'Pending', notes: ''
      });
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, `Gagal simpan ${THL_RESOURCE}`));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">THL (Tenaga Harian Lepas)</h1>
          <p className="text-gray-600">Kelola data tenaga harian lepas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Tambah THL
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total THL</div>
          <div className="text-gray-900">{thlList.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">THL Active</div>
          <div className="text-green-600">{activeTHL}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Upah Bulan Ini</div>
          <div className="text-gray-900">{formatCurrency(totalUpahBulanIni)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Completed</div>
          <div className="text-blue-600">{thlList.filter(t => t.status === 'Completed').length}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari THL, nama, posisi, atau project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-600">No. THL</th>
                <th className="px-6 py-3 text-left text-gray-600">Nama</th>
                <th className="px-6 py-3 text-left text-gray-600">Posisi</th>
                <th className="px-6 py-3 text-left text-gray-600">Project</th>
                <th className="px-6 py-3 text-left text-gray-600">Periode</th>
                <th className="px-6 py-3 text-left text-gray-600">Upah/Hari</th>
                <th className="px-6 py-3 text-left text-gray-600">Jumlah Hari</th>
                <th className="px-6 py-3 text-left text-gray-600">Total Upah</th>
                <th className="px-6 py-3 text-left text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{item.noTHL}</td>
                  <td className="px-6 py-4 text-gray-900">{item.nama}</td>
                  <td className="px-6 py-4 text-gray-600">{item.posisi}</td>
                  <td className="px-6 py-4 text-gray-600">{item.project}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{item.tanggalMulai} - {item.tanggalSelesai}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{formatCurrency(item.upahHarian)}</td>
                  <td className="px-6 py-4 text-gray-900">{item.jumlahHari} hari</td>
                  <td className="px-6 py-4 text-gray-900">{formatCurrency(item.totalUpah)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-gray-900 mb-4">Tambah THL Baru</h2>
            <form className="space-y-4" onSubmit={submitTHL}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Nama Lengkap</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.nama || ''} onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Posisi</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.posisi || ''} onChange={(e) => setForm((p) => ({ ...p, posisi: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Project</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.project || ''} onChange={(e) => setForm((p) => ({ ...p, project: e.target.value }))} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Tanggal Mulai</label>
                  <input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.tanggalMulai || ''} onChange={(e) => setForm((p) => ({ ...p, tanggalMulai: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Tanggal Selesai</label>
                  <input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.tanggalSelesai || ''} onChange={(e) => setForm((p) => ({ ...p, tanggalSelesai: e.target.value }))} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Upah Harian</label>
                  <input type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.upahHarian || 0} onChange={(e) => setForm((p) => ({ ...p, upahHarian: Number(e.target.value) }))} min={0} required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Estimasi Hari Kerja</label>
                  <input type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.jumlahHari || 0} onChange={(e) => setForm((p) => ({ ...p, jumlahHari: Number(e.target.value) }))} min={0} required />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Status</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.status || 'Pending'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as THL['status'] }))}>
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Catatan</label>
                <textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={form.notes || ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan THL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
