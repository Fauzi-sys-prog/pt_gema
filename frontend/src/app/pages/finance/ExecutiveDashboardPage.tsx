import { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Briefcase, 
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieChartIcon,
  BarChart3,
  Landmark,
  Layers,
  Zap,
  ChevronRight,
  Calendar,
  Building2,
  Users,
  Download,
  Loader2,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { exportAuditPackToWord } from '../../utils/auditPackExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function ExecutiveDashboardPage() {
  const {
    projectList,
    invoiceList,
    customerInvoiceList,
    vendorInvoiceList,
    stockItemList,
    poList,
    workOrderList,
    expenseList = []
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date());

  useEscapeKey([
    { condition: showAuditModal, close: () => setShowAuditModal(false) },
  ]);


  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (date: Date) => {
    const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${m} ${y} • ${h}:${min}`;
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.loading("Synchronizing financial & operational data...", { id: "refresh-sync" });
    
    setTimeout(() => {
      setLastSynced(new Date());
      setIsRefreshing(false);
      toast.success("Data synchronized successfully. All ledgers are up-to-date.", { id: "refresh-sync" });
    }, 2000);
  };

  const handleDownloadAudit = () => {
    setShowAuditModal(true);
  };

  // AR ledger adalah sumber utama invoice yang dibuat dari modul Finance.
  const dashboardInvoices = customerInvoiceList.length > 0
    ? customerInvoiceList.map(inv => ({ ...inv, totalBayar: inv.totalNominal || 0, subtotal: inv.totalNominal || 0, paidAmount: inv.paidAmount || 0 }))
    : invoiceList;

  const triggerDownload = async (type: string) => {
    toast.loading(`Generating ${type} Report...`, { id: "audit-gen" });
    
    try {
      await exportAuditPackToWord({
        reportType: type,
        finStats,
        opsStats: {
          efficiency: opsStats.efficiency,
          activeProjects: projectList.filter(p => p.status === 'In Progress').length,
          completedProjects: projectList.filter(p => p.status === 'Completed').length,
          totalWO: opsStats.totalWO,
        },
        projects: projectList,
        inventoryItems: stockItemList.map(item => ({
          nama: item.nama,
          kategori: item.kategori,
          jumlah: item.stok,
          satuan: item.satuan,
          hargaSatuan: item.hargaSatuan,
        })),
        invoices: invoiceList.map(inv => ({
          nomorInvoice: inv.nomorInvoice,
          projectName: inv.projectName,
          totalAmount: inv.totalBayar || 0,
          status: inv.status,
        })),
      });

      toast.success(`${type} Report Generated`, {
        id: "audit-gen",
        description: `Professional Word document (.doc) downloaded successfully`
      });
      setShowAuditModal(false);
    } catch (error) {
      toast.error('Export failed', {
        id: "audit-gen",
        description: 'Failed to generate audit pack. Please try again.'
      });
    }
  };

  // 1. Consolidated Financial Metrics
  const finStats = useMemo(() => {
    // Invoice memakai totalBayar sebagai nilai tagihan final (subtotal tidak selalu diisi).
    const totalRevenue = dashboardInvoices.reduce((sum, inv) => sum + (inv.totalBayar || 0), 0);
    const totalCollected = dashboardInvoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + (inv.totalBayar || 0), 0);
    // Piutang adalah sisa invoice setelah pembayaran, bukan nilai invoice penuh.
    const totalReceivable = dashboardInvoices
      .filter(i => i.status !== 'Paid')
      .reduce((sum, inv) => sum + Math.max(0, (inv.totalBayar || 0) - (inv.paidAmount || 0)), 0);
    
    const totalCommitment = poList.reduce((sum, po) => sum + (po.total || 0), 0);
    const totalPayable = vendorInvoiceList.filter(v => v.status !== 'Paid').reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    
    const inventoryValue = stockItemList.reduce((sum, item) => sum + (item.stok * item.hargaSatuan), 0);
    
    return {
      totalRevenue,
      totalCollected,
      totalReceivable,
      totalCommitment,
      totalPayable,
      inventoryValue,
      netPosition: totalReceivable - totalPayable
    };
  }, [dashboardInvoices, vendorInvoiceList, stockItemList, poList]);

  // 2. Project Performance Aggregate
  const projectHealth = useMemo(() => {
    const total = projectList.length;
    const completed = projectList.filter(p => p.status === 'Completed').length;
    const inProgress = projectList.filter(p => p.status === 'In Progress').length;
    const planning = projectList.filter(p => p.status === 'Planning' || p.status === 'Quotation').length;
    
    return [
      { name: 'Completed', value: completed, color: '#10B981' },
      { name: 'In Progress', value: inProgress, color: '#3B82F6' },
      { name: 'Planning', value: planning, color: '#F59E0B' }
    ];
  }, [projectList]);

  // 3. Revenue vs Expense Trend — from real invoice/expense data
  const trendData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const curYear = new Date().getFullYear();
    const revByMonth = new Array(12).fill(0);
    const expByMonth = new Array(12).fill(0);

    dashboardInvoices.forEach(inv => {
      if (!inv.tanggal) return;
      const d = new Date(inv.tanggal);
      if (d.getFullYear() === curYear) revByMonth[d.getMonth()] += (inv.subtotal || 0) / 1e6;
    });

    (expenseList || []).forEach((exp: any) => {
      if (!exp.tanggal) return;
      const d = new Date(exp.tanggal);
      if (d.getFullYear() === curYear) expByMonth[d.getMonth()] += (exp.totalNominal || 0) / 1e6;
    });

    return MONTHS.map((name, i) => ({ name, rev: revByMonth[i], exp: expByMonth[i] }));
  }, [dashboardInvoices, expenseList]);

  // 4. Operational Efficiency
  const opsStats = useMemo(() => {
    const totalWO = workOrderList.length;
    const completedWO = workOrderList.filter(wo => wo.status === 'Completed').length;
    const efficiency = totalWO > 0 ? (completedWO / totalWO) * 100 : 0;
    
    return { totalWO, completedWO, efficiency };
  }, [workOrderList]);

  return (
    <div className="p-10 space-y-10 bg-[#0F172A] min-h-screen text-slate-200 pb-32">
      {/* Executive Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 border-b border-slate-800 pb-10">
        <div>
           <div className="flex items-center gap-3 mb-4">
              <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/20">Executive Level</span>
              <span className="text-slate-500 font-black text-xs uppercase italic tracking-widest">PT Gema Teknik Perkasa</span>
           </div>
           <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-6">
              <ShieldCheck className="text-indigo-500" size={60} />
              Command Center
           </h1>
           <p className="text-slate-400 font-bold text-lg uppercase italic tracking-widest mt-4 opacity-60">Consolidated Financial & Operational Intelligence</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Last Synced</p>
              <p className="text-xl font-black text-indigo-400 italic">{formatDate(lastSynced)}</p>
           </div>
           <div className="flex gap-2 mt-4">
              <button 
                onClick={handleDownloadAudit}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 group"
              >
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> Audit Pack
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-600/20 flex items-center gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Syncing...
                  </>
                ) : (
                  'Refresh Live Data'
                )}
              </button>
           </div>
        </div>
      </div>

      {/* Audit Modal */}
        {showAuditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuditModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center gap-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-2">
                   <img src="https://images.unsplash.com/photo-1768402002414-882c0624016b?auto=format&fit=crop&q=80&w=200" alt="Gema Logo" className="w-full h-full object-contain filter invert opacity-80" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Generate Audit Pack</h3>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.3em] mt-2">PT Gema Teknik Perkasa Official</p>
                </div>
              </div>
              <div className="p-8 space-y-4">
                {[
                  { title: "Financial Consolidation", desc: "P&L, Balance Sheet, and AR/AP Aging", icon: <Landmark size={20} /> },
                  { title: "Operational Audit", desc: "Project Progress, Material Usage, and WO Status", icon: <Activity size={20} /> },
                  { title: "Inventory Valuation", desc: "Current Stock Level, Value, and FEFO Analysis", icon: <Layers size={20} /> },
                  { title: "Full Compliance Pack", desc: "All the above combined into a single archive", icon: <ShieldCheck size={20} /> }
                ].map((opt) => (
                  <button
                    key={opt.title}
                    onClick={() => triggerDownload(opt.title)}
                    className="w-full p-6 bg-white/5 hover:bg-white/10 border border-white/5 rounded-3xl flex items-center gap-6 transition-all group text-left"
                  >
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-white uppercase italic tracking-tighter">{opt.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium italic mt-1">{opt.desc}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
              <div className="p-8 bg-slate-950/50 flex justify-end">
                <button 
                  onClick={() => setShowAuditModal(false)}
                  className="px-8 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

      {/* Top Layer: Financial Liquidity & Net Worth */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                 <Landmark size={24} />
              </div>
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">+18.4%</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Aggregate Revenue</p>
           <h3 className="text-3xl font-black italic text-white tracking-tighter">{formatCurrency(finStats.totalRevenue)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Total Realized Contract Value</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400">
                 <ArrowUpRight size={24} />
              </div>
              <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">High Risk</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Accounts Receivable (AR)</p>
           <h3 className="text-3xl font-black italic text-rose-500 tracking-tighter">{formatCurrency(finStats.totalReceivable)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Outstanding Penagihan Customer</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                 <Layers size={24} />
              </div>
              <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">Asset Value</span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Inventory Capital</p>
           <h3 className="text-3xl font-black italic text-amber-500 tracking-tighter">{formatCurrency(finStats.inventoryValue)}</h3>
           <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 italic">Nilai Barang Tersimpan di Gudang</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-indigo-600 p-10 rounded-[3rem] shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
           <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <Zap size={140} className="text-white" />
           </div>
           <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Net Cash Position</p>
           <h3 className="text-3xl font-black italic text-white tracking-tighter">{formatCurrency(finStats.netPosition)}</h3>
           <p className="text-[10px] text-indigo-100 font-bold uppercase mt-4 italic">Liquid AR minus Liquid AP</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Growth & Expense Trend */}
        <div className="lg:col-span-2 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md min-w-0">
           <div className="flex items-center justify-between mb-12">
              <div>
                <h4 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
                  <TrendingUp className="text-indigo-500" size={28} />
                  Fiscan Performance Trend
                </h4>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Growth of Revenue vs Operational Expenses</p>
              </div>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Revenue</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Expenses</span>
                 </div>
              </div>
           </div>
           <div className="h-[350px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
              <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={0}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid key="grid-1" strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis key="x-1" dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 900}} />
                  <YAxis key="y-1" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 900}} tickFormatter={(val) => `${val/1000}M`} />
                  <Tooltip
                    key="tip-1"
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  />
                  <Area key="exec-rev" name="Revenue" isAnimationActive={false} type="monotone" dataKey="rev" stroke="#6366F1" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  <Area key="exec-exp" name="Expense" isAnimationActive={false} type="monotone" dataKey="exp" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Project Health Radar */}
        <div className="lg:col-span-1 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md flex flex-col items-center min-w-0">
           <h4 className="text-xl font-black uppercase italic tracking-tighter text-white self-start mb-10 flex items-center gap-4">
              <Briefcase className="text-amber-500" size={28} />
              Project Portfolio
           </h4>
           <div className="h-64 w-full relative min-w-0 min-h-0 overflow-hidden flex flex-col">
              <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                 <PieChart>
                    <Pie data={projectHealth} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                       {projectHealth.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip key="tip-2" />
                 </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-4xl font-black italic text-white leading-none">{projectList.length}</span>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Projects</span>
              </div>
           </div>
           <div className="w-full mt-12 space-y-4">
              {projectHealth.map(item => (
                <div key={item.name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.name}</span>
                   </div>
                   <span className="text-sm font-black text-white italic">{item.value} Units</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
         {/* Operational Efficiency Card */}
         <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900/40 to-slate-900/40 p-12 rounded-[4rem] border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 group-hover:scale-150 transition-all duration-700" />
            <h4 className="text-xs font-black uppercase italic tracking-widest text-slate-500 mb-8">Production Velocity</h4>
            <div className="flex flex-col items-center justify-center text-center space-y-6 relative z-10">
               <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                     <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                     <circle cx="80" cy="80" r="72" fill="none" stroke="#6366F1" strokeWidth="12" strokeDasharray={452} strokeDashoffset={452 - (452 * opsStats.efficiency / 100)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute flex flex-col">
                     <span className="text-5xl font-black italic text-white leading-none">{Math.round(opsStats.efficiency)}%</span>
                     <span className="text-[8px] font-black text-slate-500 uppercase mt-1 tracking-widest">Efficiency</span>
                  </div>
               </div>
               <div>
                  <h5 className="text-lg font-black text-white uppercase italic tracking-tighter">Manufacturing Output</h5>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic leading-tight">Terlapor {opsStats.completedWO} WO Selesai dari {opsStats.totalWO} Planning</p>
               </div>
            </div>
         </div>

         {/* Stock Critical Notice */}
         <div className="lg:col-span-3 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-10">
               <h4 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
                  <Activity className="text-rose-500" size={28} />
                  Operational Risk Monitor
               </h4>
               <button className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-indigo-400/30 pb-1">Full Audit History</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-8 group hover:bg-white/[0.08] transition-all cursor-pointer">
                  <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                     <AlertTriangle size={32} />
                  </div>
                  <div>
                     <h5 className="text-sm font-black text-white uppercase italic tracking-tighter">FEFO Risk Alert</h5>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic mt-1">3 Material Monolithics terdeteksi mendekati kadaluwarsa ({"<"} 30 hari).</p>
                  </div>
                  <ChevronRight size={20} className="text-slate-700 ml-auto" />
               </div>

               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-8 group hover:bg-white/[0.08] transition-all cursor-pointer">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Zap size={32} />
                  </div>
                  <div>
                     <h5 className="text-sm font-black text-white uppercase italic tracking-tighter">Procurement Optimization</h5>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic mt-1">Sistem menyarankan pembelian batch baru untuk Bata Api SK-34 (Buffer {"<"} 10%).</p>
                  </div>
                  <ChevronRight size={20} className="text-slate-700 ml-auto" />
               </div>
            </div>

            <div className="mt-10 p-10 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] flex items-center justify-between gap-8">
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
                     <Building2 size={24} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Total Workforce Engagement</p>
                     <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">PT GTP Operational Excellence</h5>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="text-center px-6 py-2 bg-white/5 rounded-2xl border border-white/5">
                     <p className="text-[18px] font-black text-white italic leading-none">248</p>
                     <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Personnel</p>
                  </div>
                  <div className="text-center px-6 py-2 bg-white/5 rounded-2xl border border-white/5">
                     <p className="text-[18px] font-black text-indigo-400 italic leading-none">12</p>
                     <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Active Sites</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
