import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom'; import { Calendar, BarChart, PieChart as PieChartIcon, Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Filter, Download, Activity, Maximize2, Wrench, Zap, Cpu, BookOpen } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from "sonner@2.0.3";
import api from '../../services/api';
import { 
  BarChart as ReBarChart,
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip
} from 'recharts';
import * as XLSX from 'xlsx';

export default function ProductionTimelinePage() {
  const { workOrderList, productionReportList, assetList } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Default to current month
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Default to current year
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [serverWorkOrders, setServerWorkOrders] = useState<any[]>([]);
  const [serverReports, setServerReports] = useState<any[]>([]);
  const [serverAssets, setServerAssets] = useState<any[]>([]);

  const fetchTimelineData = async (silent = true) => {
    setSyncing(true);
    try {
      const [woRes, reportRes, assetRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/production-reports'),
        api.get<Array<{ entityId: string; payload: any }>>('/assets'),
      ]);

      setServerWorkOrders(Array.isArray(woRes.data) ? woRes.data : []);
      setServerReports(Array.isArray(reportRes.data) ? reportRes.data : []);
      setServerAssets((assetRes.data || []).map((r) => ({ id: r.entityId, ...(r.payload || {}) })));
      if (!silent) toast.success(`Timeline ${months[selectedMonth]} diperbarui`);
    } catch {
      if (!silent) toast.error('Gagal refresh timeline produksi');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTimelineData(true);
  }, []);

  const effectiveWorkOrders = useMemo(
    () => {
      const byId = new Map<string, any>();
      for (const wo of workOrderList) byId.set(wo.id, wo);
      for (const wo of serverWorkOrders) byId.set(wo.id, wo);
      return Array.from(byId.values());
    },
    [serverWorkOrders, workOrderList]
  );
  const effectiveReports = useMemo(
    () => {
      const byId = new Map<string, any>();
      for (const report of productionReportList) byId.set(report.id, report);
      for (const report of serverReports) byId.set(report.id, report);
      return Array.from(byId.values());
    },
    [serverReports, productionReportList]
  );
  const effectiveAssets = useMemo(
    () => {
      const byId = new Map<string, any>();
      for (const asset of assetList) byId.set(asset.id, asset);
      for (const asset of serverAssets) byId.set(asset.id, asset);
      return Array.from(byId.values());
    },
    [serverAssets, assetList]
  );

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Real-time Analytics Calculations
  const analytics = useMemo(() => {
    // Start of selected month
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    
    // Filter reports for selected month
    const monthlyReports = effectiveReports.filter(r => {
      const reportDate = new Date(r.tanggal);
      return reportDate.getMonth() === selectedMonth && reportDate.getFullYear() === selectedYear;
    });

    // Filter WOs that are relevant for this month (active OR deadline in this month)
    const relevantWOs = effectiveWorkOrders.filter(wo => {
      const deadline = new Date(wo.deadline);
      const isDraft = wo.status === 'Draft';
      
      // Show if deadline is in this month OR if it's currently In Progress
      const deadlineInMonth = deadline.getMonth() === selectedMonth && deadline.getFullYear() === selectedYear;
      const isInProgress = wo.status === 'In Progress';
      
      return !isDraft && (deadlineInMonth || isInProgress);
    });

    // Work Days (Days with at least one LHP)
    const uniqueLhpDays = new Set(monthlyReports.map(r => r.tanggal));
    const effectiveDays = uniqueLhpDays.size;
    
    // Mocking some days off for the UI (Sundays + some Saturdays)
    let daysOff = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(selectedYear, selectedMonth, d).getDay();
      if (day === 0 || day === 6) daysOff++; // Sat & Sun
    }
    const workDays = daysInMonth - daysOff;

    const totalWOs = relevantWOs.length;
    const completedWOs = relevantWOs.filter(wo => wo.status === 'Completed').length;
    const percentage = totalWOs > 0 ? Math.round((completedWOs / totalWOs) * 100) : 0;

    return {
      daysInMonth,
      daysOff,
      workDays,
      effectiveDays,
      percentage,
      monthlyReports,
      relevantWOs
    };
  }, [effectiveWorkOrders, effectiveReports, selectedMonth, selectedYear]);

  // Chart Data: Daily Production Output from LHP for selected month
  const barData = useMemo(() => {
    const dailyOutput: Record<string, number> = {};
    analytics.monthlyReports.forEach(report => {
      const dateKey = new Date(report.tanggal).toLocaleDateString('id-ID', { day: '2-digit' });
      dailyOutput[dateKey] = (dailyOutput[dateKey] || 0) + report.outputQty;
    });

    const data = Object.entries(dailyOutput)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => parseInt(a.name) - parseInt(b.name));

    return data.length > 0 ? data : [{ name: 'N/A', qty: 0 }];
  }, [analytics.monthlyReports]);

  const handleExport = () => {
    try {
      // 1. Prepare data rows
      const rows = analytics.relevantWOs.map((wo, index) => [
        index + 1,
        wo.projectName,
        wo.itemToProduce,
        effectiveAssets.find(a => a.id === wo.machineId)?.name || wo.machineId || "-",
        wo.completedQty,
        new Date(wo.deadline).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        wo.status.toUpperCase()
      ]);

      // 2. Headers
      const headers = [
        "No", 
        "Project Name", 
        "Item", 
        "Machine/Asset", 
        "Completed", 
        "Deadline", 
        "Status"
      ];

      // 3. Create AOA (Array of Arrays)
      const aoa = [
        ["DETAIL MONITORING PRODUKSI"], // Title row (will be merged)
        headers,                         // Header row
        ...rows                          // Data rows
      ];

      // 4. Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 5. Apply Merges (Merge Title across all columns)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } } // Merge A1:I1
      ];

      // 6. Set column widths for better readability
      const wscols = [
        { wch: 5 },  // No
        { wch: 45 }, // Project Name
        { wch: 30 }, // Item
        { wch: 25 }, // Machine/Asset
        { wch: 10 }, // Target
        { wch: 10 }, // Completed
        { wch: 12 }, // Progress (%)
        { wch: 15 }, // Deadline
        { wch: 20 }  // Status
      ];
      ws['!cols'] = wscols;

      // 7. Create workbook and append sheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Production Report");

      // 8. Generate and download file
      XLSX.writeFile(wb, `Detail_Monitoring_Produksi_${months[selectedMonth]}_${selectedYear}.xlsx`);
      
      toast.success(`Laporan ${months[selectedMonth]} berhasil diekspor ke Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Gagal mengekspor laporan. Coba lagi nanti.");
    }
  };

  const handleExpandChart = () => {
    toast.info('Gunakan zoom browser untuk perbesar chart. Data chart sudah full-width.');
  };

  const pieData = [
    { name: 'Effective Days', value: analytics.effectiveDays || 1, color: '#10b981' },
    { name: 'Non-Effective Days', value: Math.max(0, analytics.workDays - analytics.effectiveDays) || 1, color: '#ef4444' }
  ];

  const calculateBOMProgress = (wo: any) => {
    if (!wo.bom || wo.bom.length === 0) return wo.status === 'Completed' ? 100 : 0;
    const totalItems = wo.bom.length;
    const totalProgress = wo.bom.reduce((acc: number, item: any) => {
      const itemProgress = Math.min(100, ((item.completedQty || 0) / item.qty) * 100);
      return acc + itemProgress;
    }, 0);
    return Math.round(totalProgress / totalItems);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'In Progress': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'QC': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Draft': return 'bg-slate-50 text-slate-500 border-slate-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Timeline & Production Tracker</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{months[selectedMonth]} {selectedYear} Performance Analytics</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter size={18} /> {months[selectedMonth]} {selectedYear}
            </button>
            
            {showMonthPicker && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={16}/></button>
                  <span className="text-sm font-black text-slate-900">{selectedYear}</span>
                  <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronRight size={16}/></button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {months.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => {
                        setSelectedMonth(idx);
                        setShowMonthPicker(false);
                      }}
                      className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${selectedMonth === idx ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                      {m.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link 
            to="/produksi/guide"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black shadow-lg transition-all"
          >
            <BookOpen size={18} /> Guide
          </Link>
          <button 
            onClick={() => fetchTimelineData(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60"
          >
            <Download size={18} /> {syncing ? 'Syncing...' : 'Refresh Data'}
          </button>
          <button 
            onClick={() => {
              window.print();
              toast.success('Timeline siap disimpan sebagai PDF.');
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 shadow-lg transition-all print:hidden"
          >
            <Printer size={18} /> Export PDF
          </button>
        </div>
      </div>

      {/* Workshop Machine Monitor - Traceability Section */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Cpu size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                <Zap className="text-amber-400 fill-amber-400" size={20} /> Real-Time Workshop Machine Monitor
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status Kapasitas Produksi & Utilisasi Aset</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase text-slate-400">In Use</span>
               </div>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-black uppercase text-slate-400">Available</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {effectiveAssets.filter(a => a.category === 'Machine' || a.category === 'Heavy Equipment').map((machine) => {
              // ACTUAL: Machine is physically working (based on LHP)
              const actualWO = effectiveWorkOrders.find(wo => {
                if (wo.status !== 'In Progress') return false;
                const lastReport = effectiveReports
                  .filter(r => r.activity.includes(wo.woNumber))
                  .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0];
                return lastReport?.machineNo === machine.id;
              });

              // PLANNED: Machine is reserved in WO but not yet started/reported
              const bookedWO = !actualWO ? effectiveWorkOrders.find(wo => 
                wo.machineId === machine.id && (wo.status === 'Draft' || wo.status === 'In Progress')
              ) : null;

              const displayWO = actualWO || bookedWO;

              return (
                <div key={machine.id} className={`border p-4 rounded-2xl transition-all group ${
                  actualWO ? 'bg-blue-600/10 border-blue-500/30' : 
                  bookedWO ? 'bg-amber-600/10 border-amber-500/30' : 
                  'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`p-2 rounded-lg ${
                      actualWO ? 'bg-blue-500/20 text-blue-400' : 
                      bookedWO ? 'bg-amber-500/20 text-amber-400' :
                      machine.status === 'Under Maintenance' ? 'bg-rose-500/20 text-rose-400' : 
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      <Cpu size={16} />
                    </div>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                      actualWO ? 'bg-blue-500 text-white' : 
                      bookedWO ? 'bg-amber-500 text-white' :
                      machine.status === 'Under Maintenance' ? 'bg-rose-500 text-white' : 
                      'bg-emerald-500 text-white'
                    }`}>
                      {actualWO ? 'RUNNING' : bookedWO ? 'BOOKED' : machine.status === 'Under Maintenance' ? 'MNT' : 'IDLE'}
                    </span>
                  </div>
                  <p className="text-[10px] font-black uppercase truncate text-white/90">{machine.name}</p>
                  <p className="text-[8px] font-bold text-white/40 uppercase mb-2">{machine.assetCode}</p>
                  
                  {displayWO ? (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className={`text-[8px] font-black uppercase leading-none mb-1 ${actualWO ? 'text-blue-400' : 'text-amber-400'}`}>
                        {actualWO ? 'Working On:' : 'Reserved For:'}
                      </p>
                      <p className="text-[9px] font-bold text-white/70 truncate uppercase">{displayWO.projectName}</p>
                      <p className="text-[7px] text-white/40 font-bold uppercase mt-1">{displayWO.woNumber}</p>
                    </div>
                  ) : machine.status === 'Under Maintenance' ? (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1">
                      <Wrench size={10} className="text-amber-400" />
                      <p className="text-[8px] font-black text-amber-400 uppercase italic">Maintenance</p>
                    </div>
                  ) : (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase italic">Standby</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Days In Month', value: analytics.daysInMonth, icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Days Off', value: analytics.daysOff, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Work Days', value: analytics.workDays, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Effective Days', value: analytics.effectiveDays, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Production %', value: analytics.percentage + '%', icon: BarChart, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center min-w-0">
            <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-xl flex items-center justify-center mb-3`}>
              <item.icon size={20} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1 h-8 flex items-center justify-center leading-tight">{item.label}</p>
            <p className="text-2xl font-black text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-w-0">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <BarChart size={18} className="text-blue-600" /> Production Output Scaling
            </h3>
            <button
              onClick={handleExpandChart}
              className="text-slate-400 hover:text-slate-900 transition-colors"
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="w-full p-4 overflow-hidden h-[350px] min-w-0 min-h-0 flex flex-col relative">
            <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={0}>
              <ReBarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                />
                <ReTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{payload[0].payload.name}</p>
                          <p className="text-sm font-black">{payload[0].value} <span className="text-[10px] font-bold text-slate-500 uppercase">Total Output</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="qty" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-w-0">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <PieChartIcon size={18} className="text-rose-500" /> Efficiency Share
            </h3>
          </div>
          <div className="w-full relative h-[350px] min-w-0 min-h-0 flex flex-col">
            <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+18px)] text-center">
               <p className="text-3xl font-black text-slate-900">{analytics.percentage}%</p>
               <p className="text-[10px] font-black text-emerald-600 uppercase">Productive</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-w-0">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Detail Monitoring Produksi</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">In Progress</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer / Item</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Alat & Mesin</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">BOM Progress</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Timeline</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Total Days</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analytics.relevantWOs.map((wo) => {
                const deadlineDate = new Date(wo.deadline);
                const startDate = new Date(deadlineDate);
                startDate.setDate(startDate.getDate() - 7);
                
                const diffTime = Math.abs(deadlineDate.getTime() - startDate.getTime());
                const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return (
                  <tr key={wo.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{wo.projectName}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{wo.itemToProduce}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {wo.machineId ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 leading-tight">
                            {effectiveAssets.find(a => a.id === wo.machineId)?.name || wo.machineId}
                          </span>
                          <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-0.5">Ready / Operational</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-400 italic">Manual / No Machine</span>
                          <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest mt-0.5">Non-Mechanical</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-700">{calculateBOMProgress(wo)}%</span>
                        <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${calculateBOMProgress(wo)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                         <span className="text-xs font-bold text-slate-500">{startDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                         <ChevronRight size={12} className="text-slate-300" />
                         <span className="text-xs font-bold text-slate-900">{deadlineDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center font-black text-blue-600">
                      {totalDays} Days
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(wo.status)}`}>
                        {wo.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {analytics.relevantWOs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Activity size={48} />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Belum ada aktivitas produksi aktif.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
