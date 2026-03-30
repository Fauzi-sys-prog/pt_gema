import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart";

type SalesRevenueDatum = {
  month: string;
  omzet: number;
  prevYear: number;
  target: number;
};

interface SalesRevenueComparisonChartProps {
  monthlyData: SalesRevenueDatum[];
  yearNow: number;
  yearPrev: number;
  formatShortIDR: (value: number) => string;
}

const chartConfig = {
  omzet: {
    label: "Omzet Berjalan",
    color: "#2563eb",
  },
  prevYear: {
    label: "Omzet Tahun Lalu",
    color: "#cbd5e1",
  },
};

export default function SalesRevenueComparisonChart({
  monthlyData,
  yearNow,
  yearPrev,
  formatShortIDR,
}: SalesRevenueComparisonChartProps) {
  return (
    <div className="bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm min-w-0">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <span className="text-sm font-black uppercase tracking-widest">Omzet</span>
          </div>
          <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900">
            Yearly Revenue Comparison ({yearNow} vs {yearPrev})
          </h3>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-4 mr-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-sm" />
              <span className="text-[10px] font-black text-slate-600 uppercase">{yearNow}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-300 rounded-sm" />
              <span className="text-[10px] font-black text-slate-600 uppercase">{yearPrev}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-[300px] lg:h-[400px] relative min-w-0">
        <ChartContainer config={chartConfig} className="h-full">
          <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }}
              tickFormatter={(value) => formatShortIDR(Number(value))}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="omzet"
              name={String(yearNow)}
              fill="#2563eb"
              radius={[6, 6, 0, 0]}
              barSize={40}
            />
            <Bar
              dataKey="prevYear"
              name={String(yearPrev)}
              fill="#cbd5e1"
              radius={[6, 6, 0, 0]}
              barSize={40}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
