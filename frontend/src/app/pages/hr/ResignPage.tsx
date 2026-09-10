import { useState } from 'react';
import { Plus, Search, UserX, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react';
import { useApp, type Resignation } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const STATUS_COLOR: Record<Resignation['status'], string> = {
  Submitted: 'bg-amber-100 text-amber-700',
  Processing: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const STATUS_ICON: Record<Resignation['status'], typeof Clock> = {
  Submitted: Clock,
  Processing: ChevronRight,
  Completed: CheckCircle,
  Cancelled: XCircle,
};

const emptyForm = (): Omit<Resignation, 'id' | 'resignNo'> => ({
  employeeId: '', employeeName: '', position: '', department: '',
  joinDate: '', resignDate: '', lastWorkingDate: '', reason: '',
  status: 'Submitted', submittedDate: new Date().toISOString().split('T')[0],
  noticePeriod: 30, clearanceStatus: 'Pending', finalSettlement: 0, notes: '',
});

export default function ResignPage() {
  const { resignationList, addResignation, updateResignation, employeeList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Resignation['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Resignation | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
  ]);


  const filtered = resignationList.filter(r => {
    const matchSearch =
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.resignNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch && (filterStatus === 'all' || r.status === filterStatus);
  });

  const handleEmployeeSelect = (empId: string) => {
    const emp = employeeList.find(e => e.id === empId);
    if (emp) setForm(f => ({ ...f, employeeId: empId, employeeName: emp.name, position: emp.position, department: emp.department, joinDate: emp.joinDate || '' }));
    else setForm(f => ({ ...f, employeeId: empId }));
  };

  const handleSave = () => {
    if (isSubmitting) return;
    if (!form.employeeName || !form.resignDate || !form.reason) {
      toast.error('Karyawan, tanggal resign, dan alasan wajib diisi');
      return;
    }
    const resignNo = `RESIGN-${new Date().getFullYear()}-${String(resignationList.length + 1).padStart(3, '0')}`;
    setIsSubmitting(true);
    try {
      addResignation({ ...form, id: `RES-${Date.now()}`, resignNo });
      toast.success('Pengajuan resign berhasil disimpan');
      setShowModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan pengajuan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = (id: string, status: Resignation['status']) => {
    if (processingId) return;
    if (status === 'Completed' && !window.confirm('Tandai proses resign ini sebagai selesai (offboarding final)?')) return;
    setProcessingId(id);
    try {
      updateResignation(id, { status });
      toast.success(`Status diperbarui: ${status}`);
    } catch (err) {
      toast.error('Gagal memperbarui status: ' + (err instanceof Error ? err.message : 'Error'));
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
            <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <UserX className="text-red-600" size={28} /> Resign & Offboarding
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Manajemen Pengajuan Pengunduran Diri</p>
        </div>
        <button onClick={() => { setForm(emptyForm()); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 transition-all font-black text-[11px] uppercase tracking-widest shadow-lg">
          <Plus size={16} /> Buat Pengajuan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Pengajuan', val: String(resignationList.length), cls: 'text-slate-900', card: 'bg-white border border-slate-100' },
          { label: 'Diproses', val: String(resignationList.filter(r => r.status === 'Processing').length), cls: 'text-blue-600', card: 'bg-white border border-slate-100' },
          { label: 'Selesai', val: String(resignationList.filter(r => r.status === 'Completed').length), cls: 'text-emerald-600', card: 'bg-white border border-slate-100' },
          { label: 'Menunggu Review', val: String(resignationList.filter(r => r.status === 'Submitted').length), cls: 'text-white', card: 'bg-slate-900' },
        ].map((s, i) => (
          <div key={i} className={`p-5 rounded-2xl shadow-sm ${s.card}`}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-slate-400">{s.label}</p>
            <p className={`text-3xl font-black italic ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari karyawan, departemen..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-black" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl">
          {(['all', 'Submitted', 'Processing', 'Completed', 'Cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterStatus === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {s === 'all' ? 'Semua' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <UserX size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">Belum ada pengajuan resign</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['No Resign', 'Karyawan', 'Departemen', 'Tgl Submit', 'Tgl Resign', 'Masa Kerja', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => {
                  const Icon = STATUS_ICON[r.status];
                  const tenure = r.joinDate ? Math.round((new Date(r.resignDate || Date.now()).getTime() - new Date(r.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365 * 12) / 12 * 10) / 10 : 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-black text-slate-900 italic">{r.resignNo}</td>
                      <td className="px-5 py-3">
                        <p className="font-black text-slate-900">{r.employeeName}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{r.position}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{r.department}</td>
                      <td className="px-5 py-3 text-slate-500">{r.submittedDate}</td>
                      <td className="px-5 py-3 text-slate-500">{r.resignDate}</td>
                      <td className="px-5 py-3 text-slate-600">{tenure > 0 ? `${tenure.toFixed(1)} thn` : '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black ${STATUS_COLOR[r.status]}`}>
                          <Icon size={10} /> {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setShowDetail(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-[10px] font-black">Detail</button>
                          {r.status === 'Submitted' && (
                            <button onClick={() => updateStatus(r.id, 'Processing')} disabled={processingId !== null} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-[10px] font-black disabled:opacity-50 disabled:cursor-not-allowed">Proses</button>
                          )}
                          {r.status === 'Processing' && (
                            <button onClick={() => updateStatus(r.id, 'Completed')} disabled={processingId !== null} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-[10px] font-black disabled:opacity-50 disabled:cursor-not-allowed">Selesai</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">Buat Pengajuan Resign</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Karyawan *</label>
                {employeeList.length > 0 ? (
                  <select value={form.employeeId} onChange={e => handleEmployeeSelect(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option value="">Pilih karyawan</option>
                    {employeeList.map(e => <option key={e.id} value={e.id}>{e.name} — {e.employeeId} · {e.department}</option>)}
                  </select>
                ) : (
                  <input value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="Nama karyawan" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Tanggal Resign *</label>
                  <input type="date" value={form.resignDate} onChange={e => setForm({ ...form, resignDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Hari Kerja Terakhir</label>
                  <input type="date" value={form.lastWorkingDate} onChange={e => setForm({ ...form, lastWorkingDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Notice Period (hari)</label>
                  <input type="number" value={form.noticePeriod} onChange={e => setForm({ ...form, noticePeriod: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Final Settlement (Rp)</label>
                  <input type="number" value={form.finalSettlement || ''} onChange={e => setForm({ ...form, finalSettlement: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Alasan Resign *</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400 resize-none" placeholder="Alasan pengunduran diri..." />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Catatan HR</label>
                <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400 resize-none" placeholder="Catatan internal HR..." />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
              <button onClick={handleSave} disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Simpan Pengajuan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">Detail Resign</h2>
              <button onClick={() => setShowDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                {[
                  ['No Resign', showDetail.resignNo],
                  ['Karyawan', showDetail.employeeName],
                  ['Jabatan', showDetail.position],
                  ['Departemen', showDetail.department],
                  ['Tgl Submit', showDetail.submittedDate],
                  ['Tgl Resign', showDetail.resignDate],
                  ['Hari Kerja Terakhir', showDetail.lastWorkingDate],
                  ['Notice Period', `${showDetail.noticePeriod} hari`],
                  ['Status Clearance', showDetail.clearanceStatus || '-'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
                    <span className="text-xs font-bold text-slate-900">{val}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Alasan</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{showDetail.reason}</p>
              </div>
              {showDetail.notes && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Catatan HR</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{showDetail.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowDetail(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-700 transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
