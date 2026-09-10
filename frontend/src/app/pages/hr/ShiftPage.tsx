import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Clock, Calendar, Users } from 'lucide-react';
import { useApp, type Shift, type ShiftSchedule } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const emptyShift = (): Omit<Shift, 'id' | 'shiftCode'> => ({
  shiftName: '', startTime: '08:00', endTime: '17:00',
  breakDuration: 60, workHours: 8, status: 'Active', description: '',
});

const emptySchedule = (): Omit<ShiftSchedule, 'id'> => ({
  employeeId: '', employeeName: '', date: new Date().toISOString().split('T')[0],
  shiftCode: '', shiftName: '', startTime: '', endTime: '', location: '',
});

function calcWorkHours(start: string, end: string, breakMin: number) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return Math.round((mins - breakMin) / 60 * 10) / 10;
}

export default function ShiftPage() {
  const { shiftList, addShift, updateShift, deleteShift, shiftScheduleList, addShiftSchedule, deleteShiftSchedule, employeeList } = useApp();
  const [activeTab, setActiveTab] = useState<'shifts' | 'schedule'>('shifts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState(emptyShift());
  const [schedForm, setSchedForm] = useState(emptySchedule());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showShiftModal, close: () => setShowShiftModal(false) },
    { condition: showScheduleModal, close: () => setShowScheduleModal(false) },
  ]);


  const filteredShifts = shiftList.filter(s =>
    s.shiftName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.shiftCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSchedules = shiftScheduleList.filter(s =>
    s.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.date.includes(searchTerm)
  );

  const openCreateShift = () => { setEditingShift(null); setShiftForm(emptyShift()); setShowShiftModal(true); };
  const openEditShift = (s: Shift) => { setEditingShift(s); setShiftForm({ ...s }); setShowShiftModal(true); };

  const handleSaveShift = () => {
    if (isSubmitting) return;
    if (!shiftForm.shiftName || !shiftForm.startTime || !shiftForm.endTime) {
      toast.error('Nama shift dan jam kerja wajib diisi'); return;
    }
    const workHours = calcWorkHours(shiftForm.startTime, shiftForm.endTime, shiftForm.breakDuration);
    setIsSubmitting(true);
    try {
      if (editingShift) {
        updateShift(editingShift.id, { ...shiftForm, workHours });
        toast.success('Shift diperbarui');
      } else {
        const shiftCode = `SHIFT-${String(shiftList.length + 1).padStart(3, '0')}`;
        addShift({ ...shiftForm, workHours, id: `SHF-${Date.now()}`, shiftCode });
        toast.success('Shift baru ditambahkan');
      }
      setShowShiftModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan shift: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSchedule = () => {
    if (isSubmitting) return;
    if (!schedForm.employeeId || !schedForm.date || !schedForm.shiftCode) {
      toast.error('Karyawan, tanggal, dan shift wajib dipilih'); return;
    }
    const shift = shiftList.find(s => s.shiftCode === schedForm.shiftCode);
    setIsSubmitting(true);
    try {
      addShiftSchedule({
        ...schedForm,
        id: `SCHED-${Date.now()}`,
        shiftName: shift?.shiftName || '',
        startTime: shift?.startTime || '',
        endTime: shift?.endTime || '',
      });
      toast.success('Jadwal shift disimpan');
      setShowScheduleModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan jadwal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = (s: Shift) => {
    if (processingId) return;
    if (!window.confirm(`Hapus shift ${s.shiftName}?`)) return;
    setProcessingId(s.id);
    try {
      deleteShift(s.id);
      toast.success('Shift dihapus');
    } catch (err) {
      toast.error('Gagal menghapus shift: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteSchedule = (sc: ShiftSchedule) => {
    if (processingId) return;
    if (!window.confirm(`Hapus jadwal shift ${sc.employeeName} tanggal ${sc.date}?`)) return;
    setProcessingId(sc.id);
    try {
      deleteShiftSchedule(sc.id);
      toast.success('Jadwal dihapus');
    } catch (err) {
      toast.error('Gagal menghapus jadwal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employeeList.find(e => e.id === empId);
    setSchedForm(f => ({ ...f, employeeId: empId, employeeName: emp?.name || '' }));
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Clock className="text-indigo-600" size={28} /> Shift Management
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Master Shift & Jadwal Kerja</p>
        </div>
        <button onClick={activeTab === 'shifts' ? openCreateShift : () => { setSchedForm(emptySchedule()); setShowScheduleModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 transition-all font-black text-[11px] uppercase tracking-widest shadow-lg">
          <Plus size={16} /> {activeTab === 'shifts' ? 'Tambah Shift' : 'Buat Jadwal'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shift', val: String(shiftList.length), card: 'bg-white border border-slate-100', cls: 'text-slate-900' },
          { label: 'Shift Aktif', val: String(shiftList.filter(s => s.status === 'Active').length), card: 'bg-white border border-slate-100', cls: 'text-indigo-600' },
          { label: 'Jadwal Hari Ini', val: String(shiftScheduleList.filter(s => s.date === new Date().toISOString().split('T')[0]).length), card: 'bg-white border border-slate-100', cls: 'text-emerald-600' },
          { label: 'Total Jadwal', val: String(shiftScheduleList.length), card: 'bg-slate-900', cls: 'text-white' },
        ].map((s, i) => (
          <div key={i} className={`p-5 rounded-2xl shadow-sm ${s.card}`}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-slate-400">{s.label}</p>
            <p className={`text-3xl font-black italic ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-50 gap-4">
          <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl">
            {[{ key: 'shifts', label: 'Master Shift', icon: Clock }, { key: 'schedule', label: 'Jadwal', icon: Calendar }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as 'shifts' | 'schedule')}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === t.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder={activeTab === 'shifts' ? 'Cari shift...' : 'Cari karyawan / tanggal...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-black" />
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'shifts' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Kode', 'Nama Shift', 'Mulai', 'Selesai', 'Istirahat', 'Jam Kerja', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredShifts.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Belum ada data shift</td></tr>
                )}
                {filteredShifts.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-black text-slate-900 italic">{s.shiftCode}</td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-900">{s.shiftName}</p>
                      {s.description && <p className="text-[9px] text-slate-400">{s.description}</p>}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">{s.startTime}</td>
                    <td className="px-5 py-3 font-bold text-slate-900">{s.endTime}</td>
                    <td className="px-5 py-3 text-slate-600">{s.breakDuration} mnt</td>
                    <td className="px-5 py-3 font-black text-indigo-600">{s.workHours}h</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded text-[9px] font-black ${s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditShift(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} /></button>
                        <button onClick={() => handleDeleteShift(s)} disabled={processingId !== null} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Tanggal', 'Karyawan', 'Shift', 'Jam Kerja', 'Lokasi', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSchedules.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Belum ada jadwal shift</td></tr>
                )}
                {filteredSchedules.map(sc => (
                  <tr key={sc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-900">{sc.date}</td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-900">{sc.employeeName}</p>
                      <p className="text-[9px] text-slate-400 uppercase">{sc.employeeId}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-900">{sc.shiftName}</p>
                      <p className="text-[9px] text-slate-400">{sc.shiftCode}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{sc.startTime} – {sc.endTime}</td>
                    <td className="px-5 py-3 text-slate-600">{sc.location}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDeleteSchedule(sc)} disabled={processingId !== null} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">{editingShift ? 'Edit Shift' : 'Tambah Shift'}</h2>
              <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Nama Shift *</label>
                <input value={shiftForm.shiftName} onChange={e => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="cth: Shift Pagi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Jam Mulai *</label>
                  <input type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Jam Selesai *</label>
                  <input type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Istirahat (menit)</label>
                  <input type="number" value={shiftForm.breakDuration} onChange={e => setShiftForm({ ...shiftForm, breakDuration: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Status</label>
                  <select value={shiftForm.status} onChange={e => setShiftForm({ ...shiftForm, status: e.target.value as Shift['status'] })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
              </div>
              {shiftForm.startTime && shiftForm.endTime && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-700 uppercase">Total Jam Kerja</span>
                  <span className="text-lg font-black text-indigo-700">{calcWorkHours(shiftForm.startTime, shiftForm.endTime, shiftForm.breakDuration)} jam</span>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Deskripsi</label>
                <textarea value={shiftForm.description || ''} onChange={e => setShiftForm({ ...shiftForm, description: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400 resize-none" placeholder="Keterangan opsional" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowShiftModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={handleSaveShift} disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 uppercase italic">Buat Jadwal Shift</h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Karyawan *</label>
                {employeeList.length > 0 ? (
                  <select value={schedForm.employeeId} onChange={e => handleEmployeeSelect(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option value="">Pilih karyawan</option>
                    {employeeList.map(e => <option key={e.id} value={e.id}>{e.name} — {e.employeeId} · {e.department}</option>)}
                  </select>
                ) : (
                  <input value={schedForm.employeeName} onChange={e => setSchedForm({ ...schedForm, employeeName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="Nama karyawan" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Tanggal *</label>
                  <input type="date" value={schedForm.date} onChange={e => setSchedForm({ ...schedForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Shift *</label>
                  <select value={schedForm.shiftCode} onChange={e => setSchedForm({ ...schedForm, shiftCode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400">
                    <option value="">Pilih shift</option>
                    {shiftList.filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.shiftCode}>{s.shiftName} ({s.startTime}–{s.endTime})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Lokasi</label>
                <input value={schedForm.location} onChange={e => setSchedForm({ ...schedForm, location: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black outline-none focus:border-slate-400" placeholder="cth: Office - Jakarta, Site Area B" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={handleSaveSchedule} disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
