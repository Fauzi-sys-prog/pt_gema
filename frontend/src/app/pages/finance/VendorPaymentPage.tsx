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
  TrendingDown,
  DollarSign,
  Image as ImageIcon,
  Trash2,
  Edit,
  Eye,
  Filter,
  Search,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadExpenseReportWord } from '../../components/VendorPaymentWordExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function VendorPaymentPage() {
  const { 
    expenseList, 
    vendorList, 
    projectList,
    addExpense, 
    updateExpense, 
    deleteExpense,
    approveExpense,
    rejectExpense,
    addVendor,
    updateVendor,
    deleteVendor,
    currentUser,
    addAuditLog
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

  const [expenseForm, setExpenseForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    vendorId: '',
    projectId: '',
    rabItemId: '',
    kategori: 'Material' as any,
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


  // Generate expense number
  const generateExpenseNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const todayExpenses = expenseList.filter(e => e.tanggal.startsWith(`${year}-${month}`));
    const nextNum = String(todayExpenses.length + 1).padStart(3, '0');
    return `EXP/${year}/${month}/${nextNum}`;
  };

  // Generate vendor code
  const generateVendorCode = () => {
    const nextNum = String(vendorList.length + 1).padStart(3, '0');
    return `VND-${nextNum}`;
  };

  // Handle file upload (kwitansi image)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File terlalu besar! Maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setKwitansiPreview(reader.result as string);
        toast.success('Kwitansi berhasil di-upload!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit expense
  const handleSubmitExpense = async () => {
    if (isSubmitting) return;
    if (!expenseForm.vendorId || !expenseForm.keterangan || expenseForm.nominal <= 0) {
      toast.error('Lengkapi semua field yang diperlukan!');
      return;
    }

    const vendor = vendorList.find(v => v.id === expenseForm.vendorId);
    const project = projectList.find(p => p.id === expenseForm.projectId);
    const rabItem = project?.boq?.find((item: any) => item.itemKode === expenseForm.rabItemId);
    const totalNominal = expenseForm.nominal + (expenseForm.ppn || 0);

    const newExpense = {
      id: 'EXP-' + Date.now(),
      noExpense: generateExpenseNumber(),
      tanggal: expenseForm.tanggal,
      vendorId: expenseForm.vendorId,
      vendorName: vendor?.namaVendor || '',
      projectId: expenseForm.projectId || undefined,
      projectName: project?.namaProject || undefined,
      rabItemId: expenseForm.rabItemId || undefined,
      rabItemName: rabItem?.materialName || undefined,
      kategori: expenseForm.kategori,
      keterangan: expenseForm.keterangan,
      nominal: expenseForm.nominal,
      ppn: expenseForm.ppn,
      totalNominal,
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
          vendorName: vendor?.namaVendor || '',
          projectName: project?.namaProject || undefined,
          totalNominal,
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
      toast.error('Gagal menyimpan expense: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit vendor
  const handleSubmitVendor = () => {
    if (!vendorForm.namaVendor) {
      toast.error('Nama vendor harus diisi!');
      return;
    }

    const newVendor = {
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
    };

    addVendor(newVendor);
    toast.success('Vendor berhasil ditambahkan!');
    resetVendorForm();
    setShowVendorModal(false);
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      tanggal: new Date().toISOString().split('T')[0],
      vendorId: '',
      projectId: '',
      rabItemId: '',
      kategori: 'Material',
      keterangan: '',
      nominal: 0,
      ppn: 0,
      metodeBayar: 'Transfer',
      bank: 'BCA',
      bankLainnya: '',
      noKwitansi: '',
      remark: ''
    });
    setKwitansiPreview('');
    setIsEditMode(false);
    setSelectedExpense(null);
  };

  const resetVendorForm = () => {
    setVendorForm({
      kodeVendor: '',
      namaVendor: '',
      kategori: 'Material',
      alamat: '',
      kontak: '',
      telepon: '',
      email: '',
      npwp: '',
      paymentTerms: '',
      rating: 5
    });
  };

  // Filter expenses
  const filteredExpenses = expenseList.filter(exp => {
    const matchSearch = exp.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exp.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exp.noExpense.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || exp.status === filterStatus;
    const matchProject = filterProject === 'All' || exp.projectId === filterProject;
    return matchSearch && matchStatus && matchProject;
  });

  // Calculate statistics
  const totalExpenses = expenseList.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const pendingExpenses = expenseList.filter(e => e.status === 'Pending Approval');
  const approvedExpenses = expenseList.filter(e => e.status === 'Approved');
  const paidExpenses = expenseList.filter(e => e.status === 'Paid');
  const totalPending = pendingExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const totalApproved = approvedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
  const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);

  // Expense by category
  const expenseByCategory = expenseList.reduce((acc, exp) => {
    acc[exp.kategori] = (acc[exp.kategori] || 0) + exp.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  // Expense by project
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
                <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">Vendor Payment & Expense Tracking</h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Track pengeluaran & monitor budget vs actual</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  if (expenseList.length === 0) {
                    toast.error('Belum ada data expense untuk di-export!');
                    return;
                  }
                  downloadExpenseReportWord(expenseList, projectList, vendorList);
                }}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-bold shadow-md shadow-blue-600/20 text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Export Report</span>
                <span className="sm:hidden">Export</span>
              </button>
              {activeTab === 'expenses' && (
                <button
                  onClick={() => {
                    resetExpenseForm();
                    setShowExpenseModal(true);
                  }}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold shadow-md text-xs sm:text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Tambah Expense</span>
                  <span className="sm:hidden">Tambah</span>
                </button>
              )}
              {activeTab === 'vendors' && (
                <button
                  onClick={() => {
                    resetVendorForm();
                    setShowVendorModal(true);
                  }}
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
            {['expenses', 'vendors', 'dashboard'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'expenses' && <><Receipt className="w-4 h-4 inline mr-2 flex-shrink-0" />Expenses</>}
                {tab === 'vendors' && <><Building2 className="w-4 h-4 inline mr-2 flex-shrink-0" />Vendors</>}
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
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wide truncate">Total Expenses</p>
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
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                    <Search className="w-4 h-4 inline mr-2 flex-shrink-0" />
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari vendor, keterangan, atau no expense..."
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">
                    <Filter className="w-4 h-4 inline mr-2 flex-shrink-0" />
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  >
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
                    <Filter className="w-4 h-4 inline mr-2 flex-shrink-0" />
                    Project
                  </label>
                  <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  >
                    <option value="All">Semua Project</option>
                    {projectList.map(p => (
                      <option key={p.id} value={p.id}>{p.namaProject}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Expense List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">No Expense</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Tanggal</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Keterangan</th>
                      <th className="px-6 py-4 text-right text-xs font-black text-slate-700 uppercase tracking-wider">Nominal</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Kwitansi</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center">
                          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">Belum ada data expense</p>
                          <p className="text-sm text-slate-400 mt-1">Klik "Tambah Expense" untuk mulai tracking pengeluaran</p>
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 text-sm">{expense.noExpense}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600">{new Date(expense.tanggal).toLocaleDateString('id-ID')}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 text-sm">{expense.vendorName}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600">{expense.projectName || '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                              {expense.kategori}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600 max-w-xs truncate">{expense.keterangan}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-black text-slate-900">Rp {expense.totalNominal.toLocaleString('id-ID')}</p>
                            {expense.ppn > 0 && (
                              <p className="text-xs text-slate-500">+ PPN Rp {expense.ppn.toLocaleString('id-ID')}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              expense.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                              expense.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              expense.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                              expense.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {expense.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {expense.hasKwitansi ? (
                              <button
                                onClick={() => {
                                  setSelectedExpense(expense);
                                  setShowPreviewModal(true);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                              >
                                <ImageIcon className="w-5 h-5 inline" />
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              {expense.status === 'Pending Approval' && (
                                <>
                                  <button
                                    onClick={async () => {
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
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { setRejectModalTarget(expense); setRejectModalReason(''); }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {expense.status === 'Approved' && (
                                <button
                                  onClick={() => {
                                    setSelectedExpense(expense);
                                    setPayForm({ bank: 'BCA PT Gema Teknik Perkasa', noBukti: '', tanggal: new Date().toISOString().split('T')[0] });
                                    setShowPayModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"
                                >
                                  Mark as Paid
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedExpense(expense);
                                  setExpenseForm({
                                    tanggal: expense.tanggal,
                                    vendorId: expense.vendorId,
                                    projectId: expense.projectId || '',
                                    rabItemId: expense.rabItemId || '',
                                    kategori: expense.kategori,
                                    keterangan: expense.keterangan,
                                    nominal: expense.nominal,
                                    ppn: expense.ppn || 0,
                                    metodeBayar: expense.metodeBayar,
                                    noKwitansi: expense.noKwitansi || '',
                                    remark: expense.remark || ''
                                  });
                                  setKwitansiPreview(expense.kwitansiUrl || '');
                                  setIsEditMode(true);
                                  setShowExpenseModal(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Edit"
                              >
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
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete"
                              >
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
                  {Object.entries(vendorList.reduce((acc, v) => {
                    acc[v.kategori] = (acc[v.kategori] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>))
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
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
                      <th className="px-6 py-4 text-center text-xs font-black text-slate-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vendorList.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">{vendor.kodeVendor}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{vendor.namaVendor}</p>
                          <p className="text-xs text-slate-500">{vendor.alamat}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                            {vendor.kategori}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{vendor.kontak || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{vendor.telepon || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <p className="text-sm font-bold text-amber-600">{vendor.rating || 5} ⭐</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            vendor.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {vendor.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={async () => {
                                if (processingId) return;
                                setProcessingId(vendor.id);
                                try {
                                  await updateVendor(vendor.id, { status: vendor.status === 'Active' ? 'Inactive' : 'Active' });
                                  toast.success(`Vendor ${vendor.status === 'Active' ? 'dinonaktifkan' : 'diaktifkan'}!`);
                                } catch (err) {
                                  toast.error('Gagal mengubah status vendor: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                              disabled={processingId === vendor.id}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={vendor.status === 'Active' ? 'Deactivate' : 'Activate'}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Hapus vendor ini?')) {
                                  deleteVendor(vendor.id);
                                  toast.success('Vendor berhasil dihapus!');
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Expenses</p>
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
                <p className="text-3xl font-black text-slate-900">
                  {new Set(expenseList.filter(e => e.projectId).map(e => e.projectId)).size}
                </p>
              </div>
            </div>

            {/* Expense by Category */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Expense by Category</h3>
              <div className="space-y-3">
                {Object.entries(expenseByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => {
                    const percentage = (amount / totalExpenses) * 100;
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-700">{category}</p>
                          <p className="text-sm font-black text-slate-900">Rp {amount.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-3 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}% of total</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Expense by Project */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Expense by Project</h3>
              <div className="space-y-3">
                {Object.entries(expenseByProject)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([projectName, amount]) => {
                    const percentage = (amount / totalExpenses) * 100;
                    return (
                      <div key={projectName}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-700">{projectName}</p>
                          <p className="text-sm font-black text-slate-900">Rp {amount.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}% of total</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Top Vendors */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4">Top Vendors by Spending</h3>
              <div className="space-y-3">
                {Object.entries(
                  expenseList.reduce((acc, exp) => {
                    acc[exp.vendorName] = (acc[exp.vendorName] || 0) + exp.totalNominal;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([vendorName, amount], index) => (
                    <div key={vendorName} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
                          #{index + 1}
                        </div>
                        <p className="font-bold text-slate-900">{vendorName}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-600">Rp {amount.toLocaleString('id-ID')}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* BUDGET ANALYSIS TAB */}
      </div>

      {/* CREATE/EDIT EXPENSE MODAL */}
        {showExpenseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowExpenseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between border-b border-emerald-600 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{isEditMode ? 'Edit' : 'Tambah'} Expense</h2>
                    <p className="text-sm text-emerald-100">Input detail pengeluaran vendor</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal</label>
                    <input
                      type="date"
                      value={expenseForm.tanggal}
                      onChange={(e) => setExpenseForm({ ...expenseForm, tanggal: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Vendor *</label>
                    <select
                      value={expenseForm.vendorId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, vendorId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Pilih Vendor</option>
                      {vendorList.filter(v => v.status === 'Active').map(v => (
                        <option key={v.id} value={v.id}>{v.namaVendor}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Project (Optional)</label>
                    <select
                      value={expenseForm.projectId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value, rabItemId: '' })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Tidak ada project</option>
                      {projectList.map(p => (
                        <option key={p.id} value={p.id}>{p.namaProject}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      RAB/BOQ Item {expenseForm.projectId && <span className="text-emerald-600 text-xs">🔗 Link to budget</span>}
                    </label>
                    <select
                      value={expenseForm.rabItemId}
                      onChange={(e) => {
                        const selectedProject = projectList.find(p => p.id === expenseForm.projectId);
                        const selectedItem = selectedProject?.boq?.find((item: any) => item.itemKode === e.target.value);
                        setExpenseForm({ 
                          ...expenseForm, 
                          rabItemId: e.target.value,
                          keterangan: selectedItem ? `${selectedItem.materialName}` : expenseForm.keterangan
                        });
                      }}
                      disabled={!expenseForm.projectId}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                    >
                      <option value="">Pilih RAB Item (Optional)</option>
                      {expenseForm.projectId && projectList
                        .find(p => p.id === expenseForm.projectId)
                        ?.boq?.map((item: any) => (
                          <option key={item.itemKode} value={item.itemKode}>
                            {item.materialName} - Budget: Rp {(item.unitPrice || 0).toLocaleString('id-ID')}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                {/* Budget Info Card */}
                {expenseForm.projectId && expenseForm.rabItemId && (() => {
                  const selectedProject = projectList.find(p => p.id === expenseForm.projectId);
                  const selectedItem = selectedProject?.boq?.find((item: any) => item.itemKode === expenseForm.rabItemId);
                  if (!selectedItem) return null;
                  
                  const budgetAmount = selectedItem.unitPrice || 0;
                  const actualAmount = expenseForm.nominal + (expenseForm.ppn || 0);
                  const variance = actualAmount - budgetAmount;
                  const isOverBudget = variance > 0;
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 ${isOverBudget ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-slate-700">📊 Budget Analysis</p>
                        {isOverBudget ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">⚠️ OVER BUDGET</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">✅ UNDER BUDGET</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Budget (RAB)</p>
                          <p className="font-black text-slate-900">Rp {budgetAmount.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Actual Input</p>
                          <p className="font-black text-slate-900">Rp {actualAmount.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Variance</p>
                          <p className={`font-black ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isOverBudget ? '+' : ''}Rp {variance.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Kategori *</label>
                    <select
                      value={expenseForm.kategori}
                      onChange={(e) => setExpenseForm({ ...expenseForm, kategori: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="Material">Material</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Service">Service</option>
                      <option value="Transport">Transport</option>
                      <option value="Manpower">Manpower</option>
                      <option value="Tools">Tools</option>
                      <option value="Consumables">Consumables</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bank</label>
                    <select
                      value={expenseForm.bank}
                      onChange={(e) => setExpenseForm({ ...expenseForm, bank: e.target.value, metodeBayar: e.target.value === 'Cash' ? 'Cash' : 'Transfer' })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="BCA">BCA</option>
                      <option value="Mandiri">Mandiri</option>
                      <option value="BNI">BNI</option>
                      <option value="BRI">BRI</option>
                      <option value="CIMB Niaga">CIMB Niaga</option>
                      <option value="Permata">Permata</option>
                      <option value="Danamon">Danamon</option>
                      <option value="BSI">BSI</option>
                      <option value="BTN">BTN</option>
                      <option value="Cash">Cash</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                    {expenseForm.bank === 'Lainnya' && (
                      <input
                        type="text"
                        placeholder="Nama bank..."
                        value={expenseForm.bankLainnya}
                        onChange={(e) => setExpenseForm({ ...expenseForm, bankLainnya: e.target.value })}
                        className="w-full mt-2 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Keterangan *</label>
                  <textarea
                    value={expenseForm.keterangan}
                    onChange={(e) => setExpenseForm({ ...expenseForm, keterangan: e.target.value })}
                    rows={3}
                    placeholder="Detail pengeluaran..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nominal *</label>
                    <input
                      type="number"
                      value={expenseForm.nominal || ''}
                      onChange={(e) => setExpenseForm({ ...expenseForm, nominal: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">PPN (Rp)</label>
                    <input
                      type="number"
                      value={expenseForm.ppn || ''}
                      onChange={(e) => setExpenseForm({ ...expenseForm, ppn: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Total</label>
                    <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-700">
                      Rp {((expenseForm.nominal || 0) + (expenseForm.ppn || 0)).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">No Kwitansi (Optional)</label>
                    <input
                      type="text"
                      value={expenseForm.noKwitansi}
                      onChange={(e) => setExpenseForm({ ...expenseForm, noKwitansi: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Upload Kwitansi (Optional)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    {kwitansiPreview ? (
                      <div className="space-y-3">
                        <img src={kwitansiPreview} alt="Kwitansi Preview" className="max-h-48 mx-auto rounded-lg shadow-md" />
                        <button
                          onClick={() => setKwitansiPreview('')}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-bold text-sm"
                        >
                          <Trash2 className="w-4 h-4 inline mr-2" />
                          Hapus Kwitansi
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 font-medium mb-2">Upload foto kwitansi</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-bold text-sm"
                        >
                          Pilih File
                        </button>
                        <p className="text-xs text-slate-400 mt-2">Max 5MB (JPG, PNG)</p>
                      </>
                    )}
                  </div>
                </div>

              </div>

              <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmitExpense}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  {isSubmitting ? 'Menyimpan...' : `${isEditMode ? 'Update' : 'Simpan'} Expense`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* CREATE VENDOR MODAL */}
        {showVendorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowVendorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
            >
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 flex items-center justify-between border-b border-blue-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Tambah Vendor Baru</h2>
                    <p className="text-sm text-blue-100">Registrasi vendor untuk expense tracking</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVendorModal(false)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Kode Vendor</label>
                    <input
                      type="text"
                      value={vendorForm.kodeVendor}
                      onChange={(e) => setVendorForm({ ...vendorForm, kodeVendor: e.target.value })}
                      placeholder="Auto-generate jika kosong"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nama Vendor *</label>
                    <input
                      type="text"
                      value={vendorForm.namaVendor}
                      onChange={(e) => setVendorForm({ ...vendorForm, namaVendor: e.target.value })}
                      placeholder="Nama vendor"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Kategori</label>
                    <select
                      value={vendorForm.kategori}
                      onChange={(e) => setVendorForm({ ...vendorForm, kategori: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Material">Material</option>
                      <option value="Jasa">Jasa</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Transport">Transport</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Rating</label>
                    <select
                      value={vendorForm.rating}
                      onChange={(e) => setVendorForm({ ...vendorForm, rating: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
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
                  <textarea
                    value={vendorForm.alamat}
                    onChange={(e) => setVendorForm({ ...vendorForm, alamat: e.target.value })}
                    rows={2}
                    placeholder="Alamat vendor"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Kontak Person</label>
                    <input
                      type="text"
                      value={vendorForm.kontak}
                      onChange={(e) => setVendorForm({ ...vendorForm, kontak: e.target.value })}
                      placeholder="Nama contact person"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Telepon</label>
                    <input
                      type="text"
                      value={vendorForm.telepon}
                      onChange={(e) => setVendorForm({ ...vendorForm, telepon: e.target.value })}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      placeholder="vendor@email.com"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">NPWP</label>
                    <input
                      type="text"
                      value={vendorForm.npwp}
                      onChange={(e) => setVendorForm({ ...vendorForm, npwp: e.target.value })}
                      placeholder="00.000.000.0-000.000"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Payment Terms</label>
                  <input
                    type="text"
                    value={vendorForm.paymentTerms}
                    onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}
                    placeholder="e.g., Net 30, COD, Net 14"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowVendorModal(false)}
                  className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmitVendor}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-bold"
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Simpan Vendor
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* KWITANSI PREVIEW MODAL */}
        {showPreviewModal && selectedExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Preview Kwitansi</h3>
                  <p className="text-sm text-slate-300">{selectedExpense.noExpense} - {selectedExpense.vendorName}</p>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-6 max-h-[calc(90vh-100px)] overflow-y-auto">
                {selectedExpense.kwitansiUrl ? (
                  <img
                    src={selectedExpense.kwitansiUrl}
                    alt="Kwitansi"
                    className="w-full rounded-lg shadow-lg"
                  />
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

      {/* Payment Confirmation Modal */}
      {showPayModal && selectedExpense && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-600">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">Konfirmasi Pembayaran</h3>
                <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">{selectedExpense.noExpense}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {/* Info expense */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</p>
                <p className="text-sm font-black text-slate-900">{selectedExpense.vendorName}</p>
                <p className="text-xl font-black text-emerald-600 mt-2">
                  Rp {(selectedExpense.totalNominal || 0).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Bayar</label>
                <input
                  type="date"
                  value={payForm.tanggal}
                  onChange={(e) => setPayForm({...payForm, tanggal: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Pembayaran</label>
                <select
                  value={payForm.bank}
                  onChange={(e) => setPayForm({...payForm, bank: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all appearance-none"
                >
                  <option value="BCA PT Gema Teknik Perkasa">BCA PT Gema Teknik Perkasa</option>
                  <option value="BNI">BNI</option>
                  <option value="Mandiri">Mandiri</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Bukti Transfer (opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: TRF/2026/001"
                  value={payForm.noBukti}
                  onChange={(e) => setPayForm({...payForm, noBukti: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (isSubmitting) return;
                  setIsSubmitting(true);
                  try {
                    await updateExpense(selectedExpense.id, {
                      status: 'Paid',
                      paidAt: `${payForm.tanggal}T00:00:00.000Z`,
                      bank: payForm.bank,
                      noBuktiPay: payForm.noBukti || undefined,
                    });
                    toast.success('Pembayaran berhasil dicatat', {
                      description: `${selectedExpense.vendorName} via ${payForm.bank}`,
                    });
                    setShowPayModal(false);
                  } catch (err) {
                    toast.error('Gagal mencatat pembayaran: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={16} /> {isSubmitting ? 'Memproses...' : 'Konfirmasi Bayar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Reject Expense Modal */}
      {rejectModalTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Tolak Expense</h3>
            <p className="text-sm text-gray-500 mb-4">{rejectModalTarget.perihal || rejectModalTarget.vendorName}</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Penolakan *</label>
            <textarea
              rows={3}
              value={rejectModalReason}
              onChange={e => setRejectModalReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  if (!rejectModalReason.trim() || isSubmitting) { return; }
                  setIsSubmitting(true);
                  try {
                    await rejectExpense(rejectModalTarget.id, rejectModalReason.trim());
                    setRejectModalTarget(null);
                    setRejectModalReason('');
                  } catch (err) {
                    toast.error('Gagal menolak expense: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={!rejectModalReason.trim() || isSubmitting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-40"
              >
                {isSubmitting ? 'Memproses...' : 'Tolak'}
              </button>
              <button
                onClick={() => { setRejectModalTarget(null); setRejectModalReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
