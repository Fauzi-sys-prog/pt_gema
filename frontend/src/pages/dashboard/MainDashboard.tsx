import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Project } from '../../contexts/AppContext';
import api from '../../services/api';

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MainDashboard() {
  const {
    currentUser,
    projectList = [],
    invoiceList = [],
    stockItemList = [],
    attendanceList = [],
  } = useApp();
  const [serverProjects, setServerProjects] = useState<Project[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadProjects = async () => {
      try {
        const res = await api.get('/projects');
        if (!mounted) return;
        setServerProjects(Array.isArray(res.data) ? (res.data as Project[]) : []);
      } catch {
        if (!mounted) return;
        setServerProjects([]);
      }
    };
    void loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const projects = useMemo(
    () => safeArray(serverProjects.length > 0 ? serverProjects : projectList),
    [serverProjects, projectList]
  );
  const invoices = safeArray(invoiceList);
  const stocks = safeArray(stockItemList);
  const attendances = safeArray(attendanceList);

  const totalRevenue = invoices.reduce((sum, inv: any) => sum + toNumber(inv?.totalBayar), 0);
  const activeProjects = projects.filter((p: any) => String(p?.status || '').toLowerCase() !== 'completed').length;
  const lowStockCount = stocks.filter((s: any) => toNumber(s?.stok) <= toNumber(s?.minStock || 0)).length;
  const totalHours = attendances.reduce((sum, a: any) => sum + toNumber(a?.workHours), 0);

  const topProjects = projects.slice(0, 4);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,transparent_35%),radial-gradient(circle_at_85%_10%,#ede9fe_0%,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-16 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />

      <div className="relative z-10 space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">System Operational Live</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black italic tracking-tight text-slate-900">
            Command Center <span className="text-blue-600">Executive</span>
          </h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Welcome, {currentUser?.name || currentUser?.username || 'User'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-slate-900 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Briefcase size={20} />
              <span className="text-[10px] uppercase tracking-widest">Projects</span>
            </div>
            <p className="mt-4 text-3xl font-black">{activeProjects}</p>
            <p className="text-xs text-slate-300">Active Projects</p>
          </div>

          <div className="rounded-3xl bg-emerald-600 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <DollarSign size={20} />
              <span className="text-[10px] uppercase tracking-widest">Revenue</span>
            </div>
            <p className="mt-4 text-2xl font-black">{formatRupiah(totalRevenue)}</p>
            <p className="text-xs text-emerald-100">Total Invoice</p>
          </div>

          <div className="rounded-3xl bg-amber-500 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <AlertTriangle size={20} />
              <span className="text-[10px] uppercase tracking-widest">Inventory</span>
            </div>
            <p className="mt-4 text-3xl font-black">{lowStockCount}</p>
            <p className="text-xs text-amber-100">Low Stock Items</p>
          </div>

          <div className="rounded-3xl bg-blue-600 text-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Clock size={20} />
              <span className="text-[10px] uppercase tracking-widest">Man Hours</span>
            </div>
            <p className="mt-4 text-3xl font-black">{totalHours.toLocaleString('id-ID')}</p>
            <p className="text-xs text-blue-100">Accumulated Hours</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black italic text-slate-900">Project Snapshot</h2>
              <Link to="/project" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-blue-600 hover:underline">
                Manage <ArrowRight size={12} />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {topProjects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Belum ada project.
                </div>
              )}

              {topProjects.map((p: any) => (
                <div key={String(p?.id || Math.random())} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase italic text-slate-900">
                        {String(p?.namaProject || 'Untitled Project')}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {String(p?.customer || '-')}
                      </p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {String(p?.status || 'Unknown')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
            <h2 className="text-xl font-black italic text-slate-900">Quick Links</h2>
            <div className="mt-4 space-y-3">
              <Link to="/sales/quotation" className="flex items-center justify-between rounded-2xl bg-slate-900 text-white p-4">
                <span className="text-xs font-black uppercase tracking-widest">Quotation</span>
                <TrendingUp size={16} />
              </Link>
              <Link to="/finance/project-profit-loss" className="flex items-center justify-between rounded-2xl bg-blue-600 text-white p-4">
                <span className="text-xs font-black uppercase tracking-widest">Project P&L</span>
                <Calendar size={16} />
              </Link>
              <Link to="/inventory/warehouse-ledger" className="flex items-center justify-between rounded-2xl bg-emerald-600 text-white p-4">
                <span className="text-xs font-black uppercase tracking-widest">Warehouse</span>
                <Activity size={16} />
              </Link>
              <Link to="/finance/payroll" className="flex items-center justify-between rounded-2xl bg-violet-600 text-white p-4">
                <span className="text-xs font-black uppercase tracking-widest">Payroll</span>
                <Users size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
