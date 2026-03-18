import { useEffect, useMemo, useState } from 'react';
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
  RefreshCw
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
import { useApp } from '../../contexts/AppContext';
import type { Invoice, Quotation } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

type AnalyticsInvoice = {
  id: string;
  tanggal: string;
  total: number;
};

const toNum = (v: unknown) => Number(v ?? 0) || 0;

const normalizeInvoiceRows = (rows: any[]): AnalyticsInvoice[] => {
  return rows
    .map((row) => {
      const payload = row?.payload ?? {};
      const obj = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : row;
      if (!obj || typeof obj !== 'object') return null;
      const id = String((obj as any).id || row?.entityId || '').trim();
      if (!id) return null;
      const tanggal = String((obj as any).tanggal || (obj as any).invoiceDate || (obj as any).createdAt || '').trim();
      const total = toNum((obj as any).totalBayar || (obj as any).totalNominal || (obj as any).grandTotal || (obj as any).total);
      return { id, tanggal, total };
    })
    .filter(Boolean) as AnalyticsInvoice[];
};

export default function SalesAnalyticsPage() {
  const { invoiceList = [], quotationList = [], addAuditLog, currentUser } = useApp();
  const [serverInvoiceList, setServerInvoiceList] = useState<AnalyticsInvoice[] | null>(null);
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fallbackInvoices = useMemo(
    () =>
      (invoiceList || []).map((inv: Invoice) => ({
        id: String(inv.id || ''),
        tanggal: String(inv.tanggal || ''),
        total: toNum((inv as any).totalBayar || (inv as any).totalNominal),
      })),
    [invoiceList]
  );
  const effectiveInvoiceList = serverInvoiceList ?? fallbackInvoices;
  const effectiveQuotationList = serverQuotationList ?? quotationList;

  const fetchSalesAnalyticsSources = async () => {
    try {
      setIsRefreshing(true);
      const [invoiceRes, customerInvoiceRes, quotationRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/finance/customer-invoices'),
        api.get('/quotations'),
      ]);
      const invoiceRows = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
      const customerInvoiceRows = Array.isArray(customerInvoiceRes.data) ? customerInvoiceRes.data : [];
      const mergedInvoices = [
        ...normalizeInvoiceRows(invoiceRows),
        ...normalizeInvoiceRows(customerInvoiceRows),
      ];
      const invoices = Array.from(
        new Map(mergedInvoices.map((row) => [row.id, row])).values()
      );
      const quotations = Array.isArray(quotationRes.data) ? (quotationRes.data as Quotation[]) : [];
      setServerInvoiceList(invoices);
      setServerQuotationList(quotations);
    } catch {
      setServerInvoiceList(null);
      setServerQuotationList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSalesAnalyticsSources();
  }, []);

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

  const yearNow = new Date().getFullYear();
  const yearPrev = yearNow - 1;

  const monthlyData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const base = Array.from({ length: 12 }, (_, idx) => ({
      month: `${monthNames[idx]}'${String(yearNow).slice(-2)}`,
      omzet: 0,
      prevYear: 0,
      target: 0,
    }));

    const addByDate = (dateRaw: string, amount: number, targetKey: 'omzet' | 'prevYear') => {
      const dt = new Date(dateRaw);
      if (Number.isNaN(dt.getTime())) return;
      const year = dt.getFullYear();
      const month = dt.getMonth();
      if (month < 0 || month > 11) return;
      if (targetKey === 'omzet' && year === yearNow) base[month].omzet += amount;
      if (targetKey === 'prevYear' && year === yearPrev) base[month].prevYear += amount;
    };

    for (const inv of effectiveInvoiceList) {
      const amount = toNum(inv.total);
      if (!amount) continue;
      addByDate(inv.tanggal, amount, 'omzet');
      addByDate(inv.tanggal, amount, 'prevYear');
    }

    // fallback: kalau invoice masih minim, pakai quotation approved/sent sebagai proxy revenue plan
    const currentSum = base.reduce((acc, row) => acc + row.omzet, 0);
    if (currentSum === 0 && effectiveQuotationList.length > 0) {
      for (const q of effectiveQuotationList) {
        const amount = Number(q.grandTotal || 0);
        if (!amount) continue;
        const dateRaw = q.tanggal || q.createdAt;
        const dt = new Date(dateRaw);
        if (Number.isNaN(dt.getTime())) continue;
        if (dt.getFullYear() !== yearNow) continue;
        const month = dt.getMonth();
        base[month].omzet += amount;
      }
    }

    const avgMonthly = base.reduce((acc, row) => acc + row.omzet, 0) / 12;
    for (const row of base) {
      row.target = avgMonthly > 0 ? avgMonthly : 0;
    }

    return base;
  }, [effectiveInvoiceList, effectiveQuotationList, yearNow, yearPrev]);

  const totalSalesCurrentYear = monthlyData.reduce((acc, curr) => acc + curr.omzet, 0);
  const totalSalesPrevYear = monthlyData.reduce((acc, curr) => acc + curr.prevYear, 0);
  const growth = totalSalesPrevYear > 0 ? ((totalSalesCurrentYear - totalSalesPrevYear) / totalSalesPrevYear) * 100 : 0;
  const topMonth = monthlyData.reduce((best, row) => (row.omzet > best.omzet ? row : best), monthlyData[0] || { month: '-' });
  const currentMonthIndex = new Date().getMonth();
  const yearProgress = (currentMonthIndex + 1) / 12;
  const quotationPipeline = effectiveQuotationList
    .filter((q) => {
      const status = String(q.status || '').toLowerCase();
      return status === 'sent' || status === 'approved' || status === 'review';
    })
    .reduce((acc, q) => acc + toNum((q as any).grandTotal), 0);
  const annualTarget = totalSalesCurrentYear > 0
    ? Math.max(totalSalesCurrentYear / Math.max(yearProgress, 0.01), totalSalesCurrentYear * 1.2)
    : 0;
  const progressPct = annualTarget > 0 ? Math.min(100, (totalSalesCurrentYear / annualTarget) * 100) : 0;
  const hasAnalyticsData =
    effectiveInvoiceList.length > 0 ||
    effectiveQuotationList.length > 0 ||
    totalSalesCurrentYear > 0 ||
    totalSalesPrevYear > 0 ||
    quotationPipeline > 0;
  const weightedMargin = (() => {
    const entries = effectiveQuotationList
      .map((q) => {
        const total = toNum((q as any).grandTotal);
        const margin = toNum((q as any).marginPercent);
        return { total, margin };
      })
      .filter((x) => x.total > 0);
    if (!entries.length) return 0;
    const weighted = entries.reduce((acc, row) => acc + row.total * row.margin, 0);
    const total = entries.reduce((acc, row) => acc + row.total, 0);
    return total > 0 ? weighted / total : 0;
  })();

  const handleExportAnalytics = async () => {
    if (!monthlyData.length) {
      toast.info('Belum ada data analytics untuk diekspor.');
      return;
    }
    const rows = [
      ['Month', 'Revenue', 'PreviousYear', 'Target'],
      ...monthlyData.map((m) => [m.month, m.omzet, m.prevYear, m.target]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `sales-analytics-${dateKey}`,
      title: 'Sales Analytics Report',
      subtitle: `Tahun ${yearNow} | Revenue ${formatIDR(totalSalesCurrentYear)}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan sales: pertumbuhan ${growth.toFixed(1)}%, pipeline quotation ${formatIDR(quotationPipeline)}, progress target ${progressPct.toFixed(1)}%, weighted margin ${weightedMargin.toFixed(1)}%.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Sales Analytics',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `sales-analytics-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `sales-analytics-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'SALES_ANALYTICS_EXPORTED',
        module: 'Sales',
        details: `Export analytics (${monthlyData.length} bulan)`,
        status: 'Success',
      });
      toast.success('Sales analytics Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export sales analytics gagal.');
    }
  };

  const handleTimeFilterInfo = () => {
    toast.info(`Periode aktif: ${yearNow} dibandingkan ${yearPrev}.`);
  };

  const chartConfig = {
    omzet: {
      label: `Omzet ${yearNow}`,
      color: "#2563eb",
    },
    prevYear: {
      label: `Omzet ${yearPrev}`,
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
             onClick={fetchSalesAnalyticsSources}
             disabled={isRefreshing}
             className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
           >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
           </button>
           <button onClick={handleExportAnalytics} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Download size={18} /> Export Word + Excel
           </button>
           <button onClick={handleTimeFilterInfo} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all">
              <Filter size={18} /> Time Filter
           </button>
        </div>
      </div>

      {!hasAnalyticsData && (
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm p-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Sales Analytics</p>
          <h3 className="text-2xl font-black italic text-slate-900">No Data</h3>
          <p className="text-sm font-bold text-slate-500 uppercase italic mt-2">
            Belum ada invoice atau quotation aktif yang cukup untuk analisis penjualan.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: `Total Omzet ${yearNow}`, val: formatShortIDR(totalSalesCurrentYear), icon: DollarSign, color: 'text-blue-600', sub: 'Year to Date' },
          { label: 'Growth YoY', val: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, icon: growth >= 0 ? TrendingUp : TrendingDown, color: growth >= 0 ? 'text-emerald-600' : 'text-rose-600', sub: `Compared to ${yearPrev}` },
          { label: 'Avg Monthly Sales', val: formatShortIDR(totalSalesCurrentYear / 12), icon: Activity, color: 'text-orange-600', sub: 'Per Month' },
          { label: 'Top Performance', val: topMonth?.month || '-', icon: Award, color: 'text-purple-600', sub: 'Peak Month' },
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
               Yearly Revenue Comparison ({yearNow} vs {yearPrev})
            </h3>
            <div className="flex gap-4">
               <div className="flex items-center gap-4 mr-4">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-600 uppercase">{yearNow}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-slate-300 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-600 uppercase">{yearPrev}</span>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="w-full h-[300px] lg:h-[400px] relative min-w-0">
            <ChartContainer config={chartConfig} className="h-full">
               <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                     dataKey="month" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                     dy={10}
                  />
                  <YAxis 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                     tickFormatter={(value) => formatShortIDR(value)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                     dataKey="omzet" 
                     name="2025" 
                     fill="#2563eb" 
                     radius={[6, 6, 0, 0]} 
                     barSize={40} 
                  />
                  <Bar 
                     dataKey="prevYear" 
                     name="2024" 
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
                        <th className="px-6 py-4 text-right">Omzet {yearNow}</th>
                        <th className="px-6 py-4 text-right">Omzet {yearPrev}</th>
                        <th className="px-6 py-4 text-right">Selisih</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50 text-[11px] font-bold">
                     {monthlyData.map((row, i) => {
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 italic">Target Progress {yearNow}</h3>
               <div className="space-y-8">
                  <div>
                     <div className="flex justify-between items-end mb-2">
                        <span className="text-[14px] font-black italic">Annual Sales Target</span>
                        <span className="text-[10px] font-bold text-slate-400">{progressPct.toFixed(1)}% Achieved</span>
                     </div>
                     <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                          style={{ width: `${Math.max(2, progressPct)}%` }}
                        />
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 italic tracking-wider text-right">
                       Target: {formatIDR(annualTarget)}
                     </p>
                  </div>

                  <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                     <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Open Pipeline (Sent/Approved)</p>
                     <p className="text-xl font-black italic tracking-tighter">{formatIDR(quotationPipeline)}</p>
                     <p className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1 uppercase italic">
                        <TrendingUp size={12} /> Quotation to Invoice Candidate
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
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                       Weighted Margin: {weightedMargin.toFixed(1)}%
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
