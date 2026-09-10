import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle, Package, Link as LinkIcon, TrendingUp, Printer, Camera, Upload, Trash2, FileCheck, ShieldCheck, X, AlertTriangle, Warehouse } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useLocation, useNavigate } from 'react-router';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { generateDocNumber } from '../../utils/docEngine';
import { motion } from 'motion/react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ReceivingItem {
  id: string;
  itemKode?: string; 
  itemName: string;
  qtyOrdered: number;
  qtyReceived: number; 
  qtyGood: number;     
  qtyDamaged: number;  
  qtyPreviouslyReceived: number; 
  unit: string;
  condition: 'Good' | 'Damaged' | 'Partial';
  batchNo: string;
  expiryDate?: string;
  photoUrl?: string;
  notes?: string;
}

interface Receiving {
  id: string;
  noReceiving: string;
  noSuratJalan: string;
  fotoSuratJalan?: string;
  tanggal: string;
  noPO: string;
  poId: string;
  supplier: string;
  project: string;
  projectId?: string;
  status: 'Pending' | 'Partial' | 'Complete' | 'Rejected';
  lokasiGudang?: string;
  items: ReceivingItem[];
}

interface LocationState {
  fromPO?: boolean;
  poId?: string;
  poNo?: string;
  supplier?: string;
  projectId?: string;
  items?: Array<{
    kode?: string;
    nama: string;
    qty: number;
    unit: string;
    harga: number;
    qtyReceived?: number;
  }>;
}

export default function ReceivingPage() {
  const {
    poList,
    projectList,
    receivingList,
    addReceiving,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LocationState | null;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReceiving, setSelectedReceiving] = useState<Receiving | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    noPO: '',
    poId: '',
    noSuratJalan: '',
    fotoSuratJalan: '',
    supplier: '',
    projectId: '',
    lokasiGudang: 'Gudang Utama',
    tanggal: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<ReceivingItem[]>([]);
  const fotoSJRef = useRef<HTMLInputElement>(null);

  const handleFotoSJUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setFormData(prev => ({ ...prev, fotoSuratJalan: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePrintGRN = (rcv: Receiving) => {
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    const rows = (rcv.items || []).map((item: any, i: number) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0">${item.itemName || item.nama || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.qtyOrdered || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.qtyReceived || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.qtyGood ?? item.qtyReceived ?? '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.qtyDamaged || 0}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.unit || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${item.batchNo || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0">${item.condition === 'Damaged' ? '⚠ Rusak' : item.condition === 'Partial' ? '~ Sebagian' : '✓ Baik'}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>GRN ${rcv.noReceiving}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}td{font-size:12px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1e293b}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin-bottom:20px;font-size:12px}.meta span{color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;display:block}.footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;text-align:center;font-size:11px}@media print{button{display:none}}</style>
      </head><body>
      <div class="header">
        <div><div style="font-size:22px;font-weight:900;letter-spacing:-.02em">GOODS RECEIPT NOTE</div>
          <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-top:2px">PT Gema Teknik Perkasa</div></div>
        <div style="text-align:right"><div style="font-size:13px;font-weight:700">${rcv.noReceiving}</div>
          <div style="color:#64748b;font-size:11px">${rcv.tanggal}</div></div>
      </div>
      <div class="meta">
        <div><span>No. PO</span>${rcv.noPO || '-'}</div>
        <div><span>No. Surat Jalan</span>${rcv.noSuratJalan || '-'}</div>
        <div><span>Supplier</span>${rcv.supplier || '-'}</div>
        <div><span>Gudang Tujuan</span>${(rcv as any).lokasiGudang || 'Gudang Utama'}</div>
      </div>
      <table><thead><tr><th style="width:32px">No</th><th>Material</th><th>Order</th><th>Terima</th><th>Baik</th><th>Rusak</th><th>Satuan</th><th>Batch</th><th>Kondisi</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">
        <div style="border-top:1px solid #cbd5e1;padding-top:8px;margin-top:64px">Penerima Barang<br><br><br>(_____________)</div>
        <div style="border-top:1px solid #cbd5e1;padding-top:8px;margin-top:64px">QC / Inspector<br><br><br>(_____________)</div>
        <div style="border-top:1px solid #cbd5e1;padding-top:8px;margin-top:64px">Admin Gudang<br><br><br>(_____________)</div>
      </div>
      <div style="margin-top:32px;text-align:center"><button onclick="window.print()" style="padding:10px 28px;background:#1e293b;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px">🖨 Cetak GRN</button></div>
      </body></html>`);
    win.document.close();
  };

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
    { condition: !!previewImage, close: () => setPreviewImage(null) },
  ]);


  const handleAutoGenerateBatch = (index: number) => {
    const dateStr = formData.tanggal.replace(/-/g, '');
    const newBatch = `BCH-${dateStr}-${String(index + 1).padStart(3, '0')}`;
    const newItems = [...items];
    newItems[index].batchNo = newBatch;
    setItems(newItems);
  };

  const handleAutoGenerateAllBatch = () => {
    const dateStr = formData.tanggal.replace(/-/g, '');
    const newItems = items.map((item, index) => ({
      ...item,
      batchNo: item.batchNo === '-' || !item.batchNo ? `BCH-${dateStr}-${String(index + 1).padStart(3, '0')}` : item.batchNo
    }));
    setItems(newItems);
  };

  useEffect(() => {
    if (locationState?.fromPO && locationState?.items) {
      setFormData({
        noPO: locationState.poNo || '',
        poId: locationState.poId || '',
        supplier: locationState.supplier || '',
        projectId: locationState.projectId || '',
        tanggal: new Date().toISOString().split('T')[0],
        notes: `Receiving untuk PO ${locationState.poNo}`,
        noSuratJalan: '',
        fotoSuratJalan: '',
        lokasiGudang: 'Gudang Utama'
      });

      const receivingItems: ReceivingItem[] = locationState.items.map((item, index) => ({
        id: `item-${index + 1}`,
        itemKode: item.kode,
        itemName: item.nama,
        qtyOrdered: item.qty,
        qtyReceived: 0,
        qtyGood: 0,
        qtyDamaged: 0,
        qtyPreviouslyReceived: item.qtyReceived || 0,
        unit: item.unit,
        condition: 'Good' as const,
        batchNo: '-',
        notes: '',
      }));

      setItems(receivingItems);
      setShowModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [locationState]);

  useEffect(() => {
    if (formData.poId && !formData.noPO) {
      const po = poList.find(p => p.id === formData.poId);
      if (po) {
        setFormData(prev => ({ ...prev, noPO: po.noPO, supplier: po.supplier, projectId: po.projectId || '' }));
      }
    }
  }, [formData.poId, poList]);

  const resetForm = () => {
    setFormData({
      noPO: '',
      poId: '',
      noSuratJalan: '',
      fotoSuratJalan: '',
      supplier: '',
      projectId: '',
      lokasiGudang: 'Gudang Utama',
      tanggal: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setItems([]);
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!formData.poId || items.length === 0) return;
    if (!formData.noSuratJalan) {
      toast.error('Mohon masukkan Nomor Surat Jalan (SJ) dari Vendor');
      return;
    }
    setIsSubmitting(true);

    const totalQtyOrdered = items.reduce((sum, item) => sum + item.qtyOrdered, 0);
    const totalQtyReceived = items.reduce((sum, item) => sum + item.qtyReceived + item.qtyPreviouslyReceived, 0);
    const receivedPercentage = (totalQtyReceived / totalQtyOrdered) * 100;

    let status: 'Pending' | 'Partial' | 'Complete' = 'Pending';
    if (receivedPercentage === 0) status = 'Pending';
    else if (receivedPercentage >= 100) status = 'Complete';
    else status = 'Partial';

    const newNo = generateDocNumber('GRN', receivingList.length + 1);

    const newReceiving: Receiving = {
      id: `RCV-${Date.now()}`,
      noReceiving: newNo,
      noSuratJalan: formData.noSuratJalan,
      fotoSuratJalan: formData.fotoSuratJalan,
      tanggal: formData.tanggal,
      noPO: formData.noPO || poList.find(p => p.id === formData.poId)?.noPO || 'PO-REF',
      poId: formData.poId,
      supplier: formData.supplier,
      project: projectList.find(p => p.id === formData.projectId)?.namaProject || 'General',
      projectId: formData.projectId,
      lokasiGudang: formData.lokasiGudang,
      status,
      items,
    };

    // Receiving hanya mencatat penerimaan dan memperbarui progress PO.
    // Stock In dibuat terpisah setelah gudang memilih dokumen Receiving.
    try {
      addReceiving(newReceiving as any);

      // Backend menyimpan Receiving, progres PO, dan draft expense dalam satu
      // transaksi. Stock In tetap dibuat terpisah setelah verifikasi gudang.
      if (status === 'Complete' || status === 'Partial') {
        toast.success(`Receiving ${newNo} ${status === 'Complete' ? 'selesai' : 'partial'}`, {
          description: 'Draft expense sudah dibuat. Buat Stock In dari dokumen Receiving setelah verifikasi gudang.',
          action: { label: 'Buat Stock In', onClick: () => navigate('/inventory/stock-in') },
          duration: 6000,
        });
      } else {
        toast.success(`Receiving ${newNo} disimpan`, {
          description: 'Buat Stock In dari dokumen Receiving setelah verifikasi gudang.',
          action: { label: 'Buat Stock In', onClick: () => navigate('/inventory/stock-in') },
          duration: 6000,
        });
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error('Receiving gagal disimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    // Backend lama pernah mengirim "Completed"; normalisasi agar filter/status konsisten.
    if (status === 'Completed') status = 'Complete';
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Partial': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Complete': return 'bg-green-100 text-green-700 border-green-300';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const calculateProgress = (receiving: Receiving) => {
    const totalOrdered = receiving.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
    const totalReceived = receiving.items.reduce((sum, item) => sum + item.qtyReceived, 0);
    return totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  };

  const filteredReceiving = receivingList.filter((rcv) => {
    const matchesSearch =
      rcv.noReceiving.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rcv.noPO.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rcv.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || rcv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statsData = {
    total: receivingList.length,
    pending: receivingList.filter(r => r.status === 'Pending').length,
    partial: receivingList.filter(r => r.status === 'Partial').length,
    complete: receivingList.filter(r => r.status === 'Complete').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Receiving Barang</h1>
        <button
          onClick={() => navigate('/inventory/center')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm"
        >
          <Warehouse size={16} /> Monitoring Gudang
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="text-[10px] font-black italic text-gray-500 uppercase tracking-widest mb-1">Total Receiving</div>
          <div className="text-2xl font-black italic tracking-tighter text-gray-900">{statsData.total}</div>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="text-[10px] font-black italic text-gray-500 uppercase tracking-widest mb-1">Pending</div>
          <div className="text-2xl font-black italic tracking-tighter text-yellow-600">{statsData.pending}</div>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="text-[10px] font-black italic text-gray-500 uppercase tracking-widest mb-1">Partial</div>
          <div className="text-2xl font-black italic tracking-tighter text-blue-600">{statsData.partial}</div>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="text-[10px] font-black italic text-gray-500 uppercase tracking-widest mb-1">Complete</div>
          <div className="text-2xl font-black italic tracking-tighter text-green-600">{statsData.complete}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari nomor receiving, PO, atau supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Complete">Complete</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 font-bold"
        >
          <Plus size={20} />
          Tambah Receiving
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 text-white uppercase italic text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-6 py-4 text-left">No. Receiving / Tgl</th>
                <th className="px-6 py-4 text-left">No. PO Ref</th>
                <th className="px-6 py-4 text-left">No. Surat Jalan</th>
                <th className="px-6 py-4 text-left">Supplier</th>
                <th className="px-6 py-4 text-center">Items Progress</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReceiving.map((receiving) => {
                const progress = calculateProgress(receiving);
                return (
                  <tr key={receiving.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{receiving.noReceiving}</div>
                      <div className="text-xs text-gray-500">{new Date(receiving.tanggal).toLocaleDateString('id-ID')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate('/purchasing/purchase-order', { state: { highlightPO: receiving.poId } })}
                        className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <LinkIcon size={14} /> {receiving.noPO}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">{receiving.noSuratJalan || '-'}</span>
                        {receiving.fotoSuratJalan && (
                          <button onClick={() => setPreviewImage({ url: receiving.fotoSuratJalan!, title: `Surat Jalan: ${receiving.noSuratJalan}` })} className="p-1 bg-slate-50 text-slate-500 rounded border border-slate-200" title="Lihat Foto SJ"><Camera size={14} /></button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{receiving.supplier}</div>
                      <div className="text-xs text-gray-500 italic">{receiving.project}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 italic">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-[10px] font-black uppercase rounded-full border ${getStatusColor(receiving.status)}`}>
                        {receiving.status === 'Completed' ? 'Complete' : receiving.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => { setSelectedReceiving(receiving); setShowDetailModal(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Eye size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Tambah Receiving Baru</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Konfirmasi Fisik Barang Datang</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-rose-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black italic text-gray-700 mb-2 uppercase tracking-widest">No. PO <span className="text-red-500">*</span></label>
                  {formData.poId ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 border-2 border-indigo-100 rounded-2xl bg-indigo-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <LinkIcon size={18} className="text-indigo-600" />
                          <span className="font-black italic text-indigo-900 uppercase">{formData.noPO || poList.find(p => p.id === formData.poId)?.noPO || 'Linked PO'}</span>
                        </div>
                        <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black italic uppercase rounded-lg">Connected</div>
                      </div>
                      <button onClick={() => setFormData({...formData, poId: '', noPO: ''})} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100" title="Ganti PO"><X size={18} /></button>
                    </div>
                  ) : (
                    <select
                      value={formData.poId}
                      onChange={(e) => {
                        const po = poList.find(p => p.id === e.target.value);
                        if (po) {
                          setFormData({ ...formData, poId: po.id, noPO: po.noPO, supplier: po.supplier, projectId: po.projectId || '' });
                          setItems(po.items.map((item, index) => ({
                            id: `item-${index + 1}`,
                            itemKode: item.kode,
                            itemName: item.nama,
                            qtyOrdered: item.qty,
                            qtyReceived: 0,
                            qtyGood: 0,
                            qtyDamaged: 0,
                            qtyPreviouslyReceived: item.qtyReceived || 0,
                            unit: item.unit,
                            condition: 'Good' as const,
                            batchNo: '-',
                            notes: '',
                          })));
                        }
                      }}
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-black italic uppercase tracking-tighter focus:border-indigo-500 outline-none"
                      required
                    >
                      <option value="">-- Pilih Purchase Order --</option>
                      {poList.filter(po => ['Sent', 'Partial', 'Approved'].includes(po.status)).map(po => (
                        <option key={po.id} value={po.id}>{po.noPO} - {po.supplier}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black italic text-gray-700 mb-2 uppercase tracking-widest">No. Surat Jalan Vendor <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.noSuratJalan} onChange={(e) => setFormData({ ...formData, noSuratJalan: e.target.value })} placeholder="SJ-..." className="flex-1 px-4 py-3 border-2 border-slate-100 rounded-2xl font-black italic uppercase tracking-tighter text-black focus:border-indigo-500 outline-none" required />
                    <input ref={fotoSJRef} type="file" accept="image/*" className="hidden" onChange={handleFotoSJUpload} />
                    {formData.fotoSuratJalan ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setPreviewImage({ url: formData.fotoSuratJalan, title: 'Foto Surat Jalan' })}
                          className="px-3 py-3 rounded-2xl border-2 bg-emerald-50 border-emerald-200 text-emerald-600 flex items-center gap-1.5">
                          <CheckCircle size={16} /><span className="text-[10px] font-black uppercase">Lihat</span>
                        </button>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, fotoSuratJalan: '' }))}
                          className="px-3 py-3 rounded-2xl border-2 bg-rose-50 border-rose-200 text-rose-500 flex items-center">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fotoSJRef.current?.click()}
                        className="px-4 py-3 rounded-2xl border-2 bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center gap-2">
                        <Camera size={18} /><span className="text-[10px] font-black uppercase">Foto SJ</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black italic text-gray-700 mb-2 uppercase tracking-widest">Tanggal Receiving <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.tanggal} onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })} className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-black italic text-black focus:border-indigo-500 outline-none" required />
                </div>

                <div>
                  <label className="block text-[10px] font-black italic text-gray-700 mb-2 uppercase tracking-widest">Terima ke Gudang <span className="text-red-500">*</span></label>
                  <select value={formData.lokasiGudang} onChange={(e) => setFormData({ ...formData, lokasiGudang: e.target.value })} className="w-full px-4 py-3 border-2 border-indigo-100 bg-indigo-50 text-indigo-700 rounded-2xl font-black italic uppercase tracking-tighter outline-none" required>
                    <option value="Gudang Utama">Gudang Utama</option>
                    <option value="Workshop GTP">Workshop GTP</option>
                  </select>
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2"><Package size={20} className="text-indigo-600" /> Daftar Barang</h3>
                    <button type="button" onClick={handleAutoGenerateAllBatch} className="text-[10px] font-black italic uppercase text-purple-600 bg-purple-50 px-4 py-2 rounded-xl border border-purple-100 hover:bg-purple-100 transition-all">Auto-fill Batch No</button>
                  </div>
                  <div className="border-2 border-slate-50 rounded-[32px] overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-50 border-b-2 border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Material</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest">Ordered</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest">Qty Recv</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-rose-600">Rusak</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Batch/Lot</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Expiry</th>
                        </tr>
                      </thead>
                      {items.map((item, index) => (
                        <tbody key={item.id} className="divide-y-2 divide-slate-50 border-b-2 last:border-0">
                          <tr>
                            <td className="px-6 py-4">
                              <div className="text-sm font-black italic uppercase text-slate-900">{item.itemName}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.itemKode} • {item.unit}</div>
                            </td>
                            <td className="px-6 py-4 text-center text-sm font-bold text-slate-400">{item.qtyOrdered}</td>
                            <td className="px-6 py-4 text-center">
                              <input type="number" value={item.qtyReceived} onChange={(e) => {
                                const val = Number(e.target.value);
                                const newItems = [...items];
                                newItems[index].qtyReceived = val;
                                newItems[index].qtyGood = val - newItems[index].qtyDamaged;
                                setItems(newItems);
                              }} className="w-20 px-3 py-2 border-2 border-slate-100 rounded-xl text-center font-black italic focus:border-indigo-500 outline-none transition-all" />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input type="number" value={item.qtyDamaged} onChange={(e) => {
                                const val = Number(e.target.value);
                                const newItems = [...items];
                                newItems[index].qtyDamaged = val;
                                newItems[index].qtyGood = newItems[index].qtyReceived - val;
                                setItems(newItems);
                              }} className="w-20 px-3 py-2 border-2 border-slate-100 rounded-xl text-center font-black italic focus:border-rose-500 text-rose-600 outline-none transition-all" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <input type="text" value={item.batchNo} onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].batchNo = e.target.value;
                                  setItems(newItems);
                                }} placeholder="BCH-..." className="flex-1 px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-black italic focus:border-indigo-500 outline-none transition-all" />
                                <button type="button" onClick={() => handleAutoGenerateBatch(index)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-100"><LinkIcon size={14} /></button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <input type="date" value={item.expiryDate} onChange={(e) => {
                                const newItems = [...items];
                                newItems[index].expiryDate = e.target.value;
                                setItems(newItems);
                              }} className="px-3 py-2 border-2 border-slate-100 rounded-xl text-xs font-black italic focus:border-indigo-500 outline-none transition-all" />
                            </td>
                          </tr>
                          {item.qtyDamaged > 0 && (
                            <tr className="bg-rose-50/30">
                              <td colSpan={6} className="px-6 py-3">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase">
                                    <AlertTriangle size={14} /> Keterangan Kerusakan:
                                  </div>
                                  <input 
                                    type="text" 
                                    value={item.notes} 
                                    onChange={(e) => {
                                      const newItems = [...items];
                                      newItems[index].notes = e.target.value;
                                      setItems(newItems);
                                    }}
                                    placeholder="Contoh: Dus sobek, material basah, dll..." 
                                    className="flex-1 bg-white border-none rounded-lg px-4 py-1.5 text-xs font-bold text-rose-900 placeholder:text-rose-300 focus:ring-2 focus:ring-rose-200 outline-none"
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t bg-slate-50 flex justify-end gap-4 rounded-b-3xl">
              <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="px-8 py-4 font-black uppercase text-[10px] text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Menyimpan...' : 'Simpan Receiving'}</button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedReceiving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                  <FileCheck size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tighter">Detail Receiving</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedReceiving.noReceiving} • {selectedReceiving.tanggal}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-rose-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Supplier</p>
                  <p className="text-sm font-black italic uppercase text-slate-900">{selectedReceiving.supplier}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Project</p>
                  <p className="text-sm font-black italic uppercase text-slate-900">{selectedReceiving.project}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. PO Ref</p>
                  <p className="text-sm font-black italic uppercase text-indigo-600 underline cursor-pointer" onClick={() => navigate('/purchasing/purchase-order', { state: { highlightPO: selectedReceiving.poId } })}>{selectedReceiving.noPO}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Surat Jalan</p>
                  <p className="text-sm font-black italic uppercase text-slate-900">{selectedReceiving.noSuratJalan}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 italic">Material Received Content</h3>
                <div className="space-y-3">
                  {selectedReceiving.items.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black italic text-xs border border-slate-100">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase italic text-slate-900">{item.itemName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.itemKode} • Batch: {item.batchNo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kondisi</p>
                          <span className={`text-[10px] font-black uppercase italic ${item.qtyDamaged > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {item.qtyDamaged > 0 ? `${item.qtyGood} Good / ${item.qtyDamaged} Damaged` : 'All Good'}
                          </span>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Qty</p>
                          <p className="text-sm font-black italic text-slate-900">{item.qtyReceived} {item.unit}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReceiving.fotoSuratJalan && (
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 italic">Evidence Documents</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div 
                      onClick={() => setPreviewImage({ url: selectedReceiving.fotoSuratJalan!, title: `Surat Jalan: ${selectedReceiving.noSuratJalan}` })}
                      className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200 cursor-zoom-in relative group"
                    >
                      <img src={selectedReceiving.fotoSuratJalan} alt="Surat Jalan" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t bg-slate-50 flex justify-between items-center rounded-b-3xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={18} />
                <span className="text-[10px] font-black uppercase italic text-slate-400">Inventory Sync Completed • Ledger ID: {selectedReceiving.id}</span>
              </div>
              <button onClick={() => handlePrintGRN(selectedReceiving)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-2">
                <Printer size={16} /> Print GRN
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-10" onClick={() => setPreviewImage(null)}>
          <div className="absolute top-10 right-10 flex flex-col items-center gap-2">
            <button onClick={() => setPreviewImage(null)} className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"><X size={32} /></button>
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Close Esc</span>
          </div>
          <div className="max-w-5xl w-full flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
            <img src={previewImage.url} alt={previewImage.title} className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border-4 border-white/10" />
            <h3 className="text-white font-black italic uppercase tracking-widest text-lg">{previewImage.title}</h3>
          </div>
        </div>
      )}
    </div>
  );
}
