import { useState, useMemo } from 'react'; import { useNavigate } from 'react-router-dom'; import {    Search, Plus, History, Database, Package, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, ArrowRightLeft, LayoutGrid, Table as TableIcon, X, ClipboardCheck, Truck, Eye, PieChart, BarChart3, ShieldCheck, Zap, Boxes, Activity, Filter, RefreshCcw, ExternalLink, ChevronRight, FileText, Briefcase, ChevronDown } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import type { StockOpname } from '../../contexts/AppContext';
import api from '../../services/api';
import { toast } from "sonner@2.0.3"
import { SKURegistrationModal } from '../../components/SKURegistrationModal';

export default function InventoryCenter({ isCompactView = false }: { isCompactView?: boolean }) {
  const navigate = useNavigate();
  const { 
    stockItemList, 
    currentUser,
    poList,
    projectList,
    receivingList,
    addAuditLog,
    addStockOpname,
    confirmStockOpname
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'demand'>('inventory');
  const [activeCategory, setActiveCategory] = useState('ALL CATEGORIES');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [opnameQty, setOpnameQty] = useState<number>(0);

  // --- CONNECTED DATA LOGIC ---
  
  // Calculate project requirements (Demand Analysis)
  const projectRequirements = useMemo(() => {
    const map: Record<string, { qty: number, projects: string[], unit: string }> = {};
    projectList.forEach(prj => {
      if (['Planning', 'In Progress'].includes(prj.status)) {
        (prj.boq || []).forEach((item: any) => {
          const key = item.itemKode || item.materialName;
          if (!map[key]) map[key] = { qty: 0, projects: [], unit: item.unit };
          map[key].qty += (item.qtyEstimate || 0);
          if (!map[key].projects.includes(prj.kodeProject)) {
            map[key].projects.push(prj.kodeProject);
          }
        });
      }
    });
    return map;
  }, [projectList]);

  // Calculate Incoming Qty per SKU from open POs
  const incomingData = useMemo(() => {
    const map: Record<string, number> = {};
    poList.forEach(po => {
      if (['Approved', 'Sent', 'Partial'].includes(po.status)) {
        po.items.forEach((item: any) => {
          const sku = item.kode || item.nama;
          const remaining = (item.qty || 0) - (item.qtyReceived || 0);
          if (remaining > 0) {
            map[sku] = (map[sku] || 0) + remaining;
          }
        });
      }
    });
    return map;
  }, [poList]);

  const isAutoCreated = (item: any) => item.id.includes('RCV-') || item.kode?.startsWith('SKU-');

  const getWarehouseCategory = (item: any) => {
    const rawCategory = String(item?.kategori || '').trim().toUpperCase();
    return rawCategory || 'GENERAL';
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(stockItemList.map((item) => getWarehouseCategory(item))));
    return ['ALL CATEGORIES', ...cats.filter(Boolean).sort((a, b) => a.localeCompare(b))];
  }, [stockItemList]);

  const filteredItems = useMemo(() => {
    return stockItemList.filter(item => {
      const keyword = String(searchTerm || '').toLowerCase();
      const matchesSearch =
        String(item.nama || '').toLowerCase().includes(keyword) ||
        String(item.kode || '').toLowerCase().includes(keyword);
      const matchesCategory =
        activeCategory === 'ALL CATEGORIES' || getWarehouseCategory(item) === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [stockItemList, searchTerm, activeCategory]);

  const groupedInventoryRows = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      const catA = String(a.kategori || 'General').toLowerCase();
      const catB = String(b.kategori || 'General').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
    const groups = new Map<string, typeof sorted>();
    for (const item of sorted) {
      const key = getWarehouseCategory(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  const stats = useMemo(() => {
    const totalValue = stockItemList.reduce((sum, item) => sum + (item.stok * item.hargaSatuan), 0);
    const lowStockCount = stockItemList.filter(i => i.stok <= i.minStock).length;
    const incomingCount = Object.values(incomingData).reduce((a, b) => a + b, 0);
    const totalRequired = Object.values(projectRequirements).reduce((a, b) => a + b.qty, 0);
    
    return { totalValue, lowStockCount, incomingCount, totalRequired };
  }, [stockItemList, incomingData, projectRequirements]);

  const handleStockOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const stockBefore = selectedItem.stok;
    const diff = opnameQty - stockBefore;
    if (diff === 0) { setShowOpnameModal(false); return; }

    const opnameId = `SO-ADJ-${Date.now()}`;
    const oneShotOpname: StockOpname = {
      id: opnameId,
      tanggal: new Date().toISOString().split('T')[0],
      noOpname: `SO-MANUAL-${Date.now().toString().slice(-6)}`,
      lokasi: selectedItem.lokasi || 'Gudang Utama',
      status: 'Draft',
      createdBy: currentUser?.fullName || currentUser?.username || 'SYSTEM',
      notes: `Quick stock opname from Monitoring Gudang (${selectedItem.kode})`,
      items: [{
        itemId: selectedItem.id,
        itemKode: selectedItem.kode,
        itemNama: selectedItem.nama,
        systemQty: stockBefore,
        physicalQty: opnameQty,
        difference: diff,
        notes: 'Manual adjustment from warehouse monitoring',
      }],
    };

    const movementPreviewRef = {
      tanggal: new Date().toISOString().split('T')[0],
      type: diff > 0 ? "IN" : "OUT",
      refNo: `ADJ-${Date.now().toString().slice(-4)}`,
      refType: "Adjustment (Opname)",
      itemKode: selectedItem.kode,
      itemNama: selectedItem.nama,
      qty: Math.abs(diff),
      unit: selectedItem.satuan,
      lokasi: selectedItem.lokasi,
      stockBefore: stockBefore,
      stockAfter: opnameQty,
      createdBy: currentUser?.fullName || 'Admin System',
    };

    try {
      await addStockOpname(oneShotOpname);
      await confirmStockOpname(opnameId);

      addAuditLog({
        action: 'STOCK_OPNAME_ADJUSTED',
        module: 'Inventory',
        entityType: 'StockItem',
        entityId: selectedItem.id,
        description: `Stock opname ${selectedItem.nama}: ${stockBefore} -> ${opnameQty} (${movementPreviewRef.type})`,
      });

      toast.success(`Stock opname ${selectedItem.nama} dikonfirmasi dan stok diperbarui.`);
      setShowOpnameModal(false);
    } catch {
      // Error toast handled by AppContext methods
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const handleExportMaster = async () => {
    const rows = [
      ['Kode', 'Nama', 'Kategori', 'Stok', 'MinStock', 'Satuan', 'HargaSatuan', 'Lokasi', 'LastUpdate'],
      ...filteredItems.map((item) => [
        item.kode,
        item.nama,
        item.kategori,
        String(item.stok),
        String(item.minStock),
        item.satuan,
        String(item.hargaSatuan),
        item.lokasi || '',
        item.lastUpdate || '',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `inventory-master-${dateKey}`,
      title: 'Inventory Master Report',
      subtitle: `Per tanggal ${dateKey} | Monitoring gudang aktif`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Master inventory berisi ${filteredItems.length} SKU dengan total nilai persediaan ${formatCurrency(stats.totalValue)}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Team',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `inventory-master-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `inventory-master-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'INVENTORY_MASTER_EXPORTED',
        module: 'Inventory',
        entityType: 'StockItem',
        entityId: 'all',
        description: `Inventory master exported (${filteredItems.length} rows)`,
      });
      toast.success('Inventory master Word + Excel exported');
    } catch {
      toast.error('Export inventory master gagal');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-6 lg:p-10 space-y-8">
      {/* Header Operational Dashboard */}
      <div className="bg-[#0F172A] rounded-[32px] p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg rotate-3 border border-indigo-400/30">
              <Boxes size={40} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black uppercase tracking-tighter">Control Center</h1>
                <span className="px-3 py-1 bg-emerald-500 text-[10px] font-bold rounded-full text-white uppercase tracking-widest animate-pulse">Live Connected</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mt-1">Integrated Project & Warehouse Hub PT GTP</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/inventory/stock-in?mode=manual')}
              className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-3 shadow-xl shadow-emerald-500/20"
            >
              <ArrowUpRight size={18} /> Input Manual Inbound
            </button>
            <button
              onClick={handleExportMaster}
              className="bg-white/10 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-3 border border-white/20"
            >
              <ExternalLink size={18} /> Export Master
            </button>
            <button 
              onClick={() => setActiveTab(activeTab === 'inventory' ? 'demand' : 'inventory')}
              className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl ${activeTab === 'demand' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
            >
              <Activity size={18} /> {activeTab === 'inventory' ? 'Demand Analysis' : 'Master Stock'}
            </button>
            <button onClick={() => setShowNewItemModal(true)} className="bg-white/10 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-3 border border-white/20">
              <Plus size={18} /> Registrasi SKU
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-1">Project Demand</p>
            <p className="text-xl font-black italic tracking-tighter">{stats.totalRequired.toLocaleString()}</p>
            <div className="mt-3 flex items-center gap-2"><Activity size={14} className="text-emerald-400" /><span className="text-[10px] font-black italic text-emerald-400 uppercase tracking-widest">BOQ Needs</span></div>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-1">Incoming (PO)</p>
            <p className="text-xl font-black italic tracking-tighter">+{stats.incomingCount}</p>
            <div className="mt-3 flex items-center gap-2"><Truck size={14} className="text-indigo-400" /><span className="text-[10px] font-black italic text-indigo-400 uppercase tracking-widest">Pending Stock</span></div>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-1">Critical Stock</p>
            <p className="text-xl font-black italic tracking-tighter">{stats.lowStockCount} SKU</p>
            <div className="mt-3 flex items-center gap-2"><AlertCircle size={14} className="text-amber-400" /><span className="text-[10px] font-black italic text-amber-400 uppercase tracking-widest">Needs PO</span></div>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-1">Asset Value</p>
            <p className="text-xl font-black italic tracking-tighter">{formatCurrency(stats.totalValue)}</p>
            <div className="mt-3 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400" /><span className="text-[10px] font-black italic text-emerald-400 uppercase tracking-widest">Total SOH</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-8 items-center justify-between">
        <div className="relative w-full xl:max-w-2xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search Master SKU, Demand, or Reference..." className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="appearance-none bg-white border-2 border-slate-200 rounded-xl pl-10 pr-10 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-[#0F172A] border-b border-[#1E293B]">
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em] w-20 text-center">No</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em]">Nama Material</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em]">Supplier</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em] text-center">Stock</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em] text-right">Harga</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em] text-center">Expiry</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-100 uppercase tracking-[0.18em]">Keterangan</th>
                </tr>
              </thead>
              {groupedInventoryRows.map(([categoryName, rows]) => (
                <tbody key={categoryName} className="divide-y divide-slate-100">
                  <tr className="bg-[#FACC15] border-y-2 border-[#0F172A]">
                    <td colSpan={7} className="px-6 py-2 text-[13px] font-black italic tracking-[0.2em] text-slate-900">
                      {categoryName}
                    </td>
                  </tr>
                  {rows.map((item, rowIndex) => {
                    const isCritical = Number(item.stok || 0) <= Number(item.minStock || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-black text-slate-500">{rowIndex + 1}</span>
                        </td>
                        <td className="px-6 py-5">
                          <p className={`font-black uppercase italic text-2xl leading-tight ${isAutoCreated(item) ? 'text-orange-600' : 'text-slate-900'}`}>
                            {item.nama}
                          </p>
                          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {item.kode}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-slate-500 uppercase italic">
                            {item.supplier || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className={`text-3xl font-black italic ${isCritical ? 'text-rose-600' : 'text-slate-900'}`}>
                            {Number(item.stok || 0).toLocaleString()}
                            <span className="text-[11px] font-bold uppercase text-slate-400 ml-1">{item.satuan}</span>
                          </p>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <p className="text-2xl font-black italic text-slate-900">
                            Rp {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Number(item.hargaSatuan || 0))}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className="text-sm font-black italic text-slate-300">{item.expiryDate || '-'}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className={`text-xs font-black uppercase tracking-widest ${isCritical ? 'text-rose-500' : 'text-indigo-400'}`}>
                              {isCritical ? 'Reorder Required' : `Gudang ${String(item.lokasi || 'Utama').split(' ').slice(-1)[0]}`}
                            </p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setSelectedItem(item); setOpnameQty(item.stok); setShowOpnameModal(true); }} className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-all">
                                <ClipboardCheck size={16} />
                              </button>
                              <button onClick={() => navigate(`/inventory/stock-card/${item.id}`)} className="w-9 h-9 bg-white text-slate-500 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-900 hover:text-white transition-all">
                                <Eye size={16} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><Activity size={24} /></div>
              <div><h3 className="text-xl font-black uppercase italic text-slate-900">Project Demand Hub</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Aggregated requirements from Projects</p></div>
            </div>
            <div className="space-y-4 flex-1">
              {Object.entries(projectRequirements).map(([sku, data]: any) => {
                const inventory = stockItemList.find(s => s.kode === sku || s.nama === sku);
                const isShortage = (inventory?.stok || 0) < data.qty;
                return (
                  <div key={sku} className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all">
                    <div>
                      <p className="font-black text-slate-900 uppercase italic leading-tight">{sku}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded-lg border border-slate-100">Needed: {data.qty} {data.unit}</span>
                        <div className="flex -space-x-2">{data.projects.map((p: string) => <div key={p} className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-[8px] font-black text-white">{p.split('-').pop()}</div>)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black italic ${isShortage ? 'text-rose-600' : 'text-emerald-600'}`}>{inventory?.stok || 0}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isShortage ? 'Shortage!' : 'On Hand'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-[#0F172A] rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
            <div className="relative z-10 flex flex-col h-full">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Inventory Readiness</h3>
              <div className="space-y-8 flex-1 mt-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-end"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Demand coverage</p><p className="text-2xl font-black italic text-indigo-400">{Math.round((stockItemList.filter(i => i.stok >= (projectRequirements[i.kode]?.qty || 0)).length / stockItemList.length) * 100) || 0}%</p></div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10"><div className="h-full bg-indigo-500" style={{ width: `${Math.round((stockItemList.filter(i => i.stok >= (projectRequirements[i.kode]?.qty || 0)).length / stockItemList.length) * 100) || 0}%` }} /></div>
                </div>
                <div className="bg-white/5 rounded-[24px] p-6 border border-white/10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Urgent Procurement</p>
                  <ul className="space-y-4">
                    {Object.entries(projectRequirements).filter(([sku, data]: any) => (stockItemList.find(s => s.kode === sku || s.nama === sku)?.stok || 0) < data.qty).slice(0, 3).map(([sku, data]: any) => (
                      <li key={sku} className="flex items-center gap-4 text-xs font-bold text-slate-300"><div className="w-2 h-2 bg-rose-500 rounded-full" /><span className="flex-1 uppercase italic">{sku}</span><span className="text-rose-400 uppercase tracking-tighter font-black">Needs PO</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              <button onClick={() => navigate('/purchasing/purchase-order')} className="mt-8 w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-xl"><Plus size={18} /> Create Procurement PO</button>
            </div>
          </div>
        </div>
      )}
      {showOpnameModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-10 bg-[#0F172A] text-white">
              <div className="flex justify-between items-start mb-6"><div className="p-4 bg-indigo-500/20 rounded-2xl text-indigo-400"><ClipboardCheck size={28} /></div><button onClick={() => setShowOpnameModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400"><X size={24} /></button></div>
              <h3 className="text-3xl font-black uppercase italic tracking-tighter">Physical Audit</h3><p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{selectedItem.nama}</p>
            </div>
            <form onSubmit={handleStockOpname} className="p-10 space-y-8">
              <div className="bg-slate-50 p-8 rounded-[32px] border-4 border-slate-100"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Actual Stock</label><div className="flex items-end gap-4"><input type="number" required min="0" className="w-full bg-transparent text-6xl font-black italic text-slate-900 outline-none" value={opnameQty} onChange={(e) => setOpnameQty(Number(e.target.value))} autoFocus /><span className="text-sm font-black text-slate-400 uppercase mb-3">{selectedItem.satuan}</span></div></div>
              <button type="submit" className="w-full py-5 bg-indigo-600 rounded-2xl text-white text-xs font-black uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all border-b-4 border-indigo-800">Update Ledger</button>
            </form>
          </div>
        </div>
      )}
      <SKURegistrationModal isOpen={showNewItemModal} onClose={() => setShowNewItemModal(false)} />
    </div>
  );
}
