import React, { useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter,
  ArrowRight,
  MoreVertical
} from 'lucide-react';
import { generateDocNumber } from '../utils/docEngine';
import { useApp } from '../contexts/AppContext';

export const PurchaseOrderModule: React.FC = () => {
  const { poList, updatePO, projectList } = useApp();

  const handleApprove = async (id: string) => {
    try {
      await updatePO(id, { status: "Approved" });
    } catch {
      // Error toast handled in AppContext
    }
  };

  const activePOs = useMemo(() => poList, [poList]);

  const pendingCount = activePOs.filter((po) => po.status === "Pending").length;
  const totalPOValue = activePOs.reduce((sum, po) => sum + (Number(po.total) || 0), 0);
  const activeVendorCount = new Set(activePOs.map((po) => po.supplier).filter(Boolean)).size;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const projectById = useMemo(() => {
    const map = new Map<string, string>();
    projectList.forEach((p) => map.set(p.id, p.namaProject));
    return map;
  }, [projectList]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Procurement & PO Center</h2>
          <p className="text-sm text-slate-500">Kelola permintaan pembelian dan approval manager.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-900/10">
          <Plus size={18} />
          Buat PO Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menunggu Approval</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{pendingCount} <span className="text-sm font-normal text-slate-400 text-sm">Dokumen</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total PO Bulan Ini</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(totalPOValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendor Aktif</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{activeVendorCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari No. PO atau Vendor..." className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-lg text-sm focus:outline-none border border-transparent focus:border-blue-500" />
          </div>
          <button className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:bg-slate-100">
            <Filter size={18} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dokumen / Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Project</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nilai Transaksi</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activePOs.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/30">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{po.noPO || generateDocNumber('PO', 1)}</span>
                      <span className="text-xs text-slate-500 font-medium">{po.supplier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-700 font-medium">{po.projectId ? (projectById.get(po.projectId) || po.projectId) : "-"}</span>
                      <span className="text-[10px] text-slate-400 uppercase">REQ: SYSTEM</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(Number(po.total) || 0)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(po.status)}`}>
                      {po.status === 'Approved' && <CheckCircle size={12} />}
                      {po.status === 'Pending' && <Clock size={12} />}
                      {(po.status === 'Rejected' || po.status === 'Cancelled') && <XCircle size={12} />}
                      {po.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {po.status === 'Pending' && (
                        <button 
                          onClick={() => { void handleApprove(po.id); }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1"
                        >
                          Approve
                        </button>
                      )}
                      <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
