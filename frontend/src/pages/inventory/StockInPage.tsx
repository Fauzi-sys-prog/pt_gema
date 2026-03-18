import { useEffect, useMemo, useState } from 'react'; import { Plus, Search, Calendar, Package, TrendingUp, Check, X, Eye, ArrowUpRight, FileText, Tag, History, AlertTriangle } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { StockIn } from '../../contexts/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from "sonner@2.0.3";
import api from '../../services/api';

export default function StockInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    stockInList, 
    stockItemList, 
    createStockIn, 
    currentUser 
  } = useApp();
  const [serverStockInList, setServerStockInList] = useState<StockIn[] | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<typeof stockItemList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStockIn, setSelectedStockIn] = useState<StockIn | null>(null);
  const isManualMode = useMemo(() => new URLSearchParams(location.search).get('mode') === 'manual', [location.search]);
  const mergeById = <T extends { id?: string }>(primary: T[] | null, fallback: T[]) => {
    const map = new Map<string, T>();
    for (const item of fallback) {
      if (item?.id) map.set(item.id, item);
    }
    for (const item of primary ?? []) {
      if (item?.id) map.set(item.id, item);
    }
    return Array.from(map.values());
  };
  const effectiveStockInList = useMemo(() => mergeById<StockIn>(serverStockInList, stockInList), [serverStockInList, stockInList]);
  const effectiveStockItemList = useMemo(() => mergeById<any>(serverStockItemList, stockItemList), [serverStockItemList, stockItemList]);

  const normalizeEntityRows = <T,>(rows: any[]): T[] =>
    rows
      .map((row: any) => {
        if (!row) return null;
        if (row.payload && typeof row.payload === 'object') {
          const payload = row.payload;
          return { ...payload, id: payload.id || row.entityId } as T;
        }
        if (typeof row === 'object') return row as T;
        return null;
      })
      .filter(Boolean) as T[];

  const fetchStockInSources = async () => {
    try {
      setIsRefreshing(true);
      const [stockInRes, stockItemRes] = await Promise.all([
        api.get('/inventory/stock-ins'),
        api.get('/inventory/items'),
      ]);
      const normalizedStockIns = normalizeEntityRows<StockIn>(Array.isArray(stockInRes.data) ? stockInRes.data : []);
      const normalizedStockItems = normalizeEntityRows<any>(Array.isArray(stockItemRes.data) ? stockItemRes.data : []);
      setServerStockInList(normalizedStockIns);
      setServerStockItemList(normalizedStockItems);
    } catch {
      setServerStockInList(null);
      setServerStockItemList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStockInSources();
  }, []);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    type: 'Adjustment' as StockIn['type'],
    noSuratJalan: '',
    items: [{ kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', fotoKondisi: '', expiryDate: '' }],
    notes: '',
  });

  const actorRoleLabel = String(currentUser?.role || 'USER').trim().toUpperCase() || 'USER';

  const filteredStockIn = effectiveStockInList.filter(si => {
    const keyword = String(searchTerm || '').toLowerCase();
    const noStockIn = String(si.noStockIn || si.noPO || si.id || '');
    const sj = String(si.noSuratJalan || '');

    const matchSearch = noStockIn.toLowerCase().includes(keyword) ||
      sj.toLowerCase().includes(keyword) ||
      (si.items || []).some(item => String(item.nama || '').toLowerCase().includes(keyword));
      
    const matchType = filterType === 'all' || si.type === filterType;
    const matchStatus = filterStatus === 'all' || si.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = formData.items
      .map((item) => ({
        ...item,
        kode: String(item.kode || '').trim().toUpperCase(),
        nama: String(item.nama || '').trim(),
        unit: String(item.unit || '').trim(),
      }))
      .filter((item) => item.kode && item.nama && item.qty > 0);

    if (!validItems.length) {
      toast.error('Minimal 1 item valid (SKU, nama, qty) harus diisi.');
      return;
    }

    const noSuratJalan = String(formData.noSuratJalan || '').trim();
    const generatedRef = `MANUAL-${formData.tanggal.replaceAll('-', '')}-${String(Date.now()).slice(-6)}`;
    const stockIn: StockIn = {
      id: `SI-${Date.now()}`,
      noStockIn: `SI-${new Date().getFullYear()}-${String(effectiveStockInList.length + 1).padStart(3, '0')}`,
      noSuratJalan: noSuratJalan || generatedRef,
      tanggal: formData.tanggal,
      type: formData.type,
      status: 'Posted',
      createdBy: actorRoleLabel,
      items: validItems.map((item) => ({
        kode: item.kode,
        nama: item.nama,
        qty: Number(item.qty),
        satuan: item.unit || 'Unit',
        batchNo: item.batchNo || undefined,
        expiryDate: item.expiryDate || undefined,
      })),
      notes: formData.notes,
    };
    
    // Centralized execution (Updates both list and inventory)
    try {
      await createStockIn(stockIn);
      setServerStockInList((prev) => (prev ? [stockIn, ...prev] : prev));
      toast.success("Jurnal stok masuk berhasil diposting.");
      setShowModal(false);
      resetForm();
    } catch {
      // toast handled in AppContext
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      type: isManualMode ? 'Adjustment' : 'Adjustment',
      noSuratJalan: '',
      items: [{ kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', fotoKondisi: '', expiryDate: '' }],
      notes: '',
    });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', expiryDate: '' }],
    });
  };

  const removeItemRow = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'kode') {
      const stockItem = effectiveStockItemList.find(s => String(s.kode || '').toLowerCase() === String(value || '').toLowerCase());
      if (stockItem) {
        updatedItems[index].nama = stockItem.nama;
        updatedItems[index].unit = stockItem.satuan;
        updatedItems[index].harga = stockItem.hargaSatuan;
        updatedItems[index].kategori = stockItem.kategori;
      }
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
        
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 rotate-3">
            <ArrowUpRight size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight italic uppercase">Stok Masuk (Inbound)</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Receiving & material entry</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchStockInSources()}
            disabled={isRefreshing}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={() => navigate('/inventory/stock-journal')}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <History size={18} /> Mutasi
          </button>
          <button 
            onClick={() => setShowModal(true)}
          className="relative px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus size={20} /> Entry Stok Masuk
        </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari No Jurnal atau No Surat Jalan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 outline-none"
          >
            <option value="all">Semua Tipe</option>
            <option value="Receiving">Penerimaan (PO / Manual)</option>
            <option value="Return">Retur Proyek</option>
            <option value="Adjustment">Penyesuaian</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No Jurnal</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No Surat Jalan</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipe</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Item</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStockIn.map((si) => (
                <tr key={si.id} className="hover:bg-slate-50/80 transition-all">
                  <td className="px-8 py-5 font-black text-slate-900 italic tracking-tight">{si.noStockIn}</td>
                  <td className="px-8 py-5 font-bold text-slate-500 uppercase text-xs">{si.noSuratJalan || '-'}</td>
                  <td className="px-8 py-5 text-slate-500 font-bold text-sm">
                    {new Date(si.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-100">
                      {si.type}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-slate-900 font-black text-sm italic">
                    {si.items?.length || 0} SKU
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button
                      onClick={() => { setSelectedStockIn(si); setShowDetailModal(true); }}
                      className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all mx-auto"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-center z-10">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Entry Stok Masuk Baru</h3>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {isManualMode && (
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                  Mode Manual Inbound aktif: Anda bisa input stok masuk tanpa PO.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">No. Surat Jalan / Dokumen</label>
                  <input
                    type="text"
                    value={formData.noSuratJalan}
                    onChange={(e) => setFormData({ ...formData, noSuratJalan: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold outline-none"
                    placeholder="Kosongkan untuk auto-generate ref manual"
                  />
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tanggal Penerimaan</label>
                  <input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold outline-none"
                    required
                  />
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipe Transaksi</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as StockIn['type'] })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold outline-none"
                    required
                  >
                    <option value="Receiving">Penerimaan (PO / Manual)</option>
                    <option value="Return">Retur Proyek</option>
                    <option value="Adjustment">Penyesuaian (Opname)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4 px-2">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Daftar Barang</h4>
                  <button type="button" onClick={addItemRow} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Plus size={14} /> Tambah Baris
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <div className="col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">SKU</label>
                        <input
                          list="stock-items-list"
                          type="text"
                          value={item.kode || ''}
                          onChange={(e) => updateItem(index, 'kode', e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold outline-none"
                          placeholder="Kode"
                          required
                        />
                        <datalist id="stock-items-list">
                          {effectiveStockItemList.map(s => <option key={s.id} value={s.kode}>{s.nama}</option>)}
                        </datalist>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Deskripsi Barang</label>
                        <input type="text" value={item.nama || ''} onChange={(e) => updateItem(index, 'nama', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold outline-none" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1"><Tag size={10}/> No. Batch/Lot</label>
                        <input type="text" value={item.batchNo || ''} onChange={(e) => updateItem(index, 'batchNo', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold outline-none" placeholder="Lot #" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1">
                          <Calendar size={10}/> Expiry Date
                        </label>
                        <input 
                          type="date" 
                          value={item.expiryDate || ''} 
                          onChange={(e) => updateItem(index, 'expiryDate', e.target.value)} 
                          className={`w-full px-4 py-2.5 border-transparent rounded-xl text-xs font-bold outline-none ${String(item.kategori || '').toLowerCase().includes('castable') || item.kategori === 'Monolithics' ? 'bg-amber-50' : 'bg-white'}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Qty</label>
                        <input type="number" value={item.qty || ''} onChange={(e) => updateItem(index, 'qty', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-black outline-none" required />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Satuan</label>
                        <input type="text" value={item.unit || ''} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold outline-none" required />
                      </div>
                      <div className="col-span-1">
                        <button type="button" onClick={() => removeItemRow(index)} className="w-full h-10 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all active:scale-90 disabled:opacity-30" disabled={formData.items.length === 1}>
                          <X size={16} />
                        </button>
                      </div>
                      {item.kondisi !== 'Baik' && (
                        <div className="col-span-12 mt-2 pt-2 border-t border-slate-100 flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-[9px] font-black text-rose-500 uppercase mb-1.5 ml-1 flex items-center gap-1">
                              <AlertTriangle size={10} /> Link/Upload Foto Kerusakan
                            </label>
                            <input 
                              type="text" 
                              value={item.fotoKondisi || ''} 
                              onChange={(e) => updateItem(index, 'fotoKondisi', e.target.value)} 
                              className="w-full px-4 py-2 bg-rose-50 border-none rounded-lg text-[10px] font-bold text-rose-600 placeholder:text-rose-300 outline-none" 
                              placeholder="Masukkan URL foto atau path dokumen..." 
                            />
                          </div>
                          {item.fotoKondisi && (
                            <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                              <img src={item.fotoKondisi} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Keterangan / Memo</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-4 bg-white border-transparent rounded-2xl text-sm font-bold outline-none h-24 resize-none"
                  placeholder="Tambahkan catatan jika diperlukan..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100">Posting ke Buku Besar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedStockIn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Detail Jurnal</h3>
                <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-1">{selectedStockIn.noStockIn}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tgl Terima</p>
                  <p className="font-black text-slate-900 italic">{new Date(selectedStockIn.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">No Surat Jalan</p>
                  <p className="font-black text-slate-900 italic uppercase">{selectedStockIn.noSuratJalan || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Petugas</p>
                  <p className="font-black text-slate-900 italic uppercase">{selectedStockIn.createdBy}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                  <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">POSTED</span>
                </div>
              </div>
              
              <div className="border border-slate-100 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase">SKU / Nama</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-center">Batch/Lot</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedStockIn.items?.map((item, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {item.fotoKondisi && (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                                <img src={item.fotoKondisi} alt="Kerusakan" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-black text-slate-900 italic uppercase">{item.nama}</p>
                              <p className="text-[9px] text-slate-400 font-bold">{item.kode} {item.kondisi !== 'Baik' && <span className="text-rose-500">• {item.kondisi}</span>}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-[10px] font-black text-slate-400">{item.batchNo || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-emerald-600 italic">+{item.qty}</span>
                          <span className="ml-1 text-[9px] font-black text-slate-300 uppercase">{item.satuan}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
