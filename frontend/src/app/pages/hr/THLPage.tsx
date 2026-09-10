import { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Calendar, Users, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { useApp, type THL } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const STATUS_COLOR: Record<THL['status'], string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-blue-100 text-blue-700',
  Pending: 'bg-amber-100 text-amber-700',
};

const emptyForm = (): Omit<THL, 'id' | 'noTHL'> => ({
  nama: '', posisi: '', project: '', projectId: '',
  tanggalMulai: '', tanggalSelesai: '',
  upahHarian: 0, upahPerJam: 0, uangMakanPerHari: 0,
  shiftMulai: '07:00', shiftSelesai: '19:00',
  jumlahHari: 0, totalUpah: 0,
  status: 'Pending', catatan: '',
});

export default function THLPage() {
  const { thlList, addTHL, updateTHL, deleteTHL, projectList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | THL['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<THL | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
  ]);


  const filtered = thlList.filter(t => {
    const matchSearch = t.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.noTHL.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.posisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.project.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch && (filterStatus === 'all' || t.status === filterStatus);
  });

  const totalUpahActive = thlList.filter(t => t.status === 'Active').reduce((s, t) => s + t.totalUpah, 0);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (t: THL) => { setEditing(t); setForm({ ...t }); setShowModal(true); };

  const handleSave = () => {
    if (isSubmitting) return;
    if (!form.nama || !form.posisi || !form.tanggalMulai) {
      toast.error('Nama, posisi, dan tanggal mulai wajib diisi');
      return;
    }
    const upahJam = form.upahPerJam || form.upahHarian;
    const total = upahJam * form.jumlahHari * 11; // estimasi 11 jam/hari
    setIsSubmitting(true);
    try {
      if (editing) {
        updateTHL(editing.id, { ...form, upahHarian: upahJam, upahPerJam: upahJam, totalUpah: total });
        toast.success('Data THL diperbarui');
      } else {
        const noTHL = `THL-${new Date().getFullYear()}-${String(thlList.length + 1).padStart(3, '0')}`;
        addTHL({ ...form, id: `THL-${Date.now()}`, noTHL, upahHarian: upahJam, upahPerJam: upahJam, totalUpah: total });
        toast.success('THL berhasil ditambahkan');
      }
      setShowModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan THL: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (processingId) return;
    if (!window.confirm('Hapus data THL ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setProcessingId(id);
    try {
      deleteTHL(id);
      toast.success('THL dihapus');
    } catch (err) {
      toast.error('Gagal menghapus THL: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Users className="text-blue-600" size={28} /> THL
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Tenaga Harian Lepas</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 transition-all font-black text-[11px] uppercase tracking-widest shadow-lg">
          <Plus size={16} /> Tambah THL
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total THL', val: String(thlList.length), cls: 'text-slate-900', card: 'bg-white border border-slate-100' },
          { label: 'Sedang Aktif', val: String(thlList.filter(t => t.status === 'Active').length), cls: 'text-emerald-600', card: 'bg-white border border-slate-100' },
          { label: 'Selesai', val: String(thlList.filter(t => t.status === 'Completed').length), cls: 'text-blue-600', card: 'bg-white border border-slate-100' },
          { label: 'Total Upah Aktif', val: fmt(totalUpahActive), cls: 'text-white', card: 'bg-slate-900' },
        ].map((s, i) => (
          <div key={i} className={`p-5 rounded-2xl shadow-sm ${s.card}`}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-slate-400">{s.label}</p>
            <p className={`text-xl font-black italic ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama, posisi, project..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-black" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl">
          {(['all', 'Active', 'Pending', 'Completed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterStatus === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {s === 'all' ? 'Semua' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['No. THL', 'Nama', 'Posisi', 'Project', 'Periode', 'Upah/Jam', 'U. Makan', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-400">Tidak ada data THL</td></tr>
              )}
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-black text-slate-900 italic">{t.noTHL}</td>
                  <td className="px-5 py-3 font-bold text-slate-900">{t.nama}</td>
                  <td className="px-5 py-3 text-slate-600">{t.posisi}</td>
                  <td className="px-5 py-3 text-slate-600">{t.project}</td>
                  <td className="px-5 py-3 text-slate-500">
                    <div className="flex items-center gap-1"><Calendar size={12} />{t.tanggalMulai} → {t.tanggalSelesai}</div>
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-900">{fmt(t.upahPerJam || t.upahHarian)}/jam</td>
                  <td className="px-5 py-3 text-slate-600">{t.uangMakanPerHari ? fmt(t.uangMakanPerHari) : '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded text-[9px] font-black ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(t.id)} disabled={processingId !== null} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">{editing ? 'Edit THL' : 'Tambah THL Baru'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Nama Lengkap *</label>
                  <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="Nama lengkap" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Posisi *</label>
                  <select
                    value={['Tukang Batu','Tukang Cat','Tukang Las','Mandor','Helper','Operator','Sopir','Security'].includes(form.posisi) || form.posisi === '' ? form.posisi : 'Lainnya'}
                    onChange={e => setForm({ ...form, posisi: e.target.value === 'Lainnya' ? '' : e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option value="">Pilih posisi</option>
                    {['Tukang Batu', 'Tukang Cat', 'Tukang Las', 'Mandor', 'Helper', 'Operator', 'Sopir', 'Security', 'Lainnya'].map(p => <option key={p}>{p}</option>)}
                  </select>
                  {!['Tukang Batu','Tukang Cat','Tukang Las','Mandor','Helper','Operator','Sopir','Security',''].includes(form.posisi) && (
                    <input
                      value={form.posisi}
                      onChange={e => setForm({ ...form, posisi: e.target.value })}
                      placeholder="Ketik posisi..."
                      className="w-full mt-2 px-4 py-2.5 border border-blue-300 rounded-xl text-sm text-black outline-none focus:border-blue-500 bg-blue-50"
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Project</label>
                <select value={form.projectId || ''} onChange={e => {
                  const proj = projectList.find(p => p.id === e.target.value);
                  setForm({ ...form, projectId: e.target.value, project: proj?.namaProject || '' });
                }} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                  <option value="">Pilih project (opsional)</option>
                  {projectList.map(p => <option key={p.id} value={p.id}>{p.namaProject}</option>)}
                </select>
                {!form.projectId && (
                  <input value={form.project} onChange={e => setForm({ ...form, project: e.target.value })}
                    className="mt-2 w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="Atau ketik nama project manual" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Tanggal Mulai *</label>
                  <input type="date" value={form.tanggalMulai} onChange={e => setForm({ ...form, tanggalMulai: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Tanggal Selesai</label>
                  <input type="date" value={form.tanggalSelesai} onChange={e => setForm({ ...form, tanggalSelesai: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Upah/Jam (Rp) *</label>
                  <input type="number" value={form.upahPerJam || ''} onChange={e => setForm({ ...form, upahPerJam: Number(e.target.value), upahHarian: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="mis. 20200" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Uang Makan/Hari (Rp)</label>
                  <input type="number" value={form.uangMakanPerHari || ''} onChange={e => setForm({ ...form, uangMakanPerHari: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="mis. 38000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Default Shift Masuk</label>
                  <input type="time" value={form.shiftMulai || '07:00'} onChange={e => setForm({ ...form, shiftMulai: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Default Shift Keluar</label>
                  <input type="time" value={form.shiftSelesai || '19:00'} onChange={e => setForm({ ...form, shiftSelesai: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Jumlah Hari (estimasi)</label>
                  <input type="number" value={form.jumlahHari || ''} onChange={e => setForm({ ...form, jumlahHari: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as THL['status'] })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option>Pending</option><option>Active</option><option>Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Catatan</label>
                <textarea value={form.catatan || ''} onChange={e => setForm({ ...form, catatan: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400 resize-none" placeholder="Catatan opsional" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
