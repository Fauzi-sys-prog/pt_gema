import React, { useMemo, useState } from 'react';
import { 
  Wrench, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Settings,
  Plus,
  Search,
  ChevronRight,
  History,
  Activity,
  ArrowUpRight,
  X,
  Package,
  Shield,
  MapPin,
  Tag
} from 'lucide-react';
import { useApp, type Asset, type MaintenanceRecord } from '../../contexts/AppContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function FleetMaintenancePage() {
  const { assetList, maintenanceList, addMaintenance, updateAsset } = useApp();
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState<Partial<MaintenanceRecord>>({
    maintenanceType: 'Routine',
    status: 'In Progress',
    cost: 0,
    performedBy: 'External Workshop'
  });
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  useEscapeKey([
    { condition: showMaintModal, close: () => setShowMaintModal(false) },
  ]);


  const vehicles = useMemo(() => {
    return assetList.filter(a => a.category === 'Vehicle' || a.category === 'Heavy Equipment');
  }, [assetList]);

  const maintenanceNeeded = useMemo(() => {
    const today = new Date();
    return vehicles.filter(v => {
      if (!v.nextMaintenance) return false;
      const nextDate = new Date(v.nextMaintenance);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 || v.status === 'Under Maintenance' || v.status === 'Broken';
    });
  }, [vehicles]);

  const handleScheduleService = (asset: Asset) => {
    const newMaint: MaintenanceRecord = {
      id: `MNT-${Date.now()}`,
      maintenanceNo: `MNT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      equipmentName: asset.name,
      maintenanceType: 'Preventive',
      scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      status: 'Scheduled',
      cost: 0,
      performedBy: 'External Workshop'
    };
    
    addMaintenance(newMaint);
    
    // Update next maintenance in 3 months
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    updateAsset(asset.id, { 
      status: 'Under Maintenance',
      nextMaintenance: threeMonthsLater.toISOString().split('T')[0]
    });
    
    toast.success(`Unit ${asset.name} masuk jadwal servis & status diperbarui.`);
  };

  const handleRecordMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      toast.error("Pilih Unit Asset terlebih dahulu!");
      return;
    }

    const asset = assetList.find(a => a.id === selectedAssetId);
    if (!asset) return;

    const maintenanceRecord: MaintenanceRecord = {
      id: `MNT-${Date.now()}`,
      maintenanceNo: `MNT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      equipmentName: asset.name,
      maintenanceType: maintForm.maintenanceType as any || 'Repair',
      scheduledDate: new Date().toISOString().split('T')[0],
      status: maintForm.status as any || 'In Progress',
      cost: maintForm.cost || 0,
      performedBy: maintForm.performedBy || 'GTP Workshop',
      notes: maintForm.notes || ''
    };

    addMaintenance(maintenanceRecord);
    
    // Auto-update asset status
    updateAsset(asset.id, { 
      status: maintenanceRecord.status === 'Completed' ? 'Available' : 'Under Maintenance',
      lastMaintenance: maintenanceRecord.status === 'Completed' ? new Date().toISOString().split('T')[0] : asset.lastMaintenance
    });

    toast.success(`Laporan servis unit ${asset.name} berhasil dicatat.`);
    setShowMaintModal(false);
    setMaintForm({ maintenanceType: 'Routine', status: 'In Progress', cost: 0, performedBy: 'External Workshop' });
    setSelectedAssetId('');
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-100">
            <Wrench size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Fleet Health & Maintenance</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Preventive Service Scheduling & Asset Reliability</p>
          </div>
        </div>

        <div className="flex gap-3">
           <button className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
              <History size={16} /> Service Logs
           </button>
           <button 
             onClick={() => setShowMaintModal(true)}
             className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2"
           >
              <Wrench size={16} /> Record Maintenance
           </button>
        </div>
      </div>

      {/* Critical Alerts */}
      {maintenanceNeeded.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {maintenanceNeeded.slice(0, 2).map(asset => (
             <div key={asset.id} className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2.5rem] flex items-center justify-between group">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:animate-bounce">
                      <AlertTriangle size={24} />
                   </div>
                   <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase italic">{asset.name}</h4>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">
                        {asset.status === 'Under Maintenance' ? 'Sedang Diservis' : 'Jadwal Servis Terlewati!'}
                      </p>
                   </div>
                </div>
                <button 
                  onClick={() => handleScheduleService(asset)}
                  className="px-6 py-2.5 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                >
                   Update Status
                </button>
             </div>
           ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Fleet List */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                     <Truck size={18} className="text-indigo-600" /> Active Fleet Registry
                  </h3>
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                     <input type="text" placeholder="Search Fleet..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase italic outline-none focus:border-indigo-500 transition-all" />
                  </div>
               </div>
               
               <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr>
                           <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Asset Code</th>
                           <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Unit Model</th>
                           <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Health Status</th>
                           <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Next Service</th>
                           <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-right">Aksi</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {vehicles.map(v => (
                          <tr key={v.id} className="hover:bg-slate-50 transition-all group">
                             <td className="px-4 py-5">
                                <span className="text-[10px] font-black text-slate-900 uppercase italic bg-slate-100 px-2 py-1 rounded-lg">{v.assetCode}</span>
                             </td>
                             <td className="px-4 py-5">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black text-slate-900 uppercase italic">{v.name}</span>
                                   <span className="text-[9px] text-slate-400 font-bold uppercase">{v.brand || ''} {v.model || ''}</span>
                                </div>
                             </td>
                             <td className="px-4 py-5">
                                <div className="flex items-center gap-2">
                                   <div className={`w-2 h-2 rounded-full ${
                                     v.status === 'Available' ? 'bg-emerald-500' : 
                                     v.status === 'Under Maintenance' ? 'bg-amber-500' : 'bg-rose-500'
                                   }`} />
                                   <span className="text-[10px] font-black uppercase italic text-slate-600">{v.status}</span>
                                </div>
                             </td>
                             <td className="px-4 py-5">
                                <div className="flex items-center gap-2 text-slate-500">
                                   <Calendar size={12} />
                                   <span className="text-[10px] font-bold uppercase">{v.nextMaintenance || 'Not Set'}</span>
                                </div>
                             </td>
                             <td className="px-4 py-5 text-right">
                                <button className="p-2 text-slate-300 hover:text-slate-900 transition-all">
                                   <Settings size={16} />
                                </button>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Maintenance Schedule & Trends */}
         <div className="space-y-8">
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full"></div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                     <Activity size={20} className="text-emerald-400" />
                     <h3 className="text-xs font-black uppercase italic tracking-widest text-slate-400">Reliability Score</h3>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                     <span className="text-5xl font-black italic">94</span>
                     <span className="text-xl font-black italic text-emerald-400 mb-1">%</span>
                     <ArrowUpRight size={24} className="text-emerald-400 mb-2" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
                     Asset Uptime optimal. Preventive maintenance berhasil menekan breakdown hingga 12% bulan ini.
                  </p>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
               <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" /> Upcoming Maintenance
               </h3>
               <div className="space-y-4">
                  {maintenanceList.filter(m => m.status === 'Scheduled').map(m => (
                    <div key={m.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white transition-all">
                       <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 italic">{m.maintenanceType}</p>
                          <p className="text-xs font-black text-slate-900 uppercase italic">{m.equipmentName}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{m.scheduledDate}</p>
                       </div>
                       <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-amber-500 group-hover:border-amber-100 transition-all">
                          <Wrench size={18} />
                       </div>
                    </div>
                  ))}
                  {maintenanceList.filter(m => m.status === 'Scheduled').length === 0 && (
                    <div className="py-10 text-center text-slate-300 italic font-bold uppercase text-[10px]">No upcoming schedule</div>
                  )}
               </div>
               <button className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all border border-dashed border-slate-200">
                  Generate Health Report
               </button>
            </div>
         </div>
      </div>

        {showMaintModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMaintModal(false)}
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
                  <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                    <Wrench size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Record Maintenance</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Service & Repair Log Entry</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMaintModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRecordMaintenance} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Truck size={12} className="text-indigo-500" /> Select Unit / Fleet
                    </label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                    >
                      <option value="">-- Choose Unit --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.assetCode} - {v.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Settings size={12} className="text-indigo-500" /> Service Type
                    </label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={maintForm.maintenanceType}
                      onChange={(e) => setMaintForm({...maintForm, maintenanceType: e.target.value as any})}
                    >
                      <option value="Routine">Routine (Preventive)</option>
                      <option value="Repair">Repair (Corrective)</option>
                      <option value="Overhaul">Overhaul</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Activity size={12} className="text-indigo-500" /> Current Status
                    </label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={maintForm.status}
                      onChange={(e) => setMaintForm({...maintForm, status: e.target.value as any})}
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed (Back to Fleet)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Tag size={12} className="text-indigo-500" /> Est. Cost (IDR)
                    </label>
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={maintForm.cost || ''}
                      onChange={(e) => setMaintForm({...maintForm, cost: parseFloat(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <MapPin size={12} className="text-indigo-500" /> Workshop / Performed By
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Workshop Internal"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      value={maintForm.performedBy || ''}
                      onChange={(e) => setMaintForm({...maintForm, performedBy: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <History size={12} className="text-indigo-500" /> Maintenance Notes
                    </label>
                    <textarea 
                      placeholder="Describe the issue or parts replaced..."
                      rows={3}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                      value={maintForm.notes || ''}
                      onChange={(e) => setMaintForm({...maintForm, notes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowMaintModal(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    <Wrench size={16} /> Finalize Service Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
    </div>
  );
}
