import { useEffect, useState, useMemo } from 'react'; import { useApp } from '../../contexts/AppContext';
import type { StockOpname } from '../../contexts/AppContext';
import { 
  ClipboardList, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRightLeft,
  X,
  FileText,
  Save,
  Trash2,
  Box,
  MapPin,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../services/api';
import { normalizeEntityRows } from '../../utils/normalizeEntityRows';

export default function StockOpnamePage() {
  const { stockItemList, stockOpnameList, addStockOpname, confirmStockOpname, currentUser } = useApp();
  const [serverStockItemList, setServerStockItemList] = useState<typeof stockItemList | null>(null);
  const [serverStockOpnameList, setServerStockOpnameList] = useState<typeof stockOpnameList | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<StockOpname | null>(null);
  const effectiveStockItemList = serverStockItemList ?? stockItemList;
  const effectiveStockOpnameList = serverStockOpnameList ?? stockOpnameList;

  const fetchStockOpnameSources = async () => {
    try {
      setIsRefreshing(true);
      const [stockItemRes, opnameRes] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/stock-opnames'),
      ]);
      setServerStockItemList(normalizeEntityRows<any>(stockItemRes.data));
      setServerStockOpnameList(normalizeEntityRows<any>(opnameRes.data));
    } catch {
      setServerStockItemList(null);
      setServerStockOpnameList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStockOpnameSources();
  }, []);

  // Form State
  const [newOpname, setNewOpname] = useState({
    noOpname: `SO-${Date.now().toString().slice(-6)}`,
    lokasi: 'Gudang Utama',
    notes: '',
    items: [] as any[]
  });

  const resetNewOpnameForm = () => {
    setNewOpname({
      noOpname: `SO-${Date.now().toString().slice(-6)}`,
      lokasi: 'Gudang Utama',
      notes: '',
      items: [],
    });
  };

  const filteredOpnames = useMemo(() => {
    return effectiveStockOpnameList.filter(o => 
      o.noOpname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.lokasi.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [effectiveStockOpnameList, searchTerm]);

  const handleStartOpname = () => {
    // Populate items based on location
    const itemsAtLocation = effectiveStockItemList
      .filter(i => i.lokasi === newOpname.lokasi)
      .map(i => ({
        itemId: i.id,
        itemKode: i.kode,
        itemNama: i.nama,
        systemQty: i.stok,
        physicalQty: i.stok, // Default to system qty
        difference: 0,
        notes: ''
      }));

    if (itemsAtLocation.length === 0) {
      toast.error(`Tidak ada item di lokasi ${newOpname.lokasi}`);
      return;
    }

    setNewOpname(prev => ({ ...prev, items: itemsAtLocation }));
    setShowForm(true);
  };

  const handleQtyChange = (idx: number, val: number) => {
    setNewOpname(prev => {
      const items = [...prev.items];
      items[idx].physicalQty = val;
      items[idx].difference = val - items[idx].systemQty;
      return { ...prev, items };
    });
  };

  const handleSubmit = async () => {
    const opname: StockOpname = {
      id: `SO-${Date.now()}`,
      tanggal: new Date().toISOString().split('T')[0],
      noOpname: newOpname.noOpname,
      lokasi: newOpname.lokasi,
      items: newOpname.items,
      status: 'Draft',
      createdBy: currentUser?.fullName || currentUser?.name || currentUser?.username || 'SYSTEM',
      notes: newOpname.notes
    };

    try {
      await addStockOpname(opname);
      await fetchStockOpnameSources();
      toast.success('Draft Stock Opname berhasil disimpan');
      setShowForm(false);
      resetNewOpnameForm();
    } catch {
      // Error toast handled in AppContext
    }
  };

  const handleConfirm = async (id: string) => {
    if (window.confirm('Konfirmasi Stock Opname? Perubahan stok akan langsung diterapkan ke gudang.')) {
      try {
        await confirmStockOpname(id);
        await fetchStockOpnameSources();
        toast.success('Stock Opname berhasil dikonfirmasi dan stok diperbarui');
      } catch {
        // Error toast handled in AppContext
      }
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val);
  };

  return (
    <div className="p-6 space-y-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-200">Inventory Integrity</span>
              <span className="text-slate-400 font-bold text-xs uppercase italic">PT GTP Warehouse Control</span>
           </div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <ClipboardList className="text-indigo-600" size={32} />
              Stock Opname Center
           </h1>
           <p className="text-slate-500 font-bold text-sm uppercase italic tracking-wide">Audit & Penyesuaian Saldo Stok Fisik</p>
        </div>
        <button
          onClick={() => void fetchStockOpnameSources()}
          disabled={isRefreshing}
          className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-black transition-all"
          >
            <Plus size={18} /> Inisiasi Stock Opname
          </button>
        )}
      </div>

      {!showForm ? (
        <>
          {/* Dashboard Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Audit</p>
              <h3 className="text-3xl font-black italic text-slate-900">{effectiveStockOpnameList.length} <span className="text-sm text-slate-400 font-bold not-italic">Records</span></h3>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Draft Pending</p>
              <h3 className="text-3xl font-black italic text-slate-900">{effectiveStockOpnameList.filter(o => o.status === 'Draft').length} <span className="text-sm text-slate-400 font-bold not-italic">Items</span></h3>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Audit Selesai</p>
              <h3 className="text-3xl font-black italic text-slate-900">{effectiveStockOpnameList.filter(o => o.status === 'Confirmed').length} <span className="text-sm text-slate-400 font-bold not-italic">Confirmed</span></h3>
            </div>
          </div>

          {/* History List */}
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6">
              <div className="relative flex-1 min-w-[300px]">
                <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari No. Opname atau Lokasi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[2rem] text-sm font-bold border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Opname Details</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi & Auditor</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Count</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOpnames.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{o.noOpname}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">{o.tanggal}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                            <MapPin size={10} /> {o.lokasi}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">By: {o.createdBy}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                         <span className="text-sm font-black text-slate-700 italic">{o.items.length} SKUs Audited</span>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
                          o.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex justify-end gap-2">
                           {o.status === 'Draft' && (
                             <button 
                               onClick={() => { void handleConfirm(o.id); }}
                               className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                             >
                               Confirm
                             </button>
                           )}
                           <button 
                            onClick={() => setSelectedOpname(o)}
                            className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                           >
                             <FileText size={18} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* New Opname Form */
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden"
        >
          <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3">
                <Box size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Penyesuaian Stok Fisik</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Stock Audit Session • {newOpname.noOpname}</p>
              </div>
            </div>
            <button onClick={() => setShowForm(false)} className="p-4 bg-white border border-slate-100 text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm">
              <X size={24} />
            </button>
          </div>

          <div className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Gudang Audit</label>
                  <div className="flex gap-4">
                    <select 
                      value={newOpname.lokasi}
                      onChange={(e) => setNewOpname(prev => ({ ...prev, lokasi: e.target.value }))}
                      className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl text-sm font-black text-slate-900 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option>Gudang Utama</option>
                      <option>Workshop GTP</option>
                      <option>Area Quarantine</option>
                    </select>
                    <button 
                      onClick={handleStartOpname}
                      className="px-8 py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      Load Items
                    </button>
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Audit</label>
                  <input 
                    type="text"
                    placeholder="Contoh: Opname Akhir Bulan Januari 2026"
                    value={newOpname.notes}
                    onChange={(e) => setNewOpname(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-6 py-5 bg-slate-50 rounded-2xl text-sm font-black text-slate-900 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>

            {newOpname.items.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inventory Audit Table</h4>
                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg uppercase">{newOpname.items.length} Items Listed</span>
                </div>
                
                <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU & Material</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">System Qty</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Physical Qty</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Selisih</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {newOpname.items.map((item, idx) => (
                        <tr key={item.itemKode} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 mb-1">{item.itemKode}</span>
                              <span className="text-xs font-black text-slate-900 uppercase italic leading-tight">{item.itemNama}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center text-sm font-black text-slate-500">{formatIDR(item.systemQty)}</td>
                          <td className="px-8 py-6 text-center">
                            <input 
                              type="number"
                              value={item.physicalQty}
                              onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                              className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-black text-slate-900 focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className={`text-sm font-black italic ${item.difference === 0 ? 'text-slate-300' : item.difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.difference > 0 ? '+' : ''}{formatIDR(item.difference)}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <input 
                              type="text"
                              placeholder="Alasan selisih..."
                              value={item.notes}
                              onChange={(e) => {
                                const items = [...newOpname.items];
                                items[idx].notes = e.target.value;
                                setNewOpname(prev => ({ ...prev, items }));
                              }}
                              className="w-full bg-transparent border-b border-slate-100 focus:border-indigo-500 text-[11px] font-bold outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-10 border-t border-slate-100 flex justify-end gap-4">
               <button 
                onClick={() => setShowForm(false)}
                className="px-10 py-5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
               >
                 Batalkan
               </button>
               <button 
                onClick={handleSubmit}
                disabled={newOpname.items.length === 0}
                className="px-12 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-black disabled:opacity-50 transition-all flex items-center gap-3"
               >
                 <Save size={18} /> Simpan Draft Opname
               </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedOpname && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
             >
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Detail Audit Stok</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedOpname.noOpname} • {selectedOpname.lokasi}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedOpname(null)} className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-100">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 overflow-y-auto space-y-8">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal Audit</p>
                      <p className="text-sm font-black text-slate-900">{selectedOpname.tanggal}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase border mt-1 ${
                        selectedOpname.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {selectedOpname.status}
                      </span>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditor</p>
                      <p className="text-sm font-black text-slate-900">{selectedOpname.createdBy}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasil Audit per Item</h4>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Material</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">System</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Physical</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Selisih</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOpname.items.map((item) => (
                            <tr key={item.itemKode}>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black text-slate-900 uppercase italic">{item.itemNama}</span>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">{item.itemKode}</p>
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">{formatIDR(item.systemQty)}</td>
                              <td className="px-6 py-4 text-center text-xs font-black text-slate-900">{formatIDR(item.physicalQty)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`text-[10px] font-black italic ${item.difference === 0 ? 'text-slate-300' : item.difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {item.difference > 0 ? '+' : ''}{formatIDR(item.difference)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedOpname.status === 'Draft' && (
                    <div className="pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          void handleConfirm(selectedOpname.id);
                          setSelectedOpname(null);
                        }}
                        className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-200"
                      >
                        <CheckCircle2 size={20} /> Konfirmasi & Perbarui Stok
                      </button>
                    </div>
                  )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
