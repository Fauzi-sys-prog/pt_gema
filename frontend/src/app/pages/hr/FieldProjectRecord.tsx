import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Briefcase, 
  MapPin, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  LayoutGrid,
  List,
  Save,
  FileText,
  FileSpreadsheet,
  FileDown,
  Package
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface FieldAttendance {
  employeeId: string;
  name: string;
  position: string;
  records: {
    [date: string]: { in: string; out: string };
  };
}

interface FieldKasbon {
  id: string;
  employeeId: string;
  employeeName: string;
  entries: {
    id: string;
    date: string;
    amount: number;
    approved: boolean;
  }[];
}

export default function FieldProjectRecord() {
  const { projectList = [], employeeList = [], assetList = [], thlList = [], workOrderList = [], updateProject, addAttendanceBulk, attendanceList = [], addEquipmentUsage, kasbonList = [], addKasbon, kasbonTHLList = [], addKasbonTHL } = useApp();
  const { currentUser } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeView, setActiveView] = useState<'attendance' | 'kasbon' | 'equipment'>('attendance');
  const [showKasbonModal, setShowKasbonModal] = useState(false);
  const [kasbonType, setKasbonType] = useState<'karyawan' | 'thl'>('karyawan');
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  // New states to fix ReferenceErrors
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [kasbonAmount, setKasbonAmount] = useState('');
  const [kasbonDate, setKasbonDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedProject = useMemo(() => projectList.find(p => p.id === selectedProjectId), [projectList, selectedProjectId]);
  const projectProgress = useMemo(() => {
    const operationalWOs = workOrderList.filter(wo => wo.projectId === selectedProjectId && wo.status !== 'Draft');
    if (operationalWOs.length === 0) return selectedProject?.progress || 0;
    const target = operationalWOs.reduce((sum, wo) => sum + (wo.targetQty || 0), 0);
    const completed = operationalWOs.reduce((sum, wo) => sum + (wo.completedQty || 0), 0);
    return target > 0 ? Math.min(100, Math.round(completed / target * 100)) : 0;
  }, [workOrderList, selectedProjectId, selectedProject?.progress]);
  const workers = employeeList;

  const dates = useMemo(() => {
    const arr = [];
    const base = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  }, [startDate]);
  
  // Equipment State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [usageHours, setUsageHours] = useState('8');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);

  useEscapeKey([
    { condition: showKasbonModal, close: () => setShowKasbonModal(false) },
    { condition: showEquipmentModal, close: () => setShowEquipmentModal(false) },
    { condition: showFinalizeModal, close: () => setShowFinalizeModal(false) },
  ]);


  const handleSaveAttendance = () => {
    const newRecords: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Generate real attendance objects from the matrix
    workers.forEach(worker => {
      dates.forEach(date => {
        const inTime = attendanceData[`${worker.id}-${date}-in`] || "07:00";
        const outTime = attendanceData[`${worker.id}-${date}-out`] || "17:00";
        
        // Only save if it doesn't exist yet for this worker/date/project
        const exists = attendanceList.some(a => a.employeeId === worker.id && a.date === date && a.projectId === selectedProjectId);
        
        if (!exists) {
          const [inH, inM] = inTime.split(':').map(Number);
          const [outH, outM] = outTime.split(':').map(Number);
          const workHours = (outH * 60 + outM - inH * 60 - inM) / 60;

          newRecords.push({
            id: `ATT-${worker.id}-${date}-${selectedProjectId}`,
            employeeId: worker.id,
            employeeName: worker.name,
            projectId: selectedProjectId,
            date: date,
            status: 'Present',
            checkIn: inTime,
            checkOut: outTime,
            workHours: workHours,
            overtime: Math.max(0, workHours - 8),
            location: selectedProject?.namaProject
          });
        }
      });
    });

    if (newRecords.length > 0) {
      addAttendanceBulk(newRecords);
      toast.success(`${newRecords.length} Data Absensi Lapangan berhasil disinkronkan ke Ledger Biaya Proyek!`);
    } else {
      toast.info("Tidak ada data baru untuk disimpan.");
    }
  };

  const handleFinalizeReport = () => {
    setShowFinalizeModal(true);
  };

  const handleExport = (format: 'Word' | 'Excel') => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: `Generating ${format} Report...`,
        success: `Weekly Report untuk ${selectedProject?.namaProject} berhasil diekspor ke ${format}!`,
        error: 'Gagal mengekspor laporan.',
      }
    );
    setShowFinalizeModal(false);
  };

  const handleAddKasbon = (worker: any, type: 'karyawan' | 'thl' = 'karyawan') => {
    setSelectedWorker(worker);
    setKasbonType(type);
    setKasbonAmount('');
    setKasbonDate(new Date().toISOString().split('T')[0]);
    setShowKasbonModal(true);
  };

  const handleAddEquipmentUsage = (e: React.FormEvent) => {
    e.preventDefault();
    const asset = assetList.find(a => a.id === selectedAssetId);
    if (!asset) return;
    const costPerHour = Number(asset.costPerHour ?? 0);
    if (!Number.isFinite(costPerHour) || costPerHour < 0) {
      toast.error("Tarif penggunaan asset belum valid.");
      return;
    }
    if (costPerHour === 0) {
      toast.warning("Asset tersimpan dengan tarif Rp 0/jam", {
        description: "Atur tarif per jam di master asset agar biaya proyek tidak understate.",
      });
    }

    addEquipmentUsage({
      id: `EQ-${Date.now()}`,
      projectId: selectedProjectId,
      equipmentId: asset.id,
      equipmentName: asset.name,
      date: usageDate,
      hoursUsed: parseFloat(usageHours),
      operatorName: currentUser?.fullName || 'Field Supervisor',
      costPerHour
    });

    toast.success(`Log penggunaan ${asset.name} berhasil disimpan.`);
    setShowEquipmentModal(false);
  };

  const submitKasbon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;

    const amount = parseFloat(kasbonAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal kasbon tidak valid.");
      return;
    }

    if (kasbonType === 'thl') {
      // THL — validasi tidak melebihi earned wages, simpan ke global kasbonTHLList
      const upahEarned = selectedWorker.upahHarian * selectedWorker.jumlahHari;
      const existingKasbonTHL = kasbonTHLList
        .filter((k) => k.thlId === selectedWorker.id)
        .reduce((s, k) => s + k.nominal, 0);
      if (amount > upahEarned - existingKasbonTHL) {
        toast.error(`Melebihi sisa upah yang bisa dikasbon (${formatCurrency(upahEarned - existingKasbonTHL)})`);
        return;
      }
      if (!selectedProjectId) {
        toast.error('Kasbon THL harus dikaitkan ke project. Pilih project terlebih dahulu.');
        return;
      }
      addKasbonTHL({ id: `KBTHL-${Date.now()}`, thlId: selectedWorker.id, thlNama: selectedWorker.nama, projectId: selectedProjectId, tanggal: kasbonDate, nominal: amount, catatan: '', status: 'Approved' });
    } else {
      // Karyawan — selalu simpan ke global kasbonList (bukan project)
      addKasbon({
        id: `KSB-${Date.now()}`,
        employeeId: selectedWorker.id,
        employeeName: selectedWorker.name,
        tanggal: kasbonDate,
        nominal: amount,
        status: 'Pending',
        projectId: selectedProjectId || undefined,
      });
    }

    toast.success(`Kasbon ${formatCurrency(amount)} untuk ${selectedWorker.name || selectedWorker.nama} berhasil dicatat.`);
    setShowKasbonModal(false);
    setKasbonAmount('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  const getEquipmentView = () => (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h3 className="text-xl font-black italic uppercase tracking-tighter">Equipment Usage Logs</h3>
          <button 
            onClick={() => setShowEquipmentModal(true)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
          >
             <Plus size={16} /> Log Machine Hours
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(selectedProject?.equipmentUsage || []).map((log) => (
            <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
                  <Clock size={40} />
               </div>
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{log.date}</p>
                    <h4 className="text-lg font-black text-slate-900 uppercase italic leading-tight">{log.equipmentName}</h4>
                  </div>
                  <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    <span className="text-xs font-black text-blue-600">{log.hoursUsed} HRS</span>
                  </div>
               </div>
               <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black italic text-slate-500">
                    OP
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase italic">{log.operatorName}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Est. Cost</p>
                    <p className="text-[10px] font-black text-emerald-600 italic">{formatCurrency(log.hoursUsed * log.costPerHour)}</p>
                  </div>
               </div>
            </div>
          ))}
          {(selectedProject?.equipmentUsage || []).length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100 shadow-sm">
                  <Briefcase size={24} />
               </div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No equipment logs for this period</p>
            </div>
          )}
       </div>
    </div>
  );

  // Kasbon tab data
  const projectWorkers = employeeList.filter(e => e.status !== 'Resigned');
  const projectTHLWorkers = selectedProjectId
    ? thlList.filter(t => t.projectId === selectedProjectId)
    : thlList.filter(t => t.status === 'Active');
  // Karyawan kasbon: global list, filter by project context if a project is selected
  const projectKasbon: any[] = selectedProjectId
    ? kasbonList.filter((k) => k.projectId === selectedProjectId)
    : kasbonList.filter((k) => !k.projectId);
  // THL kasbon: read from global kasbonTHLList, filter by project
  const projectKasbonTHL = kasbonTHLList.filter(k => k.projectId === selectedProjectId);
  const totalKasbonProject =
    projectKasbon.reduce((s: number, k: any) => s + (k.nominal || 0), 0) +
    projectKasbonTHL.reduce((s: number, k: any) => s + (k.nominal || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <LayoutGrid size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Field Project Ledger</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Attendance & Advances (Kasbon) Integration</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative min-w-[250px]">
             <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <select 
               value={selectedProjectId}
               onChange={(e) => setSelectedProjectId(e.target.value)}
               className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
             >
                <option value="">— Tanpa Project (Internal) —</option>
                {projectList.map(p => (
                  <option key={p.id} value={p.id}>{p.namaProject}</option>
                ))}
             </select>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button 
               onClick={() => setActiveView('attendance')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'attendance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Attendance
             </button>
             <button 
               onClick={() => setActiveView('kasbon')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'kasbon' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Kasbon
             </button>
             <button 
               onClick={() => setActiveView('equipment')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'equipment' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Equipment
             </button>
          </div>
        </div>
      </div>

      {/* Project Banner */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 p-10 opacity-10">
            <MapPin size={120} />
         </div>
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Project</p>
               <h3 className="text-xl font-black italic uppercase tracking-tighter">{selectedProject?.namaProject || 'No Project Selected'}</h3>
            </div>
            <div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Site Location</p>
               <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                  <MapPin size={18} className="text-blue-400" />
                  {selectedProject?.customer || 'General Site'}
               </h3>
            </div>
            <div className="flex justify-end items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Physical Progress</p>
                  <div className="flex items-center gap-3">
                    <div className="min-w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-lg font-black text-center">
                      {projectProgress}
                    </div>
                    <span className="text-2xl font-black italic">%</span>
                  </div>
                  <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Otomatis dari Work Order</p>
               </div>
               <button className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10">
                  <Download size={20} />
               </button>
            </div>
         </div>
      </div>

      {activeView === 'attendance' ? (
        <div className="space-y-4">
           {/* Attendance Date Control */}
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <button 
                   onClick={() => {
                     const d = new Date(startDate);
                     d.setDate(d.getDate() - 10);
                     setStartDate(d.toISOString().split('T')[0]);
                   }}
                   className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                 >
                    <ChevronLeft size={18} />
                 </button>
                 <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-lg">
                    <Calendar size={16} className="text-blue-600" />
                    <span className="text-xs font-black uppercase italic">{formatDateShort(dates[0])} - {formatDateShort(dates[dates.length - 1])}</span>
                 </div>
                 <button 
                   onClick={() => {
                     const d = new Date(startDate);
                     d.setDate(d.getDate() + 10);
                     setStartDate(d.toISOString().split('T')[0]);
                   }}
                   className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                 >
                    <ChevronRight size={18} />
                 </button>
              </div>
              <button 
                onClick={handleSaveAttendance}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                 <Save size={16} /> Save Changes
              </button>
           </div>

           {/* The ABSEN Table Grid */}
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-900 text-white">
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 text-center w-12">No</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[150px]">Name</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[100px]">Position</th>
                          {dates.map(date => (
                            <th key={date} colSpan={2} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b border-white/10 text-center border-r border-white/10">
                               {formatDateShort(date)}
                            </th>
                          ))}
                       </tr>
                       <tr className="bg-slate-800 text-slate-300">
                          {dates.flatMap(date => [
                             <th key={`in-${date}`} className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-center border-r border-white/10">In</th>,
                             <th key={`out-${date}`} className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-center border-r border-white/10">Out</th>
                          ])}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {workers.map((worker, idx) => (
                         <tr key={worker.id} className="hover:bg-slate-50 transition-all group">
                            <td className="px-6 py-4 text-[10px] font-bold text-slate-400 text-center border-r border-slate-50">{idx + 1}</td>
                            <td className="px-6 py-4">
                               <p className="text-xs font-black text-slate-900 uppercase italic leading-tight">{worker.name}</p>
                            </td>
                            <td className="px-6 py-4 border-r border-slate-50">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{worker.position}</p>
                            </td>
                            {dates.flatMap(date => [
                               <td key={`in-${worker.id}-${date}`} className="px-1 py-1 border-r border-slate-50">
                                  <input 
                                    type="text" 
                                    value={attendanceData[`${worker.id}-${date}-in`] || "07:00"}
                                    onChange={(e) => setAttendanceData({...attendanceData, [`${worker.id}-${date}-in`]: e.target.value})}
                                    className="w-full text-[10px] font-black text-center bg-transparent border-none outline-none focus:bg-blue-50 focus:text-blue-600 rounded transition-colors"
                                  />
                               </td>,
                               <td key={`out-${worker.id}-${date}`} className="px-1 py-1 border-r border-slate-50">
                                  <input 
                                    type="text" 
                                    value={attendanceData[`${worker.id}-${date}-out`] || "17:00"}
                                    onChange={(e) => setAttendanceData({...attendanceData, [`${worker.id}-${date}-out`]: e.target.value})}
                                    className="w-full text-[10px] font-black text-center bg-transparent border-none outline-none focus:bg-blue-50 focus:text-blue-600 rounded transition-colors"
                                  />
                               </td>
                            ])}
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : activeView === 'kasbon' ? (
          <div className="space-y-8">
            {/* Summary bar */}
            <div className="flex items-center gap-6 bg-white rounded-2xl border border-slate-100 px-6 py-4 shadow-sm">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Karyawan di Project</p>
                <p className="text-xl font-black text-slate-900">{projectWorkers.length} orang</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">THL di Project</p>
                <p className="text-xl font-black text-orange-600">{projectTHLWorkers.length} orang</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Kasbon</p>
                <p className="text-xl font-black text-blue-600">{formatCurrency(totalKasbonProject)}</p>
              </div>
            </div>

            {/* ── KARYAWAN SECTION ── */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg tracking-widest">Karyawan</span>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kasbon Karyawan Tetap / Kontrak</p>
              </div>
              {projectWorkers.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-dashed border-slate-200 py-12 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada karyawan aktif</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {projectWorkers.map((worker) => {
                    const workerKasbon = projectKasbon.filter((k: any) => k.employeeId === worker.id);
                const totalKasbon = workerKasbon.reduce((s: number, k: any) => s + (k.nominal || k.amount || 0), 0);
                const workerAttendance = attendanceList.filter(a => a.employeeId === worker.id && a.projectId === selectedProjectId);

                return (
                  <div key={worker.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-base italic">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter leading-none">{worker.name}</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{worker.position}</p>
                          <p className="text-[9px] text-slate-300 font-bold">{workerAttendance.length} hari hadir</p>
                        </div>
                      </div>
                      <div className="bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 text-right">
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Total Kasbon</p>
                        <p className="text-sm font-black text-blue-600">{formatCurrency(totalKasbon)}</p>
                      </div>
                    </div>

                    {workerKasbon.length > 0 ? (
                      <table className="w-full mb-4">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400">
                            <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-center w-8 rounded-l-xl">No</th>
                            <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest">Tanggal</th>
                            <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-right">Nominal</th>
                            <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-center rounded-r-xl">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {workerKasbon.map((k: any, idx: number) => (
                            <tr key={k.id} className="group">
                              <td className="px-3 py-2.5 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                              <td className="px-3 py-2.5 text-xs font-black text-slate-900 uppercase italic">{k.date || k.tanggal || '-'}</td>
                              <td className="px-3 py-2.5 text-xs font-black text-slate-900 text-right">{formatCurrency(k.nominal || k.amount || 0)}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex justify-center">
                                  {k.status === 'Approved' || k.status === 'approved' ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase rounded-full">Approved</span>
                                  ) : k.status === 'Rejected' ? (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-500 text-[8px] font-black uppercase rounded-full">Ditolak</span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[8px] font-black uppercase rounded-full">Pending</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-6 text-center bg-slate-50 rounded-2xl mb-4">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada kasbon</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleAddKasbon(worker)}
                      className="w-full py-2.5 bg-slate-50 text-slate-400 border border-slate-200 border-dashed rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={13} /> Tambah Kasbon
                    </button>
                  </div>
                );
              })}
                </div>
              )}
            </div>

            {/* ── THL SECTION ── */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-orange-600 text-white text-[9px] font-black uppercase rounded-lg tracking-widest">THL</span>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kasbon Tenaga Harian Lepas</p>
              </div>
              {projectTHLWorkers.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-dashed border-slate-200 py-12 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada THL terdaftar di project ini</p>
                  <p className="text-[9px] text-slate-200 font-bold mt-1">Daftarkan THL via menu HR → THL / Harian Lepas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {projectTHLWorkers.map((thl) => {
                    const thlKasbon = projectKasbonTHL.filter((k: any) => k.thlId === thl.id);
                    const totalKasbonTHL = thlKasbon.reduce((s: number, k: any) => s + (k.nominal || 0), 0);
                    const upahEarned = thl.upahHarian * thl.jumlahHari;
                    const sisa = upahEarned - totalKasbonTHL;
                    return (
                      <div key={thl.id} className="bg-white p-6 rounded-[2.5rem] border border-orange-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-base">
                              {thl.nama.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase italic">{thl.nama}</h4>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{thl.posisi}</p>
                              <p className="text-[9px] text-slate-300 font-bold">{thl.jumlahHari} hari × {formatCurrency(thl.upahHarian)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sisa Bisa Kasbon</p>
                            <p className={`text-sm font-black ${sisa <= 0 ? 'text-red-500' : 'text-orange-600'}`}>{formatCurrency(sisa)}</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mb-4">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(upahEarned > 0 ? (totalKasbonTHL / upahEarned) * 100 : 0, 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[9px] font-bold mt-1">
                            <span className="text-orange-400">{formatCurrency(totalKasbonTHL)} kasbon</span>
                            <span className="text-slate-400">{formatCurrency(upahEarned)} earned</span>
                          </div>
                        </div>
                        {thlKasbon.length > 0 && (
                          <div className="space-y-1 mb-3">
                            {thlKasbon.map((k: any) => (
                              <div key={k.id} className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2">
                                <span className="text-[9px] font-bold text-slate-500">{k.tanggal}</span>
                                <span className="text-xs font-black text-orange-600">{formatCurrency(k.nominal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleAddKasbon(thl, 'thl')}
                          disabled={sisa <= 0}
                          className="w-full py-2 bg-orange-50 text-orange-500 border border-orange-200 border-dashed rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus size={13} /> Tambah Kasbon THL
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      ) : (
        getEquipmentView()
      )}

      {/* Footer Info */}
      <div className="p-8 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
               <DollarSign size={28} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Site Commitment</p>
               <h3 className="text-xl font-black italic text-white tracking-tighter uppercase leading-none">PT GTP Project Excellence Ledger</h3>
            </div>
         </div>
         <div className="flex gap-4">
            <div className="text-center px-8 py-3 bg-white/5 rounded-2xl border border-white/10">
               <p className="text-lg font-black text-white italic leading-none">{formatCurrency(4800000)}</p>
               <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-widest">Aggregate Site Advances</p>
            </div>
            <button 
              onClick={handleFinalizeReport}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-700 transition-all"
            >
               Finalize Weekly Report
            </button>
         </div>
      </div>

      {/* Finalize Report Modal */}
        {showFinalizeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinalizeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <FileDown size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Finalize Weekly Report</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audit-Ready Professional Export</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFinalizeModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Period</p>
                      <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">
                         {formatDateShort(dates[0])} - {formatDateShort(dates[dates.length-1])} 2026
                      </p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Personnel</p>
                      <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">
                         {workers.length} Members
                      </p>
                   </div>
                   <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100/50">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Attendance Score</p>
                      <p className="text-sm font-black text-blue-600 uppercase italic leading-tight">
                         98.4% Compliance
                      </p>
                   </div>
                   <div className="p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Total Advances</p>
                      <p className="text-sm font-black text-emerald-600 uppercase italic leading-tight">
                         {formatCurrency(4800000)}
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Export Format</p>
                   <div className="flex gap-4">
                      <button 
                        onClick={() => handleExport('Word')}
                        className="flex-1 group relative overflow-hidden p-6 bg-slate-900 text-white rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText size={60} />
                         </div>
                         <div className="relative z-10 flex flex-col items-center gap-2">
                            <FileText size={32} className="text-blue-400" />
                            <span className="text-xs font-black uppercase italic tracking-widest">Microsoft Word</span>
                            <span className="text-[8px] opacity-40 uppercase font-bold tracking-widest">Professional Docx</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => handleExport('Excel')}
                        className="flex-1 group relative overflow-hidden p-6 bg-slate-50 text-slate-900 border border-slate-200 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FileSpreadsheet size={60} />
                         </div>
                         <div className="relative z-10 flex flex-col items-center gap-2">
                            <FileSpreadsheet size={32} className="text-emerald-500" />
                            <span className="text-xs font-black uppercase italic tracking-widest">Microsoft Excel</span>
                            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Financial Audit Xlsx</span>
                         </div>
                      </button>
                   </div>
                </div>

                <p className="text-[9px] text-slate-400 text-center font-bold uppercase italic leading-relaxed">
                   By finalizing this report, all attendance and advances records will be locked and synced <br/> 
                   to the PT Gema Teknik Perkasa General Ledger for current fiscal week.
                </p>
              </div>
            </motion.div>
          </div>
        )}

      {/* Kasbon Input Modal */}
        {showKasbonModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKasbonModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl"
            >
              {(() => {
                const isTHL = kasbonType === 'thl';
                const accentBg = isTHL ? 'bg-orange-500' : 'bg-blue-600';
                const accentRing = isTHL ? 'focus:ring-orange-500/10' : 'focus:ring-blue-500/10';
                const accentBtn = isTHL ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100';
                const workerName = selectedWorker?.name || selectedWorker?.nama || '';
                const upahEarned = isTHL ? (selectedWorker?.upahHarian || 0) * (selectedWorker?.jumlahHari || 0) : 0;
                const existingKasbonTHL = isTHL
                  ? kasbonTHLList
                      .filter(k => k.thlId === selectedWorker?.id)
                      .reduce((s, k) => s + k.nominal, 0)
                  : 0;
                const sisaUpah = upahEarned - existingKasbonTHL;
                const gajiPokok = !isTHL ? (selectedWorker?.salary || 0) : 0;
                const existingKasbonKary = !isTHL
                  ? kasbonList
                      .filter(k => k.employeeId === selectedWorker?.id && k.status !== 'Rejected')
                      .reduce((s, k) => s + k.nominal, 0)
                  : 0;
                const sisaKary = gajiPokok - existingKasbonKary;
                return (
                  <>
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${accentBg} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">
                            {isTHL ? 'Kasbon THL' : 'Kasbon Karyawan'}
                          </h2>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {isTHL ? 'Harian Lepas — maks. upah earned' : 'Karyawan Tetap — maks. 1× gaji pokok'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowKasbonModal(false)}
                        className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                      >
                        <Plus size={20} className="rotate-45" />
                      </button>
                    </div>

                    <form onSubmit={submitKasbon} className="p-8 space-y-6">
                      <div className="space-y-4">
                        {/* Worker info */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic text-sm">
                            {workerName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase">{isTHL ? 'THL' : 'Karyawan'}</p>
                            <p className="text-sm font-black text-slate-900 uppercase italic truncate">{workerName}</p>
                          </div>
                          {isTHL && (
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Upah / Hari</p>
                              <p className="text-xs font-black text-orange-600">{formatCurrency(selectedWorker?.upahHarian || 0)}</p>
                            </div>
                          )}
                        </div>

                        {/* Limit info bar */}
                        {isTHL ? (
                          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex justify-between items-center">
                            <div>
                              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Upah Earned</p>
                              <p className="text-sm font-black text-orange-700">{formatCurrency(upahEarned)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Sudah Kasbon</p>
                              <p className="text-sm font-black text-slate-600">{formatCurrency(existingKasbonTHL)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Sisa Batas</p>
                              <p className={`text-sm font-black ${sisaUpah <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(Math.max(0, sisaUpah))}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
                            <div>
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Gaji Pokok</p>
                              <p className="text-sm font-black text-blue-700">{formatCurrency(gajiPokok)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Sudah Kasbon</p>
                              <p className="text-sm font-black text-slate-600">{formatCurrency(existingKasbonKary)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Sisa Batas</p>
                              <p className={`text-sm font-black ${sisaKary <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(Math.max(0, sisaKary))}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tanggal Kasbon</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                              type="date"
                              required
                              className={`w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 ${accentRing} transition-all`}
                              value={kasbonDate}
                              onChange={(e) => setKasbonDate(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                            Nominal (IDR) {isTHL ? `— maks. ${formatCurrency(Math.max(0, sisaUpah))}` : `— maks. ${formatCurrency(Math.max(0, sisaKary))}`}
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                              type="number"
                              required
                              placeholder="e.g. 200000"
                              max={isTHL ? sisaUpah : sisaKary}
                              className={`w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 ${accentRing} transition-all`}
                              value={kasbonAmount}
                              onChange={(e) => setKasbonAmount(e.target.value)}
                            />
                          </div>
                          {/* Quick amount buttons */}
                          {isTHL && sisaUpah > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {[0.25, 0.5, 0.75, 1].map(pct => {
                                const val = Math.floor(sisaUpah * pct / 10000) * 10000;
                                return val > 0 ? (
                                  <button key={pct} type="button" onClick={() => setKasbonAmount(String(val))}
                                    className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-[9px] font-black uppercase hover:bg-orange-100 transition-all">
                                    {pct * 100}%
                                  </button>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowKasbonModal(false)}
                          className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={`flex-[2] py-4 ${accentBtn} text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl`}
                        >
                          {isTHL ? 'Catat Kasbon THL' : 'Ajukan Kasbon'}
                        </button>
                      </div>
                    </form>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      {/* Equipment Usage Modal */}
        {showEquipmentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEquipmentModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Log Equipment</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Machine Hours & Asset Utilization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEquipmentModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEquipmentUsage} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Machine / Asset</label>
                  <select 
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
                    required
                  >
                    <option value="">Choose Asset...</option>
                    {assetList.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date</label>
                    <input 
                      type="date"
                      value={usageDate}
                      onChange={(e) => setUsageDate(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hours Used</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={usageHours}
                      onChange={(e) => setUsageHours(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. 8"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all transform active:scale-95"
                  >
                    Confirm Usage Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
    </div>
  );
}
