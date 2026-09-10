import { useState, useMemo } from 'react';
import {
  Plus, Search, Eye, CheckCircle, XCircle, Clock, Users, X, AlertCircle
} from 'lucide-react';
import { useApp, type OvertimeRequest } from '../../contexts/AppContext';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<OvertimeRequest['status'], string> = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
};

const calcHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 10) / 10);
};

interface FormState {
  employeeId: string;
  spkId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

const EMPTY_FORM: FormState = {
  employeeId: '',
  spkId: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '17:00',
  endTime: '20:00',
  reason: '',
};

type TabKey = 'Semua' | 'Pending' | 'Approved' | 'Ditolak';
const TABS: TabKey[] = ['Semua', 'Pending', 'Approved', 'Ditolak'];

export default function LemburPage() {
  const { overtimeList, addOvertime, updateOvertime, employeeList, employeeCompensations, workOrderList } = useApp();

  const [activeTab, setActiveTab]   = useState<TabKey>('Semua');
  const [search, setSearch]         = useState('');
  const [showPanel, setShowPanel]   = useState(false);
  const [viewItem, setViewItem]     = useState<OvertimeRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OvertimeRequest | null>(null);
  const [rejectNotes, setRejectNotes]   = useState('');
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const selectedEmployee = employeeList.find(e => e.id === form.employeeId);
  const previewHours = calcHours(form.startTime, form.endTime);

  // Rate lembur dari kompensasi karyawan
  const getOvertimeRate = (empId: string) => {
    const comp = employeeCompensations.find(c => c.employeeId === empId);
    return comp?.overtimeRate ?? 0;
  };

  // KPI
  const now = new Date();
  const thisPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalHoursThisMonth = useMemo(() =>
    overtimeList
      .filter(r => r.status === 'Approved' && r.date.startsWith(thisPeriod))
      .reduce((s, r) => s + r.hours, 0),
    [overtimeList, thisPeriod]
  );
  const countPending = useMemo(() =>
    overtimeList.filter(r => r.status === 'Pending').length,
    [overtimeList]
  );
  const totalBiayaThisMonth = useMemo(() =>
    overtimeList
      .filter(r => r.status === 'Approved' && r.date.startsWith(thisPeriod))
      .reduce((s, r) => s + (r.hours * getOvertimeRate(r.employeeId)), 0),
    [overtimeList, thisPeriod, employeeCompensations]
  );
  const countDistinctEmps = useMemo(() =>
    new Set(overtimeList.filter(r => r.status === 'Approved' && r.date.startsWith(thisPeriod)).map(r => r.employeeId)).size,
    [overtimeList, thisPeriod]
  );

  // Filter
  const filtered = useMemo(() => {
    let list = overtimeList;
    if (activeTab === 'Pending')  list = list.filter(r => r.status === 'Pending');
    if (activeTab === 'Approved') list = list.filter(r => r.status === 'Approved');
    if (activeTab === 'Ditolak')  list = list.filter(r => r.status === 'Rejected');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.employeeName.toLowerCase().includes(q) ||
        r.overtimeNo.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return list;
  }, [overtimeList, activeTab, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedEmployee) { toast.error('Pilih karyawan'); return; }
    const hours = calcHours(form.startTime, form.endTime);
    if (hours <= 0) { toast.error('Jam selesai harus setelah jam mulai'); return; }

    const d = new Date(form.date);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const id = `OT-${Date.now()}`;
    const overtimeNo = `OT/${yr}/${mo}/${id.slice(-4)}`;

    setIsSubmitting(true);
    try {
      addOvertime({
        id, overtimeNo,
        employeeId:   selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeType: selectedEmployee.employmentType === 'THL' ? 'THL' : 'Karyawan',
        date:      form.date,
        startTime: form.startTime,
        endTime:   form.endTime,
        hours,
        reason:    form.reason,
        spkId: form.spkId || undefined,
        nomorSPK: form.spkId ? workOrderList.find(wo => wo.id === form.spkId)?.nomorSPK || workOrderList.find(wo => wo.id === form.spkId)?.woNumber : undefined,
        status:    'Pending',
      });
      toast.success(`${overtimeNo} berhasil diajukan`);
      setShowPanel(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error('Gagal mengajukan lembur: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = (req: OvertimeRequest) => {
    if (processingId) return;
    setProcessingId(req.id);
    try {
      updateOvertime(req.id, {
        status: 'Approved',
        approvedBy: 'Manager',
        approvedAt: new Date().toISOString().split('T')[0],
      });
      toast.success(`${req.overtimeNo} disetujui`);
    } catch (err) {
      toast.error('Gagal menyetujui lembur: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const confirmReject = () => {
    if (!rejectTarget || processingId) return;
    setProcessingId(rejectTarget.id);
    try {
      updateOvertime(rejectTarget.id, { status: 'Rejected', notes: rejectNotes });
      toast.error(`${rejectTarget.overtimeNo} ditolak`);
      setRejectTarget(null);
      setRejectNotes('');
    } catch (err) {
      toast.error('Gagal menolak lembur: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const tabCounts: Partial<Record<TabKey, number>> = { Pending: countPending };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">Lembur</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Clock className="text-blue-600" size={28} /> Lembur
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Pengajuan &amp; Approval Lembur Karyawan</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setShowPanel(true); }}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
        >
          <Plus size={16} /> Ajukan Lembur
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Clock size={16} className="text-blue-500" />, bg: 'bg-blue-50', label: 'Total Jam Bulan Ini', value: `${totalHoursThisMonth} jam`, color: 'text-blue-600' },
          { icon: <AlertCircle size={16} className="text-amber-500" />, bg: 'bg-amber-50', label: 'Menunggu Approval', value: String(countPending), color: 'text-amber-600' },
          { icon: <Users size={16} className="text-indigo-500" />, bg: 'bg-indigo-50', label: 'Karyawan Lembur', value: String(countDistinctEmps), color: 'text-indigo-600' },
          { icon: <CheckCircle size={16} className="text-emerald-500" />, bg: 'bg-emerald-50', label: 'Total Biaya Lembur', value: fmt(totalBiayaThisMonth), color: 'text-emerald-600' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-100 rounded-3xl px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 ${c.bg} rounded-xl`}>{c.icon}</div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</p>
            </div>
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab}
            {tabCounts[tab] !== undefined && tabCounts[tab]! > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${activeTab === tab ? 'bg-blue-400 text-white' : 'bg-amber-100 text-amber-600'}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama / no. lembur..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['No. Lembur', 'Nama', 'Tipe', 'Tanggal', 'SPK/WO', 'Jam Mulai', 'Jam Selesai', 'Total Jam', 'Alasan', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Tidak ada data
                  </td>
                </tr>
              ) : filtered.map(req => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-black text-blue-600 whitespace-nowrap">{req.overtimeNo}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-800 whitespace-nowrap">{req.employeeName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${req.employeeType === 'THL' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {req.employeeType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">{req.date}</td>
                  <td className="px-4 py-3 text-[10px] font-black text-indigo-600 whitespace-nowrap">{req.nomorSPK || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{req.startTime}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{req.endTime}</td>
                  <td className="px-4 py-3 text-xs font-black text-slate-800 whitespace-nowrap">{req.hours} jam</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{req.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${STATUS_BADGE[req.status]}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setViewItem(req)} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all" title="Detail">
                        <Eye size={13} className="text-slate-500" />
                      </button>
                      {req.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={processingId !== null}
                            className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded-lg hover:bg-emerald-200 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle size={10} /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectTarget(req); setRejectNotes(''); }}
                            disabled={processingId !== null}
                            className="px-2 py-1 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded-lg hover:bg-red-100 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XCircle size={10} /> Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="bg-blue-600 px-6 py-5 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Ajukan Lembur Baru</p>
                <h2 className="text-xl font-black text-white uppercase italic">Form Lembur</h2>
              </div>
              <button onClick={() => setShowPanel(false)} className="p-2 hover:bg-blue-500 rounded-xl transition-all">
                <X size={18} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
              {/* Karyawan */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Karyawan *</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employeeList.filter(e => e.status === 'Active').map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.employmentType})</option>
                  ))}
                </select>
                {selectedEmployee && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                    {selectedEmployee.position} · {selectedEmployee.department}
                    {getOvertimeRate(selectedEmployee.id) > 0 && (
                      <> · Rate: <span className="text-blue-600">{fmt(getOvertimeRate(selectedEmployee.id))}/jam</span></>
                    )}
                  </p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Referensi SPK (opsional)</label>
                <select value={form.spkId} onChange={e => setForm(f => ({ ...f, spkId: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Tanpa SPK --</option>
                  {workOrderList.filter(wo => ['Draft','In Progress','QC'].includes(wo.status)).map(wo => (
                    <option key={wo.id} value={wo.id}>{wo.nomorSPK || wo.woNumber} · {wo.itemToProduce}</option>
                  ))}
                </select>
              </div>

              {/* Tanggal */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Lembur *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Jam */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Jam Mulai *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Jam Selesai *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Preview jam */}
              {previewHours > 0 && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Total Jam Lembur</span>
                  <span className="text-lg font-black text-blue-700">{previewHours} jam</span>
                </div>
              )}

              {/* Preview biaya */}
              {previewHours > 0 && selectedEmployee && getOvertimeRate(selectedEmployee.id) > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Estimasi Biaya</span>
                  <span className="text-lg font-black text-emerald-700">{fmt(previewHours * getOvertimeRate(selectedEmployee.id))}</span>
                </div>
              )}

              {/* Alasan */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Alasan / Pekerjaan *</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  required
                  placeholder="Deskripsikan pekerjaan yang dilakukan saat lembur..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPanel(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Memproses...' : 'Ajukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-slate-800 uppercase italic">Tolak Lembur</h2>
              <button onClick={() => setRejectTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Tolak lembur <strong>{rejectTarget.overtimeNo}</strong> dari <strong>{rejectTarget.employeeName}</strong>?
            </p>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Catatan (Opsional)</label>
              <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3}
                placeholder="Alasan penolakan..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-300 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                Batal
              </button>
              <button onClick={confirmReject} disabled={processingId !== null}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-800 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detail Lembur</p>
                <h2 className="text-lg font-black text-white uppercase italic">{viewItem.overtimeNo}</h2>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">{viewItem.employeeName}</p>
              </div>
              <button onClick={() => setViewItem(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="p-6 space-y-2 text-xs">
              {([
                ['Tanggal',     viewItem.date],
                ['SPK / WO',    viewItem.nomorSPK || 'Tanpa SPK'],
                ['Jam Mulai',   viewItem.startTime],
                ['Jam Selesai', viewItem.endTime],
                ['Total Jam',   `${viewItem.hours} jam`],
                ['Status',      viewItem.status],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">{label}</span>
                  <span className="font-bold text-slate-700 text-right">{value}</span>
                </div>
              ))}
              {getOvertimeRate(viewItem.employeeId) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Biaya Lembur</span>
                  <span className="font-black text-emerald-600 text-right">{fmt(viewItem.hours * getOvertimeRate(viewItem.employeeId))}</span>
                </div>
              )}
              <div className="border-t border-slate-100 pt-2 mt-2">
                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Alasan / Pekerjaan</span>
                <p className="font-bold text-slate-700">{viewItem.reason}</p>
              </div>
              {viewItem.approvedBy && (
                <div className="flex justify-between gap-4 pt-1">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Disetujui Oleh</span>
                  <span className="font-bold text-slate-700 text-right">{viewItem.approvedBy} · {viewItem.approvedAt}</span>
                </div>
              )}
              {viewItem.notes && (
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Catatan</span>
                  <p className="font-bold text-red-500">{viewItem.notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setViewItem(null)}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
