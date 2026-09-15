import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  Briefcase,
  Hammer,
  Package,
  Calculator,
  Wallet,
  Mail,
  Truck,
  Users,
  Settings,
  Box,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Layers,
} from "lucide-react";

interface Page {
  label: string;
  path: string;
  note?: string;
}

interface Module {
  id: string;
  name: string;
  accent: string;
  text: string;
  border: string;
  icon: ReactNode;
  pages: Page[];
}

const MODULES: Module[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    accent: "bg-slate-700",
    text: "text-slate-100",
    border: "border-slate-600",
    icon: <LayoutDashboard size={14} />,
    pages: [
      { label: "Main Dashboard", path: "/dashboard" },
      {
        label: "Executive Dashboard",
        path: "/finance/executive-dashboard",
      },
      { label: "HR Dashboard", path: "/hr/dashboard" },
      { label: "Production Dashboard", path: "/produksi/dashboard" },
    ],
  },
  {
    id: "sales",
    name: "Sales & Commercial",
    accent: "bg-violet-600",
    text: "text-violet-100",
    border: "border-violet-500",
    icon: <Calculator size={14} />,
    pages: [
      { label: "Data Collection / Survey", path: "/data-collection" },
      { label: "Quotation Management", path: "/sales/quotation" },
      {
        label: "Quotation Approval",
        path: "/sales/quotation-approval",
      },
      { label: "Quotation Hub", path: "/sales/quotation-hub" },
      { label: "Penawaran / RAB", path: "/sales/penawaran" },
      { label: "Automated Invoicing", path: "/sales/auto-invoice" },
      { label: "Sales Analytics", path: "/sales/analytics" },
    ],
  },
  {
    id: "project",
    name: "Project Management",
    accent: "bg-blue-600",
    text: "text-blue-100",
    border: "border-blue-500",
    icon: <Briefcase size={14} />,
    pages: [
      { label: "Project Ledger", path: "/project" },
      { label: "Detail › Overview", path: "/project", note: "tab" },
      { label: "Detail › BOQ", path: "/project", note: "tab" },
      { label: "Detail › Work Order", path: "/project", note: "tab" },
      { label: "Detail › Field Records", path: "/project", note: "tab" },
      { label: "Detail › Vendor Biaya", path: "/project", note: "tab" },
      { label: "Detail › Invoice", path: "/project", note: "tab" },
      { label: "Detail › Biaya Kerja", path: "/project", note: "tab" },
      {
        label: "Project P&L",
        path: "/finance/project-analysis",
      },
      {
        label: "Tambahan Biaya Proyek",
        path: "/finance/tambahan-biaya-proyek",
      },
    ],
  },
  {
    id: "production",
    name: "Produksi",
    accent: "bg-orange-500",
    text: "text-orange-100",
    border: "border-orange-400",
    icon: <Hammer size={14} />,
    pages: [
      {
        label: "Production Control Center",
        path: "/produksi/dashboard",
      },
      { label: "Work Order / LHP", path: "/produksi/report" },
      {
        label: "Laporan Harian (Legacy)",
        path: "/produksi/laporan-harian",
        note: "legacy",
      },
      {
        label: "Timeline & Tracker",
        path: "/produksi/timeline",
      },
      { label: "Gantt Chart", path: "/produksi/gantt" },
      { label: "Quality Control (QC)", path: "/produksi/qc" },
      {
        label: "SPK",
        path: "/surat-menyurat/spk",
        note: "lembur",
      },
      { label: "Production Guide", path: "/produksi/guide" },
    ],
  },
  {
    id: "supply",
    name: "Supply Chain",
    accent: "bg-teal-600",
    text: "text-teal-100",
    border: "border-teal-500",
    icon: <Package size={14} />,
    pages: [
      {
        label: "Purchase Order",
        path: "/purchasing/purchase-order",
      },
      {
        label: "Receiving (GR)",
        path: "/purchasing/receiving",
      },
      { label: "Stok Masuk", path: "/inventory/stock-in" },
      { label: "Stok Keluar / Issue", path: "/inventory/stock-out" },
      { label: "Monitoring Gudang", path: "/inventory/center" },
      {
        label: "Stock Journal",
        path: "/inventory/stock-journal",
      },
      { label: "Stock Report", path: "/inventory/stock-report" },
      {
        label: "Stock Card Detail",
        path: "/inventory/stock-card/:id",
        note: "dynamic",
      },
      {
        label: "Traceability",
        path: "/inventory/traceability",
      },
      { label: "Stock Aging", path: "/inventory/aging" },
      { label: "Stock Opname", path: "/inventory/opname" },
    ],
  },
  {
    id: "logistics",
    name: "Logistics",
    accent: "bg-rose-600",
    text: "text-rose-100",
    border: "border-rose-500",
    icon: <Truck size={14} />,
    pages: [
      {
        label: "Logistics Command Center",
        path: "/logistics/hub",
      },
      {
        label: "Delivery Tracking",
        path: "/logistics/delivery/:id",
        note: "dynamic",
      },
      {
        label: "Surat Jalan / DO",
        path: "/surat-menyurat/surat-jalan",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance & Ledger",
    accent: "bg-emerald-600",
    text: "text-emerald-100",
    border: "border-emerald-500",
    icon: <Wallet size={14} />,
    pages: [
      {
        label: "Cashflow Command Center",
        path: "/finance/cashflow-command",
      },
      {
        label: "Financial Approval Center",
        path: "/finance/approvals",
      },
      { label: "General Ledger", path: "/finance/ledger" },
      {
        label: "Buku Hutang / AP",
        path: "/finance/accounts-payable",
      },
      {
        label: "Piutang / AR",
        path: "/finance/accounts-receivable",
      },
      { label: "Aging AR", path: "/finance/aging-ar" },
      {
        label: "Bank Reconciliation",
        path: "/finance/bank-reconciliation",
      },
      {
        label: "Petty Cash Kantor",
        path: "/finance/petty-cash",
      },
      {
        label: "Petty Cash Gudang",
        path: "/finance/petty-cash-gudang",
      },
      { label: "Laporan PPN", path: "/finance/ppn" },
      {
        label: "Payroll Report",
        path: "/finance/payroll-report",
      },
      { label: "Year-End Closing", path: "/finance/year-end" },
    ],
  },
  {
    id: "correspondence",
    name: "Correspondence",
    accent: "bg-sky-600",
    text: "text-sky-100",
    border: "border-sky-500",
    icon: <Mail size={14} />,
    pages: [
      {
        label: "Dashboard Surat",
        path: "/surat-menyurat/dashboard",
      },
      {
        label: "Surat Masuk",
        path: "/surat-menyurat/surat-masuk",
      },
      {
        label: "Surat Keluar",
        path: "/surat-menyurat/surat-keluar",
      },
      {
        label: "Berita Acara",
        path: "/surat-menyurat/berita-acara",
      },
      {
        label: "Surat Jalan (DO)",
        path: "/surat-menyurat/surat-jalan",
      },
      {
        label: "Surat Perintah Kerja",
        path: "/surat-menyurat/spk",
      },
    ],
  },
  {
    id: "asset",
    name: "Asset & Fleet",
    accent: "bg-amber-500",
    text: "text-amber-100",
    border: "border-amber-400",
    icon: <Box size={14} />,
    pages: [
      { label: "Daftar Asset", path: "/asset/equipment" },
      {
        label: "Fleet Maintenance",
        path: "/asset/maintenance",
      },
      { label: "Rental Out", path: "/asset/rental-out" },
      {
        label: "Internal Usage",
        path: "/asset/internal-usage",
      },
    ],
  },
  {
    id: "hr",
    name: "Human Capital",
    accent: "bg-indigo-600",
    text: "text-indigo-100",
    border: "border-indigo-500",
    icon: <Users size={14} />,
    pages: [
      { label: "Master Karyawan", path: "/hr/karyawan" },
      {
        label: "Kehadiran Hari Ini",
        path: "/hr/attendance-today",
      },
      {
        label: "Rekap Kehadiran",
        path: "/hr/attendance-recap",
      },
      { label: "Cuti & Izin", path: "/hr/cuti" },
      { label: "Lembur", path: "/hr/lembur" },
      { label: "Shift Management", path: "/hr/shift" },
      { label: "THL / Harian Lepas", path: "/hr/thl" },
      {
        label: "Timesheet THL",
        path: "/hr/thl-timesheet",
      },
      { label: "Gajian THL", path: "/hr/gajian-thl" },
      {
        label: "Kasbon Karyawan",
        path: "/hr/employee-advance",
      },
      { label: "Kas Koperasi", path: "/hr/kas-koperasi" },
      { label: "Tunjangan", path: "/hr/tunjangan" },
      { label: "Proses Payroll", path: "/hr/payroll-pro" },
      { label: "Payroll Policy", path: "/hr/payroll-policy" },
      {
        label: "Payroll Slip",
        path: "/hr/payroll-slip/:runId/:employeeId",
        note: "dynamic",
      },
      { label: "Resign & Offboarding", path: "/hr/resign" },
      { label: "Laporan HR", path: "/hr/laporan" },
    ],
  },
  {
    id: "settings",
    name: "Settings & Admin",
    accent: "bg-slate-600",
    text: "text-slate-100",
    border: "border-slate-500",
    icon: <Settings size={14} />,
    pages: [
      {
        label: "User Management",
        path: "/settings/user-management",
      },
      {
        label: "Audit Trail (Forensic)",
        path: "/settings/audit-trail",
      },
      { label: "System Wireframe", path: "/wireframe" },
    ],
  },
];

interface FlowNode {
  id: string;
  label: string;
  sub?: string;
  path?: string;
  module: string;
  col: number;
  row: number;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const FLOW_NODES: FlowNode[] = [
  {
    id: "survey",
    label: "Data Collection",
    sub: "Survey lapangan",
    path: "/data-collection",
    module: "sales",
    col: 0,
    row: 0,
  },
  {
    id: "quotation",
    label: "Quotation / RAB",
    sub: "Penawaran harga",
    path: "/sales/quotation",
    module: "sales",
    col: 0,
    row: 1,
  },
  {
    id: "approval",
    label: "Quotation Approval",
    sub: "Persetujuan penawaran",
    path: "/sales/quotation-approval",
    module: "sales",
    col: 0,
    row: 2,
  },

  {
    id: "project",
    label: "Project Register",
    sub: "Kontrak & nilai proyek",
    path: "/project",
    module: "project",
    col: 1,
    row: 1,
  },
  {
    id: "boq",
    label: "BOQ / Material Plan",
    sub: "Kebutuhan material",
    path: "/project",
    module: "project",
    col: 1,
    row: 2,
  },

  {
    id: "po",
    label: "Purchase Order",
    sub: "Pengadaan material",
    path: "/purchasing/purchase-order",
    module: "supply",
    col: 2,
    row: 1,
  },
  {
    id: "receiving",
    label: "Receiving (GR)",
    sub: "Good / damaged qty",
    path: "/purchasing/receiving",
    module: "supply",
    col: 2,
    row: 2,
  },
  {
    id: "stockin",
    label: "Stock In",
    sub: "Draft → Posted",
    path: "/inventory/stock-in",
    module: "supply",
    col: 2,
    row: 3,
  },

  {
    id: "warehouse",
    label: "Inventory / Warehouse",
    sub: "Authoritative on-hand",
    path: "/inventory/center",
    module: "supply",
    col: 3,
    row: 2,
  },
  {
    id: "stockout",
    label: "Stock Out / Issue",
    sub: "Material issue",
    path: "/inventory/stock-out",
    module: "supply",
    col: 3,
    row: 3,
  },

  {
    id: "wo",
    label: "Work Order",
    sub: "Reserve & Start",
    path: "/produksi/report",
    module: "production",
    col: 4,
    row: 1,
  },
  {
    id: "lhp",
    label: "LHP",
    sub: "Output produksi",
    path: "/produksi/report",
    module: "production",
    col: 4,
    row: 2,
  },
  {
    id: "qc",
    label: "Quality Control",
    sub: "Cumulative inspection",
    path: "/produksi/qc",
    module: "production",
    col: 4,
    row: 3,
  },
  {
    id: "service_done",
    label: "Completed",
    sub: "Jasa / repair",
    module: "production",
    col: 4,
    row: 4,
  },

  {
    id: "fgstockin",
    label: "FG Stock In",
    sub: "Draft → Posted",
    path: "/inventory/stock-in",
    module: "supply",
    col: 5,
    row: 2,
  },
  {
    id: "fgwarehouse",
    label: "Finished Goods",
    sub: "Stok barang jadi",
    path: "/inventory/center",
    module: "supply",
    col: 5,
    row: 3,
  },

  {
    id: "sj",
    label: "Surat Jalan",
    sub: "Delivery Order",
    path: "/surat-menyurat/surat-jalan",
    module: "logistics",
    col: 6,
    row: 2,
  },
  {
    id: "delivery",
    label: "Logistics",
    sub: "Tracking pengiriman",
    path: "/logistics/hub",
    module: "logistics",
    col: 6,
    row: 3,
  },

  {
    id: "ar",
    label: "Accounts Receivable",
    sub: "Invoice customer",
    path: "/finance/accounts-receivable",
    module: "finance",
    col: 1,
    row: 5,
  },
  {
    id: "ap",
    label: "Accounts Payable",
    sub: "Hutang supplier",
    path: "/finance/accounts-payable",
    module: "finance",
    col: 2,
    row: 5,
  },
  {
    id: "ledger",
    label: "General Ledger",
    sub: "Jurnal & posting",
    path: "/finance/ledger",
    module: "finance",
    col: 3,
    row: 5,
  },
  {
    id: "bank",
    label: "Bank Reconciliation",
    sub: "Mutasi & saldo",
    path: "/finance/bank-reconciliation",
    module: "finance",
    col: 4,
    row: 5,
  },
  {
    id: "cashflow",
    label: "Cash Flow",
    sub: "Command center",
    path: "/finance/cashflow-command",
    module: "finance",
    col: 5,
    row: 5,
  },
  {
    id: "yearend",
    label: "Year-End Closing",
    sub: "Tutup buku",
    path: "/finance/year-end",
    module: "finance",
    col: 6,
    row: 5,
  },

  {
    id: "hr_emp",
    label: "Karyawan",
    sub: "Master data",
    path: "/hr/karyawan",
    module: "hr",
    col: 0,
    row: 7,
  },
  {
    id: "hr_att",
    label: "Kehadiran",
    sub: "Absensi & lembur",
    path: "/hr/attendance-today",
    module: "hr",
    col: 1,
    row: 7,
  },
  {
    id: "hr_pay",
    label: "Payroll",
    sub: "Proses gaji",
    path: "/hr/payroll-pro",
    module: "hr",
    col: 2,
    row: 7,
  },
  {
    id: "hr_thl",
    label: "THL / Harian",
    sub: "Tenaga harian",
    path: "/hr/thl",
    module: "hr",
    col: 3,
    row: 7,
  },
  {
    id: "hr_adv",
    label: "Kasbon",
    sub: "Advance karyawan",
    path: "/hr/employee-advance",
    module: "hr",
    col: 4,
    row: 7,
  },
];

const FLOW_EDGES: FlowEdge[] = [
  { from: "survey", to: "quotation" },
  { from: "quotation", to: "approval" },
  { from: "approval", to: "project" },

  { from: "project", to: "boq" },
  { from: "boq", to: "po" },

  { from: "po", to: "receiving" },
  { from: "receiving", to: "stockin" },
  { from: "stockin", to: "warehouse" },

  {
    from: "warehouse",
    to: "wo",
    dashed: true,
    label: "reserve / start",
  },
  {
    from: "warehouse",
    to: "stockout",
    dashed: true,
    label: "issue",
  },

  { from: "wo", to: "lhp" },
  { from: "lhp", to: "qc" },

  {
    from: "qc",
    to: "fgstockin",
    label: "barang jadi",
  },
  { from: "fgstockin", to: "fgwarehouse" },
  { from: "fgwarehouse", to: "sj" },
  { from: "sj", to: "delivery" },

  {
    from: "qc",
    to: "service_done",
    dashed: true,
    label: "jasa / repair",
  },

  { from: "project", to: "ar", dashed: true, label: "billing" },
  { from: "po", to: "ap", dashed: true, label: "supplier" },
  { from: "ar", to: "ledger" },
  { from: "ap", to: "ledger" },
  { from: "bank", to: "ledger" },
  { from: "ledger", to: "cashflow" },
  { from: "ledger", to: "yearend" },

  { from: "hr_emp", to: "hr_att" },
  { from: "hr_att", to: "hr_pay" },
  { from: "hr_thl", to: "hr_pay", dashed: true },
  {
    from: "hr_pay",
    to: "ledger",
    dashed: true,
    label: "payroll",
  },
];

const MODULE_MAP = Object.fromEntries(
  MODULES.map((module) => [module.id, module]),
);

const NODE_W = 152;
const NODE_H = 58;
const COL_GAP = 82;
const ROW_GAP = 82;
const PAD_X = 16;
const PAD_Y = 30;

function nodeX(col: number) {
  return PAD_X + col * (NODE_W + COL_GAP);
}

function nodeY(row: number) {
  return PAD_Y + row * (NODE_H + ROW_GAP);
}

const CANVAS_W = nodeX(6) + NODE_W + PAD_X;
const CANVAS_H = nodeY(7) + NODE_H + PAD_Y;

function edgePath(a: FlowNode, b: FlowNode) {
  if (a.col === b.col) {
    const x = nodeX(a.col) + NODE_W / 2;
    const ay = nodeY(a.row) + NODE_H;
    const by = nodeY(b.row);

    return `M${x},${ay} C${x},${(ay + by) / 2} ${x},${(ay + by) / 2} ${x},${by}`;
  }

  const ax = nodeX(a.col) + NODE_W;
  const ay = nodeY(a.row) + NODE_H / 2;
  const bx = nodeX(b.col);
  const by = nodeY(b.row) + NODE_H / 2;
  const mx = (ax + bx) / 2;

  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}

function TreeNode({
  mod,
  navigate,
}: {
  mod: Module;
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="select-none">
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group"
      >
        <span className={`w-2 h-2 rounded-full ${mod.accent} shrink-0`} />

        <span
          className={`w-6 h-6 rounded-lg ${mod.accent} flex items-center justify-center ${mod.text} shrink-0`}
        >
          {mod.icon}
        </span>

        <span className="text-[11px] font-black text-white/80 uppercase tracking-widest flex-1 text-left">
          {mod.name}
        </span>

        <span className="text-[9px] text-white/30 font-bold mr-1">
          {mod.pages.length}
        </span>

        {open ? (
          <ChevronDown size={12} className="text-white/30 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-white/30 shrink-0" />
        )}
      </button>

      {open && (
        <div className="ml-8 border-l border-white/10 pl-3 pb-1 space-y-0.5">
          {mod.pages.map((page, index) => {
            const dynamic = page.path.includes(":");

            return (
              <button
                key={`${page.path}-${index}`}
                onClick={() => !dynamic && navigate(page.path)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-left group ${
                  dynamic
                    ? "opacity-40 cursor-default"
                    : "hover:bg-white/5 cursor-pointer"
                }`}
              >
                <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />

                <span className="text-[11px] text-white/50 group-hover:text-white/80 transition-colors flex-1 truncate">
                  {page.label}
                </span>

                {page.note && (
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${mod.accent} ${mod.text} opacity-80 shrink-0`}
                  >
                    {page.note}
                  </span>
                )}

                <code className="text-[8px] font-mono text-white/20 shrink-0 hidden sm:block truncate max-w-[120px]">
                  {page.path.replace(/:.+/g, "…")}
                </code>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlowDiagram({ navigate }: { navigate: (path: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const nodeMap = Object.fromEntries(FLOW_NODES.map((node) => [node.id, node]));

  const sectionLabels: Record<number, string> = {
    0: "Pre-Sales",
    1: "Project",
    2: "Procurement",
    3: "Warehouse",
    4: "Production",
    5: "Finished Goods",
    6: "Delivery",
  };

  return (
    <div className="overflow-auto pb-4">
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
        {Object.entries(sectionLabels).map(([col, label]) => (
          <div
            key={col}
            className="absolute text-center"
            style={{
              left: nodeX(Number(col)),
              width: NODE_W,
              top: 0,
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
              {label}
            </span>
          </div>
        ))}

        <div
          className="absolute flex items-center gap-2"
          style={{
            left: nodeX(0),
            top: nodeY(5) - 22,
            width: CANVAS_W - PAD_X * 2,
          }}
        >
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 px-2">
            Finance & Ledger
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div
          className="absolute flex items-center gap-2"
          style={{
            left: nodeX(0),
            top: nodeY(7) - 22,
            width: CANVAS_W - PAD_X * 2,
          }}
        >
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/60 px-2">
            Human Capital
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          width={CANVAS_W}
          height={CANVAS_H}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.2)" />
            </marker>

            <marker
              id="arrow-hover"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.7)" />
            </marker>
          </defs>

          {FLOW_EDGES.map((edge, index) => {
            const from = nodeMap[edge.from];
            const to = nodeMap[edge.to];

            if (!from || !to) return null;

            const active = hovered === edge.from || hovered === edge.to;

            const middleX = (nodeX(from.col) + NODE_W + nodeX(to.col)) / 2;

            const middleY = (nodeY(from.row) + nodeY(to.row) + NODE_H) / 2;

            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                <path
                  d={edgePath(from, to)}
                  fill="none"
                  stroke={
                    active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"
                  }
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray={edge.dashed ? "5,4" : undefined}
                  markerEnd={active ? "url(#arrow-hover)" : "url(#arrow)"}
                />

                {edge.label && (
                  <text
                    x={middleX}
                    y={middleY - 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill="rgba(255,255,255,0.3)"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {FLOW_NODES.map((node) => {
          const mod = MODULE_MAP[node.module];
          const active = hovered === node.id;
          const canNavigate = Boolean(node.path) && !node.path?.includes(":");

          return (
            <div
              key={node.id}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => canNavigate && node.path && navigate(node.path)}
              style={{
                position: "absolute",
                left: nodeX(node.col),
                top: nodeY(node.row),
                width: NODE_W,
                height: NODE_H,
              }}
              className={`rounded-xl border px-3 py-2 flex flex-col justify-center transition-all duration-150 ${
                canNavigate ? "cursor-pointer" : "cursor-default"
              } ${
                active
                  ? `${mod.accent} ${mod.border} shadow-lg scale-[1.04]`
                  : "bg-white/5 border-white/10 hover:border-white/25"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={active ? mod.text : "text-white/40"}>
                  {mod.icon}
                </span>

                <span
                  className={`text-[11px] font-black leading-tight ${
                    active ? mod.text : "text-white/70"
                  }`}
                >
                  {node.label}
                </span>
              </div>

              {node.sub && (
                <span
                  className={`text-[9px] font-bold pl-[22px] ${
                    active ? `${mod.text} opacity-70` : "text-white/30"
                  }`}
                >
                  {node.sub}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 px-1">
        {MODULES.filter((module) =>
          [
            "sales",
            "project",
            "production",
            "supply",
            "logistics",
            "finance",
            "hr",
          ].includes(module.id),
        ).map((module) => (
          <div key={module.id} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${module.accent}`} />
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
              {module.name}
            </span>
          </div>
        ))}

        <div className="flex items-center gap-1.5 ml-4">
          <svg width="24" height="10">
            <line
              x1="0"
              y1="5"
              x2="20"
              y2="5"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
          </svg>
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
            Opsional / Trigger
          </span>
        </div>
      </div>
    </div>
  );
}

type Tab = "flow" | "tree" | "table";

export default function WireframePage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("flow");
  const [search, setSearch] = useState("");

  const totalPages = MODULES.reduce(
    (total, module) => total + module.pages.length,
    0,
  );

  const filtered = search.trim()
    ? MODULES.map((module) => ({
        ...module,
        pages: module.pages.filter(
          (page) =>
            page.label.toLowerCase().includes(search.toLowerCase()) ||
            page.path.toLowerCase().includes(search.toLowerCase()),
        ),
      })).filter((module) => module.pages.length > 0)
    : MODULES;

  const tabs: {
    id: Tab;
    label: string;
    icon: ReactNode;
  }[] = [
    {
      id: "flow",
      label: "Alur Sistem",
      icon: <GitBranch size={13} />,
    },
    {
      id: "tree",
      label: "Struktur Halaman",
      icon: <Layers size={13} />,
    },
    {
      id: "table",
      label: "Semua Routes",
      icon: <Database size={13} />,
    },
  ];

  return (
    <div className="min-h-full bg-slate-950 text-white rounded-2xl overflow-hidden">
      <div className="border-b border-white/10 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <GitBranch size={18} />
          </div>

          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">
              System Wireframe
            </h1>

            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-0.5">
              {MODULES.length} modul · {totalPages} halaman · PT GTP ERP
            </p>
          </div>
        </div>

        <div className="relative sm:w-64">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);

              if (event.target.value) {
                setTab("tree");
              }
            }}
            placeholder="Cari halaman..."
            className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
          />
        </div>

        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === item.id
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {tab === "flow" && (
          <div className="space-y-4">
            <p className="text-[10px] text-white/30 font-bold">
              Hover node untuk melihat koneksi · Klik node untuk membuka halaman
            </p>

            <FlowDiagram navigate={navigate} />
          </div>
        )}

        {tab === "tree" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((module) => (
              <div
                key={module.id}
                className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden"
              >
                <TreeNode mod={module} navigate={navigate} />
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-3 py-12 text-center text-white/30 font-bold text-sm">
                Tidak ada halaman yang cocok
              </div>
            )}
          </div>
        )}

        {tab === "table" && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 text-[9px] font-black text-white/30 uppercase tracking-widest">
                      Path
                    </th>
                    <th className="px-5 py-3 text-[9px] font-black text-white/30 uppercase tracking-widest">
                      Halaman
                    </th>
                    <th className="px-5 py-3 text-[9px] font-black text-white/30 uppercase tracking-widest">
                      Modul
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.flatMap((module) =>
                    module.pages.map((page, index) => {
                      const dynamic = page.path.includes(":");

                      return (
                        <tr
                          key={`${module.id}-${index}`}
                          onClick={() => !dynamic && navigate(page.path)}
                          className={`group transition-colors ${
                            dynamic
                              ? "opacity-40"
                              : "hover:bg-white/5 cursor-pointer"
                          }`}
                        >
                          <td className="px-5 py-2.5">
                            <code className="text-[10px] font-mono text-white/40 group-hover:text-white/70">
                              {page.path.replace(/:.+/g, "…")}
                            </code>
                          </td>

                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-white/60 group-hover:text-white/90">
                                {page.label}
                              </span>

                              {page.note && (
                                <span
                                  className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${module.accent} ${module.text} opacity-70`}
                                >
                                  {page.note}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${module.accent}`}
                              />
                              <span className="text-[9px] font-black text-white/30 uppercase">
                                {module.name}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
