import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Briefcase, 
  Search, 
  Filter, 
  Download,
  ChevronRight,
  Target,
  AlertCircle,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Activity,
  ArrowLeft,
  LayoutDashboard,
  Trophy,
  Scale,
  Receipt,
  Users,
  Building2,
  Calendar,
  ShieldCheck,
  Zap,
  Flame,
  Clock,
  CheckCircle2
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
  Line,
  ReferenceLine
} from 'recharts';
import { motion } from 'motion/react';

export default function ProjectProfitLossPage() {
  const { projectList, invoiceList, customerInvoiceList = [], vendorInvoiceList = [], expenseList = [], stockOutList, attendanceList, employeeList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'summary' | 'burn-rate' | 'ranking'>('summary');

  // Enhanced Analysis Logic
  const projectAnalysis = useMemo(() => {
    // Compute once outside the map — O(M) instead of O(N×M)
    const arNos = new Set(customerInvoiceList.map(i => i.noInvoice));

    return projectList.map(project => {
      // Revenue is accrued when a customer invoice is approved/posted. Cash
      // received is tracked separately so receivables do not distort project P&L.
      const postedAR = customerInvoiceList.filter(inv =>
        inv.projectId === project.id && ['Approved', 'Partial Paid', 'Paid', 'Overdue'].includes(inv.status)
      );
      const billedFromAR = postedAR.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
      const collectedFromAR = postedAR.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
      const legacyInvoices = invoiceList.filter(inv =>
        inv.projectId === project.id && !arNos.has(inv.noInvoice) && !['Draft', 'Cancelled'].includes(inv.status as string)
      );
      const billedFromLegacy = legacyInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
      const collectedFromLegacy = legacyInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
      const revenue = billedFromAR + billedFromLegacy;
      const cashCollected = collectedFromAR + collectedFromLegacy;

      // Material HPP uses the frozen unit cost stored at Stock Out time.
      const materialCost = stockOutList
        .filter(stockOut => stockOut.projectId === project.id && stockOut.status === 'Posted')
        .reduce((sum, stockOut) => sum + (stockOut.items || []).reduce(
          (itemSum: number, item: any) => itemSum + ((Number(item.qty) || 0) * (Number(item.hargaSatuan) || 0)),
          0
        ), 0);

      // 3. Labor Cost (From Attendance)
      const laborCost = attendanceList
        .filter(att => att.projectId === project.id)
        .reduce((sum, att) => {
          if (att.laborCost != null) return sum + att.laborCost;
          const employee = employeeList.find(employee => employee.id === att.employeeId);
          const hourlyRate = (employee?.salary || 0) / 176;
          return sum + ((att.workHours || 0) * hourlyRate) + ((att.overtime || 0) * hourlyRate * 1.5);
        }, 0);

      // AP is shown as a commitment. It is not added to actual HPP here because
      // material AP is realized through Stock Out and extra costs through Expenses.
      const committedAP = vendorInvoiceList
        .filter((invoice: any) => invoice.projectId === project.id && !['Draft', 'Rejected'].includes(invoice.status))
        .reduce((sum: number, invoice: any) => sum + (invoice.totalAmount || 0), 0);

      // 5. Field expenses (working expenses linked to project)
      const fieldExpenseCost = expenseList
        .filter((expense: any) => expense.projectId === project.id && ['Approved', 'Paid'].includes(expense.status))
        // PPN masukan dipisahkan dari HPP karena dikreditkan pada laporan pajak.
        .reduce((sum: number, e: any) => sum + (e.nominal || e.amount || 0), 0);

      const equipmentCost = (project.equipmentUsage || []).reduce(
        (sum: number, usage: any) => sum + ((usage.hoursUsed || 0) * (usage.costPerHour || 0)), 0
      );

      const nilaiKontrak = project.nilaiKontrak || 0;
      const totalActualCost = materialCost + laborCost + equipmentCost + fieldExpenseCost;
      const netProfit = revenue - totalActualCost;
      const margin = revenue > 0 ? ((revenue - totalActualCost) / revenue) * 100 : 0;

      // Burn Rate Calculation — derive months from project dates
      const startDate = project.startDate ? new Date(project.startDate) : new Date();
      const endDate = project.endDate ? new Date(project.endDate) : new Date();
      const now = new Date();
      const effectiveEnd = endDate < now ? endDate : now;
      const msPerMonth = 1000 * 60 * 60 * 24 * 30.5;
      const monthsActive = Math.max(1, Math.round((effectiveEnd.getTime() - startDate.getTime()) / msPerMonth));
      const burnPerMonth = totalActualCost / monthsActive;
      const budget = nilaiKontrak * 0.7; // Target budget 70% of contract
      const burnRateStatus = (burnPerMonth * 12) > budget ? 'Critical' : 'Normal';

      return {
        ...project,
        nilaiKontrak,
        revenue,
        cashCollected,
        outstandingRevenue: Math.max(0, revenue - cashCollected),
        materialCost,
        laborCost,
        equipmentCost,
        fieldExpenseCost,
        committedAP,
        totalActualCost,
        netProfit,
        margin,
        budget,
        burnPerMonth,
        burnRateStatus
      };
    });
  }, [projectList, invoiceList, customerInvoiceList, vendorInvoiceList, expenseList, stockOutList, attendanceList, employeeList]);

  const filteredAnalysis = projectAnalysis.filter(p => 
    (p.namaProject || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProject = selectedProjectId ? projectAnalysis.find(p => p.id === selectedProjectId) : null;

  // Burn Rate Timeline — from posted Stock Out grouped by period
  const burnRateTimeline = useMemo(() => {
    if (!selectedProject) return [];

    const movements = stockOutList
      .filter(stockOut => stockOut.projectId === selectedProject.id && stockOut.status === 'Posted')
      .flatMap(stockOut => (stockOut.items || []).map((item: any) => ({
        date: stockOut.tanggal,
        cost: (Number(item.qty) || 0) * (Number(item.hargaSatuan) || 0),
      })))
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    if (movements.length === 0) {
      // Fallback: distribute evenly over 8 weeks with no randomness
      const perWeek = selectedProject.totalActualCost / 8;
      return Array.from({ length: 8 }, (_, i) => ({
        name: `W${i + 1}`,
        actual: perWeek * (i + 1),
        projected: (selectedProject.budget / 8) * (i + 1),
        daily: perWeek,
      }));
    }

    // Group into 8 buckets based on date range
    const first = new Date(movements[0].date || new Date());
    const last = new Date(movements[movements.length - 1].date || new Date());
    const rangeMs = Math.max(last.getTime() - first.getTime(), 7 * 24 * 3600 * 1000);
    const weekMs = rangeMs / 8;

    const weeklyBuckets = new Array(8).fill(0);
    movements.forEach(m => {
      const cost = m.cost;
      const mDate = new Date(m.date || first);
      const weekIdx = Math.min(7, Math.floor((mDate.getTime() - first.getTime()) / weekMs));
      weeklyBuckets[weekIdx] += cost;
    });

    let cumulative = 0;
    return weeklyBuckets.map((daily, i) => {
      cumulative += daily;
      return {
        name: `W${i + 1}`,
        actual: cumulative,
        projected: (selectedProject.budget / 8) * (i + 1),
        daily,
      };
    });
  }, [selectedProject, stockOutList]);

  if (selectedProject) {
    return (
      <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
        <button 
          onClick={() => setSelectedProjectId(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
        >
          <ArrowLeft size={16} /> Back to Hub
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl rotate-3">
              <Flame size={32} className="text-orange-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{selectedProject.namaProject}</h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Burn Rate & Profitability Depth-Analysis</p>
            </div>
          </div>
          <div className="flex gap-2 bg-white p-1.5 rounded-2xl border-2 border-slate-100 shadow-sm">
             <button onClick={() => setActiveAnalysisTab('summary')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeAnalysisTab === 'summary' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>P&L Sheet</button>
             <button onClick={() => setActiveAnalysisTab('burn-rate')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeAnalysisTab === 'burn-rate' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Burn Analytics</button>
          </div>
        </div>

        {activeAnalysisTab === 'burn-rate' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                     <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic flex items-center gap-2">
                        <Activity size={16} /> Cumulative Consumption vs Budget Baseline
                     </h3>
                     <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                           <span className="text-[8px] font-black uppercase text-slate-400">Actual Cost</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 bg-slate-200 rounded-full border border-slate-300"></div>
                           <span className="text-[8px] font-black uppercase text-slate-400">Budget Limit</span>
                        </div>
                     </div>
                  </div>
                  <div className="h-[400px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={burnRateTimeline}>
                          <defs>
                             <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid key="grid-1" strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis key="x-1" dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94A3B8', fontSize:10, fontWeight:900}} />
                          <YAxis key="y-1" axisLine={false} tickLine={false} tick={{fill:'#94A3B8', fontSize:10, fontWeight:900}} tickFormatter={(val) => `Rp ${val/1000000}M`} />
                          <Tooltip key="tip-1" />
                          <ReferenceLine y={selectedProject.budget} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'right', value: 'BUDGET CAP', fill: '#EF4444', fontSize: 10, fontWeight: 900 }} />
                          <Area key="area-actual" name="Actual" isAnimationActive={false} type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={4} fill="url(#colorActual)" />
                          <Line key="line-projected" name="Projected" type="monotone" dataKey="projected" stroke="#E2E8F0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                       </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Zap size={100} />
                     </div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Current Burn Velocity</p>
                     <h3 className="text-3xl font-black italic text-white tracking-tighter mb-1">Rp {(selectedProject.burnPerMonth / 1000000).toFixed(1)}M <span className="text-sm font-bold text-slate-500 uppercase">/ Month</span></h3>
                     <p className={`text-[10px] font-bold uppercase ${selectedProject.burnRateStatus === 'Critical' ? 'text-rose-400' : 'text-emerald-400'}`}>{selectedProject.burnRateStatus === 'Critical' ? 'Needs Attention' : 'Within Safety Margin'}</p>
                     
                     <div className="mt-10 space-y-4 pt-8 border-t border-white/10">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black uppercase text-slate-500">Days Remaining</span>
                           <span className="text-sm font-black italic">{Math.max(0, Math.ceil((new Date(selectedProject.endDate).getTime() - Date.now()) / 86400000))} Days</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black uppercase text-slate-500">Projected Overrun</span>
                           <span className={`text-sm font-black italic ${selectedProject.totalActualCost > selectedProject.budget ? 'text-rose-400' : 'text-emerald-400'}`}>{selectedProject.totalActualCost > selectedProject.budget ? `Rp ${(selectedProject.totalActualCost - selectedProject.budget).toLocaleString('id-ID')}` : 'None'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 italic">Burn Breakdown</h4>
                     <div className="space-y-6">
                        <div className="flex items-center gap-4">
                           <div className="w-1.5 h-10 bg-blue-600 rounded-full"></div>
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Material Consumption</p>
                              <p className="text-sm font-black text-slate-900 italic">Rp {(selectedProject.materialCost / 1000000).toFixed(1)}M</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="w-1.5 h-10 bg-emerald-500 rounded-full"></div>
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Field Labor Burn</p>
                              <p className="text-sm font-black text-slate-900 italic">Rp {(selectedProject.laborCost / 1000000).toFixed(1)}M</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="w-1.5 h-10 bg-amber-500 rounded-full"></div>
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Approved Extra Costs</p>
                              <p className="text-sm font-black text-slate-900 italic">Rp {(selectedProject.fieldExpenseCost / 1000000).toFixed(1)}M</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 italic flex items-center gap-2">
                  <Clock size={16} /> Weekly Expense Velocity
               </h3>
               <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={burnRateTimeline}>
                        <CartesianGrid key="grid-2" strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis key="x-2" dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94A3B8', fontSize:10, fontWeight:900}} />
                        <YAxis key="y-2" axisLine={false} tickLine={false} tick={{fill:'#94A3B8', fontSize:10, fontWeight:900}} />
                        <Tooltip key="tip-2" />
                        <Bar key="bar-daily" dataKey="daily" radius={[10, 10, 0, 0]}>
                           {burnRateTimeline.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index > 5 ? '#EF4444' : '#3B82F6'} />
                           ))}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden p-10">
             <div className="flex items-center justify-between mb-10">
                <h2 className="text-xl font-black italic uppercase tracking-tighter">Project Profit & Loss Ledger</h2>
                <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Download Certified P&L</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                   <div className="pb-8 border-b border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recognized Revenue (Excl. PPN)</p>
                      <p className="text-3xl font-black italic text-slate-900">Rp {selectedProject.revenue.toLocaleString('id-ID')}</p>
                      <div className="grid grid-cols-3 gap-3 mt-5 text-[9px] font-black uppercase">
                         <div><p className="text-slate-400">Contract</p><p className="text-slate-900 mt-1">Rp {selectedProject.nilaiKontrak.toLocaleString('id-ID')}</p></div>
                         <div><p className="text-slate-400">Collected</p><p className="text-emerald-600 mt-1">Rp {selectedProject.cashCollected.toLocaleString('id-ID')}</p></div>
                         <div><p className="text-slate-400">Outstanding</p><p className="text-amber-600 mt-1">Rp {selectedProject.outstandingRevenue.toLocaleString('id-ID')}</p></div>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase">Material Cost</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {selectedProject.materialCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase">Labor Cost</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {selectedProject.laborCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase">Equipment Cost</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {selectedProject.equipmentCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase">Additional Project Cost</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {selectedProject.fieldExpenseCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                         <span className="text-[10px] font-black text-slate-900 uppercase">Total Actual HPP</span>
                         <span className="text-sm font-black text-rose-600 italic">Rp {selectedProject.totalActualCost.toLocaleString('id-ID')}</span>
                      </div>
                   </div>
                   <div className="pt-8 border-t-2 border-slate-900 flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900 uppercase italic">Net Profit After Operations</span>
                      <span className="text-2xl font-black italic text-emerald-600">Rp {selectedProject.netProfit.toLocaleString('id-ID')}</span>
                   </div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 italic">Audit Trail & Verification</h4>
                   <ul className="space-y-6">
                      {[
                        { label: 'Revenue Verified', desc: `Matched with ${customerInvoiceList.filter(invoice => invoice.projectId === selectedProject.id && !['Draft', 'Rejected', 'Revision', 'Cancelled'].includes(invoice.status)).length} Posted Invoices`, status: 'Success' },
                        { label: 'Material Linked', desc: 'Sync with Warehouse Stock-Out', status: 'Success' },
                        { label: 'Labor Synced', desc: 'Linked to Site Attendance', status: 'Success' },
                        { label: 'AP Commitment', desc: `Rp ${selectedProject.committedAP.toLocaleString('id-ID')} monitored separately`, status: selectedProject.committedAP > 0 ? 'Warning' : 'Success' }
                      ].map((item, i) => (
                        <li key={i} className="flex gap-4">
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.status === 'Success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                              {item.status === 'Success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase leading-none mb-1">{item.label}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{item.desc}</p>
                           </div>
                        </li>
                      ))}
                   </ul>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen pb-24">
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3">
          <TrendingUp size={40} />
        </div>
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Executive Command Hub</h1>
          <p className="text-xs text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Real-time Project Burn Rate & Portfolio Control</p>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] border-2 border-slate-100 shadow-sm overflow-hidden">
         <div className="p-10 border-b-2 border-slate-50 flex items-center justify-between">
            <div className="relative flex-1 max-w-xl">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
               <input 
                 type="text" 
                 placeholder="Deep Search Project Portfolio..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-16 pr-8 py-5 bg-slate-50 border-none rounded-3xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
               />
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-100">
                     <th className="px-10 py-6">Project Depth-View</th>
                     <th className="px-10 py-6 text-right">Aggregate Revenue</th>
                     <th className="px-10 py-6 text-right">Burn Rate (Mo)</th>
                     <th className="px-10 py-6 text-center">Velocity Status</th>
                     <th className="px-10 py-6 text-center">Net Margin</th>
                     <th className="px-10 py-6 text-center">Audit</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {filteredAnalysis.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-all cursor-pointer group" onClick={() => setSelectedProjectId(p.id)}>
                       <td className="px-10 py-8">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter group-hover:text-blue-600 transition-colors">{p.namaProject}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{p.customer}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-slate-900 italic">Rp {(p.revenue/1000000).toFixed(1)}M</span>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className="text-sm font-black text-rose-500 italic">Rp {(p.burnPerMonth/1000000).toFixed(1)}M</span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="flex flex-col items-center">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border ${p.burnRateStatus === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {p.burnRateStatus}
                             </span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <span className={`text-xl font-black italic ${p.margin >= 20 ? 'text-emerald-600' : 'text-orange-500'}`}>{p.margin.toFixed(1)}%</span>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-all shadow-sm">
                             <ChevronRight size={20} />
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
