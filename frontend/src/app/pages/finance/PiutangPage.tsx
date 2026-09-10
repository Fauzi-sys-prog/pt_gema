import { useState, useMemo } from 'react';
import { useApp, type Invoice } from '../../contexts/AppContext';
import { 
  Search, 
  Wallet,
  CheckCircle2,
  AlertCircle,
  Filter,
  Eye,
  FileText,
  Clock,
  ChevronRight,
  TrendingUp,
  Receipt,
  Download,
  ShieldCheck,
  CreditCard,
  Mail,
  MessageSquare,
  AlertTriangle,
  History,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { exportPiutangToWord, exportPiutangToExcel } from '../../utils/financeExports';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function PiutangPage() {
  const { invoiceList, updateInvoice } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unpaid' | 'Paid' | 'Overdue'>('All');
  const [showExportModal, setShowExportModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEscapeKey([
    { condition: showExportModal, close: () => setShowExportModal(false) },
  ]);


  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const calculateDaysLate = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const agingAnalysis = useMemo(() => {
    const categories = {
      '0-30 Days': 0,
      '31-60 Days': 0,
      '61-90 Days': 0,
      '> 90 Days': 0
    };

    invoiceList.filter(i => i.status !== 'Paid').forEach(inv => {
      const days = calculateDaysLate(inv.jatuhTempo);
      if (days <= 30) categories['0-30 Days'] += inv.totalBayar;
      else if (days <= 60) categories['31-60 Days'] += inv.totalBayar;
      else if (days <= 90) categories['61-90 Days'] += inv.totalBayar;
      else categories['> 90 Days'] += inv.totalBayar;
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [invoiceList]);

  const filteredInvoices = useMemo(() => {
    return invoiceList.filter(inv => {
      const matchesSearch = inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           inv.noInvoice.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isOverdue = calculateDaysLate(inv.jatuhTempo) > 0 && inv.status !== 'Paid';
      
      let matchesFilter = true;
      if (filterStatus === 'Unpaid') matchesFilter = inv.status === 'Unpaid';
      if (filterStatus === 'Paid') matchesFilter = inv.status === 'Paid';
      if (filterStatus === 'Overdue') matchesFilter = isOverdue;

      return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        if (a.status !== 'Paid' && b.status === 'Paid') return -1;
        if (a.status === 'Paid' && b.status !== 'Paid') return 1;
        return calculateDaysLate(b.jatuhTempo) - calculateDaysLate(a.jatuhTempo);
    });
  }, [invoiceList, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const totalPiutang = invoiceList.filter(i => i.status !== 'Paid').reduce((acc, i) => acc + i.totalBayar, 0);
    const totalOverdue = invoiceList.filter(i => i.status !== 'Paid' && calculateDaysLate(i.jatuhTempo) > 0).reduce((acc, i) => acc + i.totalBayar, 0);
    const countUnpaid = invoiceList.filter(i => i.status !== 'Paid').length;
    return { totalPiutang, totalOverdue, countUnpaid };
  }, [invoiceList]);

  const handleMarkAsPaid = async (id: string) => {
    if (!window.confirm('Tandai invoice ini sebagai LUNAS? Tindakan ini akan mengubah status invoice.')) return;
    setProcessingId(id);
    try {
      await updateInvoice(id, { status: 'Paid', tanggalBayar: new Date().toISOString().split('T')[0] });
      toast.success('Invoice berhasil diverifikasi LUNAS!');
    } catch (err) {
      toast.error('Gagal menandai lunas: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReminder = (customer: string) => {
    toast.info(`Draft pengingat penagihan untuk ${customer} telah disiapkan.`);
  };

  const handleExportWord = async () => {
    toast.loading("Generating Rekap Piutang (Word)...", { id: "piutang-word" });
    
    try {
      const exportData = {
        totalOutstanding: stats.totalPiutang,
        overdueInvoices: invoiceList.filter(i => i.status !== 'Paid' && calculateDaysLate(i.jatuhTempo) > 0).length,
        invoiceList: invoiceList
          .filter(i => i.status !== 'Paid')
          .map(inv => ({
            invoiceNo: inv.noInvoice,
            customer: inv.customer,
            amount: inv.totalBayar,
            dueDate: inv.jatuhTempo,
            status: calculateDaysLate(inv.jatuhTempo) > 0 ? 'Overdue' : 'Pending',
            daysOverdue: calculateDaysLate(inv.jatuhTempo),
          })),
      };

      await exportPiutangToWord(exportData);

      toast.success("Word Export Complete", {
        id: "piutang-word",
        description: "Rekap Piutang (.doc) downloaded successfully"
      });
      setShowExportModal(false);
    } catch (error) {
      toast.error("Export failed", {
        id: "piutang-word",
        description: "Failed to generate Word document"
      });
    }
  };

  const handleExportExcel = () => {
    toast.loading("Generating Rekap Piutang (Excel)...", { id: "piutang-excel" });
    
    try {
      const exportData = {
        totalOutstanding: stats.totalPiutang,
        overdueInvoices: invoiceList.filter(i => i.status !== 'Paid' && calculateDaysLate(i.jatuhTempo) > 0).length,
        invoiceList: invoiceList
          .filter(i => i.status !== 'Paid')
          .map(inv => ({
            invoiceNo: inv.noInvoice,
            customer: inv.customer,
            amount: inv.totalBayar,
            dueDate: inv.jatuhTempo,
            status: calculateDaysLate(inv.jatuhTempo) > 0 ? 'Overdue' : 'Pending',
            daysOverdue: calculateDaysLate(inv.jatuhTempo),
          })),
      };

      exportPiutangToExcel(exportData);

      toast.success("Excel Export Complete", {
        id: "piutang-excel",
        description: "Rekap Piutang (.csv) downloaded successfully"
      });
      setShowExportModal(false);
    } catch (error) {
      toast.error("Export failed", {
        id: "piutang-excel",
        description: "Failed to generate Excel file"
      });
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-rose-200">Accounts Receivable</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Billing & Collections</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-4">
              <CreditCard className="text-rose-600" size={40} />
              Billing Analytics
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-1">Manajemen Piutang & Analisis Umur Tagihan Proyek</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> Rekap Piutang
          </button>
          <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl">
            <Mail size={16} /> Broadcast Reminders
          </button>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AR Scorecards */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Outstanding (AR)</p>
              <h3 className="text-3xl font-black text-rose-600 italic tracking-tighter">{formatCurrency(stats.totalPiutang)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <AlertCircle size={14} className="text-rose-500" />
                <span>Tersebar di {stats.countUnpaid} Invoice Aktif</span>
              </div>
           </div>
           
           <div className="bg-rose-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <AlertTriangle size={80} className="text-white" />
              </div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 italic">Critical Overdue</p>
              <h3 className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(stats.totalOverdue)}</h3>
              <p className="text-[10px] text-rose-300 font-bold mt-2 uppercase italic leading-none">Segera lakukan penagihan intensif</p>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic flex items-center gap-2">
                <History size={14} /> AR Aging Distribution
              </h4>
              <div className="h-48 w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
                 <ResponsiveContainer width="100%" height={192} minWidth={0} minHeight={0}>
                    <PieChart>
                       <Pie key="pie-aging" data={agingAnalysis} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5}>
                          {agingAnalysis.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#6366F1', '#10B981'][index % 4]} />
                          ))}
                       </Pie>
                       <Tooltip key="tip-1" />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                 {agingAnalysis.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                       <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#EF4444', '#F59E0B', '#6366F1', '#10B981'][idx]}} />
                       <span className="text-[9px] font-black text-slate-500 uppercase">{item.name}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Aging Bar Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-10">
              <div>
                <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-rose-600" size={24} />
                  Aging Analysis (IDR)
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visualisasi keterlambatan pembayaran</p>
              </div>
              <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-slate-100">
                 <RefreshCw size={18} />
              </button>
           </div>
           <div className="h-[380px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
              <ResponsiveContainer width="100%" height={380} minWidth={0} minHeight={0}>
                <BarChart data={agingAnalysis}>
                  <CartesianGrid key="grid-2" strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    key="x-2"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <YAxis
                    key="y-2"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }}
                    tickFormatter={(val) => `Rp ${val/1000000}M`}
                  />
                  <Tooltip
                    key="tip-2"
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{payload[0].payload.name}</p>
                            <p className="text-sm font-black text-white italic">{formatCurrency(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar key="bar-aging" name="Aging" dataKey="value" isAnimationActive={false} radius={[10, 10, 0, 0]} barSize={60}>
                     {agingAnalysis.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#6366F1', '#10B981'][index]} />
                     ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
           <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              {(['All', 'Unpaid', 'Overdue', 'Paid'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    filterStatus === s ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
           </div>
           
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Search Invoice or Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-2xl text-sm font-bold uppercase italic outline-none focus:ring-4 focus:ring-rose-500/10 transition-all shadow-sm"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Cycle Info</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Engagement</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Invoice Value</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aging Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Collection Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const daysLate = calculateDaysLate(inv.jatuhTempo);
                const isOverdue = daysLate > 0 && inv.status !== 'Paid';
                
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-8">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Due: {inv.jatuhTempo}</span>
                         <span className="text-sm font-black text-slate-900 italic tracking-tight uppercase">{inv.noInvoice}</span>
                         <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${inv.status === 'Paid' ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{inv.status}</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 uppercase italic leading-tight">{inv.customer}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate max-w-[200px]">{inv.alamat}</span>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <span className={`text-sm font-black italic ${inv.status === 'Paid' ? 'text-slate-400' : 'text-slate-900'}`}>{formatCurrency(inv.totalBayar)}</span>
                    </td>
                    <td className="px-10 py-8 text-center">
                       {inv.status === 'Paid' ? (
                          <div className="flex flex-col items-center">
                             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mb-1">
                                <ShieldCheck size={16} />
                             </div>
                             <span className="text-[8px] font-black text-emerald-600 uppercase">Paid & Verified</span>
                          </div>
                       ) : isOverdue ? (
                          <div className="flex flex-col items-center">
                             <span className="text-sm font-black text-rose-600 leading-none">+{daysLate}D</span>
                             <span className="text-[8px] font-black text-rose-600 uppercase mt-1 italic tracking-widest">Overdue</span>
                          </div>
                       ) : (
                          <div className="flex flex-col items-center">
                             <span className="text-sm font-black text-amber-500 leading-none">{Math.abs(daysLate)}D</span>
                             <span className="text-[8px] font-black text-amber-500 uppercase mt-1 italic tracking-widest">Remaining</span>
                          </div>
                       )}
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center justify-center gap-2">
                          {inv.status !== 'Paid' ? (
                             <>
                                  <button
                                    onClick={() => handleMarkAsPaid(inv.id)}
                                    disabled={processingId === inv.id}
                                   className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                  <CheckCircle2 size={14} className="text-emerald-400" /> Mark Paid
                               </button>
                               <button 
                                 onClick={() => handleReminder(inv.customer)}
                                 className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm"
                               >
                                  <MessageSquare size={16} />
                               </button>
                             </>
                          ) : (
                             <button className="px-6 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase italic tracking-widest cursor-not-allowed">
                                Verified History
                             </button>
                          )}
                       </div>
                    </td>
                  </tr>
                )
              })}
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
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                    <Download className="text-rose-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Export Piutang</h3>
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
                    <p className="text-[10px] text-slate-600 font-medium italic mt-0.5">Professional .DOC format</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                <button
                  onClick={handleExportExcel}
                  className="w-full p-6 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border-2 border-emerald-200 rounded-2xl flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Receipt size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Microsoft Excel</h4>
                    <p className="text-[10px] text-slate-600 font-medium italic mt-0.5">Excel-compatible .CSV</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
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

// Simple internal RefreshCw icon replacement since it might be missing
function RefreshCw({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
