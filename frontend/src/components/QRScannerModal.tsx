import React, { useState, useEffect } from 'react';
import { X, Maximize, Zap, Camera, Search, CheckCircle2, AlertCircle, Package, ArrowRight } from 'lucide-react'; import { motion, AnimatePresence } from 'motion/react'; import { useApp } from '../contexts/AppContext';
import type { StockItem } from '../contexts/AppContext';
import { toast } from 'sonner@2.0.3';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (item: StockItem) => void;
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const { stockItemList } = useApp();
  const [scanResult, setScanResult] = useState<StockItem | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const handleSimulateScan = () => {
    if (!stockItemList.length) {
      toast.error('Data stock kosong. Isi stock item dulu dari backend.');
      return;
    }

    setIsScanning(true);

    // Fallback deterministic scan: pick lowest-stock item first.
    const sorted = [...stockItemList].sort((a, b) => (a.stok - a.minStock) - (b.stok - b.minStock));
    const detected = sorted[0];
    setScanResult(detected);
    setIsScanning(false);
    toast.success(`Item detected: ${detected.nama}`);
  };

  const handleManualSearch = () => {
    const item = stockItemList.find(s => s.kode.toLowerCase() === manualCode.toLowerCase());
    if (item) {
      setScanResult(item);
      toast.success(`Item found: ${item.nama}`);
    } else {
      toast.error('Item code not found');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setScanResult(null);
      setIsScanning(false);
      setManualCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
              <Maximize size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">QR Intelligence Scan</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Warehouse Entry Point • GTP-SECURE</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {!scanResult ? (
            <div className="space-y-8">
              {/* Scan Viewport */}
              <div className="relative aspect-square w-full max-w-[300px] mx-auto bg-slate-900 rounded-[2.5rem] overflow-hidden group">
                {isScanning ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="text-blue-500 animate-pulse" size={32} />
                      </div>
                    </div>
                    <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] italic animate-pulse">Analyzing Pattern...</p>
                    <p className="text-[10px] text-white/50 font-bold uppercase mt-2">Connecting to Ledger Database</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {/* Corners */}
                    <div className="absolute top-10 left-10 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl" />
                    <div className="absolute top-10 right-10 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl" />
                    <div className="absolute bottom-10 left-10 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl" />
                    <div className="absolute bottom-10 right-10 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-2xl" />
                    
                    <Camera size={48} className="text-white/20 group-hover:scale-110 transition-transform duration-500" />
                    <button 
                      onClick={handleSimulateScan}
                      className="mt-8 px-8 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl"
                    >
                      Initialize Camera
                    </button>
                  </div>
                )}
                {/* Scan Line */}
                {isScanning && (
                  <motion.div 
                    animate={{ top: ['10%', '90%', '10%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.8)] z-10"
                  />
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase bg-white px-4 text-slate-300 tracking-widest italic">
                  Atau Input Manual
                </div>
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Masukkan Kode SKU..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
                <button 
                  onClick={handleManualSearch}
                  className="px-8 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                >
                  Lookup
                </button>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-200">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{scanResult.nama}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">{scanResult.kode}</p>
                
                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                  <div className="bg-white p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock On Hand</p>
                    <p className="text-xl font-black italic text-emerald-600">{scanResult.stok} {scanResult.satuan}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Min Stock</p>
                    <p className="text-xl font-black italic text-slate-900">{scanResult.minStock} {scanResult.satuan}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 shadow-sm">
                      <Package size={20} />
                   </div>
                   <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Storage Location</p>
                     <p className="text-sm font-black text-slate-900 uppercase italic">{scanResult.lokasi}</p>
                   </div>
                 </div>
                 <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${scanResult.stok <= scanResult.minStock ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min((scanResult.stok / (scanResult.minStock * 2)) * 100, 100)}%` }}
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    if (onScanSuccess) onScanSuccess(scanResult);
                    onClose();
                  }}
                  className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95"
                >
                  Buka Warehouse Ledger <ArrowRight size={18} />
                </button>
                <button 
                  onClick={() => setScanResult(null)}
                  className="w-full py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-all"
                >
                  Scan Item Lain
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-6 bg-slate-900 text-center">
           <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.3em]">
             Authorized for Executive & Warehouse Manager Only
           </p>
        </div>
      </motion.div>
    </div>
  );
}
