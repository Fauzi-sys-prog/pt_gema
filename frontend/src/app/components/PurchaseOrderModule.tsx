import React, { useState } from 'react';
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
import { generateDocNumber, ApprovalStatus } from '../utils/docEngine';

interface POItem {
  id: string;
  docNum: string;
  vendor: string;
  project: string;
  totalValue: string;
  date: string;
  status: ApprovalStatus;
  requestedBy: string;
}

const mockPOs: POItem[] = [
  { 
    id: '1', 
    docNum: generateDocNumber('PO', 125), 
    vendor: 'PT Global Steel', 
    project: 'Pabrik Kimia Cilegon', 
    totalValue: 'Rp 145.000.000', 
    date: '25 Jan 2026', 
    status: 'Pending',
    requestedBy: 'Andi (Procurement)'
  },
  { 
    id: '2', 
    docNum: generateDocNumber('PO', 124), 
    vendor: 'CV Elektrik Jaya', 
    project: 'Office Renovation', 
    totalValue: 'Rp 12.500.000', 
    date: '24 Jan 2026', 
    status: 'Approved',
    requestedBy: 'Siti (Staff)'
  },
  { 
    id: '3', 
    docNum: generateDocNumber('PO', 123), 
    vendor: 'PT Beton Utama', 
    project: 'Gudang Bekasi', 
    totalValue: 'Rp 89.000.000', 
    date: '23 Jan 2026', 
    status: 'Draft',
    requestedBy: 'Andi (Procurement)'
  },
];

export const PurchaseOrderModule: React.FC = () => {
  const [activePOs, setActivePOs] = useState(mockPOs);

  const handleApprove = (id: string) => {
    setActivePOs(prev => prev.map(po => 
      po.id === id ? { ...po, status: 'Approved' as ApprovalStatus } : po
    ));
  };

  const getStatusStyle = (status: ApprovalStatus) => {
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
          <p className="text-2xl font-black text-slate-900 mt-1">12 <span className="text-sm font-normal text-slate-400 text-sm">Dokumen</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total PO Bulan Ini</p>
          <p className="text-2xl font-black text-blue-600 mt-1">Rp 1.4B</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendor Aktif</p>
          <p className="text-2xl font-black text-slate-900 mt-1">48</p>
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
                      <span className="text-sm font-bold text-slate-900">{po.docNum}</span>
                      <span className="text-xs text-slate-500 font-medium">{po.vendor}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-700 font-medium">{po.project}</span>
                      <span className="text-[10px] text-slate-400 uppercase">REQ: {po.requestedBy}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-blue-600">{po.totalValue}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(po.status)}`}>
                      {po.status === 'Approved' && <CheckCircle size={12} />}
                      {po.status === 'Pending' && <Clock size={12} />}
                      {po.status === 'Rejected' && <XCircle size={12} />}
                      {po.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {po.status === 'Pending' && (
                        <button 
                          onClick={() => handleApprove(po.id)}
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
