import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; import { ArrowLeft, Download, Search, Calendar, ArrowUpRight, ArrowDownLeft, History, Package, Database, Printer, FileSpreadsheet, AlertCircle, TrendingUp, TrendingDown, X, Eye, ArrowRight, Boxes, Zap, Info, Clock, User, ExternalLink, Activity, ShieldCheck, Hourglass } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import type { StockItem, StockMovement } from '../../contexts/AppContext';
import api from '../../services/api';

export default function StockCardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stockItemList, stockMovementList, stockInList, stockOutList, receivingList, poList, projectList, addAuditLog, currentUser } = useApp();
  const [serverStockItemList, setServerStockItemList] = useState<StockItem[] | null>(null);
  const [serverStockMovementList, setServerStockMovementList] = useState<StockMovement[] | null>(null);
  const [serverStockInList, setServerStockInList] = useState<any[] | null>(null);
  const [serverStockOutList, setServerStockOutList] = useState<any[] | null>(null);
  const [serverReceivingList, setServerReceivingList] = useState<any[] | null>(null);
  const [serverPoList, setServerPoList] = useState<any[] | null>(null);
  const [serverProjectList, setServerProjectList] = useState<any[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;
    const normalizeList = <T,>(payload: unknown): T[] => {
      if (Array.isArray(payload)) return payload as T[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: T[] }).items;
      }
      return [];
    };
    const normalizeEntityRows = <T,>(payload: unknown): T[] => {
      const rows = normalizeList<any>(payload);
      return rows.map((row: any) => {
        const record = row?.payload ?? row;
        if (record && typeof record === 'object' && !Array.isArray(record) && !record.id && row?.entityId) {
          return { ...record, id: row.entityId } as T;
        }
        return record as T;
      });
    };

    const loadPageData = async () => {
      try {
        const [itemsRes, movementsRes, stockInRes, stockOutRes, receivingRes, poRes, projectRes] = await Promise.all([
          api.get('/inventory/items'),
          api.get('/inventory/movements'),
          api.get('/inventory/stock-ins'),
          api.get('/inventory/stock-outs'),
          api.get('/receivings'),
          api.get('/purchase-orders'),
          api.get('/projects'),
        ]);
        if (!mounted) return;
        setServerStockItemList(normalizeEntityRows<StockItem>(itemsRes.data));
        setServerStockMovementList(normalizeEntityRows<StockMovement>(movementsRes.data));
        setServerStockInList(normalizeEntityRows<any>(stockInRes.data));
        setServerStockOutList(normalizeEntityRows<any>(stockOutRes.data));
        setServerReceivingList(normalizeList<any>(receivingRes.data));
        setServerPoList(normalizeList<any>(poRes.data));
        setServerProjectList(normalizeList<any>(projectRes.data));
      } catch {
        if (!mounted) return;
        setServerStockItemList(null);
        setServerStockMovementList(null);
        setServerStockInList(null);
        setServerStockOutList(null);
        setServerReceivingList(null);
        setServerPoList(null);
        setServerProjectList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveStockItemList = serverStockItemList ?? stockItemList;
  const effectiveStockMovementList = serverStockMovementList ?? stockMovementList;
  const effectiveStockInList = serverStockInList ?? stockInList;
  const effectiveStockOutList = serverStockOutList ?? stockOutList;
  const effectiveReceivingList = serverReceivingList ?? receivingList;
  const effectivePoList = serverPoList ?? poList;
  const effectiveProjectList = serverProjectList ?? projectList;
  const item = effectiveStockItemList.find(i => i.id === id);

  const parseDateToMs = (value: unknown): number => {
    const ms = new Date(String(value || '')).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };
  const formatDate = (value: unknown, fallback = '-'): string => {
    const ms = parseDateToMs(value);
    if (!ms) return fallback;
    return new Date(ms).toLocaleDateString('id-ID');
  };
  
  const movements = useMemo(() => {
    if (!item) return [];
    const code = String(item.kode || '').trim().toLowerCase();
    const name = String(item.nama || '').trim().toLowerCase();
    const keyword = String(searchTerm || '').trim().toLowerCase();

    const directMovements = effectiveStockMovementList
      .filter((m) => {
        const mk = String(m.itemKode || '').trim().toLowerCase();
        const mn = String(m.itemNama || '').trim().toLowerCase();
        return mk === code || mn === name;
      });

    const buildFallbackIn = (rows: any[]) => {
      return rows
        .filter((si) => Array.isArray(si.items) && si.items.some((it: any) => String(it.kode || '').trim().toLowerCase() === code))
        .flatMap((si) => {
          return (si.items || [])
            .filter((it: any) => String(it.kode || '').trim().toLowerCase() === code)
            .map((it: any) => ({
              id: `FALLBACK-IN-${si.id}-${it.kode}`,
              tanggal: si.tanggal,
              type: 'IN',
              refNo: si.noStockIn || si.id,
              refType: si.type || 'Stock In',
              itemKode: it.kode,
              itemNama: it.nama || item.nama,
              qty: Number(it.qty || 0),
              unit: it.satuan || item.satuan,
              lokasi: item.lokasi,
              stockBefore: Number.NaN,
              stockAfter: Number.NaN,
              createdBy: si.createdBy || '-',
              supplier: si.supplier,
            }));
        });
    };

    const buildFallbackOut = (rows: any[]) => {
      return rows
        .filter((so) => Array.isArray(so.items) && so.items.some((it: any) => String(it.kode || '').trim().toLowerCase() === code))
        .flatMap((so) => {
          return (so.items || [])
            .filter((it: any) => String(it.kode || '').trim().toLowerCase() === code)
            .map((it: any) => ({
              id: `FALLBACK-OUT-${so.id}-${it.kode}`,
              tanggal: so.tanggal,
              type: 'OUT',
              refNo: so.noStockOut || so.id,
              refType: so.type || 'Stock Out',
              itemKode: it.kode,
              itemNama: it.nama || item.nama,
              qty: Number(it.qty || 0),
              unit: it.satuan || item.satuan,
              lokasi: item.lokasi,
              stockBefore: Number.NaN,
              stockAfter: Number.NaN,
              createdBy: so.createdBy || '-',
            }));
        });
    };

    const fallbackMovements = [...buildFallbackIn(effectiveStockInList || []), ...buildFallbackOut(effectiveStockOutList || [])];
    // Keep stock-movements as source of truth to avoid duplicated ledger rows.
    const merged = directMovements.length > 0 ? directMovements : fallbackMovements;
    const unique = new Map<string, any>();
    for (const mv of merged) {
      if (!mv?.id) continue;
      if (!unique.has(mv.id)) unique.set(mv.id, mv);
    }

    const poSupplierByNo = new Map<string, string>();
    for (const po of effectivePoList || []) {
      const noPO = String(po?.noPO || '').trim();
      const supplier = String(po?.supplier || '').trim();
      if (noPO && supplier && !poSupplierByNo.has(noPO)) poSupplierByNo.set(noPO, supplier);
    }

    const supplierByRefNo = new Map<string, string>();
    for (const rcv of effectiveReceivingList || []) {
      const refNo = String(rcv?.noReceiving || '').trim();
      const supplier = String(rcv?.supplier || '').trim() || poSupplierByNo.get(String(rcv?.noPO || '').trim()) || '';
      if (refNo && supplier && !supplierByRefNo.has(refNo)) supplierByRefNo.set(refNo, supplier);
    }

    const projectNameById = new Map<string, string>();
    for (const project of effectiveProjectList || []) {
      const projectId = String(project?.id || '').trim();
      const projectName = String(project?.namaProject || '').trim();
      if (projectId && projectName && !projectNameById.has(projectId)) projectNameById.set(projectId, projectName);
    }
    const stockOutProjectByRef = new Map<string, string>();
    for (const so of effectiveStockOutList || []) {
      const refNo = String(so?.noStockOut || so?.id || '').trim();
      const projectName =
        String(so?.projectName || '').trim() ||
        projectNameById.get(String(so?.projectId || '').trim()) ||
        '';
      if (refNo && projectName && !stockOutProjectByRef.has(refNo)) stockOutProjectByRef.set(refNo, projectName);
    }
    const receivingProjectByRef = new Map<string, string>();
    for (const rcv of effectiveReceivingList || []) {
      const refNo = String(rcv?.noReceiving || '').trim();
      const projectName =
        String(rcv?.project || '').trim() ||
        projectNameById.get(String(rcv?.projectId || '').trim()) ||
        '';
      if (refNo && projectName && !receivingProjectByRef.has(refNo)) receivingProjectByRef.set(refNo, projectName);
    }
    const stockInProjectByRef = new Map<string, string>();
    for (const si of effectiveStockInList || []) {
      const refNo = String(si?.noStockIn || si?.id || '').trim();
      const projectName =
        String(si?.projectName || '').trim() ||
        projectNameById.get(String(si?.projectId || '').trim()) ||
        '';
      if (refNo && projectName && !stockInProjectByRef.has(refNo)) stockInProjectByRef.set(refNo, projectName);
    }

    return Array.from(unique.values())
      .map((mv: any) => ({
        ...mv,
        supplier:
          String(mv?.supplier || '').trim() ||
          supplierByRefNo.get(String(mv?.refNo || '').trim()) ||
          String(item.supplier || '').trim() ||
          '-',
        projectName:
          String(mv?.projectName || '').trim() ||
          (String(mv?.refType || '').toLowerCase().includes('stock out')
            ? stockOutProjectByRef.get(String(mv?.refNo || '').trim())
            : undefined) ||
          (String(mv?.refType || '').toLowerCase().includes('stock in')
            ? stockInProjectByRef.get(String(mv?.refNo || '').trim()) ||
              receivingProjectByRef.get(
                String(mv?.refNo || '').startsWith('SI-AUTO-')
                  ? String(mv?.refNo || '').slice('SI-AUTO-'.length)
                  : ''
              )
            : undefined) ||
          projectNameById.get(String(mv?.projectId || '').trim()) ||
          '',
      }))
      .filter((m: any) =>
        !keyword ||
        String(m.refNo || '').toLowerCase().includes(keyword) ||
        String(m.refType || '').toLowerCase().includes(keyword) ||
        String(m.itemKode || '').toLowerCase().includes(keyword)
      )
      .sort((a: any, b: any) => parseDateToMs(b.tanggal) - parseDateToMs(a.tanggal));
  }, [item, effectiveStockMovementList, effectiveStockInList, effectiveStockOutList, effectiveReceivingList, effectivePoList, effectiveProjectList, searchTerm]);

  // Hook harus selalu dipanggil pada urutan yang sama di setiap render.
  const stats = useMemo(() => {
    const totalIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.qty, 0);
    const totalOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.qty, 0);
    const lastMovement = movements[0]?.tanggal || '-';
    return { totalIn, totalOut, lastMovement };
  }, [movements]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="p-8 bg-rose-50 rounded-full text-rose-300">
          <AlertCircle size={64} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 uppercase italic">SKU Not Found</h2>
          <p className="text-slate-400 font-medium">Data barang tidak ditemukan dalam Master Ledger.</p>
        </div>
        <button 
          onClick={() => navigate('/inventory/center')} 
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
        >
          Kembali ke Gudang
        </button>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const handleViewReference = (move: any) => {
    const rType = move.refType.toLowerCase();
    if (rType.includes('receiving') || move.refNo.startsWith('GRN-') || move.refNo.startsWith('RCV-')) {
      navigate('/purchasing/receiving');
    } else if (rType.includes('masuk') || move.refNo.startsWith('SI-') || move.refNo.startsWith('STIN-')) {
      navigate('/inventory/stock-in');
    } else if (rType.includes('keluar') || rType.includes('issue') || move.refNo.startsWith('SO-')) {
      navigate('/inventory/stock-out');
    } else if (rType.includes('lhp') || rType.includes('prod')) {
      navigate('/production/report');
    }
  };

  const handleExportCsv = async () => {
    const rows = [
      ['Tanggal', 'RefType', 'RefNo', 'ItemKode', 'ItemNama', 'Type', 'Qty', 'Unit', 'StockBefore', 'StockAfter', 'Project', 'BatchNo', 'CreatedBy'],
      ...movements.map((m) => [
        m.tanggal,
        m.refType,
        m.refNo,
        m.itemKode,
        m.itemNama,
        m.type,
        String(m.qty),
        m.unit,
        String(m.stockBefore),
        String(m.stockAfter),
        m.projectName || '',
        m.batchNo || '',
        m.createdBy || '',
      ]),
    ];
    const codeKey = item?.kode || 'item';
    const payload = {
      filename: `stock-card-${codeKey}`,
      title: 'Stock Card Detail Report',
      subtitle: `${item?.nama || '-'} | Kode ${codeKey} | Lokasi ${item?.lokasi || '-'}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Kartu stok untuk item ${item?.nama || '-'} dengan total masuk ${stats.totalIn}, total keluar ${stats.totalOut}, dan stok akhir ${item?.stokSaatIni ?? 0} ${item?.satuan || ''}.`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'Inventory Stock Card',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `stock-card-${codeKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `stock-card-${codeKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: 'STOCK_CARD_EXPORTED',
        module: 'Inventory',
        entityType: 'StockItem',
        entityId: item?.id || 'unknown',
        description: `Stock card exported for ${item?.kode || 'unknown'}`,
      });
      toast.success('Stock card Word + Excel exported');
    } catch {
      toast.error('Export stock card gagal');
    }
  };

  const handlePrint = () => {
    addAuditLog({
      action: 'STOCK_CARD_PRINTED',
      module: 'Inventory',
      entityType: 'StockItem',
      entityId: item?.id || 'unknown',
      description: `Stock card printed for ${item?.kode || 'unknown'}`,
    });
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/inventory/center')}
            className="w-14 h-14 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm group"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                Stock Card <span className="text-indigo-600">Ledger</span>
              </h1>
              {item.id.includes('RCV-') && (
                <span className="px-3 py-1 bg-amber-100 text-[10px] font-black text-amber-700 rounded-full uppercase tracking-tighter flex items-center gap-1 border border-amber-200">
                  <Zap size={10} /> Auto-Sync Origin
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Movement Verification & Audit Trail</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all"
          >
            <Download size={16} /> Export Word + Excel
          </button>
          <button
            onClick={handlePrint}
            className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 active:scale-90 transition-transform"
          >
            <Printer size={20} />
          </button>
        </div>
      </div>

      {/* Item Identity Profile */}
      <div className="bg-[#0F172A] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[32px] flex items-center justify-center text-white shadow-2xl rotate-3 border border-indigo-400/30">
              <Boxes size={48} />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">{item.nama}</h2>
                <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-xs font-black rounded-xl uppercase tracking-widest border border-white/20">
                  {item.kode}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <Database size={14} className="text-indigo-400" /> {item.kategori}
                </div>
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <Calendar size={14} className="text-indigo-400" /> Updated: {formatDate(item.lastUpdate)}
                </div>
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <Info size={14} className="text-indigo-400" /> Satuan: {item.satuan}
                </div>
                {item.expiryDate && (
                  <>
                    <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                    <div className="flex items-center gap-2 text-rose-400 uppercase text-[10px] font-black tracking-widest">
                      <Hourglass size={14} /> Expiry: {new Date(item.expiryDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-12 bg-white/5 backdrop-blur-xl p-8 rounded-[32px] border border-white/10">
            <div className="text-right border-r border-white/10 pr-12">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Value</p>
              <p className="text-2xl font-black text-indigo-400 italic leading-none">{formatCurrency(item.stok * item.hargaSatuan)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">On-Hand Stock</p>
              <div className="flex items-baseline justify-end gap-2">
                <p className="text-5xl font-black text-white italic leading-none">{item.stok.toLocaleString()}</p>
                <span className="text-sm font-black text-indigo-400 uppercase">{item.satuan}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-500 transition-all">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Procurement (IN)</h3>
            <p className="text-3xl font-black text-slate-900 italic">+{stats.totalIn.toLocaleString()}</p>
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase">
              <TrendingUp size={14} /> Growth Factor
            </div>
          </div>
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all">
            <ArrowDownLeft size={32} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-rose-500 transition-all">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Usage / Project (OUT)</h3>
            <p className="text-3xl font-black text-slate-900 italic">-{stats.totalOut.toLocaleString()}</p>
            <div className="flex items-center gap-2 text-rose-500 font-bold text-[10px] uppercase">
              <TrendingDown size={14} /> Consumption
            </div>
          </div>
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center group-hover:-rotate-12 transition-all">
            <ArrowUpRight size={32} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-500 transition-all">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Velocity Status</h3>
            <p className="text-3xl font-black text-slate-900 italic">{movements.length} <span className="text-sm font-bold text-slate-400 not-italic uppercase">Events</span></p>
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-[10px] uppercase">
              <Clock size={14} /> Last Event: {stats.lastMovement}
            </div>
          </div>
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
            <History size={32} />
          </div>
        </div>
      </div>

      {/* Movement Ledger Table */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-8 bg-slate-50">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
              <Activity size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Kartu Stock</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Transaction History Audit</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-6 py-2 border-2 border-slate-200 rounded-xl bg-white">
              <span className="text-[10px] font-black uppercase text-slate-400 block italic leading-none mb-1">Category</span>
              <span className="text-sm font-black uppercase italic text-slate-900">{item.kategori} : {item.nama}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-14 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-slate-900 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-6 border border-slate-700 text-center italic">Tanggal</th>
                <th className="px-6 py-6 border border-slate-700 italic">Deskripsi</th>
                <th className="px-6 py-6 border border-slate-700 italic">Supplier</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">Project</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">Saldo Awal</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">In</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">Out</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">Stok Akhir</th>
                <th className="px-6 py-6 border border-slate-700 text-center italic">Kode Produksi</th>
                <th className="px-6 py-6 border border-slate-700 italic">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((move) => {
                const isIncoming = move.type === 'IN';
                return (
                  <tr key={move.id} className="hover:bg-slate-50 transition-all group border-b border-slate-100">
                    <td className="px-6 py-5 border-x border-slate-50 text-center">
                        <span className="text-[11px] font-black italic text-slate-900">{formatDate(move.tanggal)}</span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-xs font-black italic uppercase text-slate-900 tracking-tighter leading-none">{move.refType}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{move.refNo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50">
                      <span className="text-[11px] font-bold text-slate-600 uppercase italic">
                        {move.supplier || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase italic">
                        {move.projectName || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center">
                      <span className="text-xs font-bold text-slate-400">{Number.isFinite(move.stockBefore) ? Number(move.stockBefore).toLocaleString() : '-'}</span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center">
                      <span className={`text-base font-black italic ${isIncoming ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {isIncoming ? move.qty.toLocaleString() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center">
                      <span className={`text-base font-black italic ${!isIncoming ? 'text-rose-600' : 'text-slate-300'}`}>
                        {!isIncoming ? move.qty.toLocaleString() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center bg-slate-50/50">
                      <span className="text-base font-black italic text-slate-900 tracking-tighter">
                        {Number.isFinite(move.stockAfter) ? Number(move.stockAfter).toLocaleString() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50 text-center">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        {move.batchNo || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-r border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                        {move.kondisi || 'Regular Movement'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Boxes size={80} />
                      <p className="text-xs font-black uppercase tracking-[0.4em]">No Transactions Logged</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pb-10">
        <div className="w-8 h-px bg-slate-300" />
        <span className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-indigo-500" /> Secure Ledger System
        </span>
        <div className="w-8 h-px bg-slate-300" />
      </div>
    </div>
  );
}
