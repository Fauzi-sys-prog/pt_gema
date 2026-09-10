import { useState, useMemo } from 'react';
import { Search, Edit2, Check, X, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, type EmployeeCompensation } from '../../contexts/AppContext';

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

interface EditRow {
  transportAllowance: string;
  mealAllowancePerDay: string;
  maximumIncentive: string;
  positionAllowance: string;
  overtimeRate: string;
  jpk: string;
}

export default function TunjanganPage() {
  const { employeeList, employeeCompensations, setEmployeeCompensation, payrollPolicy } = useApp();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditRow>({
    transportAllowance: '0',
    mealAllowancePerDay: '0',
    maximumIncentive: '0',
    positionAllowance: '0',
    overtimeRate: '0',
    jpk: '0',
  });
  const [sortKey, setSortKey] = useState<'name' | 'transport' | 'meal' | 'insentif'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeEmployees = useMemo(() =>
    employeeList.filter(e => e.status === 'Active'),
    [employeeList]
  );

  const rows = useMemo(() => {
    return activeEmployees
      .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
      .map(e => {
        const comp = employeeCompensations.find(c => c.employeeId === e.id);
        return { employee: e, comp };
      })
      .sort((a, b) => {
        let va: number | string = 0, vb: number | string = 0;
        if (sortKey === 'name') { va = a.employee.name; vb = b.employee.name; }
        if (sortKey === 'transport') { va = a.comp?.transportAllowance ?? 0; vb = b.comp?.transportAllowance ?? 0; }
        if (sortKey === 'meal') { va = a.comp?.mealAllowancePerDay ?? 0; vb = b.comp?.mealAllowancePerDay ?? 0; }
        if (sortKey === 'insentif') { va = a.comp?.maximumIncentive ?? 0; vb = b.comp?.maximumIncentive ?? 0; }
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
  }, [activeEmployees, search, employeeCompensations, sortKey, sortAsc]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const startEdit = (employeeId: string) => {
    const comp = employeeCompensations.find(c => c.employeeId === employeeId);
    setEditForm({
      transportAllowance:  String(comp?.transportAllowance  ?? 0),
      mealAllowancePerDay: String(comp?.mealAllowancePerDay ?? payrollPolicy?.mealAllowancePerDay ?? 25000),
      maximumIncentive:    String(comp?.maximumIncentive    ?? 0),
      positionAllowance:   String(comp?.positionAllowance   ?? 0),
      overtimeRate:        String(comp?.overtimeRate        ?? 0),
      jpk:                 String(comp?.bpjsKetEmployerAmount ?? comp?.bpjsKetEmployerPct ?? 220035),
    });
    setEditId(employeeId);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = (employeeId: string) => {
    if (isSaving) return;
    const emp = employeeList.find(e => e.id === employeeId);
    if (!emp) return;
    const existing = employeeCompensations.find(c => c.employeeId === employeeId);
    const updated: EmployeeCompensation = {
      id:                 existing?.id ?? `comp-${employeeId}`,
      employeeId,
      baseSalary:         existing?.baseSalary ?? emp.salary ?? 0,
      transportAllowance: parseFloat(editForm.transportAllowance)  || 0,
      mealAllowancePerDay:parseFloat(editForm.mealAllowancePerDay) || 0,
      maximumIncentive:   parseFloat(editForm.maximumIncentive)    || 0,
      positionAllowance:  parseFloat(editForm.positionAllowance)   || 0,
      overtimeRate:         parseFloat(editForm.overtimeRate)        || 0,
      bpjsKetEmployerPct:   parseFloat(editForm.jpk)                || 0,
      bpjsKetEmployerAmount: parseFloat(editForm.jpk)               || 0,
    };
    setIsSaving(true);
    try {
      setEmployeeCompensation(updated);
      toast.success(`Tunjangan ${emp.name} berhasil disimpan`);
      setEditId(null);
    } catch (err) {
      toast.error('Gagal menyimpan tunjangan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : null;

  // Summary totals
  const totalTransport  = rows.reduce((s, r) => s + (r.comp?.transportAllowance  ?? 0), 0);
  const totalMealPerDay = rows.reduce((s, r) => s + (r.comp?.mealAllowancePerDay ?? 0), 0);
  const totalInsentif   = rows.reduce((s, r) => s + (r.comp?.maximumIncentive    ?? 0), 0);
  const stdDays = payrollPolicy?.standardWorkDays ?? 25;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Tunjangan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data tunjangan per karyawan yang digunakan saat proses payroll
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
          <Info size={13} />
          Perubahan berlaku di payroll berikutnya
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Tunjangan Transport / Bulan', value: fmtRp(totalTransport), sub: `${rows.length} karyawan aktif` },
          { label: 'Total Tunjangan Makan / Hari', value: fmtRp(totalMealPerDay), sub: `Estimasi/bln: ${fmtRp(totalMealPerDay * stdDays)}` },
          { label: 'Total Tunjangan Insentif / Bulan', value: fmtRp(totalInsentif), sub: 'Jika hadir penuh' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Daftar Tunjangan Karyawan</h2>
          <div className="relative w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari karyawan..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left">
                  <button className="flex items-center gap-1 hover:text-gray-700" onClick={() => toggleSort('name')}>
                    Karyawan <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left">Tipe</th>
                <th className="px-4 py-2.5 text-right">
                  <button className="flex items-center gap-1 ml-auto hover:text-gray-700" onClick={() => toggleSort('transport')}>
                    Tunjangan Transport <SortIcon k="transport" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <button className="flex items-center gap-1 ml-auto hover:text-gray-700" onClick={() => toggleSort('meal')}>
                    Makan / Hari <SortIcon k="meal" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <button className="flex items-center gap-1 ml-auto hover:text-gray-700" onClick={() => toggleSort('insentif')}>
                    Tunjangan Insentif <SortIcon k="insentif" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">Tunjangan JPK</th>
                <th className="px-4 py-2.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ employee: emp, comp }) => (
                <tr key={emp.id} className={editId === emp.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-400">{emp.employeeId}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      emp.employmentType === 'Permanent' ? 'bg-green-100 text-green-700'
                      : emp.employmentType === 'Contract' ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {emp.employmentType}
                    </span>
                  </td>

                  {editId === emp.id ? (
                    <>
                      <td className="px-4 py-1.5 text-right">
                        <input type="number" value={editForm.transportAllowance}
                          onChange={e => setEditForm(f => ({ ...f, transportAllowance: e.target.value }))}
                          className="w-32 text-right px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <input type="number" value={editForm.mealAllowancePerDay}
                          onChange={e => setEditForm(f => ({ ...f, mealAllowancePerDay: e.target.value }))}
                          className="w-28 text-right px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <input type="number" value={editForm.maximumIncentive}
                          onChange={e => setEditForm(f => ({ ...f, maximumIncentive: e.target.value }))}
                          className="w-32 text-right px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <input type="number" value={editForm.jpk}
                          onChange={e => setEditForm(f => ({ ...f, jpk: e.target.value }))}
                          className="w-32 text-right px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => saveEdit(emp.id)} disabled={isSaving}
                            className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Check size={13} />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {comp ? fmtRp(comp.transportAllowance) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {comp ? fmtRp(comp.mealAllowancePerDay) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {comp ? fmtRp(comp.maximumIncentive) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {fmtRp(comp?.bpjsKetEmployerAmount ?? comp?.bpjsKetEmployerPct ?? 220035)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => startEdit(emp.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit tunjangan">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Tidak ada karyawan ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">Cara kerja tunjangan di payroll:</p>
        <p>• <strong>Tunjangan Transport</strong> — dibayar tetap per bulan tanpa memandang kehadiran</p>
        <p>• <strong>Tunjangan Makan</strong> — dibayar per hari hadir (jumlah hari × rate/hari)</p>
        <p>• <strong>Tunjangan Insentif</strong> — penuh jika hadir semua hari kerja, dipotong proporsional jika ada absen</p>
        <p>• <strong>Tunjangan Jabatan</strong> — dibayar tetap per bulan</p>
        <p>• <strong>Rate Lembur</strong> — digunakan saat menghitung jam lembur dari data absensi</p>
      </div>
    </div>
  );
}
