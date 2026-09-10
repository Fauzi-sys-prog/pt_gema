import { useState, useMemo } from 'react';
import { Plus, Search, Trash2, ChevronDown, ChevronUp, Banknote, TrendingDown, CheckCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

interface KasbonEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  tanggal: string;
  nominal: number;
  catatan: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
}

export default function KasbonKaryawanPage() {
  const { employeeList, projectList, kasbonList, addKasbon, updateKasbon, deleteKasbon } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Permanent' | 'Contract' | 'Internship'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Approved'>('all');
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formNominal, setFormNominal] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
  ]);


  // All kasbon now from global list — single source of truth
  const allKasbon: KasbonEntry[] = kasbonList;

  // Filter: non-THL employees only
  const karyawanList = useMemo(() => {
    return employeeList.filter(e =>
      e.employmentType !== 'THL' &&
      e.status !== 'Resigned' &&
      (filterType === 'all' || e.employmentType === filterType) &&
      (e.name.toLowerCase().includes(search.toLowerCase()) ||
       e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
       e.department.toLowerCase().includes(search.toLowerCase()))
    );
  }, [employeeList, search, filterType]);

  // Build row data per employee
  const rows = useMemo(() => {
    return karyawanList.map(emp => {
      const entries = allKasbon.filter(k => k.employeeId === emp.id);
      const totalApproved = entries.filter(k => k.status === 'Approved').reduce((s, k) => s + k.nominal, 0);
      const totalPending = entries.filter(k => k.status === 'Pending').reduce((s, k) => s + k.nominal, 0);
      const totalKasbon = totalApproved + totalPending;
      const maxKasbon = emp.salary; // max 1x gaji pokok
      const sisa = maxKasbon - totalKasbon;

      const filtered = filterStatus === 'all' ? entries :
        filterStatus === 'Pending' ? entries.filter(k => k.status === 'Pending') :
        entries.filter(k => k.status === 'Approved');

      return { ...emp, entries: filtered, allEntries: entries, totalApproved, totalPending, totalKasbon, maxKasbon, sisa };
    }).filter(r => filterStatus === 'all' || r.entries.length > 0);
  }, [karyawanList, allKasbon, filterStatus]);

  const totalKasbonAll = rows.reduce((s, r) => s + r.totalKasbon, 0);
  const totalPendingAll = rows.reduce((s, r) => s + r.totalPending, 0);

  const openModal = (emp: any) => {
    setSelectedEmp(emp);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormNominal('');
    setFormCatatan('');
    setFormProjectId('internal');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedEmp) return;

    const nominal = parseFloat(formNominal);
    if (isNaN(nominal) || nominal <= 0) {
      toast.error('Nominal kasbon tidak valid');
      return;
    }
    if (nominal > selectedEmp.sisa) {
      toast.error(`Kasbon melebihi batas (maks. ${fmt(selectedEmp.sisa)})`);
      return;
    }

    const newEntry: KasbonEntry = {
      id: `KSB-${Date.now()}`,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      projectId: formProjectId === 'internal' ? undefined : (formProjectId || undefined),
      tanggal: formTanggal,
      nominal,
      catatan: formCatatan,
      status: 'Pending',
    };

    setIsSubmitting(true);
    try {
      addKasbon(newEntry);

      toast.success(`Permohonan kasbon ${fmt(nominal)} untuk ${selectedEmp.name} diajukan (menunggu approval)`);
      setShowModal(false);
    } catch (err) {
      toast.error('Gagal mengajukan kasbon: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = (entry: KasbonEntry) => {
    if (processingId) return;
    setProcessingId(entry.id);
    try {
      updateKasbon(entry.id, { status: 'Approved', approvedBy: 'Manager', approvalDate: new Date().toISOString().split('T')[0] });
      toast.success(`Kasbon ${fmt(entry.nominal)} disetujui`);
    } catch (err) {
      toast.error('Gagal menyetujui kasbon: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (entry: KasbonEntry) => {
    if (processingId) return;
    if (!window.confirm(`Tolak & hapus kasbon ${fmt(entry.nominal)} untuk ${entry.employeeName}?`)) return;
    setProcessingId(entry.id);
    try {
      deleteKasbon(entry.id);
      toast.success('Kasbon ditolak & dihapus');
    } catch (err) {
      toast.error('Gagal menolak kasbon: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);

  const typeBadge: Record<string, string> = {
    Permanent: 'bg-blue-100 text-blue-700',
    Contract: 'bg-purple-100 text-purple-700',
    Internship: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">Karyawan</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Banknote className="text-blue-600" size={28} /> Kasbon Karyawan
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Advance / Pinjaman Gaji Karyawan Tetap & Kontrak</p>
        </div>

        {/* Summary */}
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[100px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Karyawan</p>
            <p className="text-2xl font-black text-slate-900">{rows.length}</p>
          </div>
          <div className="bg-white border border-amber-100 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[140px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-0.5">Pending Approval</p>
            <p className="text-lg font-black text-amber-500">{fmt(totalPendingAll)}</p>
          </div>
          <div className="bg-white border border-blue-100 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[140px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Total Kasbon Aktif</p>
            <p className="text-lg font-black text-blue-600">{fmt(totalKasbonAll)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / ID / departemen..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400 appearance-none min-w-[150px]"
        >
          <option value="all">Semua Tipe</option>
          <option value="Permanent">Permanent</option>
          <option value="Contract">Kontrak</option>
          <option value="Internship">Magang</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400 appearance-none min-w-[160px]"
        >
          <option value="all">Semua Status</option>
          <option value="Pending">Pending Approval</option>
          <option value="Approved">Sudah Disetujui</option>
        </select>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 flex items-start gap-3">
        <AlertCircle className="text-blue-500 mt-0.5 shrink-0" size={16} />
        <p className="text-[11px] text-blue-700 font-bold leading-relaxed">
          Kasbon karyawan <strong>memerlukan approval Manager</strong> sebelum cair.
          Batas maksimal = <strong>1× gaji pokok</strong>. Kasbon akan otomatis dipotong dari penggajian bulan berikutnya.
        </p>
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tidak ada data</p>
          </div>
        )}

        {rows.map(row => {
          const isExpanded = expandedEmp === row.id;
          const usedPct = pct(row.totalKasbon, row.maxKasbon);
          const barColor = usedPct >= 90 ? 'bg-red-500' : usedPct >= 60 ? 'bg-amber-400' : 'bg-blue-500';

          return (
            <div key={row.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg uppercase shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-slate-900 uppercase italic">{row.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${typeBadge[row.employmentType] || ''}`}>
                        {row.employmentType}
                      </span>
                      {row.totalPending > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full text-[8px] font-black uppercase">
                          {row.allEntries.filter(k => k.status === 'Pending').length} pending
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{row.position} · {row.department}</p>
                    <p className="text-[9px] text-slate-300 font-bold mt-0.5">Gaji: {fmt(row.salary)} · Maks Kasbon: {fmt(row.maxKasbon)}</p>
                  </div>
                </div>

                {/* Balance Bar */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                    <span className="text-slate-400">Kasbon Terpakai</span>
                    <span className={usedPct >= 90 ? 'text-red-500' : 'text-slate-600'}>{usedPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold mt-1">
                    <span className="text-blue-500">{fmt(row.totalKasbon)} terpakai</span>
                    <span className="text-slate-400">{fmt(row.maxKasbon)} maks</span>
                  </div>
                </div>

                {/* Sisa + Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sisa Limit</p>
                    <p className={`text-base font-black ${row.sisa <= 0 ? 'text-red-500' : 'text-slate-900'}`}>{fmt(row.sisa)}</p>
                  </div>
                  <button
                    onClick={() => openModal(row)}
                    disabled={row.sisa <= 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-blue-100"
                  >
                    <Plus size={14} /> Ajukan
                  </button>
                  <button
                    onClick={() => setExpandedEmp(isExpanded ? null : row.id)}
                    className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded History */}
              {isExpanded && (
                <div className="border-t border-slate-50 px-5 pb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4 mb-3">Riwayat Kasbon</p>

                  {row.entries.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada kasbon</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {row.entries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 group">
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${entry.status === 'Approved' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                              {entry.status === 'Approved'
                                ? <CheckCircle size={14} className="text-emerald-600" />
                                : <Clock size={14} className="text-amber-500" />}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900">{fmt(entry.nominal)}</p>
                              <p className="text-[9px] text-slate-400 font-bold">
                                {entry.tanggal}
                                {entry.catatan ? ` · ${entry.catatan}` : ''}
                                {entry.projectId ? ` · ${projectList.find(p => p.id === entry.projectId)?.namaProject || entry.projectId}` : ' · Internal'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.status === 'Pending' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(entry)}
                                  disabled={processingId !== null}
                                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-xl hover:bg-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Setuju
                                </button>
                                <button
                                  onClick={() => handleReject(entry)}
                                  disabled={processingId !== null}
                                  className="px-3 py-1.5 bg-red-50 text-red-500 text-[9px] font-black uppercase rounded-xl hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Tolak
                                </button>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase rounded-full">Disetujui</span>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 mt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Total Kasbon Aktif</p>
                        <p className="text-base font-black text-blue-600">{fmt(row.totalKasbon)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ajukan Kasbon Modal */}
      {showModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 px-6 py-5">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Ajukan Kasbon Karyawan</p>
              <h2 className="text-xl font-black text-white uppercase italic">{selectedEmp.name}</h2>
              <p className="text-[10px] text-blue-200 font-bold mt-1">{selectedEmp.position} · {selectedEmp.department}</p>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-5 py-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Gaji Pokok</p>
                <p className="text-sm font-black text-slate-700">{fmt(selectedEmp.salary)}</p>
              </div>
              <div className="px-5 py-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Kasbon Aktif</p>
                <p className="text-sm font-black text-blue-500">{fmt(selectedEmp.totalKasbon)}</p>
              </div>
              <div className="px-5 py-4 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Sisa Limit</p>
                <p className={`text-sm font-black ${selectedEmp.sisa <= 0 ? 'text-red-500' : 'text-slate-900'}`}>{fmt(selectedEmp.sisa)}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bebankan ke</label>
                <select
                  value={formProjectId}
                  onChange={e => setFormProjectId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="internal">🏢 Internal / Tanpa Project</option>
                  {projectList.map(p => (
                    <option key={p.id} value={p.id}>📁 {p.namaProject}</option>
                  ))}
                </select>
                {(!formProjectId || formProjectId === 'internal') && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Kasbon ini tidak dibebankan ke project manapun (overhead internal)</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Permohonan</label>
                <input
                  type="date"
                  value={formTanggal}
                  onChange={e => setFormTanggal(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Nominal <span className="text-blue-400">(maks. {fmt(selectedEmp.sisa)})</span>
                </label>
                <input
                  type="number"
                  value={formNominal}
                  onChange={e => setFormNominal(e.target.value)}
                  placeholder="0"
                  min={1}
                  max={selectedEmp.sisa}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                {formNominal && parseFloat(formNominal) > selectedEmp.sisa && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> Melebihi batas kasbon yang tersedia
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Keperluan (Opsional)</label>
                <input
                  type="text"
                  value={formCatatan}
                  onChange={e => setFormCatatan(e.target.value)}
                  placeholder="mis. biaya rumah sakit, keperluan keluarga..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Shortcut */}
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Nominal Cepat</p>
                <div className="flex flex-wrap gap-2">
                  {[500000, 1000000, 1500000, 2000000, 3000000].filter(v => v <= selectedEmp.sisa).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFormNominal(String(v))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 text-[10px] font-black rounded-lg transition-all"
                    >
                      {fmt(v)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormNominal(String(Math.floor(selectedEmp.sisa / 2)))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 text-[10px] font-black rounded-lg transition-all"
                  >
                    ½ Limit
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
                <Clock size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-700 font-bold">Status <strong>Pending</strong> — memerlukan persetujuan Manager sebelum cair</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : 'Ajukan Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
