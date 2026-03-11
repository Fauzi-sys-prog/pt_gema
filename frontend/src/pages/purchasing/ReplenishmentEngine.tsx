import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; import { AlertTriangle, ShoppingCart, ArrowRight, Package, TrendingDown, CheckCircle2, Clock, ExternalLink, ChevronRight } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import type { Project, StockItem, PurchaseOrder } from '../../contexts/AppContext';
import api from '../../services/api';

export default function ReplenishmentEngine() {
  const { projectList, stockItemList, poList, addAuditLog } = useApp();
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<StockItem[] | null>(null);
  const [serverPoList, setServerPoList] = useState<PurchaseOrder[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) return payload as T[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: T[] }).items;
      }
      return [];
    };

    const loadPageData = async () => {
      try {
        const [projectsRes, stockItemsRes, poRes] = await Promise.all([
          api.get('/projects'),
          api.get('/inventory/items'),
          api.get('/purchase-orders'),
        ]);
        if (!mounted) return;
        setServerProjectList(normalizeList<Project>(projectsRes.data));
        setServerStockItemList(normalizeList<StockItem>(stockItemsRes.data));
        setServerPoList(normalizeList<PurchaseOrder>(poRes.data));
      } catch {
        if (!mounted) return;
        setServerProjectList(null);
        setServerStockItemList(null);
        setServerPoList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveProjectList = serverProjectList ?? projectList;
  const effectiveStockItemList = serverStockItemList ?? stockItemList;
  const effectivePoList = serverPoList ?? poList;

  // Logic to calculate material gaps across projects
  const materialGaps = useMemo(() => {
    const gaps: any[] = [];
    
    // 1. Get all pending PO quantities
    const pendingPoQtyMap: Record<string, number> = {};
    effectivePoList.filter(po => po.status === 'Sent' || po.status === 'Partial').forEach(po => {
      po.items.forEach(item => {
        pendingPoQtyMap[item.kode] = (pendingPoQtyMap[item.kode] || 0) + item.qty;
      });
    });

    // 2. Iterate through projects and their BOQs
    effectiveProjectList
      .filter(
        (p) =>
          ['Active', 'In Progress', 'Planning'].includes(String(p.status || '')) &&
          String((p as any).approvalStatus || '').toUpperCase() === 'APPROVED'
      )
      .forEach(project => {
      if (project.boq) {
        project.boq.forEach((boqItem: any) => {
          const stockItem = effectiveStockItemList.find(s => s.kode === boqItem.itemKode);
          const currentStock = stockItem?.stok || 0;
          const onOrder = pendingPoQtyMap[boqItem.itemKode] || 0;
          
          // Gap = BOQ Requirement - (Physical Stock + Pending POs)
          const gapQty = boqItem.qtyEstimate - (currentStock + onOrder);
          
          if (gapQty > 0) {
            gaps.push({
              projectId: project.id,
              projectKode: project.kodeProject || project.id,
              projectName: project.namaProject,
              itemKode: boqItem.itemKode,
              itemNama: boqItem.materialName,
              required: boqItem.qtyEstimate,
              available: currentStock,
              onOrder: onOrder,
              gap: gapQty,
              unit: boqItem.unit,
              priority: gapQty > (boqItem.qtyEstimate * 0.5) ? 'High' : 'Medium'
            });
          }
        });
      }
    });

    return gaps;
  }, [effectivePoList, effectiveProjectList, effectiveStockItemList]);

  // Approaching Expiry Analysis
  const expiryAlerts = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 3); // Check for next 3 months

    return effectiveStockItemList
      .filter(item => item.expiryDate && new Date(item.expiryDate) <= nextMonth)
      .map(item => ({
        ...item,
        isExpired: new Date(item.expiryDate!) < today,
        daysLeft: Math.ceil((new Date(item.expiryDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [effectiveStockItemList]);

  const handleCreateDraftPO = (gap: any) => {
    addAuditLog({
      action: 'REPLENISHMENT_DRAFT_PO_REQUESTED',
      module: 'Procurement',
      entityType: 'MaterialGap',
      entityId: String(gap.itemKode || ''),
      description: `Create draft PO from gap ${gap.itemNama} (${gap.projectKode})`,
    });
    navigate('/procurement', { 
      state: { 
        fromProject: true,
        projectId: gap.projectId,
        projectNo: gap.projectKode,
        projectName: gap.projectName,
        boqItems: [{
          materialName: gap.itemNama,
          itemKode: gap.itemKode,
          qtyEstimate: gap.gap, // Only order what's missing
          unit: gap.unit,
          unitPrice: 0, // Needs to be filled or fetched from master
          supplier: "",
          status: "Unordered"
        }]
      } 
    });
  };

  const handleViewInventory = () => {
    addAuditLog({
      action: 'REPLENISHMENT_VIEW_INVENTORY',
      module: 'Procurement',
      entityType: 'Stock',
      entityId: 'all',
      description: 'Open stock items from replenishment engine',
    });
    navigate('/stock/items');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Material Gap Analysis */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">BOQ Gap Analysis</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Kebutuhan Proyek vs Saldo Stok + PO Pending</p>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
              {materialGaps.length} Recommendations
            </div>
          </div>

          <div className="space-y-4">
            {materialGaps.length > 0 ? materialGaps.map((gap, i) => (
              <div key={i} className="group p-6 bg-slate-50 hover:bg-white rounded-3xl border border-transparent hover:border-slate-100 transition-all hover:shadow-xl hover:shadow-slate-100/50">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase italic rounded-md">{gap.projectKode}</span>
                       <h4 className="text-sm font-black text-slate-900 uppercase italic line-clamp-1">{gap.projectName}</h4>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{gap.itemNama}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{gap.itemKode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 px-6 border-x border-slate-200/50">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Stock + PO</p>
                      <p className="text-xs font-black text-slate-900">{gap.available + gap.onOrder} <span className="text-[8px]">{gap.unit}</span></p>
                    </div>
                    <div className="text-slate-200">
                      <ArrowRight size={16} />
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Required</p>
                      <p className="text-xs font-black text-slate-900">{gap.required} <span className="text-[8px]">{gap.unit}</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-center gap-3">
                    <div className="text-right">
                       <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Gap: -{gap.gap} {gap.unit}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Need Procurement</p>
                    </div>
                    <button 
                      onClick={() => handleCreateDraftPO(gap)}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                       <ShoppingCart size={14} /> Create Draft PO
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                 <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
                 <p className="text-sm font-black text-slate-400 uppercase italic">All material requirements are covered</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Expiry & Critical Alerts */}
      <div className="space-y-6">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
           <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 mb-8">
             <Clock size={20} className="text-rose-400" /> Expiry Watchlist
           </h3>

           <div className="space-y-4">
              {expiryAlerts.map((item, i) => (
                <div key={i} className={`p-5 rounded-2xl border flex flex-col gap-3 ${
                  item.isExpired ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'
                }`}>
                   <div className="flex justify-between items-start">
                      <div className="flex-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{item.kode}</p>
                         <h4 className="text-xs font-black uppercase italic leading-tight">{item.nama}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                        item.isExpired ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-slate-900'
                      }`}>
                        {item.isExpired ? 'EXPIRED' : `${item.daysLeft} Days Left`}
                      </span>
                   </div>
                   
                   <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Warehouse Location</p>
                        <p className="text-[10px] font-black text-slate-300 uppercase italic">{item.lokasi || 'Main Storage'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Current Stock</p>
                        <p className="text-[10px] font-black text-white">{item.stok} <span className="text-[8px] text-slate-400">{item.satuan}</span></p>
                      </div>
                   </div>

                   {item.isExpired && (
                     <div className="pt-2 border-t border-rose-500/20">
                        <p className="text-[8px] text-rose-400 font-black uppercase leading-tight">
                          Item ini harus segera di-disposal atau di-adjust untuk keamanan operasional.
                        </p>
                     </div>
                   )}
                </div>
              ))}
              {expiryAlerts.length === 0 && (
                <div className="py-10 text-center opacity-30">
                  <CheckCircle2 size={32} className="mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase">No items expiring soon</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2 italic">
             <TrendingDown size={14} /> Low Stock Alerts
           </h3>
           <div className="space-y-3">
              {effectiveStockItemList.filter(s => s.stok <= s.minStock).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm border border-slate-100">
                        <AlertTriangle size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase italic line-clamp-1">{item.nama}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Min: {item.minStock} • Current: {item.stok}</p>
                      </div>
                   </div>
                   <button
                     onClick={() => toast.info(`${item.nama} | stok ${item.stok} ${item.satuan}`)}
                     className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                   >
                     <ChevronRight size={14} className="text-slate-300" />
                   </button>
                </div>
              ))}
           </div>
           <button
             onClick={handleViewInventory}
             className="w-full mt-6 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all"
           >
              View All Inventory <ExternalLink size={12} />
           </button>
        </div>
      </div>
    </div>
  );
}
