import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../contexts/AppContext";
import { api } from "../../services/api";
import { toast } from "sonner";
import {
  Receipt, Users, FileCheck2, Search, ChevronDown,
  Download, Eye, X, Printer, CheckCircle2, AlertCircle, Clock,
  BarChart3, FileText, BadgePercent, ShieldCheck, Info,
  TrendingUp, Building2, ArrowRight, ChevronRight, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

const PTKP_TABLE: Record<string, { label: string; amount: number }> = {
  "TK/0": { label: "Tidak Kawin, 0 tanggungan", amount: 54_000_000 },
  "TK/1": { label: "Tidak Kawin, 1 tanggungan", amount: 58_500_000 },
  "TK/2": { label: "Tidak Kawin, 2 tanggungan", amount: 63_000_000 },
  "TK/3": { label: "Tidak Kawin, 3 tanggungan", amount: 67_500_000 },
  "K/0":  { label: "Kawin, 0 tanggungan",        amount: 58_500_000 },
  "K/1":  { label: "Kawin, 1 tanggungan",         amount: 63_000_000 },
  "K/2":  { label: "Kawin, 2 tanggungan",         amount: 67_500_000 },
  "K/3":  { label: "Kawin, 3 tanggungan",         amount: 72_000_000 },
};

const BRACKETS = [
  { range: "s/d Rp 60 jt",              rate: 5,  hex: "#3b82f6", bg: "#eff6ff" },
  { range: "> Rp 60 jt – Rp 250 jt",   rate: 15, hex: "#10b981", bg: "#ecfdf5" },
  { range: "> Rp 250 jt – Rp 500 jt",  rate: 25, hex: "#f59e0b", bg: "#fffbeb" },
  { range: "> Rp 500 jt – Rp 5 M",     rate: 30, hex: "#ef4444", bg: "#fef2f2" },
  { range: "> Rp 5 miliar",             rate: 35, hex: "#8b5cf6", bg: "#f5f3ff" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)}M`
  : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000 ? `${(n / 1_000).toFixed(0)}rb`
  : String(n);

type Tab = "ringkasan" | "setoran" | "bukti-potong" | "spt-masa";

// ─── Avatar ──────────────────────────────────────────────────────────────────

const AV_COLORS = [
  ["#dbeafe","#1d4ed8"],["#dcfce7","#15803d"],["#fef9c3","#a16207"],
  ["#fce7f3","#be185d"],["#ede9fe","#6d28d9"],["#ffedd5","#c2410c"],
];

function EmpAvatar({ name, lg }: { name: string; lg?: boolean }) {
  const [bg, fg] = AV_COLORS[name.charCodeAt(0) % AV_COLORS.length];
  const sz = lg ? "w-11 h-11 text-sm rounded-xl" : "w-8 h-8 text-[11px] rounded-lg";
  return (
    <div className={`${sz} flex items-center justify-center font-black shrink-0`} style={{ background: bg, color: fg }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function RpTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-2xl text-[11px]">
      <p className="font-black mb-0.5 text-slate-300">{label}</p>
      <p className="font-black text-blue-300">{fmtRp(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function PPh21Page() {
  const { payrollRunList = [], employeeList = [] } = useApp() as any;

  const now = new Date();
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [ptkpFilter, setPtkpFilter] = useState("semua");
  const [detailSlip, setDetailSlip] = useState<any>(null);
  const [buktiModal, setBuktiModal] = useState<any>(null);
  const [filings, setFilings] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    api.request<any[]>("/finance-pph21-filings")
      .then((rows) => {
        if (active) setFilings(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error("Gagal memuat filing PPh21", err);
        if (active) setFilings([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const filingPeriod = (filing: any): string | null => {
    const raw = String(
      filing?.period ??
      filing?.taxPeriod ??
      filing?.masaPajak ??
      ""
    ).trim();

    if (/^\d{4}-\d{2}$/.test(raw)) return raw;

    const year = Number(filing?.year ?? filing?.taxYear);
    const month = Number(filing?.month ?? filing?.taxMonth);

    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12
    ) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }

    return null;
  };

  const filingIsPaid = (filing: any): boolean => {
    const status = String(
      filing?.depositStatus ??
      filing?.paymentStatus ??
      filing?.status ??
      ""
    ).trim().toUpperCase();

    return [
      "PAID",
      "SETTLED",
      "DEPOSITED",
      "LUNAS",
      "SUDAH SETOR",
      "SUDAH_SETOR",
    ].includes(status);
  };

  const paidPeriods = useMemo(() => {
    const periods = new Set<string>();

    filings.forEach((filing: any) => {
      const period = filingPeriod(filing);
      if (period && filingIsPaid(filing)) periods.add(period);
    });

    return periods;
  }, [filings]);

  const allRows = useMemo(() => {
    const rows: any[] = [];
    const finalStatuses = new Set(["APPROVED", "DISBURSED", "CLOSED"]);

    (payrollRunList as any[]).forEach((run: any) => {
      if (!finalStatuses.has(String(run?.status || "").toUpperCase())) return;

      const period = String(run?.period || "");
      const match = period.match(/^(\d{4})-(\d{2})$/);
      if (!match) return;

      const yr = Number(match[1]);
      const mo = Number(match[2]);

      (run.slips || []).forEach((slip: any) => {
        const emp = (employeeList as any[]).find(
          (e: any) =>
            e.id === slip.employeeId ||
            e.employeeId === slip.employeeId
        );

        const ptkpKey = emp?.ptkpStatus || "TK/0";
        const gross = Number(slip?.grossIncome ?? 0) || 0;
        const pph21 = Number(slip?.pph21 ?? 0) || 0;

        rows.push({
          id: `${run.id}-${slip.employeeId}`,
          runId: run.id,
          runNumber: run.runNumber,
          period,
          periodLabel: run.periodLabel,
          year: yr,
          month: mo,
          employeeId: slip.employeeId,
          employeeName: slip.employeeName,
          employeeNumber: slip.employeeNumber,
          position: slip.position,
          department: slip.department,
          npwp: emp?.npwp || "—",
          ptkpKey,
          grossIncome: gross,
          pph21,
          runStatus: run.status,
          disbursedAt: run.disbursedAt,
          taxDepositStatus: paidPeriods.has(period) ? "Paid" : "Pending",
        });
      });
    });

    return rows;
  }, [payrollRunList, employeeList, paidPeriods]);

  const yearRows = useMemo(
    () => allRows.filter((r: any) => r.year === selectedYear),
    [allRows, selectedYear]
  );

  const chartData = useMemo(() =>
    MONTH_NAMES.map((nm, i) => ({
      name: nm.slice(0, 3),
      pph21: yearRows
        .filter((r: any) => r.month === i + 1)
        .reduce((s: number, r: any) => s + r.pph21, 0),
    })), [yearRows]);

  const stats = useMemo(() => {
    const totalPph21 = yearRows.reduce((s: number, r: any) => s + r.pph21, 0);
    const totalGross = yearRows.reduce((s: number, r: any) => s + r.grossIncome, 0);
    const bulanAktif = new Set(yearRows.map((r: any) => r.month)).size;
    const karyawanUnik = new Set(yearRows.map((r: any) => r.employeeId)).size;
    const efRate = totalGross > 0 ? (totalPph21 / totalGross) * 100 : 0;
    return { totalPph21, totalGross, bulanAktif, karyawanUnik, efRate };
  }, [yearRows]);

  const monthRows = useMemo(() => {
    let r = yearRows.filter((row: any) => row.month === selectedMonth);

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row: any) =>
        row.employeeName?.toLowerCase().includes(q) ||
        row.department?.toLowerCase().includes(q) ||
        String(row.npwp ?? "").toLowerCase().includes(q)
      );
    }

    if (ptkpFilter !== "semua") {
      r = r.filter((row: any) => row.ptkpKey === ptkpFilter);
    }

    return r;
  }, [yearRows, selectedMonth, search, ptkpFilter]);

  const monthTotal = useMemo(
    () => monthRows.reduce((s: number, r: any) => s + r.pph21, 0),
    [monthRows]
  );

  const monthGross = useMemo(
    () => monthRows.reduce((s: number, r: any) => s + r.grossIncome, 0),
    [monthRows]
  );

  const sptRows = useMemo(() =>
    MONTH_NAMES.map((nm, i) => {
      const mo = i + 1;
      const rows = yearRows.filter((r: any) => r.month === mo);
      const isDisbursed =
        rows.length > 0 &&
        rows.every((r: any) => r.taxDepositStatus === "Paid");

      return {
        mo,
        nm,
        short: nm.slice(0, 3),
        total: rows.reduce((s: number, r: any) => s + r.pph21, 0),
        gross: rows.reduce((s: number, r: any) => s + r.grossIncome, 0),
        karyawan: new Set(rows.map((r: any) => r.employeeId)).size,
        hasRun: rows.length > 0,
        isDisbursed,
      };
    }), [yearRows]);

  const availableYears = useMemo(() => {
    const ys = new Set(allRows.map((r: any) => r.year));
    if (!ys.size) ys.add(now.getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [allRows]);

  const sudahSetor = sptRows.filter((s) => s.isDisbursed).length;
  const belumSetor = sptRows.filter((s) => s.hasRun && !s.isDisbursed).length;

  const calcDetail = (row: any) => {
    const ptkp = PTKP_TABLE[row.ptkpKey]?.amount ?? 54_000_000;
    const biayaJabatan = Math.min(row.grossIncome * 0.05, 500_000);
    const neto = row.grossIncome * 12 - biayaJabatan * 12;
    const pkp = Math.floor(Math.max(0, neto - ptkp) / 1000) * 1000;
    return { biayaJabatan, neto, pkp };
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>

      {/* ══ HERO HEADER ══ */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }} className="px-6 pt-8 pb-7">
        <div className="max-w-screen-xl mx-auto">

          {/* top row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                <Receipt size={24} className="text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-black text-white tracking-tight">PPh Pasal 21</h1>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
                    DATA PAYROLL
                  </span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>Data payroll & status setoran PPh 21</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="appearance-none py-2 pl-4 pr-8 rounded-xl text-sm font-bold text-white outline-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  {availableYears.map(y => <option key={y} value={y} className="text-slate-900 bg-white">{y}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.4)" }} />
              </div>
              <button
                onClick={() => toast.info("Ekspor SPT Masa masih dalam pengembangan.")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
                style={{ background: "#2563eb", boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}>
                <Download size={14} /> Ekspor SPT
              </button>
            </div>
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total PPh 21", val: fmtShort(stats.totalPph21), sub: `Tahun ${selectedYear}`, icon: <Receipt size={14} />, clr: "#93c5fd", brd: "rgba(59,130,246,0.25)" },
              { label: "Karyawan", val: String(stats.karyawanUnik), sub: "unik terpotong", icon: <Users size={14} />, clr: "#6ee7b7", brd: "rgba(16,185,129,0.25)" },
              { label: "Bulan Aktif", val: `${stats.bulanAktif}/12`, sub: `${sudahSetor} setor · ${belumSetor} proses`, icon: <CalendarDays size={14} />, clr: "#fde68a", brd: "rgba(245,158,11,0.25)" },
              { label: "Efektif Rate", val: `${stats.efRate.toFixed(2)}%`, sub: "PPh21 ÷ Gross", icon: <BadgePercent size={14} />, clr: "#c4b5fd", brd: "rgba(139,92,246,0.25)" },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${s.brd}` }}>
                <div className="flex items-center justify-center w-7 h-7 rounded-lg mb-3" style={{ background: "rgba(255,255,255,0.07)", color: s.clr }}>
                  {s.icon}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#64748b" }}>{s.label}</p>
                <p className="text-2xl font-black mt-0.5 leading-tight" style={{ color: s.clr }}>{s.val}</p>
                <p className="text-[10px] font-bold mt-0.5" style={{ color: "#475569" }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="max-w-screen-xl mx-auto px-6 flex overflow-x-auto scrollbar-none">
          {([
            { key: "ringkasan",    label: "Ringkasan",      icon: <BarChart3 size={13} /> },
            { key: "setoran",      label: "Daftar Setoran", icon: <FileText size={13} /> },
            { key: "bukti-potong", label: "Bukti Potong",   icon: <FileCheck2 size={13} /> },
            { key: "spt-masa",     label: "SPT Masa",       icon: <ShieldCheck size={13} /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
                tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ════ RINGKASAN ════ */}
        {tab === "ringkasan" && (
          <div className="space-y-5">

            {/* chart + brackets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* chart card */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tren Bulanan</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">PPh 21 per Bulan — {selectedYear}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahun {selectedYear}</p>
                    <p className="text-xl font-black text-blue-700">{fmtRp(stats.totalPph21)}</p>
                  </div>
                </div>

                {stats.totalPph21 === 0 ? (
                  <div className="h-52 flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <BarChart3 size={26} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-black text-slate-300 uppercase italic">Belum ada data payroll {selectedYear}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="32%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => fmtShort(v as number)} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<RpTooltip />} cursor={{ fill: "#f8fafc", rx: 8 }} />
                      <Bar dataKey="pph21" radius={[6, 6, 2, 2]} maxBarSize={36}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={
                            i + 1 === selectedMonth ? "#2563eb"
                            : i + 1 < selectedMonth ? "#93c5fd"
                            : "#dbeafe"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
                  {[
                    { dot: "bg-blue-600",   label: "Bulan dipilih" },
                    { dot: "bg-blue-300",   label: "Sudah lewat" },
                    { dot: "bg-blue-100",   label: "Belum diproses" },
                  ].map(l => (
                    <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span className={`w-2 h-2 rounded-full ${l.dot}`} />{l.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* tarif bracket */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Info size={13} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarif Progresif</p>
                    <p className="text-sm font-black text-slate-900">Pasal 17 UU HPP</p>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1">
                  {BRACKETS.map(b => (
                    <div key={b.rate} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: b.bg }}>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.hex }} />
                        {b.range}
                      </span>
                      <span className="text-sm font-black tabular-nums" style={{ color: b.hex }}>{b.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PTKP grid */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tabel PTKP 2024</p>
                  <p className="text-base font-black text-slate-900">Penghasilan Tidak Kena Pajak</p>
                </div>
                <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg">PMK 101/2016</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Object.entries(PTKP_TABLE).map(([k, v]) => {
                  const isK = k.startsWith("K/");
                  return (
                    <div key={k} className="rounded-xl p-3 text-center border" style={{
                      background: isK ? "#f0fdf4" : "#eff6ff",
                      borderColor: isK ? "#bbf7d0" : "#bfdbfe",
                    }}>
                      <p className="text-xs font-black" style={{ color: isK ? "#15803d" : "#1d4ed8" }}>{k}</p>
                      <p className="text-[11px] font-black text-slate-900 mt-1">{fmtShort(v.amount)}</p>
                      <p className="text-[8px] text-slate-400 leading-tight mt-0.5">{
                        v.label.replace("Tidak Kawin","TK").replace("Kawin","K").replace(" tanggungan","T")
                      }</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════ SETORAN ════ */}
        {tab === "setoran" && (
          <div className="space-y-4">

            {/* filter bar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-3 flex flex-col sm:flex-row gap-2" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="relative">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="appearance-none pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20">
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m} {selectedYear}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama karyawan, department, NPWP..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="relative">
                <select value={ptkpFilter} onChange={e => setPtkpFilter(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20">
                  <option value="semua">Semua PTKP</option>
                  {Object.keys(PTKP_TABLE).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* summary strip */}
            {monthRows.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { lbl: "Karyawan", val: String(monthRows.length), sub: "terpotong bulan ini", dark: false },
                  { lbl: "Total Gross", val: fmtShort(monthGross), sub: "sebelum potongan", dark: false },
                  { lbl: "Total PPh 21", val: fmtRp(monthTotal), sub: `${MONTH_NAMES[selectedMonth-1]} ${selectedYear}`, dark: true },
                ].map((s, i) => (
                  <div key={i} className={`rounded-2xl p-4 ${s.dark ? "text-white" : "bg-white border border-slate-100"}`}
                    style={s.dark ? { background: "#2563eb", boxShadow: "0 4px 14px rgba(37,99,235,0.25)" } : {}}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${s.dark ? "text-blue-200" : "text-slate-400"}`}>{s.lbl}</p>
                    <p className={`text-lg font-black italic mt-0.5 leading-tight ${s.dark ? "text-white" : "text-slate-900"}`}>{s.val}</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${s.dark ? "text-blue-200" : "text-slate-400"}`}>{s.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {monthRows.length === 0 ? (
                <div className="py-24 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Receipt size={28} className="text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-300 uppercase italic">Belum ada data PPh 21</p>
                    <p className="text-xs text-slate-300 mt-1">untuk {MONTH_NAMES[selectedMonth-1]} {selectedYear}</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["#","Karyawan","Dept","NPWP","PTKP","Gross Income","PPh 21","Status",""].map(h => (
                          <th key={h} className="px-5 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap first:w-8">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monthRows.map((row: any, idx: number) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-5 py-3.5 text-[10px] font-black text-slate-300">{idx + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <EmpAvatar name={row.employeeName} />
                              <div>
                                <p className="text-sm font-black text-slate-900 leading-tight">{row.employeeName}</p>
                                <p className="text-[10px] text-slate-400">{row.employeeNumber} · {row.position}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg whitespace-nowrap">{row.department}</span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">{row.npwp}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border whitespace-nowrap" style={
                              row.ptkpKey.startsWith("K/")
                                ? { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
                                : { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }
                            }>{row.ptkpKey}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm font-black text-slate-700 text-right whitespace-nowrap tabular-nums">{fmtRp(row.grossIncome)}</td>
                          <td className="px-5 py-3.5 text-sm font-black text-blue-700 text-right whitespace-nowrap tabular-nums">{fmtRp(row.pph21)}</td>
                          <td className="px-5 py-3.5">
                            {row.taxDepositStatus === "Paid"
                              ? <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border" style={{ background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }}><CheckCircle2 size={9} />Setor</span>
                              : <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border" style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}><Clock size={9} />Proses</span>
                            }
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setDetailSlip(row)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Detail">
                                <Eye size={13} />
                              </button>
                              <button onClick={() => setBuktiModal(row)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all" title="Bukti Potong">
                                <FileCheck2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={5} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">
                          Total · {MONTH_NAMES[selectedMonth-1]} {selectedYear}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-black text-slate-900 text-right tabular-nums">{fmtRp(monthGross)}</td>
                        <td className="px-5 py-3.5 text-sm font-black text-blue-700 text-right tabular-nums">{fmtRp(monthTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ BUKTI POTONG ════ */}
        {tab === "bukti-potong" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="appearance-none pl-4 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none cursor-pointer shadow-sm">
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m} {selectedYear}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-400">{monthRows.length} karyawan</span>
            </div>

            {monthRows.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-24 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <FileCheck2 size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-300 uppercase italic">Belum ada data payroll bulan ini</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthRows.map((row: any) => (
                  <div key={row.id} onClick={() => setBuktiModal(row)}
                    className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-blue-200 transition-all cursor-pointer group"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-start justify-between mb-4">
                      <EmpAvatar name={row.employeeName} lg />
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full border" style={
                        row.ptkpKey.startsWith("K/")
                          ? { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
                          : { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }
                      }>{row.ptkpKey}</span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{row.employeeName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{row.position} · {row.department}</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">PPh 21 / Bulan</p>
                        <p className="text-base font-black text-blue-700">{fmtRp(row.pph21)}</p>
                      </div>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all group-hover:bg-blue-600 bg-blue-50">
                        <ChevronRight size={14} className="text-blue-400 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ SPT MASA ════ */}
        {tab === "spt-masa" && (
          <div className="space-y-4">

            {/* summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { lbl: "Sudah Setor", val: sudahSetor, icon: <CheckCircle2 size={14} />, bg: "#f0fdf4", clr: "#15803d", brd: "#bbf7d0" },
                { lbl: "Belum Setor",  val: belumSetor, icon: <AlertCircle size={14} />,  bg: "#fffbeb", clr: "#b45309", brd: "#fde68a" },
                { lbl: "Belum Ada Data", val: 12 - sudahSetor - belumSetor, icon: <Clock size={14} />, bg: "#f8fafc", clr: "#64748b", brd: "#e2e8f0" },
              ].map(s => (
                <div key={s.lbl} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: s.bg, borderColor: s.brd, color: s.clr }}>
                  {s.icon}
                  <div>
                    <p className="text-xs font-black">{s.lbl}</p>
                    <p className="text-2xl font-black leading-tight">{s.val} <span className="text-sm font-bold opacity-60">bln</span></p>
                  </div>
                </div>
              ))}
            </div>

            {/* 12-month list */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SPT Masa PPh 21</p>
                  <p className="text-base font-black text-slate-900">Tahun Pajak {selectedYear}</p>
                </div>
                <p className="text-lg font-black text-blue-700">{fmtRp(sptRows.reduce((s, r) => s + r.total, 0))}</p>
              </div>

              <div className="divide-y divide-slate-50">
                {sptRows.map((spt, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0" style={{
                      background: spt.isDisbursed ? "#dcfce7" : spt.hasRun ? "#fef9c3" : "#f1f5f9",
                    }}>
                      <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: spt.isDisbursed ? "#15803d" : spt.hasRun ? "#b45309" : "#94a3b8" }}>
                        {spt.short}
                      </span>
                      <span className="text-base font-black leading-tight" style={{ color: spt.isDisbursed ? "#15803d" : spt.hasRun ? "#b45309" : "#94a3b8" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900">{spt.nm} {selectedYear}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border" style={
                          spt.isDisbursed ? { background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }
                          : spt.hasRun ? { background: "#fef9c3", color: "#b45309", borderColor: "#fde68a" }
                          : { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
                        }>
                          {spt.isDisbursed ? <CheckCircle2 size={9} /> : spt.hasRun ? <AlertCircle size={9} /> : <Clock size={9} />}
                          {spt.isDisbursed ? "Sudah Setor" : spt.hasRun ? "Belum Setor" : "Belum Ada Data"}
                        </span>
                      </div>
                      {spt.hasRun && (
                        <div className="flex items-center gap-4 mt-0.5">
                          <p className="text-[10px] text-slate-400"><span className="font-bold">Karyawan:</span> {spt.karyawan}</p>
                          <p className="text-[10px] text-slate-400"><span className="font-bold">Gross:</span> {fmtShort(spt.gross)}</p>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black tabular-nums ${spt.total > 0 ? "text-blue-700" : "text-slate-300"}`}>
                        {spt.total > 0 ? fmtRp(spt.total) : "—"}
                      </p>
                      {spt.hasRun && (
                        <button onClick={() => { setSelectedMonth(spt.mo); setTab("setoran"); }}
                          className="inline-flex items-center gap-0.5 text-[10px] font-black text-blue-500 hover:text-blue-700 transition-colors mt-0.5">
                          Detail <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-blue-100 flex items-center justify-between" style={{ background: "linear-gradient(90deg, #eff6ff, #f0f9ff)" }}>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total PPh 21 · {selectedYear}</p>
                  <p className="text-[10px] text-blue-400 font-bold mt-0.5">{sptRows.filter(s => s.hasRun).length} dari 12 bulan diproses</p>
                </div>
                <p className="text-2xl font-black text-blue-700">{fmtRp(sptRows.reduce((s, r) => s + r.total, 0))}</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ══ DETAIL SLIP MODAL ══ */}
      {detailSlip && (() => {
        const d = calcDetail(detailSlip);
        return (
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90vh]" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <EmpAvatar name={detailSlip.employeeName} lg />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ilustrasi Perhitungan</p>
                    <p className="text-base font-black text-slate-900">{detailSlip.employeeName}</p>
                  </div>
                </div>
                <button onClick={() => setDetailSlip(null)} className="w-8 h-8 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-xl flex items-center justify-center transition-all">
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Periode",      detailSlip.periodLabel],
                    ["No. Karyawan", detailSlip.employeeNumber],
                    ["Jabatan",      detailSlip.position],
                    ["Departemen",   detailSlip.department],
                    ["NPWP",         detailSlip.npwp],
                    ["Status PTKP",  `${detailSlip.ptkpKey} · ${PTKP_TABLE[detailSlip.ptkpKey]?.label ?? "—"}`],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l}</p>
                      <p className="text-xs font-black text-slate-900 mt-0.5 leading-tight">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Ilustrasi tampilan — bukan perhitungan pajak final</p>
                  <div className="space-y-2.5">
                    {[
                      ["Gross Income / Bulan",           fmtRp(detailSlip.grossIncome)],
                      ["Gross Income Setahun (×12)",      fmtRp(detailSlip.grossIncome * 12)],
                      ["Biaya Jabatan (maks Rp500rb)",   fmtRp(d.biayaJabatan)],
                      ["Penghasilan Neto Setahun",        fmtRp(d.neto)],
                      ["PTKP",                           fmtRp(PTKP_TABLE[detailSlip.ptkpKey]?.amount ?? 0)],
                      ["PKP (dibulatkan ribuan)",         fmtRp(d.pkp)],
                    ].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">{l}</span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">{v}</span>
                      </div>
                    ))}
                    <div className="pt-3 mt-1 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-sm font-black text-blue-700">PPh 21 / Bulan</span>
                      <span className="text-xl font-black text-blue-700">{fmtRp(detailSlip.pph21)}</span>
                    </div>
                  </div>
                </div>

                <button onClick={() => { setDetailSlip(null); setBuktiModal(detailSlip); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white uppercase tracking-widest transition-all hover:opacity-90"
                  style={{ background: "#1e293b" }}>
                  <FileCheck2 size={14} /> Lihat Bukti Potong 1721-A1
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ BUKTI POTONG MODAL ══ */}
      {buktiModal && (() => {
        const d = calcDetail(buktiModal);
        return (
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90vh]" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bukti Pemotongan PPh Pasal 21</p>
                  <p className="text-base font-black text-slate-900">Pratinjau 1721-A1</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toast.info("Cetak bukti potong masih dalam pengembangan.")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                    <Printer size={12} /> Cetak
                  </button>
                  <button onClick={() => setBuktiModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-xl flex items-center justify-center transition-all">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="border border-slate-200 rounded-2xl overflow-hidden">

                  {/* doc header */}
                  <div className="px-6 py-5 text-center" style={{ background: "#0f172a" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#64748b" }}>Bukti Pemotongan Pajak Penghasilan</p>
                    <p className="text-xl font-black text-white mt-1">Pasal 21 · Pratinjau 1721-A1</p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <span className="text-[10px] font-bold" style={{ color: "#475569" }}>Masa: {buktiModal.periodLabel}</span>
                      <span style={{ color: "#334155" }}>·</span>
                      <span className="text-[10px] font-bold" style={{ color: "#475569" }}>Tahun Pajak: {buktiModal.year}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* A. Pemotong */}
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Building2 size={10} /> A. Identitas Pemotong Pajak
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[["Nama Perusahaan","PT Gema Teknik Perkasa"],["NPWP Perusahaan","Belum diisi"]].map(([l, v]) => (
                          <div key={l} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{l}</p>
                            <p className="text-xs font-black text-slate-900 mt-0.5">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* B. Penerima */}
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Users size={10} /> B. Identitas Penerima Penghasilan
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["Nama",        buktiModal.employeeName],
                          ["NPWP",        buktiModal.npwp],
                          ["No. Karyawan",buktiModal.employeeNumber],
                          ["Status PTKP", `${buktiModal.ptkpKey} — ${PTKP_TABLE[buktiModal.ptkpKey]?.label ?? "—"}`],
                        ].map(([l, v]) => (
                          <div key={l} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{l}</p>
                            <p className="text-xs font-black text-slate-900 mt-0.5">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* C. Rincian */}
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <TrendingUp size={10} /> C. Rincian Penghasilan &amp; Pemotongan
                      </p>
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        {[
                          ["1", "Penghasilan Bruto / Bulan",              fmtRp(buktiModal.grossIncome),                              false],
                          ["2", "Penghasilan Bruto Setahun (×12)",         fmtRp(buktiModal.grossIncome * 12),                        false],
                          ["3", "Biaya Jabatan (5%, maks Rp 500rb/bln)",  fmtRp(d.biayaJabatan),                                    false],
                          ["4", "Penghasilan Neto Setahun",               fmtRp(d.neto),                                             false],
                          ["5", "PTKP",                                   fmtRp(PTKP_TABLE[buktiModal.ptkpKey]?.amount ?? 0),        false],
                          ["6", "PKP (dibulatkan ribuan)",                fmtRp(d.pkp),                                              false],
                          ["7", "PPh 21 Setahun (tarif progresif)",       fmtRp(buktiModal.pph21 * 12),                              false],
                          ["8", "PPh 21 Sebulan — Masa Pajak Ini",        fmtRp(buktiModal.pph21),                                   true],
                        ].map(([no, label, val, hl]) => (
                          <div key={no as string} className={`flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0 ${hl ? "bg-blue-600" : ""}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black w-4 shrink-0 ${hl ? "text-blue-200" : "text-slate-300"}`}>{no}.</span>
                              <span className={`text-[11px] font-bold ${hl ? "text-white" : "text-slate-700"}`}>{label}</span>
                            </div>
                            <span className={`text-[11px] font-black tabular-nums ${hl ? "text-white" : "text-slate-900"}`}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* footer */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] text-slate-400 font-black">Dicetak: {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>
                        <p className="text-[8px] text-slate-300 mt-0.5">Contoh tampilan — bukan bukti potong resmi</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Pemotong Pajak,</p>
                        <div className="w-28 h-12 border border-dashed border-slate-200 rounded-xl mt-1 flex items-center justify-center bg-slate-50">
                          <p className="text-[8px] text-slate-300 italic">ttd &amp; cap</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
