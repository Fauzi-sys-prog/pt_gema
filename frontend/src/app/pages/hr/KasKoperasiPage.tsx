import { useState, useMemo, useEffect } from "react";
import { useApp, type KoperasiMember, type KoperasiSimpanan, type KoperasiPinjaman } from "../../contexts/AppContext";
import { toast } from "sonner";
import {
  Plus, X, Search, Users, Wallet, CreditCard,
  CheckCircle2, Eye, Building2, TrendingUp,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const fmt = (d: string) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const SIMPANAN_POKOK_DEFAULT = 100_000;

const STATUS_PINJAMAN: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  Pending:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   label: "Menunggu" },
  Approved: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500",    label: "Disetujui" },
  Active:   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Aktif" },
  Settled:  { bg: "bg-slate-100",  text: "text-slate-500",   border: "border-slate-200",   dot: "bg-slate-400",   label: "Lunas" },
  Rejected: { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200",     dot: "bg-red-400",     label: "Ditolak" },
};

type Tab = "anggota" | "simpanan" | "pinjaman";

// ─── inject field styles once ────────────────────────────────────────────────

function useFieldStyles() {
  useEffect(() => {
    if (document.head.querySelector("[data-kop-styles]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-kop-styles", "1");
    s.textContent = `
      .kop-label{display:block;font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem}
      .kop-input{width:100%;padding:.625rem 1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.75rem;font-size:.875rem;color:#1e293b;outline:none}
      .kop-input:focus{box-shadow:0 0 0 2px rgba(59,130,246,.2);border-color:#93c5fd}
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── component ───────────────────────────────────────────────────────────────

export default function KasKoperasiPage() {
  useFieldStyles();

  const {
    koperasiMembers, addKoperasiMember, updateKoperasiMember,
    koperasiSimpananList, addKoperasiSimpanan,
    koperasiPinjamanList, addKoperasiPinjaman, approveKoperasiPinjaman, bayarKoperasiAngsuran,
    koperasiBalance, topUpKoperasi,
    employeeList,
  } = useApp();

  const [tab, setTab] = useState<Tab>("anggota");
  const [search, setSearch] = useState("");

  const [showAddMember,   setShowAddMember]   = useState(false);
  const [showAddSimpanan, setShowAddSimpanan] = useState(false);
  const [showAddPinjaman, setShowAddPinjaman] = useState(false);
  const [showTopUp,       setShowTopUp]       = useState(false);
  const [detailPinjaman,  setDetailPinjaman]  = useState<KoperasiPinjaman | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [memberForm, setMemberForm] = useState({ employeeId: "", simpananPokok: SIMPANAN_POKOK_DEFAULT, simpananWajibBulanan: 0 });

  const [simpananForm, setSimpananForm] = useState({
    memberId: "", type: "Wajib" as "Wajib" | "Sukarela",
    amount: 0, period: new Date().toISOString().slice(0, 7), notes: "",
  });

  const [pinjamanForm, setPinjamanForm] = useState({
    memberId: "", amount: 0, adminFeePercent: 2.5, installmentCount: 6, notes: "",
  });
  const [topUpForm, setTopUpForm] = useState({ amount: 0, bankAccount: "", notes: "" });

  // ── stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeMembers = koperasiMembers.filter(m => m.status === "Active").length;
    const totalSimpananWajibSukarela = koperasiSimpananList.reduce((s, x) => s + x.amount, 0);
    const totalSimpananPokok = koperasiMembers.reduce((s, m) => s + m.simpananPokok, 0);
    const totalSimpanan = totalSimpananPokok + totalSimpananWajibSukarela;
    const activePinjaman = koperasiPinjamanList.filter(p => p.status === "Active");
    const totalPinjaman = activePinjaman.reduce((s, p) =>
      s + (p.installmentCount - p.paidInstallments) * p.installmentAmount, 0);
    const pendingPinjaman = koperasiPinjamanList.filter(p => p.status === "Pending").length;
    return { activeMembers, totalSimpanan, totalPinjaman, pendingPinjaman };
  }, [koperasiMembers, koperasiSimpananList, koperasiPinjamanList]);

  const memberSimpananMap = useMemo(() => {
    const map: Record<string, number> = {};
    koperasiSimpananList.forEach(s => { map[s.memberId] = (map[s.memberId] || 0) + s.amount; });
    return map;
  }, [koperasiSimpananList]);

  // ── filtered ──────────────────────────────────────────────────────────────
  const q = search.toLowerCase();

  const filteredMembers = useMemo(() =>
    koperasiMembers.filter(m => !q || m.employeeName.toLowerCase().includes(q) || m.memberNo.toLowerCase().includes(q)),
    [koperasiMembers, q]);

  const filteredSimpanan = useMemo(() =>
    [...koperasiSimpananList]
      .filter(s => !q || s.memberName.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [koperasiSimpananList, q]);

  const filteredPinjaman = useMemo(() =>
    [...koperasiPinjamanList]
      .filter(p => !q || p.memberName.toLowerCase().includes(q) || p.pinjamanNo.toLowerCase().includes(q))
      .sort((a, b) => b.requestDate.localeCompare(a.requestDate)),
    [koperasiPinjamanList, q]);

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingMember) return;
    const emp = employeeList.find(x => x.id === memberForm.employeeId);
    if (!emp) { toast.error("Pilih karyawan"); return; }
    if (koperasiMembers.find(m => m.employeeId === emp.id)) { toast.error("Karyawan sudah jadi anggota"); return; }
    const memberNo = `KOP/${new Date().getFullYear()}/${String(koperasiMembers.length + 1).padStart(4, "0")}`;
    const submittedForm = { ...memberForm };
    setIsAddingMember(true);
    setShowAddMember(false);
    const loadingToast = toast.loading(`Menyimpan anggota ${emp.name}...`);
    try {
      await addKoperasiMember({ id: `km-${Date.now()}`, memberNo, employeeId: emp.id, employeeName: emp.name,
        joinDate: new Date().toISOString().split("T")[0], status: "Active", simpananPokok: memberForm.simpananPokok, simpananWajibBulanan: memberForm.simpananWajibBulanan });
      toast.success(`${emp.name} berhasil jadi anggota koperasi`, { id: loadingToast });
      setMemberForm({ employeeId: "", simpananPokok: SIMPANAN_POKOK_DEFAULT, simpananWajibBulanan: 0 });
    } catch (error) {
      setMemberForm(submittedForm);
      setShowAddMember(true);
      toast.error(error instanceof Error ? error.message : "Gagal menambah anggota", { id: loadingToast });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleAddSimpanan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const member = koperasiMembers.find(m => m.id === simpananForm.memberId);
    if (!member) { toast.error("Pilih anggota"); return; }
    if (!simpananForm.amount) { toast.error("Masukkan nominal"); return; }
    setIsSubmitting(true);
    try {
      await addKoperasiSimpanan({ id: `ks-${Date.now()}`, memberId: member.id, memberName: member.employeeName,
        type: simpananForm.type, amount: simpananForm.amount, date: new Date().toISOString().split("T")[0],
        period: simpananForm.type === "Wajib" ? simpananForm.period : undefined,
        notes: simpananForm.notes || undefined });
      toast.success("Simpanan berhasil dicatat");
      setShowAddSimpanan(false);
      setSimpananForm({ memberId: "", type: "Wajib", amount: 0, period: new Date().toISOString().slice(0, 7), notes: "" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mencatat simpanan"); }
    finally { setIsSubmitting(false); }
  };

  const handleAddPinjaman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const member = koperasiMembers.find(m => m.id === pinjamanForm.memberId);
    if (!member) { toast.error("Pilih anggota"); return; }
    if (!pinjamanForm.amount) { toast.error("Masukkan nominal"); return; }
    const adminFeePercent = 2.5;
    const adminFeeAmount = Math.round(pinjamanForm.amount * adminFeePercent / 100);
    const totalAmount = pinjamanForm.amount + adminFeeAmount;
    const installmentAmount = Math.round(totalAmount / pinjamanForm.installmentCount);
    const pinjamanNo = `PIN/${new Date().getFullYear()}/${String(koperasiPinjamanList.length + 1).padStart(4, "0")}`;
    setIsSubmitting(true);
    try {
      await addKoperasiPinjaman({ id: `kp-${Date.now()}`, pinjamanNo, memberId: member.id, memberName: member.employeeName,
      amount: pinjamanForm.amount, adminFeePercent, adminFeeAmount, totalAmount,
        installmentCount: pinjamanForm.installmentCount, installmentAmount, paidInstallments: 0,
        requestDate: new Date().toISOString().split("T")[0], status: "Pending",
        notes: pinjamanForm.notes || undefined });
      toast.success("Pengajuan pinjaman berhasil disubmit");
      setShowAddPinjaman(false);
    setPinjamanForm({ memberId: "", amount: 0, adminFeePercent: 2.5, installmentCount: 6, notes: "" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengajukan pinjaman"); }
    finally { setIsSubmitting(false); }
  };

  const approvePinjaman = async (p: KoperasiPinjaman) => {
    if (processingId) return;
    if (!window.confirm(`Setujui & cairkan pinjaman ${p.pinjamanNo} (${formatRp(p.amount)}) untuk ${p.memberName}?`)) return;
    setProcessingId(p.id);
    try {
      const saved = await approveKoperasiPinjaman(p.id);
      if (detailPinjaman?.id === p.id) setDetailPinjaman(saved);
      toast.success(`Pinjaman ${p.memberName} disetujui & dicairkan`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyetujui pinjaman"); }
    finally { setProcessingId(null); }
  };

  const bayarAngsuran = async (p: KoperasiPinjaman) => {
    if (processingId) return;
    setProcessingId(p.id);
    try {
      const saved = await bayarKoperasiAngsuran(p.id);
      if (detailPinjaman?.id === p.id) setDetailPinjaman(saved);
      toast.success(saved.status === "Settled" ? `Pinjaman ${p.memberName} LUNAS!` : `Angsuran ke-${saved.paidInstallments} dicatat`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mencatat angsuran"); }
    finally { setProcessingId(null); }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (topUpForm.amount <= 0 || !topUpForm.bankAccount.trim()) {
      toast.error("Nominal dan rekening bank wajib diisi");
      return;
    }
    setIsSubmitting(true);
    try {
      await topUpKoperasi({ id: `ktop-${Date.now()}`, date: new Date().toISOString().slice(0, 10), ...topUpForm });
      toast.success("Top-up masuk ke Kas Koperasi dan rekonsiliasi bank");
      setShowTopUp(false);
      setTopUpForm({ amount: 0, bankAccount: "", notes: "" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mencatat top-up"); }
    finally { setIsSubmitting(false); }
  };

  const handleNonaktifkanMember = async (m: KoperasiMember) => {
    if (processingId) return;
    if (!window.confirm(`Nonaktifkan anggota ${m.employeeName}?`)) return;
    setProcessingId(m.id);
    try {
      await updateKoperasiMember(m.id, { status: "Inactive" });
      toast.success(`${m.employeeName} dinonaktifkan`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan anggota"); }
    finally { setProcessingId(null); }
  };

  // ── pinjaman form preview ─────────────────────────────────────────────────
  const pinAdminFee = Math.round(pinjamanForm.amount * 2.5 / 100);
  const pinTotal    = pinjamanForm.amount + pinAdminFee;
  const pinAngsuran = pinjamanForm.installmentCount > 0 ? Math.round(pinTotal / pinjamanForm.installmentCount) : 0;

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "anggota",  label: "Anggota",  icon: <Users size={14} />,      count: koperasiMembers.length },
    { key: "simpanan", label: "Simpanan", icon: <Wallet size={14} />,     count: koperasiSimpananList.length },
    { key: "pinjaman", label: "Pinjaman", icon: <CreditCard size={14} />, count: koperasiPinjamanList.length },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 sm:p-6 space-y-5 bg-slate-50 min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white px-6 py-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Kas Koperasi</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-0.5">Simpanan · Pinjaman · Anggota</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Saldo Kas</p>
            <p className="text-xs font-black text-emerald-700">{formatRp(koperasiBalance)}</p>
          </div>
          <ActionBtn onClick={() => setShowTopUp(true)} label="Top Up" color="emerald" />
          {tab === "anggota"  && <ActionBtn onClick={() => setShowAddMember(true)}   label="Tambah Anggota" />}
          {tab === "simpanan" && <ActionBtn onClick={() => setShowAddSimpanan(true)} label="Catat Simpanan" color="emerald" />}
          {tab === "pinjaman" && <ActionBtn onClick={() => setShowAddPinjaman(true)} label="Ajukan Pinjaman" color="purple" />}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Users size={16} />,      label: "Anggota Aktif",     val: String(stats.activeMembers),    sub: "anggota koperasi",        col: "text-slate-900",    bg: "bg-white border-slate-100" },
          { icon: <Wallet size={16} />,     label: "Total Simpanan",    val: formatRp(stats.totalSimpanan),   sub: "pokok + wajib + sukarela", col: "text-emerald-600",  bg: "bg-emerald-50 border-emerald-100" },
          { icon: <CreditCard size={16} />, label: "Sisa Pinjaman",     val: formatRp(stats.totalPinjaman),   sub: "outstanding aktif",        col: "text-purple-600",   bg: "bg-purple-50 border-purple-100" },
          { icon: <TrendingUp size={16} />, label: "Menunggu Approval", val: String(stats.pendingPinjaman),  sub: "pengajuan pinjaman",       col: "text-amber-600",    bg: "bg-amber-50 border-amber-100" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border rounded-2xl p-4 flex flex-col gap-2`}>
            <div className={`w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center ${s.col}`}>{s.icon}</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className={`text-xl font-black italic leading-tight mt-0.5 truncate ${s.col}`}>{s.val}</p>
              <p className="text-[9px] text-slate-400 font-bold">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                tab === t.key ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
              }`}>
              {t.icon} {t.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari anggota..."
            className="pl-9 pr-4 py-2.5 bg-white rounded-xl text-sm text-slate-700 placeholder:text-slate-300 outline-none border border-slate-100 focus:ring-2 focus:ring-blue-500/20 font-medium w-56" />
        </div>
      </div>

      {/* ── TAB: ANGGOTA ── */}
      {tab === "anggota" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredMembers.length === 0
            ? <EmptyState icon={<Users size={20} />} text="Belum ada anggota koperasi" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <Thead cols={["No. Anggota", "Nama", "Bergabung", "Simpanan Pokok", "Wajib / Bulan", "Total Simpanan", "Status", "Aksi"]} />
                  <tbody className="divide-y divide-slate-50">
                    {filteredMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5"><p className="text-xs font-black text-blue-600 italic">{m.memberNo}</p></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={m.employeeName} />
                            <p className="text-sm font-black text-slate-900">{m.employeeName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><p className="text-xs text-slate-600 font-medium">{fmt(m.joinDate)}</p></td>
                        <td className="px-4 py-3.5"><p className="text-xs font-black text-slate-900">{formatRp(m.simpananPokok)}</p></td>
                        <td className="px-4 py-3.5"><p className="text-xs font-black text-blue-700">{formatRp(m.simpananWajibBulanan ?? 0)}</p></td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-black text-emerald-700">{formatRp(m.simpananPokok + (memberSimpananMap[m.id] || 0))}</p>
                          {memberSimpananMap[m.id] > 0 && <p className="text-[9px] text-slate-400">+{formatRp(memberSimpananMap[m.id])} wajib/sukarela</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge active={m.status === "Active"} />
                        </td>
                        <td className="px-4 py-3.5">
                          {m.status === "Active" && (
                            <button onClick={() => handleNonaktifkanMember(m)} disabled={processingId !== null}
                              className="text-[9px] font-black text-red-400 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded-lg transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                              Nonaktifkan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <TFoot count={filteredMembers.length} label="anggota" />
        </div>
      )}

      {/* ── TAB: SIMPANAN ── */}
      {tab === "simpanan" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredSimpanan.length === 0
            ? <EmptyState icon={<Wallet size={20} />} text="Belum ada catatan simpanan" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px]">
                  <Thead cols={["Anggota", "Jenis", "Periode", "Tanggal", "Nominal", "Catatan"]} />
                  <tbody className="divide-y divide-slate-50">
                    {filteredSimpanan.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={s.memberName} size="sm" />
                            <p className="text-sm font-black text-slate-900">{s.memberName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${s.type === "Wajib" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                            {s.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5"><p className="text-xs text-slate-600 font-medium">{s.period || "—"}</p></td>
                        <td className="px-4 py-3.5"><p className="text-xs text-slate-600 font-medium">{fmt(s.date)}</p></td>
                        <td className="px-4 py-3.5"><p className="text-sm font-black text-emerald-700">{formatRp(s.amount)}</p></td>
                        <td className="px-4 py-3.5"><p className="text-xs text-slate-500 truncate max-w-[140px]">{s.notes || "—"}</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <TFoot count={filteredSimpanan.length} label="transaksi" extra={`Total: ${formatRp(filteredSimpanan.reduce((s, x) => s + x.amount, 0))}`} />
        </div>
      )}

      {/* ── TAB: PINJAMAN ── */}
      {tab === "pinjaman" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredPinjaman.length === 0
            ? <EmptyState icon={<CreditCard size={20} />} text="Belum ada pengajuan pinjaman" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <Thead cols={["No. Pinjaman", "Anggota", "Pokok", "Angsuran/bln", "Progres", "Status", "Aksi"]} />
                  <tbody className="divide-y divide-slate-50">
                    {filteredPinjaman.map(p => {
                      const st  = STATUS_PINJAMAN[p.status];
                      const pct = p.installmentCount > 0 ? Math.round(p.paidInstallments / p.installmentCount * 100) : 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5"><p className="text-xs font-black text-purple-600 italic">{p.pinjamanNo}</p></td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={p.memberName} />
                              <p className="text-sm font-black text-slate-900">{p.memberName}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-black text-slate-900">{formatRp(p.amount)}</p>
                            {p.adminFeeAmount > 0 && <p className="text-[9px] text-slate-400">+{formatRp(p.adminFeeAmount)} admin</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-black text-slate-900">{formatRp(p.installmentAmount)}</p>
                            <p className="text-[9px] text-slate-400">{p.installmentCount}x cicilan</p>
                          </td>
                          <td className="px-4 py-3.5 w-44">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-slate-600 whitespace-nowrap">{p.paidInstallments}/{p.installmentCount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {st && (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${st.bg} ${st.text} ${st.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setDetailPinjaman(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={14} /></button>
                              {p.status === "Pending" && (
                                <button onClick={() => approvePinjaman(p)} disabled={processingId !== null} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"><CheckCircle2 size={14} /></button>
                              )}
                              {p.status === "Active" && (
                                <button onClick={() => bayarAngsuran(p)} disabled={processingId !== null} className="px-2 py-1 text-[9px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed">Bayar</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          <TFoot count={filteredPinjaman.length} label="pinjaman" extra={`Aktif: ${filteredPinjaman.filter(p => p.status === "Active").length}`} />
        </div>
      )}

      {/* ── Modal: Tambah Anggota ── */}
      {showAddMember && (
        <KopModal title="Tambah Anggota" subtitle="Daftarkan karyawan ke koperasi" onClose={() => setShowAddMember(false)}>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label className="kop-label">Karyawan *</label>
              <select value={memberForm.employeeId} onChange={e => setMemberForm(f => ({ ...f, employeeId: e.target.value }))} required className="kop-input">
                <option value="">— Pilih Karyawan —</option>
                {employeeList.filter(e => e.status === "Active" && !koperasiMembers.find(m => m.employeeId === e.id)).map(e => (
                  <option key={e.id} value={e.id}>{e.name} · {e.position}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="kop-label">Simpanan Pokok</label>
              <input type="number" value={memberForm.simpananPokok}
                onChange={e => setMemberForm(f => ({ ...f, simpananPokok: +e.target.value }))} min={0} className="kop-input" />
              <p className="text-[9px] text-slate-400 mt-1">Dibayar sekali saat mendaftar sebagai anggota</p>
            </div>
            <div>
              <label className="kop-label">Simpanan Wajib per Bulan</label>
              <input type="number" value={memberForm.simpananWajibBulanan || ""} onChange={e => setMemberForm(f => ({ ...f, simpananWajibBulanan: +e.target.value }))} min={0} className="kop-input" placeholder="Rp 0" />
              <p className="text-[9px] text-slate-400 mt-1">Dipotong otomatis dan masuk Kas Koperasi saat payroll dicairkan</p>
            </div>
            <KopActions onCancel={() => setShowAddMember(false)} label="Daftarkan Anggota" disabled={isAddingMember} />
          </form>
        </KopModal>
      )}

      {/* ── Modal: Catat Simpanan ── */}
      {showAddSimpanan && (
        <KopModal title="Catat Simpanan" subtitle="Simpanan wajib atau sukarela" onClose={() => setShowAddSimpanan(false)}>
          <form onSubmit={handleAddSimpanan} className="space-y-4">
            <div>
              <label className="kop-label">Anggota *</label>
              <select value={simpananForm.memberId} onChange={e => setSimpananForm(f => ({ ...f, memberId: e.target.value }))} required className="kop-input">
                <option value="">— Pilih Anggota —</option>
                {koperasiMembers.filter(m => m.status === "Active").map(m => <option key={m.id} value={m.id}>{m.employeeName}</option>)}
              </select>
            </div>
            <div>
              <label className="kop-label">Jenis Simpanan</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Wajib", "Sukarela"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setSimpananForm(f => ({ ...f, type: t }))}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${simpananForm.type === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {simpananForm.type === "Wajib" && (
              <div>
                <label className="kop-label">Periode (Bulan)</label>
                <input type="month" value={simpananForm.period} onChange={e => setSimpananForm(f => ({ ...f, period: e.target.value }))} className="kop-input" />
              </div>
            )}
            <div>
              <label className="kop-label">Nominal *</label>
              <input type="number" value={simpananForm.amount || ""} onChange={e => setSimpananForm(f => ({ ...f, amount: +e.target.value }))} required min={1} className="kop-input" placeholder="Rp 0" />
            </div>
            <div>
              <label className="kop-label">Catatan</label>
              <input type="text" value={simpananForm.notes} onChange={e => setSimpananForm(f => ({ ...f, notes: e.target.value }))} className="kop-input" placeholder="Opsional" />
            </div>
            <KopActions onCancel={() => setShowAddSimpanan(false)} label="Simpan" disabled={isSubmitting} />
          </form>
        </KopModal>
      )}

      {/* ── Modal: Ajukan Pinjaman ── */}
      {showAddPinjaman && (
        <KopModal title="Ajukan Pinjaman" subtitle="Pinjaman anggota koperasi" onClose={() => setShowAddPinjaman(false)}>
          <form onSubmit={handleAddPinjaman} className="space-y-4">
            <div>
              <label className="kop-label">Anggota *</label>
              <select value={pinjamanForm.memberId} onChange={e => setPinjamanForm(f => ({ ...f, memberId: e.target.value }))} required className="kop-input">
                <option value="">— Pilih Anggota —</option>
                {koperasiMembers.filter(m => m.status === "Active").map(m => <option key={m.id} value={m.id}>{m.employeeName}</option>)}
              </select>
            </div>
            <div>
              <label className="kop-label">Pokok Pinjaman *</label>
              <input type="number" value={pinjamanForm.amount || ""} onChange={e => setPinjamanForm(f => ({ ...f, amount: +e.target.value }))} required min={1} className="kop-input" placeholder="Rp 0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div><label className="kop-label">Biaya Admin</label><div className="kop-input bg-slate-100 text-slate-600">Otomatis 2,5%</div></div>
              </div>
              <div>
                <label className="kop-label">Jumlah Cicilan</label>
                <select value={pinjamanForm.installmentCount} onChange={e => setPinjamanForm(f => ({ ...f, installmentCount: +e.target.value }))} className="kop-input">
                  {[3, 6, 10, 12, 18, 24].map(n => <option key={n} value={n}>{n}x bulan</option>)}
                </select>
              </div>
            </div>
            {pinjamanForm.amount > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                {[
                  ["Pokok Pinjaman", formatRp(pinjamanForm.amount)],
                  ["Biaya Admin", formatRp(pinAdminFee)],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-black text-slate-900">{v}</span></div>
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-black text-slate-700">Total</span>
                  <span className="font-black text-slate-900">{formatRp(pinTotal)}</span>
                </div>
                <div className="flex justify-between bg-blue-50 rounded-lg px-2 py-1.5 mt-1">
                  <span className="font-black text-blue-700">Angsuran / bulan</span>
                  <span className="font-black text-blue-800">{formatRp(pinAngsuran)}</span>
                </div>
              </div>
            )}
            <div>
              <label className="kop-label">Keperluan</label>
              <textarea value={pinjamanForm.notes} onChange={e => setPinjamanForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="kop-input resize-none" placeholder="Opsional" />
            </div>
            <KopActions onCancel={() => setShowAddPinjaman(false)} label="Submit Pengajuan" disabled={isSubmitting} />
          </form>
        </KopModal>
      )}

      {/* ── Modal: Top-up Kas Koperasi ── */}
      {showTopUp && (
        <KopModal title="Top Up Kas Koperasi" subtitle="Akan dicatat sebagai kredit rekonsiliasi bank" onClose={() => setShowTopUp(false)}>
          <form onSubmit={handleTopUp} className="space-y-4">
            <div>
              <label className="kop-label">Rekening Bank Koperasi *</label>
              <input value={topUpForm.bankAccount} onChange={e => setTopUpForm(f => ({ ...f, bankAccount: e.target.value }))} required className="kop-input" placeholder="Contoh: BCA Koperasi 1234567890" />
            </div>
            <div>
              <label className="kop-label">Nominal Top-up *</label>
              <input type="number" value={topUpForm.amount || ""} onChange={e => setTopUpForm(f => ({ ...f, amount: Number(e.target.value) }))} required min={1} className="kop-input" placeholder="Rp 0" />
            </div>
            <div>
              <label className="kop-label">Catatan</label>
              <textarea value={topUpForm.notes} onChange={e => setTopUpForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="kop-input resize-none" placeholder="Sumber atau tujuan top-up" />
            </div>
            <KopActions onCancel={() => setShowTopUp(false)} label="Catat Top-up" disabled={isSubmitting} />
          </form>
        </KopModal>
      )}

      {/* ── Modal: Detail Pinjaman ── */}
      {detailPinjaman && (
        <KopModal title={detailPinjaman.pinjamanNo} subtitle="Detail Pinjaman Anggota" onClose={() => setDetailPinjaman(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Avatar name={detailPinjaman.memberName} size="lg" />
              <div className="flex-1">
                <p className="font-black text-slate-900">{detailPinjaman.memberName}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold">{fmt(detailPinjaman.requestDate)}</p>
              </div>
              {(() => { const st = STATUS_PINJAMAN[detailPinjaman.status]; return st ? (
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
              ) : null; })()}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Pokok Pinjaman", formatRp(detailPinjaman.amount)],
                ["Total + Admin",  formatRp(detailPinjaman.totalAmount)],
                ["Angsuran/bln",   formatRp(detailPinjaman.installmentAmount)],
                ["Sisa Cicilan",   `${detailPinjaman.installmentCount - detailPinjaman.paidInstallments}x`],
                ["Tgl Pengajuan",  fmt(detailPinjaman.requestDate)],
                ["Disetujui",      detailPinjaman.approvedDate ? fmt(detailPinjaman.approvedDate) : "—"],
              ].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l}</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase">Progress Cicilan</span>
                <span className="font-black text-slate-900">{detailPinjaman.paidInstallments}/{detailPinjaman.installmentCount}</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.round(detailPinjaman.paidInstallments / detailPinjaman.installmentCount * 100)}%` }} />
              </div>
            </div>
            {detailPinjaman.notes && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Keperluan</p>
                <p className="text-sm text-slate-700">{detailPinjaman.notes}</p>
              </div>
            )}
            {detailPinjaman.status === "Pending" && (
              <button onClick={() => { approvePinjaman(detailPinjaman); setDetailPinjaman(null); }} disabled={processingId !== null}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle2 size={13} /> Setujui & Cairkan
              </button>
            )}
            {detailPinjaman.status === "Active" && (
              <button onClick={() => bayarAngsuran(detailPinjaman)} disabled={processingId !== null}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Catat Pembayaran Angsuran #{detailPinjaman.paidInstallments + 1}
              </button>
            )}
          </div>
        </KopModal>
      )}

    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ActionBtn({ onClick, label, color = "blue" }: { onClick: () => void; label: string; color?: string }) {
  const hover = color === "emerald" ? "hover:bg-emerald-600" : color === "purple" ? "hover:bg-purple-600" : "hover:bg-blue-600";
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 bg-slate-900 ${hover} text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg`}>
      <Plus size={13} /> {label}
    </button>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "w-6 h-6 text-[9px]" : size === "lg" ? "w-9 h-9 text-sm" : "w-7 h-7 text-[10px]";
  return (
    <div className={`${cls} bg-slate-900 rounded-full flex items-center justify-center font-black text-white shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function Thead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-slate-50/60 border-b border-slate-100">
        {cols.map(h => <th key={h} className="px-4 py-3.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>)}
      </tr>
    </thead>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-16 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">{icon}</div>
      <p className="text-sm font-black text-slate-300 uppercase italic">{text}</p>
    </div>
  );
}

function TFoot({ count, label, extra }: { count: number; label: string; extra?: string }) {
  if (count === 0) return null;
  return (
    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between">
      <span className="text-[10px] font-black text-slate-400 uppercase">{count} {label}</span>
      {extra && <span className="text-[10px] font-black text-slate-600 uppercase">{extra}</span>}
    </div>
  );
}

function KopModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase italic tracking-tighter">{title}</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-xl flex items-center justify-center transition-all">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function KopActions({ onCancel, label, disabled }: { onCancel: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex gap-3 pt-2 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Batal</button>
      <button type="submit" disabled={disabled} className="flex-1 py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{disabled ? 'Memproses...' : label}</button>
    </div>
  );
}
