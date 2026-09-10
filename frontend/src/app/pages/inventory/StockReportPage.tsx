import React, { useMemo, useState } from 'react';
import {
  Package,
  Search,
  Filter,
  ArrowUpRight,
  AlertCircle,
  Calendar,
  Layers,
  FileText,
  Download,
  ChevronRight,
  Plus,
  X
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { exportStockXlsx } from '../../utils/operationalExcelExports';

const KATEGORI_OPTIONS = [
  'Piping', 'Fitting & Valve', 'Castable', 'Monolithics', 'Refractory',
  'PPE', 'Tools', 'Electrical', 'Civil', 'Mechanical', 'Chemical', 'General'
];

interface NewSkuForm {
  kode: string;
  nama: string;
  kategori: string;
  kategoriCustom: string;
  satuan: string;
  minStock: number;
  hargaSatuan: number;
  lokasi: string;
}

const emptyForm: NewSkuForm = {
  kode: '', nama: '', kategori: '', kategoriCustom: '', satuan: '', minStock: 5, hargaSatuan: 0, lokasi: 'Gudang Utama'
};

export default function StockReportPage() {
  const { stockItemList = [], addStockItem, extraCategories, addExtraCategory } = useApp();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewSkuForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allCategories = useMemo(() =>
    [...new Set([...KATEGORI_OPTIONS, ...stockItemList.map(s => s.kategori).filter(Boolean), ...extraCategories])].sort()
  , [stockItemList, extraCategories]);

  const handleAddSku = () => {
    if (isSubmitting) return;
    const finalKategori = form.kategori === 'Lainnya' ? form.kategoriCustom.trim() : form.kategori;
    if (!form.nama.trim() || !finalKategori || !form.satuan.trim()) {
      toast.error('Nama barang, kategori, dan satuan wajib diisi');
      return;
    }
    const catCode = finalKategori.substring(0, 3).toUpperCase();
    const nameCode = form.nama.substring(0, 3).toUpperCase();
    const autoKode = form.kode.trim() || `GTP-${catCode}-${nameCode}-${Math.floor(100 + Math.random() * 900)}`;
    const exists = stockItemList.find(s => s.kode.toLowerCase() === autoKode.toLowerCase());
    if (exists) { toast.error('Kode SKU sudah ada'); return; }
    setIsSubmitting(true);
    try {
      addStockItem({
        id: `STK-${Date.now()}`,
        kode: autoKode,
        nama: form.nama.trim(),
        kategori: finalKategori,
        satuan: form.satuan.trim(),
        stok: 0,
        stokAwal: 0,
        reserved: 0,
        minStock: form.minStock,
        hargaSatuan: form.hargaSatuan,
        lokasi: form.lokasi.trim() || 'Gudang Utama',
        lastUpdate: new Date().toISOString().split('T')[0],
      });
      if (form.kategori === 'Lainnya' && finalKategori) addExtraCategory(finalKategori);
      toast.success(`SKU ${autoKode} berhasil ditambahkan ke master stok`);
      setForm(emptyForm);
      setShowAddModal(false);
    } catch (err) {
      toast.error('Gagal menambahkan SKU: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const totalItems = stockItemList.length;
    const lowStock = stockItemList.filter(i => (i.stok || 0) <= (i.minStock || 5)).length;
    const totalValue = stockItemList.reduce((acc, i) => acc + ((i.stok || 0) * (i.hargaSatuan || 0)), 0);
    
    return { totalItems, lowStock, totalValue };
  }, [stockItemList]);

  const filteredItems = useMemo(() => {
    return stockItemList.filter(item => 
      (item.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.kode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stockItemList, searchTerm]);

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
           <button onClick={() => exportStockXlsx(filteredItems, searchTerm || 'Semua Kategori')} className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
              <Download size={16} /> Export Data
           </button>
           <button onClick={() => navigate('/inventory/opname')} className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
              <FileText size={16} /> Stock Opname
           </button>
           <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
              <Plus size={16} /> Tambah SKU
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
              <button className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                <Filter size={20} />
              </button>
              <button className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
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
                    <button className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah SKU */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Tambah SKU Baru</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Daftarkan ke Master Stok</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setForm(emptyForm); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nama Barang <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.nama}
                    onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                    placeholder="Contoh: Pipa Galvanis 2 Inch"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kategori <span className="text-rose-500">*</span></label>
                  <select
                    value={form.kategori}
                    onChange={e => setForm(f => ({ ...f, kategori: e.target.value, kategoriCustom: '' }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  >
                    <option value="">Pilih Kategori</option>
                    {allCategories.map(k => <option key={k} value={k}>{k}</option>)}
                    <option value="Lainnya">+ Lainnya (ketik manual)</option>
                  </select>
                  {form.kategori === 'Lainnya' && (
                    <input
                      type="text"
                      value={form.kategoriCustom}
                      onChange={e => setForm(f => ({ ...f, kategoriCustom: e.target.value }))}
                      placeholder="Ketik nama kategori baru..."
                      className="mt-2 w-full px-4 py-2.5 bg-white border-2 border-indigo-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all"
                      autoFocus
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Satuan <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.satuan}
                    onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}
                    placeholder="Pcs / Kg / Meter / Set"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kode SKU <span className="text-slate-300">(opsional)</span></label>
                  <input
                    type="text"
                    value={form.kode}
                    onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
                    placeholder="Auto-generate jika kosong"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.hargaSatuan}
                    onChange={e => setForm(f => ({ ...f, hargaSatuan: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Min. Stok Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Lokasi Gudang</label>
                  <input
                    type="text"
                    value={form.lokasi}
                    onChange={e => setForm(f => ({ ...f, lokasi: e.target.value }))}
                    placeholder="Gudang Utama / Gudang A / dll"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => { setShowAddModal(false); setForm(emptyForm); }} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                Batal
              </button>
              <button onClick={handleAddSku} disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Menyimpan...' : 'Simpan SKU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
