import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  FileText,
  Download,
  Trash2,
  Camera,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  Save,
  Clock,
  X,
  ArrowUpRight,
  MapPin,
  ZoomIn
} from 'lucide-react';
import { motion } from 'motion/react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useApp, type BKExpenseItem, type WorkingExpenseSheet } from '../../contexts/AppContext';

import { useEscapeKey } from '../../hooks/useEscapeKey';

const BK_CATEGORIES = [
  'Transport',
  'Makan & Minum',
  'Material & Alat',
  'Upah THL',
  'Upah Harian',
  'Akomodasi',
  'Komunikasi',
  'Lainnya',
];

export default function WorkingExpensePage() {
  const { projectList = [], addArchiveEntry, workingExpenseSheets, addWorkingExpenseSheet, updateWorkingExpenseSheet } = useApp();
  const [imgBiayaKerjaRef, setImgBiayaKerjaRef] = useState('');
  useEffect(() => {
    import('figma:asset/58af19785453a99273d5a0b2ab1d8cd3bef38814.png')
      .then((m: { default: string }) => setImgBiayaKerjaRef(m.default))
      .catch(() => {});
  }, []);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [listSearch, setListSearch] = useState('');
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const selectedSheet = workingExpenseSheets.find(s => s.id === selectedSheetId) ?? null;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editable items state (per open sheet) — local draft until saved
  const [editableItems, setEditableItems] = useState<BKExpenseItem[]>([]);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState<Omit<BKExpenseItem, 'id'>>({ date: new Date().toISOString().split('T')[0], category: '', description: '', nominal: 0, hasNota: '' });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Refs for per-row file inputs
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const handleOpenDetail = (sheet: WorkingExpenseSheet) => {
    setSelectedSheetId(sheet.id);
    setEditableItems([...sheet.items]);
    setShowAddRow(false);
    setView('detail');
  };

  const handleAddRow = async () => {
    if (!newRow.description) return;
    const previous = editableItems;
    const updated = [...editableItems, { id: Date.now().toString(), ...newRow }];
    setEditableItems(updated);
    try {
      if (selectedSheetId) await updateWorkingExpenseSheet(selectedSheetId, { items: updated });
      setNewRow({ date: new Date().toISOString().split('T')[0], category: '', description: '', nominal: 0, hasNota: '' });
      setShowAddRow(false);
    } catch (err) {
      setEditableItems(previous);
      toast.error('Gagal menyimpan baris: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!window.confirm('Hapus baris biaya ini?')) return;
    const previous = editableItems;
    const updated = editableItems.filter(r => r.id !== id);
    setEditableItems(updated);
    try {
      if (selectedSheetId) await updateWorkingExpenseSheet(selectedSheetId, { items: updated });
    } catch (err) {
      setEditableItems(previous);
      toast.error('Gagal menghapus baris: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleBonUpload = (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('File terlalu besar! Maks 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const previous = editableItems;
      const updated = editableItems.map(item => item.id === id ? { ...item, bonUrl: url, hasNota: 'Y' as const } : item);
      setEditableItems(updated);
      try {
        if (selectedSheetId) await updateWorkingExpenseSheet(selectedSheetId, { items: updated });
        toast.success('Bon berhasil diupload');
      } catch (err) {
        setEditableItems(previous);
        toast.error('Gagal menyimpan bon: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApprove = async () => {
    if (!selectedSheet || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateWorkingExpenseSheet(selectedSheet.id, { status: 'Approved' });
      toast.success("Data dikunci — tabel tidak bisa diedit lagi");
    } catch (err) {
      toast.error('Gagal approve: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata', 'Danamon', 'BSI', 'BTN'];
  const [newExpense, setNewExpense] = useState({
    client: '', project: '', location: '',
    date: new Date().toISOString().split('T')[0],
    noHal: '', totalKas: 0, keterangan: '', bank: 'BCA',
  });

  useEscapeKey([
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
    { condition: showAddRow, close: () => setShowAddRow(false) },
  ]);


  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      const sheet: WorkingExpenseSheet = {
        id: `BK-${Date.now()}`,
        client: newExpense.client,
        project: newExpense.project,
        location: newExpense.location,
        date: new Date(newExpense.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        noHal: newExpense.noHal || `${String(workingExpenseSheets.length + 1).padStart(3, '0')}/BK/GTP/${new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }).replace(' ', '/')}`,
        revisi: '0',
        items: [],
        totalKas: newExpense.totalKas,
        keterangan: newExpense.keterangan,
        bank: newExpense.bank,
        status: 'Draft',
      };
      addWorkingExpenseSheet(sheet);
      toast.success("Biaya Kerja baru telah dibuat", { description: `Ref: ${sheet.noHal}` });
      setShowCreateModal(false);
      setIsSubmitting(false);
      setNewExpense({ client: '', project: '', location: '', date: new Date().toISOString().split('T')[0], noHal: '', totalKas: 0, keterangan: '', bank: 'BCA' });
    }, 800);
  };

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (view === 'detail' && selectedSheet) {
    const grandTotal = editableItems.reduce((sum, item) => sum + item.nominal, 0);
    const sisaUang = selectedSheet.totalKas - grandTotal;
    const isLocked = selectedSheet.status === 'Approved' || selectedSheet.status === 'Paid';

    return (
      <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
        {/* Lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
            <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={28} /></button>
            <img src={lightboxUrl} alt="Bon" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Biaya Kerja Ledger</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Ref No: {selectedSheet.noHal}</p>
          </div>
          <div className="ml-auto flex gap-3">
            <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2">
              <Download size={16} /> Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Ledger */}
          <div className="xl:col-span-3 space-y-5">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-sm">
              {/* Doc header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-8 pb-6 border-b border-dashed border-slate-100">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 flex-1 min-w-0">
                  {[
                    ['Client', selectedSheet.client], ['Date', selectedSheet.date],
                    ['Project', selectedSheet.project], ['No. Hal', selectedSheet.noHal],
                    ['Location', selectedSheet.location], ['Revisi', selectedSheet.revisi],
                    ...(selectedSheet.keterangan ? [['Keterangan', selectedSheet.keterangan]] : []),
                    ...(selectedSheet.bank ? [['Bank', selectedSheet.bank]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                      <p className="text-xs font-black text-slate-900 uppercase italic truncate">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center p-3 border border-slate-100">
                  <ImageWithFallback src="/logo.png" className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Add Row button */}
              {!isLocked && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setShowAddRow(v => !v)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <Plus size={13} /> {showAddRow ? 'Batal' : 'Tambah Baris'}
                </button>
              </div>
              )}

              {/* Inline add form */}
              {!isLocked && showAddRow && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[8px] font-black text-slate-700 uppercase block mb-1">Tanggal</label>
                      <input type="date" value={newRow.date} onChange={e => setNewRow(r => ({ ...r, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold bg-white" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-700 uppercase block mb-1">Kategori *</label>
                      <select value={newRow.category} onChange={e => setNewRow(r => ({ ...r, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold bg-white">
                        <option value="">Pilih...</option>
                        {BK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-700 uppercase block mb-1">Nota</label>
                      <select value={newRow.hasNota} onChange={e => setNewRow(r => ({ ...r, hasNota: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold bg-white">
                        <option value="">-</option>
                        <option value="Y">Y</option>
                        <option value="T">T</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-700 uppercase block mb-1">Nominal (Rp)</label>
                      <input type="number" placeholder="0" value={newRow.nominal || ''} onChange={e => setNewRow(r => ({ ...r, nominal: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-700 uppercase block mb-1">Deskripsi *</label>
                    <input type="text" placeholder="Keterangan pengeluaran..." value={newRow.description} onChange={e => setNewRow(r => ({ ...r, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold bg-white" />
                  </div>
                  <button onClick={handleAddRow}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                    <Save size={14} /> Simpan Baris
                  </button>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto border border-slate-900 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white divide-x divide-slate-700">
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-center w-10">No</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest w-16">Tanggal</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest w-28">Kategori</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest">Deskripsi</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-right w-36">Nominal (IDR)</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-center w-14">Nota</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-center w-16">Bon</th>
                      <th className="px-3 py-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {editableItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-all divide-x divide-slate-100 group">
                        <td className="px-3 py-3 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-3 py-3 text-[10px] font-black text-slate-600 uppercase italic">{item.date}</td>
                        <td className="px-3 py-3">
                          {item.category ? (
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide ${item.category === 'Upah THL' || item.category === 'Upah Harian' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                              {item.category}
                            </span>
                          ) : <span className="text-slate-300 text-[9px]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs font-black text-slate-900 uppercase italic">{item.description}</td>
                        <td className="px-3 py-3 text-xs font-black text-slate-900 text-right italic">
                          {item.nominal > 0 ? formatCurrency(item.nominal) : '-'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] font-black ${item.hasNota === 'Y' ? 'text-emerald-600' : item.hasNota === 'T' ? 'text-rose-500' : 'text-slate-300'}`}>
                            {item.hasNota || '-'}
                          </span>
                        </td>
                        {/* Bon upload cell */}
                        <td className="px-3 py-3 text-center">
                          {item.bonUrl ? (
                            <button onClick={() => setLightboxUrl(item.bonUrl!)}
                              className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-emerald-400 mx-auto block hover:border-blue-500 transition-all group/bon">
                              <img src={item.bonUrl} alt="bon" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/bon:opacity-100 transition-all flex items-center justify-center">
                                <ZoomIn size={12} className="text-white" />
                              </div>
                            </button>
                          ) : !isLocked ? (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={el => { fileInputRefs.current[item.id] = el; }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleBonUpload(item.id, file);
                                }}
                              />
                              <button
                                onClick={() => fileInputRefs.current[item.id]?.click()}
                                className="w-9 h-9 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center mx-auto text-slate-300 hover:text-blue-500"
                              >
                                <Camera size={14} />
                              </button>
                            </>
                          ) : <span className="text-slate-300 text-[9px]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {!isLocked && (
                            <button onClick={() => handleDeleteRow(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 hover:text-rose-600">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Empty rows */}
                    {Array.from({ length: Math.max(0, 5 - editableItems.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="divide-x divide-slate-100 h-10">
                        <td className="px-3 py-3 text-[10px] text-slate-200 text-center">{editableItems.length + i + 1}</td>
                        <td /><td /><td /><td /><td /><td />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 divide-x divide-slate-100 border-t-2 border-slate-900">
                      <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Grand Total</td>
                      <td className="px-6 py-4 text-sm font-black text-right italic text-slate-900 bg-slate-100/50">{formatCurrency(grandTotal)}</td>
                      <td colSpan={4}></td>
                    </tr>
                    <tr className="bg-slate-50 divide-x divide-slate-100">
                      <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Total Kas</td>
                      <td className="px-6 py-4 text-sm font-black text-right italic text-blue-600 bg-blue-50/30">{formatCurrency(selectedSheet.totalKas)}</td>
                      <td colSpan={4}></td>
                    </tr>
                    <tr className="bg-emerald-600 text-white divide-x divide-emerald-500">
                      <td colSpan={3} className="px-6 py-4 text-[10px] font-black uppercase italic tracking-[0.2em]">Sisa Uang Lapangan</td>
                      <td className="px-6 py-4 text-lg font-black text-right italic">{formatCurrency(selectedSheet.totalKas - grandTotal)}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Ledger Status</p>
                  <p className="text-sm font-black uppercase italic tracking-tighter">
                    {selectedSheet.status === 'Approved' ? 'Approved' : selectedSheet.status === 'Paid' ? 'Paid' : 'Under Review'}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-6 p-4 bg-white/5 rounded-2xl text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Grand Total</span>
                  <span className="font-black text-white">{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Total Kas</span>
                  <span className="font-black text-blue-400">{formatCurrency(selectedSheet.totalKas)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                  <span className="text-slate-400 font-bold">Sisa</span>
                  <span className={`font-black ${selectedSheet.totalKas - grandTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(selectedSheet.totalKas - grandTotal)}
                  </span>
                </div>
                {selectedSheet.bank && (
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                    <span className="text-slate-400 font-bold">Bank</span>
                    <span className="font-black text-white">{selectedSheet.bank}</span>
                  </div>
                )}
              </div>

              {selectedSheet.status !== 'Approved' && selectedSheet.status !== 'Paid' && (
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <CheckCircle2 size={15} />}
                  Approve Ledger
                </button>
              )}
              {(selectedSheet.status === 'Approved' || selectedSheet.status === 'Paid') && (
                <div className="w-full py-3.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <CheckCircle2 size={15} /> Sudah Disetujui
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 italic">Audit Logs</h4>
              <div className="space-y-4">
                {[
                  { action: 'Sheet Created', user: 'System', time: '14:20' },
                  { action: 'Items Added (21 lines)', user: 'Aris S.', time: '15:10' },
                  { action: 'Proof Uploaded', user: 'Aris S.', time: '15:45' }
                ].map((log, i) => (
                  <div key={i} className="flex justify-between items-center text-[9px] font-bold uppercase">
                    <span className="text-slate-500 tracking-widest">{log.action}</span>
                    <span className="text-slate-900 italic">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Biaya Kerja Hub</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Operational Field Expenses & Digital Proofs</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
            <Download size={16} /> Bulk Export
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus size={16} /> New Working Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-110 transition-transform">
            <ImageIcon size={200} />
          </div>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 italic">Active Site Report</p>
          <h3 className="text-xl font-black italic text-white tracking-tighter uppercase mb-6 leading-tight">BK - PT AISAN DAIKI (FURNACE ALUMUNIUM)</h3>
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
              <span className="text-sm font-black italic text-blue-400">{formatCurrency(3822000)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sisa Kas</span>
              <span className="text-sm font-black italic text-emerald-400">{formatCurrency(124263)}</span>
            </div>
          </div>
          <button onClick={() => workingExpenseSheets[0] && handleOpenDetail(workingExpenseSheets[0])}
            className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
            Review Verification <ChevronRight size={14} />
          </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-[10px] font-black text-slate-900 uppercase italic tracking-widest">History Biaya Kerja</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input type="text" value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Search BK No / Client..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase italic text-black outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Identity</th>
                  <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Project & Location</th>
                  <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic text-right">Nominal</th>
                  <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic text-center">Status</th>
                  <th className="px-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {workingExpenseSheets.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-10 text-center text-[10px] text-slate-400 font-bold uppercase">Belum ada Biaya Kerja — buat sheet baru</td></tr>
                )}
                {workingExpenseSheets.filter(s => !listSearch || (s.noHal || '').toLowerCase().includes(listSearch.toLowerCase()) || (s.client || '').toLowerCase().includes(listSearch.toLowerCase()) || (s.project || '').toLowerCase().includes(listSearch.toLowerCase())).map(sheet => (
                  <tr key={sheet.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase italic block mb-1">{sheet.noHal}</span>
                      <span className="text-xs font-black text-slate-900 uppercase italic leading-none">{sheet.client}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase mt-1.5 block">{sheet.date}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black text-slate-700 uppercase italic leading-none block">{sheet.project}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-1">
                        <MapPin size={8} /> {sheet.location}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-black italic text-xs text-blue-600 text-right">
                      {formatCurrency(sheet.items.reduce((sum, i) => sum + i.nominal, 0))}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[8px] font-black uppercase italic tracking-widest">
                        {sheet.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button onClick={() => handleOpenDetail(sheet)}
                        className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Working Expense Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleCreateExpense}>
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-900">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">New Working Expense</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Create new operational site ledger</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 overflow-y-auto max-h-[70vh]">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Project Name</label>
                      <select required
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none text-slate-900"
                        value={newExpense.project}
                        onChange={e => setNewExpense({ ...newExpense, project: e.target.value })}>
                        <option value="">Select Project</option>
                        {projectList.map((p: any, i: number) => (
                          <option key={i} value={p.namaProject || p.name}>{p.namaProject || p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Document Ref (No. Hal)</label>
                      <input type="text" required placeholder="001/BK/GTP/II/2026"
                        value={newExpense.noHal} onChange={e => setNewExpense({ ...newExpense, noHal: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all text-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Client Name</label>
                      <input type="text" required placeholder="Nama client"
                        value={newExpense.client} onChange={e => setNewExpense({ ...newExpense, client: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all text-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Location</label>
                      <input type="text" required placeholder="Lokasi proyek"
                        value={newExpense.location} onChange={e => setNewExpense({ ...newExpense, location: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all text-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Document Date</label>
                      <input type="date" required
                        value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-blue-500 transition-all text-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Nominal Kas (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black italic text-slate-400 text-xs">Rp</span>
                        <input type="number" required placeholder="0"
                          value={newExpense.totalKas || ''} onChange={e => setNewExpense({ ...newExpense, totalKas: Number(e.target.value) })}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-blue-500 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Bank Sumber Dana</label>
                      <select
                        value={newExpense.bank}
                        onChange={e => setNewExpense({ ...newExpense, bank: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-blue-500 transition-all appearance-none">
                        {BANKS.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Keterangan</label>
                    <textarea
                      placeholder="Contoh: Biaya perjalanan survei lokasi proyek..."
                      rows={2}
                      value={newExpense.keterangan}
                      onChange={e => setNewExpense({ ...newExpense, keterangan: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-blue-500 transition-all resize-none" />
                  </div>

                  <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">Zero Re-typing Integration</h4>
                      <p className="text-[9px] text-blue-600 font-bold leading-relaxed">Setelah sheet dibuat, tambah baris pengeluaran dan upload foto bon langsung dari tabel.</p>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50 flex gap-4">
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3">
                    {isSubmitting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <ArrowUpRight size={18} />}
                    Create Ledger
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
    </div>
  );
}
