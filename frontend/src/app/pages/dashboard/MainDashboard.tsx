import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Briefcase,
  ChevronRight,
  BarChart3,
  Users,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { dashboardService, type ExecutiveDashboardSummary } from '../../services/dashboardService';

const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return `${n}`;
};
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round(((a - b) / b) * 100);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SEGMENT_COLORS = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6'];

// ── SVG bar chart ─────────────────────────────────────────────────────────────
function SVGBarChart({ data, keys, colors }: {
  data: { year: string; [k: string]: number | string }[];
  keys: string[];
  colors: string[];
}) {
  const W = 560, H = 220, padL = 48, padB = 28, padT = 10, padR = 12;
  const chartW = W - padL - padR, chartH = H - padB - padT;
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => d[k] as number)), 1);
  const barGroupW = chartW / data.length;
  const barW = Math.max(6, (barGroupW - 8) / keys.length);
  const [tooltip, setTooltip] = useState<{ x: number; d: typeof data[0] } | null>(null);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = maxVal * f, y = padT + chartH * (1 - f);
          return (
            <g key={`grid-${f}`}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e5e7eb" />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtShort(v)}</text>
            </g>
          );
        })}
        {data.map((d, gi) => {
          const gx = padL + gi * barGroupW + 4;
          return (
            <g key={`grp-${d.year}`}
              onMouseEnter={() => setTooltip({ x: gx + barGroupW / 2, d })}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-pointer">
              {keys.map((k, ki) => {
                const val = d[k] as number;
                const bh = (val / maxVal) * chartH;
                return (
                  <rect key={`bar-${d.year}-${k}`}
                    x={gx + ki * (barW + 2)} y={padT + chartH - bh}
                    width={barW} height={bh} rx={3} fill={colors[ki]}
                    opacity={tooltip && tooltip.d.year !== d.year ? 0.35 : 0.9} />
                );
              })}
              <text x={gx + barGroupW / 2 - 4} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">{d.year}</text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="absolute pointer-events-none bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-xs shadow-lg z-10"
          style={{ left: (tooltip.x / W * 100) + '%', top: 0, transform: 'translateX(-50%)' }}>
          <p className="font-semibold text-neutral-700 mb-1.5">{tooltip.d.year}</p>
          {keys.map((k, i) => (
            <div key={k} className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
              <span className="text-neutral-500">{k}:</span>
              <span className="font-bold text-neutral-800 ml-auto">{fmtShort(tooltip.d[k] as number)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SVG growth chart ──────────────────────────────────────────────────────────
function SVGGrowthChart({ data }: { data: { year: string; growth: number }[] }) {
  const W = 380, H = 180, padL = 40, padB = 24, padT = 10, padR = 8;
  const chartW = W - padL - padR, chartH = H - padB - padT;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.growth)), 10);
  const midY = padT + chartH / 2;
  const barW = Math.max(14, chartW / data.length - 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {[-1, -0.5, 0, 0.5, 1].map(f => {
        const y = midY - (chartH / 2) * f;
        return (
          <g key={`gg-${f}`}>
            <line x1={padL} x2={W - padR} y1={y} y2={y}
              stroke={f === 0 ? '#d1d5db' : '#f3f4f6'}
              strokeDasharray={f === 0 ? 'none' : '4 4'} />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {f === 0 ? '0%' : `${f > 0 ? '+' : ''}${Math.round(f * maxAbs)}%`}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bh = Math.max(3, (Math.abs(d.growth) / maxAbs) * chartH / 2);
        const bx = padL + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
        const by = d.growth >= 0 ? midY - bh : midY;
        return (
          <g key={`gcell-${d.year}`}>
            <rect x={bx} y={by} width={barW} height={bh} rx={3}
              fill={d.growth >= 0 ? '#10b981' : '#ef4444'} opacity={0.85} />
            <text x={bx + barW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.year}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG area chart ────────────────────────────────────────────────────────────
function SVGAreaChart({ data }: { data: { month: string; revenue: number; expense: number }[] }) {
  const W = 380, H = 180, padL = 44, padB = 24, padT = 10, padR = 8;
  const chartW = W - padL - padR, chartH = H - padB - padT;
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense]), 1);
  const step = chartW / Math.max(1, data.length - 1);
  const xp = (i: number) => padL + i * step;
  const yp = (v: number) => padT + chartH * (1 - v / maxVal);

  const line = (k: 'revenue' | 'expense') => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xp(i)} ${yp(d[k])}`).join(' ');
  const area = (k: 'revenue' | 'expense') => {
    const pts = data.map((d, i) => `${xp(i)},${yp(d[k])}`);
    return `M ${pts.join(' L ')} L ${xp(data.length - 1)},${padT + chartH} L ${xp(0)},${padT + chartH} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="lgRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lgExp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(f => {
        const y = padT + chartH * (1 - f);
        return (
          <g key={`ay-${f}`}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f3f4f6" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtShort(maxVal * f)}</text>
          </g>
        );
      })}
      <path d={area('revenue')} fill="url(#lgRev)" />
      <path d={area('expense')} fill="url(#lgExp)" />
      <path d={line('revenue')} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      <path d={line('expense')} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <text key={`am-${d.month}`} x={xp(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.month}</text>
      ))}
    </svg>
  );
}

// ── SVG donut ─────────────────────────────────────────────────────────────────
function SVGDonut({ segments }: { segments: { name: string; value: number; color: string }[] }) {
  const R = 72, r = 48, cx = 100, cy = 100;
  const total = Math.max(segments.reduce((s, d) => s + d.value, 0), 1);
  let angle = -Math.PI / 2;
  const arcs = segments.map(seg => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
    const xi1 = cx + r * Math.cos(angle - sweep), yi1 = cy + r * Math.sin(angle - sweep);
    const xi2 = cx + r * Math.cos(angle), yi2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...seg, d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z` };
  });
  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ height: 180 }}>
      {arcs.map(a => (
        <path key={`donut-${a.name}`} d={a.d} fill={a.color} opacity={0.85} stroke="white" strokeWidth={2} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fill="#9ca3af">Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={14} fill="#111827" fontWeight="700">100%</text>
    </svg>
  );
}

// ── sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 120, H = 36, pad = 2;
  const min = Math.min(...data), range = (Math.max(...data) - min) || 1;
  const step = (W - pad * 2) / (data.length - 1);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / range);
  const points = data.map((v, i) => `${pad + i * step},${y(v)}`).join(' ');
  const fill = [...data.map((v, i) => `${pad + i * step},${y(v)}`), `${pad + (data.length - 1) * step},${H}`, `${pad},${H}`].join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9">
      <polygon points={fill} fill={color} fillOpacity={0.1} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, delta, icon, accent, spark }: {
  label: string; value: string; sub?: string; delta?: number;
  icon: React.ReactNode; accent: string; spark?: number[];
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500 tracking-wide uppercase">{label}</p>
          <p className="text-2xl font-bold text-neutral-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: accent + '18', color: accent }}>
          {icon}
        </div>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
            ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta)}% vs tahun lalu
          </div>
        </div>
      )}
      {spark && (
        <div className="-mx-1 -mb-2">
          <Sparkline data={spark} color={accent} />
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-4 rounded-full bg-emerald-500" />
      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest">{children}</h2>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function MainDashboard() {
  const {
    projectList,
    quotationList,
    employeeList,
    stockItemList: stockItems,
    customerInvoiceList,
    expenseList,
  } = useApp();
  const currentYear = new Date().getFullYear();
  const [compareYear, setCompareYear] = useState(String(currentYear - 1));
  const [remoteSummary, setRemoteSummary] = useState<ExecutiveDashboardSummary | null>(null);

  useEffect(() => {
    let active = true;
    void dashboardService.getExecutiveSummary()
      .then((summary) => {
        if (active) setRemoteSummary(summary);
      })
      // AppContext remains a read-only fallback when the user is not logged in
      // or the API is temporarily unavailable.
      .catch(() => {
        if (active) setRemoteSummary(null);
      });
    return () => { active = false; };
  }, []);

  const validInvoices = useMemo(
    () => customerInvoiceList.filter(inv => !['Draft', 'Rejected', 'Cancelled'].includes(inv.status)),
    [customerInvoiceList]
  );
  const validExpenses = useMemo(
    () => expenseList.filter(exp => !['Draft', 'Rejected'].includes(exp.status)),
    [expenseList]
  );

  const fallbackYearlyData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const year = currentYear - 5 + index;
    const revenue = validInvoices
      .filter(inv => new Date(inv.tanggal).getFullYear() === year)
      .reduce((sum, inv) => sum + Number(inv.totalNominal || 0), 0);
    const expense = validExpenses
      .filter(exp => new Date(exp.tanggal).getFullYear() === year)
      .reduce((sum, exp) => sum + Number(exp.totalNominal || exp.nominal || 0), 0);
    return {
      year: String(year),
      revenue,
      expense,
      profit: revenue - expense,
      projects: projectList.filter(project => {
        const date = project.startDate || project.endDate;
        return date && new Date(date).getFullYear() === year;
      }).length,
    };
  }), [currentYear, validInvoices, validExpenses, projectList]);

  const yearlyData = remoteSummary?.years?.length ? remoteSummary.years : fallbackYearlyData;

  const fallbackMonthlyData = useMemo(() => MONTHS.map((month, index) => ({
    month,
    revenue: validInvoices
      .filter(inv => {
        const date = new Date(inv.tanggal);
        return date.getFullYear() === currentYear && date.getMonth() === index;
      })
      .reduce((sum, inv) => sum + Number(inv.totalNominal || 0), 0),
    expense: validExpenses
      .filter(exp => {
        const date = new Date(exp.tanggal);
        return date.getFullYear() === currentYear && date.getMonth() === index;
      })
      .reduce((sum, exp) => sum + Number(exp.totalNominal || exp.nominal || 0), 0),
  })), [currentYear, validInvoices, validExpenses]);

  const monthlyData = remoteSummary?.monthly?.length
    ? remoteSummary.monthly.map((row) => ({ month: MONTHS[row.month - 1] || String(row.month), revenue: row.revenue, expense: row.expense }))
    : fallbackMonthlyData;

  const fallbackSegmentData = useMemo(() => {
    const totals = new Map<string, number>();
    validInvoices
      .filter(inv => new Date(inv.tanggal).getFullYear() === currentYear)
      .forEach(inv => totals.set(inv.customerName || 'Tanpa Customer', (totals.get(inv.customerName || 'Tanpa Customer') || 0) + Number(inv.totalNominal || 0)));
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (total === 0) return [{ name: 'Belum ada revenue', value: 1, color: '#d1d5db' }];
    return entries.map(([name, value], index) => ({
      name,
      value: Math.round((value / total) * 100),
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    }));
  }, [currentYear, validInvoices]);

  const segmentData = useMemo(() => {
    if (!remoteSummary?.segments?.length) return fallbackSegmentData;
    const total = remoteSummary.segments.reduce((sum, item) => sum + item.value, 0) || 1;
    return remoteSummary.segments.map((item, index) => ({
      name: item.name,
      value: Math.round((item.value / total) * 100),
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    }));
  }, [remoteSummary, fallbackSegmentData]);

  const activeProjects = remoteSummary?.metrics.activeProjects ?? projectList.filter(p => p.status === 'In Progress').length;
  const totalProjects = remoteSummary?.metrics.totalProjects ?? projectList.length;
  const employeeCount = remoteSummary?.metrics.employees ?? employeeList.length;
  const stockItemCount = remoteSummary?.metrics.stockItems ?? stockItems?.length ?? 0;
  const invoiceCount = remoteSummary?.metrics.invoiceCount ?? validInvoices.length;
  const latestYear = yearlyData[yearlyData.length - 1];
  const prevYear = yearlyData[yearlyData.length - 2];
  const revenueGrowth = pct(latestYear.revenue, prevYear.revenue);
  const profitGrowth = pct(latestYear.profit, prevYear.profit);
  const margin = latestYear.revenue > 0 ? Math.round((latestYear.profit / latestYear.revenue) * 100) : 0;
  const compareA = yearlyData.find(d => d.year === compareYear) ?? prevYear;

  const growthData = yearlyData.slice(1).map((d, i) => ({
    year: d.year,
    growth: pct(d.revenue, yearlyData[i].revenue),
  }));

  const sparkRevenue = yearlyData.map(d => d.revenue);
  const sparkProfit  = yearlyData.map(d => d.profit);

  return (
    <div className="min-h-full bg-neutral-50">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">

        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-600 tracking-widest uppercase font-semibold mb-1">PT Gema Teknik Perkasa</p>
            <h1 className="text-3xl font-bold text-neutral-800 leading-tight">Executive Dashboard</h1>
            <p className="text-neutral-400 text-sm mt-1">Data operasional PostgreSQL · Update {new Date(remoteSummary?.lastUpdatedAt || Date.now()).toLocaleDateString('id-ID')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Data
            </div>
            <Link to="/finance/executive-dashboard"
              className="flex items-center gap-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-500 text-xs px-3 py-1.5 rounded-full transition-colors shadow-sm">
              Detail Lengkap <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label={`Revenue ${currentYear} (YTD)`} value={`Rp ${fmtShort(latestYear.revenue)}`} sub={`${invoiceCount} invoice tercatat`}
            delta={revenueGrowth} icon={<DollarSign size={18} />} accent="#10b981" spark={sparkRevenue} />
          <KPICard label={`Net Profit ${currentYear}`} value={`Rp ${fmtShort(latestYear.profit)}`} sub={`Margin ${margin}%`}
            delta={profitGrowth} icon={<TrendingUp size={18} />} accent="#3b82f6" spark={sparkProfit} />
          <KPICard label="Proyek Aktif" value={`${activeProjects} / ${totalProjects}`}
            sub={`${quotationList.length} penawaran`} icon={<Briefcase size={18} />} accent="#ec4899" />
          <KPICard label="Total Karyawan" value={`${employeeCount}`}
            sub={`${stockItemCount} item stok`} icon={<Users size={18} />} accent="#f59e0b" />
        </div>

        {/* main chart grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <SectionLabel>Perbandingan Pendapatan Per Tahun</SectionLabel>
            <div className="flex flex-wrap gap-4 mb-4">
              {[
                { k: 'revenue', label: 'Pendapatan', color: '#10b981' },
                { k: 'expense', label: 'Pengeluaran', color: '#ef4444' },
                { k: 'profit',  label: 'Laba Bersih', color: '#3b82f6' },
              ].map(l => (
                <div key={l.k} className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="w-3 h-1.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
            <SVGBarChart
              data={yearlyData}
              keys={['revenue', 'expense', 'profit']}
              colors={['#10b981', '#ef4444', '#3b82f6']}
            />
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <SectionLabel>Komposisi Revenue</SectionLabel>
            <SVGDonut segments={segmentData} />
            <div className="space-y-2 mt-3">
              {segmentData.map(s => (
                <div key={`seg-label-${s.name}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                    <span className="text-xs text-neutral-500">{s.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-neutral-700">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* growth + monthly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <SectionLabel>Pertumbuhan Revenue YoY (%)</SectionLabel>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="w-3 h-1.5 rounded-full bg-emerald-500" />Naik</div>
              <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="w-3 h-1.5 rounded-full bg-red-400" />Turun</div>
            </div>
            <SVGGrowthChart data={growthData} />
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <SectionLabel>Trend Bulanan {currentYear}</SectionLabel>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="w-3 h-1.5 rounded-full bg-emerald-500" />Pendapatan</div>
              <div className="flex items-center gap-2 text-xs text-neutral-500"><span className="w-3 h-1.5 rounded-full bg-red-400" />Pengeluaran</div>
            </div>
            <SVGAreaChart data={monthlyData} />
          </div>
        </div>

        {/* year comparator */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <SectionLabel>Komparasi Detail Tahun</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Bandingkan dengan:</span>
              <select value={compareYear} onChange={e => setCompareYear(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 text-neutral-700 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-emerald-400 cursor-pointer">
                {yearlyData.slice(0, -1).map(d => (
                  <option key={d.year} value={d.year}>{d.year}</option>
                ))}
              </select>
              <span className="text-xs text-neutral-400">vs {currentYear}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue',     a: compareA.revenue, b: latestYear.revenue, color: '#10b981' },
              { label: 'Total Pengeluaran', a: compareA.expense, b: latestYear.expense, color: '#ef4444' },
              { label: 'Laba Bersih',       a: compareA.profit,  b: latestYear.profit,  color: '#3b82f6' },
            ].map(item => {
              const diff = pct(item.b, item.a);
              const up = diff >= 0;
              return (
                <div key={`cmp-${item.label}`} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">{item.label}</p>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5">{compareA.year}</p>
                      <p className="text-base font-semibold text-neutral-500">{fmtShort(item.a)}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg
                      ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {Math.abs(diff)}%
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400 mb-0.5">2026</p>
                      <p className="text-base font-bold" style={{ color: item.color }}>{fmtShort(item.b)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min((item.b / Math.max(item.a, item.b)) * 100, 100)}%`, background: item.color, opacity: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* historis table */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <SectionLabel>Ringkasan Historis Per Tahun</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Tahun', 'Revenue', 'Pengeluaran', 'Laba Bersih', 'Margin', 'Proyek', 'YoY Growth'].map(h => (
                    <th key={h} className="text-left py-3 pr-6 text-xs text-neutral-400 uppercase tracking-wide font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyData.map((d, i) => {
                  const growth = i === 0 ? null : pct(d.revenue, yearlyData[i - 1].revenue);
                  const mPct = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0;
                  const isCurrent = d.year === String(currentYear);
                  return (
                    <tr key={`row-${d.year}`}
                      className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${isCurrent ? 'bg-emerald-50/40' : ''}`}>
                      <td className="py-3.5 pr-6">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isCurrent ? 'text-emerald-600' : 'text-neutral-700'}`}>{d.year}</span>
                          {isCurrent && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-medium">YTD</span>}
                        </div>
                      </td>
                      <td className="py-3.5 pr-6 text-neutral-700 font-semibold">{fmtShort(d.revenue)}</td>
                      <td className="py-3.5 pr-6 text-neutral-400">{fmtShort(d.expense)}</td>
                      <td className="py-3.5 pr-6 text-blue-600 font-semibold">{fmtShort(d.profit)}</td>
                      <td className="py-3.5 pr-6">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${mPct >= 30 ? 'bg-emerald-50 text-emerald-600' : mPct >= 20 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {mPct}%
                        </span>
                      </td>
                      <td className="py-3.5 pr-6 text-neutral-500">{d.projects}</td>
                      <td className="py-3.5">
                        {growth === null ? <span className="text-neutral-300 text-xs">—</span> : (
                          <span className={`flex items-center gap-1 text-xs font-semibold ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(growth)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6">
          {[
            { label: 'General Ledger', path: '/finance/ledger',            icon: <BarChart3  size={16} />, color: '#10b981' },
            { label: 'Cash Flow',      path: '/finance/cashflow',          icon: <TrendingUp size={16} />, color: '#3b82f6' },
            { label: 'Proyek',         path: '/project',                   icon: <Briefcase  size={16} />, color: '#ec4899' },
            { label: 'Payroll',        path: '/hr/payroll',                icon: <Users      size={16} />, color: '#f59e0b' },
          ].map(nav => (
            <Link key={nav.path} to={nav.path}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 px-4 py-3.5 transition-all shadow-sm group">
              <div className="flex items-center gap-2.5">
                <span style={{ color: nav.color }}>{nav.icon}</span>
                <span className="text-sm text-neutral-600 group-hover:text-neutral-800 transition-colors">{nav.label}</span>
              </div>
              <ChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
