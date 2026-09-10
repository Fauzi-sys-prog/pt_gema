import React, { useMemo, useState } from 'react';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  Calendar, 
  Download, 
  Filter,
  ArrowRight,
  PieChart as PieChartIcon,
  CreditCard,
  Building2,
  Users,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { exportCashflowToWord, exportCashflowToExcel } from '../../utils/cashflowExport';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function CashflowPage() {
  const { invoiceList = [], poList = [], payrollList = [], expenseList = [] } = useApp();
  const [showExportModal, setShowExportModal] = useState(false);

  useEscapeKey([
    { condition: showExportModal, close: () => setShowExportModal(false) },
  ]);


  const stats = useMemo(() => {
    const inflow = (invoiceList || [])
      .filter(inv => inv && inv.status === 'Paid')
      .reduce((sum, inv) => sum + (inv.totalBayar || 0), 0);

    const outflowPurchases = (poList || [])
      .filter(po => po && (po.status === 'Completed' || po.status === 'Received'))
      .reduce((sum, po) => sum + (po.total || 0), 0);

    const outflowPayroll = (payrollList || []).reduce((sum, p) => sum + (p.totalPayroll || 0), 0);
    
    const totalOutflow = outflowPurchases + outflowPayroll;
    const netCashflow = inflow - totalOutflow;

    return {
      inflow,
      outflowPurchases,
      outflowPayroll,
      totalOutflow,
      netCashflow
    };
  }, [invoiceList, poList, payrollList]);

  const chartData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const currentYear = new Date().getFullYear();
    const buckets = Array.from({ length: 12 }, () => ({ inflow: 0, outflow: 0 }));

    invoiceList.forEach(inv => {
      if (inv.status !== 'Paid' || !inv.tanggal) return;
      const d = new Date(inv.tanggal);
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].inflow += inv.totalBayar || 0;
    });

    expenseList.forEach(exp => {
      if (exp.status !== 'Paid' || !exp.tanggal) return;
      const d = new Date(exp.tanggal);
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += exp.totalNominal || 0;
    });

    poList.forEach(po => {
      if (!['Completed','Received'].includes(po.status) || !(po as any).tanggal) return;
      const d = new Date((po as any).tanggal);
      if (d.getFullYear() === currentYear) buckets[d.getMonth()].outflow += po.total || 0;
    });

    return MONTHS.map((month, i) => ({ month, inflow: buckets[i].inflow, outflow: buckets[i].outflow }));
  }, [invoiceList, expenseList, poList]);

  const pieData = [
    { name: 'Material Purchases', value: stats.outflowPurchases, color: '#3b82f6' },
    { name: 'Payroll/Labor', value: stats.outflowPayroll, color: '#10b981' },
    { name: 'General/Admin', value: stats.totalOutflow * 0.1, color: '#f59e0b' },
  ];

  const handleExportWord = async () => {
    toast.loading("Generating Cashflow Statement (Word)...", { id: "cashflow-word" });
    
    try {
      await exportCashflowToWord({
        inflow: stats.inflow,
        outflowPurchases: stats.outflowPurchases,
        outflowPayroll: stats.outflowPayroll,
        totalOutflow: stats.totalOutflow,
        netCashflow: stats.netCashflow,
        chartData,
        period: 'January 2026',
      });

      toast.success("Word Export Complete", {
        id: "cashflow-word",
        description: "Professional Word document (.doc) downloaded successfully"
      });
      setShowExportModal(false);
    } catch (error) {
      toast.error("Export failed", {
        id: "cashflow-word",
        description: "Failed to generate Word document. Please try again."
      });
    }
  };

  const handleExportExcel = () => {
    toast.loading("Generating Cashflow Statement (Excel)...", { id: "cashflow-excel" });
    
    try {
      exportCashflowToExcel({
        inflow: stats.inflow,
        outflowPurchases: stats.outflowPurchases,
        outflowPayroll: stats.outflowPayroll,
        totalOutflow: stats.totalOutflow,
        netCashflow: stats.netCashflow,
        chartData,
        period: 'January 2026',
      });

      toast.success("Excel Export Complete", {
        id: "cashflow-excel",
        description: "Excel-compatible CSV file downloaded successfully"
      });
      setShowExportModal(false);
    } catch (error) {
      toast.error("Export failed", {
        id: "cashflow-excel",
        description: "Failed to generate Excel file. Please try again."
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Cashflow Statement</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Liquid Assets & Transaction Flow</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
             <Calendar size={16} /> Month: Jan 2026
           </button>
           <button 
              onClick={() => setShowExportModal(true)}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg"
           >
             <Download size={16} /> Export Statement
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <ArrowUpCircle size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Inflow (Revenue)</p>
              <p className="text-3xl font-black text-slate-900 italic mt-1">Rp {stats.inflow.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-emerald-600 font-black mt-2 flex items-center gap-1 uppercase">
                <TrendingUp size={12} /> +12% vs last month
              </p>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4">
                <ArrowDownCircle size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outflow (Expenses)</p>
              <p className="text-3xl font-black text-slate-900 italic mt-1">Rp {stats.totalOutflow.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-rose-600 font-black mt-2 flex items-center gap-1 uppercase">
                <ArrowRight size={12} /> Material & Payroll
              </p>
            </div>
         </div>

         <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4">
                <Wallet size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Cash Position</p>
              <p className="text-3xl font-black italic mt-1 text-emerald-400">Rp {stats.netCashflow.toLocaleString('id-ID')}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">
                  Healthy Balance
                </div>
              </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-10">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 italic">
                 <TrendingUp size={14} /> Cashflow Trend Analysis
               </h3>
               <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase">Inflow</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase">Outflow</span>
                 </div>
               </div>
            </div>
            <div className="h-80 w-full overflow-hidden min-w-0 min-h-0 flex flex-col relative">
               <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid key="grid-1" strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      key="x-1"
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                      dy={10}
                    />
                    <YAxis
                      key="y-1"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      key="tip-1"
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                    />
                    <Area key="cf-inflow" name="Inflow" isAnimationActive={false} type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                    <Area key="cf-outflow" name="Outflow" isAnimationActive={false} type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2 italic">
              <PieChartIcon size={14} /> Outflow Breakdown
            </h3>
            <div className="flex-1 flex items-center justify-center min-w-0 min-h-0 relative flex-col h-[240px]">
               <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      key="tip-2"
                      formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                      contentStyle={{ borderRadius: '16px', border: 'none' }}
                    />
                  </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="space-y-4 mt-8">
               {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-10 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                           <p className="text-xs font-black text-slate-900 italic">Rp {(item.value / 1000000).toFixed(1)}M</p>
                        </div>
                     </div>
                     <span className="text-[10px] font-black text-slate-400">{((item.value / stats.totalOutflow) * 100).toFixed(0)}%</span>
                  </div>
               ))}
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">Recent Transaction Log</h3>
            <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">View All History</button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-slate-50">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {invoiceList.filter(inv => inv.status === 'Paid').slice(0, 3).map((inv, i) => (
                     <tr key={`in-${i}`} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                           <span className="text-xs font-black text-slate-600 uppercase italic">{new Date(inv.tanggal).toLocaleDateString('id-ID')}</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                                 <CreditCard size={14} />
                              </div>
                              <span className="text-[10px] font-black text-slate-900 uppercase">Revenue / Invoice</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-slate-400" />
                              <span className="text-xs font-black text-slate-600 uppercase">{inv.customer}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <span className="text-sm font-black text-emerald-600 italic">+Rp {inv.totalBayar.toLocaleString('id-ID')}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase border border-emerald-100 italic">Settled</span>
                        </td>
                     </tr>
                  ))}
                  {payrollList.slice(0, 2).map((p, i) => (
                     <tr key={`out-${i}`} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                           <span className="text-xs font-black text-slate-600 uppercase italic">25 Jan 2026</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
                                 <Users size={14} />
                              </div>
                              <span className="text-[10px] font-black text-slate-900 uppercase">Payroll / Gaji</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <Users size={14} className="text-slate-400" />
                              <span className="text-xs font-black text-slate-600 uppercase">All Employees</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <span className="text-sm font-black text-rose-600 italic">-Rp {p.totalPayroll.toLocaleString('id-ID')}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase border border-rose-100 italic">Disbursed</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <Download className="text-emerald-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Export Cashflow</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Choose Format</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-4">
                <button
                  onClick={handleExportWord}
                  className="w-full p-6 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 rounded-2xl flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Microsoft Word</h4>
                    <p className="text-[10px] text-slate-600 font-medium italic mt-0.5">Professional .DOC format with logo</p>
                  </div>
                  <ArrowRight size={18} className="text-slate-400" />
                </button>

                <button
                  onClick={handleExportExcel}
                  className="w-full p-6 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border-2 border-emerald-200 rounded-2xl flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Microsoft Excel</h4>
                    <p className="text-[10px] text-slate-600 font-medium italic mt-0.5">Excel-compatible .CSV format</p>
                  </div>
                  <ArrowRight size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-6 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
}
