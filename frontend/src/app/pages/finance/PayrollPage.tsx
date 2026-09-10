import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { 
  Wallet, 
  Search, 
  Download, 
  FileText, 
  Filter, 
  ChevronRight, 
  Clock, 
  Calendar,
  Users,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  ExternalLink,
  ChevronDown,
  BadgeCheck,
  CircleDot,
  Banknote,
  CalendarClock,
  RotateCcw
} from 'lucide-react';
import { useApp, type Attendance, type Employee, type Project, type PayrollRecord, type PayrollEntry, type WorkingExpenseSheet, type BKExpenseItem } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { downloadPayrollWordDocument } from '../../components/PayrollWordExport';
import { exportEmployeePayrollSlips } from '../../utils/payrollSlipExcelExport';

export default function PayrollPage() {
  const { employeeList, attendanceList, projectList, thlList, kasbonList = [], addAuditLog, addArchiveEntry, payrollRecords, addPayrollRecord, updatePayrollRecord, markEmployeePaid, addPayroll, workingExpenseSheets, addWorkingExpenseSheet, updateWorkingExpenseSheet } = useApp();
  const [activeTab, setActiveTab] = useState<'summary' | 'thl-detail' | 'project-allocation' | 'payment-status'>('summary');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Logic Perhitungan Otomatis (Zero Re-typing) ---
  
  // 1. Group attendance by employee
  const payrollSummary = useMemo(() => {
    return employeeList.map(emp => {
      const empAttendance = attendanceList.filter(a => a.employeeId === emp.id);
      const totalHours = empAttendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
      const totalOvertime = empAttendance.reduce((sum, a) => sum + (a.overtime || 0), 0);
      
      const totalKasbon = kasbonList
        .filter(k => k.employeeId === emp.id && k.status !== 'Rejected')
        .reduce((s, k) => s + k.nominal, 0);

      const baseSalary = emp.salary || 0;
      const hourlyRate = baseSalary / 173; // Standard calculation
      const overtimePay = totalOvertime * hourlyRate * 1.5; // Simplified
      
      const mealAllowance = empAttendance.filter(a => a.status === 'Present').length * 38000;
      const grossSalary = baseSalary + overtimePay + mealAllowance;
      const netSalary = grossSalary - totalKasbon;

      return {
        ...emp,
        totalHours,
        totalOvertime,
        totalKasbon,
        overtimePay,
        mealAllowance,
        grossSalary,
        netSalary,
        attendanceCount: empAttendance.length
      };
    });
  }, [employeeList, attendanceList, projectList]);

  // THL wages calculation: upah earned minus kasbon THL
  const thlPayrollSummary = useMemo(() => {
    return thlList.filter(t => t.status === 'Active').map(t => {
      const kasbonTHL = projectList.reduce((sum, p) => {
        const entries = (p.kasbonTHL || []).filter((k: any) => k.thlId === t.id);
        return sum + entries.reduce((s: number, k: any) => s + (k.nominal || 0), 0);
      }, 0);
      const upahEarned = t.upahHarian * t.jumlahHari;
      const netUpah = upahEarned - kasbonTHL;
      return { ...t, upahEarned, kasbonTHL, netUpah };
    });
  }, [thlList, projectList]);

  const totalTHLUpah = useMemo(() => thlPayrollSummary.reduce((s, t) => s + t.netUpah, 0), [thlPayrollSummary]);

  const handleCatatUpahTHL = async () => {
    if (thlPayrollSummary.length === 0) return;
    setIsProcessing(true);
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const periodLabel = today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    // Group THL by project — each project gets its own BK Sheet
    const byProject: Record<string, typeof thlPayrollSummary> = {};
    thlPayrollSummary.forEach(t => {
      const projectId = (t as any).projectId || 'unassigned';
      if (!byProject[projectId]) byProject[projectId] = [];
      byProject[projectId].push(t);
    });

    // Fallback: one sheet for all if no project grouping
    const groups = Object.entries(byProject);
    if (groups.length === 0) { setIsProcessing(false); return; }

    // Track successful writes for potential rollback
    const completedUpdates: { id: string; previousItems: BKExpenseItem[] }[] = [];
    const completedSheets: { id: string }[] = [];

    try {
      groups.forEach(([projectId, thls]) => {
        const project = projectList.find(p => p.id === projectId);
        const projectName = project?.namaProject || 'Unassigned';
        const sheetNo = `${String(workingExpenseSheets.length + 1).padStart(3, '0')}/BK-THL/GTP/${today.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }).replace(' ', '/')}`;

        // Check if a BK sheet for this project+period already exists
        const existing = workingExpenseSheets.find(s =>
          s.project === projectName &&
          s.items.some(i => i.category === 'Upah THL')
        );

        const items: BKExpenseItem[] = thls.map((t, i) => ({
          id: `thl-${t.id}-${Date.now()}-${i}`,
          date: `${dateStr.slice(8)}-${dateStr.slice(5, 7)}`,
          category: 'Upah THL',
          description: `${t.nama} — ${t.jumlahHari} hari × Rp ${(t.upahHarian || 0).toLocaleString('id-ID')}`,
          nominal: t.netUpah,
          hasNota: 'T' as const,
          remark: t.kasbonTHL > 0 ? `Kasbon: Rp ${t.kasbonTHL.toLocaleString('id-ID')}` : '',
        }));

        if (existing) {
          completedUpdates.push({ id: existing.id, previousItems: existing.items });
          updateWorkingExpenseSheet(existing.id, { items: [...existing.items, ...items] });
        } else {
          const sheet: WorkingExpenseSheet = {
            id: `BK-THL-${Date.now()}-${projectId}`,
            client: project?.customer || '-',
            project: projectName,
            location: '-',
            date: today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            noHal: sheetNo,
            revisi: '0',
            items,
            totalKas: thls.reduce((s, t) => s + t.netUpah, 0),
            status: 'Draft',
          };
          completedSheets.push({ id: sheet.id });
          addWorkingExpenseSheet(sheet);
        }
      });

      try {
        addAuditLog({
          action: 'THL Wages Recorded',
          module: 'Finance/Payroll',
          details: `Upah THL ${periodLabel} — ${thlPayrollSummary.length} orang — Total: Rp ${totalTHLUpah.toLocaleString('id-ID')}`,
          status: 'Success',
        });
      } catch (auditErr) {
        // Rollback: restore updated sheets to their previous items
        completedUpdates.forEach(({ id, previousItems }) => {
          updateWorkingExpenseSheet(id, { items: previousItems });
        });
        throw auditErr;
      }

      toast.success(`Upah THL ${periodLabel} dicatat ke Biaya Kerja`, {
        description: `${thlPayrollSummary.length} THL → ${groups.length} BK Sheet`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencatat upah THL');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPayroll = useMemo(() => {
    const karyawanTotal = payrollSummary.reduce((sum, p) => sum + p.netSalary, 0);
    return karyawanTotal + totalTHLUpah;
  }, [payrollSummary, totalTHLUpah]);

  const projectAllocations = useMemo(() => {
    const allocations: Record<string, { name: string, laborCost: number, workers: number }> = {};
    
    attendanceList.forEach(a => {
      const project = projectList.find(p => p.id === a.projectId);
      if (!project) return;
      
      if (!allocations[project.id]) {
        allocations[project.id] = { name: project.namaProject, laborCost: 0, workers: 0 };
      }
      
      const emp = employeeList.find(e => e.id === a.employeeId);
      // Never invent a salary when the employee master is incomplete. An
      // implicit fallback would overstate project labour cost.
      const hourlyRate = (emp?.salary || 0) / 173;
      allocations[project.id].laborCost += (a.workHours || 0) * hourlyRate;
    });

    return Object.values(allocations);
  }, [attendanceList, projectList, employeeList]);

  const handleClosePayroll = async () => {
    setIsProcessing(true);
    try {
      const now = new Date();
      const period = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const payId = `PAY-${Date.now()}`;

      // Step 1: Push to payrollList → auto-muncul di General Ledger & CashFlow
      addPayroll({
        id: payId,
        month: monthStr,
        year: now.getFullYear(),
        totalPayroll,
        status: 'Disbursed',
        employeeCount: payrollSummary.length + thlPayrollSummary.length,
      });

      // Step 2: Audit Log — rollback step 1 if this fails
      try {
        addAuditLog({
          action: 'Payroll Disbursed',
          module: 'Finance/HR',
          details: `Penggajian ${period} — ${payrollSummary.length} karyawan + ${thlPayrollSummary.length} THL — Total: Rp ${totalPayroll.toLocaleString('id-ID')}`,
          status: 'Success'
        });
      } catch (auditErr) {
        try {
          const { api } = await import('../../services/api');
          await api.request(`/payrolls/${encodeURIComponent(payId)}`, { method: 'DELETE' });
        } catch { /* best-effort rollback */ }
        throw auditErr;
      }

      // Step 3: Digital Archive — rollback steps 1-2 if this fails
      try {
        addArchiveEntry({
          date: now.toISOString().split('T')[0],
          ref: payId,
          description: `Gaji ${period} (${payrollSummary.length} karyawan + ${thlPayrollSummary.length} THL)`,
          amount: totalPayroll,
          project: 'OVERHEAD/MULTISITE',
          admin: 'Admin',
          type: 'AP',
          source: 'Payroll Module'
        });
      } catch (archiveErr) {
        try {
          const { api } = await import('../../services/api');
          await api.request(`/payrolls/${encodeURIComponent(payId)}`, { method: 'DELETE' });
        } catch { /* best-effort rollback */ }
        throw archiveErr;
      }

      toast.success(`Payroll ${period} berhasil ditutup! Data otomatis masuk ke General Ledger & Cash Flow.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menutup payroll');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportWord = () => {
    const payrollData = {
      payrollSummary,
      totalPayroll,
      period: 'Mei 2025',
      generatedDate: new Date().toISOString()
    };
    
    const filename = `Payroll_${new Date().toISOString().split('T')[0]}.doc`;
    downloadPayrollWordDocument(payrollData, filename);
    
    toast.success('Dokumen payroll berhasil di-export ke Word!');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Next payroll: 25th of each month
  const nextPayrollDate = (() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() >= 25) d.setMonth(d.getMonth() + 1);
    return d;
  })();
  const daysUntilPayroll = Math.ceil((nextPayrollDate.getTime() - Date.now()) / 86400000);
  const currentPeriod = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const currentPeriodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Check if current period has been processed
  const currentRecord = payrollRecords.find(r => r.period === currentPeriodKey);

  const handleProcessPayroll = async () => {
    setIsProcessing(true);
    try {
      const entries: PayrollEntry[] = payrollSummary.map(p => ({
        employeeId: p.id,
        employeeName: p.name,
        position: p.position || '',
        grossSalary: p.grossSalary,
        deductions: p.totalKasbon,
        netSalary: p.netSalary,
        status: 'Pending',
      }));
      const record: PayrollRecord = {
        id: `PAY-${Date.now()}`,
        period: currentPeriodKey,
        periodLabel: currentPeriod,
        processedDate: new Date().toISOString().split('T')[0],
        totalAmount: totalPayroll,
        employeeCount: payrollSummary.length,
        status: 'Processed',
        entries,
        nextPayrollDate: nextPayrollDate.toISOString().split('T')[0],
        processedBy: 'Admin',
      };

      // Step 1: Add payroll record
      addPayrollRecord(record);

      // Step 2: Audit log — rollback step 1 if this fails
      try {
        addAuditLog({ action: 'Payroll Processed', module: 'Finance/HR', details: `Penggajian ${currentPeriod} diproses — ${payrollSummary.length} karyawan`, status: 'Success' });
      } catch (auditErr) {
        try {
          const { api } = await import('../../services/api');
          await api.request(`/finance-payroll-records/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
        } catch { /* best-effort rollback */ }
        throw auditErr;
      }

      // Step 3: Archive entry — rollback steps 1-2 if this fails
      try {
        addArchiveEntry({ date: new Date().toISOString().split('T')[0], ref: record.id, description: `Gaji ${currentPeriod} (${payrollSummary.length} staff)`, amount: totalPayroll, project: 'OVERHEAD', admin: 'Admin', type: 'AP', source: 'Payroll Module' });
      } catch (archiveErr) {
        try {
          const { api } = await import('../../services/api');
          await api.request(`/finance-payroll-records/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
        } catch { /* best-effort rollback */ }
        throw archiveErr;
      }

      toast.success(`Payroll ${currentPeriod} berhasil diproses! Tandai karyawan sebagai "Dibayar" di tab Status Pembayaran.`);
      setActiveTab('payment-status');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memproses payroll');
    } finally {
      setIsProcessing(false);
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
             onClick={handleExportWord}
             className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-blue-700 transition-all"
           >
             <FileText size={18} /> Export to Word
           </button>
           <button onClick={() => exportEmployeePayrollSlips(payrollSummary, currentPeriod)} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
             <FileSpreadsheet size={18} /> Export Slip Gaji Excel
           </button>
           <button
             onClick={handleProcessPayroll}
             disabled={isProcessing || !!currentRecord}
             className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50"
           >
             {isProcessing ? <Clock className="animate-spin" size={18} /> : currentRecord ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
             {currentRecord ? `Sudah Diproses — ${currentPeriod}` : 'Proses Payroll Periode Ini'}
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Net Payroll', val: formatCurrency(totalPayroll), icon: Wallet, color: 'text-emerald-600' },
           { label: 'Staff Count', val: `${employeeList.length} Personel`, icon: Users, color: 'text-blue-600' },
           { label: 'Total Man-Hours', val: `${attendanceList.reduce((sum, a) => sum + (a.workHours || 0), 0)} Hrs`, icon: Clock, color: 'text-slate-900' },
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
          { id: 'payment-status', label: 'Status Pembayaran', icon: BadgeCheck },
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
                              {p.name.charAt(0)}
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

            {/* THL Wages Section */}
            {thlPayrollSummary.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-3 mb-3 px-2">
                  <span className="px-3 py-1 bg-orange-600 text-white text-[9px] font-black uppercase rounded-lg tracking-widest">THL</span>
                  <h4 className="text-sm font-black text-slate-700 uppercase italic tracking-tight">Upah Tenaga Harian Lepas</h4>
                  <span className="text-[10px] text-slate-400 font-bold">({thlPayrollSummary.length} orang)</span>
                  <button
                    onClick={handleCatatUpahTHL}
                    disabled={isProcessing}
                    className="ml-auto px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <ArrowRight size={12} /> Catat ke Biaya Kerja
                  </button>
                </div>
                <div className="bg-white rounded-[2rem] border border-orange-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-orange-600 text-white">
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest">Nama THL</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest">Posisi</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-right">Hari Kerja</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-right">Upah/Hari</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-right">Upah Earned</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-right">Kasbon THL</th>
                        <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-right">Net Upah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50">
                      {thlPayrollSummary.map(t => (
                        <tr key={t.id} className="hover:bg-orange-50 transition-colors group">
                          <td className="px-6 py-4 font-black text-slate-900 uppercase italic">{t.nama}</td>
                          <td className="px-6 py-4 text-[10px] text-slate-500 font-bold uppercase">{t.posisi}</td>
                          <td className="px-6 py-4 text-right font-black text-slate-700">{t.jumlahHari}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(t.upahHarian)}</td>
                          <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(t.upahEarned)}</td>
                          <td className="px-6 py-4 text-right text-orange-500">{t.kasbonTHL > 0 ? `-${formatCurrency(t.kasbonTHL)}` : '-'}</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-700 bg-orange-50/40 group-hover:bg-emerald-50 transition-colors">{formatCurrency(t.netUpah)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 border-t-2 border-orange-200">
                        <td colSpan={6} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-orange-700">Total Upah THL</td>
                        <td className="px-6 py-3 text-right font-black text-orange-700">{formatCurrency(totalTHLUpah)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'payment-status' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Next Payroll Countdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><CalendarClock size={140} /></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jadwal Gajian Berikutnya</p>
                  <div className="flex items-end gap-4 mb-4">
                    <p className="text-5xl font-black text-emerald-400 leading-none">{daysUntilPayroll}</p>
                    <div>
                      <p className="text-lg font-black uppercase italic">Hari Lagi</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{nextPayrollDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${Math.max(5, 100 - (daysUntilPayroll / 31) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 tracking-widest">Tanggal gajian: setiap tanggal 25</p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-6 flex flex-col justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Periode Berjalan</p>
                  <p className="text-lg font-black text-slate-900 uppercase">{currentPeriod}</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Total Karyawan</span>
                      <span className="text-slate-900 font-black">{currentRecord?.employeeCount ?? employeeList.length}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Sudah Dibayar</span>
                      <span className="text-emerald-600 font-black">
                        {currentRecord ? currentRecord.entries.filter(e => e.status === 'Paid').length : 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Belum Dibayar</span>
                      <span className="text-rose-600 font-black">
                        {currentRecord ? currentRecord.entries.filter(e => e.status === 'Pending').length : employeeList.length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`mt-4 px-3 py-2 rounded-xl text-center text-[9px] font-black uppercase tracking-widest ${
                  currentRecord?.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                  currentRecord?.status === 'Processed' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-400'
                }`}>
                  {currentRecord?.status === 'Paid' ? '✓ Selesai Dibayar' :
                   currentRecord?.status === 'Processed' ? '⏳ Sedang Diproses' :
                   'Belum Diproses'}
                </div>
              </div>
            </div>

            {/* Current Period Payment Status */}
            {currentRecord ? (
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b-2 border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Status Per Karyawan — {currentRecord.periodLabel}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Diproses: {new Date(currentRecord.processedDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {' · '}Total: {formatCurrency(currentRecord.totalAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 uppercase">
                      {currentRecord.entries.filter(e => e.status === 'Paid').length}/{currentRecord.entries.length} Dibayar
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-100">
                        <th className="px-6 py-4">Karyawan</th>
                        <th className="px-6 py-4 text-right">Gaji Bersih</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Tgl Bayar</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-50">
                      {currentRecord.entries.map((entry) => (
                        <tr key={entry.employeeId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 text-sm">
                                {entry.employeeName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 uppercase">{entry.employeeName}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">{entry.position}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">{formatCurrency(entry.netSalary)}</td>
                          <td className="px-6 py-4 text-center">
                            {entry.status === 'Paid' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase border border-emerald-100">
                                <BadgeCheck size={12} /> Sudah Dibayar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase border border-amber-100">
                                <CircleDot size={12} /> Belum Dibayar
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">
                            {entry.paidDate ? new Date(entry.paidDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {entry.status === 'Pending' ? (
                              <button
                                onClick={async () => {
                                  if (processingId) return;
                                  setProcessingId(entry.employeeId);
                                  try {
                                    await markEmployeePaid(currentRecord.id, entry.employeeId);
                                    toast.success(`${entry.employeeName} ditandai sudah dibayar`);
                                  } catch (err) {
                                    toast.error('Gagal menandai dibayar: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                  } finally {
                                    setProcessingId(null);
                                  }
                                }}
                                disabled={processingId === entry.employeeId}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Banknote size={12} /> Tandai Dibayar
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (processingId) return;
                                  setProcessingId(entry.employeeId);
                                  try {
                                    await updatePayrollRecord(currentRecord.id, {
                                      entries: currentRecord.entries.map(e =>
                                        e.employeeId === entry.employeeId ? { ...e, status: 'Pending', paidDate: undefined } : e
                                      ),
                                      status: 'Processed',
                                    });
                                    toast.info(`${entry.employeeName} dikembalikan ke status Belum Dibayar`);
                                  } catch (err) {
                                    toast.error('Gagal membatalkan status bayar: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                  } finally {
                                    setProcessingId(null);
                                  }
                                }}
                                disabled={processingId === entry.employeeId}
                                className="px-3 py-2 border-2 border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:border-rose-300 hover:text-rose-500 flex items-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCcw size={10} /> Batalkan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 py-20 text-center">
                <Banknote size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Payroll {currentPeriod} belum diproses</p>
                <p className="text-[10px] text-slate-300 font-bold uppercase mt-2">Klik "Proses Payroll Periode Ini" untuk memulai</p>
              </div>
            )}

            {/* History */}
            {payrollRecords.filter(r => r.period !== currentPeriodKey).length > 0 && (
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b-2 border-slate-50">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Riwayat Penggajian</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b-2 border-slate-100">
                        <th className="px-6 py-4">Periode</th>
                        <th className="px-6 py-4 text-center">Karyawan</th>
                        <th className="px-6 py-4 text-right">Total Dibayar</th>
                        <th className="px-6 py-4 text-center">Tanggal Proses</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-50">
                      {payrollRecords.filter(r => r.period !== currentPeriodKey).map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-900 text-sm uppercase">{rec.periodLabel}</td>
                          <td className="px-6 py-4 text-center text-sm font-black text-slate-600">{rec.employeeCount}</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(rec.totalAmount)}</td>
                          <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">
                            {new Date(rec.processedDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border ${
                              rec.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              rec.status === 'Processed' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-slate-50 text-slate-400 border-slate-100'
                            }`}>
                              {rec.status === 'Paid' ? '✓ Lunas' : rec.status === 'Processed' ? '⏳ Proses' : 'Draft'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                    <input type="text" placeholder="Search record..." className="pl-10 pr-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black text-black outline-none focus:border-blue-500 transition-all w-64" />
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
                       {attendanceList.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-black text-slate-900 uppercase">{new Date(att.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                             </td>
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-black text-slate-700 uppercase italic">{att.employeeName}</p>
                             </td>
                             <td className="px-8 py-4">
                                <p className="text-[10px] font-bold text-blue-600 uppercase italic truncate max-w-[200px]">{projectList.find(p => p.id === att.projectId)?.namaProject || 'GTP Site'}</p>
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
                       { label: 'Project P&L Update', path: '/finance/project-analysis' },
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

function List({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}

function History({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v13m0 0l4-4m-4 4l-4-4"></path>
      <path d="M3 3h18v2H3V3z"></path>
    </svg>
  );
}
