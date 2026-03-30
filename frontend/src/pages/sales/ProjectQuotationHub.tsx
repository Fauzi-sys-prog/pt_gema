import { useEffect, useMemo, useState } from 'react';
import { 
  Calculator, 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Layers,
  ChevronRight,
  Plus,
  Search,
  LayoutDashboard,
  RefreshCw
} from 'lucide-react';
import PenawaranPage from './PenawaranPage';
import RABProjectPage from './RABProjectPage';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import type { DataCollection, Project } from '../../contexts/AppContext';
import type { Quotation } from '../../types/quotation';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { subscribeDataSync } from '../../services/dataSyncBus';

export default function ProjectQuotationHub() {
  const [activeMode, setActiveMode] = useState<'commercial' | 'technical'>('commercial');
  const [searchParams, setSearchParams] = useSearchParams();
  const { quotationList = [], dataCollectionList = [], projectList = [] } = useApp();
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const [serverDataCollectionList, setServerDataCollectionList] = useState<DataCollection[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveQuotationList = serverQuotationList ?? quotationList;
  const effectiveDataCollectionList = serverDataCollectionList ?? dataCollectionList;
  const effectiveProjectList = serverProjectList ?? projectList;

  const fetchHubSources = async () => {
    try {
      setIsRefreshing(true);
      const [quotationRes, dataCollectionRes, projectRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/data-collections'),
        api.get('/projects'),
      ]);
      const quotations = Array.isArray(quotationRes.data) ? (quotationRes.data as Quotation[]) : [];
      const dataCollections = Array.isArray(dataCollectionRes.data) ? (dataCollectionRes.data as DataCollection[]) : [];
      const projects = Array.isArray(projectRes.data) ? (projectRes.data as Project[]) : [];
      setServerQuotationList(quotations);
      setServerDataCollectionList(dataCollections);
      setServerProjectList(projects);
    } catch {
      setServerQuotationList(null);
      setServerDataCollectionList(null);
      setServerProjectList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'technical' || mode === 'commercial') {
      setActiveMode(mode);
    }
    fetchHubSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeDataSync(() => {
      if (!isRefreshing) {
        void fetchHubSources();
      }
    });
    return unsubscribe;
  }, [isRefreshing]);

  const setMode = (mode: 'commercial' | 'technical') => {
    setActiveMode(mode);
    const next = new URLSearchParams(searchParams);
    next.set('mode', mode);
    setSearchParams(next, { replace: true });
  };

  const hubStats = useMemo(() => {
    const totalQuotations = effectiveQuotationList.length;
    const sentOrApproved = effectiveQuotationList.filter((q: any) => {
      const st = String(q?.status || "").toUpperCase();
      return st === "SENT" || st === "APPROVED";
    }).length;
    const conversionRate = totalQuotations > 0 ? Math.round((sentOrApproved / totalQuotations) * 100) : 0;

    const syncedSurveyCount = effectiveDataCollectionList.filter((d: any) => {
      const status = String(d?.status || "").toUpperCase();
      return status === "VERIFIED" || status === "COMPLETED";
    }).length;

    const pendingApprovals = effectiveProjectList.filter((p: any) => {
      const approval = String(p?.approvalStatus || "Pending").toUpperCase();
      const status = String(p?.status || "Planning").toUpperCase();
      return approval === "PENDING" && status !== "COMPLETED";
    }).length;

    return {
      conversionRate,
      syncedSurveyCount,
      pendingApprovals,
    };
  }, [effectiveQuotationList, effectiveDataCollectionList, effectiveProjectList]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 p-6 bg-slate-50 min-h-screen">
      {/* Premium Hub Header */}
      <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-30" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
              <Calculator size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Project Quotation Hub</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] italic">PT GTP Unified Sales & Engineering Center</p>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-[2rem] border-2 border-slate-100 shadow-inner w-full md:w-auto">
            <button
              onClick={fetchHubSources}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button 
              onClick={() => setMode('commercial')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeMode === 'commercial' 
                ? 'bg-white text-blue-600 shadow-xl border border-slate-200' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText size={16} /> Commercial View
            </button>
            <button 
              onClick={() => setMode('technical')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeMode === 'technical' 
                ? 'bg-white text-indigo-600 shadow-xl border border-slate-200' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Layers size={16} /> Technical View (RAB)
            </button>
          </div>
        </div>
      </div>

      {/* Integration Info Banner - Matching Figma Image 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-blue-200 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <Zap size={32} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Synced Data</p>
            <p className="text-lg font-black uppercase italic tracking-tight">{hubStats.syncedSurveyCount} Verified Surveys</p>
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-slate-300 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <ShieldCheck size={32} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Compliance</p>
            <p className="text-lg font-black uppercase italic tracking-tight">{hubStats.pendingApprovals} Pending Approvals</p>
          </div>
        </div>
        <div className="bg-emerald-500 p-8 rounded-[3rem] text-white shadow-2xl shadow-emerald-200 flex items-center gap-8 group hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center shadow-lg">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em] leading-tight mb-1">Performance</p>
            <p className="text-lg font-black uppercase italic tracking-tight">{hubStats.conversionRate}% Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMode}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {activeMode === 'commercial' ? <PenawaranPage /> : <RABProjectPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
