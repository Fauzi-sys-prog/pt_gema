import { useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Printer,
  FileText,
  Calendar,
  User,
  Download,
  Filter,
  ArrowLeft,
  Zap,
  CheckCircle2,
  Clock,
  X,
  Briefcase,
  Users,
  Moon,
  Sun,
  Hash,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp, type WorkOrder } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { downloadSPKWord, generateSPKWord, printCorrespondence } from '../../utils/correspondenceWordExports';

import { useEscapeKey } from '../../hooks/useEscapeKey';

type JenisSPK = 'Biasa' | 'Lembur' | 'Daily';

interface TeknisiRow {
  nama: string;
  keterangan: string;
  qty: number;
}

const JENIS_SPK_CONFIG: Record<JenisSPK, { label: string; icon: React.ReactNode; color: string; defaultJamMasuk: string; defaultJamKeluar: string; inactiveHover: string; activeText: string }> = {
  Biasa:  { label: 'Tanpa SPK',  icon: <Sun  size={14} />, color: 'blue',    defaultJamMasuk: '08:00', defaultJamKeluar: '17:00', inactiveHover: 'hover:text-blue-600 hover:border-blue-200',   activeText: 'text-white' },
  Lembur: { label: 'SPK Lembur', icon: <Moon size={14} />, color: 'amber',   defaultJamMasuk: '17:00', defaultJamKeluar: '22:00', inactiveHover: 'hover:text-amber-500 hover:border-amber-200', activeText: 'text-yellow-300' },
  Daily:  { label: 'SPK Daily',  icon: <Hash size={14} />, color: 'emerald', defaultJamMasuk: '07:00', defaultJamKeluar: '16:00', inactiveHover: 'hover:text-emerald-600 hover:border-emerald-200', activeText: 'text-white' },
};

const emptyTeknisiRow = (): TeknisiRow => ({ nama: '', keterangan: '', qty: 1 });

const emptyForm = () => ({
  projectId: '',
  pekerjaan: '',
  tanggal: new Date().toISOString().split('T')[0],
  jenisSPK: 'Biasa' as JenisSPK,
  jamMasuk: '08:00',
  jamKeluar: '17:00',
  teknisiRows: [emptyTeknisiRow()] as TeknisiRow[],
  urgent: false,
  noSPK: '',
});

export default function SuratPerintahKerjaPage() {
  const { projectList, workOrderList, qcInspectionList, updateProject, addWorkOrder, updateWorkOrder, createProjectSpkWithWorkOrder } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSPK, setSelectedSPK] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm());

  useEscapeKey([
    { condition: showPreview, close: () => setShowPreview(false) },
    { condition: showCreateModal, close: () => setShowCreateModal(false) },
  ]);


  const fd = formData;
  const set = (patch: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...patch }));

  const updateTeknisiRow = (i: number, patch: Partial<TeknisiRow>) =>
    set({ teknisiRows: fd.teknisiRows.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const addTeknisiRow = () => set({ teknisiRows: [...fd.teknisiRows, emptyTeknisiRow()] });
  const removeTeknisiRow = (i: number) =>
    set({ teknisiRows: fd.teknisiRows.filter((_, idx) => idx !== i) });

  // SPK produksi selesai berdasarkan Work Order + QC, bukan tombol manual.
  const productionWorkflowStatus = (spk: any): string => {
    if (spk.jenisSPK !== 'Biasa' || !['Approved', 'Active', 'In Progress', 'Pending QC'].includes(spk.status)) return spk.status;
    const workOrder = workOrderList.find(item => item.spkId === spk.id);
    if (!workOrder) return 'Approved';
    const targetReached = (workOrder.completedQty || 0) >= workOrder.targetQty;
    if (!targetReached) return 'In Progress';
    const qcPassed = qcInspectionList.some(item =>
      item.workOrderId === workOrder.id && item.status === 'Passed' && item.qtyPassed >= workOrder.targetQty
    );
    return qcPassed ? 'Completed' : 'Pending QC';
  };

  // Derived SPK list
  const spkList = projectList.flatMap(project =>
    (project.spkList || []).map((spk: any) => ({
      ...spk,
      projectName: project.namaProject,
      projectId: project.id,
      workflowStatus: productionWorkflowStatus(spk),
      teknisi: Array.isArray(spk.teknisi)
        ? spk.teknisi
        : (spk.teknisi ? spk.teknisi.split(',').map((t: string) => t.trim()) : []),
    }))
  ).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const handleCreateSPK = async () => {
    if (isSubmitting) return;
    const filledRows = fd.teknisiRows.filter(r => r.nama.trim());
    if (!fd.pekerjaan || filledRows.length === 0) {
      toast.error('Nama pekerjaan dan minimal 1 teknisi wajib diisi.');
      return;
    }

    const isInternal = !fd.projectId || fd.projectId === 'INTERNAL';
    const project = isInternal ? null : projectList.find(p => p.id === fd.projectId);
    const spkCount = project ? (project.spkList?.length || 0) : spkList.length;

    const autoNo = fd.noSPK || `SPK/${new Date().getFullYear()}/${fd.jenisSPK.toUpperCase().slice(0, 3)}/${String(spkCount + 1).padStart(3, '0')}`;
    const duplicateNo = spkList.some(item => (item.noSPK || '').trim().toLowerCase() === autoNo.trim().toLowerCase());
    if (duplicateNo) {
      toast.error(`Nomor SPK ${autoNo} sudah digunakan. Gunakan nomor lain.`);
      return;
    }

    setIsSubmitting(true);

    const newSPK = {
      id: `SPK-${Date.now()}`,
      noSPK: autoNo,
      tanggal: fd.tanggal,
      pekerjaan: fd.pekerjaan,
      jenisSPK: fd.jenisSPK,
      jamMasuk: fd.jamMasuk,
      jamKeluar: fd.jamKeluar,
      teknisiRows: filledRows,
      teknisi: filledRows.map(r => r.nama),
      targetQty: filledRows.reduce((s, r) => s + r.qty, 0),
      status: 'Draft',
      createdBy: currentUser?.fullName || 'Current User',
      urgent: fd.urgent,
      projectId: fd.projectId || 'INTERNAL',
      projectName: project ? project.namaProject : 'INTERNAL PRODUKSI',
      createdAt: new Date().toISOString(),
    };

    const newWO: WorkOrder = {
      id: `WO-${Date.now()}`,
      woNumber: `WO-${autoNo.replace(/\//g, '-')}`,
      nomorSPK: autoNo,
      projectId: newSPK.projectId,
      projectName: newSPK.projectName,
      itemToProduce: fd.pekerjaan,
      targetQty: newSPK.targetQty,
      completedQty: 0,
      status: 'Draft',
      priority: fd.urgent ? 'Urgent' : 'Normal',
      startDate: new Date().toISOString().split('T')[0],
      deadline: project?.endDate || '',
      leadTechnician: filledRows[0].nama,
      teknisi: filledRows.map(r => r.nama),
      spkId: newSPK.id,
      bom: [],
    };

    try {
      if (project) await createProjectSpkWithWorkOrder(project.id, newSPK, newWO);
      else addWorkOrder(newWO);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'SPK gagal dibuat');
      setIsSubmitting(false);
      return;
    }

    toast.success(`SPK ${autoNo} disimpan sebagai draft. Submit untuk meminta approval.`);
    setIsSubmitting(false);
    setShowCreateModal(false);
    setFormData(emptyForm());
  };

  const filteredSPK = spkList.filter(spk => 
    (spk.noSPK || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (spk.pekerjaan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (spk.projectName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canApprove = ['Owner', 'Admin', 'Manager', 'SPV'].includes(currentUser?.role || '');
  const updateSPKStatus = (spk: any, status: 'Pending Approval' | 'Approved' | 'Rejected' | 'Completed' | 'Closed') => {
    if (isSubmitting) return;
    if (status === 'Rejected' && !window.confirm(`Tolak SPK ${spk.noSPK}? Status akan berubah menjadi Rejected.`)) return;
    const project = projectList.find(item => item.id === spk.projectId);
    if (!project) {
      toast.error('SPK internal belum dapat diubah statusnya karena belum terhubung ke proyek.');
      return;
    }
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const patch = status === 'Approved'
      ? { status, approvedBy: currentUser?.fullName || 'Owner', approvedAt: now }
      : status === 'Rejected'
        ? { status, rejectedBy: currentUser?.fullName || 'Owner', rejectedAt: now }
        : status === 'Completed'
          ? { status, completedBy: currentUser?.fullName || 'Current User', completedAt: now }
          : status === 'Closed'
            ? { status, closedBy: currentUser?.fullName || 'Owner', closedAt: now }
            : { status, submittedBy: currentUser?.fullName || 'Current User', submittedAt: now };
    try {
      updateProject(project.id, {
        ...project,
        spkList: (project.spkList || []).map((item: any) => item.id === spk.id ? { ...item, ...patch } : item),
      });
      const workOrder = workOrderList.find(item => item.spkId === spk.id);
      if (workOrder) {
        const workOrderStatus = status === 'Approved' ? 'In Progress' : status === 'Completed' ? 'Completed' : workOrder.status;
        updateWorkOrder(workOrder.id, { status: workOrderStatus });
      }
      toast.success(`SPK ${spk.noSPK} → ${status}`);
    } catch (err) {
      toast.error('Status SPK gagal diubah: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSPKPreview = async (spk: any) => {
    setSelectedSPK(spk);
    setPreviewHtml(await generateSPKWord(spk));
    setShowPreview(true);
  };

  const downloadSPK = async (spk: any) => {
    await downloadSPKWord(spk);
    toast.success(`SPK ${spk.noSPK} berhasil diunduh.`);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/surat-menyurat/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all"
          >
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 italic uppercase">
              <Zap className="text-amber-500" size={28} />
              Surat Perintah Kerja (SPK)
            </h1>
            <p className="text-slate-500 font-medium italic">Instruksi & Penugasan Workshop PT Gema Teknik Perkasa</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowCreateModal(true)}
             className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"
           >
             <Plus size={16} />
             Buat SPK Baru
           </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Menunggu Approval', val: spkList.filter(s => s.workflowStatus === 'Pending Approval').length, icon: Clock, color: 'amber' },
          { label: 'SPK Aktif', val: spkList.filter(s => ['Approved', 'Active', 'In Progress', 'Pending QC'].includes(s.workflowStatus)).length, icon: Zap, color: 'blue' },
          { label: 'Selesai, Belum Tutup', val: spkList.filter(s => s.workflowStatus === 'Completed').length, icon: CheckCircle2, color: 'emerald' },
          { label: 'Prioritas Tinggi', val: spkList.filter(s => s.urgent).length, icon: Zap, color: 'rose' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
               <p className="text-3xl font-black text-slate-900 mt-1">{stat.val}</p>
            </div>
            <div className={`p-4 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl`}>
               <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b-2 border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari No. SPK atau Pekerjaan..." 
              className="w-full pl-10 pr-4 py-2 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
             <button className="p-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all">
                <Filter size={18} />
             </button>
             <button className="p-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all">
                <Download size={18} />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Info Dokumen</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Pekerjaan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Teknisi</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {filteredSPK.map((spk) => {
                const workflowStatus = spk.workflowStatus || spk.status;
                const isProductionSPK = spk.jenisSPK === 'Biasa';
                return <tr key={spk.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-blue-600 italic tracking-tighter uppercase">{spk.noSPK}</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase flex items-center gap-1">
                        <Calendar size={10} /> {new Date(spk.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{spk.pekerjaan}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase italic">Project: {spk.projectName}</span>
                        {spk.urgent && (
                          <span className="inline-flex text-[8px] font-black text-rose-600 uppercase italic">⚠️ Prioritas Tinggi</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center -space-x-2">
                       {spk.teknisi.length > 0 ? spk.teknisi.map((t: string, idx: number) => (
                         <div key={idx} className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm" title={t}>
                            {t.charAt(0).toUpperCase()}
                         </div>
                       )) : (
                         <div className="text-[10px] font-bold text-slate-300 uppercase italic">Belum Ada</div>
                       )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border-2 ${
                      ['Approved', 'Active', 'In Progress'].includes(workflowStatus) ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : workflowStatus === 'Pending Approval' || workflowStatus === 'Pending QC' ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : workflowStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : workflowStatus === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100'
                      : workflowStatus === 'Closed' ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      {workflowStatus === 'Completed' ? 'Selesai — siap ditutup' : workflowStatus}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openSPKPreview(spk)}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="View Archive"
                      >
                        <Eye size={18} />
                      </button>
                      <button onClick={() => openSPKPreview(spk)} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all" title="Print">
                        <Printer size={18} />
                      </button>
                      {workflowStatus === 'Draft' && <button onClick={() => updateSPKStatus(spk, 'Pending Approval')} className="px-2.5 py-2 text-[9px] font-black uppercase text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl" title="Ajukan approval">Ajukan</button>}
                      {workflowStatus === 'Pending Approval' && canApprove && <>
                        <button onClick={() => updateSPKStatus(spk, 'Approved')} className="px-2.5 py-2 text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl" title="Setujui SPK">Setujui</button>
                        <button onClick={() => updateSPKStatus(spk, 'Rejected')} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl" title="Tolak SPK"><X size={15} /></button>
                      </>}
                      {!isProductionSPK && (workflowStatus === 'Approved' || workflowStatus === 'Active') && <button onClick={() => updateSPKStatus(spk, 'Completed')} className="px-2.5 py-2 text-[9px] font-black uppercase text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl" title="Tandai realisasi selesai">Selesai</button>}
                      {workflowStatus === 'Completed' && canApprove && <button onClick={() => updateSPKStatus(spk, 'Closed')} className="px-2.5 py-2 text-[9px] font-black uppercase text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl" title="Tutup SPK">Tutup</button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create SPK Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 border-4 border-slate-200 text-slate-900 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-7 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900">Terbitkan SPK Baru</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Instruksi Kerja · PT Gema Teknik Perkasa</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border-2 border-slate-100">
                <X size={22} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto p-8 space-y-5">

              {/* Jenis SPK */}
              <div>
                <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2">Jenis SPK</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(JENIS_SPK_CONFIG) as JenisSPK[]).map(j => {
                    const cfg = JENIS_SPK_CONFIG[j];
                    const active = fd.jenisSPK === j;
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => set({ jenisSPK: j, jamMasuk: cfg.defaultJamMasuk, jamKeluar: cfg.defaultJamKeluar })}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 text-xs font-black uppercase transition-all ${
                          active
                            ? `bg-${cfg.color}-600 ${cfg.activeText} border-${cfg.color}-600 shadow-lg`
                            : `bg-white text-slate-500 border-slate-100 ${cfg.inactiveHover}`
                        }`}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referensi Proyek */}
              <div>
                <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Briefcase size={11} /> Referensi Proyek
                </label>
                <select
                  value={fd.projectId}
                  onChange={(e) => set({ projectId: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all text-black"
                >
                  <option value="">⚙️ INTERNAL PRODUKSI (Tanpa Project)</option>
                  {projectList.filter(p => p.status !== 'Completed').map(p => (
                    <option key={p.id} value={p.id}>{p.kodeProject} — {p.namaProject}</option>
                  ))}
                </select>
              </div>

              {/* Nama Pekerjaan */}
              <div>
                <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText size={11} /> Nama Pekerjaan / Instruksi
                </label>
                <input
                  type="text"
                  value={fd.pekerjaan}
                  onChange={(e) => set({ pekerjaan: e.target.value })}
                  placeholder="CONTOH: REPAIR BOILER NO. 2..."
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all text-black placeholder:text-slate-300"
                />
              </div>

              {/* Tanggal + No SPK */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Calendar size={11} /> Tanggal SPK
                  </label>
                  <input
                    type="date"
                    value={fd.tanggal}
                    onChange={(e) => set({ tanggal: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black italic focus:border-blue-500 outline-none transition-all text-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Zap size={11} /> No. SPK <span className="text-slate-300 normal-case font-medium">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={fd.noSPK}
                    onChange={(e) => set({ noSPK: e.target.value })}
                    placeholder="OTOMATIS JIKA KOSONG"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all text-black placeholder:text-slate-300"
                  />
                </div>
              </div>

              {/* Jam Masuk + Jam Keluar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Clock size={11} /> Jam Masuk
                  </label>
                  <input
                    type="time"
                    value={fd.jamMasuk}
                    onChange={(e) => set({ jamMasuk: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black italic focus:border-blue-500 outline-none transition-all text-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Clock size={11} /> Jam Keluar
                  </label>
                  <input
                    type="time"
                    value={fd.jamKeluar}
                    onChange={(e) => set({ jamKeluar: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black italic focus:border-blue-500 outline-none transition-all text-black"
                  />
                </div>
              </div>

              {/* Tabel Teknisi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={11} /> Daftar Teknisi
                  </label>
                  <button
                    type="button"
                    onClick={addTeknisiRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-slate-700 transition-colors"
                  >
                    <Plus size={12} /> Tambah Teknisi
                  </button>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[2rem_1fr_1fr_5rem_2rem] gap-2 mb-1 px-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase">No</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Nama</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase">Keterangan</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase text-center">QTY</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {fd.teknisiRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_1fr_5rem_2rem] gap-2 items-center">
                      <span className="text-[10px] font-black text-slate-400 text-center">{i + 1}</span>
                      <input
                        type="text"
                        value={row.nama}
                        onChange={(e) => updateTeknisiRow(i, { nama: e.target.value })}
                        placeholder="Nama..."
                        className="px-3 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black text-black uppercase italic focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                      />
                      <input
                        type="text"
                        value={row.keterangan}
                        onChange={(e) => updateTeknisiRow(i, { keterangan: e.target.value })}
                        placeholder="Keterangan..."
                        className="px-3 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-black italic focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                      />
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => updateTeknisiRow(i, { qty: Number(e.target.value) })}
                        className="px-3 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black text-black text-center focus:border-blue-500 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => removeTeknisiRow(i)}
                        disabled={fd.teknisiRows.length === 1}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-20"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Urgent */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="urgent-spk"
                  checked={fd.urgent}
                  onChange={(e) => set({ urgent: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-2 border-slate-200 cursor-pointer"
                />
                <label htmlFor="urgent-spk" className="text-[10px] font-black uppercase italic text-rose-600 tracking-widest cursor-pointer select-none">
                  ⚠️ Tandai sebagai Prioritas Tinggi (URGENT)
                </label>
              </div>

            </div>

            {/* Footer */}
            <div className="p-7 bg-slate-50 border-t-2 border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-8 py-3.5 border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleCreateSPK}
                disabled={isSubmitting || !fd.pekerjaan || (fd.teknisiRows?.length ?? 0) === 0}
                className="px-10 py-3.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Memproses...' : 'Terbitkan SPK & Work Order'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Physical Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-8">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 border-4 border-slate-200">
              <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                       <FileText size={24} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900">Physical Document Archive</h3>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Verified Scan - PT Gema Teknik Perkasa</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShowPreview(false)}
                   className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border-2 border-slate-100"
                 >
                    <X size={24} />
                 </button>
              </div>
              <div className="p-8 bg-slate-100 flex items-center justify-center overflow-auto h-[70vh] custom-scrollbar">
                 <iframe title="Preview SPK" srcDoc={previewHtml} className="bg-white w-full max-w-3xl h-full shadow-2xl border border-slate-200" />
              </div>
              <div className="p-6 bg-white border-t-2 border-slate-50 flex justify-end gap-3">
                 <div className="mr-auto flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border-2 border-slate-100">
                    <User size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase italic">Digital Signature: VERIFIED by Syamsudin</span>
                 </div>
                 <button onClick={() => selectedSPK && downloadSPK(selectedSPK)} className="px-8 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"><Download size={15} /> Download Word</button>
                 <button onClick={() => previewHtml && printCorrespondence(previewHtml)} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg">Print Document</button>
                 <button className="px-8 py-3 border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all" onClick={() => setShowPreview(false)}>Tutup</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
