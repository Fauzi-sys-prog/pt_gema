import { useState, useMemo } from 'react';
import { Plus, Search, User, AlertCircle, Trash2, ChevronDown, ChevronUp, Banknote, TrendingDown, Calculator, CheckCircle } from 'lucide-react';
import { useApp, type KasbonTHLEntry, type THLKasbonSettlement } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const BPJSTK_DEFAULT = 60000;
const JKN_DEFAULT = 52193;
const ADMIN_FEE_RATE = 0.025;

function calcTHLUpahFromTimesheet(
  thlId: string,
  upahPerJam: number,
  uangMakanPerHari: number,
  thlTimesheetList: ReturnType<typeof useApp>['thlTimesheetList']
) {
  const records = thlTimesheetList.filter(r => r.thlId === thlId && r.ket === 'Kerja');
  if (records.length === 0) return null;
  let total = 0;
  records.forEach(r => {
    let m = parseFloat(r.mulai.replace(':', '.'));
    let s = parseFloat(r.selesai.replace(':', '.'));
    if (s <= m) s += 24;
    const totalJam = Math.max(0, s - m - r.istirahat);
    const jamLembur = Math.min(r.jamLembur, totalJam);
    const jamKerja = totalJam - jamLembur;
    total += jamKerja * upahPerJam + jamLembur * r.lemburIndex * upahPerJam + uangMakanPerHari;
  });
  return Math.round(total);
}

export default function KasbonTHLPage() {
  const {
    thlList, projectList,
    kasbonTHLList, addKasbonTHL, deleteKasbonTHL,
    thlTimesheetList,
    thlSettlementList, addTHLSettlement, deleteTHLSettlement,
    pettyCashGudangList, addPettyCashGudangEntry,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [expandedTHL, setExpandedTHL] = useState<string | null>(null);

  // Kasbon modal
  const [showKasbonModal, setShowKasbonModal] = useState(false);
  const [selectedTHL, setSelectedTHL] = useState<any>(null);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formNominal, setFormNominal] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  // Settlement modal
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlTHL, setSettlTHL] = useState<any>(null);
  const [settlTanggal, setSettlTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [settlPeriode, setSettlPeriode] = useState('');
  const [settlPotonganKasbon, setSettlPotonganKasbon] = useState('');
  const [settlTambahan, setSettlTambahan] = useState('');
  const [settlTambahanKet, setSettlTambahanKet] = useState('');
  const [settlBpjstk, setSettlBpjstk] = useState(String(BPJSTK_DEFAULT));
  const [settlJkn, setSettlJkn] = useState(String(JKN_DEFAULT));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showKasbonModal, close: () => setShowKasbonModal(false) },
    { condition: showSettlementModal, close: () => setShowSettlementModal(false) },
  ]);

  const thlRows = useMemo(() => {
    const activeTHL = thlList.filter(t =>
      (filterProject === 'all' || t.projectId === filterProject) &&
      (t.nama.toLowerCase().includes(search.toLowerCase()) ||
       t.posisi.toLowerCase().includes(search.toLowerCase()) ||
       t.noTHL.toLowerCase().includes(search.toLowerCase()))
    );

    return activeTHL.map(t => {
      const upahPerJam = t.upahPerJam || t.upahHarian;
      const uangMakanPerHari = t.uangMakanPerHari || 0;
      const fromTimesheet = calcTHLUpahFromTimesheet(t.id, upahPerJam, uangMakanPerHari, thlTimesheetList);
      const totalGaji = fromTimesheet !== null ? fromTimesheet : (upahPerJam * t.jumlahHari * 11);
      const hasTimesheet = fromTimesheet !== null;

      const myKasbon = kasbonTHLList.filter(k => k.thlId === t.id);
      const jumlahKasbon = myKasbon.reduce((s, k) => s + k.nominal, 0);
      const adminFee = Math.round(jumlahKasbon * ADMIN_FEE_RATE);
      const totalKasbonWithAdmin = jumlahKasbon + adminFee;

      const mySettlements = thlSettlementList.filter(s => s.thlId === t.id);
      const totalPotonganKasbon = mySettlements.reduce((s, sl) => s + sl.potonganKasbon, 0);
      const sisaKasbon = Math.max(0, totalKasbonWithAdmin - totalPotonganKasbon);

      // batas kasbon baru = upah earned - jumlah kasbon yang sudah diambil
      const sisaBisaDikasbon = Math.max(0, totalGaji - jumlahKasbon);

      const project = projectList.find(p => p.id === t.projectId);
      return {
        ...t, totalGaji, hasTimesheet,
        jumlahKasbon, adminFee, totalKasbonWithAdmin,
        totalPotonganKasbon, sisaKasbon,
        sisaBisaDikasbon,
        entries: myKasbon,
        settlements: mySettlements,
        project,
      };
    });
  }, [thlList, kasbonTHLList, thlSettlementList, filterProject, search, projectList, thlTimesheetList]);

  const totalKasbonAll = thlRows.reduce((s, r) => s + r.jumlahKasbon, 0);
  const totalSisaKasbonAll = thlRows.reduce((s, r) => s + r.sisaKasbon, 0);

  // ── Kasbon Modal ──────────────────────────────────────────────
  const openKasbonModal = (thl: any) => {
    setSelectedTHL(thl);
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormNominal('');
    setFormCatatan('');
    setShowKasbonModal(true);
  };

  const handleKasbonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedTHL) return;
    const nominal = parseFloat(formNominal);
    if (isNaN(nominal) || nominal <= 0) { toast.error('Nominal tidak valid'); return; }
    if (nominal > selectedTHL.sisaBisaDikasbon) {
      toast.error(`Melebihi batas kasbon (${fmt(selectedTHL.sisaBisaDikasbon)})`); return;
    }
    const entry: KasbonTHLEntry = {
      id: `KBTHL-${Date.now()}`,
      thlId: selectedTHL.id,
      thlNama: selectedTHL.nama,
      projectId: selectedTHL.projectId || '',
      tanggal: formTanggal,
      nominal,
      catatan: formCatatan,
      status: 'Approved',
    };
    setIsSubmitting(true);
    try {
      addKasbonTHL(entry);
      // Kurangi saldo Petty Cash Gudang
      const lastBal = pettyCashGudangList.length > 0 ? pettyCashGudangList[pettyCashGudangList.length - 1].balance : 0;
      await addPettyCashGudangEntry({
        date: formTanggal,
        accountCode: 'KBTHL',
        description: `Kasbon THL — ${selectedTHL.nama}${formCatatan ? ` (${formCatatan})` : ''}`,
        debit: 0, credit: nominal, balance: lastBal - nominal,
      });
      toast.success(`Kasbon ${fmt(nominal)} dicatat, saldo Kas Gudang dikurangi`);
      setShowKasbonModal(false);
    } catch (err) {
      toast.error('Gagal mencatat kasbon: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Settlement Modal ──────────────────────────────────────────
  const openSettlementModal = (thl: any) => {
    setSettlTHL(thl);
    setSettlTanggal(new Date().toISOString().split('T')[0]);
    setSettlPeriode('');
    setSettlPotonganKasbon(thl.sisaKasbon > 0 ? String(thl.sisaKasbon) : '0');
    setSettlTambahan('');
    setSettlTambahanKet('');
    setSettlBpjstk(String(BPJSTK_DEFAULT));
    setSettlJkn(String(JKN_DEFAULT));
    setShowSettlementModal(true);
  };

  const settlCalc = useMemo(() => {
    if (!settlTHL) return null;
    const gaji = settlTHL.totalGaji;
    const tambahan = parseFloat(settlTambahan) || 0;
    const potongan = parseFloat(settlPotonganKasbon) || 0;
    const bpjstk = parseFloat(settlBpjstk) || 0;
    const jkn = parseFloat(settlJkn) || 0;
    const saldo = gaji + tambahan - potongan - bpjstk - jkn;
    return { gaji, tambahan, potongan, bpjstk, jkn, saldo };
  }, [settlTHL, settlTambahan, settlPotonganKasbon, settlBpjstk, settlJkn]);

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!settlTHL || !settlCalc) return;
    if (!settlPeriode) { toast.error('Isi periode pembayaran'); return; }

    const settlement: THLKasbonSettlement = {
      id: `STHL-${Date.now()}`,
      thlId: settlTHL.id,
      thlNama: settlTHL.nama,
      tanggal: settlTanggal,
      periode: settlPeriode,
      totalGaji: settlCalc.gaji,
      tambahan: settlCalc.tambahan,
      tambahanKet: settlTambahanKet,
      potonganKasbon: settlCalc.potongan,
      adminFee: settlTHL.adminFee,
      bpjstk: settlCalc.bpjstk,
      jkn: settlCalc.jkn,
      saldo: settlCalc.saldo,
    };
    setIsSubmitting(true);
    try {
      addTHLSettlement(settlement);

      // Netto dibayar keluar dari Petty Cash Gudang
      if (settlCalc.saldo > 0) {
        const lastBal = pettyCashGudangList.length > 0 ? pettyCashGudangList[pettyCashGudangList.length - 1].balance : 0;
        await addPettyCashGudangEntry({
          date: settlTanggal,
          accountCode: 'BAYARTHL',
          description: `Bayar THL — ${settlTHL.nama} · ${settlPeriode}`,
          debit: 0, credit: settlCalc.saldo, balance: lastBal - settlCalc.saldo,
        });
      }
      toast.success(`Settlement ${settlTHL.nama} disimpan. SALDO: ${fmt(settlCalc.saldo)}`);
      setShowSettlementModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan settlement: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-orange-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">THL</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Banknote className="text-orange-600" size={28} /> Kasbon THL
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Kasbon, Admin Fee & Settlement Tenaga Harian Lepas</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[110px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total THL</p>
            <p className="text-2xl font-black text-slate-900">{thlRows.length}</p>
          </div>
          <div className="bg-white border border-orange-100 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[140px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-0.5">Total Kasbon</p>
            <p className="text-lg font-black text-orange-600">{fmt(totalKasbonAll)}</p>
          </div>
          <div className="bg-white border border-red-100 rounded-2xl px-5 py-3 shadow-sm text-center min-w-[140px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-0.5">Sisa Terhutang</p>
            <p className="text-lg font-black text-red-600">{fmt(totalSisaKasbonAll)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / posisi THL..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-400 min-w-[180px]">
          <option value="all">Semua Project</option>
          {projectList.map(p => <option key={p.id} value={p.id}>{p.namaProject}</option>)}
        </select>
      </div>

      {/* Info */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-start gap-3">
        <AlertCircle className="text-orange-500 mt-0.5 shrink-0" size={16} />
        <p className="text-[11px] text-orange-700 font-bold leading-relaxed">
          Kasbon THL tidak perlu approval. Admin fee <strong>2.5%</strong> dihitung dari total kasbon terhutang.
          Setiap kasbon otomatis mengurangi <strong>Petty Cash Gudang</strong>.
          Bayar netto (Total Gaji − Kasbon − BPJSTK − JKN) via tombol <strong>Settlement</strong>.
        </p>
      </div>

      {/* THL List */}
      <div className="space-y-3">
        {thlRows.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center">
            <User className="mx-auto text-slate-200 mb-3" size={40} />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada data THL</p>
          </div>
        )}

        {thlRows.map(row => {
          const isExpanded = expandedTHL === row.id;
          const usedPct = pct(row.jumlahKasbon, row.totalGaji);
          const barColor = usedPct >= 90 ? 'bg-red-500' : usedPct >= 60 ? 'bg-orange-400' : 'bg-emerald-500';

          return (
            <div key={row.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                {/* Avatar + Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-black text-lg uppercase shrink-0">
                    {row.nama.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase italic">{row.nama}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{row.posisi} · {row.project?.namaProject || row.project}</p>
                    <p className="text-[9px] text-slate-300 font-bold mt-0.5">{row.noTHL} · {fmt(row.upahPerJam || row.upahHarian)}/jam</p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${row.hasTimesheet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.hasTimesheet ? 'dari timesheet' : 'estimasi'}
                    </span>
                  </div>
                </div>

                {/* Kasbon balance bar */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                    <span className="text-slate-400">Kasbon / Gaji</span>
                    <span className={usedPct >= 90 ? 'text-red-500' : 'text-slate-600'}>{usedPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold mt-1">
                    <span className="text-orange-500">{fmt(row.jumlahKasbon)} kasbon</span>
                    <span className="text-emerald-600">{fmt(row.totalGaji)} gaji</span>
                  </div>
                </div>

                {/* Kasbon status + actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sisa Terhutang</p>
                    <p className={`text-base font-black ${row.sisaKasbon > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(row.sisaKasbon)}</p>
                  </div>
                  <button onClick={() => openKasbonModal(row)} disabled={row.sisaBisaDikasbon <= 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-orange-100">
                    <Plus size={13} /> Kasbon
                  </button>
                  <button onClick={() => openSettlementModal(row)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
                    <Calculator size={13} /> Settlement
                  </button>
                  <button onClick={() => setExpandedTHL(isExpanded ? null : row.id)}
                    className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-slate-50 p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: Kasbon Tracker */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Kasbon</p>
                      {row.entries.length === 0 ? (
                        <div className="py-6 text-center bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada kasbon</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {row.entries.map((entry, i) => (
                            <div key={entry.id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 group">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-orange-100 rounded-xl flex items-center justify-center text-[9px] font-black text-orange-600">{i + 1}</div>
                                <div>
                                  <p className="text-xs font-black text-slate-900">{fmt(entry.nominal)}</p>
                                  <p className="text-[9px] text-slate-400 font-bold">{entry.tanggal}{entry.catatan ? ` · ${entry.catatan}` : ''}</p>
                                </div>
                              </div>
                              <button
                                disabled={processingId !== null}
                                onClick={() => {
                                  if (processingId) return;
                                  if (!window.confirm(`Hapus kasbon ${fmt(entry.nominal)} untuk ${entry.thlNama}?`)) return;
                                  setProcessingId(entry.id);
                                  try {
                                    deleteKasbonTHL(entry.id);
                                    toast.success('Kasbon dihapus');
                                  } catch (err) {
                                    toast.error('Gagal menghapus kasbon: ' + (err instanceof Error ? err.message : 'Error'));
                                  } finally {
                                    setProcessingId(null);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          {/* Kasbon summary */}
                          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 space-y-1 mt-2">
                            <div className="flex justify-between text-[10px]">
                              <span className="font-bold text-slate-600">Jumlah Kasbon</span>
                              <span className="font-black text-slate-900">{fmt(row.jumlahKasbon)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Admin 2.5%</span>
                              <span className="font-bold text-orange-600">{fmt(row.adminFee)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] border-t border-orange-200 pt-1 mt-1">
                              <span className="font-black text-orange-700 uppercase tracking-wide">Total Kasbon</span>
                              <span className="font-black text-orange-700">{fmt(row.totalKasbonWithAdmin)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Sudah dipotong</span>
                              <span className="font-bold text-emerald-600">−{fmt(row.totalPotonganKasbon)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] border-t border-orange-200 pt-1">
                              <span className="font-black text-red-600 uppercase tracking-wide">Sisa Kasbon</span>
                              <span className="font-black text-red-600">{fmt(row.sisaKasbon)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Settlement History */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Riwayat Settlement</p>
                      {row.settlements.length === 0 ? (
                        <div className="py-6 text-center bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada settlement</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {row.settlements.map((sl, i) => (
                            <div key={sl.id} className="bg-slate-50 rounded-2xl px-4 py-3 group">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-[10px] font-black text-slate-900 uppercase">Settlement #{i + 1} — {sl.periode}</p>
                                  <p className="text-[9px] text-slate-400 font-bold">{sl.tanggal}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-emerald-600">{fmt(sl.saldo)}</p>
                                  <button
                                    disabled={processingId !== null}
                                    onClick={() => {
                                      if (processingId) return;
                                      if (!window.confirm(`Hapus settlement ${sl.periode} untuk ${sl.thlNama} (${fmt(sl.saldo)})?`)) return;
                                      setProcessingId(sl.id);
                                      try {
                                        deleteTHLSettlement(sl.id);
                                        toast.success('Settlement dihapus');
                                      } catch (err) {
                                        toast.error('Gagal menghapus settlement: ' + (err instanceof Error ? err.message : 'Error'));
                                      } finally {
                                        setProcessingId(null);
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]">
                                <span className="text-slate-500">Gaji: <strong className="text-slate-800">{fmt(sl.totalGaji)}</strong></span>
                                {sl.tambahan > 0 && <span className="text-slate-500">Tambahan: <strong className="text-blue-700">{fmt(sl.tambahan)}</strong></span>}
                                <span className="text-slate-500">Potongan kasbon: <strong className="text-red-600">−{fmt(sl.potonganKasbon)}</strong></span>
                                <span className="text-slate-500">BPJSTK+JKN: <strong className="text-slate-700">−{fmt(sl.bpjstk + sl.jkn)}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Kasbon Modal ── */}
      {showKasbonModal && selectedTHL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-600 px-6 py-5">
              <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest mb-1">Catat Kasbon THL</p>
              <h2 className="text-xl font-black text-white uppercase italic">{selectedTHL.nama}</h2>
              <p className="text-[10px] text-orange-200 font-bold mt-1">{selectedTHL.posisi} · {selectedTHL.project?.namaProject}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-4 py-3 text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total Gaji</p>
                <p className="text-sm font-black text-emerald-600">{fmt(selectedTHL.totalGaji)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Kasbon</p>
                <p className="text-sm font-black text-orange-500">{fmt(selectedTHL.jumlahKasbon)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Bisa Dikasbon</p>
                <p className={`text-sm font-black ${selectedTHL.sisaBisaDikasbon <= 0 ? 'text-red-500' : 'text-slate-900'}`}>{fmt(selectedTHL.sisaBisaDikasbon)}</p>
              </div>
            </div>
            <form onSubmit={handleKasbonSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal</label>
                <input type="date" value={formTanggal} onChange={e => setFormTanggal(e.target.value)} required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Nominal <span className="text-orange-400">(maks. {fmt(selectedTHL.sisaBisaDikasbon)})</span>
                </label>
                <input type="number" value={formNominal} onChange={e => setFormNominal(e.target.value)}
                  placeholder="0" min={1} max={selectedTHL.sisaBisaDikasbon} required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                {formNominal && parseFloat(formNominal) > selectedTHL.sisaBisaDikasbon && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={12} /> Melebihi batas</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Catatan</label>
                <input type="text" value={formCatatan} onChange={e => setFormCatatan(e.target.value)}
                  placeholder="keperluan pribadi..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[100000, 200000, 500000, 1000000].filter(v => v <= selectedTHL.sisaBisaDikasbon).map(v => (
                  <button key={v} type="button" onClick={() => setFormNominal(String(v))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 text-[10px] font-black rounded-lg transition-all">{fmt(v)}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowKasbonModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Memproses...' : 'Catat Kasbon'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Settlement Modal ── */}
      {showSettlementModal && settlTHL && settlCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-emerald-700 px-6 py-5">
              <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">Settlement & Pembayaran THL</p>
              <h2 className="text-xl font-black text-white uppercase italic">{settlTHL.nama}</h2>
              <p className="text-[10px] text-emerald-200 font-bold mt-1">{settlTHL.posisi} · {settlTHL.project?.namaProject}</p>
            </div>

            <form onSubmit={handleSettlementSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Bayar</label>
                  <input type="date" value={settlTanggal} onChange={e => setSettlTanggal(e.target.value)} required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Periode *</label>
                  <input type="text" value={settlPeriode} onChange={e => setSettlPeriode(e.target.value)} placeholder="mis. Okt–Nov 2025" required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>

              {/* Kalkulasi settlement */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm">
                {/* Total Gaji */}
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-600">Total Gaji {settlTHL.hasTimesheet ? '(dari timesheet)' : '(estimasi)'}</span>
                  <span className="font-black text-slate-900">{fmt(settlCalc.gaji)}</span>
                </div>

                {/* Tambahan */}
                <div className="border-t border-slate-200 pt-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">+ Tambahan (Lain-lain)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={settlTambahan} onChange={e => setSettlTambahan(e.target.value)} placeholder="0"
                      className="p-2.5 bg-white border border-slate-200 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                    <input type="text" value={settlTambahanKet} onChange={e => setSettlTambahanKet(e.target.value)} placeholder="Keterangan (mis. Jaga Gudang)"
                      className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>

                {/* Kasbon section */}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Total Kasbon (incl. admin 2.5%)</span>
                    <span className="font-bold text-orange-600">{fmt(settlTHL.totalKasbonWithAdmin)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-2">
                    <span>Sudah dipotong sebelumnya</span>
                    <span className="font-bold text-emerald-600">−{fmt(settlTHL.totalPotonganKasbon)}</span>
                  </div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">− Potongan Kasbon Periode Ini</label>
                  <input type="number" value={settlPotonganKasbon} onChange={e => setSettlPotonganKasbon(e.target.value)} placeholder="0"
                    max={settlTHL.sisaKasbon}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                  {parseFloat(settlPotonganKasbon) > settlTHL.sisaKasbon && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">Melebihi sisa kasbon ({fmt(settlTHL.sisaKasbon)})</p>
                  )}
                </div>

                {/* BPJSTK + JKN */}
                <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">− BPJSTK</label>
                    <input type="number" value={settlBpjstk} onChange={e => setSettlBpjstk(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">− JKN (BPJS Kes)</label>
                    <input type="number" value={settlJkn} onChange={e => setSettlJkn(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                  </div>
                </div>

                {/* SALDO */}
                <div className={`border-t-2 pt-3 flex justify-between items-center ${settlCalc.saldo >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
                  <span className="text-sm font-black text-slate-700 uppercase tracking-wide">SALDO (Netto Dibayar)</span>
                  <span className={`text-2xl font-black ${settlCalc.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(settlCalc.saldo)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSettlementModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle size={14} /> {isSubmitting ? 'Memproses...' : 'Simpan Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
