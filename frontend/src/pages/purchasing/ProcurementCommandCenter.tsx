import React, { useEffect, useMemo, useState } from 'react';
import { Zap, ShoppingCart, ArrowRight, Package, CheckCircle2, Clock, AlertCircle, Building2, ChevronRight, TrendingDown, Layers, Filter, Download, ExternalLink } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';

type ProcurementDemandItem = {
  kode: string;
  nama: string;
  unit: string;
  supplier: string;
  stock: number;
  onOrder: number;
  requiredByProjects: Array<{
    projectId: string;
    projectNo: string;
    projectName: string;
    qty: number;
    source: string;
  }>;
  totalRequired: number;
  gap: number;
};

type ProcurementSummaryResponse = {
  demandGaps?: ProcurementDemandItem[];
};

export default function ProcurementCommandCenter() {
  const { projectList, stockItemList, poList, addPO, addAuditLog, currentUser } = useApp();
  const navigate = useNavigate();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [summaryData, setSummaryData] = useState<ProcurementSummaryResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isProjectReadyForProcurement = (project: any) =>
    ['In Progress', 'Planning', 'Active'].includes(project?.status) &&
    String(project?.approvalStatus || '').toUpperCase() === 'APPROVED';

  // 1. Consolidated Material Demand Analysis
  const localGlobalDemand = useMemo(() => {
    const pendingPoQtyMap: Record<string, number> = {};
    
    // Get all pending orders
    poList.filter(po => ['Sent', 'Partial', 'Approved'].includes(po.status)).forEach(po => {
      po.items.forEach(item => {
        pendingPoQtyMap[item.kode] = (pendingPoQtyMap[item.kode] || 0) + item.qty;
      });
    });

    // Extract demands from APPROVED active projects
    const itemDemands: Record<string, any> = {};

    projectList.filter(isProjectReadyForProcurement).forEach(project => {
      // A) BOQ demand baseline
      (project.boq || []).forEach((boqItem: any) => {
        const itemKode = boqItem.itemKode;
        if (!itemKode) return;
        if (!itemDemands[itemKode]) {
          const master = stockItemList.find(s => s.kode === itemKode);
          itemDemands[itemKode] = {
            kode: itemKode,
            nama: boqItem.materialName,
            unit: boqItem.unit,
            supplier: boqItem.supplier || master?.supplier || 'Unknown',
            stock: master?.stok || 0,
            onOrder: pendingPoQtyMap[itemKode] || 0,
            requiredByProjects: [],
            totalRequired: 0,
          };
        }
        itemDemands[itemKode].totalRequired += Number(boqItem.qtyEstimate || 0);
            itemDemands[itemKode].requiredByProjects.push({
              projectId: project.id,
              projectNo: project.kodeProject || project.id,
              projectName: project.namaProject,
              qty: Number(boqItem.qtyEstimate || 0),
              source: 'BOQ',
            });
          });

      // B) Material Request demand (approved/ordered but not delivered)
      (project.materialRequests || [])
        .filter((mr: any) => ['Approved', 'Ordered'].includes(String(mr.status || '')))
        .forEach((mr: any) => {
          const materialRows = Array.isArray(mr.items) && mr.items.length > 0
            ? mr.items
            : [{
                itemKode: mr.itemCode || mr.itemKode || '',
                itemNama: mr.itemName || mr.nama || '',
                qty: mr.quantity || mr.qty || 0,
                unit: mr.unit || 'Unit',
              }];

          materialRows.forEach((mrItem: any) => {
            const itemKode = mrItem.itemKode;
            if (!itemKode) return;
            if (!itemDemands[itemKode]) {
              const master = stockItemList.find(s => s.kode === itemKode);
              itemDemands[itemKode] = {
                kode: itemKode,
                nama: mrItem.itemNama || master?.nama || 'Unknown Item',
                unit: mrItem.unit || master?.unit || 'Unit',
                supplier: master?.supplier || 'Unknown',
                stock: master?.stok || 0,
                onOrder: pendingPoQtyMap[itemKode] || 0,
                requiredByProjects: [],
                totalRequired: 0,
              };
            }
            const reqQty = Number(mrItem.qty || 0);
            itemDemands[itemKode].totalRequired += reqQty;
            itemDemands[itemKode].requiredByProjects.push({
              projectId: project.id,
              projectNo: project.kodeProject || project.id,
              projectName: project.namaProject,
              qty: reqQty,
              source: `MR ${mr.noRequest || '-'}`,
            });
          });
        });
    });

    // Calculate Gaps
    return Object.values(itemDemands)
      .map(item => ({
        ...item,
        gap: item.totalRequired - (item.stock + item.onOrder)
      }))
      .filter(item => item.gap > 0)
      .sort((a, b) => b.gap - a.gap);
  }, [projectList, stockItemList, poList]);

  const loadSummary = async (silent = true) => {
    if (!silent) setIsRefreshing(true);
    try {
      const { data } = await api.get<ProcurementSummaryResponse>('/dashboard/procurement-summary');
      setSummaryData(data);
      if (!silent) toast.success('Procurement summary diperbarui');
    } catch {
      if (!silent) toast.error('Gagal refresh procurement summary');
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(true);
  }, []);

  const globalDemand = useMemo(
    () =>
      (summaryData?.demandGaps && summaryData.demandGaps.length > 0
        ? summaryData.demandGaps
        : localGlobalDemand) as ProcurementDemandItem[],
    [summaryData, localGlobalDemand]
  );

  const toggleSelection = (kode: string) => {
    setSelectedItems(prev => 
      prev.includes(kode) ? prev.filter(k => k !== kode) : [...prev, kode]
    );
  };

  const handleBatchPO = async () => {
    if (selectedItems.length === 0) {
      toast.error("Pilih setidaknya satu material untuk diproses!");
      return;
    }

    const itemsToProcess = globalDemand.filter(d => selectedItems.includes(d.kode));
    const bySupplier: Record<string, any[]> = {};

    itemsToProcess.forEach(item => {
      if (!bySupplier[item.supplier]) bySupplier[item.supplier] = [];
      bySupplier[item.supplier].push(item);
    });

    // Create Draft POs
    const draftPOs = Object.entries(bySupplier).map(([supplier, items]) => {
      const projectIds = Array.from(new Set(items.flatMap((i: any) => (i.requiredByProjects || []).map((p: any) => p.projectId).filter(Boolean))));
      return {
        id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        noPO: `PO-AUTO-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        tanggal: new Date().toISOString().split('T')[0],
        supplier: supplier === 'Unknown' ? 'TBD Supplier' : supplier,
        status: 'Draft' as const,
        projectId: projectIds.length === 1 ? projectIds[0] : undefined,
        total: 0, // harga diisi manual di halaman PO
        items: items.map((i: any, idx: number) => {
          const sources = Array.from(new Set((i.requiredByProjects || []).map((p: any) => String(p.source || '').trim()).filter(Boolean)));
          return {
            id: `poi-${Date.now()}-${idx}`,
            kode: i.kode,
            nama: i.nama,
            qty: i.gap,
            unit: i.unit,
            unitPrice: 0,
            total: 0,
            source: sources.length ? 'AutoProc' : 'Manual',
            sourceRef: sources.join(', '),
          };
        }),
        notes: `Generated by Command Center Batch Processing. Covers demand for ${items.length} items.`
      };
    });

    const results = await Promise.allSettled(draftPOs.map((po) => addPO(po as any)));
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      addAuditLog({
        action: 'PROCUREMENT_BATCH_PO_CREATED',
        module: 'Procurement',
        entityType: 'PurchaseOrder',
        entityId: 'batch',
        description: `Batch PO created: ${successCount} draft(s)`,
      });
      toast.success(`${successCount} Draft PO berhasil dibuat.`);
    }
    if (failedCount > 0) {
      toast.warning(`${failedCount} Draft PO gagal dibuat. Cek backend/log.`);
    }
    if (successCount === 0) {
      return;
    }

    setSelectedItems([]);
    navigate('/purchasing/purchase-order');
  };

  const handleExportDemand = async () => {
    const rows = [
      ['Kode', 'Nama', 'Unit', 'Supplier', 'Stock', 'OnOrder', 'TotalRequired', 'Gap', 'ImpactedProjects'],
      ...globalDemand.map((item) => [
        item.kode,
        item.nama,
        item.unit,
        item.supplier,
        String(item.stock),
        String(item.onOrder),
        String(item.totalRequired),
        String(item.gap),
        String(item.requiredByProjects.length),
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `procurement-demand-gap-${dateKey}`,
      title: 'Procurement Demand Gap Report',
      subtitle: `Tanggal ${dateKey} | Items with gap ${globalDemand.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan kebutuhan: total gap ${globalDemand.reduce((sum, item) => sum + item.gap, 0)} unit, total project terdampak ${globalDemand.reduce((sum, item) => sum + item.requiredByProjects.length, 0)}, dipakai untuk prioritas pembelian lintas proyek.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Procurement Command',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `procurement-demand-gap-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `procurement-demand-gap-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'PROCUREMENT_DEMAND_EXPORTED',
        module: 'Procurement',
        entityType: 'DemandGap',
        entityId: 'all',
        description: `Export demand gap (${globalDemand.length} rows)`,
      });
      toast.success('Demand gap Word + Excel exported');
    } catch {
      toast.error('Export demand gap gagal');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-[#0F172A] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full -mr-48 -mt-48 blur-3xl opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-xl rotate-3">
              <Zap size={32} className="fill-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">Auto-Procurement Command</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] mt-1">Cross-Project Demand Aggregator & Intelligent Sourcing</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <div className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Items with Gap</p>
              <p className="text-2xl font-black italic text-indigo-400">{globalDemand.length}</p>
           </div>
           <button
             onClick={() => loadSummary(false)}
             disabled={isRefreshing}
             className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
           >
             {isRefreshing ? 'Refreshing...' : 'Refresh'}
           </button>
           <button 
             onClick={handleBatchPO}
             disabled={selectedItems.length === 0}
             className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-95"
           >
             <ShoppingCart size={18} /> Batch Process ({selectedItems.length})
           </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Demand List */}
        <div className="lg:col-span-12 space-y-6">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Consolidated Demand Ledger</h2>
              </div>
              
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedItems(globalDemand.map(d => d.kode))} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Select All</button>
                <button onClick={() => setSelectedItems([])} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Clear</button>
                <button onClick={handleExportDemand} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                  <Download size={12} /> Export Word + Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-center w-20">Proc.</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">Material & Supplier</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-center">Net Available</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-center">Total Required</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-right">Shortage (GAP)</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-right">Impacted Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {globalDemand.map((item) => (
                    <tr 
                      key={item.kode} 
                      className={`hover:bg-indigo-50/30 transition-all group cursor-pointer ${selectedItems.includes(item.kode) ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => toggleSelection(item.kode)}
                    >
                      <td className="px-10 py-8 text-center">
                        <div className={`w-6 h-6 rounded-lg border-2 mx-auto flex items-center justify-center transition-all ${
                          selectedItems.includes(item.kode) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white group-hover:border-indigo-400'
                        }`}>
                          {selectedItems.includes(item.kode) && <CheckCircle2 size={14} />}
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all shrink-0">
                            <Package size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{item.nama}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{item.kode}</span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                              <span className="text-[10px] font-black text-indigo-600 uppercase italic flex items-center gap-1">
                                <Building2 size={10} /> {item.supplier}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">{item.stock + item.onOrder}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">({item.stock} Whse + {item.onOrder} PO)</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center font-black text-slate-900 text-xs">
                        {item.totalRequired} <span className="text-[9px] text-slate-400 lowercase">{item.unit}</span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-black text-rose-600 italic">-{item.gap}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-wrap gap-2 justify-end">
                          {item.requiredByProjects.slice(0, 2).map((p: any, idx: number) => (
                            <div key={idx} className="px-3 py-1.5 bg-slate-100 rounded-xl text-[9px] font-black text-slate-600 uppercase italic border border-slate-200">
                              {p.projectNo}: {p.qty}
                            </div>
                          ))}
                          {item.requiredByProjects.length > 2 && (
                            <div className="px-3 py-1.5 bg-indigo-50 rounded-xl text-[9px] font-black text-indigo-600 uppercase border border-indigo-100">
                              +{item.requiredByProjects.length - 2} More
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {globalDemand.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-10 py-32 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 mx-auto mb-6 border-2 border-dashed border-slate-200">
                          <CheckCircle2 size={48} />
                        </div>
                        <h3 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight">Zero Gaps Detected</h3>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">All active projects are fully provisioned by current inventory & pipeline POs.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
