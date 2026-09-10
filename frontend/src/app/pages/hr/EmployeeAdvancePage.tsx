import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Plus, Search, Banknote, Clock, CheckCircle, XCircle,
  Send, Wallet, Users, AlertCircle, X, Eye, Info
} from 'lucide-react';
import { useApp, type EmployeeAdvance, type Employee } from '../../contexts/AppContext';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const getMonthYear = (dateStr: string) => {
  const d = new Date(dateStr);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};

const monthLabel = (month: number, year: number) => {
  const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return `${names[month - 1]} ${year}`;
};

type TabKey = 'Semua' | 'Karyawan' | 'THL' | 'Menunggu Approval' | 'Approved' | 'Disbursed' | 'Ditolak';

const TABS: TabKey[] = ['Semua', 'Karyawan', 'THL', 'Menunggu Approval', 'Approved', 'Disbursed', 'Ditolak'];

const STATUS_BADGE: Record<EmployeeAdvance['status'], string> = {
  Draft:              'bg-slate-100 text-slate-500',
  Submitted:          'bg-amber-100 text-amber-700',
  Approved:           'bg-blue-100 text-blue-700',
  Rejected:           'bg-red-100 text-red-600',
  Disbursed:          'bg-emerald-100 text-emerald-700',
  'Partially Deducted': 'bg-cyan-100 text-cyan-700',
  Settled:            'bg-slate-100 text-slate-400',
  Cancelled:          'bg-slate-100 text-slate-400',
};

const STATUS_LABEL: Record<EmployeeAdvance['status'], string> = {
  Draft:              'Draft',
  Submitted:          'Menunggu',
  Approved:           'Disetujui',
  Rejected:           'Ditolak',
  Disbursed:          'Dicairkan',
  'Partially Deducted': 'Dipotong Sebagian',
  Settled:            'Sudah Dipotong',
  Cancelled:          'Dibatalkan',
};

interface FormState {
  employeeId: string;
  requestDate: string;
  amount: string;
  description: string;
  adminFeePercent: string;
  installmentCount: string;
}

const EMPTY_FORM: FormState = {
  employeeId: '',
  requestDate: new Date().toISOString().split('T')[0],
  amount: '',
  description: '',
  adminFeePercent: '2.5',
  installmentCount: '1',
};

export default function EmployeeAdvancePage() {
  const {
    employeeAdvanceList,
    addEmployeeAdvance,
    updateEmployeeAdvance,
    employeeList,
    projectList,
  } = useApp();

  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const initialTab: TabKey =
    initialType === 'thl' ? 'THL' : initialType === 'employee' ? 'Karyawan' : 'Semua';

  const [activeTab, setActiveTab]   = useState<TabKey>(initialTab);
  const [search, setSearch]         = useState('');
  const [showPanel, setShowPanel]   = useState(false);
  const [viewAdv, setViewAdv]       = useState<EmployeeAdvance | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [confirmAdv, setConfirmAdv] = useState<{ adv: EmployeeAdvance; action: 'approve' | 'reject' | 'disburse' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // KPI
  const thisMonth = new Date();
  const totalDisbursedThisMonth = useMemo(() =>
    employeeAdvanceList
      .filter(a => {
        if (a.status !== 'Disbursed') return false;
        const { month, year } = getMonthYear(a.disbursedAt ?? a.requestDate);
        return month === thisMonth.getMonth() + 1 && year === thisMonth.getFullYear();
      })
      .reduce((s, a) => s + a.originalAmount, 0),
    [employeeAdvanceList]
  );
  const countPending = useMemo(
    () => employeeAdvanceList.filter(a => a.status === 'Submitted').length,
    [employeeAdvanceList]
  );
  const countApproved = useMemo(
    () => employeeAdvanceList.filter(a => a.status === 'Approved').length,
    [employeeAdvanceList]
  );
  const countDistinctEmployees = useMemo(
    () => new Set(
      employeeAdvanceList
        .filter(a => a.status === 'Disbursed')
        .map(a => a.employeeId)
    ).size,
    [employeeAdvanceList]
  );

  // Tab filter
  const filtered = useMemo(() => {
    let list = employeeAdvanceList;
    if (activeTab === 'Karyawan')           list = list.filter(a => a.employeeType === 'Karyawan');
    else if (activeTab === 'THL')           list = list.filter(a => a.employeeType === 'THL');
    else if (activeTab === 'Menunggu Approval') list = list.filter(a => a.status === 'Submitted');
    else if (activeTab === 'Approved')      list = list.filter(a => a.status === 'Approved');
    else if (activeTab === 'Disbursed')     list = list.filter(a => a.status === 'Disbursed' || a.status === 'Settled' || a.status === 'Partially Deducted');
    else if (activeTab === 'Ditolak')       list = list.filter(a => a.status === 'Rejected' || a.status === 'Cancelled');

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.employeeName.toLowerCase().includes(q) ||
        a.advanceNumber.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employeeAdvanceList, activeTab, search]);

  const getEmployeeType = (emp: Employee): EmployeeAdvance['employeeType'] =>
    emp.employmentType === 'THL' ? 'THL' : 'Karyawan';

  const selectedEmployee = employeeList.find(e => e.id === form.employeeId);

  // Total kasbon aktif (disbursed, belum dipotong payroll) untuk karyawan di bulan pengajuan
  const existingKasbonThisMonth = useMemo(() => {
    if (!form.employeeId || !form.requestDate) return [];
    const { month, year } = getMonthYear(form.requestDate);
    return employeeAdvanceList.filter(a => {
      if (a.employeeId !== form.employeeId) return false;
      if (!['Submitted', 'Approved', 'Disbursed'].includes(a.status)) return false;
      const mv = getMonthYear(a.requestDate);
      return mv.month === month && mv.year === year;
    });
  }, [form.employeeId, form.requestDate, employeeAdvanceList]);

  const totalExistingAmount = existingKasbonThisMonth.reduce((s, a) => s + a.originalAmount, 0);

  // For approval confirmation — show existing kasbon
  const confirmExistingKasbon = useMemo(() => {
    if (!confirmAdv) return [];
    const { month, year } = getMonthYear(confirmAdv.adv.requestDate);
    return employeeAdvanceList.filter(a => {
      if (a.id === confirmAdv.adv.id) return false;
      if (a.employeeId !== confirmAdv.adv.employeeId) return false;
      if (!['Submitted', 'Approved', 'Disbursed'].includes(a.status)) return false;
      const mv = getMonthYear(a.requestDate);
      return mv.month === month && mv.year === year;
    });
  }, [confirmAdv, employeeAdvanceList]);

  const openPanel = () => { setForm(EMPTY_FORM); setShowPanel(true); };

  const handleFormChange = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedEmployee) { toast.error('Pilih karyawan terlebih dahulu'); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Masukkan jumlah kasbon'); return; }
    // Admin kasbon mengikuti kebijakan payroll dan tidak diinput manual per transaksi.
    const adminFeePercent = 2.5;
    const installmentCount = Math.max(1, Math.floor(parseFloat(form.installmentCount) || 1));
    const adminFeeAmount = amount * adminFeePercent / 100;
    const totalReceivable = amount + adminFeeAmount;

    const now = Date.now();
    const id  = `ADV-${now}`;
    const d   = new Date(form.requestDate);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const advanceNumber = `KSB/${year}/${month}/${id.slice(-4)}`;

    const advance: EmployeeAdvance = {
      id,
      advanceNumber,
      employeeId:    selectedEmployee.id,
      employeeName:  selectedEmployee.name,
      employeeType:  getEmployeeType(selectedEmployee),
      requestDate:   form.requestDate,
      description:   form.description || undefined,
      originalAmount: amount,
      adminFeePercent,
      adminFeeAmount,
      installmentAmount: Math.ceil(totalReceivable / installmentCount),
      installmentCount,
      paidInstallments:  0,
      deductionThisPeriod: 0,
      remainingBalanceBefore: totalReceivable,
      remainingBalanceAfter:  totalReceivable,
      status: 'Draft',
    };

    setIsSubmitting(true);
    try {
      addEmployeeAdvance(advance);
      toast.success(`Kasbon ${advanceNumber} berhasil dibuat`);
      setShowPanel(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error('Gagal membuat kasbon: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeAction = (adv: EmployeeAdvance, action: string) => {
    if (processingId) return;
    if (action === 'cancel' && !window.confirm(`Batalkan kasbon ${adv.advanceNumber}?`)) return;
    setProcessingId(adv.id);
    try {
      switch (action) {
        case 'submit':
          updateEmployeeAdvance(adv.id, { status: 'Submitted' });
          toast.success(`${adv.advanceNumber} diajukan untuk approval`);
          break;
        case 'cancel':
          updateEmployeeAdvance(adv.id, { status: 'Cancelled' });
          toast.info('Kasbon dibatalkan');
          break;
        case 'approve':
          updateEmployeeAdvance(adv.id, {
            status: 'Approved',
            approvedBy: 'Manager',
            approvedAt: new Date().toISOString().split('T')[0],
          });
          toast.success(`${adv.advanceNumber} disetujui`);
          break;
        case 'reject':
          updateEmployeeAdvance(adv.id, { status: 'Rejected' });
          toast.error(`${adv.advanceNumber} ditolak`);
          break;
        case 'disburse':
          updateEmployeeAdvance(adv.id, {
            status: 'Disbursed',
            disbursedAt: new Date().toISOString().split('T')[0],
          });
          toast.success(`${adv.advanceNumber} dicairkan ke karyawan`);
          break;
      }
      setConfirmAdv(null);
    } catch (err) {
      toast.error('Aksi gagal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setProcessingId(null);
    }
  };

  const tabCounts: Partial<Record<TabKey, number>> = {
    'Menunggu Approval': countPending,
    'Approved': countApproved,
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">Kasbon</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            <Banknote className="text-blue-600" size={28} /> Kasbon Karyawan
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase italic">Pengajuan &amp; Approval Kasbon</p>
        </div>
        <button
          onClick={openPanel}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
        >
          <Plus size={16} /> Ajukan Kasbon
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 rounded-3xl px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl"><Wallet className="text-emerald-500" size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dicairkan Bulan Ini</p>
          </div>
          <p className="text-xl font-black text-emerald-600">{fmt(totalDisbursedThisMonth)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl"><Clock className="text-amber-500" size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menunggu Approval</p>
          </div>
          <p className="text-xl font-black text-amber-600">{countPending}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl"><CheckCircle className="text-blue-500" size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Siap Dicairkan</p>
          </div>
          <p className="text-xl font-black text-blue-600">{countApproved}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-indigo-50 rounded-xl"><Users className="text-indigo-500" size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan Kasbon</p>
          </div>
          <p className="text-xl font-black text-indigo-600">{countDistinctEmployees}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab}
            {tabCounts[tab] !== undefined && tabCounts[tab]! > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${activeTab === tab ? 'bg-blue-400 text-white' : 'bg-amber-100 text-amber-600'}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama / no. kasbon..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['No. Kasbon', 'Nama', 'Tipe', 'Jumlah Kasbon', 'Bulan Potong', 'Status', 'Tanggal Ajuan', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                filtered.map(adv => {
                  const { month, year } = getMonthYear(adv.requestDate);
                  return (
                    <tr key={adv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-black text-blue-600 whitespace-nowrap">{adv.advanceNumber}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-800 whitespace-nowrap">{adv.employeeName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${adv.employeeType === 'THL' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {adv.employeeType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-slate-800 whitespace-nowrap">{fmt(adv.originalAmount)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">{monthLabel(month, year)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${STATUS_BADGE[adv.status]}`}>
                          {STATUS_LABEL[adv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-400 font-bold whitespace-nowrap">{adv.requestDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setViewAdv(adv)}
                            className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all"
                            title="Lihat detail"
                          >
                            <Eye size={13} className="text-slate-500" />
                          </button>
                          {adv.status === 'Draft' && (
                            <>
                              <button
                                onClick={() => executeAction(adv, 'submit')}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded-lg hover:bg-blue-200 transition-all flex items-center gap-1"
                              >
                                <Send size={10} /> Submit
                              </button>
                              <button
                                onClick={() => executeAction(adv, 'cancel')}
                                className="px-2 py-1 bg-slate-100 text-slate-600 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                              >
                                Batal
                              </button>
                            </>
                          )}
                          {adv.status === 'Submitted' && (
                            <>
                              <button
                                onClick={() => setConfirmAdv({ adv, action: 'approve' })}
                                className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded-lg hover:bg-emerald-200 transition-all flex items-center gap-1"
                              >
                                <CheckCircle size={10} /> Approve
                              </button>
                              <button
                                onClick={() => setConfirmAdv({ adv, action: 'reject' })}
                                className="px-2 py-1 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded-lg hover:bg-red-100 transition-all flex items-center gap-1"
                              >
                                <XCircle size={10} /> Tolak
                              </button>
                            </>
                          )}
                          {adv.status === 'Approved' && (
                            <button
                              onClick={() => setConfirmAdv({ adv, action: 'disburse' })}
                              className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded-lg hover:bg-indigo-200 transition-all flex items-center gap-1"
                            >
                              <Wallet size={10} /> Cairkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="bg-blue-600 px-6 py-5 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Ajukan Kasbon Baru</p>
                <h2 className="text-xl font-black text-white uppercase italic">Form Kasbon</h2>
              </div>
              <button onClick={() => setShowPanel(false)} className="p-2 hover:bg-blue-500 rounded-xl transition-all">
                <X size={18} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-5 flex-1">
              {/* Karyawan */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Karyawan *</label>
                <select
                  value={form.employeeId}
                  onChange={e => handleFormChange('employeeId', e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employeeList.filter(e => e.status === 'Active').map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.employmentType})</option>
                  ))}
                </select>
                {selectedEmployee && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                    <span className={selectedEmployee.employmentType === 'THL' ? 'text-orange-500' : 'text-blue-500'}>{selectedEmployee.employmentType}</span>
                    {' · '}{selectedEmployee.position} · {selectedEmployee.department}
                  </p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Pengajuan *</label>
                <input
                  type="date"
                  value={form.requestDate}
                  onChange={e => handleFormChange('requestDate', e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                />
                {form.requestDate && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                    Akan dipotong dari gaji: <span className="text-blue-600">{monthLabel(getMonthYear(form.requestDate).month, getMonthYear(form.requestDate).year)}</span>
                  </p>
                )}
              </div>

              {/* Jumlah */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Jumlah Kasbon (IDR) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => handleFormChange('amount', e.target.value)}
                  placeholder="0"
                  min={1}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Biaya Admin</div>
                  <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">Otomatis 2,5%</div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Jumlah Cicilan</label>
                  <input type="number" min={1} value={form.installmentCount}
                    onChange={e => handleFormChange('installmentCount', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              {Number(form.amount) > 0 && (
                <p className="text-xs font-bold text-blue-700 bg-blue-50 rounded-xl p-3">
                  Total kasbon + admin: {fmt(Number(form.amount) * 1.025)} · potongan/periode sekitar {fmt(Math.ceil(Number(form.amount) * 1.025 / Math.max(1, Number(form.installmentCount) || 1)))}
                </p>
              )}

              {/* Keterangan */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => handleFormChange('description', e.target.value)}
                  placeholder="mis. biaya pengobatan, kebutuhan keluarga..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Kasbon aktif di bulan yang sama */}
              {existingKasbonThisMonth.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-amber-200 bg-amber-50">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
                    <Info size={13} className="text-amber-600 shrink-0" />
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                      Kasbon aktif {form.requestDate ? monthLabel(getMonthYear(form.requestDate).month, getMonthYear(form.requestDate).year) : ''}
                    </p>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {existingKasbonThisMonth.map(a => (
                      <div key={a.id} className="flex justify-between items-center px-4 py-2.5">
                        <div>
                          <p className="text-[10px] font-black text-amber-800">{a.advanceNumber}</p>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        </div>
                        <span className="text-xs font-black text-amber-800">{fmt(a.originalAmount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-2.5 bg-amber-100">
                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Total Kasbon Bulan Ini</span>
                      <span className="text-sm font-black text-amber-800">
                        {fmt(totalExistingAmount + (parseFloat(form.amount) || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-slate-500 font-bold">
                  Kasbon dibuat dengan status <strong>Draft</strong>. Submit untuk proses approval Manager, lalu Disbursed setelah uang dicairkan.
                  Potongan otomatis terjadi saat proses payroll bulan bersangkutan.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPanel(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : 'Buat Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval / Disburse Confirmation Modal */}
      {confirmAdv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-5 flex items-start justify-between ${
              confirmAdv.action === 'reject' ? 'bg-red-600' :
              confirmAdv.action === 'disburse' ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              <div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">
                  {confirmAdv.action === 'approve' ? 'Konfirmasi Approval' :
                   confirmAdv.action === 'reject'  ? 'Tolak Kasbon' : 'Cairkan Kasbon'}
                </p>
                <h2 className="text-lg font-black text-white uppercase italic">{confirmAdv.adv.advanceNumber}</h2>
                <p className="text-[11px] text-white/80 font-bold mt-0.5">{confirmAdv.adv.employeeName}</p>
              </div>
              <button onClick={() => setConfirmAdv(null)} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Jumlah kasbon ini */}
              <div className="flex justify-between items-center bg-slate-50 rounded-2xl px-4 py-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Kasbon</span>
                <span className="text-lg font-black text-slate-900">{fmt(confirmAdv.adv.originalAmount)}</span>
              </div>

              {/* Kasbon aktif lainnya di bulan yang sama */}
              {confirmExistingKasbon.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-amber-200">
                  <div className="bg-amber-50 px-4 py-2.5 flex items-center gap-2 border-b border-amber-100">
                    <Info size={12} className="text-amber-600 shrink-0" />
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">
                      Kasbon lain di bulan {monthLabel(getMonthYear(confirmAdv.adv.requestDate).month, getMonthYear(confirmAdv.adv.requestDate).year)}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {confirmExistingKasbon.map(a => (
                      <div key={a.id} className="flex justify-between items-center px-4 py-2.5">
                        <div>
                          <p className="text-[10px] font-black text-slate-600">{a.advanceNumber}</p>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600">{fmt(a.originalAmount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total jika disetujui</span>
                      <span className="text-sm font-black text-slate-800">
                        {fmt(confirmExistingKasbon.reduce((s, a) => s + a.originalAmount, 0) + confirmAdv.adv.originalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmAdv(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => executeAction(confirmAdv.adv, confirmAdv.action)}
                  disabled={processingId !== null}
                  className={`flex-1 py-3 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmAdv.action === 'reject'  ? 'bg-red-600 hover:bg-red-700' :
                    confirmAdv.action === 'disburse' ? 'bg-indigo-600 hover:bg-indigo-700' :
                    'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {processingId ? 'Memproses...' :
                   confirmAdv.action === 'approve'  ? 'Ya, Setujui' :
                   confirmAdv.action === 'reject'   ? 'Ya, Tolak' : 'Ya, Cairkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewAdv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-800 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detail Kasbon</p>
                <h2 className="text-lg font-black text-white uppercase italic">{viewAdv.advanceNumber}</h2>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">{viewAdv.employeeName}</p>
              </div>
              <button onClick={() => setViewAdv(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="p-6 space-y-1.5 text-xs">
              {([
                ['Tipe Karyawan',   viewAdv.employeeType],
                ['Tanggal Ajuan',  viewAdv.requestDate],
                ['Bulan Potong',   monthLabel(getMonthYear(viewAdv.requestDate).month, getMonthYear(viewAdv.requestDate).year)],
                ['Status',         STATUS_LABEL[viewAdv.status]],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">{label}</span>
                  <span className="font-bold text-slate-700 text-right">{value}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 mt-3">
                <div className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Jumlah Kasbon</span>
                  <span className="font-black text-slate-900 text-sm text-right">{fmt(viewAdv.originalAmount)}</span>
                </div>
              </div>
              {viewAdv.approvedBy && (
                <div className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Disetujui Oleh</span>
                  <span className="font-bold text-slate-700 text-right">{viewAdv.approvedBy} · {viewAdv.approvedAt}</span>
                </div>
              )}
              {viewAdv.disbursedAt && (
                <div className="flex justify-between gap-4">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Tanggal Cair</span>
                  <span className="font-bold text-slate-700 text-right">{viewAdv.disbursedAt}</span>
                </div>
              )}
              {viewAdv.description && (
                <div className="flex justify-between gap-4 pt-1">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Keterangan</span>
                  <span className="font-bold text-slate-700 text-right">{viewAdv.description}</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setViewAdv(null)}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
