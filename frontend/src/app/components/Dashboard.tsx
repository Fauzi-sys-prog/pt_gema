import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { TrendingUp, Package, AlertCircle, CheckCircle } from 'lucide-react';

const demandData = [
  { name: 'Anc. Clip BM 12mm', stok: 610, butuh: 860 },
  { name: 'Anc. Y Spiral 10mm', stok: 324, butuh: 324 },
  { name: 'Anc. V Claw 8mm', stok: 128, butuh: 128 },
  { name: 'SUS 310 8mm', stok: 450, butuh: 1500 },
];

const productionTrend = [
  { day: 'Sen', qty: 120 },
  { day: 'Sel', qty: 340 },
  { day: 'Rab', qty: 210 },
  { day: 'Kam', qty: 450 },
  { day: 'Jum', qty: 380 },
  { day: 'Sab', qty: 150 },
];

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">GTP Control Center</h2>
          <p className="text-neutral-500">Status real-time workshop & inventori.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-neutral-200 text-neutral-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-50">
            Export Report
          </button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm transition-shadow">
            New Work Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total PO Aktif" 
          value="1,312 Pcs" 
          subValue="+12% dr minggu lalu" 
          icon={<Package className="text-blue-600" />} 
          color="blue"
        />
        <KPICard 
          title="Progres Produksi" 
          value="68%" 
          subValue="On Schedule" 
          icon={<TrendingUp className="text-green-600" />} 
          color="green"
        />
        <KPICard 
          title="Conflict Awareness" 
          value="2 Alert" 
          subValue="Perlu Sinkronisasi SKU" 
          icon={<AlertCircle className="text-orange-600" />} 
          color="orange"
        />
        <KPICard 
          title="Status Pengiriman" 
          value="Pending" 
          subValue="Menunggu Packing LHP" 
          icon={<CheckCircle className="text-neutral-600" />} 
          color="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Demand Analysis Chart */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Demand Analysis (Stock vs PO)</h3>
            <span className="text-xs text-neutral-400">Update 5 menit lalu</span>
          </div>
          <div className="h-80 w-full overflow-hidden min-w-0 min-h-0 flex flex-col relative">
            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
              <BarChart data={demandData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="stok" name="Stok Fisik" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="butuh" name="Kebutuhan PO" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Production Trend */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Tren Hasil Produksi LHP</h3>
            <select className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none">
              <option>Minggu Ini</option>
              <option>Bulan Ini</option>
            </select>
          </div>
          <div className="h-80 w-full overflow-hidden min-w-0 min-h-0 flex flex-col relative">
            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
              <AreaChart data={productionTrend}>
                <defs>
                  <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="qty" stroke="#ef4444" fillOpacity={1} fill="url(#colorQty)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subValue, icon, color }) {
  const bgColors = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    neutral: 'bg-neutral-50',
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${bgColors[color]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Live</span>
      </div>
      <div className="mt-4">
        <h4 className="text-neutral-500 text-sm font-medium">{title}</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <p className={`text-[11px] mt-1 font-medium ${subValue.includes('Conflict') ? 'text-red-600' : 'text-neutral-400'}`}>
          {subValue}
        </p>
      </div>
    </div>
  );
}
