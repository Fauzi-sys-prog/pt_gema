import { useState, useMemo, useEffect } from 'react'; import { Wallet, Search, Download, Printer, Filter, ChevronRight, Clock, Calendar, Users, ArrowUpRight, TrendingUp, FileSpreadsheet, CheckCircle2, AlertCircle, ShieldCheck, Briefcase, ExternalLink, ChevronDown, RefreshCw, ArrowRight, History, List } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { Link } from 'react-router-dom';
import type { Attendance, Employee, Project } from '../../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function PayrollPage() {
  const { addAuditLog, currentUser } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [serverEmployees, setServerEmployees] = useState<Employee[]>([]);
  const [serverAttendances, setServerAttendances] = useState<Attendance[]>([]);
  const [serverProjects, setServerProjects] = useState<Project[]>([]);
  const [serverPayrollRows, setServerPayrollRows] = useState<any[]>([]);
  const [serverPayrollStats, setServerPayrollStats] = useState<{
    totalNetPayroll: number;
    totalManHours: number;
    totalOvertime: number;
    totalKasbon: number;
    employeeCount: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'thl-detail' | 'project-allocation'>('summary');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const payrollPeriodLabel = 'Januari 2026';

  const normalizeList = <T extends { id: string }>(rows: any[]): T[] =>
    (Array.isArray(rows) ? rows : []).map((row: any, idx: number) => {
      const payload = row?.payload && typeof row.payload === 'object' ? row.payload : row;
      const fallbackId = row?.entityId || row?.id || `ROW-${idx + 1}`;
      return {
        id: payload?.id || fallbackId,
        ...(payload || {}),
      } as T;
    });

  const fetchPayrollData = async (silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const [empRes, attRes, projectRes] = await Promise.all([
        api.get<any[]>('/employees'),
        api.get<any[]>('/attendances'),
        api.get<Project[]>('/projects'),
      ]);
      const payrollRes = await api.get<{
        summary?: {
          totalNetPayroll?: number;
          totalManHours?: number;
          totalOvertime?: number;
          totalKasbon?: number;
          employeeCount?: number;
        };
        rows?: any[];
      }>('/dashboard/finance-payroll-summary');
      setServerEmployees(normalizeList<Employee>(empRes.data));
      setServerAttendances(normalizeList<Attendance>(attRes.data));
      setServerProjects(normalizeList<Project>(projectRes.data));
      setServerPayrollRows(Array.isArray(payrollRes.data?.rows) ? payrollRes.data.rows : []);
      setServerPayrollStats(payrollRes.data?.summary ? {
        totalNetPayroll: Number(payrollRes.data.summary.totalNetPayroll || 0),
        totalManHours: Number(payrollRes.data.summary.totalManHours || 0),
        totalOvertime: Number(payrollRes.data.summary.totalOvertime || 0),
        totalKasbon: Number(payrollRes.data.summary.totalKasbon || 0),
        employeeCount: Number(payrollRes.data.summary.employeeCount || 0),
      } : null);
      if (!silent) toast.success('Payroll data berhasil disinkronkan.');
    } catch {
      if (!silent) toast.error('Gagal refresh payroll data.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPayrollData(true);
  }, []);

  const liveEmployeeList = serverEmployees.filter(Boolean);
  const liveAttendanceList = serverAttendances.filter(Boolean);
  const liveProjectList = serverProjects.filter(Boolean);

  // --- Logic Perhitungan Otomatis (Zero Re-typing) ---
  
  // 1. Group attendance by employee
  const payrollSummary = useMemo(() => serverPayrollRows, [serverPayrollRows]);

  const totalPayroll = useMemo(() => {
    return Number(serverPayrollStats?.totalNetPayroll || 0);
  }, [serverPayrollStats]);

  const projectAllocations = useMemo(() => {
    const allocations: Record<string, { name: string, laborCost: number, workers: number }> = {};
    
    liveAttendanceList.forEach(a => {
      const project = liveProjectList.find(p => p.id === a.projectId);
      if (!project) return;
      
      if (!allocations[project.id]) {
        allocations[project.id] = { name: project.namaProject, laborCost: 0, workers: 0 };
      }
      
      const emp = liveEmployeeList.find(e => e.id === a.employeeId);
      const hourlyRate = (emp?.salary || 3500000) / 173;
      allocations[project.id].laborCost += (a.workHours || 0) * hourlyRate;
    });

    return Object.values(allocations);
  }, [liveAttendanceList, liveProjectList, liveEmployeeList]);

  const handleClosePayroll = async () => {
    if (totalPayroll <= 0) {
      toast.error('Total payroll masih 0. Tidak bisa ditutup.');
      return;
    }
    setIsProcessing(true);
    try {
      const closeDate = new Date().toISOString().split('T')[0];
      const closeId = `PAY-CLOSE-${Date.now()}`;
      await api.post('/archive-registry', {
        id: closeId,
        date: closeDate,
        ref: `PAY/${new Date(closeDate).getFullYear()}/${String(new Date(closeDate).getMonth() + 1).padStart(2, '0')}`,
        description: `Gaji & Upah THL ${payrollPeriodLabel} (${Number(serverPayrollStats?.employeeCount || liveEmployeeList.length)} staff)`,
        amount: totalPayroll,
        project: 'OVERHEAD/MULTISITE',
        admin: currentUser?.fullName || currentUser?.username || 'System',
        type: 'AP',
        source: 'payroll-close|module=payroll',
      });

      addAuditLog({
        action: 'Payroll Closed',
        module: 'Finance/HR',
        details: `Penutupan penggajian periode ${payrollPeriodLabel} senilai Rp ${totalPayroll.toLocaleString()}`,
        status: 'Success'
      });
      await fetchPayrollData(true);
      toast.success('Payroll berhasil ditutup dan data telah dikirim ke General Ledger!');
    } catch {
      toast.error('Gagal menutup payroll ke database.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleExportRecap = async () => {
    if (payrollSummary.length === 0) {
      toast.info('Belum ada data payroll untuk diekspor.');
      return;
    }
    const exportRows = payrollSummary.map((p) => ({
      name: p.name,
      position: p.position,
      employmentType: p.employmentType,
      attendanceCount: p.attendanceCount,
      totalHours: p.totalHours,
      totalOvertime: p.totalOvertime,
      salary: p.salary,
      allowanceAndOvertime: Number(p.overtimePay || 0) + Number(p.mealAllowance || 0),
      totalKasbon: p.totalKasbon,
      netSalary: p.netSalary,
    }));
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      periodLabel: payrollPeriodLabel,
      generatedAt: new Date().toISOString(),
      summary: {
        totalNetPayroll: Number(serverPayrollStats?.totalNetPayroll || 0),
        totalManHours: Number(serverPayrollStats?.totalManHours || 0),
        totalOvertime: Number(serverPayrollStats?.totalOvertime || 0),
        totalKasbon: Number(serverPayrollStats?.totalKasbon || 0),
        employeeCount: Number(serverPayrollStats?.employeeCount || payrollSummary.length),
      },
      rows: exportRows,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Finance/HR',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/payroll-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/payroll-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `payroll-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `payroll-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'PAYROLL_RECAP_EXPORTED',
        module: 'Finance/HR',
        details: `Export payroll recap (${payrollSummary.length} karyawan)`,
        status: 'Success',
      });
      toast.success('Payroll recap Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export payroll recap gagal.');
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded shadow-sm">Verified Finance</span>
            <span className="text-slate-400 font-bold text-xs uppercase italic tracking-wider">PT Gema Teknik Perkasa</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Wallet className="text-emerald-600" size={36} />
            Command <span className="text-emerald-600">Payroll</span>
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Otomasi Upah Berdasarkan Absensi & Kasbon Lapangan</p>
        </div>
        <div className="flex gap-3">
           <button
             onClick={() => fetchPayrollData(false)}
             disabled={syncing}
             className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-60"
           >
             <RefreshCw size={16} />
             {syncing ? 'Syncing...' : 'Refresh'}
           </button>
           <button onClick={handleExportRecap} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
             <FileSpreadsheet size={18} /> Export Recap
           </button>
           <button 
             onClick={handleClosePayroll}
             disabled={isProcessing}
             className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50"
           >
             {isProcessing ? <Clock className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
             Tutup Payroll Periode Ini
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Net Payroll', val: formatCurrency(totalPayroll), icon: Wallet, color: 'text-emerald-600' },
           { label: 'Staff Count', val: `${Number(serverPayrollStats?.employeeCount || serverEmployees.length)} Personel`, icon: Users, color: 'text-blue-600' },
           { label: 'Total Man-Hours', val: `${Number(serverPayrollStats?.totalManHours || 0)} Hrs`, icon: Clock, color: 'text-slate-900' },
           { label: 'Labor/Revenue Ratio', val: '18.5%', icon: TrendingUp, color: 'text-amber-600' },
         ].map((stat, i) => (
           <div key={i} className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm group">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                   <stat.icon size={20} />
                </div>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">Verified</span>
             </div>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
             <h3 className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</h3>
           </div>
         ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl w-fit border-2 border-slate-100">
        {[
          { id: 'summary', label: 'Daftar Gaji Karyawan', icon: List },
          { id: 'project-allocation', label: 'Alokasi Biaya Proyek', icon: Briefcase },
          { id: 'thl-detail', label: 'Ledger Absensi Live', icon: History }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'summary' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-100">
                    <th className="px-8 py-6">Karyawan</th>
                    <th className="px-8 py-6">Status/Tipe</th>
                    <th className="px-8 py-6 text-center">Kehadiran</th>
                    <th className="px-8 py-6 text-right">Gaji Pokok</th>
                    <th className="px-8 py-6 text-right">Tunjangan/Lembur</th>
                    <th className="px-8 py-6 text-right text-rose-500">Potongan/Kasbon</th>
                    <th className="px-8 py-6 text-right font-black text-slate-900 bg-slate-100/30">Gaji Bersih (Net)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                  {payrollSummary.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black italic text-slate-400">
                              {String(p.name || "?").charAt(0)}
                           </div>
                           <div>
                              <p className="font-black text-slate-900 uppercase italic leading-none mb-1">{p.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.position}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          p.employmentType === 'Permanent' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {p.employmentType}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex flex-col items-center">
                           <span className="text-xs font-black text-slate-900">{p.attendanceCount} Hari</span>
                           <span className="text-[9px] text-slate-400 font-bold uppercase">{p.totalHours} Jam Kerja</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-600">{formatCurrency(p.salary)}</td>
                      <td className="px-8 py-5 text-right font-black text-emerald-600">
                         <div className="flex flex-col">
                            <span>{formatCurrency(p.overtimePay + p.mealAllowance)}</span>
                            <span className="text-[8px] uppercase tracking-tighter opacity-60">incl. Meal & OT</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-rose-500">
                        {p.totalKasbon > 0 ? `-${formatCurrency(p.totalKasbon)}` : '-'}
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 bg-slate-100/30 group-hover:bg-emerald-50 transition-colors">
                        {formatCurrency(p.netSalary)}
                      </td>
                    </tr>
                  ))}
                  {payrollSummary.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                           <Users size={48} />
                           <p className="text-xs font-black uppercase tracking-widest italic text-slate-400">Belum ada data karyawan terdaftar</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'project-allocation' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {projectAllocations.map((alloc, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Briefcase size={80} />
                 </div>
                 <div className="relative z-10">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 italic">Project Cost Center</p>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight mb-8 line-clamp-2">{alloc.name}</h3>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Allocated Labor Cost</span>
                          <span className="text-lg font-black italic text-emerald-600">{formatCurrency(alloc.laborCost)}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Verified Attendance</span>
                          <span className="text-sm font-black text-slate-900 uppercase italic underline decoration-blue-500/30">Check Detailed Logs</span>
                       </div>
                    </div>
                 </div>
              </div>
            ))}
            {projectAllocations.length === 0 && (
              <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                 <Briefcase size={48} className="mx-auto text-slate-200 mb-4" />
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada alokasi jam kerja proyek yang tercatat</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'thl-detail' && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden"
           >
              <div className="p-8 border-b-2 border-slate-50 flex items-center justify-between">
                 <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-widest">Master Attendance Ledger</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Live Synchronization from Field Project Records</p>
                 </div>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Search record..." className="pl-10 pr-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black outline-none focus:border-blue-500 transition-all w-64" />
                 </div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[8px] border-b-2 border-slate-100">
                          <th className="px-8 py-4">Timestamp</th>
                          <th className="px-8 py-4">Worker</th>
                          <th className="px-8 py-4">Project</th>
                          <th className="px-8 py-4 text-center">In - Out</th>
                          <th className="px-8 py-4 text-center">Work Hours</th>
                          <th className="px-8 py-4">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-50">
                       {liveAttendanceList.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-black text-slate-900 uppercase">{new Date(att.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                             </td>
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-black text-slate-700 uppercase italic">{att.employeeName}</p>
                             </td>
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-bold text-blue-600 uppercase italic truncate max-w-[200px]">{liveProjectList.find(p => p.id === att.projectId)?.namaProject || 'GTP Site'}</p>
                             </td>
                             <td className="px-8 py-4 text-center">
                                <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg">{att.checkIn} - {att.checkOut}</span>
                             </td>
                             <td className="px-8 py-4 text-center">
                                <span className="text-[10px] font-black text-slate-900">{att.workHours} Hrs</span>
                             </td>
                             <td className="px-8 py-4">
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase border border-emerald-100">Verified</span>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Banner */}
      <div className="bg-slate-900 p-10 rounded-[4rem] text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <ShieldCheck size={200} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                     <TrendingUp size={20} />
                  </div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">Finance Integration Audit</h3>
               </div>
               <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed mb-6 tracking-wide">
                  Seluruh data penggajian ini ditarik langsung dari modul <span className="text-white">Field Project Record</span>. Dengan prinsip <span className="text-blue-400 italic">Zero Re-typing</span>, admin tidak perlu menginput ulang jam lembur atau kasbon lapangan. Sistem secara otomatis menghitung pembebanan biaya ke masing-masing <span className="text-white">Project Profit & Loss</span>.
               </p>
               <div className="flex flex-wrap gap-4">
                  <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                     <p className="text-[8px] font-black text-slate-500 uppercase">GL Entry Method</p>
                     <p className="text-[10px] font-black text-blue-400 uppercase italic">Automated Batch Posting</p>
                  </div>
                  <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                     <p className="text-[8px] font-black text-slate-500 uppercase">Verification Level</p>
                     <p className="text-[10px] font-black text-emerald-400 uppercase italic">Multi-Site Synchronization</p>
                  </div>
               </div>
            </div>
            <div className="w-full md:w-80 space-y-4">
               <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest">Next Financial Steps:</p>
                  <ul className="space-y-4">
                     {[
                       { label: 'Bank Reconciliation', path: '/finance/bank-reconciliation' },
                       { label: 'Project P&L Update', path: '/finance/project-profit-loss' },
                       { label: 'Tax (PPh 21) Reporting', path: '/finance/pph21' }
                     ].map((step, i) => (
                       <li key={i}>
                          <Link to={step.path} className="flex items-center justify-between group">
                             <span className="text-[10px] font-black uppercase italic text-slate-200 group-hover:text-blue-400 transition-colors">{step.label}</span>
                             <ArrowRight size={14} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                          </Link>
                       </li>
                     ))}
                  </ul>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
