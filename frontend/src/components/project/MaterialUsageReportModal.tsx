import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { X, Plus, Trash2, Save, Printer, Download, AlertCircle, Package, Calendar, MapPin, CheckCircle2, FileText } from 'lucide-react'; import type { MaterialUsageReport } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import logoGTP from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

interface MaterialUsageReportModalProps {
  projectId: string;
  projectName: string;
  customerName: string;
  spkOptions?: string[];
  mode?: "create" | "edit" | "view";
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: MaterialUsageReport) => void;
  editingReport?: MaterialUsageReport | null;
}

export function MaterialUsageReportModal({
  projectId,
  projectName,
  customerName,
  spkOptions = [],
  mode = "create",
  isOpen,
  onClose,
  onSave,
  editingReport
}: MaterialUsageReportModalProps) {
  const { stockItemList } = useApp();
  const isReadOnly = mode === "view";
  const [formData, setFormData] = useState<Omit<MaterialUsageReport, 'id' | 'projectId'>>({
    reportNumber: '',
    spkNumber: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    customerName: customerName,
    items: [],
    preparedBy: '',
    checkedBy: '',
    approvedBy: ''
  });

  useEffect(() => {
    if (editingReport) {
      setFormData({
        reportNumber: editingReport.reportNumber,
        spkNumber: editingReport.spkNumber,
        date: editingReport.date,
        location: editingReport.location,
        customerName: editingReport.customerName,
        items: editingReport.items,
        preparedBy: editingReport.preparedBy,
        checkedBy: editingReport.checkedBy,
        approvedBy: editingReport.approvedBy
      });
    } else {
      setFormData({
        reportNumber: `MUR/${new Date().getFullYear()}/${(Math.floor(Math.random() * 900) + 100)}`,
        spkNumber: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        customerName: customerName,
        items: [],
        preparedBy: '',
        checkedBy: '',
        approvedBy: ''
      });
    }
  }, [editingReport, customerName, isOpen]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Math.random().toString(36).substr(2, 9),
          materialName: '',
          unit: '',
          pengambilan: 0,
          terpasang: 0,
          sisa: 0,
          keterangan: ''
        }
      ]
    }));
  };

  const handleRemoveItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // Auto calculate sisa
          if (field === 'pengambilan' || field === 'terpasang') {
            updatedItem.sisa = (updatedItem.pengambilan || 0) - (updatedItem.terpasang || 0);
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const handleSave = () => {
    if (isReadOnly) return;
    if (!formData.reportNumber || !formData.date) {
      toast.error('Nomor Laporan dan Tanggal wajib diisi');
      return;
    }
    if (formData.items.length === 0) {
      toast.error('Tambahkan minimal satu material');
      return;
    }

    onSave({
      id: editingReport?.id || Math.random().toString(36).substr(2, 9),
      projectId,
      ...formData
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-[#f8fafc] rounded-[2rem] w-full max-w-5xl shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Section (Matching PT GMT Style) */}
        <div className="bg-white p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <img src={logoGTP} alt="Logo" className="h-10 w-auto" />
            <div className="h-10 w-[2px] bg-slate-100 mx-2" />
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                Laporan Pemakaian & Sisa Material
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">
                Material Usage & Remainder Report - Field Records
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Main Form Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">No. Laporan / Report No.</label>
                  <input 
                    type="text"
                    value={formData.reportNumber}
                    onChange={(e) => setFormData({...formData, reportNumber: e.target.value})}
                    readOnly={isReadOnly}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-blue-600 focus:outline-none focus:border-blue-500 transition-all italic"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">No. SPK</label>
                    <input 
                      list="spk-history-options"
                      type="text"
                      value={formData.spkNumber}
                      onChange={(e) => setFormData({...formData, spkNumber: e.target.value})}
                      readOnly={isReadOnly}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
                      placeholder={spkOptions.length > 0 ? "Pilih / ketik No SPK" : "e.g. SPK-2026-001"}
                    />
                    <datalist id="spk-history-options">
                      {spkOptions.map((spk) => (
                        <option key={spk} value={spk} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tanggal / Date</label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      readOnly={isReadOnly}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lokasi / Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    readOnly={isReadOnly}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Alamat Lokasi Proyek"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Proyek</label>
                  <div className="w-full bg-slate-100 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-slate-500 italic">
                    {projectName}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Customer</label>
                  <div className="w-full bg-slate-100 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-slate-500 italic">
                    {formData.customerName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase italic tracking-widest flex items-center gap-2">
                <Package size={16} className="text-blue-600" />
                Material List / Daftar Material
              </h3>
              {!isReadOnly && (
                <button 
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                >
                  <Plus size={14} /> Tambah Item
                </button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-12">No</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-left">Nama Material / Produk</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-24">Satuan</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-32">Pengambilan</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-32">Terpasang</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-32 bg-slate-800">Sisa</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-left">Keterangan</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.length > 0 ? (
                    formData.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="px-4 py-3 text-xs font-black text-slate-400 text-center">{index + 1}</td>
                        <td className="px-4 py-3">
                          <input 
                            list="stock-items"
                            type="text"
                            value={item.materialName}
                            onChange={(e) => handleItemChange(item.id, 'materialName', e.target.value)}
                            readOnly={isReadOnly}
                            className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 text-sm font-bold text-slate-900"
                            placeholder="Nama barang..."
                          />
                          <datalist id="stock-items">
                            {stockItemList.map(s => <option key={s.id} value={s.nama} />)}
                          </datalist>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                            readOnly={isReadOnly}
                            className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 text-sm font-bold text-slate-500 text-center"
                            placeholder="kg/bag/pcs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number"
                            value={item.pengambilan}
                            onChange={(e) => handleItemChange(item.id, 'pengambilan', Number(e.target.value))}
                            readOnly={isReadOnly}
                            className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 text-sm font-black text-blue-600 text-center"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number"
                            value={item.terpasang}
                            onChange={(e) => handleItemChange(item.id, 'terpasang', Number(e.target.value))}
                            readOnly={isReadOnly}
                            className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 text-sm font-black text-indigo-600 text-center"
                          />
                        </td>
                        <td className="px-4 py-3 bg-slate-50">
                           <div className={`text-sm font-black text-center ${item.sisa < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                              {item.sisa}
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text"
                            value={item.keterangan}
                            onChange={(e) => handleItemChange(item.id, 'keterangan', e.target.value)}
                            readOnly={isReadOnly}
                            className="w-full bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 text-[11px] font-medium text-slate-500"
                            placeholder="Catatan..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          {!isReadOnly && (
                            <button 
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Package size={48} className="mx-auto mb-3 opacity-10" />
                        <p className="text-slate-400 text-xs font-black uppercase italic tracking-widest">Belum ada item ditambahkan</p>
                        {!isReadOnly && (
                          <button onClick={handleAddItem} className="mt-4 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Tambah Sekarang</button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures Section (Matching Image Footer) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Dibuat Oleh (Prod/Maint)</label>
               <input 
                 type="text"
                 value={formData.preparedBy}
                 onChange={(e) => setFormData({...formData, preparedBy: e.target.value})}
                 readOnly={isReadOnly}
                 className="w-full bg-slate-50 border-b-2 border-slate-100 focus:border-blue-500 focus:outline-none px-4 py-2 text-sm font-black text-slate-900 uppercase text-center"
                 placeholder="Nama Pembuat"
               />
               <p className="mt-2 text-[9px] text-slate-400 italic">Bag. Maintenance/Prod</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Diperiksa Oleh (Gudang)</label>
               <input 
                 type="text"
                 value={formData.checkedBy}
                 onChange={(e) => setFormData({...formData, checkedBy: e.target.value})}
                 readOnly={isReadOnly}
                 className="w-full bg-slate-50 border-b-2 border-slate-100 focus:border-blue-500 focus:outline-none px-4 py-2 text-sm font-black text-slate-900 uppercase text-center"
                 placeholder="Nama Petugas"
               />
               <p className="mt-2 text-[9px] text-slate-400 italic">Bagian Gudang</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Diketahui Oleh (Supervisor)</label>
               <input 
                 type="text"
                 value={formData.approvedBy}
                 onChange={(e) => setFormData({...formData, approvedBy: e.target.value})}
                 readOnly={isReadOnly}
                 className="w-full bg-slate-50 border-b-2 border-slate-100 focus:border-blue-500 focus:outline-none px-4 py-2 text-sm font-black text-slate-900 uppercase text-center"
                 placeholder="Nama Supervisor"
               />
               <p className="mt-2 text-[9px] text-slate-400 italic">Supervisor Lapangan</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-900 border-t border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertCircle size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Pastikan data sesuai dengan dokumen fisik</span>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
            >
              {isReadOnly ? "Tutup" : "Batal"}
            </button>
            {!isReadOnly && (
              <button 
                onClick={handleSave}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/40 flex items-center gap-2"
              >
                <Save size={16} /> {editingReport ? 'Update Report' : 'Simpan Laporan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
