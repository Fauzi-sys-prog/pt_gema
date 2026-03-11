import React, { useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Target, ChevronRight, ArrowUpRight, Medal, Activity, User, Building2, AlertCircle } from 'lucide-react'; import { useApp } from '../contexts/AppContext';

export default function ProjectRanking() {
  const { projectList, invoiceList, stockMovementList, stockItemList } = useApp();

  // Calculate profitability and efficiency for all projects
  const rankings = useMemo(() => {
    return projectList.map(project => {
      // 1. Revenue
      const revenue = invoiceList
        .filter(inv => inv.projectId === project.id)
        .reduce((sum, inv) => sum + inv.totalBayar, 0);

      // 2. Material Cost
      const materialCost = stockMovementList
        .filter(m => m.type === 'OUT' && ((m.projectName || '').toLowerCase() === (project.namaProject || '').toLowerCase() || (m.refNo || '').includes(project.id)))
        .reduce((sum, m) => {
          const item = stockItemList.find(s => s.kode === m.itemKode);
          const price = item?.hargaSatuan || 0;
          return sum + (m.qty * price);
        }, 0);

      // 3. Labor & Overhead (Estimated for simplicity in ranking)
      const estimatedCost = materialCost + (project.nilaiKontrak * 0.20); // 20% estimated labor/OH
      const profit = revenue - estimatedCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      // Efficiency Score: 0-100 based on progress vs budget status
      const materialBudget = project.boq?.reduce((sum: number, item: any) => sum + (item.qtyEstimate * (item.unitPrice || 0)), 0) || (project.nilaiKontrak * 0.4);
      const budgetEfficiency = materialBudget > 0 ? Math.max(0, 100 - (Math.max(0, materialCost - materialBudget) / materialBudget * 100)) : 100;

      return {
        id: project.id,
        kode: project.kodeProject,
        name: project.namaProject,
        customer: project.customer,
        pm: project.projectManager || 'N/A',
        revenue,
        profit,
        margin,
        efficiency: budgetEfficiency,
        status: project.status
      };
    })
    .filter(p => p.revenue > 0) // Only rank projects with actual revenue
    .sort((a, b) => b.margin - a.margin); // Rank by margin
  }, [projectList, invoiceList, stockMovementList, stockItemList]);

  const topPerformer = rankings[0];

  return (
    <div className="space-y-6">
      {/* Top Card */}
      {topPerformer && (
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex items-center gap-6">
               <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 rotate-6 group-hover:rotate-12 transition-all">
                  <Trophy size={40} />
               </div>
               <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-2 italic">Current Top Performer</p>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">{topPerformer.name}</h2>
                  <div className="flex items-center gap-4 mt-4">
                     <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">PM: {topPerformer.pm}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">{topPerformer.customer}</span>
                     </div>
                  </div>
               </div>
            </div>
            <div className="flex gap-6">
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Net Margin</p>
                  <p className="text-4xl font-black italic text-emerald-400 leading-none">{topPerformer.margin.toFixed(1)}%</p>
               </div>
               <div className="text-center px-6 border-l border-white/10">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Efficiency Score</p>
                  <p className="text-4xl font-black italic text-white leading-none">{topPerformer.efficiency.toFixed(0)}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Profitability Leaderboard</h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg">
               <Activity size={12} className="text-slate-400" />
               <span className="text-[9px] font-black text-slate-400 uppercase">Live Performance Data</span>
            </div>
         </div>

         <div className="divide-y divide-slate-50">
            {rankings.map((p, i) => (
              <div key={p.id} className="group p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-all">
                 <div className="flex items-center gap-6 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic shadow-sm transition-all group-hover:scale-110 ${
                       i === 0 ? 'bg-emerald-500 text-white' : 
                       i === 1 ? 'bg-blue-500 text-white' : 
                       i === 2 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                       {i === 0 ? <Medal size={20} /> : i + 1}
                    </div>
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded">{p.kode}</span>
                          <h4 className="text-sm font-black text-slate-900 uppercase italic leading-none">{p.name}</h4>
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{p.customer}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-12 px-8 border-x border-slate-100">
                    <div className="text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Net Profit</p>
                       <p className="text-xs font-black text-slate-900 italic">Rp {(p.profit / 1000000).toFixed(1)}M</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Margin %</p>
                       <div className="flex items-center gap-1">
                          <p className={`text-xs font-black italic ${p.margin >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                             {p.margin.toFixed(1)}%
                          </p>
                          {p.margin >= 25 ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-amber-500" />}
                       </div>
                    </div>
                    <div className="text-center hidden lg:block">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Budget Efficiency</p>
                       <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                          <div 
                             className={`h-full transition-all duration-1000 ${p.efficiency >= 90 ? 'bg-emerald-500' : p.efficiency >= 70 ? 'bg-blue-500' : 'bg-rose-500'}`}
                             style={{ width: `${p.efficiency}%` }}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all flex items-center gap-2 group/btn">
                       Analysis <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                 </div>
              </div>
            ))}

            {rankings.length === 0 && (
              <div className="py-20 text-center opacity-30">
                 <Target size={48} className="mx-auto mb-4" />
                 <p className="text-xs font-black uppercase italic tracking-widest">No commercial data recorded yet</p>
              </div>
            )}
         </div>

         <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
            <AlertCircle size={16} className="text-blue-500" />
            <p className="text-[10px] font-medium italic text-slate-500">
               Ranking dihitung berdasarkan realisasi invoice dikurangi estimasi biaya material & tenaga kerja (20% fix estimate).
            </p>
         </div>
      </div>
    </div>
  );
}
