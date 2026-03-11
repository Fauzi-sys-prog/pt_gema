import React from 'react';
import { 
  FileText, 
  ShoppingCart, 
  Truck, 
  Clock, 
  CheckCircle, 
  MoreHorizontal,
  ExternalLink,
  Plus,
  ShieldCheck
} from 'lucide-react';

const poData = [
  { 
    id: '2244513789', 
    supplier: 'PT Indoporlen', 
    date: '14 May 2024', 
    deliveryDate: '18 May 2024',
    total: 'Rp 77.142.000', 
    status: 'SHIPPED',
    items: [
      { name: 'Anc. Clip Ty. BM Ø12/120/163mm AISI 310', qty: 860, price: 'Rp 89.700' }
    ]
  },
  { 
    id: 'FG-04324', 
    supplier: 'PT Shinagawa Refractories Indonesia', 
    date: '16 May 2024', 
    deliveryDate: '20 May 2024',
    total: 'Rp 33.770.640', 
    status: 'PENDING',
    items: [
      { name: 'SS ANCHOR SUS-310 Type Y Spiral Ø10 x 270mm + Cap', qty: 324, price: 'Rp 86.000' },
      { name: 'SS ANCHOR SUS-310 Type V Rev. Claw Ø8 x 50mm + Cap', qty: 128, price: 'Rp 20.000' }
    ]
  },
];

export const Procurement = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Procurement & PO Center</h1>
          <p className="text-slate-500">Linear flow from Purchase Order to Inventory Receipt</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
          <Plus size={18} /> Create Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Awaiting Approval', value: '2', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'In Transit', value: '1', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Received Successfully', value: '42', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 px-2">
          <Clock size={18} className="text-slate-400" /> Active Transaction Stream
        </h3>
        
        {poData.map((po) => (
          <div key={po.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-red-200 transition-all group">
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <ShoppingCart size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 uppercase">PO #{po.id}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        po.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {po.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 font-bold mt-1 uppercase tracking-tight">{po.supplier}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{po.total}</p>
                  <p className="text-xs text-slate-400 mt-1">Issue Date: {po.date}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <table className="w-full text-left text-[10px] font-bold uppercase">
                  <thead>
                    <tr className="text-slate-400 tracking-wider">
                      <th className="pb-3 px-2">Item Specification</th>
                      <th className="pb-3 text-center">Quantity</th>
                      <th className="pb-3 text-right pr-2">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {po.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="py-3 px-2 text-slate-900">{item.name}</td>
                        <td className="py-3 text-center">{item.qty.toLocaleString()} PCS</td>
                        <td className="py-3 text-right pr-2">{item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">
                    <ShieldCheck size={12} /> VERIFIED BY ERP
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Linked to Inventory SKU: RM-SUS-310</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                    <ExternalLink size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
