import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Calculator, 
  ArrowLeft,
  Filter,
  Download,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  Hammer,
  Truck,
  Wallet,
  CheckCircle2,
  X,
  Maximize2,
  ChevronRight,
  ChevronDown,
  FileText,
  MoreVertical,
  ArrowUpRight,
  AlertCircle,
  Clock,
  LayoutDashboard,
  Save,
  Trash,
  Construction,
  HardHat,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp, type Quotation, type Project } from '../../contexts/AppContext';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart';
import { toast } from 'sonner';

export default function RABProjectPage() {
  const {
    quotationList,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    projectList,
    addProject,
    deleteProject,
    stockItemList,
    employeeList,
    dataCollectionList,
    customerList = []
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeTab, setActiveTab] = useState<'materials' | 'manpower' | 'equipment' | 'consumables'>('materials');
  
  // Form State for New/Edit Quotation
  const [formState, setFormState] = useState<Partial<Quotation>>({
    nomorQuotation: `QO/GTP/${new Date().getFullYear()}/${(quotationList.length + 1).toString().padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    customer: { nama: '', alamat: '', pic: '' },
    perihal: '',
    materials: [],
    manpower: [],
    equipment: [],
    consumables: [],
    status: 'Draft',
    // @ts-ignore
    dataCollectionId: '',
    terminologyFormat: 'RAB',
    location: '',
    validUntil: '',
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const calculateGrandTotal = (state: Partial<Quotation>) => {
    const matTotal = (state.materials || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const manTotal = (state.manpower || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const eqTotal = (state.equipment || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const conTotal = (state.consumables || []).reduce((sum, item) => sum + (item.total || 0), 0);
    return matTotal + manTotal + eqTotal + conTotal;
  };

  const handleAddItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables') => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      qty: 1,
      unit: type === 'materials' ? 'Sack' : type === 'manpower' ? 'Man-Day' : 'Unit',
      unitPrice: 0,
      total: 0,
      code: ''
    };

    setFormState(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), newItem]
    }));
  };

  const updateItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables', id: string, updates: any) => {
    setFormState(prev => {
      const updatedList = (prev[type] || []).map((item: any) => {
        if (item.id === id) {
          const newItem = { ...item, ...updates };
          newItem.total = newItem.qty * newItem.unitPrice;
          return newItem;
        }
        return item;
      });
      return { ...prev, [type]: updatedList };
    });
  };

  const removeItem = (type: 'materials' | 'manpower' | 'equipment' | 'consumables', id: string) => {
    setFormState(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter((item: any) => item.id !== id)
    }));
  };

  const handleSaveQuotation = async () => {
    if (!formState.customer?.nama || !formState.perihal) {
      toast.error("Mohon isi Nama Customer dan Perihal");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    const finalQuotation: Quotation = {
      ...(formState as Quotation),
      id: `QO-${Date.now()}`,
      grandTotal: calculateGrandTotal(formState)
    };

    try {
      await addQuotation(finalQuotation);
      toast.success("Quotation Berhasil Disimpan");
      setView('list');
    } catch (err) {
      toast.error('Quotation gagal disimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToProject = async (quo: Quotation) => {
    if (isSubmitting) return;
    if (!window.confirm(`Approve quotation "${quo.nomorQuotation}" dan buat project baru?`)) return;
    setIsSubmitting(true);
    const newProject: Project = {
      id: `PRJ-${Date.now()}`,
      kodeProject: quo.nomorQuotation.replace('QO', 'PRJ'),
      namaProject: quo.perihal,
      customer: quo.customer?.nama || 'N/A',
      customerId: (quo as any).customerId || '',
      nilaiKontrak: quo.grandTotal || 0,
      status: 'In Progress',
      progress: 0,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quotationId: quo.id,
      budget: {
        materials: quo.materials,
        manpower: quo.manpower,
        equipment: quo.equipment,
        consumables: quo.consumables
      },
      approvalStatus: 'Approved',
      workingExpenses: [],
      fieldAttendance: [],
      materialUsageReports: []
    };

    try {
      const createdProject = await addProject(newProject);
      if (!createdProject) {
        toast.error('Gagal membuat project di server. Quotation tidak diubah.');
        return;
      }
      try {
        const saved = await updateQuotation(quo.id, { status: 'Approved' });
        if (saved === undefined) throw new Error('Update quotation gagal disimpan ke server');
      } catch (linkErr) {
        // Rollback project agar tidak ada project yatim tanpa status quotation.
        try { deleteProject(newProject.id); } catch { /* best effort */ }
        throw linkErr;
      }
      toast.success("Quotation Disetujui & Sinkron ke Project Ledger");
      setView('list');
    } catch (err) {
      toast.error('Konversi ke Project gagal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedQuotation) return;
    
    let csv = "DATA PENAWARAN - PT GEMA TEKNIK PERKASA\n";
    csv += `Customer,${selectedQuotation.customer?.nama || 'N/A'}\n`;
    csv += `Nomor,${selectedQuotation.nomorQuotation}\n`;
    csv += `Perihal,${selectedQuotation.perihal}\n\n`;
    
    csv += "Kategori,Description,Qty,Unit,Unit Price,Total\n";
    
    const categories = ['materials', 'manpower', 'equipment', 'consumables'] as const;
    categories.forEach(cat => {
      selectedQuotation[cat].forEach(item => {
        csv += `${cat.toUpperCase()},"${item.description}",${item.qty},${item.unit},${item.unitPrice},${item.total}\n`;
      });
    });
    
    csv += `\nGRAND TOTAL,,,,"${selectedQuotation.grandTotal}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Penawaran_GTP_${selectedQuotation.nomorQuotation.replace(/\//g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data Berhasil Diekspor ke Excel (CSV)");
  };

  const budgetChartData = useMemo(() => {
    if (!selectedQuotation) return [];
    
    return [
      {
        category: 'Materials',
        value: selectedQuotation.materials.reduce((sum, item) => sum + (item.total || 0), 0),
        fill: '#10b981'
      },
      {
        category: 'Manpower',
        value: selectedQuotation.manpower.reduce((sum, item) => sum + (item.total || 0), 0),
        fill: '#3b82f6'
      },
      {
        category: 'Equipment',
        value: selectedQuotation.equipment.reduce((sum, item) => sum + (item.total || 0), 0),
        fill: '#f59e0b'
      },
      {
        category: 'Consumables',
        value: selectedQuotation.consumables.reduce((sum, item) => sum + (item.total || 0), 0),
        fill: '#ef4444'
      }
    ].filter(item => item.value > 0);
  }, [selectedQuotation]);

  const pieData = useMemo(() => {
    if (!selectedQuotation) return [];
    
    const total = selectedQuotation.grandTotal || 1;
    return budgetChartData.map(item => ({
      ...item,
      percentage: (item.value / total) * 100
    }));
  }, [selectedQuotation, budgetChartData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {view === 'list' && (
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Calculator size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">RAB & Project Approval</h1>
                <p className="text-sm text-slate-500 font-bold">Rencana Anggaran Biaya & Konversi ke Project</p>
              </div>
            </div>
            <button 
              onClick={() => setView('create')}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:shadow-xl transition-all text-sm"
            >
              <Plus size={20} /> Buat RAB Baru
            </button>
          </div>

          {/* Quotation List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotationList.map(quo => {
              const isLinkedToProject = projectList.some(p => p.quotationId === quo.id);
              return (
                <div key={quo.id} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-slate-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-1">{quo.perihal}</h3>
                      <p className="text-xs text-slate-500 font-bold">{quo.customer?.nama || 'N/A'}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{quo.nomorQuotation}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      quo.status === 'Draft' ? 'bg-slate-100 text-slate-600' :
                      quo.status === 'Sent' ? 'bg-blue-50 text-blue-600' :
                      quo.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {quo.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">Grand Total</span>
                      <span className="font-black text-blue-600">{formatCurrency(quo.grandTotal || 0)}</span>
                    </div>
                    <div className="h-px bg-slate-100"></div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Zap size={12} className="text-emerald-500" />
                        <span className="font-bold">{(quo.materials || []).length} Materials</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Hammer size={12} className="text-blue-500" />
                        <span className="font-bold">{(quo.manpower || []).length} Manpower</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Truck size={12} className="text-orange-500" />
                        <span className="font-bold">{(quo.equipment || []).length} Equipment</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Wallet size={12} className="text-red-500" />
                        <span className="font-bold">{(quo.consumables || []).length} Consumables</span>
                      </div>
                    </div>
                  </div>

                  {isLinkedToProject && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                      <Construction size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Linked to Project</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedQuotation(quo);
                        setView('detail');
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus quotation "${quo.nomorQuotation}"? Tindakan ini tidak dapat dibatalkan.`)) {
                          deleteQuotation(quo.id);
                          toast.success('Quotation dihapus.');
                        }
                      }}
                      className="px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {quotationList.length === 0 && (
            <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-100">
              <Calculator size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-2">Belum Ada RAB</h3>
              <p className="text-sm text-slate-400 font-bold">Klik "Buat RAB Baru" untuk memulai</p>
            </div>
          )}
        </div>
      )}

      {view === 'detail' && selectedQuotation && (
        <div className="p-8">
          <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
              
              <div className="relative z-10">
                <button 
                  onClick={() => setView('list')}
                  className="mb-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-black uppercase transition-all"
                >
                  <ArrowLeft size={16} /> Kembali
                </button>
                
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">{selectedQuotation.perihal}</h1>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-blue-200">
                        <Building2 size={16} />
                        <span className="font-bold">{selectedQuotation.customer?.nama || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-200">
                        <FileText size={16} />
                        <span className="font-bold">{selectedQuotation.nomorQuotation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-200">
                        <Clock size={16} />
                        <span className="font-bold">{selectedQuotation.tanggal}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {!projectList.some(p => p.quotationId === selectedQuotation.id) && selectedQuotation.status !== 'Approved' && (
                       <button
                          onClick={() => handleConvertToProject(selectedQuotation)}
                          disabled={isSubmitting}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl flex items-center justify-between group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                          <div className="flex items-center gap-3">
                             <CheckCircle2 size={18} />
                             <span className="text-[11px] font-black uppercase">Approve & Mulai Proyek</span>
                          </div>
                          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                       </button>
                     )}
                     <button 
                        onClick={handleExportExcel}
                        className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center justify-between group transition-all"
                     >
                        <div className="flex items-center gap-3">
                           <FileSpreadsheet className="text-emerald-400" size={18} />
                           <span className="text-[11px] font-black uppercase tracking-widest">Export ke Excel</span>
                        </div>
                        <ChevronRight size={16} />
                     </button>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mb-2">Grand Total Project</p>
                  <p className="text-4xl font-black text-white">{formatCurrency(selectedQuotation.grandTotal || 0)}</p>
                </div>
              </div>
            </div>

            {/* Budget Breakdown Charts */}
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Budget Distribution</h3>
                <ChartContainer config={{
                  materials: { label: 'Materials', color: '#10b981' },
                  manpower: { label: 'Manpower', color: '#3b82f6' },
                  equipment: { label: 'Equipment', color: '#f59e0b' },
                  consumables: { label: 'Consumables', color: '#ef4444' }
                }} className="h-[250px]">
                  <BarChart data={budgetChartData}>
                    <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis key="x" dataKey="category" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis key="y" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar key="bar-value" dataKey="value" radius={[8, 8, 0, 0]}>
                      {budgetChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Percentage Breakdown</h3>
                <ChartContainer config={{
                  materials: { label: 'Materials', color: '#10b981' },
                  manpower: { label: 'Manpower', color: '#3b82f6' },
                  equipment: { label: 'Equipment', color: '#f59e0b' },
                  consumables: { label: 'Consumables', color: '#ef4444' }
                }} className="h-[250px]">
                  <RePieChart>
                    <Pie 
                      data={pieData} 
                      dataKey="percentage" 
                      nameKey="category" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={80}
                      label={(entry) => `${entry.category}: ${entry.percentage.toFixed(1)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RePieChart>
                </ChartContainer>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 bg-white px-8">
              <div className="flex gap-2">
                {(['materials', 'manpower', 'equipment', 'consumables'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                      activeTab === tab
                        ? 'text-blue-600'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-lg"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">Qty</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">Unit</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Unit Price</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuotation[activeTab].map((item, idx) => (
                      <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50 transition-all">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.description}</td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-600">{item.qty}</td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-600">{item.unit}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-blue-600">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    {selectedQuotation[activeTab].length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 font-bold">
                          No items in {activeTab}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest">Subtotal {activeTab}</td>
                      <td className="px-6 py-4 text-right text-sm font-black">{formatCurrency(selectedQuotation[activeTab].reduce((sum, item) => sum + (item.total || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'create' && (
        <div className="p-8">
          <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
              <button 
                onClick={() => setView('list')}
                className="mb-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase transition-all"
              >
                <ArrowLeft size={16} /> Cancel
              </button>
              <h1 className="text-3xl font-black uppercase tracking-tight">Create New RAB</h1>
              <p className="text-sm text-blue-100 font-bold mt-2">Rencana Anggaran Biaya - PT Gema Teknik Perkasa</p>
            </div>

            <div className="p-8 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Nomor Quotation</label>
                  <input 
                    type="text"
                    value={formState.nomorQuotation}
                    onChange={e => setFormState(prev => ({ ...prev, nomorQuotation: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Tanggal</label>
                  <input 
                    type="date"
                    value={formState.tanggal}
                    onChange={e => setFormState(prev => ({ ...prev, tanggal: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Customer</label>
                <select
                  value={(formState as any).customerId || ''}
                  onChange={e => {
                    const cust = customerList.find((c: any) => c.id === e.target.value);
                    setFormState(prev => ({
                      ...prev,
                      customerId: e.target.value,
                      customer: { ...prev.customer, nama: cust?.namaCustomer || prev.customer?.nama || '' } as any
                    }));
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <option value="">-- Pilih dari Master Customer --</option>
                  {customerList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.namaCustomer}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formState.customer?.nama || ''}
                  onChange={e => setFormState(prev => ({ ...prev, customer: { ...prev.customer, nama: e.target.value } as any, customerId: '' }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Atau ketik manual jika belum terdaftar"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">Perihal / Subject</label>
                <input 
                  type="text"
                  value={formState.perihal}
                  onChange={e => setFormState(prev => ({ ...prev, perihal: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Project subject/title"
                />
              </div>

              {/* Items Section */}
              <div className="border-t border-slate-200 pt-6">
                <div className="flex gap-2 mb-4">
                  {(['materials', 'manpower', 'equipment', 'consumables'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {(formState[activeTab] || []).map((item: any) => (
                    <div key={item.id} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl">
                      <input 
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(activeTab, item.id, { description: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Description"
                      />
                      <input 
                        type="number"
                        value={item.qty}
                        onChange={e => updateItem(activeTab, item.id, { qty: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Qty"
                      />
                      <input 
                        type="text"
                        value={item.unit}
                        onChange={e => updateItem(activeTab, item.id, { unit: e.target.value })}
                        className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unit"
                      />
                      <input 
                        type="number"
                        value={item.unitPrice}
                        onChange={e => updateItem(activeTab, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="w-36 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unit Price"
                      />
                      <div className="w-40 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm font-black text-blue-600">
                        {formatCurrency(item.total)}
                      </div>
                      <button 
                        onClick={() => removeItem(activeTab, item.id)}
                        className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => handleAddItem(activeTab)}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all"
                  >
                    + Add {activeTab} Item
                  </button>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest">Grand Total</span>
                  <span className="text-2xl font-black">{formatCurrency(calculateGrandTotal(formState))}</span>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveQuotation}
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} /> {isSubmitting ? 'Menyimpan...' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
