import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, Filter, ArrowUpRight, AlertCircle, Calendar, Layers, FileText, Download, ChevronRight } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { StockItem } from '../../contexts/AppContext';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';

export default function StockReportPage() {
  const { stockItemList = [], addAuditLog, currentUser } = useApp();
  const [serverStockItemList, setServerStockItemList] = useState<StockItem[] | null>(null);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

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
        const itemsRes = await api.get('/inventory/items');
        if (!mounted) return;
        setServerStockItemList(normalizeList<StockItem>(itemsRes.data));
      } catch {
        if (!mounted) return;
        setServerStockItemList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveStockItemList = serverStockItemList ?? stockItemList;
  const stats = useMemo(() => {
    const totalItems = effectiveStockItemList.length;
    const lowStock = effectiveStockItemList.filter(i => (i.stok || 0) <= (i.minStock || 5)).length;
    const totalValue = effectiveStockItemList.reduce((acc, i) => acc + ((i.stok || 0) * (i.hargaSatuan || 0)), 0);
    
    return { totalItems, lowStock, totalValue };
  }, [effectiveStockItemList]);

  const filteredItems = useMemo(() => {
    return effectiveStockItemList.filter(item => 
      (item.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.kode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [effectiveStockItemList, searchTerm]);

  const handleExport = async () => {
    const rows = [
      ['Kode', 'Nama', 'Kategori', 'Lokasi', 'Stock', 'MinStock', 'Satuan', 'HargaSatuan', 'InventoryValue'],
      ...filteredItems.map((item) => [
        item.kode,
        item.nama,
        item.kategori,
        item.lokasi || 'A-1',
        String(item.stok || 0),
        String(item.minStock || 0),
        item.satuan || '',
        String(item.hargaSatuan || 0),
        String((item.stok || 0) * (item.hargaSatuan || 0)),
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `stock-report-${dateKey}`,
      title: 'Stock Report Summary',
      subtitle: `Per tanggal ${dateKey} | Total item ${filteredItems.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan stok dan warehouse ledger dengan total SKU ${stats.totalItems}, low stock ${stats.lowStock}, dan nilai inventory ${formatCurrency(stats.totalValue)}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Report',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `stock-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `stock-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'STOCK_REPORT_EXPORTED',
        module: 'Inventory',
        entityType: 'StockReport',
        entityId: 'all',
        description: `Export stock report (${filteredItems.length} rows)`,
      });
      toast.success('Stock report Word + Excel exported');
    } catch {
      toast.error('Export stock report gagal');
    }
  };

  return (
    <div className="space-y-8 pb-24 lg:pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Package size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Stock & Warehouse Ledger</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Real-time Inventory Monitoring & Valuation</p>
          </div>
        </div>

        <div className="flex gap-3">
           <button
             onClick={handleExport}
             className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
           >
              <Download size={16} /> Export Word + Excel
           </button>
           <button
             onClick={() => navigate('/inventory/opname')}
             className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2"
           >
              <FileText size={16} /> Stock Opname
           </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Layers size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Total SKU</p>
              <h4 className="text-2xl font-black text-slate-900 italic">{stats.totalItems} <span className="text-xs text-slate-400">Items</span></h4>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <AlertCircle size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Low Stock Alert</p>
              <h4 className="text-2xl font-black text-rose-600 italic">{stats.lowStock} <span className="text-xs text-rose-400">Units</span></h4>
           </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl flex items-center gap-5">
           <div className="w-12 h-12 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center">
              <ArrowUpRight size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Inventory Value</p>
              <h4 className="text-xl font-black italic text-white">IDR {stats.totalValue.toLocaleString('id-ID')}</h4>
           </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder="Cari Item atau SKU..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase italic outline-none focus:bg-white focus:border-indigo-500 transition-all" 
              />
           </div>
           <div className="flex gap-3">
              <button
                onClick={() => toast.info('Filter lanjutan segera ditambahkan')}
                className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
              >
                <Filter size={20} />
              </button>
              <button
                onClick={() => toast.info('Periode report: real-time')}
                className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
              >
                <Calendar size={20} />
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">SKU / Code</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Material Description</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Warehouse Location</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center">Stock Level</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Unit</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                      {item.kode}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 uppercase italic">{item.nama}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{item.kategori}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-300" />
                       <span className="text-[10px] font-black text-slate-600 uppercase italic">Rack {item.lokasi || 'A-1'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (item.stok || 0) <= (item.minStock || 5) ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(((item.stok || 0) / (item.minStock || 5) * 50), 100)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-black italic ${
                        (item.stok || 0) <= (item.minStock || 5) ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {item.stok}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase italic">{item.satuan}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => navigate(`/inventory/stock-card/${item.id}`)}
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
