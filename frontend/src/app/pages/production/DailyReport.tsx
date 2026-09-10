import React, { useState, useEffect } from 'react';
import { useApp, type ProductionReport } from '../../contexts/AppContext';
import {
  ClipboardList,
  Clock,
  ChevronRight,
  CheckCircle2,
  FileText,
  Settings,
  Plus,
  X,
  User as UserIcon,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { toast } from 'sonner';

import { useEscapeKey } from '../../hooks/useEscapeKey';

const EMPTY_FORM = {
  tanggal: new Date().toISOString().split('T')[0],
  shift: '1',
  workshop: 'Workshop Utama',
  workerName: '',
  activity: '',
  machineNo: '',
  startTime: '08:00',
  endTime: '17:00',
  outputQty: 0,
  unit: 'Unit',
  woNumber: '',
  remarks: '',
};

export default function DailyReport() {
  const { productionReportList, addProductionReport, assetList, workOrderList, employeeList } = useApp();
  const [lhpImage, setLhpImage] = useState('');
  useEffect(() => {
    import('figma:asset/1b31dc690fa09272d3ffca6b134fdfa5a13785f4.png')
      .then((m: { default: string }) => setLhpImage(m.default))
      .catch(() => {});
  }, []);
  const [showRef, setShowRef] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey([
    { condition: showRef, close: () => setShowRef(false) },
    { condition: showForm, close: () => setShowForm(false) },
  ]);


  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!form.workerName || !form.activity) {
      toast.error('Nama pekerja dan aktivitas wajib diisi');
      return;
    }
    const report: ProductionReport = {
      id: 'LHP-' + Date.now(),
      ...form,
      outputQty: Number(form.outputQty),
    };
    setIsSubmitting(true);
    try {
      await addProductionReport(report);
      toast.success('LHP berhasil disimpan');
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      toast.error('Gagal menyimpan LHP: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-rose-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl rotate-3">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Laporan Harian Produksi (LHP)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest italic opacity-70">Workshop Activity & Evidence Logs</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRef(!showRef)}
            className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <FileText size={16} className="text-blue-600" />
            {showRef ? 'Sembunyikan Referensi' : 'Lihat Form Fisik'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
          >
            <Plus size={16} /> Input LHP Baru
          </button>
        </div>
      </div>

      {/* Reference image */}
      {showRef && (
        <div className="p-6 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 text-center">Dokumen Referensi Standar LHP PT Gema Teknik Perkasa</p>
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <ImageWithFallback src={lhpImage} className="w-full max-h-[600px] object-contain mx-auto bg-slate-50" alt="Form LHP" />
          </div>
        </div>
      )}

      {/* Live logs table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-rose-600 rounded-full" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Live Production Logs</span>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black">{productionReportList.length} records</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/20">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal / Shift</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator / Worker</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity & Asset Unit</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duration</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Output</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productionReportList.length > 0 ? productionReportList.map((report) => (
                <tr key={report.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-xs font-black text-slate-700">{report.tanggal}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Shift {report.shift} — {report.workshop}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-black text-xs border border-slate-200">
                        {report.workerName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-sm leading-tight">{report.workerName}</span>
                        {report.woNumber && <span className="text-[9px] text-blue-500 font-bold uppercase mt-0.5">{report.woNumber}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col max-w-xs">
                      <p className="text-sm text-slate-700 font-bold leading-tight">{report.activity}</p>
                      {report.machineNo && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Settings size={12} className="text-blue-500" />
                          <span className="text-[10px] font-black text-blue-600 uppercase italic">
                            {assetList.find(a => a.id === report.machineNo || a.assetCode === report.machineNo)?.name || report.machineNo}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-bold text-slate-600 italic">
                      <Clock size={12} />
                      {report.startTime} - {report.endTime}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-900 leading-none">{report.outputQty}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-black mt-1">{report.unit}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-tighter border border-emerald-100 shadow-sm">
                      <CheckCircle2 size={12} />
                      {report.remarks || 'VERIFIED'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <ClipboardList size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">Belum ada aktivitas terekam. Klik "Input LHP Baru" untuk mulai.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input LHP Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest italic text-white flex items-center gap-2">
                  <ClipboardList size={18} /> Input Laporan Harian Produksi
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Isi data aktivitas produksi hari ini</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Shift</label>
                  <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold">
                    <option value="1">Shift 1 (Pagi)</option>
                    <option value="2">Shift 2 (Siang)</option>
                    <option value="3">Shift 3 (Malam)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Nama Operator / Pekerja</label>
                  <input type="text" value={form.workerName} onChange={e => setForm(f => ({ ...f, workerName: e.target.value }))}
                    placeholder="Nama lengkap" list="worker-list"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold placeholder:text-slate-400" />
                  <datalist id="worker-list">
                    {(employeeList || []).map(emp => <option key={emp.id} value={(emp as any).name || (emp as any).namaLengkap || (emp as any).nama || ''} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Workshop / Area</label>
                  <select value={form.workshop} onChange={e => setForm(f => ({ ...f, workshop: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold">
                    <option>Workshop Utama</option>
                    <option>Workshop Fabrikasi</option>
                    <option>Workshop Maintenance</option>
                    <option>Area Lapangan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Aktivitas / Deskripsi Pekerjaan</label>
                <input type="text" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
                  placeholder="e.g. Fabrikasi rangka baja 6m, Pengecatan primer..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold placeholder:text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">No. SPK / Work Order</label>
                  <select value={form.woNumber} onChange={e => setForm(f => ({ ...f, woNumber: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold">
                    <option value="">— Pilih WO (opsional) —</option>
                    {(workOrderList || []).map((wo: any) => (
                      <option key={wo.id} value={wo.woNumber}>{wo.woNumber} — {wo.itemToProduce || wo.projectName || ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Mesin / Asset Digunakan</label>
                  <select value={form.machineNo} onChange={e => setForm(f => ({ ...f, machineNo: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold">
                    <option value="">— Pilih Mesin (opsional) —</option>
                    {assetList.map(a => (
                      <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Jam Mulai</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Jam Selesai</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Output Qty</label>
                  <input type="number" min={0} value={form.outputQty} onChange={e => setForm(f => ({ ...f, outputQty: Number(e.target.value) }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Unit Output</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold">
                    <option>Unit</option>
                    <option>Pcs</option>
                    <option>Set</option>
                    <option>Meter</option>
                    <option>Kg</option>
                    <option>M²</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">Keterangan / Remarks</label>
                  <input type="text" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Opsional" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-bold placeholder:text-slate-400" />
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Batal</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Menyimpan...' : 'Simpan LHP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
