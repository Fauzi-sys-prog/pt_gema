import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PpnTrendDatum = {
  name: string;
  keluaran: number;
  masukan: number;
};

interface PpnTrendChartProps {
  chartData: PpnTrendDatum[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

export default function PpnTrendChart({ chartData }: PpnTrendChartProps) {
  return (
    <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-red-600" size={24} />
            Fiscan Trend Analysis
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Perbandingan PPN Bulanan
          </p>
        </div>
        <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-red-500">
          <option>Filter Tahun 2026</option>
        </select>
      </div>
      <div className="h-[300px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
        <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: "bold" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: "bold" }}
              tickFormatter={(val) => `Rp ${val / 1000000}M`}
            />
            <Tooltip
              cursor={{ fill: "#F8FAFC" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-800">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-2">
                        {payload[0].payload.name}
                      </p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-[10px] font-bold text-white uppercase">
                            {p.name}: {formatCurrency(p.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              name="Keluaran"
              dataKey="keluaran"
              fill="#EF4444"
              radius={[4, 4, 0, 0]}
              barSize={25}
            />
            <Bar
              name="Masukan"
              dataKey="masukan"
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
              barSize={25}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
