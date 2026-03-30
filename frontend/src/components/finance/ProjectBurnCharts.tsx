import { Activity, Clock } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BurnRateDatum = {
  name: string;
  actual: number;
  projected: number;
  daily: number;
};

interface ProjectBurnChartsProps {
  burnRateTimeline: BurnRateDatum[];
  budget: number;
}

export default function ProjectBurnCharts({
  burnRateTimeline,
  budget,
}: ProjectBurnChartsProps) {
  return (
    <>
      <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic flex items-center gap-2">
            <Activity size={16} /> Cumulative Consumption vs Budget Baseline
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span className="text-[8px] font-black uppercase text-slate-400">Actual Cost</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-200 rounded-full border border-slate-300"></div>
              <span className="text-[8px] font-black uppercase text-slate-400">Budget Limit</span>
            </div>
          </div>
        </div>
        <div className="h-[400px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={burnRateTimeline}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 900 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 900 }}
                tickFormatter={(val) => `Rp ${val / 1000000}M`}
              />
              <Tooltip />
              <ReferenceLine
                y={budget}
                stroke="#EF4444"
                strokeDasharray="3 3"
                label={{
                  position: "right",
                  value: "BUDGET CAP",
                  fill: "#EF4444",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={4}
                fill="url(#colorActual)"
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#E2E8F0"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8 italic flex items-center gap-2">
          <Clock size={16} /> Weekly Expense Velocity
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={burnRateTimeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 900 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 900 }}
              />
              <Tooltip />
              <Bar dataKey="daily" radius={[10, 10, 0, 0]}>
                {burnRateTimeline.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index > 5 ? "#EF4444" : "#3B82F6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
