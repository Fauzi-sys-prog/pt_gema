import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../components/ui/chart";

const chartConfig = {
  totalIncome: {
    label: "Revenue",
    color: "#2563eb",
  },
  totalExpense: {
    label: "Expense",
    color: "#f43f5e",
  },
};

type LedgerTrendDatum = {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

interface GeneralLedgerTrendChartProps {
  financialData: LedgerTrendDatum[];
}

export default function GeneralLedgerTrendChart({
  financialData,
}: GeneralLedgerTrendChartProps) {
  return (
    <div className="lg:col-span-8 bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
          <TrendingUp className="text-blue-600" size={20} />
          Verified Cash Movement Analysis
        </h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
            <span className="text-[9px] font-black uppercase text-slate-400">Pemasukan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500 rounded-full" />
            <span className="text-[9px] font-black uppercase text-slate-400">Pengeluaran</span>
          </div>
        </div>
      </div>
      <div className="w-full h-[300px] lg:h-[400px] relative min-w-0">
        <ChartContainer config={chartConfig}>
          <AreaChart data={financialData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }}
            />
            <YAxis hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="totalIncome"
              stroke="#2563eb"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorIncome)"
            />
            <Area
              type="monotone"
              dataKey="totalExpense"
              stroke="#f43f5e"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorExpense)"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
