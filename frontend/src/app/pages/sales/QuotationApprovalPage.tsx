import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  BadgeCheck,
  UserCheck,
  ArrowRight,
  FolderKanban,
  RotateCcw,
  DollarSign,
  CalendarDays,
  Sparkles,
  Eye,
  History,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Quotation } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';

type Step = 1 | 2 | 3;
type QA = Quotation;
type InternalAction = 'approve' | 'reject' | 'revision';
type ClientAction = 'approve' | 'reject' | 'revision';

function getStep(q: QA): Step {
  if (q.internalApprovalStatus !== 'Approved') return 1;
  if (q.clientApprovalStatus !== 'Approved') return 2;
  return 3;
}

const stepLabel: Record<Step, string> = {
  1: 'Approval Internal',
  2: 'Approval Client',
  3: 'Siap Jadi Project',
};

const actionLabel: Record<string, string> = {
  'Internal Approved': 'Disetujui Internal',
  'Internal Rejected': 'Ditolak Internal',
  'Internal Revision': 'Revisi Internal',
  'Client Approved': 'Disetujui Client',
  'Client Rejected': 'Ditolak Client',
  'Client Revision': 'Revisi Client',
};

const actionColor: Record<string, string> = {
  'Internal Approved': 'emerald',
  'Internal Rejected': 'rose',
  'Internal Revision': 'orange',
  'Client Approved': 'emerald',
  'Client Rejected': 'rose',
  'Client Revision': 'orange',
};

export default function QuotationApprovalPage() {
  const { quotationList, projectList, updateQuotation, addAuditLog, convertQuotationToProject } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [filterStep, setFilterStep] = useState<'all' | Step>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);

  // Internal modal
  const [intTarget, setIntTarget] = useState<QA | null>(null);
  const [intAction, setIntAction] = useState<InternalAction | null>(null);
  const [intReason, setIntReason] = useState('');

  // Client modal
  const [cliTarget, setCliTarget] = useState<QA | null>(null);
  const [cliAction, setCliAction] = useState<ClientAction | null>(null);
  const [cliReason, setCliReason] = useState('');

  // Convert confirm
  const [convertTarget, setConvertTarget] = useState<QA | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quotations = quotationList as QA[];

  const REVIEWABLE = ['Pending Approval', 'Revised', 'In Progress', 'Pending Review', 'Approved'];

  const isLockedByApprovedProject = (q: QA) => projectList.some(project =>
    project.quotationId === q.id && String((project as any).approvalStatus || '').toUpperCase() === 'APPROVED'
  );

  const approvalQueue = useMemo(() => quotations.filter(q => {
    if (q.convertedToProject || isLockedByApprovedProject(q)) return false;
    return REVIEWABLE.includes(q.status || '');
  }), [quotations, projectList]);

  const filtered = useMemo(() => {
    return approvalQueue.filter(q => {
      const customerName = q.kepada || (q as any).customer?.nama || '';
      const quotationNo = q.noPenawaran || (q as any).nomorQuotation || '';
      const match =
        quotationNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.perihal || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
      if (filterStep === 'all') return true;
      return getStep(q) === filterStep;
    });
  }, [approvalQueue, filterStep, searchTerm]);

  const counts = useMemo(() => ({
    1: approvalQueue.filter(q => getStep(q) === 1).length,
    2: approvalQueue.filter(q => getStep(q) === 2).length,
    3: approvalQueue.filter(q => getStep(q) === 3).length,
  }), [approvalQueue]);

  const appendHistory = (q: QA, entry: NonNullable<QA['quotationApprovalHistory']>[number]) => {
    return { quotationApprovalHistory: [...(q.quotationApprovalHistory || []), entry] };
  };

  // --- handlers ---
  const confirmInternal = async () => {
    if (!intTarget || !intAction) return;
    if (isSubmitting) return;
    if ((intAction === 'reject' || intAction === 'revision') && !intReason.trim()) {
      toast.error('Alasan wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    const actor = currentUser?.fullName || 'Manager';
    const histEntry: NonNullable<QA['quotationApprovalHistory']>[number] = {
      action: intAction === 'approve' ? 'Internal Approved' : intAction === 'reject' ? 'Internal Rejected' : 'Internal Revision',
      by: actor,
      date: new Date().toISOString(),
      reason: intReason.trim() || undefined,
    };

    const nextRevNo = (intTarget.revisionNo || 0) + (intAction === 'revision' ? 1 : 0);
    const revSnap = intAction === 'revision' ? {
      revisionNo: nextRevNo,
      revisionHistory: [
        ...(intTarget.revisionHistory || []),
        {
          no: nextRevNo,
          date: new Date().toISOString(),
          by: actor,
          reason: intReason.trim(),
          trigger: 'Internal' as const,
          grandTotal: intTarget.grandTotal || 0,
          perihal: intTarget.perihal || '',
          sections: intTarget.sections ? JSON.parse(JSON.stringify(intTarget.sections)) : [],
        },
      ],
    } : {};

    let saved;
    try {
      saved = await updateQuotation(intTarget.id, {
        internalApprovalStatus: intAction === 'approve' ? 'Approved' : intAction === 'reject' ? 'Rejected' : 'Revision',
        internalApprovedBy: actor,
        internalApprovedAt: new Date().toISOString(),
        status: intAction === 'approve' ? 'Pending Approval' : intAction === 'reject' ? 'Rejected' : 'Revised',
        ...(intAction !== 'approve' ? { internalRejectReason: intReason.trim() } : { internalRejectReason: undefined }),
        ...appendHistory(intTarget, histEntry),
        ...revSnap,
      });
    } catch (err) {
      toast.error('Gagal menyimpan keputusan: ' + (err instanceof Error ? err.message : 'Error'));
      setIsSubmitting(false);
      return;
    }

    if (!saved) { setIsSubmitting(false); return; }

    addAuditLog({
      action: `QUO_INTERNAL_${intAction.toUpperCase()}`,
      module: 'Commercial & Sales',
      details: `${intTarget.noPenawaran} ${histEntry.action} oleh ${actor}${intReason ? ': ' + intReason : ''}`,
      userId: currentUser?.id || '', userName: actor, timestamp: new Date().toISOString(),
    });

    if (intAction === 'approve') toast.success(`✅ ${intTarget.noPenawaran} lolos approval internal.`);
    else if (intAction === 'revision') toast.warning(`🔁 ${intTarget.noPenawaran} dikembalikan untuk revisi.`);
    else toast.error(`❌ ${intTarget.noPenawaran} ditolak internal.`);

    setIsSubmitting(false);
    setIntTarget(null); setIntAction(null); setIntReason('');
  };

  const confirmClient = async () => {
    if (!cliTarget || !cliAction) return;
    if (isSubmitting) return;
    if ((cliAction === 'reject' || cliAction === 'revision') && !cliReason.trim()) {
      toast.error('Alasan wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    const histEntry: NonNullable<QA['quotationApprovalHistory']>[number] = {
      action: cliAction === 'approve' ? 'Client Approved' : cliAction === 'reject' ? 'Client Rejected' : 'Client Revision',
      by: currentUser?.fullName || 'Sales',
      date: new Date().toISOString(),
      reason: cliReason.trim() || undefined,
    };

    const nextRevNo = (cliTarget.revisionNo || 0) + (cliAction === 'revision' ? 1 : 0);
    const revSnap = cliAction === 'revision' ? {
      revisionNo: nextRevNo,
      revisionHistory: [
        ...(cliTarget.revisionHistory || []),
        {
          no: nextRevNo,
          date: new Date().toISOString(),
          by: currentUser?.fullName || 'Sales',
          reason: cliReason.trim(),
          trigger: 'Client' as const,
          grandTotal: cliTarget.grandTotal || 0,
          perihal: cliTarget.perihal || '',
          sections: cliTarget.sections ? JSON.parse(JSON.stringify(cliTarget.sections)) : [],
        },
      ],
    } : {};

    let saved;
    try {
      saved = await updateQuotation(cliTarget.id, {
        clientApprovalStatus: cliAction === 'approve' ? 'Approved' : cliAction === 'reject' ? 'Rejected' : 'Revision',
        clientApprovedAt: new Date().toISOString(),
        // Client approval membuat quotation final Approved. Status pekerjaan
        // berjalan dikelola di Project, bukan di quotation.
        status: cliAction === 'approve' ? 'Approved' : cliAction === 'reject' ? 'Rejected' : 'Revised',
        ...(cliAction !== 'approve' ? { clientRejectReason: cliReason.trim() } : { clientRejectReason: undefined }),
        ...appendHistory(cliTarget, histEntry),
        ...revSnap,
      });
    } catch (err) {
      toast.error('Gagal menyimpan keputusan: ' + (err instanceof Error ? err.message : 'Error'));
      setIsSubmitting(false);
      return;
    }

    if (!saved) { setIsSubmitting(false); return; }

    addAuditLog({
      action: `QUO_CLIENT_${cliAction.toUpperCase()}`,
      module: 'Commercial & Sales',
      details: `${cliTarget.noPenawaran} ${histEntry.action}${cliReason ? ': ' + cliReason : ''}`,
      userId: currentUser?.id || '', userName: currentUser?.fullName || '', timestamp: new Date().toISOString(),
    });

    if (cliAction === 'approve') toast.success(`🎉 ${cliTarget.noPenawaran} disetujui client!`);
    else if (cliAction === 'revision') toast.warning(`🔁 ${cliTarget.noPenawaran} perlu revisi dari client.`);
    else toast.error(`❌ ${cliTarget.noPenawaran} ditolak client.`);

    setIsSubmitting(false);
    setCliTarget(null); setCliAction(null); setCliReason('');
  };

  const confirmConvert = async () => {
    if (!convertTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // convertQuotationToProject di context bersifat async: membuat project lalu
      // memperbarui quotation. Tunggu sampai selesai agar kegagalan tidak tersembunyi.
      await convertQuotationToProject(convertTarget.id);
      setConvertTarget(null);
    } catch (err) {
      toast.error('Konversi ke Project gagal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle: Record<InternalAction | ClientAction, string> = {
    approve: 'Setujui',
    reject: 'Tolak',
    revision: 'Minta Revisi',
  };

  const modalColor: Record<InternalAction | ClientAction, string> = {
    approve: 'bg-indigo-600',
    reject: 'bg-rose-600',
    revision: 'bg-orange-500',
  };

  const modalColorCli: Record<ClientAction, string> = {
    approve: 'bg-amber-500',
    reject: 'bg-rose-600',
    revision: 'bg-orange-500',
  };

  return (
    <div className="p-8 space-y-8 bg-[#F8FAFC] min-h-screen pb-24">

      {/* Header */}
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-slate-900 rounded-full -mr-36 -mt-36 opacity-[0.025]" />
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
            <BadgeCheck size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Quotation Approval</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Approval Internal → Approval Client → Project</p>
          </div>
        </div>
      </div>

      {/* Flow steps */}
      <div className="grid grid-cols-3 gap-4">
        {([1, 2, 3] as Step[]).map((step, i) => (
          <motion.button
            key={step}
            whileHover={{ y: -3 }}
            onClick={() => setFilterStep(filterStep === step ? 'all' : step)}
            className={`relative p-7 rounded-[2rem] border-2 text-left transition-all shadow-sm ${
              filterStep === step
                ? step === 1 ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50'
                : step === 2 ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-50'
                : 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50'
                : 'border-slate-100 bg-white hover:border-slate-200'
            }`}
          >
            {i < 2 && (
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                <ArrowRight size={16} className="text-slate-300" />
              </div>
            )}
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${
              step === 1 ? 'bg-indigo-100 text-indigo-600'
              : step === 2 ? 'bg-amber-100 text-amber-600'
              : 'bg-emerald-100 text-emerald-600'
            }`}>
              {step === 1 ? <UserCheck size={18} /> : step === 2 ? <Building2 size={18} /> : <FolderKanban size={18} />}
            </div>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
              step === 1 ? 'text-indigo-500' : step === 2 ? 'text-amber-500' : 'text-emerald-500'
            }`}>Step {step}</p>
            <p className="text-sm font-black text-slate-900 leading-tight">{stepLabel[step]}</p>
            <p className={`text-3xl font-black italic mt-3 ${
              step === 1 ? 'text-indigo-600' : step === 2 ? 'text-amber-600' : 'text-emerald-600'
            }`}>{counts[step]}</p>
          </motion.button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Cari no. penawaran, client, perihal..."
          className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-20 text-center">
            <FileText size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-xl font-black italic uppercase tracking-tighter text-slate-300">Tidak ada quotation</p>
          </div>
        ) : filtered.map(q => {
          const step = getStep(q);
          const isExpanded = expandedId === q.id;
          const isShowHistory = showHistoryId === q.id;
          const internalStatus = q.internalApprovalStatus || 'Pending';
          const clientStatus = q.clientApprovalStatus || 'Pending';
          const history = q.quotationApprovalHistory || [];

          return (
            <motion.div key={q.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">

              <div className={`h-1 w-full ${step === 1 ? 'bg-indigo-500' : step === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />

              <div
                className="flex items-center justify-between px-8 py-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
              >
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    step === 1 ? 'bg-indigo-50 text-indigo-600' : step === 2 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {step === 1 ? <UserCheck size={16} /> : step === 2 ? <Building2 size={16} /> : <FolderKanban size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-900 uppercase italic">{q.noPenawaran || (q as any).nomorQuotation}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                        step === 1 ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        : step === 2 ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>{stepLabel[step]}</span>
                      {(q as any).convertedToProject && (
                        <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase border bg-slate-100 text-slate-500 border-slate-200">Sudah Jadi Project</span>
                      )}
                      {history.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setShowHistoryId(isShowHistory ? null : q.id); setExpandedId(q.id); }}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase border bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100 transition-all"
                        >
                          <History size={9} /> {history.length} Riwayat
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">{q.kepada || (q as any).customer?.nama} · {q.perihal}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden md:block text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                    <p className="text-sm font-black italic text-slate-900">Rp {(q.grandTotal || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    {([
                      { ok: internalStatus === 'Approved', reject: internalStatus === 'Rejected', revision: internalStatus === 'Revision', label: 'Internal' },
                      { ok: clientStatus === 'Approved', reject: clientStatus === 'Rejected', revision: clientStatus === 'Revision', label: 'Client' },
                      { ok: !!(q as any).convertedToProject, reject: false, revision: false, label: 'Project' },
                    ]).map((dot, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${dot.ok ? 'bg-emerald-500' : dot.reject ? 'bg-rose-400' : dot.revision ? 'bg-orange-400' : 'bg-slate-200'}`} />
                        <span className="text-[7px] font-black text-slate-400 uppercase">{dot.label}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/sales/penawaran/${q.id}`); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <Eye size={13} /> Dokumen
                  </button>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-8 pb-8 border-t border-slate-50 pt-6 space-y-5">

                  {/* Meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: <CalendarDays size={13} />, label: 'Tanggal', val: q.tanggal || '-' },
                      { icon: <Building2 size={13} />, label: 'Client', val: q.kepada || '-' },
                      { icon: <DollarSign size={13} />, label: 'Nilai', val: `Rp ${(q.grandTotal || 0).toLocaleString('id-ID')}` },
                      { icon: <FileText size={13} />, label: 'Jenis', val: q.jenisQuotation || '-' },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">{item.icon}<span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span></div>
                        <p className="text-xs font-black text-slate-900 truncate">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── STEP 1: Internal ── */}
                  <div className={`rounded-2xl border p-6 ${
                    internalStatus === 'Approved' ? 'border-emerald-100 bg-emerald-50/30'
                    : internalStatus === 'Rejected' ? 'border-rose-100 bg-rose-50/30'
                    : internalStatus === 'Revision' ? 'border-orange-100 bg-orange-50/30'
                    : 'border-indigo-100 bg-indigo-50/30'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <UserCheck size={15} className={
                          internalStatus === 'Approved' ? 'text-emerald-500'
                          : internalStatus === 'Rejected' ? 'text-rose-500'
                          : internalStatus === 'Revision' ? 'text-orange-500'
                          : 'text-indigo-500'
                        } />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Step 1 — Approval Internal</p>
                      </div>
                    </div>

                    {internalStatus === 'Pending' || internalStatus === 'Revision' ? (
                      <div className="space-y-3">
                        {internalStatus === 'Revision' && (
                          <div className="flex items-center gap-2 bg-orange-100 rounded-xl px-4 py-2.5 mb-1">
                            <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                            <p className="text-xs font-semibold text-orange-700">
                              Perlu revisi: {q.internalRejectReason || '-'}
                            </p>
                          </div>
                        )}
                        <div className="flex gap-3 flex-wrap">
                          <button onClick={() => { setIntTarget(q); setIntAction('approve'); setIntReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                            <CheckCircle2 size={14} /> Setujui
                          </button>
                          <button onClick={() => { setIntTarget(q); setIntAction('revision'); setIntReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all">
                            <RotateCcw size={14} /> Minta Revisi
                          </button>
                          <button onClick={() => { setIntTarget(q); setIntAction('reject'); setIntReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all">
                            <XCircle size={14} /> Tolak
                          </button>
                        </div>
                      </div>
                    ) : internalStatus === 'Approved' ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <div>
                          <p className="text-xs font-black text-emerald-700">Disetujui oleh {q.internalApprovedBy || 'Manager'}</p>
                          {q.internalApprovedAt && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(q.internalApprovedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <XCircle size={16} className="text-rose-500" />
                        <div>
                          <p className="text-xs font-black text-rose-600">Ditolak Internal</p>
                          {q.internalRejectReason && <p className="text-[10px] text-rose-500 mt-0.5">{q.internalRejectReason}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── STEP 2: Client ── */}
                  <div className={`rounded-2xl border p-6 transition-opacity ${
                    internalStatus !== 'Approved' ? 'opacity-40 pointer-events-none border-slate-100 bg-slate-50/40'
                    : clientStatus === 'Approved' ? 'border-emerald-100 bg-emerald-50/30'
                    : clientStatus === 'Rejected' ? 'border-rose-100 bg-rose-50/30'
                    : clientStatus === 'Revision' ? 'border-orange-100 bg-orange-50/30'
                    : 'border-amber-100 bg-amber-50/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 size={15} className={
                        clientStatus === 'Approved' ? 'text-emerald-500'
                        : clientStatus === 'Rejected' ? 'text-rose-500'
                        : clientStatus === 'Revision' ? 'text-orange-500'
                        : 'text-amber-500'
                      } />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Step 2 — Approval Client</p>
                      {internalStatus !== 'Approved' && <span className="text-[9px] text-slate-400 italic ml-1">— selesaikan step 1 dulu</span>}
                    </div>

                    {clientStatus === 'Pending' || clientStatus === 'Revision' ? (
                      <div className="space-y-3">
                        {clientStatus === 'Revision' && (
                          <div className="flex items-center gap-2 bg-orange-100 rounded-xl px-4 py-2.5 mb-1">
                            <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                            <p className="text-xs font-semibold text-orange-700">
                              Perlu revisi dari client: {q.clientRejectReason || '-'}
                            </p>
                          </div>
                        )}
                        <div className="flex gap-3 flex-wrap">
                          <button onClick={() => { setCliTarget(q); setCliAction('approve'); setCliReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all">
                            <CheckCircle2 size={14} /> Client Setuju
                          </button>
                          <button onClick={() => { setCliTarget(q); setCliAction('revision'); setCliReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all">
                            <RotateCcw size={14} /> Client Revisi
                          </button>
                          <button onClick={() => { setCliTarget(q); setCliAction('reject'); setCliReason(''); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all">
                            <XCircle size={14} /> Client Tolak
                          </button>
                        </div>
                      </div>
                    ) : clientStatus === 'Approved' ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <div>
                          <p className="text-xs font-black text-emerald-700">Client menyetujui penawaran</p>
                          {q.clientApprovedAt && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(q.clientApprovedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <XCircle size={16} className="text-rose-500" />
                        <div>
                          <p className="text-xs font-black text-rose-600">Ditolak oleh Client</p>
                          {q.clientRejectReason && <p className="text-[10px] text-rose-500 mt-0.5">{q.clientRejectReason}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Approval History ── */}
                  {history.length > 0 && (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <History size={15} className="text-violet-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Riwayat Approval</p>
                        <span className="ml-auto px-2.5 py-0.5 rounded-full text-[8px] font-black bg-violet-100 text-violet-600">{history.length} aksi</span>
                      </div>
                      <div className="relative space-y-0">
                        {history.map((h, idx) => {
                          const col = actionColor[h.action] || 'slate';
                          const isLast = idx === history.length - 1;
                          return (
                            <div key={idx} className="flex gap-4 relative">
                              {/* timeline line */}
                              {!isLast && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-100" />}
                              <div className={`mt-1 w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                col === 'emerald' ? 'bg-emerald-100 text-emerald-600'
                                : col === 'rose' ? 'bg-rose-100 text-rose-500'
                                : col === 'orange' ? 'bg-orange-100 text-orange-500'
                                : 'bg-slate-100 text-slate-500'
                              }`}>
                                {col === 'emerald' ? <CheckCircle2 size={13} /> : col === 'rose' ? <XCircle size={13} /> : <RotateCcw size={13} />}
                              </div>
                              <div className={`flex-1 pb-5 ${isLast ? '' : ''}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                                    col === 'emerald' ? 'text-emerald-700'
                                    : col === 'rose' ? 'text-rose-600'
                                    : 'text-orange-600'
                                  }`}>{actionLabel[h.action] || h.action}</p>
                                  <span className="text-[9px] text-slate-400">· {h.by}</span>
                                  <span className="text-[9px] text-slate-400 ml-auto">{new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(h.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {h.reason && (
                                  <p className="text-xs text-slate-500 mt-1 italic">"{h.reason}"</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Convert to Project CTA ── */}
                  {clientStatus === 'Approved' && (
                    <div className={`rounded-2xl border-2 p-6 ${q.convertedToProject ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-300 bg-amber-50'}`}>
                      {q.convertedToProject ? (
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-black text-emerald-700">Sudah dikonversi ke Project</p>
                            <button
                              onClick={() => navigate('/project')}
                              className="text-xs text-emerald-600 underline mt-0.5 hover:text-emerald-800"
                            >
                              Lihat di halaman Project →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <FolderKanban size={20} className="text-amber-600 shrink-0" />
                            <div>
                              <p className="text-sm font-black text-amber-800">Quotation disetujui — siap jadi Project!</p>
                              <p className="text-xs text-amber-600 mt-0.5">Klik tombol untuk membuat project dari quotation ini.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setConvertTarget(q)}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-md shadow-amber-200 shrink-0"
                          >
                            <FolderKanban size={14} /> Convert to Project
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Internal Modal ── */}
      {intTarget && intAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className={`px-6 py-5 flex items-center gap-3 ${modalColor[intAction]}`}>
              {intAction === 'approve' ? <CheckCircle2 size={20} className="text-white" />
                : intAction === 'revision' ? <RotateCcw size={20} className="text-white" />
                : <XCircle size={20} className="text-white" />}
              <div>
                <p className="text-white font-black text-sm uppercase tracking-widest">
                  {modalTitle[intAction]} Internal — {intTarget.noPenawaran}
                </p>
                <p className="text-white/70 text-xs mt-0.5">{intTarget.kepada}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {intAction === 'approve' ? (
                <p className="text-sm text-slate-600">Konfirmasi persetujuan internal. Penawaran akan diteruskan ke client untuk approval.</p>
              ) : (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                    {intAction === 'revision' ? 'Catatan Revisi' : 'Alasan Penolakan'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea rows={3} value={intReason} onChange={e => setIntReason(e.target.value)}
                    placeholder={intAction === 'revision' ? 'Apa yang perlu direvisi?' : 'Jelaskan alasan penolakan...'}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
                </div>
              )}
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => { setIntTarget(null); setIntAction(null); setIntReason(''); }}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button onClick={confirmInternal}
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 ${modalColor[intAction]} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {intAction === 'approve' ? <><CheckCircle2 size={14} /> Konfirmasi</>
                    : intAction === 'revision' ? <><RotateCcw size={14} /> Kirim Revisi</>
                    : <><XCircle size={14} /> Tolak</>}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Client Modal ── */}
      {cliTarget && cliAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className={`px-6 py-5 flex items-center gap-3 ${modalColorCli[cliAction]}`}>
              {cliAction === 'approve' ? <CheckCircle2 size={20} className="text-white" />
                : cliAction === 'revision' ? <RotateCcw size={20} className="text-white" />
                : <XCircle size={20} className="text-white" />}
              <div>
                <p className="text-white font-black text-sm uppercase tracking-widest">
                  Client {modalTitle[cliAction]} — {cliTarget.noPenawaran}
                </p>
                <p className="text-white/70 text-xs mt-0.5">{cliTarget.kepada}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {cliAction === 'approve' ? (
                <p className="text-sm text-slate-600">Catat bahwa client menyetujui penawaran <strong>{cliTarget.noPenawaran}</strong>.</p>
              ) : (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                    {cliAction === 'revision' ? 'Catatan Revisi dari Client' : 'Alasan Client Menolak'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea rows={3} value={cliReason} onChange={e => setCliReason(e.target.value)}
                    placeholder={cliAction === 'revision' ? 'Apa permintaan perubahan dari client?' : 'Alasan penolakan dari client...'}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
                </div>
              )}
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => { setCliTarget(null); setCliAction(null); setCliReason(''); }}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button onClick={confirmClient}
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 ${modalColorCli[cliAction]} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {cliAction === 'approve' ? <><CheckCircle2 size={14} /> Konfirmasi</>
                    : cliAction === 'revision' ? <><RotateCcw size={14} /> Kirim Revisi</>
                    : <><XCircle size={14} /> Tolak</>}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Convert to Project Modal ── */}
      {convertTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                <FolderKanban size={28} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Convert to Project</h3>
                <p className="text-xs text-slate-400 mt-0.5">{convertTarget.noPenawaran || convertTarget.nomorQuotation}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 bg-slate-50 rounded-2xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-800">{convertTarget.kepada || convertTarget.customer?.nama || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Perihal</span>
                <span className="font-semibold text-slate-800 text-right max-w-[60%]">{convertTarget.perihal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nilai Kontrak</span>
                <span className="font-bold text-amber-600">Rp {(convertTarget.grandTotal || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-6">
              Project baru akan dibuat otomatis dari quotation ini dan langsung bisa dikelola di halaman Project.
            </p>

            <div className="flex gap-3">
              <button
                onClick={confirmConvert}
                disabled={isSubmitting}
                className="flex-1 px-5 py-3 bg-amber-500 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Memproses...' : 'Ya, Buat Project'}
              </button>
              <button
                onClick={() => setConvertTarget(null)}
                disabled={isSubmitting}
                className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
