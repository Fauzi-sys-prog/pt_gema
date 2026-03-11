import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; import { ArrowLeft, Plus, AlertCircle, CheckCircle2, Box, Hammer, Info, X, Lock, Play, Database } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

export default function BOMVerificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workOrderList, stockItemList, updateWorkOrder } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [serverWorkOrders, setServerWorkOrders] = useState<any[]>([]);
  const [serverStockItems, setServerStockItems] = useState<any[]>([]);

  const fetchBomData = async (silent = true) => {
    setSyncing(true);
    try {
      const [woRes, stockRes] = await Promise.all([
        api.get('/work-orders'),
        api.get<any[]>('/inventory/items'),
      ]);
      setServerWorkOrders(Array.isArray(woRes.data) ? woRes.data : []);
      setServerStockItems((stockRes.data || []).map((r) => ({ id: r.entityId, ...(r.payload || {}) })));
      if (!silent) toast.success('BOM verification data refreshed');
    } catch {
      if (!silent) toast.error('Gagal refresh BOM verification');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchBomData(true);
  }, []);

  const effectiveWorkOrders = serverWorkOrders.length > 0 ? serverWorkOrders : workOrderList;
  const effectiveStockItems = serverStockItems.length > 0 ? serverStockItems : stockItemList;

  const wo = useMemo(() => {
    return effectiveWorkOrders.find(w => w.id === id || w.woNumber === id);
  }, [effectiveWorkOrders, id]);

  // Simulasi data BOM dari gambar jika tidak ada di context
  const bomItems = useMemo(() => {
    if (wo?.bom && wo.bom.length > 0) return wo.bom;
    return [
      { kode: 'PLT-01', nama: 'Plate Cutting', qty: 100, unit: 'PCS' },
      { kode: 'BND-01', nama: 'Bending Service', qty: 50, unit: 'PCS' }
    ];
  }, [wo]);

  // Logika Conflict Awareness: Cek apakah kode di BOM ada di Master Stock
  const verificationResults = useMemo(() => {
    return bomItems.map(item => {
      const itemCode = String(item?.kode || '').trim().toLowerCase();
      const itemName = String(item?.nama || item?.materialName || '').trim().toLowerCase();
      const match = effectiveStockItems.find((s) => {
        const code = String(s?.kode || '').trim().toLowerCase();
        const name = String(s?.nama || '').trim().toLowerCase();
        return (itemCode && code === itemCode) || (itemName && name === itemName);
      });
      const stockFound = match ? Number(match.stok || 0) : null;
      const enough = stockFound !== null && stockFound >= Number(item?.qty || 0);
      return {
        ...item,
        stockFound,
        isConflict: !match,
        enough,
      };
    });
  }, [bomItems, effectiveStockItems]);

  const allClear = verificationResults.every(v => v.enough);

  if (!wo) return <div className="p-10 text-center">Work Order Not Found</div>;

  const handleStartProduction = async () => {
    if (!allClear) {
      toast.error("Gagal Memulai: Identitas Material Tidak Ditemukan!", {
        description: "Harap pastikan SKU di Gudang sama dengan SKU di BOM."
      });
      return;
    }
    try {
      await updateWorkOrder(wo.id, { status: 'In Progress' });
      toast.success("Produksi Dimulai", { description: "Material Issuance otomatis dicatat di Kartu Stok." });
      navigate('/produksi/dashboard');
    } catch {
      // toast handled in context
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10">
      {/* Header Context GTP */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-16 h-16 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
          <div className="text-center leading-none">
            <span className="text-red-600 font-black text-xl block">GM</span>
            <span className="text-slate-900 font-bold text-[8px] uppercase tracking-tighter">Teknik</span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">GM TEKNIK</h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Dashboard System</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Panel: Verification Table */}
        <div className="lg:col-span-8 bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-10 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                <ArrowLeft size={24} className="text-slate-400" />
              </button>
              <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Verification BOM</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {wo.woNumber} - {wo.itemToProduce}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchBomData(false)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              <Plus size={16} /> {syncing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>

          <div className="p-10">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="pb-6">Material Kode & Nama</th>
                  <th className="pb-6 text-center">Butuh (Qty)</th>
                  <th className="pb-6 text-center">Stok Saat Ini</th>
                  <th className="pb-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {verificationResults.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-8">
                      <p className="font-black text-slate-900 uppercase italic">{item.nama}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{item.kode}</p>
                    </td>
                    <td className="py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl font-black text-indigo-600 italic">{item.qty}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span>
                      </div>
                    </td>
                    <td className="py-8 text-center">
                      {item.isConflict ? (
                        <span className="text-sm font-black text-amber-600 uppercase italic">Need Procurement</span>
                      ) : !item.enough ? (
                        <span className="text-sm font-black text-amber-600 uppercase italic">Stok Kurang</span>
                      ) : (
                        <span className="text-sm font-black text-slate-900 italic">{item.stockFound} {item.unit}</span>
                      )}
                    </td>
                    <td className="py-8 text-center">
                      <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center border-2 ${item.enough ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                        {item.enough ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Blue Info Box */}
            <div className="mt-12 bg-blue-50 border-2 border-blue-100 rounded-3xl p-8 flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                <Database size={24} />
              </div>
              <div>
                <h4 className="font-black text-blue-900 uppercase italic text-sm tracking-tight mb-2">SINKRONISASI REAL-TIME INVENTORY</h4>
                <p className="text-blue-700/70 text-xs font-bold leading-relaxed">
                  Dengan mengklik "Mulai Produksi", sistem akan otomatis melakukan **Inventory Issuance**. Stok akan berkurang seketika dan tercatat dalam Kartu Stok sebagai pengeluaran untuk produksi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Summary & Locked Action */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0F172A] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Hammer size={120} />
            </div>
            
            <h3 className="text-xl font-black uppercase italic tracking-tighter border-b border-white/10 pb-6 mb-8">
              Ringkasan <br /> Produksi
            </h3>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Produksi</span>
                <span className="text-sm font-black italic">{wo.itemToProduce}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Tech</span>
                <span className="text-sm font-black italic">{wo.leadTechnician}</span>
              </div>
            </div>

            <div className="mt-12 space-y-4">
              <button 
                onClick={handleStartProduction}
                disabled={!allClear}
                className={`w-full py-6 rounded-3xl flex items-center justify-center gap-3 transition-all ${
                  allClear 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20' 
                    : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'
                }`}
              >
                {allClear ? <Play size={20} /> : <Lock size={20} />}
                <span className="text-xs font-black uppercase tracking-widest">Mulai Produksi Sekarang</span>
              </button>

              {!allClear && (
                <div className="text-center space-y-4 pt-4">
                  <p className="text-[10px] font-black text-rose-400 uppercase italic tracking-tighter leading-relaxed">
                    TOMBOL TERKUNCI:<br />
                    HARAP PENUHI KEBUTUHAN MATERIAL DI GUDANG TERLEBIH DAHULU.
                  </p>
                  <div className="h-px bg-white/5 w-full" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                    Pesan Kesalahan: SKU Tidak Sinkron
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[40px] p-8">
             <div className="flex items-center gap-3 mb-4">
                <Info size={18} className="text-indigo-600" />
                <h5 className="font-black text-slate-900 uppercase italic text-xs tracking-tight">Tips Ledger</h5>
             </div>
             <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                Prinsip **"Sama Sama Saman"** mewajibkan Kode SKU di dokumen penawaran/BOM identik dengan Kode SKU di rak gudang. Bapak bisa mengubah SKU di Master Data atau mendaftarkan barang baru dengan kode `PLT-01`.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
