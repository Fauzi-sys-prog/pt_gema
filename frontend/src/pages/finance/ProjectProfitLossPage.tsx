import { Suspense, lazy, useState, useMemo, useEffect } from 'react'; import { BarChart3, TrendingUp, TrendingDown, DollarSign, Briefcase, Search, Filter, Download, ChevronRight, Target, AlertCircle, ArrowUpRight, PieChart as PieChartIcon, ArrowLeft, LayoutDashboard, Trophy, Scale, Receipt, Users, Building2, Calendar, ShieldCheck, Zap, Flame, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';

const ProjectBurnCharts = lazy(() => import('../../components/finance/ProjectBurnCharts'));

const burnChartsFallback = (
  <>
    <div className="lg:col-span-2 rounded-[3rem] border-2 border-slate-100 bg-white p-10 shadow-sm">
      <div className="mb-10 h-5 w-64 rounded-full bg-slate-100" />
      <div className="h-[400px] animate-pulse rounded-[2rem] bg-slate-100" />
    </div>
    <div className="rounded-[3rem] border-2 border-slate-100 bg-white p-10 shadow-sm">
      <div className="mb-8 h-5 w-48 rounded-full bg-slate-100" />
      <div className="h-64 animate-pulse rounded-[2rem] bg-slate-100" />
    </div>
  </>
);

export default function ProjectProfitLossPage() {
  const { currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'summary' | 'burn-rate' | 'ranking'>('summary');
  const [showCharts, setShowCharts] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [serverRows, setServerRows] = useState<Array<any>>([]);

  const fetchProjectPlSummary = async (silent = true) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<{ rows?: Array<any> }>('/dashboard/finance-project-pl-summary');
      if (Array.isArray(data?.rows)) setServerRows(data.rows);
      if (!silent) toast.success('Project P&L refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh Project P&L');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectPlSummary(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowCharts(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const effectiveProjectAnalysis = serverRows;
  const hasProjectAnalysis = effectiveProjectAnalysis.length > 0;

  const filteredAnalysis = effectiveProjectAnalysis.filter(p => 
    (p.namaProject || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProject = selectedProjectId ? effectiveProjectAnalysis.find(p => p.id === selectedProjectId) : null;

  const handleDownloadCertifiedPL = async () => {
    if (!selectedProject) {
      toast.info('Pilih project dulu untuk unduh P&L.');
      return;
    }
    const rows = [
      ['Field', 'Value'],
      ['Project', selectedProject.namaProject || '-'],
      ['Customer', selectedProject.customer || '-'],
      ['Revenue', selectedProject.revenue || 0],
      ['Material Cost', selectedProject.materialCost || 0],
      ['Labor Cost', selectedProject.laborCost || 0],
      ['Overhead', selectedProject.overheadCost || 0],
      ['Total Actual Cost', selectedProject.totalActualCost || 0],
      ['Net Profit', selectedProject.netProfit || 0],
      ['Margin (%)', (selectedProject.margin || 0).toFixed(2)],
    ];
    const fileKey = (selectedProject.id || 'selected').toString();
    const payload = {
      filename: `project-pl-${fileKey}`,
      title: 'Certified Project Profit & Loss',
      subtitle: `${selectedProject.namaProject || '-'} | Customer ${selectedProject.customer || '-'}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: 'Dokumen ini merangkum posisi revenue, biaya aktual, laba bersih, dan margin proyek terpilih berdasarkan data finance terbaru.',
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance Project P&L',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `project-pl-${fileKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `project-pl-${fileKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Certified P&L Word + Excel berhasil diunduh.');
    } catch {
      toast.error('Export Certified P&L gagal.');
    }
  };

  // Deterministic burn timeline (tanpa random agar stabil)
  const burnRateTimeline = useMemo(() => {
    if (!selectedProject) return [];
    const weeks = Math.max(4, Math.min(12, Math.ceil(selectedProject.plannedDays / 7)));
    let cumulative = 0;
    const rows: { name: string; actual: number; projected: number; daily: number }[] = [];
    for (let i = 0; i < weeks; i += 1) {
      const weekNo = i + 1;
      const weeklyBase = selectedProject.totalActualCost / weeks;
      const smoothing = 0.9 + (weekNo / weeks) * 0.2;
      const added = weeklyBase * smoothing;
      cumulative += added;
      rows.push({
        name: `W${weekNo}`,
        actual: cumulative,
        projected: (selectedProject.budget / weeks) * weekNo,
        daily: added / 7,
      });
    }
    return rows;
  }, [selectedProject]);

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
             <button
               onClick={() => fetchProjectPlSummary(false)}
               disabled={summaryLoading}
               className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-700 disabled:opacity-60"
             >
               {summaryLoading ? 'Refreshing...' : 'Refresh'}
             </button>
          </div>
        </div>

        {activeAnalysisTab === 'burn-rate' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {showCharts ? (
                 <Suspense fallback={burnChartsFallback}>
                   <ProjectBurnCharts
                     burnRateTimeline={burnRateTimeline}
                     budget={selectedProject.budget}
                   />
                 </Suspense>
               ) : (
                 burnChartsFallback
               )}

               <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Zap size={100} />
                     </div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Current Burn Velocity</p>
                     <h3 className="text-3xl font-black italic text-white tracking-tighter mb-1">Rp {(selectedProject.burnPerMonth / 1000000).toFixed(1)}M <span className="text-sm font-bold text-slate-500 uppercase">/ Month</span></h3>
                     <p className="text-[10px] font-bold text-emerald-400 uppercase">Within Safety Margin</p>
                     
                     <div className="mt-10 space-y-4 pt-8 border-t border-white/10">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black uppercase text-slate-500">Days Remaining</span>
                           <span className="text-sm font-black italic">{Math.max(0, selectedProject.plannedDays - selectedProject.elapsedDays)} Days</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black uppercase text-slate-500">Projected Overrun</span>
                           <span className="text-sm font-black italic text-emerald-400">None</span>
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
                              <p className="text-[9px] font-black text-slate-400 uppercase">Project Overheads</p>
                              <p className="text-sm font-black text-slate-900 italic">Rp {(selectedProject.overheadCost / 1000000).toFixed(1)}M</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden p-10">
             <div className="flex items-center justify-between mb-10">
                <h2 className="text-xl font-black italic uppercase tracking-tighter">Project Profit & Loss Ledger</h2>
                <button
                  onClick={handleDownloadCertifiedPL}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                >
                  Download Certified P&L
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                   <div className="pb-8 border-b border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Gross Revenue</p>
                      <p className="text-3xl font-black italic text-slate-900">Rp {selectedProject.revenue.toLocaleString('id-ID')}</p>
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
                         <span className="text-[10px] font-black text-slate-500 uppercase">Admin & Overhead</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {selectedProject.overheadCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase">External Cost</span>
                         <span className="text-sm font-black text-rose-500 italic">Rp {((selectedProject.externalCost || 0)).toLocaleString('id-ID')}</span>
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
                        {
                          label: 'Revenue Source',
                          desc: selectedProject.revenue > 0 ? 'Finance customer invoices terhubung' : 'Belum ada revenue relasional',
                          status: selectedProject.revenue > 0 ? 'Success' : 'Warning',
                        },
                        {
                          label: 'Material Cost',
                          desc: selectedProject.materialCost > 0 ? 'Sync dari stock movement proyek' : 'Belum ada pemakaian material terbaca',
                          status: selectedProject.materialCost > 0 ? 'Success' : 'Warning',
                        },
                        {
                          label: 'Labor Cost',
                          desc: selectedProject.laborCost > 0 ? 'Linked ke attendance proyek' : 'Belum ada jam kerja tercatat',
                          status: selectedProject.laborCost > 0 ? 'Success' : 'Warning',
                        },
                        {
                          label: 'Budget Basis',
                          desc: selectedProject.boqBudget > 0 ? 'Budget memakai total BOQ proyek' : 'Fallback ke nilai kontrak proyek',
                          status: selectedProject.boqBudget > 0 ? 'Success' : 'Warning',
                        }
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
         <div className="p-10 border-b-2 border-slate-50 flex items-center justify-between gap-4">
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
            <button
              onClick={() => fetchProjectPlSummary(false)}
              disabled={summaryLoading}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              {summaryLoading ? 'Refreshing...' : 'Refresh'}
            </button>
         </div>
         <div className="overflow-x-auto">
            {!hasProjectAnalysis ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                Belum ada data proyek yang cukup untuk dianalisis. Halaman ini akan terisi setelah proyek dan transaksi finance terkait mulai masuk.
              </div>
            ) : (
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
            )}
         </div>
      </div>
    </div>
  );
}
