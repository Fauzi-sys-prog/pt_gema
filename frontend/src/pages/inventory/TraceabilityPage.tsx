import React, { useEffect, useState, useMemo } from 'react';
import { Search, History, Package, Truck, ArrowRight, Clock, AlertCircle, QrCode, MapPin, User, ExternalLink, ChevronRight, Filter, Layers, CheckCircle2, Calendar } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function TraceabilityPage() {
  const { stockMovementList, stockItemList, addAuditLog, currentUser } = useApp();
  const [serverStockMovementList, setServerStockMovementList] = useState<typeof stockMovementList | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<typeof stockItemList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const effectiveStockMovementList = serverStockMovementList ?? stockMovementList;
  const effectiveStockItemList = serverStockItemList ?? stockItemList;

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload ?? {};
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return payload as T;
    });

  const fetchTraceabilitySources = async () => {
    try {
      setIsRefreshing(true);
      const [movementRes, itemRes] = await Promise.all([
        api.get('/inventory/movements'),
        api.get('/inventory/items'),
      ]);
      setServerStockMovementList(normalizeEntityRows<any>(Array.isArray(movementRes.data) ? movementRes.data : []));
      setServerStockItemList(normalizeEntityRows<any>(Array.isArray(itemRes.data) ? itemRes.data : []));
    } catch {
      setServerStockMovementList(null);
      setServerStockItemList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTraceabilitySources();
  }, []);

  // Extract all unique batch numbers from movements
  const allBatches = useMemo(() => {
    const batches = new Set<string>();
    effectiveStockMovementList.forEach(m => {
      if (m.batchNo) batches.add(m.batchNo);
    });
    return Array.from(batches);
  }, [effectiveStockMovementList]);

  // Filter batches based on search
  const filteredBatches = allBatches.filter(b => 
    b.toLowerCase().includes(batchSearch.toLowerCase())
  ).slice(0, 10);

  // Analyze lifecycle of the selected batch
  const batchLifecycle = useMemo(() => {
    if (!selectedBatch) return null;

    const movements = effectiveStockMovementList
      .filter(m => m.batchNo === selectedBatch)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    if (movements.length === 0) return null;

    const firstMovement = movements[0];
    const item = effectiveStockItemList.find(s => s.kode === firstMovement.itemKode);

    // Track where it went
    const destinations = movements
      .filter(m => m.type === 'OUT')
      .map(m => ({
        project: m.projectName,
        qty: m.qty,
        date: m.tanggal,
        ref: m.refNo
      }));

    return {
      batchNo: selectedBatch,
      itemKode: firstMovement.itemKode,
      itemNama: firstMovement.itemNama,
      unit: firstMovement.unit,
      expiryDate: item?.expiryDate,
      totalIn: movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.qty, 0),
      totalOut: movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.qty, 0),
      currentInStock: movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.qty, 0) - 
                      movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.qty, 0),
      history: movements,
      destinations: destinations
    };
  }, [selectedBatch, effectiveStockMovementList, effectiveStockItemList]);

  const handleExportTrace = async () => {
    if (!batchLifecycle) {
      toast.error('Pilih batch dulu');
      return;
    }
    const rows = [
      ['BatchNo', 'ItemKode', 'ItemNama', 'Tanggal', 'Type', 'Qty', 'Unit', 'RefNo', 'Project', 'Operator', 'Lokasi'],
      ...batchLifecycle.history.map((m) => [
        batchLifecycle.batchNo,
        batchLifecycle.itemKode,
        batchLifecycle.itemNama,
        m.tanggal,
        m.type,
        String(m.qty),
        m.unit,
        m.refNo,
        m.projectName || '',
        m.operator || '',
        m.lokasi || '',
      ]),
    ];
    const payload = {
      filename: `traceability-${batchLifecycle.batchNo}`,
      title: 'Material Traceability Report',
      subtitle: `Batch ${batchLifecycle.batchNo} | Item ${batchLifecycle.itemNama || '-'}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Jejak material batch ${batchLifecycle.batchNo} dari penerimaan hingga pemakaian proyek untuk kebutuhan traceability dan audit.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Traceability',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `traceability-${batchLifecycle.batchNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `traceability-${batchLifecycle.batchNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'TRACEABILITY_EXPORTED',
        module: 'Inventory',
        entityType: 'Batch',
        entityId: batchLifecycle.batchNo,
        description: `Traceability exported for batch ${batchLifecycle.batchNo}`,
      });
      toast.success('Traceability Word + Excel exported');
    } catch {
      toast.error('Export traceability gagal');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-100">
            <Layers size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Material Traceability</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">End-to-End Batch Life Cycle Tracking</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-96">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <QrCode size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Scan QR or Enter Batch No..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 transition-all uppercase italic shadow-sm"
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
          />
          {batchSearch && !selectedBatch && (
             <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {filteredBatches.map(batch => (
                  <button 
                    key={batch}
                    onClick={() => { setSelectedBatch(batch); setBatchSearch(batch); }}
                    className="w-full px-6 py-4 text-left text-xs font-black uppercase italic hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between group"
                  >
                    <span>{batch}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
                {filteredBatches.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase">Batch not found</p>
                  </div>
                )}
             </div>
          )}
        </div>
        <button
          onClick={() => void fetchTraceabilitySources()}
          disabled={isRefreshing}
          className="px-5 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!selectedBatch ? (
        <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
           <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6">
              <History size={48} />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Enter Batch Number to Start</h3>
           <p className="text-sm text-slate-400 font-medium max-w-md mt-2">
             Track when a specific material batch arrived, who received it, and which project finally consumed it.
           </p>
        </div>
      ) : batchLifecycle && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left Column: Batch DNA */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 italic">Material DNA Profile</p>
               <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none mb-2">{batchLifecycle.batchNo}</h2>
               <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                        <Package size={20} />
                     </div>
                     <div>
                        <p className="text-[9px] text-slate-400 font-black uppercase">Item Description</p>
                        <p className="text-sm font-black italic uppercase">{batchLifecycle.itemNama}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                        <Calendar size={20} />
                     </div>
                     <div>
                        <p className="text-[9px] text-slate-400 font-black uppercase">Expiry Date</p>
                        <p className={`text-sm font-black italic uppercase ${new Date(batchLifecycle.expiryDate || '') < new Date() ? 'text-rose-500' : 'text-emerald-400'}`}>
                           {batchLifecycle.expiryDate ? new Date(batchLifecycle.expiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No Expiry'}
                        </p>
                     </div>
                  </div>
               </div>

               <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 gap-6">
                  <div>
                     <p className="text-[9px] text-slate-500 font-black uppercase">Initial Qty</p>
                     <p className="text-2xl font-black italic text-indigo-400">{batchLifecycle.totalIn} <span className="text-xs uppercase">{batchLifecycle.unit}</span></p>
                  </div>
                  <div>
                     <p className="text-[9px] text-slate-500 font-black uppercase">Current Bal.</p>
                     <p className="text-2xl font-black italic text-white">{batchLifecycle.currentInStock} <span className="text-xs uppercase">{batchLifecycle.unit}</span></p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 italic">Project Consumers</h3>
               <div className="space-y-4">
                  {batchLifecycle.destinations.map((dest, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm border border-slate-100">
                             <TrendingUp size={14} className="rotate-45" />
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-900 uppercase italic line-clamp-1">{dest.project}</p>
                             <p className="text-[8px] text-slate-400 font-bold uppercase">{new Date(dest.date).toLocaleDateString('id-ID')}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-slate-900">-{dest.qty}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase">{batchLifecycle.unit}</p>
                       </div>
                    </div>
                  ))}
                  {batchLifecycle.destinations.length === 0 && (
                    <div className="py-10 text-center opacity-30">
                       <p className="text-[10px] font-black uppercase italic">Not yet consumed</p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Right Column: Timeline Flow */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
               <div className="flex items-center justify-between mb-12">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Chronological Audit Trail</h3>
                  <button
                    onClick={handleExportTrace}
                    className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1"
                  >
                     <ExternalLink size={12} /> View Full Logs
                  </button>
               </div>

               <div className="relative">
                  {/* Vertical Line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-100"></div>

                  <div className="space-y-12">
                     {batchLifecycle.history.map((m, i) => (
                       <div key={m.id} className="relative pl-16">
                          {/* Indicator Dot */}
                          <div className={`absolute left-4 top-0 w-4.5 h-4.5 rounded-full border-4 border-white shadow-sm -translate-x-1/2 mt-1 ${
                             m.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}></div>

                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                             <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                   <span className="text-[10px] font-black text-slate-400 uppercase italic">{new Date(m.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                   <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase italic ${
                                      m.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                   }`}>
                                      {m.type === 'IN' ? 'STOCK ARRIVAL' : 'STOCK OUT / RELEASE'}
                                   </span>
                                </div>
                                <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">
                                   {m.type === 'IN' ? 'Barang Diterima dari Supplier' : `Pengeluaran Barang untuk Project`}
                                </h4>
                                <div className="mt-4 flex flex-wrap gap-4">
                                   <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-black text-slate-500 border border-slate-100 uppercase italic">
                                      <Clock size={12} /> {m.jam || '08:30'}
                                   </div>
                                   <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-black text-slate-500 border border-slate-100 uppercase italic">
                                      <User size={12} /> {m.operator || 'Admin Gudang'}
                                   </div>
                                   <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-black text-slate-500 border border-slate-100 uppercase italic">
                                      <MapPin size={12} /> {m.lokasi || 'Main Warehouse'}
                                   </div>
                                </div>
                             </div>

                             <div className="flex flex-col items-end gap-2 bg-slate-50 p-6 rounded-3xl border border-slate-100 min-w-[180px]">
                                <p className={`text-2xl font-black italic ${m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                   {m.type === 'IN' ? '+' : '-'}{m.qty} <span className="text-xs uppercase">{m.unit}</span>
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest">{m.refNo}</p>
                             </div>
                          </div>
                       </div>
                     ))}
                  </div>

                  {/* Future Step (Placeholder) */}
                  {batchLifecycle.currentInStock > 0 && (
                    <div className="relative pl-16 mt-12 opacity-50 grayscale">
                       <div className="absolute left-4 top-0 w-4.5 h-4.5 rounded-full bg-slate-200 border-4 border-white shadow-sm -translate-x-1/2 mt-1"></div>
                       <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem]">
                          <p className="text-xs font-black text-slate-400 uppercase italic text-center tracking-widest">Awaiting Future Distribution</p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
