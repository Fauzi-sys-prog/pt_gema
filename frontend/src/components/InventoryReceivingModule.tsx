import React, { useMemo } from 'react';
import { 
  Scan, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  FileCheck,
  ChevronRight
} from 'lucide-react';
import { QCStatus } from '../utils/docEngine';
import { useApp } from '../contexts/AppContext';

interface IncomingItem {
  id: string;
  poNum: string;
  item: string;
  expected: number;
  received: number;
  qcStatus: QCStatus;
  hasPhoto: boolean;
}

export const InventoryReceivingModule: React.FC = () => {
  const { receivingList } = useApp();

  const items = useMemo<IncomingItem[]>(() => {
    const mapped: IncomingItem[] = [];
    receivingList.forEach((rcv) => {
      const lines = Array.isArray(rcv.items) ? rcv.items : [];
      lines.forEach((line, idx) => {
        const received = Number(line.qtyReceived ?? line.qty ?? 0);
        const good = Number(line.qtyGood ?? received);
        let qcStatus: QCStatus = 'Good';
        if (good < received) qcStatus = 'Damaged';
        if (received <= 0) qcStatus = 'Incomplete';

        mapped.push({
          id: `${rcv.id}-${idx}`,
          poNum: rcv.noPO || '-',
          item: line.itemName || line.itemKode || `Item ${idx + 1}`,
          expected: Number(line.qty ?? received),
          received,
          qcStatus,
          hasPhoto: false,
        });
      });
    });
    return mapped;
  }, [receivingList]);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory Receiving (QC Gate)</h2>
          <p className="text-sm text-slate-500">Verifikasi fisik barang masuk dan validasi surat jalan vendor.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.qcStatus === 'Good' ? 'bg-emerald-50 text-emerald-600' : 
                  item.qcStatus === 'Damaged' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <Package size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{item.poNum}</span>
                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                    <span className="text-xs font-bold text-blue-600 uppercase">Incoming</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">{item.item}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <FileCheck size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-600">Qty: <b>{item.received}/{item.expected}</b></span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      item.qcStatus === 'Good' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.qcStatus}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100">
                  <Camera size={14} />
                  Lihat Foto
                </button>
                <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}

          {!items.length && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-500 text-sm font-medium">
              Belum ada data receiving dari backend.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-900/20">
            <Scan size={32} className="mb-4 opacity-50" />
            <h3 className="text-lg font-bold leading-tight">Mulai Terima Barang</h3>
            <p className="text-xs text-blue-100 mt-2 leading-relaxed">Scan QR Code pada PO atau Surat Jalan untuk mencatat penerimaan baru.</p>
            <button className="w-full mt-6 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-black hover:bg-blue-50 transition-colors">
              Buka Scanner
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Isu QC Hari Ini
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-[10px] font-bold text-rose-700 uppercase">Damaged Goods</p>
                <p className="text-xs font-medium text-slate-700 mt-0.5">Steel Plate 5mm - Bengkok saat unloading.</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Shortage</p>
                <p className="text-xs font-medium text-slate-700 mt-0.5">Baut M12 - Kurang 20 pcs dari vendor.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
