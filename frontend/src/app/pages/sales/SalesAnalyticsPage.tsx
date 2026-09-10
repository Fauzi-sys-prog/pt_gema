import { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart as BarChartIcon, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  Filter, 
  Download, 
  Maximize2,
  ChevronRight,
  Target,
  Activity,
  Award,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart';
import { exportSalesAnalyticsToWord } from '../../utils/salesAnalyticsExport';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { api } from '../../services/api';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export default function SalesAnalyticsPage() {
  const { invoiceList = [], customerInvoiceList = [], projectList = [] } = useApp();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'project'>('monthly');
  const [isExporting, setIsExporting] = useState(false);
  const [analytics, setAnalytics] = useState<{
    currentYear: number;
    previousYear: number;
    currentMonthly: number[];
    previousMonthly: number[];
    monthlyTargets: number[];
    annualTarget: number;
    pipelineValue: number;
    activeProjectCount: number;
  } | null>(null);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatShortIDR = (val: number) => {
    if (val >= 1000000000) return (val / 1000000000).toFixed(1) + ' M';
    if (val >= 1000000) return (val / 1000000).toFixed(0) + ' Jt';
    return val.toLocaleString();
  };

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  useEffect(() => {
    api.request<typeof analytics>(`/sales/analytics?year=${currentYear}`)
      .then((result) => setAnalytics(result))
      .catch((error) => console.warn('[Sales Analytics] API belum tersedia:', error));
  }, [currentYear]);

  // Group invoices by year+month
  const data2025 = useMemo(() => {
    const curBuckets = new Array(12).fill(0);
    const prevBuckets = new Array(12).fill(0);

    const officialInvoices = customerInvoiceList.length > 0 ? customerInvoiceList : invoiceList;
    officialInvoices.forEach((inv: any) => {
      if (!inv.tanggal) return;
      const d = new Date(inv.tanggal);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const val = inv.totalNominal ?? inv.subtotal ?? 0;
      if (yr === currentYear) curBuckets[mo] += val;
      else if (yr === prevYear) prevBuckets[mo] += val;
    });

    return MONTH_LABELS.map((lbl, i) => ({
      month: `${lbl}'${String(currentYear).slice(2)}`,
      omzet: analytics?.currentMonthly?.[i] ?? curBuckets[i],
      prevYear: analytics?.previousMonthly?.[i] ?? prevBuckets[i],
      target: analytics?.monthlyTargets?.[i] ?? 0,
    }));
  }, [invoiceList, customerInvoiceList, currentYear, prevYear, analytics]);

  const totalSales2025 = data2025.reduce((acc, curr) => acc + curr.omzet, 0);
  const totalSalesPrev = data2025.reduce((acc, curr) => acc + curr.prevYear, 0);
  const growth = totalSalesPrev > 0 ? ((totalSales2025 - totalSalesPrev) / totalSalesPrev) * 100 : 0;

  const annualTarget = useMemo(() => {
    return analytics?.annualTarget || 0;
  }, [analytics]);

  const topMonth = useMemo(() => {
    const peak = data2025.reduce((best, row) => row.omzet > best.omzet ? row : best, data2025[0]);
    return peak ? peak.month : '-';
  }, [data2025]);

  const poForecast = useMemo(() => {
    if (analytics) return analytics.pipelineValue;
    return projectList
      .filter(p => ['In Progress', 'On Progress', 'Planning', 'Pending'].includes(p.status))
      .reduce((s, p) => s + (p.nilaiKontrak || 0), 0);
  }, [projectList, analytics]);

  const handleExportToWord = async () => {
    setIsExporting(true);
    try {
      await exportSalesAnalyticsToWord({
        data2025,
        totalSales2025,
        totalSales2024: totalSalesPrev,
        growth,
        avgMonthlySales: totalSales2025 / 12,
        topPerformanceMonth: topMonth,
        exportDate: new Date().toISOString(),
      });
      toast.success('Sales Analytics berhasil di-export ke Word!');
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error('Gagal export ke Word');
    } finally {
      setIsExporting(false);
    }
  };

  const chartConfig = {
    omzet: {
      label: "Omzet Tahun Ini",
      color: "#2563eb",
    },
    prevYear: {
      label: "Omzet Tahun Lalu",
      color: "#cbd5e1",
    },
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest italic">Revenue Intelligence</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic tracking-wider">PT Gema Teknik Perkasa</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Target className="text-blue-600" size={36} />
              Sales Performance Analytics
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Monitor Target, Omzet, dan Pertumbuhan Penjualan Perusahaan</p>
        </div>
        <div className="flex gap-2">
           <button 
              className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={handleExportToWord} 
              disabled={isExporting}
           >
              <Download size={18} /> 
              {isExporting ? 'Exporting...' : 'Export to Word'}
           </button>
           <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all">
              <Filter size={18} /> Time Filter
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: `Total Omzet ${currentYear}`, val: formatShortIDR(totalSales2025), icon: DollarSign, color: 'text-blue-600', sub: 'Year to Date' },
          { label: 'Growth YoY', val: totalSalesPrev > 0 ? (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%' : 'N/A', icon: growth >= 0 ? TrendingUp : TrendingDown, color: growth >= 0 ? 'text-emerald-600' : 'text-rose-600', sub: `vs ${prevYear}` },
          { label: 'Avg Monthly Sales', val: formatShortIDR(totalSales2025 / 12), icon: Activity, color: 'text-orange-600', sub: 'Per Month' },
          { label: 'Top Performance', val: topMonth, icon: Award, color: 'text-purple-600', sub: 'Peak Month' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm group">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                  <stat.icon size={20} />
               </div>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm min-w-0">
         <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
               <BarChartIcon className="text-blue-600" size={20} />
               Yearly Revenue Comparison ({currentYear} vs {prevYear})
            </h3>
            <div className="flex gap-4">
               <div className="flex items-center gap-4 mr-4">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-600 uppercase">{currentYear}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-slate-300 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-600 uppercase">{prevYear}</span>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="w-full h-[300px] lg:h-[400px] relative min-w-0">
            <ChartContainer config={chartConfig} className="h-full">
               <BarChart data={data2025} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                     key="x"
                     dataKey="month"
                     axisLine={false}
                     tickLine={false}
                     tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                     dy={10}
                  />
                  <YAxis
                     key="y"
                     axisLine={false}
                     tickLine={false}
                     tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                     tickFormatter={(value) => formatShortIDR(value)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                     key="bar-omzet"
                     dataKey="omzet"
                     name={String(currentYear)}
                     fill="#2563eb"
                     radius={[6, 6, 0, 0]}
                     barSize={40}
                  />
                  <Bar
                     key="bar-prevYear"
                     dataKey="prevYear"
                     name={String(prevYear)}
                     fill="#cbd5e1"
                     radius={[6, 6, 0, 0]}
                     barSize={40}
                  />
               </BarChart>
            </ChartContainer>
         </div>
      </div>

      {/* Detail Table Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
         <div className="lg:col-span-2 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b-2 border-slate-100 flex items-center justify-between">
               <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-900 italic">Rekapitulasi Omzet Per Bulan</h3>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100">
                        <th className="px-6 py-4">Bulan</th>
                        <th className="px-6 py-4 text-right">Omzet Tahun Ini</th>
                        <th className="px-6 py-4 text-right">Omzet Tahun Lalu</th>
                        <th className="px-6 py-4 text-right">Selisih</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50 text-[11px] font-bold">
                     {data2025.map((row, i) => {
                        const diff = row.omzet - row.prevYear;
                        const isUp = diff > 0;
                        return (
                           <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 text-slate-900 font-black uppercase">{row.month}</td>
                              <td className="px-6 py-4 text-right text-slate-900 font-black">{formatIDR(row.omzet)}</td>
                              <td className="px-6 py-4 text-right text-slate-400">{formatIDR(row.prevYear)}</td>
                              <td className={`px-6 py-4 text-right font-black ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                                 {isUp ? '+' : ''}{formatIDR(diff)}
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between">
            <div>
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 italic">Target Progress {currentYear}</h3>
               <div className="space-y-8">
                  <div>
                     {(() => {
                       const pct = annualTarget > 0 ? Math.min(100, (totalSales2025 / annualTarget) * 100) : 0;
                       return (
                         <>
                           <div className="flex justify-between items-end mb-2">
                              <span className="text-[14px] font-black italic">Annual Sales Target</span>
                              <span className="text-[10px] font-bold text-slate-400">{pct.toFixed(1)}% Achieved</span>
                           </div>
                           <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                              <div className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all duration-700" style={{ width: `${pct}%` }}></div>
                           </div>
                           <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 italic tracking-wider text-right">Target: {formatShortIDR(annualTarget)}</p>
                         </>
                       );
                     })()}
                  </div>

                  <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                     <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">PO Pipeline Aktif</p>
                     <p className="text-xl font-black italic tracking-tighter">{formatShortIDR(poForecast)}</p>
                     <p className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1 uppercase italic">
                        <TrendingUp size={12} /> Dari {analytics?.activeProjectCount ?? projectList.filter(p => ['In Progress', 'On Progress', 'Planning', 'Pending'].includes(p.status)).length} project aktif
                     </p>
                  </div>
               </div>
            </div>

            <div className="mt-12 pt-12 border-t border-slate-800">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                     <TrendingUp size={24} className="text-white" />
                  </div>
                  <div>
                     <p className="text-lg font-black italic tracking-tighter">Profitability Index</p>
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Efficiency Rate: 92%</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
