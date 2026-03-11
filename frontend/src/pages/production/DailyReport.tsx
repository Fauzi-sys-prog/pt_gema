import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

import { 
  ClipboardList, 
  Clock, 
  User as UserIcon, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  FileText,
  Settings
} from 'lucide-react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

// LHP Image from user
import lhpImage from 'figma:asset/1b31dc690fa09272d3ffca6b134fdfa5a13785f4.png';

export default function DailyReport() {
  const { productionReportList, assetList } = useApp();
  const [showRef, setShowRef] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [serverReports, setServerReports] = useState<any[]>([]);
  const [serverAssets, setServerAssets] = useState<any[]>([]);

  const fetchDailyData = async (silent = true) => {
    setSyncing(true);
    try {
      const [reportsRes, assetsRes] = await Promise.all([
        api.get('/production-reports'),
        api.get<Array<{ entityId: string; payload: any }>>('/assets'),
      ]);

      const mappedReports = (reportsRes.data || []).map((row) => ({
        id: row.entityId,
        ...(row.payload || {}),
      }));
      const mappedAssets = (assetsRes.data || []).map((row) => ({
        id: row.entityId,
        ...(row.payload || {}),
      }));

      setServerReports(mappedReports);
      setServerAssets(mappedAssets);
      if (!silent) toast.success('Daily report refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh daily report');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDailyData(true);
  }, []);

  const effectiveReports = useMemo(
    () => (serverReports.length > 0 ? serverReports : productionReportList),
    [serverReports, productionReportList]
  );
  const effectiveAssets = useMemo(
    () => (serverAssets.length > 0 ? serverAssets : assetList),
    [serverAssets, assetList]
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-rose-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl rotate-3">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Laporan Harian Produksi (LHP)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest italic opacity-70">Workshop Activity & Evidence Logs</p>
          </div>
        </div>
        <button 
          onClick={() => setShowRef(!showRef)}
          className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
        >
          <FileText size={16} className="text-blue-600" />
          <span>{showRef ? 'Sembunyikan Referensi' : 'Lihat Form Fisik'}</span>
        </button>
      </div>

      {showRef && (
        <div className="p-6 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 text-center">Dokumen Referensi Standar LHP PT Gema Teknik Perkasa</p>
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <ImageWithFallback src={lhpImage} className="w-full max-h-[600px] object-contain mx-auto bg-slate-50" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-50 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-rose-600 rounded-full"></div>
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Live Production Logs</span>
           </div>
           <button
             onClick={() => fetchDailyData(false)}
             disabled={syncing}
             className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 disabled:opacity-60"
           >
             {syncing ? 'Syncing...' : 'Refresh'}
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/20">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator / Worker</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity & Asset Unit</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duration</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Output</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {effectiveReports.length > 0 ? effectiveReports.map((report) => (
                <tr key={report.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-black text-xs border border-slate-200">
                        {String(report.workerName || "?").charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-sm leading-tight">{report.workerName}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Shift {report.shift || '1'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col max-w-xs">
                      <p className="text-sm text-slate-700 font-bold leading-tight">{report.activity}</p>
                      {report.machineNo && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Settings size={12} className="text-blue-500" />
                          <span className="text-[10px] font-black text-blue-600 uppercase italic">
                            {effectiveAssets.find(a => a.id === report.machineNo || a.assetCode === report.machineNo)?.name || report.machineNo}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold text-slate-600 italic">
                      <Clock size={12} />
                      {report.startTime} - {report.endTime}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-900 leading-none">{report.outputQty}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-black mt-1">{report.unit}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-tighter border border-emerald-100 shadow-sm">
                      <CheckCircle2 size={12} />
                      <span>{report.remarks || 'VERIFIED'}</span>
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <ClipboardList size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">Belum ada aktivitas terekam.</p>
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
