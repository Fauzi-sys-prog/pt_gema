import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { 
  CheckCircle2, 
  Truck, 
  MapPin, 
  Package, 
  User, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  ArrowLeft,
  Camera,
  PenTool,
  Send,
  Info,
  Navigation,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';

export default function DeliveryTrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { suratJalanList, updateSuratJalan } = useApp();
  const [sj, setSj] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [podData, setPodData] = useState({
    name: '',
    photo: '',
    signature: ''
  });

  useEffect(() => {
    const found = suratJalanList.find(s => s.id === id);
    if (found) {
      setSj(found);
      setPodData(prev => ({ ...prev, name: found.penerima || '' }));
    }
  }, [id, suratJalanList]);

  const handleConfirmDelivery = () => {
    if (!podData.name) {
      toast.error("Nama penerima harus diisi");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      updateSuratJalan(sj.id, {
        deliveryStatus: 'Delivered',
        podName: podData.name,
        podTime: new Date().toISOString(),
        podPhoto: 'https://images.unsplash.com/photo-1512428559083-a401c33c9f55?q=80&w=200&auto=format&fit=crop', // Mock photo
        podSignature: 'SIGNED'
      });
      
      setIsSubmitting(false);
      toast.success("Pengiriman Berhasil Dikonfirmasi!");
      navigate('/logistics/hub');
    }, 1500);
  };

  if (!sj) return <div className="p-10 text-center font-black italic uppercase">Loading Shipment Data...</div>;

  const isDelivered = sj.deliveryStatus === 'Delivered';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors text-[10px] font-black uppercase tracking-widest italic"
      >
        <ArrowLeft size={16} /> Back to Command Center
      </button>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
         {/* Tracking Header */}
         <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8">
               <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-widest border-2 ${
                 isDelivered ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse'
               }`}>
                  {sj.deliveryStatus || 'In Transit'}
               </div>
            </div>
            <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Truck size={24} className="text-white" />
               </div>
               <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tight">{sj.noSurat}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Shipment Tracking ID: {sj.id.slice(0, 8)}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
               <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-sm font-black italic uppercase truncate">{sj.tujuan}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Driver Info</p>
                  <p className="text-sm font-black italic uppercase truncate">{sj.sopir || 'Warehouse Fleet'}</p>
               </div>
            </div>
         </div>

         <div className="p-8 space-y-8">
            {/* Live Map ETA (New Feature) */}
            {!isDelivered && (
               <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden">
                  <div className="p-6 flex items-center justify-between border-b border-white">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                           <Navigation size={16} />
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Live Delivery ETA</p>
                           <p className="text-xs font-black text-slate-900 uppercase italic">14 Mins to Destination</p>
                        </div>
                     </div>
                     <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                        Open Maps <ExternalLink size={12} />
                     </button>
                  </div>
                  <div className="h-48 bg-slate-200 relative overflow-hidden flex items-center justify-center">
                     {/* Mock Map Background */}
                     <img 
                       src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=800&auto=format&fit=crop" 
                       className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale"
                       alt="Mock Map"
                     />
                     <div className="relative z-10 flex flex-col items-center">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl animate-bounce">
                           <Truck size={20} className="text-indigo-600" />
                        </div>
                        <div className="mt-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                           MOVING - 45 KM/H
                        </div>
                     </div>
                     {/* Route Line Visual */}
                     <div className="absolute top-1/2 left-0 w-full h-1 bg-dashed border-t-2 border-indigo-400/30 -rotate-12"></div>
                  </div>
               </div>
            )}

            {/* Batch Info */}
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                     <Package size={18} className="text-indigo-600" /> Loaded Material & Batches
                  </h3>
                  <span className="text-[9px] font-black text-emerald-500 uppercase italic tracking-widest flex items-center gap-1">
                     <ShieldCheck size={14} /> Batch Verified
                  </span>
               </div>
               <div className="space-y-3">
                  {sj.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                          <p className="text-xs font-black text-slate-900 uppercase italic">{item.namaItem}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Batch: {item.batchNo || 'GTP-B-2026-001'}</p>
                       </div>
                       <p className="text-sm font-black italic text-slate-900">{item.jumlah} <span className="text-[10px] uppercase">{item.satuan}</span></p>
                    </div>
                  ))}
               </div>
            </div>

            {/* Proof of Delivery Section */}
            {!isDelivered ? (
              <div className="space-y-6 pt-6 border-t border-slate-100">
                 <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" /> Confirm Delivery (e-POD)
                 </h3>
                 
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipient Name</label>
                       <input 
                         type="text" 
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-black uppercase italic outline-none focus:border-indigo-500/30 transition-all"
                         placeholder="Who is receiving the goods?"
                         value={podData.name}
                         onChange={(e) => setPodData(prev => ({ ...prev, name: e.target.value }))}
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group">
                          <Camera className="text-slate-300 group-hover:text-indigo-600 mb-2" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capture Photo</span>
                       </button>
                       <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group">
                          <PenTool className="text-slate-300 group-hover:text-emerald-600 mb-2" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Draw Signature</span>
                       </button>
                    </div>

                    <button 
                      onClick={handleConfirmDelivery}
                      disabled={isSubmitting}
                      className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all ${
                        isSubmitting ? 'bg-slate-400 text-white' : 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700'
                      }`}
                    >
                       {isSubmitting ? 'Processing Ledger Update...' : 'Confirm Delivered & Sync P&L'}
                       {!isSubmitting && <Send size={18} />}
                    </button>
                 </div>
              </div>
            ) : (
              <div className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-3xl space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                       <ShieldCheck size={28} />
                    </div>
                    <div>
                       <h4 className="text-sm font-black text-slate-900 uppercase italic">Delivery Successful</h4>
                       <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Ledger Proof Synchronized</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Receiver</p>
                       <p className="text-xs font-black text-slate-900 uppercase italic">{sj.podName}</p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-emerald-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Delivered At</p>
                       <p className="text-xs font-black text-slate-900 uppercase italic">
                          {new Date(sj.podTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                 </div>

                 <div className="flex gap-4">
                    <button className="flex-1 py-4 bg-white text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                       View POD Archive
                    </button>
                    <button className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                       Send Customer Receipt
                    </button>
                 </div>
              </div>
            )}
         </div>

         <div className="p-6 bg-slate-50 flex items-center gap-3">
            <Info size={16} className="text-slate-400" />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-relaxed">
               All delivery data is encrypted and cross-referenced with PT GTP's Batch Ledger for quality assurance and traceability compliance.
            </p>
         </div>
      </div>
    </div>
  );
}
