import React, { useEffect, useState, useMemo } from 'react';
import { ClipboardList, Truck, User, Briefcase, Plus, Search, X, MapPin, Calendar, Activity, ArrowRightLeft, ChevronRight, ShieldCheck } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Asset } from '../../contexts/AppContext';
import type { Employee, Project } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';

export default function InternalUsagePage() {
  const { assetList, employeeList, projectList, updateAsset, addAuditLog } = useApp();
  const [serverAssetList, setServerAssetList] = useState<Asset[] | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<Employee[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignForm, setAssignForm] = useState({
    assetId: '',
    operatorId: '',
    projectId: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) return payload as T[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: T[] }).items;
      }
      return [];
    };

    const loadPageData = async () => {
      try {
        const [assetsRes, employeesRes, projectsRes] = await Promise.all([
          api.get('/assets'),
          api.get('/employees'),
          api.get('/projects'),
        ]);
        if (!mounted) return;
        setServerAssetList(normalizeList<Asset>(assetsRes.data));
        setServerEmployeeList(normalizeList<Employee>(employeesRes.data));
        setServerProjectList(normalizeList<Project>(projectsRes.data));
      } catch {
        if (!mounted) return;
        setServerAssetList(null);
        setServerEmployeeList(null);
        setServerProjectList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveAssetList = serverAssetList ?? assetList;
  const effectiveEmployeeList = serverEmployeeList ?? employeeList;
  const effectiveProjectList = serverProjectList ?? projectList;

  const internalAssets = useMemo(() => {
    return effectiveAssetList.filter(a => a.status === 'In Use' || a.status === 'Available');
  }, [effectiveAssetList]);

  const filteredAssets = internalAssets.filter(a => 
    (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.assetCode || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeUsage = useMemo(() => effectiveAssetList.filter(a => a.status === 'In Use'), [effectiveAssetList]);

  const handleAssignUsage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.assetId || !assignForm.operatorId || !assignForm.projectId) {
      toast.error("Asset, Operator, dan Proyek wajib diisi!");
      return;
    }

    const asset = effectiveAssetList.find(a => a.id === assignForm.assetId);
    const operator = effectiveEmployeeList.find(e => e.id === assignForm.operatorId);
    const project = effectiveProjectList.find(p => p.id === assignForm.projectId);

    if (!asset || !operator || !project) return;

    updateAsset(asset.id, {
      status: 'In Use',
      operatorName: operator.name,
      projectName: project.namaProject,
      location: assignForm.location || project.customer,
      notes: assignForm.notes
    });

    addAuditLog({
      action: 'ASSET_ASSIGNED',
      module: 'Assets',
      details: `Unit ${asset.assetCode} ditugaskan ke ${operator.name} untuk proyek ${project.namaProject}`,
      status: 'Success'
    });

    toast.success(`Unit ${asset.name} berhasil ditugaskan.`);
    setShowAssignModal(false);
    setAssignForm({ assetId: '', operatorId: '', projectId: '', location: '', notes: '' });
  };

  const handleReleaseAsset = (asset: Asset) => {
    updateAsset(asset.id, {
      status: 'Available',
      operatorName: undefined,
      projectName: undefined
    });
    
    addAuditLog({
      action: 'ASSET_RELEASED',
      module: 'Assets',
      details: `Unit ${asset.assetCode} selesai tugas dan kembali ke pool`,
      status: 'Success'
    });
    
    toast.success(`Unit ${asset.name} telah dikembalikan ke pool.`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 italic">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Internal Asset Usage</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Fleet Deployment & Project Assignment</p>
          </div>
        </div>

        <button 
          onClick={() => setShowAssignModal(true)}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-3 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          Assign Unit to Project
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Activity size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Active Deployments</p>
              <p className="text-3xl font-black text-slate-900 italic">{activeUsage.length} <span className="text-xs text-slate-300 font-bold uppercase not-italic">Units</span></p>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <MapPin size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Project Sites</p>
              <p className="text-3xl font-black text-slate-900 italic">{new Set(activeUsage.map(a => a.projectName)).size} <span className="text-xs text-slate-300 font-bold uppercase not-italic">Locations</span></p>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <User size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Operators</p>
              <p className="text-3xl font-black text-slate-900 italic">{effectiveEmployeeList.length} <span className="text-xs text-slate-300 font-bold uppercase not-italic">Personnels</span></p>
           </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-600" /> Current Fleet Deployment
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text" 
              placeholder="Filter deployment..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase italic outline-none focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Unit Info</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Current Project</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Operator</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Location</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${asset.status === 'In Use' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
                          <Truck size={18} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-900 uppercase italic leading-none mb-1">{asset.name}</p>
                          <p className="text-[9px] font-black text-indigo-500 uppercase italic tracking-tighter">{asset.assetCode}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black text-slate-600 uppercase italic">
                      {asset.projectName || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       {asset.operatorName && <div className="w-6 h-6 bg-slate-200 rounded-full border border-white" />}
                       <span className="text-[10px] font-black text-slate-600 uppercase italic">
                         {asset.operatorName || '-'}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5 text-slate-400">
                       <MapPin size={10} />
                       <span className="text-[10px] font-bold uppercase italic">{asset.location || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter italic ${
                      asset.status === 'In Use' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {asset.status === 'In Use' ? 'Deployed' : 'In Pool'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {asset.status === 'In Use' ? (
                      <button 
                        onClick={() => handleReleaseAsset(asset)}
                        className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100"
                      >
                         Release Unit
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setAssignForm({...assignForm, assetId: asset.id});
                          setShowAssignModal(true);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md"
                      >
                         Assign Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-300 italic font-bold uppercase text-[10px]">No active deployments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Asset Deployment</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Assign Unit to Project / Personnel</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAssignUsage} className="p-10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Truck size={12} className="text-indigo-500" /> Select Unit
                    </label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={assignForm.assetId}
                      onChange={(e) => setAssignForm({...assignForm, assetId: e.target.value})}
                    >
                      <option value="">-- Choose Unit --</option>
                      {effectiveAssetList.filter(a => a.status === 'Available').map(a => (
                        <option key={a.id} value={a.id}>{a.assetCode} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <User size={12} className="text-indigo-500" /> Assigned Operator
                    </label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={assignForm.operatorId}
                      onChange={(e) => setAssignForm({...assignForm, operatorId: e.target.value})}
                    >
                      <option value="">-- Choose Personnel --</option>
                      {effectiveEmployeeList.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Briefcase size={12} className="text-indigo-500" /> Target Project
                    </label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={assignForm.projectId}
                      onChange={(e) => setAssignForm({...assignForm, projectId: e.target.value})}
                    >
                      <option value="">-- Choose Project --</option>
                      {effectiveProjectList.map(p => (
                        <option key={p.id} value={p.id}>{p.kodeProject} - {p.namaProject}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <MapPin size={12} className="text-indigo-500" /> Site / Detailed Location
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Area Cikande Phase 2"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={assignForm.location}
                      onChange={(e) => setAssignForm({...assignForm, location: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Calendar size={12} className="text-indigo-500" /> Start Date
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
                  >
                    <ShieldCheck size={18} /> Confirm Deployment
                    <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
