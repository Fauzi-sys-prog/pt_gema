import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { toast } from 'sonner@2.0.3';
import { 
  Calendar, 
  Clock, 
  ClipboardCheck, 
  BarChart3, 
  GanttChart, 
  Layers,
  Search,
  Plus
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export const ProductionPage: React.FC = () => {
  const { productionReportList, productionTrackerList } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'lhp' | 'tracker'>('lhp');
  const [syncing, setSyncing] = useState(false);
  const [serverReports, setServerReports] = useState<any[]>([]);
  const [serverTrackers, setServerTrackers] = useState<any[]>([]);

  const fetchProductionData = async (silent = true) => {
    setSyncing(true);
    try {
      const [reportsRes, trackersRes] = await Promise.all([
        api.get('/production-reports'),
        api.get('/production-trackers'),
      ]);

      setServerReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      setServerTrackers(Array.isArray(trackersRes.data) ? trackersRes.data : []);
      if (!silent) toast.success('Production data refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh production data');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchProductionData(true);
  }, []);

  const effectiveReports = useMemo(
    () => (serverReports.length > 0 ? serverReports : productionReportList),
    [serverReports, productionReportList]
  );
  const effectiveTrackers = useMemo(
    () => (serverTrackers.length > 0 ? serverTrackers : productionTrackerList),
    [serverTrackers, productionTrackerList]
  );

  const handleInputLHPBaru = () => {
    toast.info('Input LHP baru dilakukan dari menu Production Report (detail form).');
  };

  return (
    <div className="p-8 mt-16 ml-64 min-h-screen bg-slate-50">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Workshop Control Center</h1>
          <p className="text-slate-500 font-medium">Manajemen Laporan Harian Produksi & Monitoring Project</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => fetchProductionData(false)}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase transition-all text-slate-500 hover:text-slate-700 disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
          <button 
            onClick={() => setActiveSubTab('lhp')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'lhp' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Laporan Harian (LHP)
          </button>
          <button 
            onClick={() => setActiveSubTab('tracker')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'tracker' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Production Tracker
          </button>
        </div>
      </div>

      {activeSubTab === 'lhp' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 text-blue-600 mb-2">
                   <Clock size={20} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Shift 1 Active</span>
                </div>
                <p className="text-2xl font-black text-slate-900">08:00 - 17:00</p>
                <p className="text-xs text-slate-500 font-bold mt-1">Total Output Hari Ini: 4,500 Pcs</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 text-emerald-600 mb-2">
                   <ClipboardCheck size={20} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Technicians Logged</span>
                </div>
                <p className="text-2xl font-black text-slate-900">4 Workers</p>
                <p className="text-xs text-slate-500 font-bold mt-1">Soleh, Deni, Nin, Sarji</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center border-dashed">
                <button onClick={handleInputLHPBaru} className="flex items-center space-x-2 text-blue-600 font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
                   <Plus size={18} />
                   <span>Input LHP Baru</span>
                </button>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Daily Production Log (LHP20052024)</h3>
               <span className="text-[10px] font-bold text-slate-400 italic">Monday, May 20, 2024</span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Nama Pekerja</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Kegiatan Pekerjaan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Jam Kerja</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Output</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {effectiveReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                       <p className="font-bold text-slate-800 text-sm">{report.workerName}</p>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                       <p className="text-xs text-slate-600 leading-relaxed">{report.activity}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-slate-900">{report.startTime} - {report.endTime}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Shift {report.shift}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <p className="font-black text-slate-900 text-sm">{report.outputQty.toLocaleString()}</p>
                       <p className="text-[9px] text-slate-400 font-bold uppercase">{report.unit}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-widest">
                          {report.remarks || 'Selesai'}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">Timeline Production PT Gema Teknik</h3>
                <div className="flex items-center space-x-4">
                   <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div><span className="text-[9px] font-bold text-slate-500">Effective Days</span></div>
                   <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-rose-500 rounded"></div><span className="text-[9px] font-bold text-slate-500">Non Effective</span></div>
                </div>
             </div>
             
             <div className="min-w-[800px]">
                <div className="grid grid-cols-[200px_1fr] border border-slate-100 rounded-xl overflow-hidden shadow-inner bg-slate-50">
                   <div className="p-4 border-r border-slate-100 font-black text-[10px] text-slate-400 uppercase">Customer & Item</div>
                   <div className="p-4 grid grid-cols-5 gap-1 text-center font-black text-[10px] text-slate-400 uppercase">
                      <div>Week 1</div><div>Week 2</div><div>Week 3</div><div>Week 4</div><div>Week 5</div>
                   </div>
                </div>
                {effectiveTrackers.map((track) => (
                   <div key={track.id} className="grid grid-cols-[200px_1fr] border-b border-slate-50 bg-white hover:bg-slate-50/50">
                      <div className="p-4 border-r border-slate-50">
                         <p className="text-[10px] font-black text-blue-600 truncate">{track.customer}</p>
                         <p className="text-[9px] text-slate-500 font-medium truncate">{track.itemType}</p>
                      </div>
                      <div className="p-4 grid grid-cols-5 gap-2">
                         <div className="h-6 bg-slate-100 rounded-md relative group">
                            {track.status === 'Completed' && <div className="absolute inset-0 bg-emerald-500/30 rounded-md border border-emerald-500/50 flex items-center justify-center text-[10px] font-black text-emerald-700">80%</div>}
                         </div>
                         <div className="h-6 bg-slate-100 rounded-md"></div>
                         <div className="h-6 bg-slate-100 rounded-md"></div>
                         <div className="h-6 bg-slate-100 rounded-md"></div>
                         <div className="h-6 bg-slate-100 rounded-md"></div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4">Production Tracker Status</h3>
                <div className="space-y-4">
                   {effectiveTrackers.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                         <div className="flex-1">
                            <p className="font-bold text-slate-900">{item.customer}</p>
                            <p className="text-[10px] text-slate-500">{item.itemType}</p>
                         </div>
                         <div className="text-right">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black">{item.status}</span>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">{item.totalDays} Effective Days</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center text-center">
                <BarChart3 size={48} className="text-blue-100 mb-4" />
                <h4 className="font-black text-slate-800 uppercase tracking-tight">Production Analytics</h4>
                <p className="text-xs text-slate-500 mt-2">Visualisasi KPI produksi per bulan akan muncul di sini (Image 4 format).</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
