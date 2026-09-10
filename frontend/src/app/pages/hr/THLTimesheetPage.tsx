import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Save, RotateCcw, AlertCircle, Clock, Users } from 'lucide-react';
import { useApp, type THLTimesheetRecord } from '../../contexts/AppContext';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const fmtNum = (n: number, dec = 1) => n % 1 === 0 ? String(n) : n.toFixed(dec);

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const KET_OPTIONS = ['Kerja', 'Izin', 'Sakit', 'Libur', 'Alpa'] as const;
const KET_COLOR: Record<string, string> = {
  Kerja: 'bg-emerald-100 text-emerald-700',
  Izin:  'bg-blue-100 text-blue-700',
  Sakit: 'bg-amber-100 text-amber-700',
  Libur: 'bg-slate-100 text-slate-500',
  Alpa:  'bg-red-100 text-red-600',
};

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

function calcJam(mulai: string, selesai: string, istirahat: number): number {
  let m = parseTime(mulai);
  let s = parseTime(selesai);
  if (s <= m) s += 24; // night shift
  return Math.max(0, s - m - istirahat);
}

type RowState = {
  ket: typeof KET_OPTIONS[number];
  mulai: string;
  selesai: string;
  istirahat: number;
  jamLembur: number;
  lemburIndex: number;
};

export default function THLTimesheetPage() {
  const { thlList, thlTimesheetList, saveTHLTimesheetBatch, kasbonTHLList } = useApp();

  const now = new Date();
  const [selectedTHLId, setSelectedTHLId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const thl = thlList.find(t => t.id === selectedTHLId);
  const upahPerJam = thl?.upahPerJam || thl?.upahHarian || 0;
  const uangMakanPerHari = thl?.uangMakanPerHari || 0;
  const defaultMulai = thl?.shiftMulai || '07:00';
  const defaultSelesai = thl?.shiftSelesai || '19:00';

  const periode = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Build all days of the month
  const daysInMonth = useMemo(() => {
    const days: { tanggal: string; hari: string; no: number }[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      days.push({
        tanggal: d.toISOString().split('T')[0],
        hari: HARI[d.getDay()],
        no: d.getDate(),
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [year, month]);

  // Load existing records for this THL + periode
  const existingRecords = useMemo(() =>
    thlTimesheetList.filter(r => r.thlId === selectedTHLId && r.periode === periode),
    [thlTimesheetList, selectedTHLId, periode]
  );

  // Local row state: tanggal → RowState
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [initialized, setInitialized] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize rows when THL or period changes
  const stateKey = `${selectedTHLId}::${periode}`;
  if (initialized !== stateKey) {
    const newRows: Record<string, RowState> = {};
    daysInMonth.forEach(day => {
      const existing = existingRecords.find(r => r.tanggal === day.tanggal);
      newRows[day.tanggal] = existing ? {
        ket: existing.ket,
        mulai: existing.mulai,
        selesai: existing.selesai,
        istirahat: existing.istirahat,
        jamLembur: existing.jamLembur,
        lemburIndex: existing.lemburIndex,
      } : {
        // Jangan menganggap seluruh tanggal dalam bulan sebagai hari kerja.
        // Admin menandai hanya tanggal yang benar-benar bekerja.
        ket: 'Libur',
        mulai: defaultMulai,
        selesai: defaultSelesai,
        istirahat: 1,
        jamLembur: 0,
        lemburIndex: 1.5,
      };
    });
    setRows(newRows);
    setInitialized(stateKey);
  }

  const updateRow = (tanggal: string, updates: Partial<RowState>) => {
    setRows(prev => ({ ...prev, [tanggal]: { ...prev[tanggal], ...updates } }));
  };

  // Per-row calculations
  function calcRow(tanggal: string) {
    const r = rows[tanggal];
    if (!r || r.ket !== 'Kerja') return { totalKerja: 0, jamKerja: 0, jamLembur: 0, upahRp: 0, lemburRp: 0, uangMakan: 0, jumlah: 0 };
    const totalKerja = calcJam(r.mulai, r.selesai, r.istirahat);
    const jamLembur = Math.min(r.jamLembur, totalKerja);
    const jamKerja = totalKerja - jamLembur;
    const upahRp = jamKerja * upahPerJam;
    const lemburRp = jamLembur * r.lemburIndex * upahPerJam;
    const uangMakan = uangMakanPerHari;
    return { totalKerja, jamKerja, jamLembur, upahRp, lemburRp, uangMakan, jumlah: upahRp + lemburRp + uangMakan };
  }

  // Totals
  const totals = useMemo(() => {
    let hariKerja = 0, totalKerja = 0, upah = 0, lembur = 0, makan = 0;
    daysInMonth.forEach(day => {
      const c = calcRow(day.tanggal);
      if (rows[day.tanggal]?.ket === 'Kerja') hariKerja++;
      totalKerja += c.totalKerja;
      upah += c.upahRp;
      lembur += c.lemburRp;
      makan += c.uangMakan;
    });
    return { hariKerja, totalKerja, upah, lembur, makan, totalUpah: upah + lembur + makan };
  }, [rows, daysInMonth, upahPerJam, uangMakanPerHari]);

  const totalKasbon = kasbonTHLList
    .filter(k => k.thlId === selectedTHLId)
    .reduce((s, k) => s + k.nominal, 0);

  // Isi semua hari kerja (kecuali Minggu = libur)
  const fillAllWorkdays = () => {
    if (!thl) return;
    const newRows = { ...rows };
    daysInMonth.forEach(day => {
      const isMingg = day.hari === 'Minggu';
      newRows[day.tanggal] = {
        ket: isMingg ? 'Libur' : 'Kerja',
        mulai: defaultMulai,
        selesai: defaultSelesai,
        istirahat: 1,
        jamLembur: 0,
        lemburIndex: 1.5,
      };
    });
    setRows(newRows);
  };

  const handleSave = () => {
    if (!selectedTHLId) { toast.error('Pilih THL terlebih dahulu'); return; }
    const records: THLTimesheetRecord[] = daysInMonth.map(day => ({
      id: `THLTS-${selectedTHLId}-${day.tanggal}`,
      thlId: selectedTHLId,
      periode,
      tanggal: day.tanggal,
      ket: rows[day.tanggal]?.ket || 'Libur',
      mulai: rows[day.tanggal]?.mulai || defaultMulai,
      selesai: rows[day.tanggal]?.selesai || defaultSelesai,
      istirahat: rows[day.tanggal]?.istirahat ?? 1,
      jamLembur: rows[day.tanggal]?.jamLembur ?? 0,
      lemburIndex: rows[day.tanggal]?.lemburIndex ?? 1.5,
    }));
    saveTHLTimesheetBatch(selectedTHLId, periode, records);
    toast.success(`Timesheet ${thl?.nama} — ${BULAN[month]} ${year} disimpan`);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">THL</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Calendar className="text-blue-600" size={28} /> Timesheet THL
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Absensi & Perhitungan Upah Tenaga Harian Lepas</p>
        </div>
        <div className="flex gap-2">
          {selectedTHLId && (
            <>
              <button onClick={fillAllWorkdays}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-2xl hover:bg-slate-200 transition-all font-black text-[11px] uppercase tracking-widest">
                <RotateCcw size={14} /> Isi Workday
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 transition-all font-black text-[11px] uppercase tracking-widest shadow-lg">
                <Save size={14} /> Simpan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih THL</label>
          <select value={selectedTHLId} onChange={e => { setSelectedTHLId(e.target.value); setInitialized(''); }}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-black outline-none focus:border-blue-400 bg-white">
            <option value="">— Pilih THL —</option>
            {thlList.map(t => (
              <option key={t.id} value={t.id}>{t.nama} · {t.posisi} · {t.project}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Periode</label>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-black text-slate-900 min-w-[130px] text-center">{BULAN[month]} {year}</span>
            <button onClick={nextMonth} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {thl && (
          <div className="flex gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Upah/Jam</p>
              <p className="text-sm font-black text-slate-900">{fmt(upahPerJam)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uang Makan/Hari</p>
              <p className="text-sm font-black text-slate-900">{uangMakanPerHari ? fmt(uangMakanPerHari) : '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Default Shift</p>
              <p className="text-sm font-black text-slate-900">{defaultMulai}–{defaultSelesai}</p>
            </div>
          </div>
        )}
      </div>

      {!selectedTHLId && (
        <div className="bg-white rounded-3xl border border-slate-100 py-24 text-center">
          <Users className="mx-auto text-slate-200 mb-3" size={48} />
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Pilih THL untuk mulai input timesheet</p>
        </div>
      )}

      {selectedTHLId && (
        <>
          {/* Timesheet Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-left text-xs" style={{ minWidth: '1100px', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '36px' }} />   {/* No */}
                  <col style={{ width: '60px' }} />   {/* Tanggal */}
                  <col style={{ width: '64px' }} />   {/* Hari */}
                  <col style={{ width: '80px' }} />   {/* Ket */}
                  <col style={{ width: '100px' }} />  {/* Masuk */}
                  <col style={{ width: '100px' }} />  {/* Keluar */}
                  <col style={{ width: '68px' }} />   {/* Istirahat */}
                  <col style={{ width: '60px' }} />   {/* Total Jam */}
                  <col style={{ width: '60px' }} />   {/* Jam Kerja */}
                  <col style={{ width: '100px' }} />  {/* Lembur */}
                  <col style={{ width: '60px' }} />   {/* Index */}
                  <col style={{ width: '110px' }} />  {/* Upah (Rp) */}
                  <col style={{ width: '110px' }} />  {/* Lembur (Rp) */}
                  <col style={{ width: '90px' }} />   {/* Makan (Rp) */}
                  <col style={{ width: '120px' }} />  {/* Jumlah (Rp) */}
                </colgroup>
                <thead className="bg-slate-900 text-white">
                  <tr>
                    {[
                      { label: 'No',        align: 'text-center' },
                      { label: 'Tanggal',   align: '' },
                      { label: 'Hari',      align: '' },
                      { label: 'Ket',       align: '' },
                      { label: 'Masuk',     align: 'text-center' },
                      { label: 'Keluar',    align: 'text-center' },
                      { label: 'Istirahat', align: 'text-center' },
                      { label: 'Ttl Jam',   align: 'text-center' },
                      { label: 'Jam Kerja', align: 'text-center' },
                      { label: 'Lembur (j:m)', align: 'text-center' },
                      { label: 'Idx',       align: 'text-center' },
                      { label: 'Upah (Rp)', align: 'text-right' },
                      { label: 'Lembur(Rp)',align: 'text-right' },
                      { label: 'Makan(Rp)', align: 'text-right' },
                      { label: 'Jumlah(Rp)',align: 'text-right' },
                    ].map(h => (
                      <th key={h.label} className={`px-2 py-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${h.align}`}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {daysInMonth.map(day => {
                    const r = rows[day.tanggal] || { ket: 'Libur', mulai: defaultMulai, selesai: defaultSelesai, istirahat: 1, jamLembur: 0, lemburIndex: 1.5 };
                    const c = calcRow(day.tanggal);
                    const isKerja = r.ket === 'Kerja';
                    const isMinggu = day.hari === 'Minggu';

                    return (
                      <tr key={day.tanggal} className={`transition-colors ${isMinggu ? 'bg-slate-50/60' : 'hover:bg-blue-50/30'}`}>
                        <td className="px-2 py-2 text-slate-400 font-bold text-center">{day.no}</td>
                        <td className="px-2 py-2 font-bold text-slate-700 whitespace-nowrap">{day.tanggal.slice(5)}</td>
                        <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{day.hari}</td>
                        <td className="px-2 py-2">
                          <select
                            value={r.ket}
                            onChange={e => updateRow(day.tanggal, { ket: e.target.value as typeof KET_OPTIONS[number] })}
                            className={`w-full px-1.5 py-1 rounded-lg text-[10px] font-black border-0 outline-none cursor-pointer ${KET_COLOR[r.ket]}`}
                          >
                            {KET_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input type="time" value={r.mulai} disabled={!isKerja}
                            onChange={e => updateRow(day.tanggal, { mulai: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="time" value={r.selesai} disabled={!isKerja}
                            onChange={e => updateRow(day.tanggal, { selesai: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" value={isKerja ? r.istirahat : ''} disabled={!isKerja} min={0} max={3} step={0.5}
                            onChange={e => updateRow(day.tanggal, { istirahat: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-[11px] font-bold text-center outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                        </td>
                        <td className="px-2 py-2 text-slate-600 font-bold text-center">
                          {isKerja ? fmtNum(c.totalKerja) : '—'}
                        </td>
                        <td className="px-2 py-2 text-slate-600 font-bold text-center">
                          {isKerja ? fmtNum(c.jamKerja) : '—'}
                        </td>
                        <td className="px-1 py-2">
                          <div className="flex items-center gap-1">
                            <input type="number" value={isKerja ? Math.floor(r.jamLembur) : ''} disabled={!isKerja} min={0} step={1}
                              aria-label={`Jam lembur ${day.tanggal}`}
                              onChange={e => { const h = Math.max(0, parseInt(e.target.value, 10) || 0); const m = Math.round((r.jamLembur - Math.floor(r.jamLembur)) * 60); updateRow(day.tanggal, { jamLembur: h + m / 60 }); }}
                              className="w-full min-w-0 px-1 py-1 border border-slate-200 rounded-lg text-[10px] font-bold text-center outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                            <span className="text-[9px] text-slate-400">j</span>
                            <input type="number" value={isKerja ? Math.round((r.jamLembur - Math.floor(r.jamLembur)) * 60) : ''} disabled={!isKerja} min={0} max={59} step={1}
                              aria-label={`Menit lembur ${day.tanggal}`}
                              onChange={e => { const m = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)); updateRow(day.tanggal, { jamLembur: Math.floor(r.jamLembur) + m / 60 }); }}
                              className="w-full min-w-0 px-1 py-1 border border-slate-200 rounded-lg text-[10px] font-bold text-center outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                            <span className="text-[9px] text-slate-400">m</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" value={isKerja && r.jamLembur > 0 ? r.lemburIndex : ''} disabled={!isKerja || r.jamLembur === 0} min={1} max={3} step={0.5}
                            onChange={e => updateRow(day.tanggal, { lemburIndex: parseFloat(e.target.value) || 1.5 })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-[11px] font-bold text-center outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400" />
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-slate-800 whitespace-nowrap">
                          {isKerja ? new Intl.NumberFormat('id-ID').format(Math.round(c.upahRp)) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-blue-600 whitespace-nowrap">
                          {isKerja && c.lemburRp > 0 ? new Intl.NumberFormat('id-ID').format(Math.round(c.lemburRp)) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-slate-600 whitespace-nowrap">
                          {isKerja ? new Intl.NumberFormat('id-ID').format(c.uangMakan) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-black text-emerald-700 whitespace-nowrap">
                          {isKerja ? new Intl.NumberFormat('id-ID').format(Math.round(c.jumlah)) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    {/* cols 1–7: No Tanggal Hari Ket Masuk Keluar Istirahat */}
                    <td colSpan={7} className="px-2 py-3 text-[10px] font-black uppercase tracking-widest">
                      TOTAL — {totals.hariKerja} hari kerja · {fmtNum(totals.totalKerja)} jam
                    </td>
                    {/* cols 8–11: Ttl Jam, Jam Kerja, Lembur, Index (kosong) */}
                    <td colSpan={4}></td>
                    {/* cols 12–15: Upah, Lembur, Makan, Jumlah */}
                    <td className="px-2 py-3 text-right font-black text-white whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(Math.round(totals.upah))}</td>
                    <td className="px-2 py-3 text-right font-black text-blue-300 whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(Math.round(totals.lembur))}</td>
                    <td className="px-2 py-3 text-right font-black text-slate-300 whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(totals.makan)}</td>
                    <td className="px-2 py-3 text-right font-black text-emerald-300 whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(Math.round(totals.totalUpah))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Upah Kerja</p>
              <p className="text-xl font-black text-emerald-600">{fmt(Math.round(totals.upah))}</p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Lembur</p>
              <p className="text-xl font-black text-blue-600">{fmt(Math.round(totals.lembur))}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Uang Makan</p>
              <p className="text-xl font-black text-slate-700">{fmt(totals.makan)}</p>
            </div>
            <div className="bg-slate-900 rounded-2xl shadow-sm p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Gross Total</p>
              <p className="text-xl font-black text-white">{fmt(Math.round(totals.totalUpah))}</p>
            </div>
          </div>

          {/* Kasbon Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Rekapitulasi Pembayaran</h3>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex gap-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Upah</p>
                  <p className="text-2xl font-black text-slate-900">{fmt(Math.round(totals.totalUpah))}</p>
                </div>
                <div className="text-slate-300 text-2xl font-light self-center">−</div>
                <div>
                  <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Total Kasbon</p>
                  <p className="text-2xl font-black text-orange-500">{fmt(totalKasbon)}</p>
                </div>
                <div className="text-slate-300 text-2xl font-light self-center">=</div>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Netto Dibayar</p>
                  <p className={`text-2xl font-black ${totals.totalUpah - totalKasbon < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {fmt(Math.round(totals.totalUpah - totalKasbon))}
                  </p>
                </div>
              </div>
              {totals.totalUpah > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 max-w-xs">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                  <p className="text-[10px] text-amber-700 font-bold">
                    Pembayaran netto keluar dari <strong>Petty Cash Gudang</strong>. Kasbon yang sudah dicatat otomatis mengurangi saldo.
                  </p>
                </div>
              )}
            </div>
            {totals.hariKerja > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-50">
                <div className="flex gap-4 text-[11px] text-slate-500 font-bold">
                  <span><Clock size={12} className="inline mr-1" />{totals.hariKerja} hari kerja</span>
                  <span>·</span>
                  <span>{fmtNum(totals.totalKerja)} total jam</span>
                  <span>·</span>
                  <span>{fmtNum(totals.lembur > 0 ? totals.lembur / upahPerJam : 0)} jam lembur</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
