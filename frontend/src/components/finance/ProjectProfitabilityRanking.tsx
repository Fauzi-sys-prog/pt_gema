import React, { useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Target, Award, ChevronRight, Medal, Activity, User, AlertCircle, Zap } from 'lucide-react'; import { useApp } from '../contexts/AppContext';

export default function ProjectProfitabilityRanking() {
  const { projectList, invoiceList, stockMovementList, stockItemList } = useApp();

  const rankings = useMemo(() => {
    return projectList.map(project => {
      // 1. Revenue
      const revenue = invoiceList
        .filter(inv => inv.projectId === project.id && inv.status === 'Paid')
        .reduce((sum, inv) => sum + inv.totalBayar, 0);

      // 2. Costs (Material + Labor + Overhead)
      const materialCost = stockMovementList
        .filter(m => m.type === 'OUT' && ((m.projectName || '').toLowerCase() === (project.namaProject || '').toLowerCase() || (m.refNo || '').includes(project.id)))
        .reduce((sum, m) => {
          const item = stockItemList.find(s => s.kode === m.itemKode);
          return sum + (m.qty * (item?.hargaSatuan || 0));
        }, 0);

      const laborCost = (project.progress / 100) * (project.nilaiKontrak * 0.15);
      const overhead = project.nilaiKontrak * 0.05;
      const totalCost = materialCost + laborCost + overhead;
      
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      return {
        id: project.id,
        kode: project.kodeProject,
        nama: project.namaProject,
        pm: project.projectManager || 'Unassigned',
        revenue,
        profit,
        margin,
        status: project.status
      };
    })
    .filter(p => p.revenue > 0)
    .sort((a, b) => b.margin - a.margin);
  }, [projectList, invoiceList, stockMovementList, stockItemList]);

  const topPerformer = rankings[0];

  return (
    <div className="space-y-6">
      {/* Top Performer Spotlight */}
      {topPerformer && (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
           <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 rounded-full -ml-24 -mb-24 blur-3xl"></div>
           
           <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8 items-start md:items-center">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <Trophy size={40} />
                 </div>
                 <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 italic">MVP Project Performer</span>
                       <Zap size={12} className="text-amber-400 fill-amber-400" />
                    </div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">{topPerformer.nama}</h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
                       <User size={14} className="text-indigo-400" /> PM: {topPerformer.pm} • {topPerformer.kode}
                    </p>
                 </div>
              </div>

              <div className="flex gap-6 items-center">
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Margin</p>
                    <p className="text-4xl font-black italic text-emerald-400">{topPerformer.margin.toFixed(1)}%</p>
                 </div>
                 <div className="h-16 w-px bg-white/10 mx-2"></div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Realized Profit</p>
                    <p className="text-xl font-black italic">Rp {(topPerformer.profit / 1000000).toFixed(1)}M</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div>
               <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                  <Medal size={18} className="text-amber-500" /> Profitability Leaderboard
               </h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic">Ranking based on realized net margin %</p>
            </div>
            <button className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200">
               Full Analysis
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-white border-b border-slate-50">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Rank</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project / PM</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profit</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Net Margin</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Efficiency</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {rankings.map((p, i) => (
                    <tr key={p.id} className="group hover:bg-slate-50/80 transition-all">
                       <td className="px-8 py-6">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                             i === 0 ? 'bg-amber-100 text-amber-600' : 
                             i === 1 ? 'bg-slate-100 text-slate-600' : 
                             i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                          }`}>
                             #{i + 1}
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex flex-col">
                             <span className="font-black text-slate-900 uppercase italic tracking-tight group-hover:text-indigo-600 transition-colors">{p.nama}</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1 italic">
                                <User size={10} /> {p.pm}
                             </span>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <span className="text-xs font-black text-slate-600 italic">Rp {(p.revenue / 1000000).toFixed(1)}M</span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <span className={`text-xs font-black italic ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {p.profit >= 0 ? '+' : ''}Rp {(p.profit / 1000000).toFixed(1)}M
                          </span>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center">
                             <span className={`text-lg font-black italic ${p.margin >= 25 ? 'text-emerald-600' : p.margin >= 15 ? 'text-amber-500' : 'text-rose-500'}`}>
                                {p.margin.toFixed(1)}%
                             </span>
                             <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={`h-full ${p.margin >= 25 ? 'bg-emerald-500' : p.margin >= 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(100, p.margin * 2)}%` }}
                                ></div>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center justify-center">
                             {p.margin >= 25 ? (
                               <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[9px] font-black uppercase italic border border-emerald-100">
                                  <TrendingUp size={12} /> Optimal
                               </div>
                             ) : (
                               <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-3 py-1 rounded-full text-[9px] font-black uppercase italic border border-rose-100">
                                  <AlertCircle size={12} /> Review
                               </div>
                             )}
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
