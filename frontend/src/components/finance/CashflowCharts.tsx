import { PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthlyCashflowDatum = {
  key?: string;
  month: string;
  inflow: number;
  outflow: number;
};

type PieDatum = {
  name: string;
  value: number;
  color: string;
};

interface CashflowChartsProps {
  monthlyCashflow: MonthlyCashflowDatum[];
  pieData: PieDatum[];
  totalOutflow: number;
}

export default function CashflowCharts({
  monthlyCashflow,
  pieData,
  totalOutflow,
}: CashflowChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 italic">
            <TrendingUp size={14} /> Cashflow Trend Analysis
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Inflow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Outflow</span>
            </div>
          </div>
        </div>
        <div className="h-80 w-full overflow-hidden min-w-0 min-height-0 flex flex-col relative">
          {monthlyCashflow.length > 0 ? (
            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
              <AreaChart data={monthlyCashflow}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 900 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 900 }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => `Rp ${Number(value).toLocaleString("id-ID")}`}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIn)"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorOut)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Belum ada tren cashflow
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tambah transaksi finance supaya grafik terisi.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex flex-col">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2 italic">
          <PieChartIcon size={14} /> Outflow Breakdown
        </h3>
        <div className="flex-1 flex items-center justify-center min-w-0 min-h-0 relative flex-col h-[240px]">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => `Rp ${Number(value).toLocaleString("id-ID")}`}
                  contentStyle={{ borderRadius: "16px", border: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[240px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Belum ada breakdown outflow
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Outflow akan muncul otomatis dari expense, payroll, dan payment vendor.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4 mt-8">
          {pieData.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Belum ada kategori outflow untuk diringkas.
            </div>
          )}
          {pieData.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-10 rounded-full" style={{ backgroundColor: item.color }} />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {item.name}
                  </p>
                  <p className="text-xs font-black text-slate-900 italic">
                    Rp {(item.value / 1000000).toFixed(1)}M
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-400">
                {totalOutflow > 0 ? ((item.value / totalOutflow) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
