import { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Package, 
  TrendingUp, 
  Check, 
  X, 
  Eye,
  ArrowUpRight,
  FileText,
  Tag,
  History,
  AlertTriangle,
  Warehouse,
  Camera,
} from 'lucide-react';
import { useApp, type StockIn, type Receiving } from '../../contexts/AppContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function StockInPage() {
  const navigate = useNavigate();
  const {
    stockInList,
    stockItemList,
    createStockIn,
    updateStockIn,
    currentUser,
    receivingList,
    extraCategories,
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStockIn, setSelectedStockIn] = useState<StockIn | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    type: 'Adjustment' as StockIn['type'],
    noSuratJalan: '',
    items: [{ kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', fotoKondisi: '', expiryDate: '' }],
    notes: '',
  });

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
  ]);


  const filteredStockIn = stockInList.filter(si => {
    const noStockIn = si.noStockIn || si.noPO || si.id || '';
    const sj = si.noSuratJalan || '';
    
    const matchSearch = noStockIn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sj.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (si.items || []).some(item => item.nama?.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchType = filterType === 'all' || si.type === filterType;
    const matchStatus = filterStatus === 'all' || si.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const stockIn: StockIn = {
        id: `SI-${Date.now()}`,
        noStockIn: `SI-${new Date().getFullYear()}-${String(stockInList.length + 1).padStart(3, '0')}`,
        noSuratJalan: formData.noSuratJalan,
        tanggal: formData.tanggal,
        type: formData.type,
        status: 'Posted',
        createdBy: currentUser?.fullName || 'User',
        items: formData.items.filter(item => item.nama && item.qty > 0).map(item => ({
          ...item,
          expiryDate: item.expiryDate || undefined
        })),
        notes: formData.notes,
      };

      // Centralized execution (Updates both list and inventory)
      createStockIn(stockIn);

      toast.success("Jurnal stok masuk berhasil diposting.");
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error('Gagal posting stok masuk: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      type: 'Adjustment',
      noSuratJalan: '',
      items: [{ kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', fotoKondisi: '', expiryDate: '' }],
      notes: '',
    });
  };

  const importFromReceiving = (rcv: Receiving) => {
    const alreadyImported = stockInList.some(
      si => si.noSuratJalan === (rcv.noSuratJalan || rcv.noPO) && si.type === 'Receiving'
    );
    if (alreadyImported) {
      toast.warning(`Receiving ${rcv.noReceiving} sudah pernah di-import ke Stok Masuk.`);
      return;
    }
    setFormData({
      tanggal: rcv.tanggal,
      type: 'Receiving',
      noSuratJalan: rcv.noSuratJalan || rcv.noPO || '',
      notes: `Import dari Receiving ${rcv.noReceiving} — PO ${rcv.noPO}`,
      items: rcv.items.map(i => ({
        kode: i.itemKode || '',
        nama: i.itemName,
        kategori: '',
        qty: i.qtyGood || i.qtyReceived || 0,
        unit: i.unit,
        lokasi: 'Gudang Utama',
        harga: 0,
        batchNo: i.batchNo || '',
        kondisi: i.condition === 'Good' ? 'Baik' : i.condition || 'Baik',
        fotoKondisi: '',
        expiryDate: i.expiryDate || '',
      })),
    });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { kode: '', nama: '', kategori: '', qty: 0, unit: '', lokasi: 'Gudang Utama', harga: 0, batchNo: '', kondisi: 'Baik', fotoKondisi: '', expiryDate: '' }],
    });
  };

  const fotoKondisiRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFotoKondisiUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maks 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => updateItem(index, 'fotoKondisi', ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
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
      const stockItem = stockItemList.find(s => s.kode.toLowerCase() === value.toLowerCase());
      if (stockItem) {
        updatedItems[index].nama = stockItem.nama;
        updatedItems[index].unit = stockItem.satuan;
        updatedItems[index].harga = stockItem.hargaSatuan;
        updatedItems[index].kategori = stockItem.kategori;
      }
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  const postDraftStockIn = (stockIn: StockIn) => {
    if (isPosting) return;
    setIsPosting(true);
    try {
      updateStockIn(stockIn.id, {
        status: 'Posted',
        createdBy: currentUser?.fullName || stockIn.createdBy || 'Petugas Gudang',
      });
      setSelectedStockIn({ ...stockIn, status: 'Posted' });
      toast.success(`${stockIn.noStockIn} sudah diverifikasi dan diposting. Stok barang jadi bertambah.`);
    } catch (err) {
      toast.error('Gagal memposting: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsPosting(false);
    }
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
            onClick={() => navigate('/inventory/center')}
            className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Warehouse size={18} /> Monitoring Gudang
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
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-xl text-sm font-bold text-black outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 outline-none"
          >
            <option value="all">Semua Tipe</option>
            <option value="Receiving">Penerimaan PO</option>
            <option value="Return">Retur Proyek</option>
            <option value="Adjustment">Penyesuaian</option>
            <option value="Production Output">Barang Jadi dari QC</option>
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
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
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
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${si.status === 'Posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {si.status === 'Posted' ? 'Posted' : 'Menunggu Verifikasi'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setSelectedStockIn(si); setShowDetailModal(true); }} className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"><Eye size={18} /></button>
                      {si.status === 'Draft' && si.type === 'Production Output' && (
                        <button onClick={() => postDraftStockIn(si)} disabled={isPosting} className="px-3 h-9 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">Posting</button>
                      )}
                    </div>
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

              {/* Import dari Receiving PO */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Import dari Receiving PO</p>
                  <p className="text-xs text-indigo-500 font-medium">Pilih receiving untuk auto-isi form otomatis.</p>
                </div>
                {receivingList.filter(r => r.status === 'Complete' || r.status === 'Partial').length > 0 ? (
                  <select
                    className="px-4 py-3 bg-white border border-indigo-200 rounded-xl text-xs font-black text-slate-700 outline-none min-w-[220px]"
                    defaultValue=""
                    onChange={(e) => {
                      const rcv = receivingList.find(r => r.id === e.target.value);
                      if (rcv) importFromReceiving(rcv);
                    }}
                  >
                    <option value="">— Pilih Receiving —</option>
                    {receivingList
                      .filter(r => r.status === 'Complete' || r.status === 'Partial')
                      .slice(0, 20)
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.noReceiving} — {r.noPO} ({r.status})
                        </option>
                      ))
                    }
                  </select>
                ) : (
                  <span className="text-xs text-indigo-300 font-bold italic">Belum ada receiving selesai</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">No. Surat Jalan / Dokumen</label>
                  <input
                    type="text"
                    value={formData.noSuratJalan}
                    onChange={(e) => setFormData({ ...formData, noSuratJalan: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold text-black outline-none"
                    placeholder="Contoh: SJ-2023-001"
                    required
                  />
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tanggal Penerimaan</label>
                  <input
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold text-black outline-none"
                    required
                  />
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipe Transaksi</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as StockIn['type'] })}
                    className="w-full px-4 py-3 bg-white border-transparent rounded-xl text-sm font-bold text-black outline-none"
                    required
                  >
                    <option value="Receiving">Penerimaan PO (Pembelian)</option>
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
                          className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold text-black outline-none"
                          placeholder="Kode"
                          required
                        />
                        <datalist id="stock-items-list">
                          {stockItemList.map(s => <option key={s.id} value={s.kode}>{s.nama}</option>)}
                        </datalist>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Kategori</label>
                        <select
                          value={item.kategori || ''}
                          onChange={e => updateItem(index, 'kategori', e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold outline-none border-transparent ${item.kategori ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                        >
                          <option value="">— Pilih Kategori —</option>
                          {[...new Set([...stockItemList.map(s => s.kategori).filter(Boolean), ...(extraCategories || [])])].sort().map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Deskripsi Barang</label>
                        <input type="text" value={item.nama || ''} onChange={(e) => updateItem(index, 'nama', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold text-black outline-none" required />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1"><Tag size={10}/> Batch</label>
                        <input type="text" value={item.batchNo || ''} onChange={(e) => updateItem(index, 'batchNo', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold text-black outline-none" placeholder="Lot #" />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1">
                          <Calendar size={10}/> Expiry
                        </label>
                        <input
                          type="date"
                          value={item.expiryDate || ''}
                          onChange={(e) => updateItem(index, 'expiryDate', e.target.value)}
                          className={`w-full px-4 py-2.5 border-transparent rounded-xl text-xs font-bold text-black outline-none ${item.kategori?.toLowerCase().includes('castable') || item.kategori === 'Monolithics' ? 'bg-amber-50' : 'bg-white'}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Qty</label>
                        <input type="number" value={item.qty || ''} onChange={(e) => updateItem(index, 'qty', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-black text-black outline-none" required />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Satuan</label>
                        <input type="text" value={item.unit || ''} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border-transparent rounded-xl text-xs font-bold text-black outline-none" required />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Kondisi</label>
                        <select
                          value={item.kondisi || 'Baik'}
                          onChange={e => updateItem(index, 'kondisi', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs font-black border-transparent outline-none ${item.kondisi === 'Baik' ? 'bg-emerald-50 text-emerald-700' : item.kondisi === 'Rusak' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
                        >
                          <option value="Baik">Baik</option>
                          <option value="Cacat">Cacat</option>
                          <option value="Rusak">Rusak</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <button type="button" onClick={() => removeItemRow(index)} className="w-full h-10 bg-white text-red-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all active:scale-90 disabled:opacity-30 mt-5" disabled={formData.items.length === 1}>
                          <X size={16} />
                        </button>
                      </div>
                      {item.kondisi !== 'Baik' && (
                        <div className="col-span-12 mt-1 pt-3 border-t border-rose-100 flex items-center gap-3">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-wide">Foto Kerusakan</span>
                          <input
                            ref={el => { fotoKondisiRefs.current[index] = el; }}
                            type="file" accept="image/*" className="hidden"
                            onChange={e => handleFotoKondisiUpload(index, e)}
                          />
                          {item.fotoKondisi ? (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-rose-200 shadow-sm">
                                <img src={item.fotoKondisi} alt="Damage" className="w-full h-full object-cover" />
                              </div>
                              <button type="button" onClick={() => updateItem(index, 'fotoKondisi', '')}
                                className="text-[10px] font-black text-rose-400 hover:text-rose-600 flex items-center gap-1 px-2 py-1 bg-rose-50 rounded-lg">
                                <X size={10}/> Hapus
                              </button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => fotoKondisiRefs.current[index]?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-500 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-all">
                              <Camera size={12}/> Upload dari Device
                            </button>
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
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Memproses...' : 'Posting ke Buku Besar'}</button>
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
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${selectedStockIn.status === 'Posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>{selectedStockIn.status === 'Posted' ? 'POSTED' : 'DRAFT - MENUNGGU GUDANG'}</span>
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
                          <span className="ml-1 text-[9px] font-black text-slate-300 uppercase">{item.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedStockIn.status === 'Draft' && selectedStockIn.type === 'Production Output' && (
                <button onClick={() => postDraftStockIn(selectedStockIn)} disabled={isPosting} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Verifikasi & Posting ke Stok Barang Jadi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
