import { useEffect, useMemo, useState } from 'react'; import { useApp } from '../../contexts/AppContext';
import type { StockItem, StockMovement } from '../../contexts/AppContext';
import api from '../../services/api';
import { 
  Hourglass, 
  AlertTriangle, 
  Calendar, 
  TrendingDown, 
  ArrowRight, 
  Filter, 
  Search, 
  Box,
  ChevronRight,
  ShieldAlert,
  Clock,
  PackageSearch
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';

export default function StockAgingPage() {
  const { stockItemList, stockMovementList, addAuditLog, currentUser } = useApp();
  const [serverStockItemList, setServerStockItemList] = useState<StockItem[] | null>(null);
  const [serverStockMovementList, setServerStockMovementList] = useState<StockMovement[] | null>(null);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Critical' | 'Dead Stock'>('All');

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) return payload as T[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: T[] }).items;
      }
      return [];
    };
    const normalizeEntityRows = <T,>(payload: unknown): T[] => {
      const rows = normalizeList<any>(payload);
      return rows.map((row: any) => {
        const record = row?.payload ?? row;
        if (record && typeof record === 'object' && !Array.isArray(record) && !record.id && row?.entityId) {
          return { ...record, id: row.entityId } as T;
        }
        return record as T;
      });
    };

    const loadPageData = async () => {
      try {
        const [itemsRes, movementsRes] = await Promise.all([
          api.get('/inventory/items'),
          api.get('/inventory/movements'),
        ]);
        if (!mounted) return;
        setServerStockItemList(normalizeEntityRows<StockItem>(itemsRes.data));
        setServerStockMovementList(normalizeEntityRows<StockMovement>(movementsRes.data));
      } catch {
        if (!mounted) return;
        setServerStockItemList(null);
        setServerStockMovementList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveStockItemList = (serverStockItemList ?? stockItemList ?? []).filter(Boolean);
  const effectiveStockMovementList = (serverStockMovementList ?? stockMovementList ?? []).filter(Boolean);
  const isCanonicalSku = (value: unknown) => /^GTP-MTR-[A-Z0-9]{3}-\d{3}$/.test(String(value || '').trim().toUpperCase());

  const today = new Date();
  const parseDateToMs = (value: unknown): number => {
    const ms = new Date(String(value || '')).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  const agingData = useMemo(() => {
    const canonicalSkuByName = new Map<string, string>();
    for (const row of effectiveStockItemList) {
      const nameKey = String(row.nama || '').trim().toLowerCase();
      const code = String(row.kode || '').trim().toUpperCase();
      if (!nameKey || !code) continue;
      if (!canonicalSkuByName.has(nameKey) || isCanonicalSku(code)) {
        canonicalSkuByName.set(nameKey, code);
      }
    }

    return effectiveStockItemList.map(item => {
      const lastMov = effectiveStockMovementList
        .filter(m => m.itemKode === item.kode)
        .sort((a, b) => parseDateToMs(b.tanggal) - parseDateToMs(a.tanggal))[0];

      const lastUpdateMs = lastMov ? parseDateToMs(lastMov.tanggal) : parseDateToMs(item.lastUpdate);
      const baseDateMs = lastUpdateMs || parseDateToMs('2025-01-01');
      const diffTime = Math.abs(today.getTime() - baseDateMs);
      const ageDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // FEFO Logic
      let daysToExpiry = null;
      if (item.expiryDate) {
        const expDate = new Date(item.expiryDate);
        const expDiff = expDate.getTime() - today.getTime();
        daysToExpiry = Math.ceil(expDiff / (1000 * 60 * 60 * 24));
      }

      return {
        ...item,
        displayKode: canonicalSkuByName.get(String(item.nama || '').trim().toLowerCase()) || String(item.kode || '').trim().toUpperCase(),
        ageDays,
        daysToExpiry,
        status: ageDays > 90 ? 'Dead Stock' : ageDays > 30 ? 'Slow Moving' : 'Fast Moving',
        isExpiringSoon: daysToExpiry !== null && daysToExpiry < 30
      };
    });
  }, [effectiveStockItemList, effectiveStockMovementList]);

  const filteredAging = useMemo(() => {
    return agingData.filter(item => {
      const keyword = String(searchTerm || '').toLowerCase();
      const matchesSearch =
        String(item.nama || '').toLowerCase().includes(keyword) ||
        String((item as any).displayKode || item.kode || '').toLowerCase().includes(keyword);
      
      if (filterType === 'Critical') return matchesSearch && (item.isExpiringSoon || item.stok <= item.minStock);
      if (filterType === 'Dead Stock') return matchesSearch && item.ageDays > 90;
      return matchesSearch;
    });
  }, [agingData, searchTerm, filterType]);

  const stats = useMemo(() => {
    return {
      totalItems: agingData.length,
      expiringSoon: agingData.filter(i => i.isExpiringSoon).length,
      deadStock: agingData.filter(i => i.ageDays > 90).length,
      avgAge: Math.round(agingData.reduce((acc, curr) => acc + curr.ageDays, 0) / agingData.length) || 0
    };
  }, [agingData]);

  const handleExportAging = async () => {
    const rows = [
      ['Kode', 'Nama', 'Kategori', 'AgeDays', 'ExpiryDate', 'DaysToExpiry', 'Stock', 'MinStock', 'Status', 'Recommendation'],
      ...filteredAging.map((item) => [
        (item as any).displayKode || item.kode,
        item.nama,
        item.kategori,
        String(item.ageDays),
        item.expiryDate || '',
        String(item.daysToExpiry ?? ''),
        String(item.stok),
        String(item.minStock),
        item.status,
        item.isExpiringSoon || (item.daysToExpiry !== null && item.daysToExpiry < 0)
          ? 'Prioritaskan Penggunaan'
          : item.ageDays > 90
          ? 'Likuidasi / Diskon'
          : 'Stok Sehat',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `stock-aging-report-${dateKey}`,
      title: 'Stock Aging Report',
      subtitle: `Filter ${filterType} | Total item ${filteredAging.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Laporan aging stok dengan item akan expired ${stats.expiringSoon}, dead stock ${stats.deadStock}, dan rata-rata usia stok ${stats.avgAge} hari.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Aging',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `stock-aging-report-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `stock-aging-report-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'STOCK_AGING_EXPORTED',
        module: 'Inventory',
        entityType: 'StockAging',
        entityId: 'all',
        description: `Stock aging exported (${filteredAging.length} rows)`,
      });
      toast.success('Stock aging Word + Excel exported');
    } catch {
      toast.error('Export stock aging gagal');
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <span className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-rose-200">Inventory Health</span>
             <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Asset Protection</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-4">
            <Hourglass className="text-rose-600" size={36} />
            Stock Aging & FEFO Alert
          </h1>
          <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide mt-1">Sistem Deteksi Material Kedaluwarsa & Barang Mengendap</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/inventory')}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            Kembali ke Ledger
          </button>
          <button 
            onClick={handleExportAging}
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
          >
            Export Word + Excel
          </button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-rose-500">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Akan Expired (30 Hari)</p>
            <ShieldAlert className="text-rose-200" size={24} />
          </div>
          <h3 className="text-3xl font-black italic text-slate-900">{stats.expiringSoon} <span className="text-sm text-slate-400 font-bold not-italic">SKUs</span></h3>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Dead Stock (90+ Hari)</p>
            <Clock className="text-amber-200" size={24} />
          </div>
          <h3 className="text-3xl font-black italic text-slate-900">{stats.deadStock} <span className="text-sm text-slate-400 font-bold not-italic">Items</span></h3>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Rata-rata Usia Stok</p>
            <TrendingDown className="text-indigo-200" size={24} />
          </div>
          <h3 className="text-3xl font-black italic text-slate-900">{stats.avgAge} <span className="text-sm text-slate-400 font-bold not-italic">Days</span></h3>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-slate-800">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Akurasi Audit</p>
            <PackageSearch className="text-slate-200" size={24} />
          </div>
          <h3 className="text-3xl font-black italic text-slate-900">98.2<span className="text-sm text-slate-400 font-bold not-italic">%</span></h3>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Material atau Kode SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(['All', 'Critical', 'Dead Stock'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === type 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material & SKU</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usia Barang</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status FEFO</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Level</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rekomendasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAging.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{item.nama}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{(item as any).displayKode || item.kode} • {item.kategori}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${item.ageDays > 90 ? 'bg-rose-500' : item.ageDays > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(100, item.ageDays)}%` }}
                          />
                       </div>
                       <span className="text-sm font-black text-slate-700 italic">{item.ageDays} Hari</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Sejak Pergerakan Terakhir</p>
                  </td>
                  <td className="px-10 py-8">
                    {item.expiryDate ? (
                      <div className="flex flex-col">
                         <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg inline-block w-fit ${
                           item.isExpiringSoon ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                         }`}>
                           Exp: {item.expiryDate}
                         </span>
                         <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase italic">
                           {item.daysToExpiry !== null && item.daysToExpiry < 0 
                             ? 'Sudah Kedaluwarsa!' 
                             : `${item.daysToExpiry} Hari Tersisa`}
                         </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-black uppercase italic tracking-widest">N/A (Non-Chemical)</span>
                    )}
                  </td>
                  <td className="px-10 py-8">
                     <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 italic">{item.stok} {item.satuan}</span>
                        <span className={`text-[9px] font-bold uppercase ${item.stok <= item.minStock ? 'text-rose-500' : 'text-slate-400'}`}>
                          Min: {item.minStock} {item.satuan}
                        </span>
                     </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                      {item.isExpiringSoon || (item.daysToExpiry !== null && item.daysToExpiry < 0) ? (
                        <span className="px-4 py-2 bg-rose-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-rose-100 flex items-center gap-2">
                          <AlertTriangle size={12} /> Prioritaskan Penggunaan
                        </span>
                      ) : item.ageDays > 90 ? (
                        <span className="px-4 py-2 bg-amber-500 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-amber-100 flex items-center gap-2">
                          <TrendingDown size={12} /> Likuidasi / Diskon
                        </span>
                      ) : (
                        <span className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-xl uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                           Stok Sehat
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAging.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Box size={64} className="mb-4" />
                      <p className="text-xl font-black italic uppercase tracking-tighter">Tidak ada data ditemukan</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
