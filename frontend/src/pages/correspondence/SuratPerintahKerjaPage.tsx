import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Printer, FileText, Calendar, User, Download, Filter, ArrowLeft, Zap, CheckCircle2, Clock, X, Briefcase, Users, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import type { Project, WorkOrder } from '../../contexts/AppContext';
import api from '../../services/api';

export default function SuratPerintahKerjaPage() {
  const { 
    projectList, 
    workOrderList,
    updateProject,
    updateWorkOrder,
    addWorkOrder,
    addAuditLog,
    currentUser
  } = useApp();
  const navigate = useNavigate();
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverSpkList, setServerSpkList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSPK, setSelectedSPK] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpk, setEditingSpk] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed'>('All');
  const [formData, setFormData] = useState({
    projectId: '',
    pekerjaan: '',
    tanggal: new Date().toISOString().split('T')[0],
    teknisi: '',
    urgent: false,
    noSPK: '',
    status: 'Active' as 'Active' | 'Completed',
    invoiceImages: [] as string[],
  });

  useEffect(() => {
    let mounted = true;
    const normalizeList = (payload: unknown): Project[] => {
      if (Array.isArray(payload)) return payload as Project[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: Project[] }).items;
      }
      return [];
    };

    const loadProjects = async () => {
      try {
        const [projectResponse, spkResponse] = await Promise.all([
          api.get('/projects'),
          api.get('/spk-records'),
        ]);
        if (!mounted) return;
        setServerProjectList(normalizeList(projectResponse.data));
        setServerSpkList(Array.isArray(spkResponse.data) ? spkResponse.data : []);
      } catch {
        if (!mounted) return;
        setServerProjectList(null);
        setServerSpkList([]);
      }
    };

    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveProjectList = projectList.length > 0 ? projectList : (serverProjectList ?? []);
  const projectNameById = new Map(effectiveProjectList.map((p) => [p.id, p.namaProject]));

  // Primary source: dedicated SPK table.
  const spkFromServer = serverSpkList.map((spk: any) => ({
    ...spk,
    projectName: projectNameById.get(spk.projectId) || spk.projectName || '-',
    projectId: spk.projectId,
    teknisi: Array.isArray(spk.teknisi)
      ? spk.teknisi
      : (spk.teknisi ? String(spk.teknisi).split(',').map((t: string) => t.trim()) : []),
    __source: "SPK_RECORD",
  }));

  // Fallback: legacy SPK in project payload + WO/FieldRecord.
  const spkFallback = effectiveProjectList.flatMap((project) => {
    const fromProjectSpk = (project.spkList || []).map((spk: any) => ({
      ...spk,
      projectName: project.namaProject,
      projectId: project.id,
      teknisi: Array.isArray(spk.teknisi)
        ? spk.teknisi
        : (spk.teknisi ? String(spk.teknisi).split(',').map((t: string) => t.trim()) : []),
      __source: "SPK_LIST",
    }));

    const fromWorkOrders = workOrderList
      .filter((wo) => wo.projectId === project.id)
      .map((wo: any) => ({
        id: `SPK-WO-${wo.id}`,
        noSPK: String(wo.noSPK || wo.woNumber || wo.id),
        tanggal: String(wo.startDate || wo.deadline || new Date().toISOString().slice(0, 10)),
        pekerjaan: String(wo.itemToProduce || "-"),
        teknisi: wo.leadTechnician ? [String(wo.leadTechnician)] : [],
        status: wo.status === "Completed" ? "Completed" : "Active",
        urgent: String(wo.priority || "").toLowerCase() === "urgent",
        createdAt: wo.createdAt || wo.updatedAt || undefined,
        projectName: project.namaProject,
        projectId: project.id,
        __source: "WORK_ORDER",
      }));

    const fromFieldRecords = (project.materialUsageReports || [])
      .filter((report: any) => String(report?.spkNumber || "").trim().length > 0)
      .map((report: any) => ({
        id: `SPK-MUR-${report.id}`,
        noSPK: String(report.spkNumber).trim(),
        tanggal: String(report.date || new Date().toISOString().slice(0, 10)),
        pekerjaan: `Material Report ${String(report.reportNumber || report.id)}`,
        teknisi: [],
        status: "Active",
        urgent: false,
        createdAt: report.createdAt || undefined,
        projectName: project.namaProject,
        projectId: project.id,
        __source: "FIELD_RECORD",
      }));

    const merged = [...fromProjectSpk];
    for (const woBased of [...fromWorkOrders, ...fromFieldRecords]) {
      const exists = merged.some(
        (spk: any) => String(spk.noSPK || "").trim().toUpperCase() === String(woBased.noSPK || "").trim().toUpperCase()
      );
      if (!exists) merged.push(woBased);
    }

    return merged;
  });

  const spkList = [...spkFromServer];
  for (const fallback of spkFallback) {
    const exists = spkList.some(
      (spk: any) => String(spk.noSPK || "").trim().toUpperCase() === String(fallback.noSPK || "").trim().toUpperCase()
    );
    if (!exists) spkList.push(fallback);
  }
  spkList.sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const resetForm = () => {
    setFormData({
      projectId: '',
      pekerjaan: '',
      tanggal: new Date().toISOString().split('T')[0],
      teknisi: '',
      urgent: false,
      noSPK: '',
      status: 'Active',
      invoiceImages: [],
    });
    setEditingSpk(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEditSPK = (spk: any) => {
    const teknisiText = Array.isArray(spk.teknisi) ? spk.teknisi.join(', ') : String(spk.teknisi || '');
    setEditingSpk(spk);
    setFormData({
      projectId: spk.projectId || '',
      pekerjaan: String(spk.pekerjaan || ''),
      tanggal: String(spk.tanggal || new Date().toISOString().slice(0, 10)),
      teknisi: teknisiText,
      urgent: Boolean(spk.urgent),
      noSPK: String(spk.noSPK || ''),
      status: spk.status === 'Completed' ? 'Completed' : 'Active',
      invoiceImages: Array.isArray(spk.invoiceImages) ? spk.invoiceImages : [],
    });
    setShowCreateModal(true);
  };

  const handleCreateOrUpdateSPK = async () => {
    if (!formData.projectId || !formData.pekerjaan) return;

    const project = effectiveProjectList.find(p => p.id === formData.projectId);
    if (project) {
      const currentNoSpk = String(editingSpk?.noSPK || '').trim();
      const currentProjectSpkCount = spkList.filter((spk: any) => spk.projectId === project.id).length;
      const nextNoSpk = String(formData.noSPK || `SPK/${new Date().getFullYear()}/${String(currentProjectSpkCount + 1).padStart(3, '0')}`).trim();
      const isEditableSpkRecord = Boolean(editingSpk?.id) && !String(editingSpk.id).startsWith('SPK-WO-') && !String(editingSpk.id).startsWith('SPK-MUR-');
      const newSPK = {
        id: isEditableSpkRecord ? editingSpk.id : `SPK-${Date.now()}`,
        projectId: project.id,
        workOrderId: editingSpk?.workOrderId || undefined,
        noSPK: nextNoSpk,
        tanggal: formData.tanggal,
        pekerjaan: formData.pekerjaan,
        teknisi: formData.teknisi.split(',').map((t) => t.trim()).filter(Boolean),
        status: formData.status,
        urgent: formData.urgent,
        createdAt: editingSpk?.createdAt || new Date().toISOString(),
        invoiceImages: formData.invoiceImages,
      };

      const isEdit = Boolean(editingSpk) && isEditableSpkRecord;
      const primaryTechnician = formData.teknisi.split(',')[0]?.trim() || '';

      const updatedReports = (project.materialUsageReports || []).map((r: any) => {
        if (currentNoSpk && String(r?.spkNumber || '').trim().toUpperCase() === currentNoSpk.toUpperCase()) {
          return { ...r, spkNumber: nextNoSpk };
        }
        return r;
      });

      try {
        if (isEdit) {
          await api.patch(`/spk-records/${newSPK.id}`, newSPK);
          setServerSpkList((prev) => prev.map((item) => (item.id === newSPK.id ? { ...item, ...newSPK } : item)));
        } else {
          await api.post('/spk-records', newSPK);
          setServerSpkList((prev) => [{ ...newSPK }, ...prev]);
        }
      } catch (err: any) {
        const apiMessage = err?.response?.data?.message || err?.message || 'Gagal simpan SPK ke server';
        toast.error(apiMessage);
        return;
      }

      updateProject(project.id, { materialUsageReports: updatedReports } as any);

      // Keep WO relation in sync when SPK comes from WO flow.
      workOrderList
        .filter((wo: any) => wo.projectId === project.id)
        .filter((wo: any) => {
          const woSpk = String(wo?.noSPK || '').trim().toUpperCase();
          const woSpkId = String(wo?.spkId || '').trim();
          return (currentNoSpk && woSpk === currentNoSpk.toUpperCase()) || (woSpkId && woSpkId === String(editingSpk?.id || ''));
        })
        .forEach((wo: any) => {
          updateWorkOrder(wo.id, {
            itemToProduce: formData.pekerjaan,
            leadTechnician: primaryTechnician || wo.leadTechnician,
            priority: formData.urgent ? 'Urgent' : 'Normal',
            deadline: formData.tanggal,
            noSPK: nextNoSpk,
            spkId: newSPK.id,
            status: formData.status === 'Completed' ? 'Completed' : wo.status,
          } as any);
        });

      if (!editingSpk) {
        const newWO: WorkOrder = {
          id: `WO-${Date.now()}`,
          woNumber: `WO-${newSPK.noSPK.split('/').pop() || Date.now()}`,
          projectId: project.id,
          projectName: project.namaProject,
          itemToProduce: formData.pekerjaan,
          targetQty: 1,
          completedQty: 0,
          status: 'In Progress',
          priority: formData.urgent ? 'Urgent' : 'Normal',
          deadline: project.endDate,
          leadTechnician: primaryTechnician || 'Unassigned',
          spkId: newSPK.id,
          bom: [],
        };
        addWorkOrder(newWO);
      }

      addAuditLog({
        module: 'Correspondence',
        action: isEdit ? 'SPK_UPDATED' : 'SPK_CREATED',
        details: `SPK ${newSPK.noSPK} ${isEdit ? 'diupdate' : 'dibuat'} untuk project ${project.namaProject} oleh ${currentUser?.fullName || currentUser?.username || 'System'}`,
        status: 'Success',
      });

      toast.success(isEdit ? `SPK ${newSPK.noSPK} berhasil diupdate` : `✅ SPK ${newSPK.noSPK} diterbitkan & Work Order otomatis dibuat!`);
      setShowCreateModal(false);
      resetForm();
    }
  };

  const handleDeleteSPK = async (spk: any) => {
    if (!window.confirm(`Hapus SPK ${spk.noSPK}?`)) return;
    const project = effectiveProjectList.find((p) => p.id === spk.projectId);
    if (!project) return;

    const targetNoSpk = String(spk.noSPK || '').trim().toUpperCase();
    if (spk.__source === 'SPK_RECORD') {
      try {
        await api.delete(`/spk-records/${spk.id}`);
        setServerSpkList((prev) => prev.filter((item) => item.id !== spk.id));
      } catch (err: any) {
        const apiMessage = err?.response?.data?.message || err?.message || 'Gagal hapus SPK';
        toast.error(apiMessage);
        return;
      }
    }
    const nextReports = (project.materialUsageReports || []).map((r: any) => {
      if (String(r?.spkNumber || '').trim().toUpperCase() === targetNoSpk) {
        return { ...r, spkNumber: '' };
      }
      return r;
    });
    updateProject(project.id, { materialUsageReports: nextReports } as any);

    workOrderList
      .filter((wo: any) => wo.projectId === project.id)
      .filter((wo: any) => String(wo?.noSPK || '').trim().toUpperCase() === targetNoSpk)
      .forEach((wo: any) => {
        updateWorkOrder(wo.id, { noSPK: '', spkId: undefined } as any);
      });

    addAuditLog({
      module: 'Correspondence',
      action: 'SPK_DELETED',
      details: `SPK ${spk.noSPK} dihapus dari project ${project.namaProject} oleh ${currentUser?.fullName || currentUser?.username || 'System'}`,
      status: 'Success',
    });
    toast.success(`SPK ${spk.noSPK} berhasil dihapus`);
  };

  const filteredSPK = spkList.filter(spk => {
    const matchesSearch =
      (spk.noSPK || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (spk.pekerjaan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (spk.projectName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' ? true : spk.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportSPK = async () => {
    if (filteredSPK.length === 0) {
      toast.info('Tidak ada data SPK untuk diekspor.');
      return;
    }
    const rows = [
      ['No SPK', 'Tanggal', 'Project', 'Pekerjaan', 'Teknisi', 'Status', 'Urgent'],
      ...filteredSPK.map((spk) => [
        String(spk.noSPK || ''),
        String(spk.tanggal || ''),
        String(spk.projectName || ''),
        String(spk.pekerjaan || ''),
        String(Array.isArray(spk.teknisi) ? spk.teknisi.join(' | ') : ''),
        String(spk.status || ''),
        spk.urgent ? 'YES' : 'NO',
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `spk-list-${dateKey}`,
      title: 'Rekap Surat Perintah Kerja',
      subtitle: `Status filter: ${statusFilter}`,
      columns: rows[0],
      rows: rows.slice(1),
      generatedBy: currentUser?.fullName || currentUser?.username || 'SPK Module',
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post('/exports/tabular-report/excel', payload, { responseType: 'blob' }),
        api.post('/exports/tabular-report/word', payload, { responseType: 'blob' }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: 'application/vnd.ms-excel' }));
      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `spk-list-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: 'application/msword' }));
      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `spk-list-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      toast.success('Rekap SPK Word + Excel berhasil diekspor.');
    } catch {
      toast.error('Export rekap SPK gagal.');
    }
  };

  const handlePrintSPK = (spk: any) => {
    setSelectedSPK(spk);
    setShowPreview(true);
    setTimeout(() => window.print(), 100);
  };

  const handleUploadInvoiceImages = (files: FileList | null) => {
    if (!files) return;
    const maxFiles = 5;
    const allowed = Array.from(files).slice(0, maxFiles);
    Promise.all(
      allowed.map((file) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed reading image'));
        reader.readAsDataURL(file);
      }))
    )
      .then((images) => setFormData((prev) => ({ ...prev, invoiceImages: [...prev.invoiceImages, ...images].slice(0, maxFiles) })))
      .catch(() => toast.error('Gagal upload gambar invoice'));
  };

  const removeInvoiceImage = (index: number) => {
    setFormData((prev) => ({ ...prev, invoiceImages: prev.invoiceImages.filter((_, i) => i !== index) }));
  };

  const exportSpkWord = async (spk: any) => {
    const rawId = String(spk?.id || '').trim();
    const source = String(spk?.__source || '').trim().toUpperCase();
    let baseUrl = '';

    if (source === 'SPK_RECORD' && rawId) {
      baseUrl = `/exports/spk-records/${rawId}`;
    } else if (rawId.startsWith('SPK-WO-')) {
      const woId = rawId.replace(/^SPK-WO-/, '');
      if (woId) baseUrl = `/exports/work-orders/${woId}`;
    }

    if (!baseUrl) return toast.error('SPK ini belum punya ID backend untuk export.');

    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`${baseUrl}/word`, { responseType: 'blob' }),
        api.get(`${baseUrl}/excel`, { responseType: 'blob' }),
      ]);

      const safeNo = String(spk?.noSPK || 'spk').replace(/[^a-zA-Z0-9-_]/g, '_');
      const wordBlob = new Blob([wordResponse.data], { type: 'application/msword' });
      const excelBlob = new Blob([excelResponse.data], { type: 'application/vnd.ms-excel' });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement('a');
      wordLink.href = wordUrl;
      wordLink.download = `${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement('a');
      excelLink.href = excelUrl;
      excelLink.download = `${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);
      toast.success(`SPK ${spk.noSPK} diexport ke Word + Excel`);
    } catch {
      toast.error(`Gagal export Word + Excel SPK ${spk.noSPK} dari backend.`);
    }
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
             onClick={openCreateModal}
             className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all"
           >
             <Plus size={16} />
             Buat SPK Baru
           </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'SPK Aktif', val: spkList.filter(s => s.status === 'Active').length, icon: Clock, color: 'blue' },
          { label: 'Selesai', val: spkList.filter(s => s.status === 'Completed').length, icon: CheckCircle2, color: 'emerald' },
          { label: 'Urgent Task', val: spkList.filter(s => s.urgent).length, icon: Zap, color: 'rose' },
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
             <button
               onClick={() => setStatusFilter((prev) => (prev === 'All' ? 'Active' : prev === 'Active' ? 'Completed' : 'All'))}
               className="p-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all"
               title={`Filter status: ${statusFilter}`}
             >
                <Filter size={18} />
             </button>
             <button
               onClick={handleExportSPK}
               className="p-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all"
               title="Export SPK"
             >
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
              {filteredSPK.map((spk) => (
                <tr key={spk.id} className="group hover:bg-slate-50/50 transition-colors">
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
                            {String(t || "?").charAt(0).toUpperCase()}
                         </div>
                       )) : (
                         <div className="text-[10px] font-bold text-slate-300 uppercase italic">Belum Ada</div>
                       )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border-2 ${
                      spk.status === 'Active' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100' 
                      : spk.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      {spk.status === 'Completed' ? 'Selesai' : spk.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedSPK(spk); setShowPreview(true); }}
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Detail SPK"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleOpenEditSPK(spk)}
                        className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Edit SPK"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => exportSpkWord(spk)}
                        className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Export Word + Excel"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteSPK(spk)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Hapus SPK"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => handlePrintSPK(spk)}
                        className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                        title="Print"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit SPK Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-8">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 border-4 border-slate-200">
              <div className="p-8 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                       <Plus size={24} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900">{editingSpk ? 'Update SPK' : 'Terbitkan SPK Baru'}</h3>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Dokumen instruksi kerja terhubung ke project</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => { setShowCreateModal(false); resetForm(); }}
                   className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border-2 border-slate-100"
                 >
                    <X size={24} />
                 </button>
              </div>
              <div className="p-10 space-y-6">
                 <div className="grid grid-cols-1 gap-6">
                    <div>
                       <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Briefcase size={12} /> Referensi Proyek
                       </label>
                       <select 
                         value={formData.projectId}
                         onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                         className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all"
                       >
                          <option value="">-- Pilih Proyek Aktif --</option>
                          {effectiveProjectList.filter(p => p.status !== 'Completed').map(p => (
                             <option key={p.id} value={p.id}>{p.kodeProject} - {p.namaProject}</option>
                          ))}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <FileText size={12} /> Nama Pekerjaan / Instruksi
                       </label>
                       <input 
                         type="text"
                         value={formData.pekerjaan}
                         onChange={(e) => setFormData({...formData, pekerjaan: e.target.value})}
                         placeholder="CONTOH: REPAIR BOILER NO. 2..."
                         className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Calendar size={12} /> Tanggal SPK
                          </label>
                          <input 
                            type="date"
                            value={formData.tanggal}
                            onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black italic focus:border-blue-500 outline-none transition-all"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Zap size={12} /> No. SPK (Opsional)
                          </label>
                          <input 
                            type="text"
                            value={formData.noSPK}
                            onChange={(e) => setFormData({...formData, noSPK: e.target.value})}
                            placeholder="OTOMATIS JIKA KOSONG"
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2">Status SPK</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: (e.target.value as 'Active' | 'Completed')})}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all"
                          >
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                          </select>
                       </div>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Users size={12} /> Daftar Teknisi (Pisahkan dengan koma)
                       </label>
                       <textarea 
                         value={formData.teknisi}
                         onChange={(e) => setFormData({...formData, teknisi: e.target.value})}
                         rows={2}
                         placeholder="CONTOH: SOLEH, DENI, SARJI..."
                         className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase italic focus:border-blue-500 outline-none transition-all"
                       />
                    </div>
                    <div className="flex items-center gap-3">
                       <input 
                         type="checkbox"
                         id="urgent"
                         checked={formData.urgent}
                         onChange={(e) => setFormData({...formData, urgent: e.target.checked})}
                         className="w-5 h-5 rounded-lg border-2 border-slate-200"
                       />
                       <label htmlFor="urgent" className="text-[10px] font-black uppercase italic text-rose-600 tracking-widest cursor-pointer select-none">
                          Tandai sebagai Prioritas Tinggi (URGENT)
                       </label>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2">
                          Upload Gambar Invoice (Opsional)
                       </label>
                       <input
                         type="file"
                         accept="image/*"
                         multiple
                         onChange={(e) => handleUploadInvoiceImages(e.target.files)}
                         className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold text-slate-500"
                       />
                       {formData.invoiceImages.length > 0 && (
                         <div className="mt-3 grid grid-cols-4 gap-3">
                           {formData.invoiceImages.map((img, idx) => (
                             <div key={`${img}-${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200">
                               <img src={img} alt={`invoice-${idx}`} className="w-full h-20 object-cover" />
                               <button
                                 type="button"
                                 onClick={() => removeInvoiceImage(idx)}
                                 className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md hover:bg-rose-600 transition-all"
                               >
                                 <X size={12} />
                               </button>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex justify-end gap-3">
                 <button 
                   onClick={() => { setShowCreateModal(false); resetForm(); }}
                   className="px-8 py-4 border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all"
                 >
                    Batal
                 </button>
                 <button 
                   onClick={handleCreateOrUpdateSPK}
                   disabled={!formData.projectId || !formData.pekerjaan}
                   className="px-10 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {editingSpk ? 'Update SPK' : 'Terbitkan SPK & Work Order'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* SPK Review Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-8">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 border-4 border-slate-200">
              <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                       <FileText size={24} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase italic tracking-widest text-slate-900">SPK Review Draft (Word Style)</h3>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Final dokumen bisa diexport ke Word + Excel</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShowPreview(false)}
                   className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border-2 border-slate-100"
                 >
                    <X size={24} />
                 </button>
              </div>
              <div className="p-8 bg-slate-100 overflow-auto max-h-[70vh] custom-scrollbar">
                 <div className="bg-white p-10 shadow-2xl rounded-xl border border-slate-200">
                    <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Surat Perintah Kerja (SPK)</h2>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">PT Gema Teknik Perkasa</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No SPK</p>
                        <p className="text-sm font-black text-blue-700">{selectedSPK?.noSPK || '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tanggal</p>
                        <p className="font-bold text-slate-800">{selectedSPK?.tanggal || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Project</p>
                        <p className="font-bold text-slate-800">{selectedSPK?.projectName || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Instruksi Pekerjaan</p>
                        <p className="font-bold text-slate-800">{selectedSPK?.pekerjaan || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Teknisi</p>
                        <p className="font-bold text-slate-800">
                          {Array.isArray(selectedSPK?.teknisi) ? selectedSPK.teknisi.join(', ') : String(selectedSPK?.teknisi || '-')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-8">
                      <div className="border border-slate-200 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                        <p className="font-black text-slate-900">{selectedSPK?.status || '-'}</p>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Prioritas</p>
                        <p className="font-black text-slate-900">{selectedSPK?.urgent ? 'URGENT' : 'NORMAL'}</p>
                      </div>
                    </div>

                    {Array.isArray(selectedSPK?.invoiceImages) && selectedSPK.invoiceImages.length > 0 && (
                      <div className="mt-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Lampiran Gambar Invoice</p>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedSPK.invoiceImages.map((img: string, idx: number) => (
                            <div key={`${img}-${idx}`} className="border border-slate-200 rounded-xl overflow-hidden">
                              <img src={img} alt={`invoice-${idx}`} className="w-full h-48 object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
              <div className="p-6 bg-white border-t-2 border-slate-50 flex justify-end gap-3">
                 <div className="mr-auto flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border-2 border-slate-100">
                    <User size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase italic">Reviewed by {currentUser?.fullName || currentUser?.username || 'User'}</span>
                 </div>
                 <button
                   onClick={() => selectedSPK && exportSpkWord(selectedSPK)}
                   className="px-8 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg"
                 >
                   Export Word + Excel
                 </button>
                 <button onClick={() => window.print()} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg">Print Document</button>
                 <button className="px-8 py-3 border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all" onClick={() => setShowPreview(false)}>Tutup</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
