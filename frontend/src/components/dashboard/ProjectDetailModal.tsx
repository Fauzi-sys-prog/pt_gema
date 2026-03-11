import { useApp } from '../../contexts/AppContext';
import { X, Printer, FileDown, FileSpreadsheet, Calendar, MapPin, Users, Package, DollarSign, Activity, GitCommit, CheckCircle2, Clock } from 'lucide-react'; import type { Project } from '../../contexts/AppContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import api from '../../services/api';
import { toast } from 'sonner@2.0.3';
import logoGTP from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  const { workOrderList } = useApp();
  if (!isOpen || !project) return null;

  const projectWOs = workOrderList.filter(wo => wo.projectId === project.id);
  
  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'Rp 0';
    }
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatCurrencyShort = (amount: number | undefined): string => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'Rp 0';
    }
    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`;
    }
    if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(0)}Jt`;
    }
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planning': return 'bg-yellow-100 text-yellow-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'On Hold': return 'bg-orange-100 text-orange-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handlePrintProject = () => {
    window.print();
  };

  const handleExportToWord = async () => {
    if (!project?.id) {
      toast.error("Project tidak valid untuk export Word.");
      return;
    }

    const loadingToast = toast.loading("Sedang menyiapkan dokumen Word...");
    try {
      const response = await api.get(`/exports/projects/${project.id}/word`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/msword" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `PROJECT_${String(project.kodeProject || project.id).replace(/[^a-zA-Z0-9-_]/g, "_")}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("Dokumen Word berhasil diunduh.");
    } catch {
      toast.error("Gagal export project ke Word dari backend.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleExportToExcel = async () => {
    if (!project?.id) {
      toast.error("Project tidak valid untuk export Excel.");
      return;
    }

    const loadingToast = toast.loading("Sedang menyiapkan dokumen Excel...");
    try {
      const response = await api.get(`/exports/projects/${project.id}/excel`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/vnd.ms-excel" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `PROJECT_${String(project.kodeProject || project.id).replace(/[^a-zA-Z0-9-_]/g, "_")}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("Dokumen Excel berhasil diunduh.");
    } catch {
      toast.error("Gagal export project ke Excel dari backend.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const subtotal = project.boq ? project.boq.reduce((sum, item) => {
    const qty = item.qtyEstimate || 0;
    const price = item.unitPrice || 0;
    return sum + (qty * price);
  }, 0) : 0;
  const ppn = subtotal * 0.11;
  const grandTotal = subtotal + ppn;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 print:hidden" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 print:hidden">
          <div>
            <h2 className="text-gray-900">Project Detail</h2>
            <p className="text-gray-600">{project.kodeProject}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Project Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Activity size={20} />
                </div>
                <div>
                  <div className="text-blue-600">Status</div>
                  <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                  <DollarSign size={20} />
                </div>
                <div>
                  <div className="text-green-600">Nilai Kontrak</div>
                  <div className="text-gray-900">{formatCurrencyShort(project.nilaiKontrak)}</div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white">
                  <Package size={20} />
                </div>
                <div>
                  <div className="text-purple-600">Progress</div>
                  <div className="text-gray-900">{project.progress}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-6">
            <h3 className="text-gray-900 mb-4">Informasi Project</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-gray-600 mb-1">Nama Project</div>
                <div className="text-gray-900">{project.namaProject}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Customer</div>
                <div className="text-gray-900">{project.customer}</div>
              </div>
              {project.location && (
                <div>
                  <div className="text-gray-600 mb-1 flex items-center gap-2">
                    <MapPin size={16} />
                    Lokasi
                  </div>
                  <div className="text-gray-900">{project.location}</div>
                </div>
              )}
              {project.projectManager && (
                <div>
                  <div className="text-gray-600 mb-1 flex items-center gap-2">
                    <Users size={16} />
                    Project Manager
                  </div>
                  <div className="text-gray-900">{project.projectManager}</div>
                </div>
              )}
              <div>
                <div className="text-gray-600 mb-1 flex items-center gap-2">
                  <Calendar size={16} />
                  Start Date
                </div>
                <div className="text-gray-900">{project.startDate}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1 flex items-center gap-2">
                  <Calendar size={16} />
                  End Date
                </div>
                <div className="text-gray-900">{project.endDate}</div>
              </div>
            </div>

            {project.description && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-gray-600 mb-1">Deskripsi</div>
                <div className="text-gray-900">{project.description}</div>
              </div>
            )}
          </div>

          {/* BOQ Material */}
          {project.boq && project.boq.length > 0 && (
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-6">
              <h3 className="text-gray-900 mb-4">Bill of Quantity (BOQ) - Material List</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left p-3 text-gray-600">No</th>
                      <th className="text-left p-3 text-gray-600">Material</th>
                      <th className="text-right p-3 text-gray-600">Unit Price</th>
                      <th className="text-center p-3 text-gray-600">Qty</th>
                      <th className="text-right p-3 text-gray-600">Total</th>
                      <th className="text-center p-3 text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.boq.map((item, index) => {
                      const total = (item.qtyEstimate || 0) * (item.unitPrice || 0);
                      return (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-gray-600">{index + 1}</td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <div className="text-gray-900 font-bold flex items-center gap-2">
                                {item.materialName || "Material Belum Bernama"}
                                {!item.itemKode && (
                                  <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase leading-none">
                                    Barang Baru
                                  </span>
                                )}
                              </div>
                              {item.itemKode && (
                                <div className="text-[10px] text-blue-600 font-mono">
                                  {item.itemKode}
                                </div>
                              )}
                              <div className="text-gray-500 text-xs mt-1">Supplier: {item.supplier}</div>
                            </div>
                          </td>
                          <td className="p-3 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-3 text-center text-gray-900">{item.qtyEstimate} {item.unit}</td>
                          <td className="p-3 text-right text-gray-900">{formatCurrency(total)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-sm ${
                              item.status === 'Ordered' ? 'bg-blue-100 text-blue-700' :
                              item.status === 'Received' ? 'bg-green-100 text-green-700' :
                              item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <td colSpan={4} className="p-3 text-right text-gray-900">Sub Total:</td>
                      <td className="p-3 text-right text-gray-900">{formatCurrency(subtotal)}</td>
                      <td></td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-3 text-right text-gray-600">PPN 11%:</td>
                      <td className="p-3 text-right text-gray-900">{formatCurrency(ppn)}</td>
                      <td></td>
                    </tr>
                    <tr className="bg-blue-50 border-t-2 border-gray-300">
                      <td colSpan={4} className="p-3 text-right text-blue-900">Grand Total:</td>
                      <td className="p-3 text-right text-blue-900">{formatCurrency(grandTotal)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Project Pipeline & Timeline Tracker */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-6">
            <h3 className="text-gray-900 mb-6 flex items-center gap-2">
              <GitCommit className="text-blue-600" /> Project Pipeline & Timeline Tracker
            </h3>
            
            <div className="relative">
              {/* Pipeline Line */}
              <div className="absolute top-8 left-4 right-4 h-1 bg-gray-100 hidden md:block"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'SPK Issued', status: 'Completed', date: project.startDate, icon: <FileDown size={18} /> },
                  { label: 'Work Order', status: projectWOs.length > 0 ? (projectWOs.every(w => w.status === 'Completed') ? 'Completed' : 'In Progress') : 'Pending', date: projectWOs[0]?.deadline || '-', icon: <Package size={18} /> },
                  { label: 'Production (LHP)', status: projectWOs.some(w => w.completedQty > 0) ? (projectWOs.every(w => w.status === 'Completed') ? 'Completed' : 'In Progress') : 'Pending', date: 'Realtime', icon: <Activity size={18} /> },
                  { label: 'Final QC & Handover', status: project.status === 'Completed' ? 'Completed' : 'Pending', date: project.endDate, icon: <CheckCircle2 size={18} /> }
                ].map((step, idx) => (
                  <div key={idx} className="relative flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 mb-2 border-4 border-white shadow-sm ${
                      step.status === 'Completed' ? 'bg-green-600 text-white' :
                      step.status === 'In Progress' ? 'bg-blue-600 text-white animate-pulse' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {step.icon}
                    </div>
                    <div className="text-sm font-bold text-gray-900">{step.label}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${
                      step.status === 'Completed' ? 'text-green-600' :
                      step.status === 'In Progress' ? 'text-blue-600' :
                      'text-gray-400'
                    }`}>{step.status}</div>
                    <div className="text-[10px] text-gray-500 mt-1 italic">{step.date}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Order Specific Progress */}
            {projectWOs.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Workshop Activities (Realtime LHP)</h4>
                <div className="space-y-4">
                  {projectWOs.map(wo => {
                    const woProgress = Math.round((wo.completedQty / wo.targetQty) * 100);
                    return (
                      <div key={wo.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{wo.woNumber}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                wo.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                wo.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{wo.status}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium">{wo.itemToProduce}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-gray-900">{woProgress}%</div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">
                              {wo.completedQty} / {wo.targetQty} {wo.bom?.[0]?.unit || 'Pcs'}
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              wo.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${woProgress}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                           <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <Users size={12} />
                              <span className="font-bold">{wo.leadTechnician}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <Clock size={12} />
                              <span>Deadline: {wo.deadline}</span>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Milestones & Team */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {project.milestones && project.milestones.length > 0 && (
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <h3 className="text-gray-900 mb-4">Milestones</h3>
                <div className="space-y-3">
                  {project.milestones.map((milestone, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        milestone.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        milestone.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-gray-900">{milestone.name}</div>
                        <div className="text-gray-600">Due: {milestone.dueDate}</div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          milestone.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          milestone.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {milestone.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.team && project.team.length > 0 && (
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <h3 className="text-gray-900 mb-4">Team Members</h3>
                <div className="space-y-2">
                  {project.team.map((member, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Users size={20} />
                      </div>
                      <div className="text-gray-900">{member}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between print:hidden">
          <div className="flex gap-2">
            <button
              onClick={handlePrintProject}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Printer size={18} />
              Print Report
            </button>
            {project.boq && (
              <>
                <button
                  onClick={handleExportToWord}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FileDown size={18} />
                  Export to Word
                </button>
                <button
                  onClick={handleExportToExcel}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  Export to Excel
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Print-only Content */}
      {project.boq && (
        <div className="hidden print:block p-8">
          <div className="border border-black">
            <div className="p-6 flex items-start justify-between border-b border-black">
              <div className="flex items-center gap-4">
                <ImageWithFallback src={logoGTP} className="w-24 h-auto" />
                <div className="w-px h-16 bg-black mx-2"></div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-tight tracking-tight uppercase">Gema Teknik Perkasa</span>
                  <span className="text-[10px] leading-tight max-w-[300px]">Jl. Nurushshoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510</span>
                  <span className="text-[9px] leading-tight">Phone: 085100420221, 021.88354139 | Fax: 021.88354139 | Email: gemateknik@gmail.com</span>
                </div>
              </div>
            </div>

            <div className="py-4 text-center">
              <h2 className="text-xl font-bold underline uppercase tracking-widest">Surat Penawaran</h2>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-8 text-sm border-t border-black">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-24 font-bold py-0.5">No. Project</td>
                    <td className="w-4">:</td>
                    <td className="font-bold">{project.kodeProject}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Nama Project</td>
                    <td>:</td>
                    <td className="font-bold">{project.namaProject}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Customer</td>
                    <td>:</td>
                    <td className="font-bold">{project.customer}</td>
                  </tr>
                </tbody>
              </table>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-24 font-bold py-0.5">Lokasi</td>
                    <td className="w-4">:</td>
                    <td className="font-bold uppercase">{project.location || '-'}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Manager</td>
                    <td>:</td>
                    <td className="font-bold">{project.projectManager || '-'}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-0.5">Tanggal Mulai</td>
                    <td>:</td>
                    <td className="font-bold italic">{new Date(project.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-0 border-t border-black">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-r border-b border-black p-2 text-center w-10">No</th>
                    <th className="border-r border-b border-black p-2 text-left">Material Description</th>
                    <th className="border-r border-b border-black p-2 text-center w-28">Harga Satuan</th>
                    <th className="border-r border-b border-black p-2 text-center w-24">Jumlah</th>
                    <th className="border-b border-black p-2 text-right w-32">Total Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {project.boq.map((item, index) => {
                    const total = (item.qtyEstimate || 0) * (item.unitPrice || 0);
                    return (
                      <tr key={index}>
                        <td className="border-r border-b border-black p-2 text-center">{index + 1}</td>
                        <td className="border-r border-b border-black p-2">
                          <div className="font-bold">{item.materialName}</div>
                          <div className="text-[9px] text-gray-500 italic">Supplier: {item.supplier || '-'} | Status: {item.status}</div>
                        </td>
                        <td className="border-r border-b border-black p-2 text-center">{formatCurrency(item.unitPrice)}</td>
                        <td className="border-r border-b border-black p-2 text-center">{item.qtyEstimate} {item.unit}</td>
                        <td className="border-b border-black p-2 text-right">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={4} className="border-r border-b border-black p-2 text-right font-bold italic">Sub harga</td>
                    <td className="border-b border-black p-2 text-right font-bold italic">{formatCurrency(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border-r border-b border-black p-2 text-right font-bold italic">PPN 11%</td>
                    <td className="border-b border-black p-2 text-right font-bold italic">{formatCurrency(ppn)}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="border-r border-b border-black p-2 text-right font-black uppercase tracking-tight">Grand Total</td>
                    <td className="border-b border-black p-2 text-right font-black">{formatCurrency(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-6 py-6 border-b border-black">
              <p className="text-sm">Bekasi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="grid grid-cols-3 border-t-0">
               <div className="border-r border-black flex flex-col items-center py-4">
                  <p className="text-xs font-bold mb-16">Dibuat Oleh,</p>
                  <p className="text-xs font-black underline uppercase tracking-tighter">Admin Project</p>
               </div>
               <div className="border-r border-black flex flex-col items-center py-4">
                  <p className="text-xs font-bold mb-16">Mengetahui,</p>
                  <p className="text-xs font-black underline uppercase tracking-tighter">{project.projectManager || 'Project Manager'}</p>
               </div>
               <div className="flex flex-col items-center py-4">
                  <p className="text-xs font-bold mb-16">Disetujui Oleh,</p>
                  <p className="text-xs font-black underline uppercase tracking-tighter">Direktur Utama</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
