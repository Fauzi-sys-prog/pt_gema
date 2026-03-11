import React, { useEffect, useMemo, useState } from 'react';
import { Truck, MapPin, ChevronRight, Search, Filter, Clock, CheckCircle2, AlertCircle, MoreVertical, Navigation, Package, Calendar, User, ExternalLink, QrCode, X, Plus, Briefcase, Layers, Activity, UserCheck } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Project, SuratJalan } from '../../contexts/AppContext';
import type { Asset, AuditLog } from '../../contexts/AppContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function LogisticsCommandCenter() {
  const { suratJalanList, projectList, addSuratJalan, updateSuratJalan, addAuditLog, assetList, auditLogs = [], currentUser } = useApp();
  const [serverSuratJalanList, setServerSuratJalanList] = useState<SuratJalan[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverAssetList, setServerAssetList] = useState<Asset[] | null>(null);
  const [serverAuditLogs, setServerAuditLogs] = useState<AuditLog[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'In Transit' | 'Delivered'>('all');
  
  // Modals state
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  // New Pickup Form State
  const [newPickup, setNewPickup] = useState<Partial<SuratJalan>>({
    tanggal: new Date().toISOString().split('T')[0],
    deliveryStatus: 'Pending'
  });

  useEffect(() => {
    let mounted = true;
    const normalizeEntityRows = <T,>(rows: unknown): T[] => {
      if (!Array.isArray(rows)) return [];
      return rows.map((row: any) => {
        const payload = row?.payload;
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          return { id: row?.entityId || payload?.id, ...payload } as T;
        }
        return row as T;
      });
    };

    const loadPageData = async () => {
      try {
        const [sjRes, projectsRes, assetsRes, logsRes] = await Promise.all([
          api.get('/surat-jalan'),
          api.get('/projects'),
          api.get('/assets'),
          api.get('/audit-logs'),
        ]);
        if (!mounted) return;
        setServerSuratJalanList(normalizeEntityRows<SuratJalan>(sjRes.data));
        setServerProjectList(normalizeEntityRows<Project>(projectsRes.data));
        setServerAssetList(normalizeEntityRows<Asset>(assetsRes.data));
        setServerAuditLogs(normalizeEntityRows<AuditLog>(logsRes.data));
      } catch {
        if (!mounted) return;
        setServerSuratJalanList(null);
        setServerProjectList(null);
        setServerAssetList(null);
        setServerAuditLogs(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveSuratJalanList = useMemo(() => {
    const byId = new Map<string, SuratJalan>();
    // Server snapshot first, then local context as source-of-truth for latest in-session changes.
    for (const sj of serverSuratJalanList || []) byId.set(sj.id, sj);
    for (const sj of suratJalanList) byId.set(sj.id, sj);
    return Array.from(byId.values());
  }, [suratJalanList, serverSuratJalanList]);
  const effectiveProjectList = useMemo(() => {
    const byId = new Map<string, Project>();
    for (const p of serverProjectList || []) byId.set(p.id, p);
    for (const p of projectList) byId.set(p.id, p);
    return Array.from(byId.values());
  }, [projectList, serverProjectList]);
  const effectiveAssetList = useMemo(() => {
    const byId = new Map<string, Asset>();
    for (const a of serverAssetList || []) byId.set(a.id, a);
    for (const a of assetList) byId.set(a.id, a);
    return Array.from(byId.values());
  }, [assetList, serverAssetList]);
  const effectiveAuditLogs = useMemo(() => {
    const byId = new Map<string, AuditLog>();
    for (const l of serverAuditLogs || []) byId.set(l.id, l);
    for (const l of auditLogs) byId.set(l.id, l);
    return Array.from(byId.values());
  }, [auditLogs, serverAuditLogs]);

  const filteredSJ = effectiveSuratJalanList.filter(sj => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchesSearch =
      String(sj.noSurat || '').toLowerCase().includes(keyword) ||
      String(sj.tujuan || '').toLowerCase().includes(keyword);
    const matchesStatus = statusFilter === 'all' || sj.deliveryStatus === statusFilter;
    return matchesSearch && matchesStatus && sj.sjType !== 'Equipment Loan';
  });

  const activeDeployments = effectiveAssetList.filter(a => a.status === 'In Use').length;
  const maintenanceCount = effectiveAssetList.filter(a => a.status === 'Under Maintenance').length;

  const stats = {
    inTransit: effectiveSuratJalanList.filter(s => s.deliveryStatus === 'In Transit').length,
    deliveredToday: effectiveSuratJalanList.filter(s => s.deliveryStatus === 'Delivered').length,
    activeFleet: activeDeployments,
    maintenance: maintenanceCount,
  };

  const handleCreatePickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPickup.tujuan || !newPickup.alamat) {
      toast.error("Tujuan dan Alamat wajib diisi!");
      return;
    }

    const sj: SuratJalan = {
      id: `SJ-${Date.now()}`,
      noSurat: `GTP/SJ/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(Math.random() * 1000)}`,
      tanggal: newPickup.tanggal!,
      sjType: 'Material Delivery',
      tujuan: newPickup.tujuan!,
      alamat: newPickup.alamat!,
      noPO: newPickup.noPO,
      projectId: newPickup.projectId,
      sopir: newPickup.sopir,
      noPolisi: newPickup.noPolisi,
      deliveryStatus: 'Pending',
      items: [
        { namaItem: 'Peralatan Workshop', jumlah: 1, satuan: 'Lot' }
      ]
    };

    addSuratJalan(sj);
    addAuditLog({
      action: 'LOGISTICS_PICKUP_CREATED',
      module: 'Logistics',
      details: `${sj.noSurat} dijadwalkan untuk ${sj.tujuan}`,
      status: 'Success',
    });
    toast.success("Schedule pickup berhasil dibuat.");
    setShowPickupModal(false);
    setNewPickup({ tanggal: new Date().toISOString().split('T')[0], deliveryStatus: 'Pending' });
  };

  const handleUpdateShipmentStatus = (
    sj: SuratJalan,
    nextStatus: 'Pending' | 'On Delivery' | 'Delivered' | 'In Transit' | 'Returned',
  ) => {
    const updates: Partial<SuratJalan> = { deliveryStatus: nextStatus };
    if (nextStatus === 'Delivered') {
      updates.podTime = new Date().toISOString();
    }

    updateSuratJalan(sj.id, updates);
    addAuditLog({
      action: 'LOGISTICS_STATUS_UPDATED',
      module: 'Logistics',
      details: `${sj.noSurat} -> ${nextStatus}`,
      status: 'Success',
    });
    toast.success(`Status ${sj.noSurat} diubah ke ${nextStatus}.`);
  };

  const handleOpenShipmentMenu = (sj: SuratJalan) => {
    const driver = sj.sopir || 'Belum ditentukan';
    const plate = sj.noPolisi || 'Belum diisi';
    addAuditLog({
      action: 'LOGISTICS_QUICK_VIEW',
      module: 'Logistics',
      details: `${sj.noSurat} | ${driver} | ${plate}`,
      status: 'Success',
    });
    toast.info(`${sj.noSurat} • Driver: ${driver} • Nopol: ${plate}`);
  };

  const logisticsAuditLogs = useMemo(() => {
    const logs = (effectiveAuditLogs || [])
      .filter((log: any) => {
        const module = String(log?.module || '').toLowerCase();
        return module.includes('logistics') || module.includes('warehouse') || module.includes('procurement');
      })
      .slice(0, 30)
      .map((log: any, idx: number) => {
        const details = String(log?.details || '');
        const batchMatch = details.match(/(BCH-\d{8}-\d{3}|B\d{3,})/i);
        const when = log?.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';
        return {
          id: log?.id || `audit-${idx}`,
          action: log?.action || 'SYSTEM_EVENT',
          batch: batchMatch?.[0] || '-',
          user: log?.userName || 'System',
          time: when,
          status: String(log?.status || '').toLowerCase() === 'failed' ? 'Warning' : 'Success',
        };
      });

    if (logs.length > 0) return logs;
    return [
      { id: 'fallback-1', action: 'No audit logs yet', batch: '-', user: 'System', time: '-', status: 'Success' }
    ];
  }, [effectiveAuditLogs]);

  const handleExportAuditCsv = async () => {
    if (!logisticsAuditLogs.length) {
      toast.info('Belum ada audit log untuk diekspor.');
      return;
    }
    const rows = [
      ['Action', 'Batch', 'User', 'Time', 'Status'],
      ...logisticsAuditLogs.map((log: any) => [
        String(log.action || ''),
        String(log.batch || ''),
        String(log.user || ''),
        String(log.time || ''),
        String(log.status || ''),
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `logistics-audit-${dateKey}`,
      title: 'Logistics Audit Trail Report',
      subtitle: `Tanggal ${dateKey} | Status ${statusFilter} | Shipment ${filteredSJ.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan logistik: in transit ${stats.inTransit}, delivered ${stats.deliveredToday}, active fleet ${stats.activeFleet}, maintenance ${stats.maintenance}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Logistics Command',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `logistics-audit-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `logistics-audit-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Audit log Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export audit log gagal.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
              <Truck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Logistics Command Center</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Real-time Digital POD & Delivery Traceability</p>
            </div>
          </div>

          <div className="flex gap-3">
             <Link to="/assets/fleet" className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                Fleet Management
             </Link>
             <button 
              onClick={() => setShowPickupModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
             >
                Schedule New Pickup
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4 text-indigo-400">
                    <Navigation size={20} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Live Shipments</span>
                 </div>
                 <p className="text-4xl font-black italic">{stats.inTransit}</p>
                 <p className="text-[11px] text-slate-500 font-bold uppercase mt-2">Active Shipments on Route</p>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-50 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4 text-indigo-600">
                    <Briefcase size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Deployed Fleet</span>
                 </div>
                 <p className="text-4xl font-black text-slate-900 italic">{stats.activeFleet}</p>
                 <p className="text-[11px] text-slate-400 font-bold uppercase mt-2">Units Active on Project Site</p>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-rose-50 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4 text-rose-500">
                    <Activity size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Maintenance Log</span>
                 </div>
                 <p className="text-4xl font-black text-slate-900 italic">{stats.maintenance}</p>
                 <p className="text-[11px] text-slate-400 font-bold uppercase mt-2">Units in Workshop (Repair)</p>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-emerald-50 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4 text-emerald-600">
                    <CheckCircle2 size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Delivered Today</span>
                 </div>
                 <p className="text-4xl font-black text-slate-900 italic">{stats.deliveredToday}</p>
                 <p className="text-[11px] text-slate-400 font-bold uppercase mt-2">Closed POD & Job Complete</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                 <div className="flex bg-slate-50 p-1 rounded-xl">
                    {(['all', 'Pending', 'In Transit', 'Delivered'] as const).map((s) => (
                      <button 
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {s}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="relative w-full md:max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search Shipment or Destination..." 
                   className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-50">
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Shipment Info</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Route & Destination</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Vehicle & Driver</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-center">Batch Health</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-center">Status</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {filteredSJ.map((sj) => (
                      <tr key={sj.id} className="hover:bg-slate-50/50 transition-all group">
                         <td className="px-8 py-6">
                            <div className="flex flex-col">
                               <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{sj.noSurat}</span>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{sj.tanggal}</span>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                  <span className="text-[9px] text-indigo-500 font-black uppercase italic">{sj.noPO || 'No PO'}</span>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex items-start gap-3">
                               <div className="mt-1 text-slate-300">
                                  <MapPin size={16} />
                               </div>
                               <div>
                                  <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{sj.tujuan}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate max-w-[200px]">{sj.alamat}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                                  <User size={18} />
                               </div>
                               <div>
                                  <p className="text-[11px] font-black text-slate-900 uppercase italic">{sj.sopir || 'N/A'}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase">{sj.noPolisi || 'No Plate'}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex flex-col items-center">
                               <div className="flex -space-x-2">
                                  {[1,2].map(i => (
                                     <div key={i} className="w-6 h-6 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[8px] font-black text-slate-400 shadow-sm">
                                        B{i}
                                     </div>
                                  ))}
                               </div>
                               <span className="text-[8px] font-black text-emerald-500 uppercase mt-1 tracking-widest">Verified</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic border-2 transition-all ${
                               sj.deliveryStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                               sj.deliveryStatus === 'In Transit' ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 
                               'bg-slate-50 text-slate-400 border-slate-100'
                            }`}>
                               {sj.deliveryStatus || 'Pending'}
                            </span>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                               {sj.deliveryStatus !== 'In Transit' && sj.deliveryStatus !== 'Delivered' && (
                                 <button
                                   onClick={() => handleUpdateShipmentStatus(sj, 'In Transit')}
                                   className="px-3 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                                 >
                                   Dispatch
                                 </button>
                               )}
                               {sj.deliveryStatus === 'In Transit' && (
                                 <button
                                   onClick={() => handleUpdateShipmentStatus(sj, 'Delivered')}
                                   className="px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                                 >
                                   Complete
                                 </button>
                               )}
                               <Link 
                                 to={`/logistics/delivery/${sj.id}`}
                                 className="p-3 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm group/btn"
                               >
                                 <QrCode size={18} />
                               </Link>
                               <button
                                 onClick={() => handleOpenShipmentMenu(sj)}
                                 className="p-3 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                               >
                                 <MoreVertical size={18} />
                               </button>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Electronic Proof of Delivery (e-POD) Engine v2.0</p>
              <div className="flex gap-4">
                 <button 
                  onClick={() => setShowAuditModal(true)}
                  className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                 >
                    <ExternalLink size={16} /> Batch Audit Log
                 </button>
              </div>
           </div>
        </div>

        <AnimatePresence>
          {/* Schedule Pickup Modal */}
          {showPickupModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPickupModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">New Pickup Schedule</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Logistic Dispatch Management</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPickupModal(false)} className="p-3 text-slate-400 hover:text-rose-600 transition-all">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleCreatePickup} className="p-8 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Select Project (Optional)</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={newPickup.projectId || ''}
                      onChange={(e) => {
                        const projectId = e.target.value;
                        const selectedProject = effectiveProjectList.find((p) => p.id === projectId);
                        setNewPickup({
                          ...newPickup,
                          projectId,
                          tujuan: selectedProject?.customer || newPickup.tujuan || '',
                          alamat: selectedProject?.namaProject || newPickup.alamat || '',
                        });
                      }}
                    >
                      <option value="">-- General / No Project --</option>
                      {effectiveProjectList.map(p => (
                        <option key={p.id} value={p.id}>{p.namaProject}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Tujuan / Customer</label>
                      <input 
                        type="text" required placeholder="Nama PT / Customer"
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={newPickup.tujuan || ''}
                        onChange={(e) => setNewPickup({...newPickup, tujuan: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Tanggal Pickup</label>
                      <input 
                        type="date" required
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={newPickup.tanggal || ''}
                        onChange={(e) => setNewPickup({...newPickup, tanggal: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Alamat Pengiriman</label>
                    <textarea 
                      required placeholder="Alamat lengkap lokasi pengiriman..."
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all h-24 resize-none"
                      value={newPickup.alamat || ''}
                      onChange={(e) => setNewPickup({...newPickup, alamat: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">Sopir</label>
                      <input 
                        type="text" placeholder="Nama Driver"
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={newPickup.sopir || ''}
                        onChange={(e) => setNewPickup({...newPickup, sopir: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400">No Polisi</label>
                      <input 
                        type="text" placeholder="B 1234 XYZ"
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={newPickup.noPolisi || ''}
                        onChange={(e) => setNewPickup({...newPickup, noPolisi: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                    Confirm Pickup Schedule
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {/* Batch Audit Modal */}
          {showAuditModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAuditModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-3xl rounded-[3rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Layers size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Batch Audit Logs</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Warehouse & Logistic Traceability History</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAuditModal(false)} className="p-3 text-slate-400 hover:text-rose-600 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase italic tracking-widest">Recent Activity Trace</h4>
                    <button onClick={handleExportAuditCsv} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Export Word + Excel</button>
                  </div>
                  <div className="space-y-3">
                    {logisticsAuditLogs.map(log => (
                      <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            log.status === 'Success' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'
                          }`}>
                            <Activity size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase italic">{log.action}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Batch ID: <span className="text-indigo-600">{log.batch}</span></p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-900 uppercase italic flex items-center justify-end gap-1">
                            <UserCheck size={12} className="text-slate-400" /> {log.user}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{log.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 flex justify-end">
                    <button 
                      onClick={() => setShowAuditModal(false)}
                      className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                    >
                      Close Log
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
