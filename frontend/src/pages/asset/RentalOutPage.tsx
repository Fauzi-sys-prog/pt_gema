import React, { useEffect, useState, useMemo } from 'react';
import { ArrowUpRight, Truck, Search, Plus, X, DollarSign, User, MapPin, Calendar, ShieldCheck, Building, ChevronRight, TrendingUp, HandCoins } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { Asset } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';

export default function RentalOutPage() {
  const { assetList, updateAsset, addAuditLog } = useApp();
  const [serverAssetList, setServerAssetList] = useState<Asset[] | null>(null);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rentalForm, setRentalForm] = useState({
    assetId: '',
    customerName: '',
    rentalPrice: 0,
    location: '',
    duration: '',
    notes: ''
  });

  useEffect(() => {
    let mounted = true;
    const normalizeList = (payload: unknown): Asset[] => {
      if (Array.isArray(payload)) return payload as Asset[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: Asset[] }).items;
      }
      return [];
    };

    const loadAssets = async () => {
      try {
        const response = await api.get('/assets');
        if (!mounted) return;
        setServerAssetList(normalizeList(response.data));
      } catch {
        if (!mounted) return;
        setServerAssetList(null);
      }
    };

    loadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveAssetList = serverAssetList ?? assetList;

  const rentableAssets = useMemo(() => {
    return effectiveAssetList.filter(a => a.status === 'Rented Out' || a.status === 'Available');
  }, [effectiveAssetList]);

  const filteredAssets = rentableAssets.filter(a => 
    (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.assetCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.rentedTo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeRentals = useMemo(() => effectiveAssetList.filter(a => a.status === 'Rented Out'), [effectiveAssetList]);
  
  const totalRentalValue = useMemo(() => {
    return activeRentals.reduce((sum, a) => sum + (a.rentalPrice || 0), 0);
  }, [activeRentals]);

  const handleRentalOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalForm.assetId || !rentalForm.customerName || !rentalForm.rentalPrice) {
      toast.error("Asset, Customer, dan Harga Rental wajib diisi!");
      return;
    }

    const asset = effectiveAssetList.find(a => a.id === rentalForm.assetId);
    if (!asset) return;

    updateAsset(asset.id, {
      status: 'Rented Out',
      rentedTo: rentalForm.customerName,
      rentalPrice: rentalForm.rentalPrice,
      location: rentalForm.location,
      notes: rentalForm.notes
    });

    addAuditLog({
      action: 'ASSET_RENTED_OUT',
      module: 'Assets',
      details: `Unit ${asset.assetCode} disewakan ke ${rentalForm.customerName} @ Rp ${rentalForm.rentalPrice.toLocaleString()}`,
      status: 'Success'
    });

    toast.success(`Unit ${asset.name} berhasil disewakan ke ${rentalForm.customerName}.`);
    setShowRentalModal(false);
    setRentalForm({ assetId: '', customerName: '', rentalPrice: 0, location: '', duration: '', notes: '' });
  };

  const handleReturnAsset = (asset: Asset) => {
    updateAsset(asset.id, {
      status: 'Available',
      rentedTo: undefined,
      rentalPrice: undefined
    });
    
    addAuditLog({
      action: 'ASSET_RETURNED',
      module: 'Assets',
      details: `Unit ${asset.assetCode} telah kembali dari masa sewa`,
      status: 'Success'
    });
    
    toast.success(`Unit ${asset.name} telah kembali ke pool.`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100 italic">
            <HandCoins size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Rental Out Dashboard</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">External Asset Monetization & Contract Management</p>
          </div>
        </div>

        <button 
          onClick={() => setShowRentalModal(true)}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-3 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          Create Rental Agreement
        </button>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                 <TrendingUp size={20} className="text-emerald-400" />
                 <h3 className="text-xs font-black uppercase italic tracking-widest text-slate-400">Est. Monthly Revenue</h3>
              </div>
              <div className="flex items-end gap-2 mb-2">
                 <span className="text-3xl font-black italic">Rp {(totalRentalValue * 0.95).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
                 Berdasarkan {activeRentals.length} unit yang sedang disewakan (setelah estimasi biaya operasional).
              </p>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Building size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Active Clients</p>
              <p className="text-3xl font-black text-slate-900 italic">{new Set(activeRentals.map(a => a.rentedTo)).size} <span className="text-xs text-slate-300 font-bold uppercase not-italic">Companies</span></p>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Truck size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Fleet Utilization</p>
              <p className="text-3xl font-black text-slate-900 italic">{Math.round((activeRentals.length / (effectiveAssetList.length || 1)) * 100)}% <span className="text-xs text-slate-300 font-bold uppercase not-italic">Rented</span></p>
           </div>
        </div>
      </div>

      {/* Rental List */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-600" /> External Rental Portfolio
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text" 
              placeholder="Search customers/units..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase italic outline-none focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Asset Code</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Unit Model</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Rented To</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Rental Price</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Location</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest italic text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black text-slate-900 uppercase italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{asset.assetCode}</span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-black text-slate-900 uppercase italic">{asset.name}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <Building size={14} className="text-slate-300" />
                       <span className="text-[10px] font-black text-slate-600 uppercase italic">{asset.rentedTo || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black text-emerald-600 uppercase italic tracking-tight">
                      {asset.rentalPrice ? `Rp ${asset.rentalPrice.toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5 text-slate-400">
                       <MapPin size={10} />
                       <span className="text-[10px] font-bold uppercase italic">{asset.location || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {asset.status === 'Rented Out' ? (
                      <button 
                        onClick={() => handleReturnAsset(asset)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                      >
                         End Rental
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest italic">
                        Available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rental Modal */}
      <AnimatePresence>
        {showRentalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRentalModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[3.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3">
                    <HandCoins size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">New Rental Contract</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Asset Outsourcing Management</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRentalModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRentalOut} className="p-10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Truck size={12} className="text-emerald-500" /> Select Unit for Lease
                    </label>
                    <select 
                      required
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none"
                      value={rentalForm.assetId}
                      onChange={(e) => setRentalForm({...rentalForm, assetId: e.target.value})}
                    >
                      <option value="">-- Choose Unit --</option>
                      {effectiveAssetList.filter(a => a.status === 'Available').map(a => (
                        <option key={a.id} value={a.id}>{a.assetCode} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <User size={12} className="text-emerald-500" /> Customer / Client Name
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. PT. Konstruksi Jaya Utama"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      value={rentalForm.customerName}
                      onChange={(e) => setRentalForm({...rentalForm, customerName: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <DollarSign size={12} className="text-emerald-500" /> Monthly Rental Price
                    </label>
                    <input 
                      type="number" 
                      required
                      placeholder="0"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      value={rentalForm.rentalPrice || ''}
                      onChange={(e) => setRentalForm({...rentalForm, rentalPrice: parseFloat(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Calendar size={12} className="text-emerald-500" /> Rental Duration
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 6 Months"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      value={rentalForm.duration}
                      onChange={(e) => setRentalForm({...rentalForm, duration: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <MapPin size={12} className="text-emerald-500" /> Delivery Location
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Proyek Tol Trans Jawa KM 24"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      value={rentalForm.location}
                      onChange={(e) => setRentalForm({...rentalForm, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowRentalModal(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3"
                  >
                    <ShieldCheck size={18} /> Activate Rental Contract
                    <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
