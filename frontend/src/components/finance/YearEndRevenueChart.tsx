import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type YearEndRevenueDatum = {
  month: string;
  rev: number;
  outflow: number;
  profit: number;
  idx: number;
};

interface YearEndRevenueChartProps {
  monthlyRevData: YearEndRevenueDatum[];
}

export default function YearEndRevenueChart({ monthlyRevData }: YearEndRevenueChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={monthlyRevData}>
          <defs>
            <linearGradient id="colorRevYE" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 900 }}
          />
          <Tooltip />
          <Area type="monotone" dataKey="rev" stroke="#3b82f6" strokeWidth={4} fill="url(#colorRevYE)" />
          <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
