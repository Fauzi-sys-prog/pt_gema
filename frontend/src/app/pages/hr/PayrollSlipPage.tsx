import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Printer, ChevronLeft } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const rp = (n: number) => n.toLocaleString('id-ID');
const rpFmt = (n: number) => 'Rp ' + rp(Math.round(n));
const rpReal = (n: number) => 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 3 });

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const fmtDateLong = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtDateShort = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

export default function PayrollSlipPage() {
  const { runId, employeeId } = useParams<{ runId: string; employeeId: string }>();
  const navigate = useNavigate();
  const { payrollRunList, payrollPolicy, employeeAdvanceList } = useApp();

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = `
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; margin: 0; }
        .slip-page { box-shadow: none !important; border-radius: 0 !important; padding: 12mm !important; }
      }
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  const run = payrollRunList.find(r => r.id === runId);
  const slip = run?.slips.find(s => s.employeeId === employeeId);

  if (!run || !slip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-3xl font-bold text-gray-300">404</p>
        <p className="text-gray-500 text-sm">Slip gaji tidak ditemukan.</p>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 no-print">
          <ChevronLeft size={16}/> Kembali
        </button>
      </div>
    );
  }

  const policy = slip.policySnapshot ?? payrollPolicy;
  const companyName = policy?.companyName ?? 'PT. GEMA TEKNIK PERKASA';
  const companyAddr = policy?.companyAddress ?? 'Jl. Nurshobih No.13 Setia Mekar\nTambun Selatan Bekasi 17510\nTelp. 021-88354139';

  // Seluruh angka di bawah adalah snapshot saat payroll dihitung. Perubahan
  // master tunjangan, absensi, cuti, lembur, atau kasbon tidak boleh mengubah slip lama.
  const subTotal1 = slip.baseSalary + slip.transportAllowance + slip.mealAllowance + slip.maximumIncentive + slip.positionAllowance;
  // Payroll lama tidak memiliki snapshot JPK; jangan menambahkan angka baru
  // ke dokumen historis yang dapat membuat totalnya berubah.
  const jpk = slip.jpkAllowance ?? 0;
  const lembur = slip.overtimePay;
  const lemburMultiplier = policy?.overtimeRateMultiplier ?? 1;
  const lemburRate = slip.overtimeHours > 0 && lemburMultiplier > 0
    ? lembur / slip.overtimeHours / lemburMultiplier
    : 0;
  const cutiAllowance = slip.cutiAllowance ?? 0;
  const subTotal2 = jpk + lembur + cutiAllowance;
  const totalIncome = slip.grossIncome;
  const dedKasbon = slip.kasbonDeduction;
  const dedKasbonAdmin = slip.kasbonAdminFee ?? 0;
  const dedPerush = jpk;
  const dedPerja = slip.bpjsKetEmployee;
  const dedJkn = slip.bpjsKesEmployee;
  const dedInsentif = slip.incentiveDeductionAmount;
  const dedKoperasiPinjaman = slip.koperasiLoanDeduction ?? slip.koperasiDeduction ?? 0;
  const dedKoperasiWajib = slip.koperasiMandatorySavingDeduction ?? 0;
  const totalDed = slip.totalDeductions;
  const thp = slip.takeHomePay;
  const alphaCount = slip.alphaDays ?? 0;
  const izinCount = slip.permissionDays ?? 0;
  const sakitCount = slip.sickDays ?? 0;
  const cutiCount = slip.leaveDays ?? 0;
  const holidayCount = slip.holidayDays ?? 0;

  const sigDate = run.disbursedAt ?? run.processedDate ?? new Date().toISOString();

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4">
      {/* Toolbar */}
      <div className="max-w-3xl mx-auto flex gap-3 mb-5 no-print">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ChevronLeft size={16}/> Kembali
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Printer size={16}/> Cetak Slip
        </button>
      </div>

      {/* Slip A4 */}
      <div className="slip-page max-w-3xl mx-auto bg-white shadow-xl rounded p-8 font-sans text-[11px] text-gray-900 leading-tight">

        {/* ══ HEADER ══ */}
        <div className="flex items-start justify-between border border-gray-900 mb-0">
          {/* Left: logo + address */}
          <div className="flex items-start gap-2 p-3 border-r border-gray-900 flex-1">
            <div className="border-2 border-gray-900 px-1.5 py-0.5 shrink-0 text-center leading-none">
              <div className="font-black text-red-600 text-base tracking-widest">GM</div>
              <div className="font-black text-gray-900 text-[8px] tracking-[0.25em]">TEKNIK</div>
            </div>
            <div>
              <div className="font-black text-[11px] text-gray-900 uppercase">{companyName}</div>
              {companyAddr.split('\n').map((l, i) => (
                <div key={i} className="text-[9px] text-gray-700">{l}</div>
              ))}
            </div>
          </div>
          {/* Right: title */}
          <div className="p-3 text-right shrink-0 w-44">
            <div className="font-black text-lg tracking-widest text-gray-900">SLIP GAJI</div>
            <div className="text-[9px] text-gray-600 mt-0.5">Periode {run.periodLabel}</div>
          </div>
        </div>

        {/* ══ NAMA ══ */}
        <div className="border border-t-0 border-gray-900 px-3 py-1.5 font-bold text-[11px]">
          Nama: <span className="uppercase">{slip.employeeName}</span>
          {slip.position && <span className="font-normal text-gray-500 ml-3 text-[10px]">{slip.position}</span>}
        </div>

        {/* ══ BODY: kiri + kanan ══ */}
        <div className="flex border border-t-0 border-gray-900">

          {/* ── KIRI ── */}
          <div className="flex-1 border-r border-gray-900">

            {/* PENDAPATAN */}
            <table className="w-full text-[10px] border-b border-gray-900">
              <tbody>
                <SlipRow label="Upah Pokok"          val={rpFmt(slip.baseSalary)} />
                <SlipRow label="Tunjangan Transport"  val={rpFmt(slip.transportAllowance)} />
                <SlipRow label="Tunjangan Makan" sub={`${slip.attendanceDays} Hari`} val={rpFmt(slip.mealAllowance)} />
                <SlipRow label="Tunjangan Insentif"   val={rpFmt(slip.maximumIncentive)} marker="(+)" />
                <SlipSubTotal label="Sub Total"       val={rpFmt(subTotal1)} />
                <SlipRow label="Tunjangan JPK"        val={rpFmt(jpk)} />
                <SlipRow label="Tunjangan Lembur" sub={slip.overtimeHours > 0 ? `${slip.overtimeHours} jam` : undefined} val={rpFmt(lembur)} />
                {slip.overtimeHours > 0 && <SlipNote text={`${slip.overtimeHours} jam × ${rpFmt(lemburRate)} × ${lemburMultiplier}x`} />}
                {(slip.overtimeReferences?.length ?? 0) > 0 && <SlipNote text={`SPK Lembur: ${slip.overtimeReferences!.join(', ')}`} />}
                {cutiAllowance > 0 && <SlipRow label="Tunjangan Cuti" val={rpFmt(cutiAllowance)} />}
                <SlipSubTotal label="Sub Total"       val={rpFmt(subTotal2)} />
                <SlipTotal    label="Total"           val={rpFmt(totalIncome)} />
              </tbody>
            </table>

            {/* POTONGAN */}
            <table className="w-full text-[10px]">
              <tbody>
                <SlipRow label="Total Kasbon" val={rpFmt(dedKasbon)} />
                {dedKasbonAdmin > 0 && <SlipRow label="Admin Kasbon 2,5%" val={rpFmt(dedKasbonAdmin)} />}
                {dedKoperasiPinjaman > 0 && <SlipRow label="Cicilan Pinjaman Koperasi" val={rpFmt(dedKoperasiPinjaman)} />}
                {dedKoperasiWajib > 0 && <SlipRow label="Simpanan Wajib Koperasi" val={rpFmt(dedKoperasiWajib)} />}
                <SlipRow label="Potongan BPJSTKU Perusahaan" val={rpFmt(dedPerush)} />
                <SlipRow label="Potongan BPJSTKU Pekerja"    val={rpFmt(dedPerja)} />
                <SlipRow label="Potongan JKN - KIS"           val={rpFmt(dedJkn)} />
                <SlipRow label="Potongan Insentif Hari Kerja" val={dedInsentif > 0 ? rpReal(dedInsentif) : '-'} marker="(+)" />
                <SlipSubTotal label="Total Potongan"          val={rpFmt(totalDed)} marker="(-)" />
                <SlipTotal    label="Total"                   val={rpFmt(thp)} highlight />
              </tbody>
            </table>
          </div>

          {/* ── KANAN ── */}
          <div className="w-48 shrink-0 flex flex-col">

            {/* Kehadiran */}
            <table className="w-full text-[10px] border-b border-gray-900">
              <tbody>
                {[
                  ['Alpha',          alphaCount],
                  ['Izin',           izinCount],
                  ['Sakit',          sakitCount],
                  ['Libur Nasional', holidayCount],
                  ['Cuti',           cutiCount],
                ].map(([label, val]) => (
                  <tr key={label as string} className="border-b border-gray-200">
                    <td className="px-2 py-0.5 text-gray-700">{label as string}</td>
                    <td className="px-2 py-0.5 text-right">: {val}</td>
                  </tr>
                ))}
              </tbody>
            </table>


            {/* Tabel potongan insentif jika tidak masuk */}
            {slip.maximumIncentive > 0 && (
              <table className="w-full text-[10px] border-b border-gray-900">
                <tbody>
                  <tr className="bg-gray-100 border-b border-gray-400">
                    <td className="px-2 py-0.5 font-bold text-gray-800" colSpan={2}>
                      Potongan Insentif Jika Tidak Masuk
                    </td>
                  </tr>
                  {(() => {
                    const rate = slip.insentifRatePerDay ?? slip.maximumIncentive / 4;
                    return [1,2,3,4].map(day => (
                      <tr key={day} className="border-b border-gray-200">
                        <td className="px-2 py-0.5 text-gray-600">{day} Hari</td>
                        <td className="px-2 py-0.5 text-right">{rpFmt(rate * day)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )}

            {/* Rincian Kasbon Full Lifecycle */}
            {dedKasbon > 0 && (() => {
              const advances = slip.kasbonDetails ?? [];
              const advanceIds = advances.map(a => a.advanceId);
              const relatedAdvances = (employeeAdvanceList ?? []).filter(a => advanceIds.includes(a.id));
              return (
                <table className="w-full text-[10px]">
                  <tbody>
                    <tr className="bg-gray-100 border-b border-gray-400">
                      <td className="px-2 py-0.5 font-bold text-gray-800" colSpan={2}>
                        Rincian Kasbon
                      </td>
                    </tr>
                    {relatedAdvances.map((adv) => {
                      const detail = advances.find(d => d.advanceId === adv.id);
                      const original = adv.originalAmount ?? detail?.principal ?? 0;
                      const adminFee = adv.adminFeeAmount ?? detail?.admin ?? 0;
                      const total = original + adminFee;
                      const installmentNo = detail?.installmentNumber ?? (adv.paidInstallments ?? 0);
                      const remaining = detail?.remainingAfter ?? adv.remainingBalanceAfter ?? 0;
                      return (
                        <React.Fragment key={adv.id}>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <td className="px-2 py-0.5 text-gray-600 font-semibold" colSpan={2}>
                              {adv.advanceNumber} (Angsuran ke-{installmentNo})
                            </td>
                          </tr>
                          <tr className="border-b border-gray-200"><td className="px-2 py-0.5 text-gray-600">Jumlah Kasbon</td><td className="px-2 py-0.5 text-right">{rpFmt(original)}</td></tr>
                          {adminFee > 0 && <tr className="border-b border-gray-200"><td className="px-2 py-0.5 text-gray-600">Admin {adv.adminFeePercent ?? 2.5}%</td><td className="px-2 py-0.5 text-right">{rpFmt(adminFee)}</td></tr>}
                          <tr className="border-b border-gray-200 bg-gray-50"><td className="px-2 py-0.5 text-gray-600 font-semibold">Total Kasbon</td><td className="px-2 py-0.5 text-right font-semibold">{rpFmt(total)}</td></tr>
                          <tr className="border-b border-gray-200"><td className="px-2 py-0.5 text-gray-600">Potongan {installmentNo}x</td><td className="px-2 py-0.5 text-right">{rpFmt(dedKasbon)}</td></tr>
                          <tr className="border-b border-gray-400 bg-gray-100">
                            <td className="px-2 py-0.5 font-bold text-gray-800">Sisa Kasbon</td>
                            <td className="px-2 py-0.5 text-right font-bold">{rpFmt(remaining)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {relatedAdvances.length === 0 && (
                      <React.Fragment>
                        <tr className="border-b border-gray-200"><td className="px-2 py-0.5 text-gray-600">Jumlah Kasbon</td><td className="px-2 py-0.5 text-right">{rpFmt(dedKasbon)}</td></tr>
                        {dedKasbonAdmin > 0 && <tr className="border-b border-gray-200"><td className="px-2 py-0.5 text-gray-600">Admin Kasbon</td><td className="px-2 py-0.5 text-right">{rpFmt(dedKasbonAdmin)}</td></tr>}
                        <tr className="border-t border-gray-400 bg-gray-800">
                          <td className="px-2 py-0.5 font-bold text-white">Total Kasbon</td>
                          <td className="px-2 py-0.5 text-right font-bold text-yellow-300">{rpFmt(dedKasbon + dedKasbonAdmin)}</td>
                        </tr>
                      </React.Fragment>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {/* ══ SIGNATURES ══ */}
        <div className="border border-t-0 border-gray-900 px-4 py-3">
          <div className="text-right text-[10px] mb-4 text-gray-700">
            Bekasi, {fmtDateLong(sigDate)}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            {[
              { role: 'Mengetahui,',  name: 'SYAMSUDIN' },
              { role: 'Menyetujui,',  name: 'SRI RAHAYU' },
              { role: 'Menerima,',    name: slip.employeeName.toUpperCase() },
            ].map(sig => (
              <div key={sig.role}>
                <div className="text-gray-700 mb-1">{sig.role}</div>
                <div className="h-14 border-b border-gray-500" />
                <div className="font-bold mt-1 uppercase">{sig.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-[9px] text-gray-400 mt-2">
          Dicetak pada {fmtDateShort(new Date().toISOString())} — Dokumen ini sah tanpa tanda tangan basah.
        </div>
      </div>
    </div>
  );
}

// ── Row components ──

function SlipRow({ label, sub, val, marker }: { label: string; sub?: string; val: string; marker?: string }) {
  return (
    <tr className="border-b border-gray-200">
      <td className="px-2 py-0.5 text-gray-800 w-[52%]">
        {label}{sub && <span className="text-gray-500 ml-1">{sub}</span>}
      </td>
      <td className="px-2 py-0.5 text-right w-[43%]">{val}</td>
      <td className="px-1 py-0.5 text-gray-500 text-[9px] w-[5%] whitespace-nowrap">{marker}</td>
    </tr>
  );
}

function SlipNote({ text }: { text: string }) {
  return <tr><td colSpan={3} className="px-2 pb-1 text-[8px] italic text-gray-500">({text})</td></tr>;
}

function SlipSubTotal({ label, val, marker }: { label: string; val: string; marker?: string }) {
  return (
    <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
      <td className="px-2 py-0.5">{label}</td>
      <td className="px-2 py-0.5 text-right">{val}</td>
      <td className="px-1 py-0.5 text-gray-500 text-[9px] whitespace-nowrap">{marker}</td>
    </tr>
  );
}

function SlipTotal({ label, val, highlight }: { label: string; val: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-gray-800 font-bold' : 'bg-gray-700 font-bold'}>
      <td className={`px-2 py-1 ${highlight ? 'text-white' : 'text-gray-100'}`}>{label}</td>
      <td className={`px-2 py-1 text-right ${highlight ? 'text-yellow-300 text-[12px]' : 'text-white'}`}>{val}</td>
      <td />
    </tr>
  );
}
