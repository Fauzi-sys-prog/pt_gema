import * as React from 'react';
import { X, Save, Search, Package } from 'lucide-react';

interface BOQMaterialModalProps {
  form: {
    itemKode?: string;
    materialName: string;
    qtyEstimate: number;
    qtyActual: number;
    unit: string;
    unitPrice: number;
    supplier: string;
    status: 'Not Ordered' | 'Ordered' | 'Received' | 'Used';
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: (data: any) => void;
  onClose: () => void;
  stockItemList?: any[];
}

export function BOQMaterialModal({ form, setForm, onSave, onClose, stockItemList = [] }: BOQMaterialModalProps) {
  const [searchTerm, setSearchTerm] = React.useState(form.itemKode || '');
  const [showSKUDropdown, setShowSKUDropdown] = React.useState(false);

  const filteredSKUs = stockItemList.filter(item => 
    item.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectSKU = (item: any) => {
    setForm((prev: any) => ({
      ...prev,
      itemKode: item.kode,
      materialName: item.nama,
      unit: item.satuan,
      unitPrice: item.hargaSatuan,
    }));
    setSearchTerm(item.kode);
    setIsManualEntry(false);
    setShowSKUDropdown(false);
  };

  const [isManualEntry, setIsManualEntry] = React.useState(!form.itemKode && form.materialName ? true : false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleManualEntryToggle = () => {
    const nextState = !isManualEntry;
    setIsManualEntry(nextState);
    if (nextState) {
      setForm((prev: any) => ({
        ...prev,
        itemKode: '',
      }));
      setSearchTerm('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Save size={20} />
            </div>
            <div>
              <h3 className="font-bold">Sinkronisasi Master SKU Proyek</h3>
              <p className="text-xs text-slate-400">Hubungkan BOQ dengan standar SKU GTP</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-6 space-y-6">
            {/* Visual Indicator of Material Status */}
            <div className={`p-4 rounded-lg border-2 flex items-center justify-between transition-all ${isManualEntry ? 'bg-amber-50 border-amber-200' : (form.itemKode ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200')}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isManualEntry ? 'bg-amber-500' : (form.itemKode ? 'bg-emerald-500' : 'bg-slate-400')}`}>
                  {isManualEntry ? <Package size={20} /> : <Save size={20} />}
                </div>
                <div>
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isManualEntry ? 'text-amber-600' : (form.itemKode ? 'text-emerald-600' : 'text-slate-500')}`}>
                     {isManualEntry ? 'Identifikasi: Barang Baru (Manual)' : (form.itemKode ? 'Identifikasi: Master SKU GTP' : 'Identifikasi: Belum Dipilih')}
                   </p>
                   <p className="text-sm font-black text-slate-800">
                     {form.materialName || 'Silahkan pilih atau input material...'}
                   </p>
                </div>
              </div>
              {!isManualEntry && form.itemKode && (
                <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400">KODE SKU</p>
                   <p className="text-xs font-mono font-bold text-emerald-700">{form.itemKode}</p>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest">
                  {isManualEntry ? 'Input Material Manual' : 'Pilih Master SKU (GTP-MTR-...)'}
                </label>
                <button 
                  type="button"
                  onClick={handleManualEntryToggle}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${isManualEntry ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  {isManualEntry ? '← Gunakan Master SKU' : '+ Input Manual (Barang Baru)'}
                </button>
              </div>

              {!isManualEntry ? (
                <div className="relative">
                  <div className="absolute left-3 top-2.5 text-slate-400">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowSKUDropdown(true);
                    }}
                    onFocus={() => setShowSKUDropdown(true)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white font-mono text-sm shadow-sm"
                    placeholder="Cari Kode SKU atau Nama Barang..."
                  />
                  
                  {showSKUDropdown && filteredSKUs.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {filteredSKUs.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectSKU(item)}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-indigo-600 font-mono text-xs">{item.kode}</p>
                              <p className="text-slate-800 font-medium text-sm">{item.nama}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold uppercase">
                                Stok: {item.stok} {item.satuan}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-100 text-amber-600 rounded">
                    <Save size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-800">Mode Input Manual Aktif</p>
                    <p className="text-[10px] text-amber-700">Barang ini akan didaftarkan otomatis ke Master Data saat pembuatan PO nanti.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Nama Material {isManualEntry ? '*' : '(Auto-sync)'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.materialName}
                    onChange={(e) => isManualEntry && handleChange('materialName', e.target.value)}
                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-black italic uppercase tracking-tighter ${!isManualEntry ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500'}`}
                    readOnly={!isManualEntry}
                    placeholder={isManualEntry ? "Masukkan nama barang..." : "Pilih SKU terlebih dahulu"}
                    required
                  />
                  {!isManualEntry && form.itemKode && (
                    <div className="absolute right-3 top-2.5">
                      <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest italic">Linked</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Satuan {isManualEntry ? '*' : '(Master SKU)'}</label>
                <input
                  type="text"
                  list="boq-unit-options"
                  value={form.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className={`w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-black italic text-center focus:ring-2 focus:ring-indigo-500 outline-none ${!isManualEntry ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-900'}`}
                  placeholder="Kg, Pcs, Lot..."
                  required
                />
                <datalist id="boq-unit-options">
                  <option value="kg" />
                  <option value="pcs" />
                  <option value="mtr" />
                  <option value="set" />
                  <option value="lot" />
                  <option value="sak" />
                  <option value="pail" />
                  <option value="can" />
                  <option value="btl" />
                  <option value="liter" />
                  <option value="m2" />
                  <option value="m3" />
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Supplier Referensi *</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-sm shadow-sm font-black italic uppercase tracking-tighter"
                placeholder="Nama Supplier Pengadaan"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Qty BOQ (Target) *</label>
                <input
                  type="number"
                  value={form.qtyEstimate}
                  onChange={(e) => handleChange('qtyEstimate', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-sm shadow-sm font-black italic"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Harga Satuan Budget (Rp) *</label>
                <input
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) => handleChange('unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-sm shadow-sm font-black italic text-indigo-600"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-lg overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-10 text-white">
                <DollarSign size={80} />
              </div>
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black italic text-indigo-400 uppercase tracking-[2px] mb-1">Total Budget Estimasi</p>
                  <p className="text-2xl font-black italic text-white tracking-tighter">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(form.qtyEstimate * form.unitPrice)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black italic text-slate-400 uppercase mb-1 tracking-widest">Status Proyeksi</p>
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black italic uppercase border border-indigo-500/30">
                    Sesuai Budget
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black italic text-slate-600 uppercase tracking-widest mb-2">Status Alokasi</label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-sm shadow-sm font-black italic uppercase tracking-tighter"
                required
              >
                <option value="Not Ordered">Not Ordered (Planning)</option>
                <option value="Ordered">Ordered (PO Created)</option>
                <option value="Received">Received (In Warehouse)</option>
                <option value="Used">Used (Project Issuance)</option>
              </select>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-black text-sm font-bold transition-all shadow-md flex items-center gap-2"
            >
              <Save size={18} />
              Simpan ke BOQ
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function DollarSign({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );
}
