import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Star, Clock, AlertCircle, TrendingUp, ChevronRight, Building2, Package, CheckCircle2, DollarSign, Search, Filter } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';

type VendorSummaryItem = {
  name: string;
  totalOrders: number;
  totalValue: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  partialDeliveries: number;
  avgLeadTime: number;
  onTimeRate: number;
  score: number;
};

type VendorSummaryResponse = {
  vendors?: VendorSummaryItem[];
};

export default function VendorAnalysisPage() {
  const { poList, receivingList, addAuditLog, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorSummary, setVendorSummary] = useState<VendorSummaryResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Analyze vendor performance
  const localVendorPerformance = useMemo(() => {
    const vendors: Record<string, any> = {};

    poList.forEach(po => {
      const vendorName = po.vendor;
      if (!vendors[vendorName]) {
        vendors[vendorName] = {
          name: vendorName,
          totalOrders: 0,
          totalValue: 0,
          onTimeDeliveries: 0,
          lateDeliveries: 0,
          partialDeliveries: 0,
          avgLeadTime: 0,
          leads: []
        };
      }

      vendors[vendorName].totalOrders += 1;
      vendors[vendorName].totalValue += po.total;

      // Check receiving for this PO
      const matchingRecv = receivingList.filter(r => r.poId === po.id);
      if (matchingRecv.length > 0) {
        matchingRecv.forEach(recv => {
          const poDate = new Date(po.tanggal);
          const recvDate = new Date(recv.tanggal);
          const diffDays = Math.ceil((recvDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24));
          
          vendors[vendorName].leads.push(diffDays);
          
          if (diffDays <= 7) { // 7 days as target lead time
             vendors[vendorName].onTimeDeliveries += 1;
          } else {
             vendors[vendorName].lateDeliveries += 1;
          }
        });
      }

      if (po.status === 'Partial') {
        vendors[vendorName].partialDeliveries += 1;
      }
    });

    return Object.values(vendors).map(v => ({
      ...v,
      avgLeadTime: v.leads.length > 0 ? v.leads.reduce((a: number, b: number) => a + b, 0) / v.leads.length : 0,
      onTimeRate: v.totalOrders > 0 ? (v.onTimeDeliveries / v.totalOrders) * 100 : 0,
      score: (v.onTimeDeliveries / (v.totalOrders || 1)) * 5 // 0-5 Star Rating
    })).sort((a, b) => b.totalValue - a.totalValue);
  }, [poList, receivingList]);

  const loadSummary = async (silent = true) => {
    if (!silent) setIsRefreshing(true);
    try {
      const { data } = await api.get<VendorSummaryResponse>('/dashboard/vendor-summary');
      setVendorSummary(data);
      if (!silent) toast.success('Vendor summary diperbarui');
    } catch {
      if (!silent) toast.error('Gagal refresh vendor summary');
      // fallback to local computation
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(true);
  }, []);

  const vendorPerformance = useMemo(
    () =>
      (vendorSummary?.vendors && vendorSummary.vendors.length > 0
        ? vendorSummary.vendors
        : localVendorPerformance) as VendorSummaryItem[],
    [vendorSummary, localVendorPerformance]
  );

  const filteredVendors = vendorPerformance.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSpend = filteredVendors.reduce((sum, vendor) => sum + vendor.totalValue, 0);
  const avgScore = filteredVendors.length
    ? filteredVendors.reduce((sum, vendor) => sum + vendor.score, 0) / filteredVendors.length
    : 0;

  const handleGenerateReportCard = async () => {
    const rows = [
      ['Vendor', 'TotalOrders', 'TotalValue', 'OnTimeRate', 'AvgLeadTime', 'PartialDeliveries', 'Score'],
      ...filteredVendors.map((v) => [
        v.name,
        String(v.totalOrders),
        String(v.totalValue),
        String(v.onTimeRate),
        String(v.avgLeadTime),
        String(v.partialDeliveries),
        String(v.score),
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `vendor-report-card-${dateKey}`,
      title: 'Vendor Performance Report',
      subtitle: `Tanggal ${dateKey} | Total vendor ${filteredVendors.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan vendor: total spend Rp ${totalSpend.toLocaleString('id-ID')}, rata-rata skor ${avgScore.toFixed(1)}, target evaluasi ketepatan pengiriman dan lead time.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Procurement Vendor Analysis',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `vendor-report-card-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `vendor-report-card-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'VENDOR_REPORT_EXPORTED',
        module: 'Procurement',
        entityType: 'VendorAnalysis',
        entityId: 'all',
        description: `Vendor report card exported (${filteredVendors.length} vendors)`,
      });
      toast.success('Supplier report card Word + Excel exported');
    } catch {
      toast.error('Export vendor report card gagal');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-2">
            <Truck size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Vendor Strategic Analysis</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Reliability, Lead Time & Spend Portfolio</p>
          </div>
        </div>

        <div className="relative w-full md:max-w-md">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <input 
             type="text" 
             placeholder="Search vendors..." 
             className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-indigo-500 transition-all shadow-sm"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <button
          type="button"
          onClick={() => loadSummary(false)}
          disabled={isRefreshing}
          className="px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic hover:border-indigo-500 disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {filteredVendors.slice(0, 4).map((v, i) => (
           <div key={v.name} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                       <Building2 size={20} />
                    </div>
                    <div className="flex items-center gap-1">
                       <Star size={14} className="text-amber-400 fill-amber-400" />
                       <span className="text-[10px] font-black text-slate-900">{v.score.toFixed(1)}</span>
                    </div>
                 </div>
                 <h4 className="text-sm font-black text-slate-900 uppercase italic line-clamp-1 mb-1">{v.name}</h4>
                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-6">{v.totalOrders} Orders Placed</p>
                 
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[8px] text-slate-400 font-black uppercase mb-1 italic">Total Spend</p>
                       <p className="text-md font-black text-indigo-600 italic">Rp {(v.totalValue / 1000000).toFixed(1)}M</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] text-slate-400 font-black uppercase mb-1 italic">Lead Time</p>
                       <p className="text-md font-black text-slate-900 italic">{v.avgLeadTime.toFixed(0)} Days</p>
                    </div>
                 </div>
              </div>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">Performance Comparison Matrix</h3>
            <button className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1 italic">
               <TrendingUp size={12} /> Optimization Insights
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-900 text-white">
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic">Vendor Name</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic text-center">On-Time Rate</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic text-center">Lead Time (Avg)</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic text-center">Partial Issue</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic text-right">Total Portfolio</th>
                     <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest italic text-center">Action</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredVendors.map((v) => (
                    <tr key={v.name} className="hover:bg-slate-50/80 transition-all group">
                       <td className="px-8 py-6">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight group-hover:text-indigo-600 transition-colors">{v.name}</span>
                             <div className="flex gap-0.5 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={8} className={`${i < Math.floor(v.score) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                ))}
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center">
                             <span className={`text-xs font-black italic ${v.onTimeRate >= 80 ? 'text-emerald-600' : v.onTimeRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                {v.onTimeRate.toFixed(1)}%
                             </span>
                             <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full ${v.onTimeRate >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${v.onTimeRate}%` }}></div>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase italic">
                             <Clock size={12} /> {v.avgLeadTime.toFixed(1)} Days
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase italic ${v.partialDeliveries > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                             {v.partialDeliveries} Incidents
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <span className="text-sm font-black text-slate-900 italic">Rp {(v.totalValue / 1000000).toFixed(1)}M</span>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <button
                            onClick={() => toast.info(`${v.name} | On-time ${v.onTimeRate.toFixed(1)}% | Lead ${v.avgLeadTime.toFixed(1)} hari`)}
                            className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-500 italic">
               <AlertCircle size={16} />
               <p className="text-[10px] font-medium uppercase tracking-widest">Target Lead Time Nasional: 7 Hari • Internasional: 21 Hari</p>
            </div>
            <button
              onClick={handleGenerateReportCard}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
               Generate Supplier Report Card
            </button>
         </div>
      </div>
    </div>
  );
}
