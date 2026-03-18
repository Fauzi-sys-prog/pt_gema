import { useEffect, useState } from 'react'; import { Truck, ArrowUpRight, ShoppingCart, Boxes, ArrowRight, Zap, AlertCircle, Building2 } from 'lucide-react'; import PurchaseOrderPage from './PurchaseOrderPage'; import ReceivingPage from './ReceivingPage'; import StockOutPage from '../inventory/StockOutPage'; import InventoryCenter from '../inventory/InventoryCenter'; import ProcurementCommandCenter from './ProcurementCommandCenter'; import VendorAnalysisPage from './VendorAnalysisPage'; import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { normalizeEntityRows } from '../../utils/normalizeEntityRows';

type TabType = 'replenishment' | 'procurement' | 'inbound' | 'outbound' | 'inventory' | 'vendors';

export default function ProcurementHubPage() {
  const [activeTab, setActiveTab] = useState<TabType>('replenishment');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverPoList, setServerPoList] = useState<any[] | null>(null);
  const [serverStockItemList, setServerStockItemList] = useState<any[] | null>(null);
  const { poList, stockItemList, addAuditLog } = useApp();
  const effectivePoList = serverPoList ?? poList;
  const effectiveStockItemList = serverStockItemList ?? stockItemList;

  const fetchProcurementSummary = async () => {
    try {
      setIsRefreshing(true);
      const [poRes, stockRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/inventory/items'),
      ]);
      setServerPoList(Array.isArray(poRes.data) ? poRes.data : []);
      setServerStockItemList(normalizeEntityRows<any>(stockRes.data));
    } catch {
      setServerPoList(null);
      setServerStockItemList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchProcurementSummary();
  }, []);

  const totalPoActive = effectivePoList.filter(p => p.status === 'Sent' || p.status === 'Partial').length;
  const criticalStock = effectiveStockItemList.filter(i => i.stok <= i.minStock).length;
  const flowSteps = [
    { id: 'replenishment', label: '0. COMMAND (GAP)', desc: 'Batch Analytics', icon: Zap, color: 'indigo' },
    { id: 'procurement', label: '1. PENGADAAN (PO)', desc: 'Beli Barang', icon: ShoppingCart, color: 'blue' },
    { id: 'inbound', label: '2. PENERIMAAN', desc: 'Stok Masuk', icon: Truck, color: 'emerald' },
    { id: 'vendors', label: '3. VENDORS', desc: 'Analisis Supplier', icon: Building2, color: 'amber' },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Workflow Header */}
      <div className="bg-[#0F172A] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <Zap size={32} className="text-indigo-400 fill-indigo-400" /> Supply Chain Executive Command
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 italic flex items-center gap-2">
              Integrated Warehouse & Procurement System • PT GTP
            </p>
          </div>
          <button
            onClick={() => void fetchProcurementSummary()}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-widest text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <div className="flex flex-wrap gap-4">
            <div className="px-6 py-4 bg-white/5 rounded-[1.5rem] border border-white/10">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Dipesan (PO)</p>
              <p className="text-xl font-black text-indigo-400">{totalPoActive} <span className="text-[10px] text-slate-500 uppercase">Batch</span></p>
            </div>
            <div className="px-6 py-4 bg-white/5 rounded-[1.5rem] border border-white/10">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Stok Kritis</p>
              <p className="text-xl font-black text-rose-500">{criticalStock} <span className="text-[10px] text-slate-500 uppercase">Item</span></p>
            </div>
          </div>
        </div>

        {/* Workflow Path */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
           {flowSteps.map((step, idx) => (
             <button
               key={step.id}
               onClick={() => {
                 setActiveTab(step.id as TabType);
                 addAuditLog({
                   action: 'PROCUREMENT_TAB_SWITCHED',
                   module: 'Procurement',
                   entityType: 'ProcurementHub',
                   entityId: step.id,
                   description: `Switched tab to ${step.id}`,
                 });
               }}
               className={`relative p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center group ${
                 activeTab === step.id 
                   ? 'bg-white border-white shadow-xl scale-105' 
                   : 'bg-white/5 border-white/10 hover:bg-white/10'
               }`}
             >
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                 activeTab === step.id ? `bg-indigo-600 text-white` : 'bg-white/10 text-slate-400'
               }`}>
                 <step.icon size={24} />
               </div>
               <p className={`text-[10px] font-black uppercase tracking-widest ${activeTab === step.id ? 'text-slate-900' : 'text-slate-400'}`}>
                 {step.label}
               </p>
               <p className={`text-[9px] font-bold uppercase mt-1 ${activeTab === step.id ? 'text-slate-500' : 'text-slate-600'}`}>
                 {step.desc}
               </p>
               {idx < 3 && (
                 <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-700 hidden md:block" size={16} />
               )}
             </button>
           ))}
        </div>
      </div>

      {/* Main Interface */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'replenishment' && (
          <div className="space-y-4">
            <ProcurementCommandCenter />
          </div>
        )}

        {activeTab === 'procurement' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Modul Pengadaan (PO)</h2>
            </div>
            <PurchaseOrderPage />
          </div>
        )}

        {activeTab === 'inbound' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Truck size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Penerimaan Barang (Stok Masuk)</h2>
            </div>
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4 mb-6">
               <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><AlertCircle size={24} /></div>
               <div>
                  <p className="text-sm font-black text-emerald-900 uppercase">Instruksi Terima Barang</p>
                  <p className="text-xs text-emerald-700 font-medium mt-1">
                    Klik tombol <strong>"Terima Barang"</strong> pada daftar PO di bawah ini untuk mengonfirmasi fisik barang yang datang. Stok akan bertambah otomatis setelah dikonfirmasi.
                  </p>
               </div>
            </div>
            <ReceivingPage />
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Vendor Reliability & Strategic Portfolio</h2>
            </div>
            <VendorAnalysisPage />
          </div>
        )}

        {activeTab === 'outbound' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Distribusi & Pemakaian (Stok Keluar)</h2>
            </div>
            <StockOutPage />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Boxes size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Data Master & Saldo Inventori</h2>
            </div>
            <InventoryCenter isCompactView={true} />
          </div>
        )}
      </div>
    </div>
  );
}
