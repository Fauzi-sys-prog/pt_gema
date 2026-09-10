import { useMemo, useState } from 'react';
import { CalendarDays, Users, Wallet, ShieldCheck, Search } from 'lucide-react';
import { useApp, type PayrollRun, type PayrollSlip } from '../../contexts/AppContext';

type Range = 'day' | 'week' | 'month';

const idr = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

function inRange(date: string, range: Range, anchor: Date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const a = new Date(anchor); a.setHours(0, 0, 0, 0);
  const start = new Date(a);
  if (range === 'day') return d.toDateString() === a.toDateString();
  if (range === 'week') { const day = (a.getDay() + 6) % 7; start.setDate(a.getDate() - day); }
  else start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (range === 'day') end.setDate(start.getDate() + 1);
  else if (range === 'week') end.setDate(start.getDate() + 7);
  else end.setMonth(start.getMonth() + 1);
  return d >= start && d < end;
}

export default function PayrollReportPage() {
  const { payrollRunList } = useApp();
  const [range, setRange] = useState<Range>('month');
  const [query, setQuery] = useState('');
  const anchor = new Date();
  const runs = useMemo(() => (payrollRunList || []).filter((r: PayrollRun) => inRange(r.processedDate, range, anchor)), [payrollRunList, range]);
  // A payroll employee should only appear once per period in the owner report,
  // even when old/demo runs were imported more than once.
  const slips = useMemo(() => {
    const unique = new Map<string, PayrollSlip>();
    runs.flatMap((r: PayrollRun) => r.slips || []).forEach((s: PayrollSlip) => {
      const key = `${s.employeeId || s.employeeNumber}-${s.period}`;
      if (!unique.has(key)) unique.set(key, s);
    });
    return [...unique.values()].filter((s: PayrollSlip) => !query || `${s.employeeName} ${s.employeeNumber}`.toLowerCase().includes(query.toLowerCase()));
  }, [runs, query]);
  const summary = useMemo(() => slips.reduce((a, s) => ({ people: a.people + 1, gross: a.gross + (s.grossIncome || 0), deductions: a.deductions + (s.totalDeductions || 0), thp: a.thp + (s.takeHomePay || 0) }), { people: 0, gross: 0, deductions: 0, thp: 0 }), [slips]);

  return <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
    <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Finance & Owner</p><h1 className="text-3xl font-black text-slate-900">Laporan Payroll</h1><p className="text-sm text-slate-500">Ringkasan gaji yang sudah dihitung, dipotong, dan dicairkan.</p></div>
    <div className="flex flex-wrap gap-2 items-center"><div className="flex rounded-xl bg-white border border-slate-200 p-1">{(['day','week','month'] as Range[]).map(v => <button key={v} onClick={() => setRange(v)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${range === v ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{v === 'day' ? 'Hari ini' : v === 'week' ? 'Minggu ini' : 'Bulan ini'}</button>)}</div><div className="relative ml-auto"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari karyawan..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"/></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[[Users,'Orang digaji',summary.people], [Wallet,'Bruto',idr(summary.gross)], [ShieldCheck,'Total potongan',idr(summary.deductions)], [CalendarDays,'Take home pay',idr(summary.thp)]].map(([Icon,label,val]: any) => <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4"><Icon size={18} className="text-blue-600 mb-3"/><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{val}</p></div>)}</div>
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"><div className="px-5 py-4 border-b border-slate-100"><h2 className="font-black text-slate-900">Detail Slip Gaji</h2><p className="text-xs text-slate-400">{runs.length} payroll run pada periode terpilih</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['Karyawan','Periode','Bruto','Potongan','THP','Status'].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{slips.map(s => <tr key={`${s.payrollRunId}-${s.employeeId}`}><td className="px-5 py-3 font-bold">{s.employeeName}<div className="text-[10px] text-slate-400">{s.employeeNumber}</div></td><td className="px-5 py-3">{s.period}</td><td className="px-5 py-3">{idr(s.grossIncome)}</td><td className="px-5 py-3 text-rose-600">{idr(s.totalDeductions)}</td><td className="px-5 py-3 font-black text-emerald-600">{idr(s.takeHomePay)}</td><td className="px-5 py-3">{s.status}</td></tr>)}{slips.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400">Belum ada payroll pada periode ini.</td></tr>}</tbody></table></div></div>
  </div>;
}
