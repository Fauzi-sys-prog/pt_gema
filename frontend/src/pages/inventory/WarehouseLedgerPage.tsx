import React, { useEffect, useState, useMemo } from 'react';
import { Package, Search, Filter, ArrowUpRight, ArrowDownRight, MoreVertical, MapPin, AlertTriangle, History, Box, Layers, TrendingUp, Download, Database, ShieldCheck, Tag, Calendar, Hourglass, ClipboardList, ChevronRight } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function WarehouseLedgerPage() {
  const navigate = useNavigate();
  const { stockItemList: ctxStockItemList = [], stockMovementList: ctxStockMovementList = [], receivingList: ctxReceivingList = [], projectList: ctxProjectList = [], poList: ctxPoList = [], addAuditLog, currentUser } = useApp();
  const [serverStockItemList, setServerStockItemList] = useState<typeof ctxStockItemList | null>(null);
  const [serverStockMovementList, setServerStockMovementList] = useState<typeof ctxStockMovementList | null>(null);
  const [serverReceivingList, setServerReceivingList] = useState<typeof ctxReceivingList | null>(null);
  const [serverProjectList, setServerProjectList] = useState<typeof ctxProjectList | null>(null);
  const [serverPoList, setServerPoList] = useState<typeof ctxPoList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const stockItemList = serverStockItemList ?? ctxStockItemList;
  const stockMovementList = serverStockMovementList ?? ctxStockMovementList;
  const receivingList = serverReceivingList ?? ctxReceivingList;
  const projectList = serverProjectList ?? ctxProjectList;
  const poList = serverPoList ?? ctxPoList;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload ?? {};
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return payload as T;
    });
  const normalizeList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
      return (payload as { items: T[] }).items;
    }
    return [];
  };

  const fetchWarehouseSources = async () => {
    try {
      setIsRefreshing(true);
      const [stockItemRes, stockMovementRes, receivingRes, projectRes, poRes] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/movements'),
        api.get('/receivings'),
        api.get('/projects'),
        api.get('/purchase-orders'),
      ]);
      setServerStockItemList(normalizeEntityRows<any>(normalizeList<any>(stockItemRes.data)));
      setServerStockMovementList(normalizeEntityRows<any>(normalizeList<any>(stockMovementRes.data)));
      setServerReceivingList(normalizeList<any>(receivingRes.data));
      setServerProjectList(normalizeList<any>(projectRes.data));
      setServerPoList(normalizeList<any>(poRes.data));
    } catch {
      setServerStockItemList(null);
      setServerStockMovementList(null);
      setServerReceivingList(null);
      setServerProjectList(null);
      setServerPoList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchWarehouseSources();
  }, []);

  // Logic: Check for Approved Material Requests from Projects that haven't been fulfilled
  const approvedRequests = useMemo(() => {
    return projectList.reduce((acc, p) => {
      const approved = (p.materialRequests || []).filter((r: any) => r.status === 'Approved');
      return acc + approved.length;
    }, 0);
  }, [projectList]);

  // Derived stats
  const stats = useMemo(() => {
    const totalItems = stockItemList.length;
    const lowStockCount = stockItemList.filter(i => i.stok <= i.minStock).length;
    const totalValue = stockItemList.reduce((acc, curr) => acc + (curr.stok * curr.hargaSatuan), 0);
    const pendingRecv = receivingList.filter(r => r.status === 'Partial' || r.status === 'Pending').length;

    return { totalItems, lowStockCount, totalValue, pendingRecv };
  }, [stockItemList, receivingList]);

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(stockItemList.map(i => i.kategori))];
    return cats;
  }, [stockItemList]);

  const locations = useMemo(() => {
    const locs = ['All', ...new Set(stockItemList.map(i => i.lokasi))];
    return locs;
  }, [stockItemList]);

  const filteredItems = useMemo(() => {
    return stockItemList.filter(item => {
      const matchSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.kode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'All' || item.kategori === selectedCategory;
      const matchLoc = selectedLocation === 'All' || item.lokasi === selectedLocation;
      return matchSearch && matchCat && matchLoc;
    });
  }, [stockItemList, searchTerm, selectedCategory, selectedLocation]);

  const itemsByCategory = useMemo(() => {
    const groups: { [key: string]: typeof stockItemList } = {};
    filteredItems.forEach(item => {
      if (!groups[item.kategori]) groups[item.kategori] = [];
      groups[item.kategori].push(item);
    });
    return groups;
  }, [filteredItems]);

  const supplierBySku = useMemo(() => {
    const map = new Map<string, string>();
    const normalizedPo = (Array.isArray(poList) ? poList : []) as any[];
    for (const po of normalizedPo) {
      const supplier = String(po?.supplier || '').trim();
      if (!supplier) continue;
      const items = Array.isArray(po?.items) ? po.items : [];
      for (const row of items) {
        const kode = String(row?.kode || '').trim();
        const nama = String(row?.nama || '').trim();
        if (kode && !map.has(`kode:${kode.toLowerCase()}`)) map.set(`kode:${kode.toLowerCase()}`, supplier);
        if (nama && !map.has(`nama:${nama.toLowerCase()}`)) map.set(`nama:${nama.toLowerCase()}`, supplier);
      }
    }
    for (const rcv of (Array.isArray(receivingList) ? receivingList : []) as any[]) {
      const supplier = String(rcv?.supplier || '').trim();
      if (!supplier) continue;
      for (const row of Array.isArray(rcv?.items) ? rcv.items : []) {
        const kode = String(row?.itemKode || '').trim();
        const nama = String(row?.itemName || '').trim();
        if (kode && !map.has(`kode:${kode.toLowerCase()}`)) map.set(`kode:${kode.toLowerCase()}`, supplier);
        if (nama && !map.has(`nama:${nama.toLowerCase()}`)) map.set(`nama:${nama.toLowerCase()}`, supplier);
      }
    }
    return map;
  }, [poList, receivingList]);

  const resolveItemSupplier = (item: any): string =>
    String(item?.supplier || '').trim() ||
    supplierBySku.get(`kode:${String(item?.kode || '').toLowerCase()}`) ||
    supplierBySku.get(`nama:${String(item?.nama || '').toLowerCase()}`) ||
    '-';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleExport = async () => {
    const rows = [
      ['Kode', 'Nama', 'Kategori', 'Supplier', 'Stok', 'MinStock', 'Satuan', 'HargaSatuan', 'Lokasi', 'ExpiryDate'],
      ...filteredItems.map((item) => [
        item.kode,
        item.nama,
        item.kategori,
        resolveItemSupplier(item),
        String(item.stok),
        String(item.minStock),
        item.satuan,
        String(item.hargaSatuan),
        item.lokasi || '',
        item.expiryDate || '',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `warehouse-ledger-${dateKey}`,
      title: 'Warehouse Ledger Report',
      subtitle: `Kategori ${selectedCategory} | Lokasi ${selectedLocation} | Total item ${filteredItems.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ledger gudang dengan total inventory value ${formatCurrency(stats.totalValue)} dan pending receiving ${stats.pendingRecv} dokumen.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Warehouse Ledger',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `warehouse-ledger-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `warehouse-ledger-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'WAREHOUSE_LEDGER_EXPORTED',
        module: 'Inventory',
        entityType: 'WarehouseLedger',
        entityId: 'all',
        description: `Export warehouse ledger (${filteredItems.length} rows)`,
      });
      toast.success('Warehouse ledger Word + Excel exported');
    } catch {
      toast.error('Export warehouse ledger gagal');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-20">
      {/* Premium Header */}
      <div className="bg-slate-900 text-white p-10 lg:p-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-20 opacity-10 pointer-events-none">
          <Database className="w-96 h-96 rotate-12" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.5em]">Inventory integrity system</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase leading-none">
                Warehouse <br /> Ledger
              </h1>
              <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                PT. Gema Teknik Perkasa <span className="w-1 h-1 bg-slate-600 rounded-full" /> Stock Central Management
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/inventory/stock-journal')}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 italic cursor-pointer"
              >
                <History className="w-4 h-4" /> Audit Movement
              </button>
              <button 
                onClick={() => navigate('/inventory/stock-in')}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 italic shadow-xl shadow-emerald-500/20 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" /> Inbound Logistics
              </button>
              <button 
                onClick={() => navigate('/inventory/traceability')}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 italic shadow-xl shadow-indigo-500/20 cursor-pointer"
              >
                <Layers className="w-4 h-4" /> Batch Traceability
              </button>
              <button 
                onClick={() => navigate('/inventory/opname')}
                className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 italic shadow-xl shadow-white/10 cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" /> Stock Opname
              </button>
              <button 
                onClick={() => navigate('/inventory/aging')}
                className="px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 italic shadow-xl shadow-rose-500/20 cursor-pointer"
              >
                <Hourglass className="w-4 h-4" /> FEFO & Aging
              </button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-sm">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-4 italic">Total SKU Registered</label>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black italic leading-none">{stats.totalItems}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase mb-1">Items</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-sm">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-4 italic">Inventory Asset Value</label>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black italic leading-none">{formatCurrency(stats.totalValue).replace('Rp', '')}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase mb-1 italic">IDR</span>
              </div>
            </div>
            <div className={`rounded-[32px] p-8 border ${stats.lowStockCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
              <label className={`text-[9px] font-black uppercase tracking-widest block mb-4 italic ${stats.lowStockCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>Critical Stock Alert</label>
              <div className="flex items-end gap-3">
                <span className={`text-4xl font-black italic leading-none ${stats.lowStockCount > 0 ? 'text-amber-500' : 'text-white'}`}>{stats.lowStockCount}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase mb-1 italic">Shortages</span>
              </div>
            </div>
            <div className={`rounded-[32px] p-8 border backdrop-blur-sm transition-all ${approvedRequests > 0 ? 'bg-indigo-500/20 border-indigo-500/40 shadow-2xl shadow-indigo-500/10' : 'bg-white/5 border-white/10'}`}>
              <label className={`text-[9px] font-black uppercase tracking-widest block mb-4 italic ${approvedRequests > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>Project Material Request</label>
              <div className="flex items-end gap-3">
                <span className={`text-4xl font-black italic leading-none ${approvedRequests > 0 ? 'text-indigo-400' : 'text-white'}`}>{approvedRequests}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase mb-1 italic">Pending Issue</span>
              </div>
              {approvedRequests > 0 && (
                <button 
                  onClick={() => navigate('/inventory/stock-out')}
                  className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all cursor-pointer"
                >
                  Fulfill Requests <ChevronRight size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto -mt-10 px-6 lg:px-8">
        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-8 lg:p-10 border-b border-slate-50 flex flex-col lg:flex-row gap-6 items-center justify-between bg-white">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" 
                placeholder="Search SKU or Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 py-5 bg-slate-50 border-none rounded-2xl font-black text-xs uppercase tracking-widest outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-900 italic"
              />
            </div>

            <div className="flex flex-wrap gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl">
                <Filter className="w-4 h-4 text-slate-400 ml-2" />
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent border-none font-black text-[10px] uppercase tracking-widest text-slate-600 outline-none pr-8 cursor-pointer italic"
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl">
                <MapPin className="w-4 h-4 text-slate-400 ml-2" />
                <select 
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="bg-transparent border-none font-black text-[10px] uppercase tracking-widest text-slate-600 outline-none pr-8 cursor-pointer italic"
                >
                  {locations.map(loc => <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>)}
                </select>
              </div>
              <button
                onClick={handleExport}
                className="p-5 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-slate-900/20 cursor-pointer"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => void fetchWarehouseSources()}
                disabled={isRefreshing}
                className="px-4 py-5 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Table Header like Image */}
          <div className="p-8 border-b-2 border-slate-900 bg-white">
            <h2 className="text-sm font-black italic uppercase tracking-widest text-slate-900">Stock Material Per {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em]">Gema Teknik Perkasa</h3>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center italic border border-slate-700 w-16">No</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-left italic border border-slate-700">Nama Material</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-left italic border border-slate-700">Supplier</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center italic border border-slate-700">Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right italic border border-slate-700">Harga</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center italic border border-slate-700">Expiry</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-left italic border border-slate-700">Keterangan</th>
                </tr>
              </thead>
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <tbody key={category}>
                  {/* Category Header */}
                  <tr className="bg-amber-400 border-y-2 border-slate-900">
                    <td colSpan={7} className="px-6 py-2 text-xs font-black italic uppercase tracking-widest text-slate-900">
                      {category}
                    </td>
                  </tr>
                  {items.map((item, idx) => {
                    const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
                    const isNearExpiry = item.expiryDate && !isExpired && 
                      (new Date(item.expiryDate).getTime() - new Date().getTime()) < (30 * 24 * 60 * 60 * 1000); // 30 days

                    return (
                      <tr 
                        key={item.id} 
                        className="group hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-100"
                        onClick={() => navigate(`/inventory/stock-card/${item.id}`)}
                      >
                        <td className="px-6 py-4 text-center text-xs font-bold text-slate-400 border-x border-slate-50">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 italic uppercase tracking-tight group-hover:text-amber-600 transition-colors">
                              {item.nama}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.kode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 border-r border-slate-50 uppercase italic">
                          {resolveItemSupplier(item)}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-50">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className={`text-sm font-black italic ${item.stok <= item.minStock ? 'text-rose-600' : 'text-slate-900'}`}>
                              {item.stok.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{item.satuan}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right border-r border-slate-50">
                          <span className="text-xs font-black italic text-slate-900">
                            {item.hargaSatuan > 0 ? formatCurrency(item.hargaSatuan).replace('Rp', 'Rp ') : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r border-slate-50 text-center">
                          {item.expiryDate ? (
                            <div className={`flex flex-col items-center ${isExpired ? 'text-rose-600' : isNearExpiry ? 'text-amber-600' : 'text-slate-600'}`}>
                              <div className="flex items-center gap-1 font-black italic text-[10px]">
                                <Calendar className="w-3 h-3" />
                                {new Date(item.expiryDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                              </div>
                              {isExpired && <span className="text-[8px] font-black uppercase tracking-tighter">EXPIRED</span>}
                              {isNearExpiry && <span className="text-[8px] font-black uppercase tracking-tighter">NEAR EXPIRY</span>}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase italic">
                          {isExpired ? 'DO NOT USE - EXPIRED' : item.stok <= item.minStock ? 'REORDER REQUIRED' : item.lokasi}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>

            {filteredItems.length === 0 && (
              <div className="p-20 flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 mb-6">
                  <Package className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight">Zero Results Found</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Try adjusting your filters or search query</p>
              </div>
            )}
          </div>

          <div className="p-8 lg:p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest italic">Inventory Health</p>
                <h4 className="text-xl font-black italic uppercase tracking-tighter">Optimal Operating Level</h4>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="text-right hidden md:block">
                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1 italic">Total Valuation</p>
                <p className="text-2xl font-black italic uppercase tracking-tighter text-emerald-400">{formatCurrency(stats.totalValue)}</p>
              </div>
              <button 
                onClick={() => navigate('/inventory/stock-journal')}
                className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:bg-emerald-400 hover:scale-105 active:scale-95 italic shadow-2xl cursor-pointer"
              >
                Stock Ledger Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
