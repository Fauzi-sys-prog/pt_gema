import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
import {
  Receipt,
  Plus,
  X,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  FileText,
  TrendingUp,
  DollarSign,
  Image as ImageIcon,
  Trash2,
  Edit,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function TambahanBiayaProyekPage() {
  const {
    expenseList,
    vendorList,
    projectList,
    poList,
    addExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    addVendor,
    updateVendor,
    deleteVendor,
    currentUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'vendors' | 'dashboard'>('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ bank: 'BCA PT Gema Teknik Perkasa', noBukti: '', tanggal: new Date().toISOString().split('T')[0] });
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [isEditMode, setIsEditMode] = useState(false);
  const [rejectModalTarget, setRejectModalTarget] = useState<any>(null);
  const [rejectModalReason, setRejectModalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kwitansiPreview, setKwitansiPreview] = useState<string>('');

  type SectionItem = { id: string; keterangan: string; subKeterangan: string; qty: number; satuan: string; hargaUnit: number; hargaJualUnit: number; totalHPP: number; hargaJual: number; margin: number };
  type Section = { id: string; nama: string; items: SectionItem[] };
  const [sections, setSections] = useState<Section[]>([{ id: 'sec-1', nama: 'Jasa Kerja', items: [] }]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'sec-1': true });
  const [ppnRate, setPpnRate] = useState(0);
  const [selectedPoId, setSelectedPoId] = useState('');

  const [expenseForm, setExpenseForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    vendorId: '',
    penerima: '',
    projectId: '',
    rabItemId: '',
    kategori: 'Material' as any,
    costRecognition: 'DIRECT_PROJECT' as const,
    keterangan: '',
    nominal: 0,
    ppn: 0,
    metodeBayar: 'Transfer' as any,
    bank: 'BCA',
    bankLainnya: '',
    noKwitansi: '',
    remark: ''
  });

  const [vendorForm, setVendorForm] = useState({
    kodeVendor: '',
    namaVendor: '',
    kategori: 'Material' as any,
    alamat: '',
    kontak: '',
    telepon: '',
    email: '',
    npwp: '',
    paymentTerms: '',
    rating: 5
  });

  useEscapeKey([
    { condition: showExpenseModal, close: () => setShowExpenseModal(false) },
    { condition: showVendorModal, close: () => setShowVendorModal(false) },
    { condition: showPreviewModal, close: () => setShowPreviewModal(false) },
    { condition: showPayModal, close: () => setShowPayModal(false) },
  ]);

  const generateExpenseNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const todayExpenses = expenseList.filter(e => e.tanggal.startsWith(`${year}-${month}`));
    const nextNum = String(todayExpenses.length + 1).padStart(3, '0');
    return `EXP/${year}/${month}/${nextNum}`;
  };

  const generateVendorCode = () => {
    const nextNum = String(vendorList.length + 1).padStart(3, '0');
    return `VND-${nextNum}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error('File terlalu besar! Maksimal 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setKwitansiPreview(reader.result as string);
        toast.success('Kwitansi berhasil di-upload!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitExpense = async () => {
    if (isSubmitting) return;
    const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
    const hasInvalidItems = sections.some(sec => sec.items.some(item =>
      !item.keterangan || item.qty <= 0 || item.hargaUnit <= 0
    ));
    if (!expenseForm.projectId || (!expenseForm.vendorId && !expenseForm.penerima.trim()) || !expenseForm.keterangan || totalItems === 0 || hasInvalidItems) {
      const message = !expenseForm.projectId
        ? 'Project wajib dipilih.'
        : (!expenseForm.vendorId && !expenseForm.penerima.trim())
          ? 'Pilih vendor atau isi nama penerima.'
          : totalItems === 0
            ? 'Tambahkan minimal 1 item ke dalam rincian.'
            : hasInvalidItems
              ? 'Lengkapi keterangan, qty, dan harga biaya setiap item.'
              : 'Lengkapi semua field yang diperlukan.';
      toast.error(message); return;
    }
    const vendor = vendorList.find(v => v.id === expenseForm.vendorId);
    const project = projectList.find(p => p.id === expenseForm.projectId);
    const rabItem = project?.boq?.find((item: any) => item.itemKode === expenseForm.rabItemId);
    const { totalHPP, ppnAmount, grandTotal } = calcSectionTotals();
    const nominal = totalHPP;
    const ppn = ppnAmount;
    const totalNominal = grandTotal;
    const newExpense = {
      id: 'EXP-' + Date.now(),
      noExpense: generateExpenseNumber(),
      tanggal: expenseForm.tanggal,
      vendorId: expenseForm.vendorId,
      vendorName: vendor?.namaVendor || expenseForm.penerima.trim(),
      penerima: expenseForm.penerima.trim() || vendor?.namaVendor || undefined,
      projectId: expenseForm.projectId || undefined,
      projectName: project?.namaProject || undefined,
      rabItemId: expenseForm.rabItemId || undefined,
      rabItemName: rabItem?.materialName || undefined,
      kategori: expenseForm.kategori,
      costRecognition: expenseForm.costRecognition,
      keterangan: expenseForm.keterangan,
      nominal,
      ppn,
      totalNominal,
      sections,
      hasKwitansi: !!kwitansiPreview,
      kwitansiUrl: kwitansiPreview || undefined,
      noKwitansi: expenseForm.noKwitansi || undefined,
      metodeBayar: expenseForm.metodeBayar,
      bank: expenseForm.bank === 'Lainnya' ? expenseForm.bankLainnya : expenseForm.bank,
      status: 'Pending Approval' as any,
      remark: expenseForm.remark || undefined,
      createdBy: currentUser?.fullName || 'Admin',
      createdAt: new Date().toISOString()
    };
    setIsSubmitting(true);
    try {
      if (isEditMode && selectedExpense) {
        await updateExpense(selectedExpense.id, {
          ...expenseForm,
          vendorName: vendor?.namaVendor || expenseForm.penerima.trim(),
          penerima: expenseForm.penerima.trim() || vendor?.namaVendor || undefined,
          projectName: project?.namaProject || undefined,
          nominal,
          ppn,
          totalNominal,
          sections,
          hasKwitansi: !!kwitansiPreview,
          kwitansiUrl: kwitansiPreview || undefined
        });
        toast.success('Expense berhasil diupdate!');
      } else {
        await addExpense(newExpense);
        toast.success('Expense berhasil ditambahkan!');
      }
      resetExpenseForm();
      setShowExpenseModal(false);
    } catch (err) {
      toast.error('Gagal menyimpan biaya: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVendor = () => {
    if (!vendorForm.namaVendor) { toast.error('Nama vendor harus diisi!'); return; }
    addVendor({
      id: 'V-' + Date.now(),
      kodeVendor: vendorForm.kodeVendor || generateVendorCode(),
      namaVendor: vendorForm.namaVendor,
      kategori: vendorForm.kategori,
      alamat: vendorForm.alamat || undefined,
      kontak: vendorForm.kontak || undefined,
      telepon: vendorForm.telepon || undefined,
      email: vendorForm.email || undefined,
      npwp: vendorForm.npwp || undefined,
      paymentTerms: vendorForm.paymentTerms || undefined,
      status: 'Active' as any,
      rating: vendorForm.rating || 5,
      createdAt: new Date().toISOString()
    });
    toast.success('Vendor berhasil ditambahkan!');
    resetVendorForm();
    setShowVendorModal(false);
  };

  const resetExpenseForm = () => {
    setExpenseForm({ tanggal: new Date().toISOString().split('T')[0], vendorId: '', penerima: '', projectId: '', rabItemId: '', kategori: 'Material', costRecognition: 'DIRECT_PROJECT', keterangan: '', nominal: 0, ppn: 0, metodeBayar: 'Transfer', bank: 'BCA', bankLainnya: '', noKwitansi: '', remark: '' });
    setSections([{ id: 'sec-1', nama: 'Jasa Kerja', items: [] }]);
    setExpandedSections({ 'sec-1': true });
    setPpnRate(0);
    setSelectedPoId('');
    setKwitansiPreview('');
    setIsEditMode(false);
    setSelectedExpense(null);
  };

  const resetVendorForm = () => {
    setVendorForm({ kodeVendor: '', namaVendor: '', kategori: 'Material', alamat: '', kontak: '', telepon: '', email: '', npwp: '', paymentTerms: '', rating: 5 });
  };

  // Section helpers
  const addSection = () => {
    const id = `sec-${Date.now()}`;
    setSections(prev => [...prev, { id, nama: 'Section Baru', items: [] }]);
    setExpandedSections(prev => ({ ...prev, [id]: true }));
  };
  const updateSectionName = (secId: string, nama: string) => setSections(prev => prev.map(s => s.id === secId ? { ...s, nama } : s));
  const deleteSection = (secId: string) => setSections(prev => prev.filter(s => s.id !== secId));
  const addItem = (secId: string) => {
    const newItem: SectionItem = { id: `item-${Date.now()}`, keterangan: '', subKeterangan: '', qty: 1, satuan: 'Lot', hargaUnit: 0, hargaJualUnit: 0, totalHPP: 0, hargaJual: 0, margin: 0 };
    setSections(prev => prev.map(s => s.id === secId ? { ...s, items: [...s.items, newItem] } : s));
  };
  const updateItemField = (secId: string, itemId: string, field: string, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== secId) return s;
      return {
        ...s,
        items: s.items.map(item => {
          if (item.id !== itemId) return item;
          const updated: any = { ...item, [field]: value };
          const qty = updated.qty || 0;
          const hpp = updated.hargaUnit || 0;
          const jualUnit = updated.hargaJualUnit || 0;
          updated.totalHPP = qty * hpp;
          updated.hargaJual = qty * jualUnit;
          updated.margin = updated.hargaJual > 0 ? ((updated.hargaJual - updated.totalHPP) / updated.hargaJual) * 100 : 0;
          return updated;
        })
      };
    }));
  };
  const deleteItem = (secId: string, itemId: string) => setSections(prev => prev.map(s => s.id === secId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s));

  const calcSectionTotals = () => {
    let totalHPP = 0;
    sections.forEach(sec => sec.items.forEach(item => {
      totalHPP += (item.hargaUnit || 0) * (item.qty || 0);
    }));
    const ppnAmount = totalHPP * (ppnRate / 100);
    return { totalHPP, ppnAmount, grandTotal: totalHPP + ppnAmount };
  };

  const handleLoadFromPO = (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) return;
    const po = (poList || []).find(p => p.id === poId);
    if (!po) return;
    const items: SectionItem[] = (po.items || []).map((item: any, idx: number) => ({
      id: `item-po-${Date.now()}-${idx}`,
      keterangan: item.nama || item.description || '',
      subKeterangan: item.kode ? `Kode: ${item.kode}` : '',
      qty: item.qty || 1,
      satuan: item.unit || item.satuan || 'pcs',
      hargaUnit: item.harga || 0,
      hargaJualUnit: item.harga || 0,
      totalHPP: (item.qty || 1) * (item.harga || 0),
      hargaJual: (item.qty || 1) * (item.harga || 0),
      margin: 0,
    }));
    const secId = `sec-po-${Date.now()}`;
    setSections([{ id: secId, nama: `PO: ${po.noPO}`, items }]);
    setExpandedSections({ [secId]: true });
    if (po.projectId && !expenseForm.projectId) {
      setExpenseForm(prev => ({ ...prev, projectId: po.projectId || '' }));
    }
    toast.success(`Data dari PO ${po.noPO} berhasil dimuat!`);
  };

  const filteredExpenses = expenseList.filter(exp => {
    const matchSearch = exp.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exp.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exp.noExpense.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || exp.status === filterStatus;
    const matchProject = filterProject === 'All' || exp.projectId === filterProject;
    return matchSearch && matchStatus && matchProject;
  });

  const totalExpenses = expenseList.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const pendingExpenses = expenseList.filter(e => e.status === 'Pending Approval');
  const approvedExpenses = expenseList.filter(e => e.status === 'Approved');
  const paidExpenses = expenseList.filter(e => e.status === 'Paid');
  const totalPending = pendingExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const totalApproved = approvedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);

  const expenseByCategory = expenseList.reduce((acc, exp) => {
    acc[exp.kategori] = (acc[exp.kategori] || 0) + exp.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  const expenseByProject = expenseList.reduce((acc, exp) => {
    if (exp.projectId) {
      acc[exp.projectName || 'Unknown'] = (acc[exp.projectName || 'Unknown'] || 0) + exp.totalNominal;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">Realisasi & Tambahan Biaya Proyek</h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Pencatatan biaya tambahan di luar BOQ selama proyek berjalan</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {activeTab === 'expenses' && (
                <button
                  onClick={() => { resetExpenseForm(); setShowExpenseModal(true); }}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold shadow-md text-xs sm:text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Tambah Biaya</span>
                  <span className="sm:hidden">Tambah</span>
                </button>
              )}
              {activeTab === 'vendors' && (
                <button
                  onClick={() => { resetVendorForm(); setShowVendorModal(true); }}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold shadow-md text-xs sm:text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Tambah Vendor</span>
                  <span className="sm:hidden">Tambah</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 sm:mt-6 overflow-x-auto hide-scrollbar pb-1">
            {(['expenses', 'dashboard'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'expenses' && <><Receipt className="w-4 h-4 inline mr-2 flex-shrink-0" />Biaya</>}
                {tab === 'dashboard' && <><TrendingUp className="w-4 h-4 inline mr-2 flex-shrink-0" />Dashboard</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-6 lg:p-8">

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wide truncate">Total Biaya</p>
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 break-words">Rp {totalExpenses.toLocaleString('id-ID')}</p>
                <p className="text-xs text-slate-500 mt-1">{expenseList.length} transaksi</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 sm:p-6 border border-amber-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-wide truncate">Pending Approval</p>
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-900 break-words">Rp {totalPending.toLocaleString('id-ID')}</p>
                <p className="text-xs text-amber-600 mt-1">{pendingExpenses.length} items</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-blue-700 uppercase tracking-wide truncate">Approved</p>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-blue-900 break-words">Rp {totalApproved.toLocaleString('id-ID')}</p>
                <p className="text-xs text-blue-600 mt-1">{approvedExpenses.length} items</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 sm:p-6 border border-emerald-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-emerald-700 uppercase tracking-wide truncate">Paid</p>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-900 break-words">Rp {totalPaid.toLocaleString('id-ID')}</p>
                <p className="text-xs text-emerald-600 mt-1">{paidExpenses.length} items</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                    <Search className="w-4 h-4 inline mr-2" />Search
                  </label>
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari vendor, keterangan, atau no expense..."
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                    <Filter className="w-4 h-4 inline mr-2" />Status
                  </label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm">
                    <option value="All">Semua Status</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Paid">Paid</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                    <Filter className="w-4 h-4 inline mr-2" />Project
                  </label>
                  <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm">
                    <option value="All">Semua Project</option>
                    {projectList.map(p => <option key={p.id} value={p.id}>{p.namaProject}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">No Expense</th>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Tanggal</th>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Vendor/Penerima</th>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Project</th>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Kategori</th>
                      <th className="px-4 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Keterangan</th>
                      <th className="px-4 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-wider">Subtotal</th>
                      <th className="px-4 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-wider">PPN</th>
                      <th className="px-4 py-4 text-right text-xs font-black text-emerald-700 uppercase tracking-wider">Grand Total</th>
                      <th className="px-4 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Kwitansi</th>
                      <th className="px-4 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center">
                          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">Belum ada data</p>
                          <p className="text-sm text-slate-400 mt-1">Klik "Tambah Biaya" untuk mulai mencatat</p>
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4"><p className="font-bold text-slate-900 text-sm">{expense.noExpense}</p></td>
                          <td className="px-4 py-4"><p className="text-sm text-slate-600">{new Date(expense.tanggal).toLocaleDateString('id-ID')}</p></td>
                          <td className="px-4 py-4"><p className="font-bold text-slate-900 text-sm">{expense.vendorName}</p></td>
                          <td className="px-4 py-4"><p className="text-sm text-slate-600">{expense.projectName || '-'}</p></td>
                          <td className="px-4 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">{expense.kategori}</span></td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-700 max-w-xs truncate">{expense.keterangan}</p>
                            {(expense as any).sections?.length > 0 && (
                              <p className="text-xs text-slate-400 mt-0.5">{(expense as any).sections.reduce((s: number, sec: any) => s + sec.items.length, 0)} item(s)</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-semibold text-slate-600 text-sm">Rp {expense.nominal.toLocaleString('id-ID')}</p>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-semibold text-slate-600 text-sm">Rp {(expense.ppn || 0).toLocaleString('id-ID')}</p>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-black text-emerald-700 text-sm">Rp {expense.totalNominal.toLocaleString('id-ID')}</p>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              expense.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                              expense.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              expense.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                              expense.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>{expense.status}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {expense.hasKwitansi ? (
                              <button onClick={() => { setSelectedExpense(expense); setShowPreviewModal(true); }} className="text-emerald-600 hover:text-emerald-700 font-bold">
                                <ImageIcon className="w-5 h-5 inline" />
                              </button>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              {expense.status === 'Pending Approval' && (
                                <>
                                  <button onClick={async () => {
                                    if (processingId) return;
                                    setProcessingId(expense.id);
                                    try {
                                      await approveExpense(expense.id, currentUser?.fullName || 'Admin');
                                    } catch (err) {
                                      toast.error('Gagal approve: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                    } finally {
                                      setProcessingId(null);
                                    }
                                  }}
                                    disabled={processingId === expense.id}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Approve">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => { setRejectModalTarget(expense); setRejectModalReason(''); }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Reject">
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {expense.status === 'Approved' && (
                                <button
                                  onClick={() => { setSelectedExpense(expense); setPayForm({ bank: 'BCA PT Gema Teknik Perkasa', noBukti: '', tanggal: new Date().toISOString().split('T')[0] }); setShowPayModal(true); }}
                                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"
                                >Mark as Paid</button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedExpense(expense);
                                  setExpenseForm({ tanggal: expense.tanggal, vendorId: expense.vendorId, penerima: expense.penerima || (!expense.vendorId ? expense.vendorName : ''), projectId: expense.projectId || '', rabItemId: expense.rabItemId || '', kategori: expense.kategori, keterangan: expense.keterangan, nominal: expense.nominal, ppn: expense.ppn || 0, metodeBayar: expense.metodeBayar, noKwitansi: expense.noKwitansi || '', remark: expense.remark || '', bank: expense.bank || 'BCA', bankLainnya: '' });
                                  if ((expense as any).sections?.length > 0) {
                                    setSections((expense as any).sections);
                                    const expMap: Record<string, boolean> = {};
                                    (expense as any).sections.forEach((s: any) => { expMap[s.id] = true; });
                                    setExpandedSections(expMap);
                                  } else {
                                    setSections([{ id: 'sec-1', nama: 'Jasa Kerja', items: [] }]);
                                    setExpandedSections({ 'sec-1': true });
                                  }
                                  setKwitansiPreview(expense.kwitansiUrl || '');
                                  setIsEditMode(true);
                                  setShowExpenseModal(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (processingId) return;
                                  if (!confirm('Hapus expense ini?')) return;
                                  setProcessingId(expense.id);
                                  try {
                                    await deleteExpense(expense.id);
                                    toast.success('Expense berhasil dihapus!');
                                  } catch (err) {
                                    toast.error('Gagal menghapus expense: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                  } finally {
                                    setProcessingId(null);
                                  }
                                }}
                                disabled={processingId === expense.id}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VENDORS TAB */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Vendors</p>
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-black text-slate-900">{vendorList.length}</p>
                <p className="text-xs text-slate-500 mt-1">{vendorList.filter(v => v.status === 'Active').length} active</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Top Category</p>
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xl font-black text-slate-900">
                  {Object.entries(vendorList.reduce((acc, v) => { acc[v.kategori] = (acc[v.kategori] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Avg Rating</p>
                  <CheckCircle className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {(vendorList.reduce((sum, v) => sum + (v.rating || 0), 0) / vendorList.length || 0).toFixed(1)} ⭐
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Kode</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Nama Vendor</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Kontak</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Telepon</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vendorList.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><p className="font-bold text-slate-900 text-sm">{vendor.kodeVendor}</p></td>
                        <td className="px-6 py-4"><p className="font-bold text-slate-900">{vendor.namaVendor}</p><p className="text-xs text-slate-500">{vendor.alamat}</p></td>
                        <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{vendor.kategori}</span></td>
                        <td className="px-6 py-4"><p className="text-sm text-slate-600">{vendor.kontak || '-'}</p></td>
                        <td className="px-6 py-4"><p className="text-sm text-slate-600">{vendor.telepon || '-'}</p></td>
                        <td className="px-6 py-4 text-center"><p className="text-sm font-bold text-amber-600">{vendor.rating || 5} ⭐</p></td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${vendor.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{vendor.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { updateVendor(vendor.id, { status: vendor.status === 'Active' ? 'Inactive' : 'Active' }); toast.success(`Vendor ${vendor.status === 'Active' ? 'dinonaktifkan' : 'diaktifkan'}!`); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => { if (confirm('Hapus vendor ini?')) { deleteVendor(vendor.id); toast.success('Vendor berhasil dihapus!'); } }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Biaya</p>
                <p className="text-3xl font-black text-slate-900">Rp {totalExpenses.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Vendors</p>
                <p className="text-3xl font-black text-slate-900">{vendorList.length}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Pending Approval</p>
                <p className="text-3xl font-black text-amber-600">{pendingExpenses.length}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Active Projects</p>
                <p className="text-3xl font-black text-slate-900">{new Set(expenseList.filter(e => e.projectId).map(e => e.projectId)).size}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Biaya per Kategori</h3>
              <div className="space-y-3">
                {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => {
                  const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-700">{category}</p>
                        <p className="text-sm font-black text-slate-900">Rp {amount.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{pct.toFixed(1)}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Biaya per Project</h3>
              <div className="space-y-3">
                {Object.entries(expenseByProject).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([projectName, amount]) => {
                  const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={projectName}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-700">{projectName}</p>
                        <p className="text-sm font-black text-slate-900">Rp {amount.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{pct.toFixed(1)}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Top Vendors by Spending</h3>
              <div className="space-y-3">
                {Object.entries(expenseList.reduce((acc, exp) => { acc[exp.vendorName] = (acc[exp.vendorName] || 0) + exp.totalNominal; return acc; }, {} as Record<string, number>))
                  .sort((a, b) => b[1] - a[1]).slice(0, 5)
                  .map(([vendorName, amount], index) => (
                    <div key={vendorName} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-black text-sm">#{index + 1}</div>
                        <p className="font-bold text-slate-900">{vendorName}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-600">Rp {amount.toLocaleString('id-ID')}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EXPENSE MODAL */}
      {showExpenseModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowExpenseModal(false)}>
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between border-b border-emerald-600 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{isEditMode ? 'Edit' : 'Tambah'} Biaya</h2>
                  <p className="text-sm text-emerald-100">Input detail tambahan biaya proyek</p>
                </div>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal</label>
                  <input type="date" value={expenseForm.tanggal} onChange={(e) => setExpenseForm({ ...expenseForm, tanggal: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vendor/Penerima *</label>
                  <select value={expenseForm.vendorId} onChange={(e) => setExpenseForm({ ...expenseForm, vendorId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="">Non-vendor / penerima langsung</option>
                    {vendorList.filter(v => v.status === 'Active').map(v => <option key={v.id} value={v.id}>{v.namaVendor}</option>)}
                  </select>
                  {!expenseForm.vendorId && (
                    <input
                      type="text"
                      value={expenseForm.penerima}
                      onChange={(e) => setExpenseForm({ ...expenseForm, penerima: e.target.value })}
                      placeholder="Nama penerima, toko, atau kas operasional"
                      className="w-full mt-2 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Project *</label>
                  <select value={expenseForm.projectId} onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value, rabItemId: '' })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="">Pilih project</option>
                    {projectList.map(p => <option key={p.id} value={p.id}>{p.namaProject}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">RAB/BOQ Item {expenseForm.projectId && <span className="text-emerald-600 text-xs">🔗</span>}</label>
                  <select value={expenseForm.rabItemId} onChange={(e) => setExpenseForm({ ...expenseForm, rabItemId: e.target.value })}
                    disabled={!expenseForm.projectId}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100">
                    <option value="">Pilih RAB Item (Optional)</option>
                    {expenseForm.projectId && projectList.find(p => p.id === expenseForm.projectId)?.boq?.map((item: any) => (
                      <option key={item.itemKode} value={item.itemKode}>{item.materialName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Kategori Biaya *</label>
                <select
                  value={expenseForm.kategori}
                  onChange={(e) => setExpenseForm({ ...expenseForm, kategori: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {[
                    'Material', 'Jasa/Service', 'Gaji/Manpower', 'Kasbon',
                    'Consumable', 'Hand Tool', 'Safety', 'Equipment',
                    'Mob-Demob', 'Penginapan', 'Makan', 'Transport',
                    'Asuransi/MCU', 'Biaya Lain'
                  ].map(category => <option key={category} value={category}>{category}</option>)}
                </select>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Kategori ini otomatis direkap di Detail Project.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Bank</label>
                <select value={expenseForm.bank} onChange={(e) => setExpenseForm({ ...expenseForm, bank: e.target.value, metodeBayar: e.target.value === 'Cash' ? 'Cash' : 'Transfer' })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                  {['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN','Cash','Lainnya'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {expenseForm.bank === 'Lainnya' && (
                  <input type="text" placeholder="Nama bank..." value={expenseForm.bankLainnya} onChange={(e) => setExpenseForm({ ...expenseForm, bankLainnya: e.target.value })}
                    className="w-full mt-2 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm" />
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Keterangan *</label>
                <textarea value={expenseForm.keterangan} onChange={(e) => setExpenseForm({ ...expenseForm, keterangan: e.target.value })}
                  rows={2} placeholder="Detail pengeluaran..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>

              {/* Import from PO */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Import dari Purchase Order <span className="font-normal text-blue-600 text-xs">(opsional — items bisa diedit)</span>
                </label>
                <select value={selectedPoId} onChange={(e) => handleLoadFromPO(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm">
                  <option value="">-- Pilih PO (opsional) --</option>
                  {(poList || []).map(po => (
                    <option key={po.id} value={po.id}>{po.noPO} — {po.supplier}</option>
                  ))}
                </select>
                {selectedPoId && <p className="text-xs text-blue-600 mt-1">✓ Data PO dimuat. Semua item masih bisa diedit.</p>}
              </div>

              {/* Sections + Item Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-slate-700">Rincian Item *</label>
                  <button type="button" onClick={addSection}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tambah Section
                  </button>
                </div>

                {sections.map(sec => (
                  <div key={sec.id} className="border border-slate-200 rounded-xl mb-3 overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 border-b border-slate-200">
                      <input
                        type="text"
                        value={sec.nama}
                        onChange={e => updateSectionName(sec.id, e.target.value)}
                        className="flex-1 bg-transparent font-bold text-slate-800 text-sm border-none outline-none"
                      />
                      <button type="button" onClick={() => setExpandedSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                        className="p-1 text-slate-500 hover:text-slate-700">
                        {expandedSections[sec.id] === false ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {sections.length > 1 && (
                        <button type="button" onClick={() => deleteSection(sec.id)} className="p-1 text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {expandedSections[sec.id] !== false && (
                      <div className="p-3 bg-white">
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left p-2 text-[11px] font-semibold text-gray-600 w-6">No</th>
                                <th className="text-left p-2 text-[11px] font-semibold text-gray-600">Keterangan</th>
                                <th className="text-center p-2 text-[11px] font-semibold text-gray-600 w-16">Qty</th>
                                <th className="text-center p-2 text-[11px] font-semibold text-gray-600 w-20">Satuan</th>
                                <th className="text-right p-2 text-[11px] font-semibold text-gray-600 w-32">Harga Biaya/Unit</th>
                                <th className="text-right p-2 text-[11px] font-semibold text-emerald-700 w-32">Subtotal</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sec.items.map((item, itemIdx) => (
                                <tr key={item.id} className="border-t border-gray-100 align-top">
                                  <td className="p-2 text-gray-400 text-xs text-center pt-3">{itemIdx + 1}</td>
                                  <td className="p-2">
                                    <input type="text" value={item.keterangan}
                                      onChange={e => updateItemField(sec.id, item.id, 'keterangan', e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                                      placeholder="Keterangan item..." />
                                    <textarea value={item.subKeterangan}
                                      onChange={e => updateItemField(sec.id, item.id, 'subKeterangan', e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-500 resize-none"
                                      rows={1} placeholder="Spesifikasi / catatan (opsional)..." />
                                  </td>
                                  <td className="p-2">
                                    <input type="number" value={item.qty}
                                      onChange={e => updateItemField(sec.id, item.id, 'qty', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center" />
                                  </td>
                                  <td className="p-2">
                                    <input type="text" value={item.satuan}
                                      onChange={e => updateItemField(sec.id, item.id, 'satuan', e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                      placeholder="Lot" />
                                  </td>
                                  <td className="p-2">
                                    <input type="number" value={item.hargaUnit || ''}
                                      onChange={e => updateItemField(sec.id, item.id, 'hargaUnit', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right bg-gray-50"
                                      placeholder="0" />
                                  </td>
                                  <td className="p-2 text-right text-xs font-semibold text-emerald-700 pt-3">
                                    {((item.hargaUnit || 0) * (item.qty || 0)).toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-2 pt-3">
                                    <button type="button" onClick={() => deleteItem(sec.id, item.id)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {sec.items.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="p-4 text-center text-gray-400 text-sm italic">
                                    Belum ada item. Klik "Tambah Item" untuk menambahkan.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            {sec.items.length > 0 && (
                              <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50">
                                  <td colSpan={5} className="p-2 text-right text-xs font-bold text-gray-600 uppercase">Subtotal {sec.nama}</td>
                                  <td className="p-2 text-right text-xs font-bold text-emerald-700">
                                    {sec.items.reduce((s, i) => s + (i.hargaUnit || 0) * (i.qty || 0), 0).toLocaleString('id-ID')}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                        <button type="button" onClick={() => addItem(sec.id)}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Tambah Item
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* PPN + Grand Total */}
              {(() => {
                const { totalHPP, ppnAmount, grandTotal } = calcSectionTotals();
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal Biaya:</span>
                      <span className="font-semibold text-slate-700">Rp {totalHPP.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">PPN:</span>
                        <input type="number" min={0} max={100} value={ppnRate}
                          onChange={e => setPpnRate(parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center" />
                        <span className="text-slate-600">%</span>
                      </div>
                      <span className="font-semibold text-slate-600">Rp {ppnAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-300 flex justify-between">
                      <span className="font-black text-slate-800">Grand Total Biaya:</span>
                      <span className="font-black text-lg text-emerald-700">Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                );
              })()}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">No Kwitansi (Optional)</label>
                <input type="text" value={expenseForm.noKwitansi} onChange={(e) => setExpenseForm({ ...expenseForm, noKwitansi: e.target.value })}
                  placeholder="Optional" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Upload Kwitansi (Optional)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  {kwitansiPreview ? (
                    <div className="space-y-3">
                      <img src={kwitansiPreview} alt="Kwitansi Preview" className="max-h-48 mx-auto rounded-lg shadow-md" />
                      <button onClick={() => setKwitansiPreview('')}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-bold text-sm">
                        <Trash2 className="w-4 h-4 inline mr-2" />Hapus Kwitansi
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-600 font-medium mb-2">Upload foto kwitansi</p>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-bold text-sm">Pilih File</button>
                      <p className="text-xs text-slate-400 mt-2">Max 5MB (JPG, PNG)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowExpenseModal(false)} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-bold">Batal</button>
              <button onClick={handleSubmitExpense} disabled={isSubmitting} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle className="w-4 h-4 inline mr-2" />{isSubmitting ? 'Menyimpan...' : `${isEditMode ? 'Update' : 'Simpan'} Biaya`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* VENDOR MODAL */}
      {showVendorModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowVendorModal(false)}>
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 flex items-center justify-between border-b border-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
                <div>
                  <h2 className="text-xl font-black text-white">Tambah Vendor Baru</h2>
                  <p className="text-sm text-blue-100">Registrasi vendor untuk expense tracking</p>
                </div>
              </div>
              <button onClick={() => setShowVendorModal(false)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kode Vendor</label>
                  <input type="text" value={vendorForm.kodeVendor} onChange={(e) => setVendorForm({ ...vendorForm, kodeVendor: e.target.value })}
                    placeholder="Auto-generate jika kosong" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Vendor *</label>
                  <input type="text" value={vendorForm.namaVendor} onChange={(e) => setVendorForm({ ...vendorForm, namaVendor: e.target.value })}
                    placeholder="Nama vendor" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kategori</label>
                  <select value={vendorForm.kategori} onChange={(e) => setVendorForm({ ...vendorForm, kategori: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {['Material','Jasa','Equipment','Transport','Lainnya'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Rating</label>
                  <select value={vendorForm.rating} onChange={(e) => setVendorForm({ ...vendorForm, rating: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                    <option value={4.5}>⭐⭐⭐⭐ (4.5)</option>
                    <option value={4}>⭐⭐⭐⭐ (4)</option>
                    <option value={3.5}>⭐⭐⭐ (3.5)</option>
                    <option value={3}>⭐⭐⭐ (3)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Alamat</label>
                <textarea value={vendorForm.alamat} onChange={(e) => setVendorForm({ ...vendorForm, alamat: e.target.value })}
                  rows={2} placeholder="Alamat vendor" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kontak Person</label>
                  <input type="text" value={vendorForm.kontak} onChange={(e) => setVendorForm({ ...vendorForm, kontak: e.target.value })}
                    placeholder="Nama contact person" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Telepon</label>
                  <input type="text" value={vendorForm.telepon} onChange={(e) => setVendorForm({ ...vendorForm, telepon: e.target.value })}
                    placeholder="08xxxxxxxxxx" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                  <input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    placeholder="vendor@email.com" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">NPWP</label>
                  <input type="text" value={vendorForm.npwp} onChange={(e) => setVendorForm({ ...vendorForm, npwp: e.target.value })}
                    placeholder="00.000.000.0-000.000" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Payment Terms</label>
                <input type="text" value={vendorForm.paymentTerms} onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}
                  placeholder="e.g., Net 30, COD, Net 14" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowVendorModal(false)} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-bold">Batal</button>
              <button onClick={handleSubmitVendor} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-bold">
                <CheckCircle className="w-4 h-4 inline mr-2" />Simpan Vendor
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* KWITANSI PREVIEW */}
      {showPreviewModal && selectedExpense && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}>
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Preview Kwitansi</h3>
                <p className="text-sm text-slate-300">{selectedExpense.noExpense} - {selectedExpense.vendorName}</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(90vh-100px)] overflow-y-auto">
              {selectedExpense.kwitansiUrl ? (
                <img src={selectedExpense.kwitansiUrl} alt="Kwitansi" className="w-full rounded-lg shadow-lg" />
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Tidak ada kwitansi</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* PAY MODAL */}
      {showPayModal && selectedExpense && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-600">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">Konfirmasi Pembayaran</h3>
                <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">{selectedExpense.noExpense}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</p>
                <p className="text-sm font-black text-slate-900">{selectedExpense.vendorName}</p>
                <p className="text-xl font-black text-emerald-600 mt-2">Rp {(selectedExpense.totalNominal || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Bayar</label>
                <input type="date" value={payForm.tanggal} onChange={(e) => setPayForm({...payForm, tanggal: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Pembayaran</label>
                <select value={payForm.bank} onChange={(e) => setPayForm({...payForm, bank: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all appearance-none">
                  <option value="BCA PT Gema Teknik Perkasa">BCA PT Gema Teknik Perkasa</option>
                  <option value="BNI">BNI</option>
                  <option value="Mandiri">Mandiri</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Bukti Transfer (opsional)</label>
                <input type="text" placeholder="Contoh: TRF/2026/001" value={payForm.noBukti} onChange={(e) => setPayForm({...payForm, noBukti: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all" />
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button onClick={() => setShowPayModal(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Batal</button>
              <button onClick={async () => {
                if (isSubmitting) return;
                setIsSubmitting(true);
                try {
                  await updateExpense(selectedExpense.id, { status: 'Paid', paidAt: new Date(payForm.tanggal).toISOString(), bank: payForm.bank, noBuktiPay: payForm.noBukti || undefined });
                  toast.success('Pembayaran berhasil dicatat', { description: `${selectedExpense.vendorName} via ${payForm.bank}` });
                  setShowPayModal(false);
                } catch (err) {
                  toast.error('Gagal mencatat pembayaran: ' + (err instanceof Error ? err.message : 'Unknown error'));
                } finally {
                  setIsSubmitting(false);
                }
              }}
                disabled={isSubmitting}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle size={16} /> {isSubmitting ? 'Memproses...' : 'Konfirmasi Bayar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Tolak Expense</h3>
            <p className="text-sm text-gray-500 mb-4">{rejectModalTarget.vendorName}</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Penolakan *</label>
            <textarea rows={3} value={rejectModalReason} onChange={e => setRejectModalReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { if (!rejectModalReason.trim()) return; rejectExpense(rejectModalTarget.id, rejectModalReason.trim()); setRejectModalTarget(null); setRejectModalReason(''); }}
                disabled={!rejectModalReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-40">Tolak</button>
              <button onClick={() => { setRejectModalTarget(null); setRejectModalReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
