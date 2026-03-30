import { Briefcase, TrendingUp } from "lucide-react";
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

type TrendDatum = {
  name: string;
  rev: number;
  exp: number;
};

type ProjectHealthDatum = {
  name: string;
  value: number;
  color: string;
};

interface ExecutiveDashboardChartsProps {
  trendData: TrendDatum[];
  projectHealth: ProjectHealthDatum[];
  totalProjects: number;
}

export default function ExecutiveDashboardCharts({
  trendData,
  projectHealth,
  totalProjects,
}: ExecutiveDashboardChartsProps) {
  return (
    <>
      <div className="lg:col-span-2 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md min-w-0">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h4 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
              <TrendingUp className="text-indigo-500" size={28} />
              Fiscan Performance Trend
            </h4>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
              Growth of Revenue vs Operational Expenses
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Revenue
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Expenses
              </span>
            </div>
          </div>
        </div>
        <div className="h-[350px] w-full min-w-0 min-h-0 overflow-hidden flex flex-col relative">
          <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={0}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 10, fontWeight: 900 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 10, fontWeight: 900 }}
                tickFormatter={(val) => `${val}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                }}
                itemStyle={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              />
              <Area
                type="monotone"
                dataKey="rev"
                stroke="#6366F1"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorRev)"
              />
              <Area
                type="monotone"
                dataKey="exp"
                stroke="#F43F5E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-1 bg-slate-900/30 p-12 rounded-[4rem] border border-white/5 backdrop-blur-md flex flex-col items-center min-w-0">
        <h4 className="text-xl font-black uppercase italic tracking-tighter text-white self-start mb-10 flex items-center gap-4">
          <Briefcase className="text-amber-500" size={28} />
          Project Portfolio
        </h4>
        <div className="h-64 w-full relative min-w-0 min-h-0 overflow-hidden flex flex-col">
          <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={projectHealth}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={8}
                dataKey="value"
              >
                {projectHealth.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-4xl font-black italic text-white leading-none">
              {totalProjects}
            </span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Projects
            </span>
          </div>
        </div>
        <div className="w-full mt-12 space-y-4">
          {projectHealth.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {item.name}
                </span>
              </div>
              <span className="text-sm font-black text-white italic">{item.value} Units</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
