import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; import { History, Search, Filter, ArrowUpRight, ArrowDownLeft, ArrowLeft, Download, Calendar, Package, User, ExternalLink, Table as TableIcon, LayoutGrid } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function StockJournalPage() {
  const navigate = useNavigate();
  const { stockMovementList, stockItemList, addAuditLog, currentUser } = useApp();
  const [serverStockMovementList, setServerStockMovementList] = useState<typeof stockMovementList | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<typeof stockItemList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const effectiveStockMovementList = serverStockMovementList ?? stockMovementList;
  const effectiveStockItemList = serverStockItemList ?? stockItemList;
  const isCanonicalSku = (value: unknown) => /^GTP-MTR-[A-Z0-9]{3}-\d{3}$/.test(String(value || '').trim().toUpperCase());

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows.map((row: any) => {
      const payload = row?.payload ?? {};
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.id) {
        return { ...payload, id: row.entityId } as T;
      }
      return payload as T;
    });

  const fetchStockJournal = async () => {
    try {
      setIsRefreshing(true);
      const [movementsRes, stockItemsRes] = await Promise.all([
        api.get('/inventory/movements'),
        api.get('/inventory/items'),
      ]);
      setServerStockMovementList(normalizeEntityRows<any>(Array.isArray(movementsRes.data) ? movementsRes.data : []));
      setServerStockItemList(normalizeEntityRows<any>(Array.isArray(stockItemsRes.data) ? stockItemsRes.data : []));
    } catch {
      setServerStockMovementList(null);
      setServerStockItemList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStockJournal();
  }, []);

  const normalizedMovements = useMemo(() => {
    const canonicalByCode = new Map<string, string>();
    const canonicalByName = new Map<string, string>();

    for (const item of effectiveStockItemList || []) {
      const code = String(item?.kode || '').trim().toUpperCase();
      const name = String(item?.nama || '').trim().toLowerCase();
      if (!code || !name) continue;

      if (!canonicalByCode.has(code) || isCanonicalSku(code)) {
        canonicalByCode.set(code, code);
      }
      const currentByName = canonicalByName.get(name);
      if (!currentByName || isCanonicalSku(code)) {
        canonicalByName.set(name, code);
      }
    }

    return effectiveStockMovementList.map((m) => {
      const rawCode = String(m.itemKode || '').trim().toUpperCase();
      const rawName = String(m.itemNama || '').trim().toLowerCase();
      const displayItemKode =
        (isCanonicalSku(rawCode) ? rawCode : canonicalByCode.get(rawCode)) ||
        canonicalByName.get(rawName) ||
        rawCode;
      return { ...m, displayItemKode };
    });
  }, [effectiveStockMovementList, effectiveStockItemList]);

  const filteredMovements = useMemo(() => {
    return normalizedMovements
      .filter(m => {
        const matchesSearch = 
          m.itemNama.toLowerCase().includes(searchTerm.toLowerCase()) || 
          String((m as any).displayItemKode || m.itemKode).toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.refNo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [normalizedMovements, searchTerm, typeFilter]);

  const handleExportCsv = async () => {
    const rows = [
      ['Tanggal', 'ItemKode', 'ItemNama', 'Type', 'RefType', 'RefNo', 'Customer', 'Project', 'Qty', 'Unit', 'Before', 'After', 'CreatedBy'],
      ...filteredMovements.map((m) => [
        m.tanggal,
        (m as any).displayItemKode || m.itemKode,
        m.itemNama,
        m.type,
        m.refType,
        m.refNo,
        m.customerName || '',
        m.projectName || '',
        String(m.qty),
        m.unit,
        String(m.stockBefore),
        String(m.stockAfter),
        m.createdBy || '',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `stock-journal-${dateKey}`,
      title: 'Stock Journal Report',
      subtitle: `Filter tipe ${typeFilter} | Total mutasi ${filteredMovements.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Jurnal mutasi stok berisi seluruh pergerakan barang masuk dan keluar untuk kebutuhan audit inventory.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Journal',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `stock-journal-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `stock-journal-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'STOCK_JOURNAL_EXPORTED',
        module: 'Inventory',
        entityType: 'StockMovement',
        entityId: 'all',
        description: `Stock journal exported (${filteredMovements.length} rows)`,
      });
      toast.success('Stock journal Word + Excel exported');
    } catch {
      toast.error('Export stock journal gagal');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 mb-6">
              <History size={14} /> Inventory Ledger
            </div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
              Jurnal <span className="text-indigo-500">Mutasi</span> Stok
            </h1>
            <p className="text-slate-400 font-medium max-w-xl text-lg mt-4">
              Log aktivitas keluar-masuk barang secara real-time untuk audit dan transparansi stok.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchStockJournal()}
              disabled={isRefreshing}
              className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              onClick={() => navigate('/inventory/center')}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
            >
              <ArrowLeft size={18} /> Kembali ke Gudang
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col xl:flex-row gap-6 justify-between items-center">
        <div className="relative w-full xl:max-w-xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari item, SKU, atau nomor referensi..." 
            className="w-full pl-16 pr-8 py-4 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 focus:bg-white transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            {(['ALL', 'IN', 'OUT'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  typeFilter === type ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {type === 'ALL' ? 'Semua' : type}
              </button>
            ))}
          </div>

          <button
            onClick={() => toast.info('Periode aktif: real-time')}
            className="px-6 py-3.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Calendar size={18} /> Rentang Waktu
          </button>

          <button
            onClick={handleExportCsv}
            className="px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <Download size={18} /> Export Word + Excel
          </button>
        </div>
      </div>

      {/* Journal Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-8">Timestamp</th>
                <th className="px-8 py-8">Item & SKU</th>
                <th className="px-8 py-8">Tipe</th>
                <th className="px-8 py-8">Referensi</th>
                <th className="px-8 py-8">Customer & Proyek</th>
                <th className="px-8 py-8 text-right">Qty</th>
                <th className="px-8 py-8 text-right">Running Stock</th>
                <th className="px-8 py-8">PIC</th>
                <th className="px-8 py-8 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMovements.map((move) => (
                <tr key={move.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Calendar size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{move.tanggal}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div>
                      <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight block group-hover:text-indigo-600 transition-colors">
                        {move.itemNama}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{(move as any).displayItemKode || move.itemKode}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      move.type === 'IN' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                      {move.type === 'IN' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                      {move.type === 'IN' ? 'Stok Masuk' : 'Stok Keluar'}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-black text-slate-700 italic">{move.refNo}</span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{move.refType}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-600 uppercase italic tracking-tighter">{move.customerName || "-"}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{move.projectName || "-"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className={`text-sm font-black ${move.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {move.type === 'IN' ? '+' : '-'}{move.qty.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">{move.unit}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-slate-900 italic">{move.stockAfter.toLocaleString()}</span>
                      <span className="text-[9px] text-slate-400 font-bold line-through">from {move.stockBefore.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                        <User size={12} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase">
                        {String(move.createdBy || '-').replace(/\s+/g, '_')}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toast.info(`${move.refNo} | ${move.itemNama} | ${move.qty} ${move.unit}`)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-indigo-600 transition-all"
                      >
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 bg-slate-50 rounded-full">
                        <History size={48} className="text-slate-200" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-400 uppercase italic tracking-tight">Data mutasi tidak ditemukan</p>
                        <p className="text-xs text-slate-300 font-bold uppercase mt-2">Coba sesuaikan filter atau kata kunci pencarian Anda</p>
                      </div>
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
