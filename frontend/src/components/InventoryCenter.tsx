import React from 'react';
import { 
  Plus, 
  Search, 
  ArrowRight, 
  ArrowUpRight, 
  Box, 
  Layers, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

const inventoryData = [
  { 
    id: 'SKU-FG-001', 
    name: 'Anc Clip Ty.BM Dia. 12/120/163mm SUS 310', 
    category: 'Finished Goods', 
    stock: 610, 
    unit: 'Pcs', 
    value: 'Rp 54.717.000',
    status: 'In Production',
    sync: true 
  },
  { 
    id: 'SKU-FG-002', 
    name: 'Anc Y Spiral Dia. 10x270mm SUS 310', 
    category: 'Finished Goods', 
    stock: 324, 
    unit: 'Pcs', 
    value: 'Rp 27.864.000',
    status: 'Ready',
    sync: true 
  },
  { 
    id: 'SKU-FG-003', 
    name: 'Anc V claw Dia. 8x50mm SUS 310', 
    category: 'Finished Goods', 
    stock: 128, 
    unit: 'Pcs', 
    value: 'Rp 2.560.000',
    status: 'Ready',
    sync: true 
  },
  { 
    id: 'SKU-RM-001', 
    name: 'Stainless Steel SUS 310 Dia 8mm', 
    category: 'Raw Material', 
    stock: 450, 
    unit: 'Kg', 
    value: 'Rp 40.350.000',
    status: 'Healthy',
    sync: true 
  },
];

export function InventoryCenter() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Center</h2>
          <p className="text-neutral-500 text-sm">Real-time stock ledger PT Gema Teknik Perkasa.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm transition-all">
            <Plus size={16} />
            Add New Item
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Total SKUs</p>
            <p className="text-xl font-bold">124 Items</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Movement (24h)</p>
            <p className="text-xl font-bold">1,820 Units</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <Box size={24} />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Stock Value</p>
            <p className="text-xl font-bold">Rp 1.2B</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              className="w-full bg-neutral-50 border border-neutral-100 rounded-lg py-1.5 pl-9 pr-4 text-xs outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button className="text-xs font-semibold text-neutral-600 px-3 py-1.5 hover:bg-neutral-50 rounded-lg">All</button>
            <button className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">Low Stock</button>
            <button className="text-xs font-semibold text-neutral-600 px-3 py-1.5 hover:bg-neutral-50 rounded-lg">Finished Goods</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Available Stock</th>
                <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Est. Value</th>
                <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Conflict Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {inventoryData.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200">
                        <ImageWithFallback 
                          src="https://images.unsplash.com/photo-1697281679290-ad7be1b10682?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMHJhdyUyMG1hdGVyaWFsJTIwZmFjdG9yeXxlbnwxfHx8fDE3Njk2MTQ3ODZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 leading-tight">{item.name}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5 font-medium tracking-wider">{item.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.category === 'Raw Material' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900">{item.stock}</span>
                      <span className="text-[10px] text-neutral-500 font-medium">{item.unit}</span>
                      {item.stock < 500 && item.category === 'Raw Material' && (
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-neutral-600">{item.value}</span>
                  </td>
                  <td className="px-6 py-4">
                    {item.sync ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <ArrowUpRight size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Saman Identity</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-orange-500">
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">SKU Conflict</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors">
                      <ArrowRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
