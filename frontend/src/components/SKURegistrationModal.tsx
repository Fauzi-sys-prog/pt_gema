import React, { useState, useMemo } from 'react';
import { Box, X, ChevronDown, Save, Info, CheckCircle2, Plus, Zap } from 'lucide-react'; import { motion, AnimatePresence } from 'motion/react'; import { useApp } from '../contexts/AppContext';
import { toast } from "sonner@2.0.3";
import api from '../services/api';

interface SKURegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
}

export const SKURegistrationModal: React.FC<SKURegistrationModalProps> = ({ isOpen, onClose, initialName = '' }) => {
  const { setStockItemList, setStockMovementList, currentUser, projectList, stockItemList } = useApp();
  const [sku, setSku] = useState('');
  const [selectedBoqItem, setSelectedBoqItem] = useState('');
  const [formData, setFormData] = useState({
    nama: initialName || '',
    kategori: 'Mechanical',
    satuan: 'Unit',
    stokAwal: 0,
    hargaSatuan: 0,
    lokasi: 'Gudang Utama'
  });

  // Conflict Awareness States
  const isSkuConflict = useMemo(() => {
    if (!sku) return false;
    return stockItemList.some(s => s.kode.toLowerCase().trim() === sku.toLowerCase().trim());
  }, [sku, stockItemList]);

  const isNameConflict = useMemo(() => {
    if (!formData.nama) return false;
    return stockItemList.some(s => s.nama.toLowerCase().trim() === formData.nama.toLowerCase().trim());
  }, [formData.nama, stockItemList]);

  // Derived list of BOQ items from all projects that aren't registered yet
  const boqSuggestions = useMemo(() => {
    const suggestions: { label: string, value: string, data: any }[] = [];
    projectList.forEach(prj => {
      prj.boq?.forEach((item: any) => {
        const name = item.materialName || item.nama;
        const kode = item.itemKode || item.kode;
        
        // Check if this item is already in inventory
        const alreadyExists = stockItemList.some(s => 
          (kode && s.kode === kode) || 
          (s.nama.toLowerCase().trim() === name.toLowerCase().trim())
        );

        if (!alreadyExists) {
          suggestions.push({
            label: `${prj.kodeProject} - ${name} (${item.unit})`,
            value: `${prj.id}-${kode || name}`,
            data: item
          });
        }
      });
    });
    return suggestions;
  }, [projectList, stockItemList]);

  if (!isOpen) return null;

  const handleBoqSelect = (val: string) => {
    setSelectedBoqItem(val);
    const suggestion = boqSuggestions.find(s => s.value === val);
    if (suggestion) {
      const { data } = suggestion;
      setSku(data.itemKode || '');
      setFormData({
        ...formData,
        nama: data.materialName || data.nama || '',
        satuan: data.unit || 'Unit',
        hargaSatuan: data.unitPrice || 0
      });
      toast.info(`Data otomatis diambil dari BOQ Proyek.`, {
        description: "Silakan lengkapi Kode SKU jika belum ada."
      });
    }
  };

  const handleSave = () => {
    if (!sku || !formData.nama) {
      toast.error("Kode SKU dan Nama Barang wajib diisi!");
      return;
    }

    if (isSkuConflict) {
      toast.error(`Konflik Terdeteksi! Kode SKU "${sku}" sudah terdaftar.`);
      return;
    }

    if (isNameConflict) {
      if (!window.confirm(`Peringatan: Nama barang "${formData.nama}" sudah ada. Tetap simpan sebagai varian baru?`)) {
        return;
      }
    }

    const newId = `ITEM-${Date.now()}`;
    const tanggal = new Date().toISOString().split('T')[0];
    
    const newItem = {
      id: newId,
      kode: sku,
      nama: formData.nama,
      kategori: formData.kategori,
      satuan: formData.satuan,
      stok: Number(formData.stokAwal),
      minStock: 5,
      hargaSatuan: Number(formData.hargaSatuan),
      lokasi: formData.lokasi,
      onOrder: 0,
      reserved: 0,
      lastUpdate: tanggal,
      statusBarang: 'Good' as const
    };

    setStockItemList(prev => [...prev, newItem]);
    api.post('/inventory/items', newItem).catch((err) => {
      console.error('Failed to sync new SKU item:', err);
      toast.error(err?.response?.data?.error || 'Gagal sinkron SKU ke server');
    });

    if (Number(formData.stokAwal) > 0) {
      const openingMovement = {
        id: `MOV-${Date.now()}`,
        tanggal: tanggal,
        type: "IN",
        refNo: "SALDO-AWAL",
        refType: "Opening Balance",
        itemKode: sku,
        itemNama: formData.nama,
        qty: Number(formData.stokAwal),
        unit: formData.satuan,
        lokasi: formData.lokasi,
        stockBefore: 0,
        stockAfter: Number(formData.stokAwal),
        createdBy: currentUser?.fullName || 'Admin'
      };
      setStockMovementList(prev => [...prev, openingMovement]);
      api.post('/inventory/movements', openingMovement).catch((err) => {
        console.error('Failed to sync opening stock movement:', err);
      });
    }

    toast.success(`SKU ${sku} berhasil didaftarkan ke Master Data.`);
    onClose();
    // Reset form
    setSku('');
    setFormData({
      nama: '',
      kategori: 'Mechanical',
      satuan: 'Unit',
      stokAwal: 0,
      hargaSatuan: 0,
      lokasi: 'Gudang Utama'
    });
  };

  const anatomyItems = [
    { label: 'GTP', desc: 'Nama Perusahaan (Gema Teknik Perkasa)' },
    { label: 'MTR', desc: 'Kategori (Material). Memudahkan filter Supply Chain.' },
    { label: 'PMP', desc: 'Jenis Barang (Pump). Membantu teknisi Technical Survey.' },
    { label: 'CNF', desc: 'Sub-Tipe (Centrifugal). Penting untuk spesifikasi.' },
    { label: '5HP', desc: 'Spesifikasi Kunci (5 Horsepower). Hindari salah ambil.' },
    { label: '001', desc: 'Nomor urut unik untuk varian tersebut.' },
  ];

  const generateAutoSku = () => {
    const catCode = formData.kategori.substring(0, 3).toUpperCase();
    const subCode = formData.nama.substring(0, 3).toUpperCase() || 'XXX';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setSku(`GTP-MTR-${catCode}-${subCode}-${randomSuffix}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col min-h-[600px] border border-slate-100"
      >
        {/* Main Form Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Header */}
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Registrasi SKU Baru</h2>
              <p className="text-slate-400 text-[10px] mt-1 font-black tracking-[0.2em] uppercase">Sinkronisasi Master Data & Inventory Ledger</p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-slate-50 rounded-2xl transition-all group border border-transparent hover:border-slate-100"
            >
              <X className="w-6 h-6 text-slate-300 group-hover:text-slate-900" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-10 flex-1 overflow-y-auto">
            {/* BOQ Sync Selection - Highlighted */}
            {boqSuggestions.length > 0 && (
              <div className="mb-10 p-6 bg-indigo-50 border-2 border-dashed border-indigo-100 rounded-[32px] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-900 uppercase tracking-widest block">Ambil Data Deskripsi dari Project</label>
                    <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-tight">Pilih material dari BOQ untuk mengisi formulir secara instan</p>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={selectedBoqItem}
                    onChange={(e) => handleBoqSelect(e.target.value)}
                    className="w-full px-5 py-4 bg-white border-2 border-indigo-100 rounded-2xl appearance-none focus:border-indigo-500 outline-none text-xs font-black text-slate-700 shadow-sm"
                  >
                    <option value="">-- PILIH ITEM DARI KEBUTUHAN PROYEK --</option>
                    {boqSuggestions.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-12 gap-10">
              {/* Left Form Col */}
              <div className="col-span-12 lg:col-span-7 space-y-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                      Kode Barang / SKU
                    </label>
                    <div className="flex items-center gap-3">
                      {isSkuConflict && (
                        <span className="text-[9px] font-black text-red-500 uppercase italic animate-pulse">⚠️ SKU Sudah Ada</span>
                      )}
                      <button 
                        onClick={generateAutoSku}
                        className="text-[9px] font-black text-indigo-600 hover:text-white hover:bg-indigo-600 uppercase tracking-widest flex items-center gap-1 border-2 border-indigo-50 px-3 py-1.5 rounded-xl transition-all active:scale-95 italic"
                      >
                        <Plus className="w-3 h-3" /> Buat Otomatis
                      </button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="GTP-MTR-XXX-001"
                    className={`w-full px-6 py-5 border-2 rounded-2xl outline-none transition-all font-mono font-black text-lg ${isSkuConflict ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-indigo-500 text-slate-700'}`}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                      Deskripsi Barang (Nama)
                    </label>
                    {isNameConflict && (
                      <span className="text-[9px] font-black text-amber-600 uppercase italic">⚠️ Nama Mirip Ditemukan</span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. Centrifugal Pump 5HP - High Pressure"
                    value={formData.nama || ''}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className={`w-full px-6 py-5 border-2 rounded-2xl outline-none transition-all font-black italic text-lg shadow-sm ${isNameConflict ? 'border-amber-200 bg-amber-50' : 'bg-white border-slate-100 focus:border-indigo-500 text-slate-900'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 italic">
                      Kategori
                    </label>
                    <input 
                      type="text" 
                      value={formData.kategori}
                      onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                      placeholder="e.g. Mechanical, Electrical"
                      className="w-full px-6 py-5 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all text-slate-900 font-black text-sm shadow-sm italic"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 italic">
                      Satuan
                    </label>
                    <div className="relative">
                      <select 
                        value={formData.satuan}
                        onChange={(e) => setFormData({...formData, satuan: e.target.value})}
                        className="w-full px-6 py-5 bg-white border-2 border-slate-100 rounded-2xl appearance-none focus:border-indigo-500 outline-none shadow-sm text-slate-900 font-black text-sm italic"
                      >
                        <option>Unit</option>
                        <option>Pcs</option>
                        <option>Bag</option>
                        <option>Set</option>
                        <option>Lot</option>
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Form Col: Financial & Stock */}
              <div className="col-span-12 lg:col-span-5 space-y-8">
                <div className="bg-indigo-600 p-10 rounded-[40px] shadow-2xl shadow-indigo-200 text-white overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Box className="w-40 h-40 rotate-12" />
                  </div>
                  <div className="relative z-10">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] mb-6 opacity-70">
                      Saldo Awal Gudang
                    </label>
                    <div className="flex items-end gap-4">
                      <input 
                        type="number" 
                        value={formData.stokAwal}
                        onChange={(e) => setFormData({...formData, stokAwal: Number(e.target.value)})}
                        className="w-full text-7xl font-black bg-transparent outline-none border-none p-0 leading-none placeholder-white/20 italic tracking-tighter"
                      />
                      <span className="text-sm font-black opacity-50 mb-3 uppercase tracking-widest italic">{formData.satuan}</span>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 border-2 border-slate-100 rounded-[40px] shadow-sm space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Harga Satuan (HPP)
                  </label>
                  <div className="flex items-baseline gap-3">
                    <span className="text-slate-400 font-black text-sm uppercase italic">Rp</span>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={formData.hargaSatuan}
                      onChange={(e) => setFormData({...formData, hargaSatuan: Number(e.target.value)})}
                      className="w-full text-4xl font-black text-slate-900 outline-none border-none bg-transparent italic tracking-tighter"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">
                    * Harga ini akan menjadi dasar perhitungan laba kotor proyek saat barang digunakan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-10 border-t border-slate-50 bg-white flex justify-end items-center gap-8">
            <button 
              onClick={onClose}
              className="text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.3em] transition-colors italic"
            >
              Batalkan
            </button>
            <button 
              onClick={handleSave}
              className="px-14 py-6 bg-slate-900 hover:bg-indigo-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.4em] transition-all shadow-2xl shadow-slate-900/20 active:scale-[0.98] flex items-center gap-4 italic"
            >
              <Save className="w-5 h-5" />
              Simpan Master SKU
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
