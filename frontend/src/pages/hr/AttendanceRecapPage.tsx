import { useEffect, useState, useMemo } from 'react'; import { Calendar, ChevronLeft, ChevronRight, Download, Filter, Users, Clock, AlertCircle, FileText, TrendingUp } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import type { Attendance, Employee } from '../../contexts/AppContext';
import api from '../../services/api';

interface AttendanceStats {
  ijin: number;
  sakit: number;
  cutiPribadi: number;
  cutiBersama: number;
  overtime: number;
}

export default function AttendanceRecapPage() {
  const { attendanceList, employeeList, currentUser } = useApp();
  const [serverAttendanceList, setServerAttendanceList] = useState<Attendance[] | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<Employee[] | null>(null);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) {
        return payload.map((row: any) => {
          if (row && typeof row === 'object' && 'payload' in row) {
            const item = (row as { payload?: any }).payload || {};
            const id = item.id || row.entityId || row.id;
            return { id, ...item } as T;
          }
          return row as T;
        });
      }
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return normalizeList<T>((payload as { items: unknown[] }).items);
      }
      return [];
    };

    const loadPageData = async () => {
      try {
        const [attendanceRes, employeesRes] = await Promise.all([
          api.get('/attendances'),
          api.get('/employees'),
        ]);
        if (!mounted) return;
        setServerAttendanceList(normalizeList<Attendance>(attendanceRes.data));
        setServerEmployeeList(normalizeList<Employee>(employeesRes.data));
      } catch {
        if (!mounted) return;
        setServerAttendanceList(null);
        setServerEmployeeList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveAttendanceList = serverAttendanceList ?? attendanceList;
  const effectiveEmployeeList = serverEmployeeList ?? employeeList;

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Calculate recap from real attendanceList in context
  const processedData = useMemo(() => {
    return (effectiveEmployeeList || []).map(emp => {
      const yearlyStats = months.map((monthName, idx) => {
        const monthNum = (idx + 1).toString().padStart(2, '0');
        const periodStr = `${selectedYear}-${monthNum}`;
        
        const monthAttendances = (effectiveAttendanceList || []).filter(a => 
          a && (a.employeeId === emp.id || a.employeeName === emp.name) && 
          (a.date || '').startsWith(periodStr)
        );

        return {
          month: monthName,
          stats: {
            ijin: monthAttendances.filter(a => a.status === 'Permission').length,
            sakit: monthAttendances.filter(a => a.status === 'Sick').length,
            cutiPribadi: monthAttendances.filter(a => a.status === 'Leave' && a.notes?.toLowerCase().includes('pribadi')).length,
            cutiBersama: monthAttendances.filter(a => a.status === 'Leave' && a.notes?.toLowerCase().includes('bersama')).length,
            overtime: monthAttendances.reduce((sum, a) => sum + (a.overtime || 0), 0)
          }
        };
      });

      return {
        id: emp.id,
        name: emp.name,
        monthly: yearlyStats
      };
    });
  }, [effectiveAttendanceList, effectiveEmployeeList, selectedYear]);

  const getMonthStats = (employee: any, month: string): AttendanceStats => {
    return employee.monthly.find((m: any) => m.month === month)?.stats || { ijin: 0, sakit: 0, cutiPribadi: 0, cutiBersama: 0, overtime: 0 };
  };

  const getYearlyTotal = (employee: any): AttendanceStats => {
    return employee.monthly.reduce((acc: any, curr: any) => ({
      ijin: acc.ijin + curr.stats.ijin,
      sakit: acc.sakit + curr.stats.sakit,
      cutiPribadi: acc.cutiPribadi + curr.stats.cutiPribadi,
      cutiBersama: acc.cutiBersama + curr.stats.cutiBersama,
      overtime: acc.overtime + curr.stats.overtime,
    }), { ijin: 0, sakit: 0, cutiPribadi: 0, cutiBersama: 0, overtime: 0 });
  };

  const filteredEmployees = processedData.filter(e =>
    String(e.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())
  );

  const yearlyTotals = filteredEmployees.reduce(
    (acc, emp) => {
      const total = getYearlyTotal(emp);
      acc.ijin += total.ijin;
      acc.sakit += total.sakit;
      acc.cutiPribadi += total.cutiPribadi;
      acc.cutiBersama += total.cutiBersama;
      acc.overtime += total.overtime;
      return acc;
    },
    { ijin: 0, sakit: 0, cutiPribadi: 0, cutiBersama: 0, overtime: 0 }
  );

  const handleExportExcel = async () => {
    const headers = ['Nama', 'Bulan', 'Ijin', 'Sakit', 'CutiPribadi', 'CutiBersama', 'Overtime'];
    const rows: Array<Array<string | number>> = [];
    filteredEmployees.forEach((emp) => {
      emp.monthly.forEach((m: any) => {
        rows.push([
          emp.name,
          m.month,
          m.stats.ijin,
          m.stats.sakit,
          m.stats.cutiPribadi,
          m.stats.cutiBersama,
          m.stats.overtime,
        ]);
      });
    });
    if (!rows.length) {
      toast.info('Tidak ada data attendance untuk diekspor.');
      return;
    }
    const payload = {
      filename: `attendance-recap-${selectedYear}`,
      title: 'Attendance Recap Report',
      subtitle: `Tahun ${selectedYear} | Total karyawan ${filteredEmployees.length}`,
      columns: headers,
      rows,
      notes: `Ringkasan tahunan: ijin ${yearlyTotals.ijin} hari, sakit ${yearlyTotals.sakit} hari, cuti pribadi ${yearlyTotals.cutiPribadi} hari, cuti bersama ${yearlyTotals.cutiBersama} hari, lembur ${yearlyTotals.overtime} jam.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'HR Attendance',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `attendance-recap-${selectedYear}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `attendance-recap-${selectedYear}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Rekap attendance Word + Excel berhasil di-export');
    } catch {
      toast.error('Export rekap attendance gagal');
    }
  };

  const handleExportPdf = () => {
    window.print();
    toast.success('Mode print PDF dibuka. Pilih Save as PDF.');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rekapitulasi Kehadiran Tahunan</h1>
          <p className="text-gray-500 flex items-center gap-2">
            <Calendar size={16} />
            Januari s/d Desember {selectedYear} - PT Gema Teknik Perkasa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <Download size={18} />
            <span>Export PDF</span>
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md">
            <Download size={18} />
            <span>Export Word + Excel</span>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari Nama Karyawan..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSelectedYear(prev => prev - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 py-2 font-bold text-gray-900 border border-gray-200 rounded-lg bg-gray-50">
            {selectedYear}
          </div>
          <button 
            onClick={() => setSelectedYear(prev => prev + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-all">
          <Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th rowSpan={2} className="px-4 py-3 text-left border border-slate-700 min-w-[150px] sticky left-0 bg-slate-900 z-10">Nama</th>
                {months.slice(0, 6).map(month => (
                  <th key={month} colSpan={5} className="px-2 py-2 text-center border border-slate-700 text-xs font-bold uppercase tracking-wider">{month}</th>
                ))}
              </tr>
              <tr className="bg-slate-800 text-slate-300">
                {months.slice(0, 6).flatMap(month => [
                  <th key={`${month}-ijin`} className="px-1 py-1 text-[10px] border border-slate-700 w-8">Ijin</th>,
                  <th key={`${month}-sakit`} className="px-1 py-1 text-[10px] border border-slate-700 w-8">Sakit</th>,
                  <th key={`${month}-cp`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-blue-900/30">C.P</th>,
                  <th key={`${month}-cb`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-amber-900/30">C.B</th>,
                  <th key={`${month}-ot`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-green-900/30">OT</th>
                ])}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 group">
                  <td className="px-4 py-2 border border-gray-100 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">{emp.name}</td>
                  {months.slice(0, 6).flatMap(month => {
                    const stats = getMonthStats(emp, month);
                    return [
                      <td key={`${emp.id}-${month}-ijin`} className={`px-1 py-2 text-center border border-gray-100 text-xs ${stats.ijin > 0 ? 'text-blue-600 font-black' : 'text-gray-300'}`}>{stats.ijin || 0}</td>,
                      <td key={`${emp.id}-${month}-sakit`} className={`px-1 py-2 text-center border border-gray-100 text-xs ${stats.sakit > 0 ? 'text-red-600 font-black' : 'text-gray-300'}`}>{stats.sakit || 0}</td>,
                      <td key={`${emp.id}-${month}-cp`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-blue-50/50 ${stats.cutiPribadi > 0 ? 'text-blue-700 font-black' : 'text-gray-300'}`}>{stats.cutiPribadi || 0}</td>,
                      <td key={`${emp.id}-${month}-cb`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-amber-50/50 ${stats.cutiBersama > 0 ? 'text-amber-700 font-black' : 'text-gray-300'}`}>{stats.cutiBersama || 0}</td>,
                      <td key={`${emp.id}-${month}-ot`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-green-50/50 ${stats.overtime > 0 ? 'text-green-700 font-black' : 'text-gray-300'}`}>{stats.overtime.toFixed(1)}</td>
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Second Half (Jul-Dec) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden mt-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th rowSpan={2} className="px-4 py-3 text-left border border-slate-700 min-w-[150px] sticky left-0 bg-slate-900 z-10">Nama</th>
                {months.slice(6, 12).map(month => (
                  <th key={month} colSpan={5} className="px-2 py-2 text-center border border-slate-700 text-xs font-bold uppercase tracking-wider">{month}</th>
                ))}
              </tr>
              <tr className="bg-slate-800 text-slate-300">
                {months.slice(6, 12).flatMap(month => [
                  <th key={`${month}-ijin`} className="px-1 py-1 text-[10px] border border-slate-700 w-8">Ijin</th>,
                  <th key={`${month}-sakit`} className="px-1 py-1 text-[10px] border border-slate-700 w-8">Sakit</th>,
                  <th key={`${month}-cp`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-blue-900/30">C.P</th>,
                  <th key={`${month}-cb`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-amber-900/30">C.B</th>,
                  <th key={`${month}-ot`} className="px-1 py-1 text-[10px] border border-slate-700 w-8 bg-green-900/30">OT</th>
                ])}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 group">
                  <td className="px-4 py-2 border border-gray-100 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">{emp.name}</td>
                  {months.slice(6, 12).flatMap(month => {
                    const stats = getMonthStats(emp, month);
                    return [
                      <td key={`${emp.id}-${month}-ijin`} className={`px-1 py-2 text-center border border-gray-100 text-xs ${stats.ijin > 0 ? 'text-blue-600 font-black' : 'text-gray-300'}`}>{stats.ijin || 0}</td>,
                      <td key={`${emp.id}-${month}-sakit`} className={`px-1 py-2 text-center border border-gray-100 text-xs ${stats.sakit > 0 ? 'text-red-600 font-black' : 'text-gray-300'}`}>{stats.sakit || 0}</td>,
                      <td key={`${emp.id}-${month}-cp`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-blue-50/50 ${stats.cutiPribadi > 0 ? 'text-blue-700 font-black' : 'text-gray-300'}`}>{stats.cutiPribadi || 0}</td>,
                      <td key={`${emp.id}-${month}-cb`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-amber-50/50 ${stats.cutiBersama > 0 ? 'text-amber-700 font-black' : 'text-gray-300'}`}>{stats.cutiBersama || 0}</td>,
                      <td key={`${emp.id}-${month}-ot`} className={`px-1 py-2 text-center border border-gray-100 text-xs bg-green-50/50 ${stats.overtime > 0 ? 'text-green-700 font-black' : 'text-gray-300'}`}>{stats.overtime.toFixed(1)}</td>
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yearly Summary Cards (Bottom Section) */}
      <div className="mt-12">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 italic uppercase">
          <FileText size={24} className="text-blue-600" />
          Grand Total Summary 2025
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredEmployees.map((emp, idx) => {
            const totals = getYearlyTotal(emp);
            return (
              <div key={`summary-${emp.id}`} className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-lg group-hover:bg-blue-600 transition-colors">
                    {idx + 1}
                  </div>
                  <h4 className="font-black text-gray-900 uppercase tracking-tighter italic">{emp.name}</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-gray-500 font-medium">Ijin :</span>
                    <span className="font-bold text-gray-900">{totals.ijin}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-gray-500 font-medium">Sakit :</span>
                    <span className="font-bold text-red-600">{totals.sakit}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-gray-500 font-medium">Cuti Pribadi :</span>
                    <span className="font-bold text-blue-600">{totals.cutiPribadi}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-gray-500 font-medium">Overtime :</span>
                    <span className="font-bold text-green-600">{totals.overtime.toFixed(1)} Jam</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-500 font-medium">Cuti Bersama :</span>
                    <span className="font-bold text-amber-600">{totals.cutiBersama}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-slate-50">
                   <div className="bg-slate-50 p-3 rounded-xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Absen</div>
                      <div className="text-xl font-black text-slate-900 italic tracking-tighter">
                         {totals.ijin + totals.sakit + totals.cutiPribadi + totals.cutiBersama} Hari
                      </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Section (Matching image) */}
      <div className="mt-8 bg-amber-50 border-2 border-amber-100 p-6 rounded-2xl">
         <h4 className="text-amber-800 font-black uppercase italic tracking-widest text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            Catatan Penting / Notes:
         </h4>
         <div className="space-y-2 text-sm font-bold text-amber-900/80">
            <p>• 9 Juni 2025 : Cuti Bersama Idul Adha</p>
            <p>• 18 Agustus 2025 : Cuti Bersama 17 Agustus</p>
         </div>
      </div>
    </div>
  );
}
