import { useState } from 'react';
import { useApp, type THLPayrollRun, type THLPayrollSlip } from '../../contexts/AppContext';
import { toast } from 'sonner';
import {
  Banknote, CheckCircle2, ChevronDown, ChevronRight,
  Users, AlertCircle, Clock, RotateCcw, Trash2, X, Building2
} from 'lucide-react';

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'BTN'];

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

export default function GajianTHLPage() {
  const {
    thlList, thlTimesheetList, kasbonTHLList,
    thlPayrollRunList, addTHLPayrollRun, updateTHLPayrollRun, deleteTHLPayrollRun,
  } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [includeBPJSTK, setIncludeBPJSTK] = useState(true);
  const [includeJKN, setIncludeJKN]       = useState(true);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [disburseRun, setDisburseRun]     = useState<THLPayrollRun | null>(null);
  const [disburseBank, setDisburseBank]   = useState('BCA');
  const [isProcessing, setIsProcessing]   = useState(false);

  const periode    = `${year}-${String(month + 1).padStart(2, '0')}`;
  const periodLabel = `${BULAN[month]} ${year}`;
  const existingRun = thlPayrollRunList.find(r => r.periode === periode);

  // ── Hitung upah dari timesheet satu THL satu periode ─────────────────────
  function calcUpah(thlId: string, per: string) {
    const thl = thlList.find(t => t.id === thlId);
    if (!thl) return { hariKerja: 0, totalJam: 0, totalUpah: 0 };
    const upahPerJam     = thl.upahPerJam || thl.upahHarian || 0;
    const uangMakanPerHari = thl.uangMakanPerHari || 0;
    const records = thlTimesheetList.filter(r => r.thlId === thlId && r.periode === per && r.ket === 'Kerja');
    let hariKerja = 0, totalJam = 0, totalUpah = 0;
    records.forEach(rec => {
      hariKerja++;
      let m = parseTime(rec.mulai), s = parseTime(rec.selesai);
      if (s <= m) s += 24;
      const kerja    = Math.max(0, s - m - rec.istirahat);
      const lembur   = Math.min(rec.jamLembur, kerja);
      const reguler  = kerja - lembur;
      totalJam      += kerja;
      totalUpah     += reguler * upahPerJam + lembur * rec.lemburIndex * upahPerJam + uangMakanPerHari;
    });
    return { hariKerja, totalJam, totalUpah };
  }

  // ── Hitung Gaji ──────────────────────────────────────────────────────────
  const handleHitung = () => {
    if (isProcessing) return;
    if (existingRun) { toast.error(`Run ${periodLabel} sudah ada — hapus dulu jika ingin hitung ulang`); return; }

    const aktiveTHL = thlList.filter(t => !t.status || t.status === 'Active');
    const slips: THLPayrollSlip[] = aktiveTHL
      .map(thl => {
        const { hariKerja, totalJam, totalUpah } = calcUpah(thl.id, periode);
        const kasbon    = kasbonTHLList.filter(k => k.thlId === thl.id && k.status !== 'Rejected').reduce((s, k) => s + k.nominal, 0);
        const adminFee  = Math.round(kasbon * 0.025);
        const bpjstk    = includeBPJSTK ? 60000 : 0;
        const jkn       = includeJKN    ? 52193 : 0;
        const potongan  = kasbon + adminFee + bpjstk + jkn;
        const netto     = Math.max(0, Math.round(totalUpah) - potongan);
        return { thlId: thl.id, thlNama: thl.nama, posisi: thl.posisi, project: thl.project, hariKerja, totalJam: Math.round(totalJam * 10) / 10, totalUpah: Math.round(totalUpah), totalKasbon: kasbon, adminFee, bpjstk, jkn, netto };
      })
      .filter(s => s.hariKerja > 0 || s.totalKasbon > 0);

    if (slips.length === 0) {
      toast.error('Tidak ada THL aktif dengan data timesheet atau kasbon di periode ini');
      return;
    }

    const run: THLPayrollRun = {
      id: `THLRUN-${Date.now()}`,
      periode, periodLabel,
      thlCount:      slips.length,
      totalUpah:     slips.reduce((s, x) => s + x.totalUpah, 0),
      totalKasbon:   slips.reduce((s, x) => s + x.totalKasbon, 0),
      totalAdminFee: slips.reduce((s, x) => s + x.adminFee, 0),
      totalBPJSTK:   slips.reduce((s, x) => s + x.bpjstk, 0),
      totalJKN:      slips.reduce((s, x) => s + x.jkn, 0),
      totalNetto:    slips.reduce((s, x) => s + x.netto, 0),
      status: 'Draft',
      slips,
      createdAt: new Date().toISOString(),
    };

    setIsProcessing(true);
    try {
      addTHLPayrollRun(run);
      setExpandedId(run.id);
      toast.success(`Gajian THL ${periodLabel} dihitung — ${slips.length} THL, netto ${fmt(run.totalNetto)}`);
    } catch (err) {
      toast.error('Gagal menghitung gaji: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = (runId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateTHLPayrollRun(runId, { status: 'Approved', approvedAt: new Date().toISOString() });
      toast.success('Gajian disetujui — siap dicairkan');
    } catch (err) {
      toast.error('Gagal approve: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Disbursed → kurangi Petty Cash Gudang ────────────────────────────────
  const handleDisburse = (run: THLPayrollRun, bank: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      updateTHLPayrollRun(run.id, {
        status: 'Disbursed',
        disbursedAt: new Date().toISOString(),
        bank,
      });
      setDisburseRun(null);
      toast.success(`Gaji THL ${run.periodLabel} dicairkan — ${fmt(run.totalNetto)} keluar dari rekening ${bank}`);
    } catch (err) {
      toast.error('Gagal mencairkan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const statusStyle: Record<string, string> = {
    Draft:    'bg-slate-100 text-slate-600',
    Approved: 'bg-blue-100 text-blue-700',
    Disbursed:'bg-emerald-100 text-emerald-700',
  };

  return (
    <>
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen pb-24">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">THL</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
          <Banknote className="text-emerald-600" size={28} /> Gajian THL
        </h1>
        <p className="text-slate-500 text-sm font-bold uppercase italic">Pembayaran Upah Tenaga Harian Lepas</p>
      </div>

      {/* Panel hitung gaji baru */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hitung Gaji Periode Baru</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bulan</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-400">
              {BULAN.map((b, i) => <option key={b} value={i}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tahun</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-400">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex gap-4 items-center pb-0.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={includeBPJSTK} onChange={e => setIncludeBPJSTK(e.target.checked)} className="rounded" />
              BPJSTK Rp 60.000
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={includeJKN} onChange={e => setIncludeJKN(e.target.checked)} className="rounded" />
              JKN Rp 52.193
            </label>
          </div>
          <button onClick={handleHitung} disabled={!!existingRun || isProcessing}
            className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={14} />
            {existingRun ? `Run ${periodLabel} Sudah Ada` : `Hitung Gaji ${periodLabel}`}
          </button>
        </div>
      </div>

      {/* Daftar run */}
      {thlPayrollRunList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 py-24 text-center">
          <Users className="mx-auto text-slate-200 mb-3" size={48} />
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Belum ada run gajian THL</p>
          <p className="text-xs text-slate-300 mt-2">Pilih periode, centang potongan, lalu klik Hitung Gaji</p>
        </div>
      ) : (
        <div className="space-y-3">
          {thlPayrollRunList.map(run => {
            const isExpanded = expandedId === run.id;
            const totalPotongan = run.totalKasbon + run.totalAdminFee + run.totalBPJSTK + run.totalJKN;

            return (
              <div key={run.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                {/* Run header row */}
                <div className="p-5 flex items-center gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : run.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusStyle[run.status]}`}>{run.status}</span>
                      <span className="text-sm font-black text-slate-900">{run.periodLabel}</span>
                      <span className="text-xs text-slate-400 font-bold">· {run.thlCount} THL</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] font-bold text-slate-500">
                      <span>Upah <span className="text-slate-800">{fmt(run.totalUpah)}</span></span>
                      <span>Potongan <span className="text-orange-600">{fmt(totalPotongan)}</span></span>
                      <span>Netto <span className="text-emerald-600 font-black">{fmt(run.totalNetto)}</span></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {run.status === 'Draft' && (
                      <button onClick={() => handleApprove(run.id)} disabled={isProcessing}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        Approve
                      </button>
                    )}
                    {run.status === 'Approved' && (
                      <button onClick={() => { setDisburseRun(run); setDisburseBank('BCA'); }}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-1">
                        <Banknote size={12} /> Cairkan
                      </button>
                    )}
                    {run.status === 'Disbursed' && (
                      <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={14} /> {run.disbursedAt?.slice(0, 10)}
                      </span>
                    )}
                    {run.status === 'Draft' && (
                      confirmDelete === run.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { deleteTHLPayrollRun(run.id); setConfirmDelete(null); toast.success('Run dihapus'); }}
                            className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black">Hapus</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black">Batal</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(run.id)}
                          className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : run.id)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* Slip table */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ minWidth: '860px' }}>
                        <colgroup>
                          <col style={{ width: '160px' }} />
                          <col style={{ width: '160px' }} />
                          <col style={{ width: '70px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '120px' }} />
                        </colgroup>
                        <thead className="bg-slate-50">
                          <tr>
                            {[
                              { h: 'Nama THL',     a: '' },
                              { h: 'Posisi / Project', a: '' },
                              { h: 'Hari Kerja',   a: 'text-center' },
                              { h: 'Total Upah',   a: 'text-right' },
                              { h: 'Kasbon',       a: 'text-right' },
                              { h: 'Admin 2.5%',   a: 'text-right' },
                              { h: 'BPJSTK',       a: 'text-right' },
                              { h: 'JKN',          a: 'text-right' },
                              { h: 'Netto Dibayar',a: 'text-right' },
                            ].map(c => (
                              <th key={c.h} className={`px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ${c.a}`}>{c.h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {run.slips.map(slip => (
                            <tr key={slip.thlId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-3 font-black text-slate-800">{slip.thlNama}</td>
                              <td className="px-3 py-3 text-slate-500 font-medium">
                                <div className="text-[10px] text-slate-400">{slip.posisi}</div>
                                <div className="text-[11px] text-slate-600 font-bold truncate max-w-[150px]">{slip.project}</div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="font-bold text-slate-700">{slip.hariKerja}</span>
                                {slip.hariKerja === 0 && (
                                  <span className="ml-1 text-[9px] text-amber-500 font-black">NO TS</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{fmt(slip.totalUpah)}</td>
                              <td className="px-3 py-3 text-right font-bold text-orange-600 whitespace-nowrap">
                                {slip.totalKasbon > 0 ? fmt(slip.totalKasbon) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-orange-400 whitespace-nowrap">
                                {slip.adminFee > 0 ? fmt(slip.adminFee) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-slate-500 whitespace-nowrap">
                                {slip.bpjstk > 0 ? fmt(slip.bpjstk) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-slate-500 whitespace-nowrap">
                                {slip.jkn > 0 ? fmt(slip.jkn) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-black whitespace-nowrap">
                                <span className={slip.netto > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                                  {fmt(slip.netto)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white">
                          <tr>
                            <td colSpan={3} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest">
                              TOTAL — {run.thlCount} THL
                            </td>
                            <td className="px-3 py-3 text-right font-black whitespace-nowrap">{fmt(run.totalUpah)}</td>
                            <td className="px-3 py-3 text-right font-black text-orange-300 whitespace-nowrap">{fmt(run.totalKasbon)}</td>
                            <td className="px-3 py-3 text-right font-black text-orange-200 whitespace-nowrap">{fmt(run.totalAdminFee)}</td>
                            <td className="px-3 py-3 text-right font-black text-slate-300 whitespace-nowrap">{fmt(run.totalBPJSTK)}</td>
                            <td className="px-3 py-3 text-right font-black text-slate-300 whitespace-nowrap">{fmt(run.totalJKN)}</td>
                            <td className="px-3 py-3 text-right font-black text-emerald-300 whitespace-nowrap">{fmt(run.totalNetto)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Info footer */}
                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700 font-bold">
                        {run.status === 'Disbursed'
                          ? `Dicairkan ${run.disbursedAt?.slice(0, 10)} — total ${fmt(run.totalNetto)} sudah keluar dari Petty Cash Gudang`
                          : 'Saat Cairkan diklik, netto setiap THL otomatis mengurangi saldo Petty Cash Gudang'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Timestamp info */}
                <div className="px-5 pb-3 flex gap-4 text-[10px] text-slate-300 font-bold">
                  <span className="flex items-center gap-1"><Clock size={10} /> Dibuat {run.createdAt.slice(0, 10)}</span>
                  {run.approvedAt && <span>· Disetujui {run.approvedAt.slice(0, 10)}</span>}
                  {run.disbursedAt && <span>· Dicairkan {run.disbursedAt.slice(0, 10)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

      {/* Disburse bank picker modal */}
      {disburseRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">Cairkan via Bank</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">{disburseRun.periodLabel} · {fmt(disburseRun.totalNetto)}</p>
              </div>
              <button onClick={() => setDisburseRun(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X size={15} className="text-slate-500" />
              </button>
            </div>

            <div className="mb-5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bank Sumber Dana</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={disburseBank}
                  onChange={e => setDisburseBank(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all appearance-none"
                >
                  {BANKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Akan tercatat sebagai arus keluar di Rekonsiliasi Bank.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDisburseRun(null)} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50">
                Batal
              </button>
              <button
                onClick={() => handleDisburse(disburseRun, disburseBank)}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Banknote size={15} /> {isProcessing ? 'Memproses...' : 'Cairkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
