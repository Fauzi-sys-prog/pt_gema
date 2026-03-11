import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../services/api';
import { 
  CreditCard, 
  ShoppingCart, 
  Users, 
  Receipt, 
  Search, 
  Plus, 
  Download,
  CalendarDays,
  DollarSign
} from 'lucide-react';

export const FinancePage: React.FC = () => {
  const { poList = [], employeeList = [], payrollList = [], generatePayroll, maintenanceList = [] } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'purchasing' | 'payroll' | 'maintenance'>('purchasing');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverPoList, setServerPoList] = useState<typeof poList | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<typeof employeeList | null>(null);
  const [serverPayrollList, setServerPayrollList] = useState<typeof payrollList | null>(null);
  const [serverMaintenanceList, setServerMaintenanceList] = useState<typeof maintenanceList | null>(null);
  const effectivePoList = serverPoList ?? poList;
  const effectiveEmployeeList = serverEmployeeList ?? employeeList;
  const effectivePayrollList = serverPayrollList ?? payrollList;
  const effectiveMaintenanceList = serverMaintenanceList ?? maintenanceList;

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload ?? {};
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return payload as T;
    });

  const fetchFinanceSources = async () => {
    try {
      setIsRefreshing(true);
      const [poRes, employeeRes, payrollRes, maintenanceRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/employees'),
        api.get('/payrolls'),
        api.get('/maintenances'),
      ]);
      setServerPoList(Array.isArray(poRes.data) ? poRes.data : []);
      setServerEmployeeList(normalizeEntityRows<any>(Array.isArray(employeeRes.data) ? employeeRes.data : []));
      setServerPayrollList(normalizeEntityRows<any>(Array.isArray(payrollRes.data) ? payrollRes.data : []));
      setServerMaintenanceList(normalizeEntityRows<any>(Array.isArray(maintenanceRes.data) ? maintenanceRes.data : []));
    } catch {
      setServerPoList(null);
      setServerEmployeeList(null);
      setServerPayrollList(null);
      setServerMaintenanceList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchFinanceSources();
  }, []);

  const handleCreatePO = () => {
    toast.info('Gunakan menu Purchasing utama untuk membuat PO baru.');
  };

  const handleDownloadPO = (noPO: string) => {
    toast.success(`Dokumen ${noPO} siap diunduh dari modul Purchasing.`);
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 mt-16 ml-0 sm:ml-64 min-h-screen bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-4 sm:mb-6 lg:mb-8">
        <div className="w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight truncate">Financial Hub</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Manajemen Pengadaan, Biaya Proyek, dan Payroll Karyawan</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => void fetchFinanceSources()}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveSubTab('purchasing')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all whitespace-nowrap ${activeSubTab === 'purchasing' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Purchasing (PO)
          </button>
          <button 
            onClick={() => setActiveSubTab('payroll')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all whitespace-nowrap ${activeSubTab === 'payroll' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Payroll & Attendance
          </button>
          <button 
            onClick={() => setActiveSubTab('maintenance')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all whitespace-nowrap ${activeSubTab === 'maintenance' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Maintenance Costs
          </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'purchasing' ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <div className="relative w-full sm:w-72">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex-shrink-0" size={16} />
                 <input type="text" placeholder="Cari No. PO atau Supplier..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-blue-300 transition-all" />
              </div>
              <button onClick={handleCreatePO} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 whitespace-nowrap">
                 <Plus size={14} />
                 <span className="hidden sm:inline">Buat Purchase Order</span>
                 <span className="sm:hidden">Buat PO</span>
              </button>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase">No. PO</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase">Tanggal</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase">Supplier</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-right">Total IDR</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase">Status</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {effectivePoList.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4"><p className="font-bold text-blue-600 text-xs">{po.noPO}</p></td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs font-bold text-slate-500">{new Date(po.tanggal).toLocaleDateString()}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4"><p className="font-bold text-slate-800 text-xs truncate max-w-[120px] sm:max-w-none">{po.supplier}</p></td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right"><p className="font-black text-slate-900 text-xs whitespace-nowrap">Rp {po.total.toLocaleString()}</p></td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                           <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                             po.status === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                              {po.status}
                           </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                           <button onClick={() => handleDownloadPO(po.noPO)} className="p-2 text-slate-400 hover:text-blue-600"><Download size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'maintenance' ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest italic">Asset Maintenance Costs</h3>
              <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 w-full sm:w-auto">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Total Expenses</p>
                <p className="text-lg sm:text-xl font-black text-emerald-900 tracking-tighter break-words">Rp {(effectiveMaintenanceList || []).filter(m => m && m.status === 'Completed').reduce((sum, m) => sum + (m.cost || 0), 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Maintenance No</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Details</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Cost IDR</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {effectiveMaintenanceList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4"><p className="font-bold text-blue-600 text-xs">{m.maintenanceNo}</p></td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <p className="font-bold text-slate-800 text-xs truncate max-w-[120px] sm:max-w-none">{m.equipmentName}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{m.assetCode}</p>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs font-bold text-slate-500 uppercase italic">{m.maintenanceType}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-black text-slate-900 text-xs whitespace-nowrap">Rp {m.cost.toLocaleString()}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                            m.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                            m.status === 'Scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4">
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Employee</p>
                 <p className="text-xl sm:text-2xl font-black text-slate-900">{effectiveEmployeeList.length}</p>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Payroll</p>
                 <p className="text-xl sm:text-2xl font-black text-slate-900">{effectivePayrollList.length}</p>
              </div>
              <div className="col-span-2 bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 rounded-2xl shadow-xl shadow-blue-100 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <div className="flex-1 min-w-0">
                    <h4 className="font-black uppercase tracking-tight text-sm truncate">Generate Gaji Karyawan</h4>
                    <p className="text-[10px] text-blue-100 mt-1">Kalkulasi otomatis berdasarkan LHP & Jam Kerja</p>
                 </div>
                 <button 
                   onClick={() => generatePayroll('05', '2024')}
                   className="w-full sm:w-auto bg-white text-blue-600 px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform whitespace-nowrap"
                 >
                    Proses Gaji Mei
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm overflow-hidden">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 sm:mb-6">Detail Penggajian (Periode 2024-05)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                     <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase">Nama THL / Jabatan</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">Gaji Pokok</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">Output Unit</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">Insentif</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">U. Makan/Transport</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-right">Total Gaji</th>
                           <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {effectivePayrollList.length === 0 ? (
                           <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic text-xs">Belum ada data payroll untuk periode ini. Klik "Proses Gaji" di atas.</td></tr>
                        ) : (
                           effectivePayrollList.map(pay => (
                              <tr key={pay.id} className="hover:bg-slate-50 transition-colors group">
                                 <td className="px-3 sm:px-6 py-3 sm:py-4">
                                    <p className="font-bold text-slate-800 text-xs uppercase truncate max-w-[120px] sm:max-w-none">{pay.employeeName}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{effectiveEmployeeList.find(e => e.id === pay.employeeId)?.position}</p>
                                 </td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-center font-bold text-slate-600 text-xs whitespace-nowrap">Rp {pay.baseSalary.toLocaleString()}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-700">{pay.totalOutput.toLocaleString()} Pcs</span>
                                 </td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-center font-bold text-slate-600 text-xs whitespace-nowrap">Rp {pay.incentiveTotal.toLocaleString()}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-center font-bold text-slate-600 text-xs whitespace-nowrap">Rp {pay.allowanceTotal.toLocaleString()}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-black text-slate-900 text-xs whitespace-nowrap">Rp {pay.totalGaji.toLocaleString()}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase tracking-widest">DRAFT</span>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
