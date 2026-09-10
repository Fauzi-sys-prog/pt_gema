import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import {
  Save, Settings, Shield, Building2, Clock, Percent,
  Plus, Trash2, FileText, ChevronRight
} from 'lucide-react';
import { useApp, type PayrollPolicy } from '../../contexts/AppContext';
import { toast } from 'sonner';

type IncentiveRule = { minAttendancePct: number; maxAttendancePct: number; deductionPct: number };

const DEFAULT_POLICY: PayrollPolicy = {
  id: 'default',
  policyName: 'Kebijakan Penggajian Utama',
  effectiveDate: new Date().toISOString().split('T')[0],
  companyName: '',
  companyAddress: '',
  standardWorkDays: 25,
  standardWorkHours: 8,
  mealAllowancePerDay: 0,
  overtimeRateMultiplier: 1.5,
  incentiveDeductionRules: [
    { minAttendancePct: 0, maxAttendancePct: 74, deductionPct: 100 },
    { minAttendancePct: 75, maxAttendancePct: 84, deductionPct: 50 },
    { minAttendancePct: 85, maxAttendancePct: 94, deductionPct: 25 },
    { minAttendancePct: 95, maxAttendancePct: 100, deductionPct: 0 },
  ],
  incentiveDeductionPerAbsencePercent: 25,
  bpjsJHTEmployer: 3.7,
  bpjsJHTEmployee: 2,
  bpjsJPEmployer: 2,
  bpjsJPEmployee: 1,
  bpjsJKKEmployer: 0.24,
  bpjsJKMEmployer: 0.3,
  bpjsKesEmployer: 4,
  bpjsKesEmployee: 1,
  roundingRule: 'none',
  signatoryPrepared: '',
  signatoryChecked: 'Sri Rahayu',
  signatoryApproved: 'Syamsudin',
  holidayDates: [],
};

const SECTION_IDS = [
  'umum', 'standar', 'insentif', 'bpjs-ket', 'bpjs-kes', 'pembulatan', 'penandatangan'
] as const;
type SectionId = typeof SECTION_IDS[number];

const SECTION_LABELS: Record<SectionId, string> = {
  umum: 'Informasi Umum',
  standar: 'Standar Kerja',
  insentif: 'Aturan Potongan Insentif',
  'bpjs-ket': 'BPJS Ketenagakerjaan',
  'bpjs-kes': 'BPJS Kesehatan',
  pembulatan: 'Pembulatan',
  penandatangan: 'Penandatangan Slip',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

function SectionCard({
  id,
  icon,
  title,
  children,
}: {
  id: SectionId;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50">
        <div className="p-2 bg-blue-50 rounded-xl text-blue-600">{icon}</div>
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{children}</label>
  );
}

const inputCls =
  'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400';

export default function PayrollPolicyPage() {
  const { payrollPolicy, setPayrollPolicy } = useApp();
  // searchParams available if needed for future use
  const [searchParams] = useSearchParams();
  void searchParams;

  const [policy, setPolicy] = useState<PayrollPolicy>(payrollPolicy ?? DEFAULT_POLICY);
  const [rules, setRules] = useState<IncentiveRule[]>(
    (payrollPolicy ?? DEFAULT_POLICY).incentiveDeductionRules
  );
  const [activeSection, setActiveSection] = useState<SectionId>('umum');
  const [previewPct, setPreviewPct] = useState(80);

  // Sync if context updates from storage
  useEffect(() => {
    if (payrollPolicy) {
      setPolicy(payrollPolicy);
      setRules(payrollPolicy.incentiveDeductionRules);
    }
  }, [payrollPolicy]);

  const update = (key: keyof PayrollPolicy, value: PayrollPolicy[keyof PayrollPolicy]) => {
    setPolicy(prev => ({ ...prev, [key]: value }));
  };

  const updateRule = (idx: number, key: keyof IncentiveRule, value: number) => {
    setRules(prev => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRule = () => {
    setRules(prev => [...prev, { minAttendancePct: 0, maxAttendancePct: 100, deductionPct: 0 }]);
  };

  const removeRule = (idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
  };

  const getPreviewDeduction = () => {
    const match = rules.find(
      r => previewPct >= r.minAttendancePct && previewPct <= r.maxAttendancePct
    );
    return match ? match.deductionPct : null;
  };

  const handleSave = () => {
    const toSave: PayrollPolicy = { ...policy, incentiveDeductionRules: rules };
    setPayrollPolicy(toSave);
    toast.success('Kebijakan penggajian berhasil disimpan');
  };

  const scrollTo = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const previewDed = getPreviewDeduction();

  return (
    <div className="flex gap-6 p-6 bg-slate-50 min-h-screen">
      {/* Sidebar Nav */}
      <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 sticky top-6 self-start">
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 mb-1">Bagian</p>
          {SECTION_IDS.map(sid => (
            <button
              key={sid}
              onClick={() => scrollTo(sid)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                activeSection === sid
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ChevronRight size={12} />
              {SECTION_LABELS[sid]}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6 max-w-2xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded tracking-widest">HR</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">Kebijakan</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
              <Settings className="text-blue-600" size={28} /> Payroll Policy
            </h1>
            <p className="text-slate-500 text-sm font-bold uppercase italic">Konfigurasi Aturan Penggajian Perusahaan</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Save size={16} /> Simpan Kebijakan
          </button>
        </div>

        {/* 1. Informasi Umum */}
        <SectionCard id="umum" icon={<Building2 size={16} />} title={SECTION_LABELS.umum}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Nama Kebijakan</FieldLabel>
              <input
                type="text"
                value={policy.policyName}
                onChange={e => update('policyName', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Tanggal Efektif</FieldLabel>
              <input
                type="date"
                value={policy.effectiveDate}
                onChange={e => update('effectiveDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Nama Perusahaan</FieldLabel>
              <input
                type="text"
                value={policy.companyName}
                onChange={e => update('companyName', e.target.value)}
                className={inputCls}
                placeholder="PT. Nama Perusahaan"
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Alamat Perusahaan</FieldLabel>
              <textarea
                value={policy.companyAddress ?? ''}
                onChange={e => update('companyAddress', e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Jl. ..."
              />
            </div>
          </div>
        </SectionCard>

        {/* 2. Standar Kerja */}
        <SectionCard id="standar" icon={<Clock size={16} />} title={SECTION_LABELS.standar}>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Hari Kerja Standar / Bulan</FieldLabel>
              <input
                type="number"
                value={policy.standardWorkDays}
                onChange={e => update('standardWorkDays', Number(e.target.value))}
                min={1}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Jam Kerja Standar / Hari</FieldLabel>
              <input
                type="number"
                value={policy.standardWorkHours}
                onChange={e => update('standardWorkHours', Number(e.target.value))}
                min={1}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Uang Makan / Hari (IDR)</FieldLabel>
              <input
                type="number"
                value={policy.mealAllowancePerDay}
                onChange={e => update('mealAllowancePerDay', Number(e.target.value))}
                min={0}
                className={inputCls}
              />
              {policy.mealAllowancePerDay > 0 && (
                <p className="text-[10px] text-slate-400 font-bold mt-1">= {fmt(policy.mealAllowancePerDay)}/hari</p>
              )}
            </div>
            <div>
              <FieldLabel>Multiplier Lembur</FieldLabel>
              <input
                type="number"
                value={policy.overtimeRateMultiplier}
                onChange={e => update('overtimeRateMultiplier', Number(e.target.value))}
                step={0.1}
                min={1}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 font-bold mt-1">Tarif lembur = {policy.overtimeRateMultiplier}× tarif normal</p>
            </div>
            <div className="col-span-2">
              <FieldLabel>Libur Nasional / Hari Libur (satu tanggal per baris)</FieldLabel>
              <textarea
                value={(policy.holidayDates ?? []).join('\n')}
                onChange={e => update('holidayDates', e.target.value.split(/\s+/).filter(Boolean))}
                className={`${inputCls} min-h-24 resize-y`}
                placeholder={'2026-01-01\n2026-02-17'}
              />
            </div>
          </div>
        </SectionCard>

        {/* 3. Aturan Potongan Insentif */}
        <SectionCard id="insentif" icon={<Percent size={16} />} title={SECTION_LABELS.insentif}>
          <div className="space-y-4">
            <div className="max-w-xs">
              <FieldLabel>Potongan Insentif per Hari Tidak Masuk (%)</FieldLabel>
              <input type="number" min={0} max={100} step={0.1}
                value={policy.incentiveDeductionPerAbsencePercent ?? 25}
                onChange={e => update('incentiveDeductionPerAbsencePercent', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Min Kehadiran %</th>
                    <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Max Kehadiran %</th>
                    <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Potongan %</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rules.map((rule, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={rule.minAttendancePct}
                          onChange={e => updateRule(idx, 'minAttendancePct', Number(e.target.value))}
                          min={0}
                          max={100}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={rule.maxAttendancePct}
                          onChange={e => updateRule(idx, 'maxAttendancePct', Number(e.target.value))}
                          min={0}
                          max={100}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={rule.deductionPct}
                          onChange={e => updateRule(idx, 'deductionPct', Number(e.target.value))}
                          min={0}
                          max={100}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addRule}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Plus size={13} /> Tambah Baris
            </button>

            {/* Live Preview */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Preview Kalkulasi</p>
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Kehadiran:</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={previewPct}
                  onChange={e => setPreviewPct(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-black text-blue-700 w-10 text-right">{previewPct}%</span>
              </div>
              {previewDed !== null ? (
                <p className="text-xs font-bold text-slate-700">
                  Jika kehadiran <strong>{previewPct}%</strong>, potongan ={' '}
                  <strong className="text-red-600">{previewDed}%</strong> dari insentif
                </p>
              ) : (
                <p className="text-xs font-bold text-slate-400">Tidak ada aturan yang cocok untuk {previewPct}%</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 4. BPJS Ketenagakerjaan */}
        <SectionCard id="bpjs-ket" icon={<Shield size={16} />} title={SECTION_LABELS['bpjs-ket']}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 w-1/3">Komponen</th>
                  <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Perusahaan %</th>
                  <th className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Karyawan %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  {
                    label: 'JHT (Jaminan Hari Tua)',
                    empKey: 'bpjsJHTEmployer' as keyof PayrollPolicy,
                    workerKey: 'bpjsJHTEmployee' as keyof PayrollPolicy,
                  },
                  {
                    label: 'JP (Jaminan Pensiun)',
                    empKey: 'bpjsJPEmployer' as keyof PayrollPolicy,
                    workerKey: 'bpjsJPEmployee' as keyof PayrollPolicy,
                  },
                  {
                    label: 'JKK (Jaminan Kecelakaan)',
                    empKey: 'bpjsJKKEmployer' as keyof PayrollPolicy,
                    workerKey: null,
                  },
                  {
                    label: 'JKM (Jaminan Kematian)',
                    empKey: 'bpjsJKMEmployer' as keyof PayrollPolicy,
                    workerKey: null,
                  },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="py-3 pr-3 font-bold text-slate-700">{row.label}</td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        value={policy[row.empKey] as number}
                        onChange={e => update(row.empKey, Number(e.target.value))}
                        step={0.01}
                        min={0}
                        className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </td>
                    <td className="py-3">
                      {row.workerKey ? (
                        <input
                          type="number"
                          value={policy[row.workerKey] as number}
                          onChange={e => update(row.workerKey!, Number(e.target.value))}
                          step={0.01}
                          min={0}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* 5. BPJS Kesehatan */}
        <SectionCard id="bpjs-kes" icon={<Shield size={16} />} title={SECTION_LABELS['bpjs-kes']}>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <FieldLabel>Perusahaan %</FieldLabel>
              <input
                type="number"
                value={policy.bpjsKesEmployer}
                onChange={e => update('bpjsKesEmployer', Number(e.target.value))}
                step={0.1}
                min={0}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Karyawan %</FieldLabel>
              <input
                type="number"
                value={policy.bpjsKesEmployee}
                onChange={e => update('bpjsKesEmployee', Number(e.target.value))}
                step={0.1}
                min={0}
                className={inputCls}
              />
            </div>
          </div>
        </SectionCard>

        {/* 6. Pembulatan */}
        <SectionCard id="pembulatan" icon={<Settings size={16} />} title={SECTION_LABELS.pembulatan}>
          <div className="space-y-3">
            {(
              [
                ['none', 'Tidak ada pembulatan'],
                ['nearest1000', 'Dibulatkan ke Rp 1.000 terdekat'],
                ['nearest500', 'Dibulatkan ke Rp 500 terdekat'],
              ] as Array<[PayrollPolicy['roundingRule'], string]>
            ).map(([val, label]) => (
              <label key={val} className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    policy.roundingRule === val
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300 group-hover:border-blue-300'
                  }`}
                  onClick={() => update('roundingRule', val)}
                >
                  {policy.roundingRule === val && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-bold text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* 7. Penandatangan Slip */}
        <SectionCard id="penandatangan" icon={<FileText size={16} />} title={SECTION_LABELS.penandatangan}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FieldLabel>Disiapkan Oleh</FieldLabel>
              <input
                type="text"
                value={policy.signatoryPrepared}
                onChange={e => update('signatoryPrepared', e.target.value)}
                placeholder="Nama / Jabatan"
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Diperiksa Oleh</FieldLabel>
              <input
                type="text"
                value={policy.signatoryChecked}
                onChange={e => update('signatoryChecked', e.target.value)}
                placeholder="Nama / Jabatan"
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Disetujui Oleh</FieldLabel>
              <input
                type="text"
                value={policy.signatoryApproved}
                onChange={e => update('signatoryApproved', e.target.value)}
                placeholder="Nama / Jabatan"
                className={inputCls}
              />
            </div>
          </div>
        </SectionCard>

        {/* Bottom Save */}
        <div className="flex justify-end pb-10">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Save size={18} /> Simpan Kebijakan
          </button>
        </div>
      </div>
    </div>
  );
}
