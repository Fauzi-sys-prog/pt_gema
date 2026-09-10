import React, { useState, useMemo } from 'react';
import { 
  Search,
  Filter,
  ChevronRight,
  Clock,
  Box,
  Cpu,
  Download,
  Calendar,
  Layers,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { useApp, type ProductionTracker, type WorkOrder } from '../../contexts/AppContext';

export const ProductionTrackerPage: React.FC = () => {
  const { productionTrackerList, workOrderList, assetList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Merge WO data into tracker format for real-time view
  const woAsTrackers: ProductionTracker[] = useMemo(() => {
    return (workOrderList || []).map((wo: WorkOrder) => ({
      id: `wo-${wo.id}`,
      customer: wo.projectName,
      itemType: wo.itemToProduce,
      qty: wo.targetQty,
      startDate: wo.startDate || wo.deadline,
      finishDate: wo.endDate || wo.deadline,
      status: wo.status === 'Completed' ? 'Completed' : wo.status === 'In Progress' || wo.status === 'QC' ? 'In Progress' : 'In Progress',
      machineId: wo.machineId,
      woNumber: wo.woNumber,
      nomorSPK: wo.nomorSPK,
      priority: wo.priority,
    } as any));
  }, [workOrderList]);

  const allTrackers = useMemo(() => {
    // WO entries take priority; legacy productionTrackerList entries shown after
    return [...woAsTrackers, ...(productionTrackerList || [])];
  }, [woAsTrackers, productionTrackerList]);

  const filteredTracker = useMemo(() => {
    return allTrackers.filter(item => {
      const matchesSearch = (item.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.itemType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            ((item as any).woNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [allTrackers, searchTerm, filterStatus]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500 text-white';
      case 'Delayed': return 'bg-rose-500 text-white';
      case 'In Progress': return 'bg-blue-600 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  // Helper to calculate bar position (simplified for a 30-day month view)
  const getTimelinePosition = (start: string, finish: string) => {
    try {
      const startDate = new Date(start);
      const finishDate = new Date(finish);
      const dayStart = startDate.getDate();
      const duration = Math.max(1, Math.ceil((finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Map to percentage (1-31 days)
      const left = ((dayStart - 1) / 31) * 100;
      const width = (duration / 31) * 100;
      
      return { left: `${left}%`, width: `${width}%` };
    } catch (e) {
      return { left: '0%', width: '10%' };
    }
  };

  const currentMonthName = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
              <Layers size={20} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Production Tracker</h1>
          </div>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Clock size={12} className="text-blue-600" /> Real-time Workshop Monitoring & Delivery Timeline
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-900/20">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari Customer, Item, atau No. Work Order..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-400" 
          />
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          {['All', 'In Progress', 'Completed', 'Delayed'].map(s => (
            <button 
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tracker Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest border-r border-slate-800">Customer</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest border-r border-slate-800">Item Type</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-800">Qty</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-800">Start</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-800">Finish</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-800">Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-800">Duration</th>
                <th className="px-0 py-0 min-w-[300px]">
                  <div className="w-full h-full flex flex-col">
                    <div className="px-6 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
                      Execution Timeline • {currentMonthName}
                    </div>
                    <div className="flex h-6">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex-1 text-[8px] font-black text-slate-500 border-r border-slate-800 flex items-center justify-center">
                          W{i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filteredTracker || []).map(item => {
                const duration = Math.max(1, Math.ceil((new Date(item.finishDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24)));
                const timeline = getTimelinePosition(item.startDate, item.finishDate);
                const asset = (assetList || []).find(a => a.id === item.machineId);

                return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-6 border-r border-slate-50">
                      <p className="text-xs font-black text-slate-900 uppercase leading-tight">{item.customer}</p>
                      {(item as any).woNumber && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">{(item as any).woNumber}</span>
                          {(item as any).nomorSPK && <span className="text-[9px] font-black text-slate-400 uppercase">{(item as any).nomorSPK}</span>}
                        </div>
                      )}
                      {item.machineId && (
                         <div className="flex items-center gap-1.5 mt-1">
                            <Cpu size={10} className="text-blue-500" />
                            <span className="text-[9px] font-black text-blue-600/70 uppercase">{asset?.name || item.machineId}</span>
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-6 border-r border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-blue-500 transition-colors"></div>
                        <span className="text-[11px] font-bold text-slate-600 uppercase">{item.itemType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center border-r border-slate-50">
                      <span className="text-xs font-black text-slate-900">{item.qty}</span>
                    </td>
                    <td className="px-6 py-6 text-center border-r border-slate-50">
                      <span className="text-[10px] font-bold text-slate-500">{new Date(item.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                    </td>
                    <td className="px-6 py-6 text-center border-r border-slate-50">
                      <span className="text-[10px] font-black text-slate-900">{new Date(item.finishDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                    </td>
                    <td className="px-6 py-6 text-center border-r border-slate-50">
                      <span className={`inline-block px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center border-r border-slate-50">
                      <span className="text-[10px] font-black text-slate-400">{duration} <span className="text-[8px] uppercase">Days</span></span>
                    </td>
                    <td className="px-0 py-0 relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex">
                        <div className="flex-1 border-r border-slate-50"></div>
                        <div className="flex-1 border-r border-slate-50"></div>
                        <div className="flex-1 border-r border-slate-50"></div>
                        <div className="flex-1"></div>
                      </div>
                      
                      {/* Timeline Bar */}
                      <div className="relative h-16 w-full flex items-center px-4">
                        <div 
                          className={`h-4 rounded-full relative group/bar transition-all duration-700 hover:h-6 ${item.status === 'Completed' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : item.status === 'Delayed' ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-blue-600 shadow-lg shadow-blue-600/20'}`}
                          style={{ 
                            left: timeline.left, 
                            width: timeline.width,
                          }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {duration} Hari Pengerjaan
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Stats Summary */}
      {(() => {
        const total = allTrackers.length;
        const completed = allTrackers.filter(t => t.status === 'Completed').length;
        const inProgress = allTrackers.filter(t => t.status === 'In Progress').length;
        const onTimeRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const totalQty = allTrackers.reduce((s, t) => s + (t.qty || 0), 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
              <BarChart3 className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 group-hover:scale-110 transition-transform" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Completion Rate</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black">{onTimeRate}%</h3>
                <span className="text-emerald-400 text-xs font-bold mb-1">{completed} / {total} WO</span>
              </div>
              <div className="mt-6 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${onTimeRate}%` }} />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <Calendar className="absolute -right-4 -bottom-4 text-slate-50 w-32 h-32 group-hover:scale-110 transition-transform" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Work Orders</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black text-slate-900">{inProgress}</h3>
                <span className="text-slate-400 text-xs font-bold mb-1 uppercase">In Progress</span>
              </div>
              <p className="mt-4 text-[10px] font-bold text-slate-500 uppercase italic">{total} WO total terdaftar</p>
            </div>

            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
              <Box className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 group-hover:scale-110 transition-transform" />
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Total Target Produksi</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black">{totalQty.toLocaleString('id-ID')}</h3>
                <span className="text-blue-100 text-[10px] font-bold mb-1 uppercase tracking-tighter">Unit</span>
              </div>
              <button className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:gap-3 transition-all">
                Lihat Semua WO <ArrowRight size={14} />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const TrendingUp = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
