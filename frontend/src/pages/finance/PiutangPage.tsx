import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { Invoice } from '../../contexts/AppContext';
import api from '../../services/api';
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
  Calendar,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
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

export default function PiutangPage() {
  const { updateInvoice, addAuditLog, currentUser, invoiceList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unpaid' | 'Paid' | 'Overdue'>('All');
  const [serverInvoices, setServerInvoices] = useState<Invoice[] | null>(null);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalAR: number;
    totalInvoiced: number;
    totalPaid: number;
    overdueAmount: number;
    overdueCount: number;
    aging0to30: number;
    aging31to60: number;
    aging61to90: number;
    agingOver90: number;
    activeInvoiceCount?: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveInvoices = serverInvoices ?? invoiceList;
  const safeInvoices = useMemo(() => (effectiveInvoices || []).filter(Boolean), [effectiveInvoices]);

  const fetchInvoices = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/invoices');
      const rows = Array.isArray(response.data)
        ? (response.data as any[]).map((row) => {
            const payload = row?.payload ?? row;
            if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
              return { ...payload, id: row?.entityId };
            }
            return payload as Invoice;
          })
        : [];
      setServerInvoices(rows);
    } catch {
      setServerInvoices(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchArSummary = async () => {
    try {
      const { data } = await api.get<{ metrics?: typeof summaryMetrics }>('/dashboard/finance-ar-summary');
      if (data?.metrics) {
        setSummaryMetrics(data.metrics as NonNullable<typeof summaryMetrics>);
      } else {
        setSummaryMetrics(null);
      }
    } catch {
      setSummaryMetrics(null);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchArSummary();
  }, []);

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
    const m = summaryMetrics;
    return [
      { name: '0-30 Days', value: Number(m?.aging0to30 || 0) },
      { name: '31-60 Days', value: Number(m?.aging31to60 || 0) },
      { name: '61-90 Days', value: Number(m?.aging61to90 || 0) },
      { name: '> 90 Days', value: Number(m?.agingOver90 || 0) },
    ];
  }, [summaryMetrics]);

  const filteredInvoices = useMemo(() => {
    return safeInvoices.filter(inv => {
      const keyword = String(searchTerm || '').toLowerCase();
      const matchesSearch =
        String(inv.customer || '').toLowerCase().includes(keyword) ||
        String(inv.noInvoice || '').toLowerCase().includes(keyword);
      
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
  }, [safeInvoices, searchTerm, filterStatus]);

  const stats = useMemo(() => ({
    totalPiutang: Number(summaryMetrics?.totalAR || 0),
    totalOverdue: Number(summaryMetrics?.overdueAmount || 0),
    countUnpaid: Number(summaryMetrics?.activeInvoiceCount || 0),
  }), [summaryMetrics]);

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updateInvoice(id, { status: 'Paid', tanggalBayar: new Date().toISOString().split('T')[0] });
      fetchInvoices();
      toast.success('Invoice berhasil diverifikasi LUNAS!');
    } catch {
      // Error toast handled in AppContext
    }
  };

  const handleReminder = (inv: Invoice) => {
    addAuditLog({
      action: "AR_REMINDER_CREATED",
      module: "Finance",
      details: `Reminder penagihan dibuat untuk ${inv.customer} (${inv.noInvoice}) oleh ${currentUser?.fullName || currentUser?.username || "System"}`,
      status: "Success",
    });
    toast.success(`Reminder penagihan ${inv.noInvoice} untuk ${inv.customer} berhasil dicatat.`);
  };

  const handleBroadcastReminders = () => {
    const targets = safeInvoices.filter((inv) => inv.status !== "Paid");
    if (targets.length === 0) {
      toast.info("Tidak ada invoice outstanding untuk dikirimi reminder.");
      return;
    }

    addAuditLog({
      action: "AR_REMINDER_BROADCAST",
      module: "Finance",
      details: `Broadcast reminder dijalankan untuk ${targets.length} invoice outstanding oleh ${currentUser?.fullName || currentUser?.username || "System"}`,
      status: "Success",
    });
    toast.success(`Broadcast reminder dicatat untuk ${targets.length} invoice outstanding.`);
  };

  const handleExportRekapPiutang = async () => {
    if (filteredInvoices.length === 0) {
      toast.info("Tidak ada data invoice untuk diekspor.");
      return;
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      generatedAt: new Date().toISOString(),
      filterStatus,
      summary: {
        totalAR: Number(summaryMetrics?.totalAR || 0),
        totalInvoiced: Number(summaryMetrics?.totalInvoiced || 0),
        totalPaid: Number(summaryMetrics?.totalPaid || 0),
        overdueAmount: Number(summaryMetrics?.overdueAmount || 0),
        overdueCount: Number(summaryMetrics?.overdueCount || 0),
        aging0to30: Number(summaryMetrics?.aging0to30 || 0),
        aging31to60: Number(summaryMetrics?.aging31to60 || 0),
        aging61to90: Number(summaryMetrics?.aging61to90 || 0),
        agingOver90: Number(summaryMetrics?.agingOver90 || 0),
      },
      rows: filteredInvoices.map((inv) => ({
        noInvoice: inv.noInvoice,
        tanggal: inv.tanggal,
        jatuhTempo: inv.jatuhTempo,
        customer: inv.customer,
        status: inv.status,
        daysLate: calculateDaysLate(inv.jatuhTempo),
        totalBayar: Number(inv.totalBayar || 0),
      })),
      generatedBy: currentUser?.fullName || currentUser?.username || "Finance AR",
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post("/exports/receivable-report/excel", payload, { responseType: "blob" }),
        api.post("/exports/receivable-report/word", payload, { responseType: "blob" }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: "application/vnd.ms-excel" }));
      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `receivable-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: "application/msword" }));
      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `receivable-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success("Rekap piutang Word + Excel berhasil diekspor.");
    } catch {
      toast.error("Export rekap piutang gagal.");
    }
  };

  const handleRefreshAging = () => {
    fetchInvoices();
    fetchArSummary();
    toast.success("Aging analysis diperbarui dari server.");
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
            onClick={handleExportRekapPiutang}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> Rekap Piutang
          </button>
          <button
            onClick={handleBroadcastReminders}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl"
          >
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
                       <Pie data={agingAnalysis} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5}>
                          {agingAnalysis.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#6366F1', '#10B981'][index % 4]} />
                          ))}
                       </Pie>
                       <Tooltip />
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
              <button
                 onClick={handleRefreshAging}
                 className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-slate-100 disabled:opacity-60"
                 disabled={isRefreshing}
              >
                 <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
           </div>
           <div className="h-[380px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
              <ResponsiveContainer width="100%" height={380} minWidth={0} minHeight={0}>
                <BarChart data={agingAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }}
                    tickFormatter={(val) => `Rp ${val/1000000}M`}
                  />
                  <Tooltip 
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
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
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
                                 onClick={() => { void handleMarkAsPaid(inv.id); }}
                                 className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2"
                               >
                                  <CheckCircle2 size={14} className="text-emerald-400" /> Mark Paid
                               </button>
                               <button 
                                 onClick={() => handleReminder(inv)}
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
    </div>
  );
}
