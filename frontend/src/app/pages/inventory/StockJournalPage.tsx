import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { 
  History, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeft,
  Download,
  Calendar,
  Package,
  User,
  ExternalLink,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export default function StockJournalPage() {
  const navigate = useNavigate();
  const { stockMovementList } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const filteredMovements = useMemo(() => {
    return stockMovementList
      .filter(m => {
        const matchesSearch = 
          m.itemNama.toLowerCase().includes(searchTerm.toLowerCase()) || 
          m.itemKode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.refNo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [stockMovementList, searchTerm, typeFilter]);

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
          <button 
            onClick={() => navigate('/inventory/center')}
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
          >
            <ArrowLeft size={18} /> Kembali ke Gudang
          </button>
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

          <button className="px-6 py-3.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all">
            <Calendar size={18} /> Rentang Waktu
          </button>

          <button className="px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
            <Download size={18} /> Export CSV
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{move.itemKode}</span>
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
                      <span className="text-[10px] font-bold text-slate-600 uppercase">{move.createdBy}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-indigo-600 transition-all">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-32 text-center">
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
