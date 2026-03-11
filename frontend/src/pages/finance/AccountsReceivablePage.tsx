import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';

import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  Plus, 
  X, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Building2,
  FileText,
  TrendingUp,
  DollarSign,
  Edit,
  Eye,
  Filter,
  Search,
  Calendar,
  Send,
  Ban,
  BarChart3,
  Users,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export default function AccountsReceivablePage() {
  const { 
    customerInvoiceList, 
    customerList, 
    projectList,
    addCustomerInvoice, 
    updateCustomerInvoice, 
    deleteCustomerInvoice,
    addInvoicePayment,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    currentUser,
    addAuditLog
  } = useApp();

  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'dashboard'>('invoices');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCustomer, setFilterCustomer] = useState<string>('All');
  const [isEditMode, setIsEditMode] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalAR: number;
    totalInvoiced: number;
    totalPaid: number;
    totalInvoiceCount: number;
    activeInvoiceCount: number;
    overdueAmount: number;
    overdueCount: number;
    aging0to30: number;
    aging31to60: number;
    aging61to90: number;
    agingOver90: number;
  } | null>(null);
  const [summaryTopCustomers, setSummaryTopCustomers] = useState<Array<{
    id: string;
    namaCustomer: string;
    totalOutstanding: number;
    invoiceCount: number;
    overdueCount: number;
  }> | null>(null);

  const [invoiceForm, setInvoiceForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    sourceMode: 'WITH_PO' as 'WITH_PO' | 'WITHOUT_PO',
    customerId: '',
    projectId: '',
    perihal: '',
    items: [] as any[],
    ppn: 11,
    pph: 0,
    noKontrak: '',
    noPO: '',
    termin: '',
    remark: ''
  });

  const [itemForm, setItemForm] = useState({
    deskripsi: '',
    qty: 0,
    satuan: '',
    hargaSatuan: 0
  });

  const [paymentForm, setPaymentForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    nominal: 0,
    metodeBayar: 'Transfer' as any,
    noBukti: '',
    bankName: '',
    remark: ''
  });

  const [customerForm, setCustomerForm] = useState({
    kodeCustomer: '',
    namaCustomer: '',
    alamat: '',
    kota: '',
    kontak: '',
    telepon: '',
    email: '',
    npwp: '',
    paymentTerms: 'NET 30',
    rating: 5
  });

  // Generate invoice number
  const safeCustomerInvoiceList = useMemo(() => (customerInvoiceList || []).filter(Boolean), [customerInvoiceList]);
  const safeCustomerList = useMemo(() => (customerList || []).filter(Boolean), [customerList]);
  const safeProjectList = useMemo(() => (projectList || []).filter(Boolean), [projectList]);
  const validCustomerIds = useMemo(() => new Set(safeCustomerList.map((c) => c.id)), [safeCustomerList]);

  const toSafeNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toInvoiceStatus = (rawStatus: unknown): string => {
    const normalized = String(rawStatus || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (normalized === 'SENT') return 'Sent';
    if (normalized === 'PARTIAL_PAID' || normalized === 'PARTIAL') return 'Partial Paid';
    if (normalized === 'PAID') return 'Paid';
    if (normalized === 'OVERDUE') return 'Overdue';
    if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
    return 'Draft';
  };

  const normalizedCustomerInvoiceList = useMemo(() => {
    const customerNameById = new Map(safeCustomerList.map((customer) => [customer.id, customer.namaCustomer]));
    return safeCustomerInvoiceList.map((invoice: any) => {
      const customerId = String(
        invoice?.customerId ||
          invoice?.customer?.id ||
          invoice?.idCustomer ||
          invoice?.customer_code ||
          ''
      ).trim();

      const customerName = String(
        invoice?.customerName ||
          customerNameById.get(customerId) ||
          invoice?.customer?.namaCustomer ||
          invoice?.namaCustomer ||
          invoice?.customer ||
          '-'
      ).trim();

      const subtotal = toSafeNumber(invoice?.subtotal ?? invoice?.subTotal);
      const ppn = toSafeNumber(invoice?.ppn);
      const pph = toSafeNumber(invoice?.pph);
      const totalNominal = toSafeNumber(
        invoice?.totalNominal ??
          invoice?.total ??
          invoice?.totalAmount ??
          invoice?.nominal ??
          subtotal + ppn - pph
      );
      const paidAmount = toSafeNumber(invoice?.paidAmount ?? invoice?.terbayar);
      const outstandingAmount = toSafeNumber(
        invoice?.outstandingAmount ??
          invoice?.sisaTagihan ??
          Math.max(totalNominal - paidAmount, 0)
      );

      const rawItems = Array.isArray(invoice?.items) ? invoice.items : [];
      const items = rawItems.map((item: any) => {
        const qty = toSafeNumber(item?.qty);
        const hargaSatuan = toSafeNumber(item?.hargaSatuan ?? item?.harga ?? item?.price);
        return {
          ...item,
          qty,
          hargaSatuan,
          jumlah: toSafeNumber(item?.jumlah ?? qty * hargaSatuan),
        };
      });

      return {
        ...invoice,
        tanggal: String(invoice?.tanggal || new Date().toISOString().slice(0, 10)),
        dueDate: String(
          invoice?.dueDate ||
            invoice?.jatuhTempo ||
            invoice?.tanggalJatuhTempo ||
            invoice?.tanggal ||
            new Date().toISOString().slice(0, 10)
        ),
        customerId,
        customerName,
        subtotal,
        ppn,
        pph,
        totalNominal,
        paidAmount,
        outstandingAmount,
        items,
        status: toInvoiceStatus(invoice?.status),
        isCustomerMissing: customerId ? !validCustomerIds.has(customerId) : true,
      };
    });
  }, [safeCustomerInvoiceList, safeCustomerList, validCustomerIds]);

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthRoman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth()];
    const todayInvoices = normalizedCustomerInvoiceList.filter(i => String(i.tanggal || '').startsWith(`${year}-${month}`));
    const nextNum = String(todayInvoices.length + 1).padStart(3, '0');
    return `${nextNum}/TAG/GMT/${monthRoman}/${year}`;
  };

  // Generate customer code
  const generateCustomerCode = () => {
    const nextNum = String(safeCustomerList.length + 1).padStart(3, '0');
    return `CUST-${nextNum}`;
  };

  // Calculate aging days
  const calculateAgingDays = (dueDate: string, status: string) => {
    if (status === 'Paid') return 0;
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Add item to invoice
  const handleAddItem = () => {
    if (!itemForm.deskripsi || itemForm.qty <= 0 || itemForm.hargaSatuan <= 0) {
      toast.error('Lengkapi data item!');
      return;
    }

    const newItem = {
      id: 'ITEM-' + Date.now(),
      ...itemForm,
      jumlah: itemForm.qty * itemForm.hargaSatuan
    };

    setInvoiceForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setItemForm({
      deskripsi: '',
      qty: 0,
      satuan: '',
      hargaSatuan: 0
    });

    toast.success('Item ditambahkan!');
  };

  // Remove item from invoice
  const handleRemoveItem = (itemId: string) => {
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = invoiceForm.items.reduce((sum, item) => sum + item.jumlah, 0);
    const ppn = invoiceForm.ppn > 0 ? (subtotal * invoiceForm.ppn / 100) : 0;
    const pph = invoiceForm.pph > 0 ? (subtotal * invoiceForm.pph / 100) : 0;
    const total = subtotal + ppn - pph;
    return { subtotal, ppn, pph, total };
  };

  // Submit invoice
  const handleSubmitInvoice = () => {
    if (!invoiceForm.customerId || !invoiceForm.perihal || invoiceForm.items.length === 0) {
      toast.error('Lengkapi semua field yang diperlukan!');
      return;
    }

    if (invoiceForm.sourceMode === 'WITH_PO' && !invoiceForm.noPO.trim()) {
      toast.error('Mode Dengan PO: No. PO Customer wajib diisi.');
      return;
    }

    if (invoiceForm.sourceMode === 'WITHOUT_PO') {
      if (!invoiceForm.noKontrak.trim()) {
        toast.error('Mode Tanpa PO: No. Kontrak / SPK wajib diisi.');
        return;
      }
      if (!invoiceForm.termin.trim()) {
        toast.error('Mode Tanpa PO: Termin invoice wajib diisi.');
        return;
      }
      if (!invoiceForm.projectId) {
        toast.error('Mode Tanpa PO: pilih Project agar tagihan tetap terikat pekerjaan.');
        return;
      }
    }

    const customer = safeCustomerList.find(c => c.id === invoiceForm.customerId);
    const project = safeProjectList.find(p => p.id === invoiceForm.projectId);
    const { subtotal, ppn, pph, total } = calculateTotals();

    const newInvoice = {
      id: 'INV-' + Date.now(),
      noInvoice: generateInvoiceNumber(),
      tanggal: invoiceForm.tanggal,
      dueDate: invoiceForm.dueDate,
      customerId: invoiceForm.customerId,
      customerName: customer?.namaCustomer || '',
      projectId: invoiceForm.projectId || undefined,
      projectName: project?.namaProject || undefined,
      perihal: invoiceForm.perihal,
      items: invoiceForm.items,
      subtotal,
      ppn,
      pph,
      totalNominal: total,
      paidAmount: 0,
      outstandingAmount: total,
      status: 'Draft' as any,
      paymentHistory: [],
      noKontrak: invoiceForm.noKontrak || undefined,
      noPO: invoiceForm.noPO || undefined,
      termin: invoiceForm.termin || undefined,
      remark: [
        invoiceForm.remark?.trim() || '',
        `[SOURCE:${invoiceForm.sourceMode === 'WITH_PO' ? 'WITH_PO' : 'WITHOUT_PO'}]`,
      ]
        .filter(Boolean)
        .join(' '),
      createdBy: currentUser?.fullName || 'Admin',
      createdAt: new Date().toISOString()
    };

    addCustomerInvoice(newInvoice);
    setShowInvoiceModal(false);
    resetInvoiceForm();
  };

  // Submit payment
  const handleSubmitPayment = () => {
    if (!selectedInvoice || paymentForm.nominal <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0!');
      return;
    }

    if (paymentForm.nominal > selectedInvoice.outstandingAmount) {
      toast.error('Nominal pembayaran melebihi sisa tagihan!');
      return;
    }

    const newPayment = {
      id: 'PAY-' + Date.now(),
      tanggal: paymentForm.tanggal,
      nominal: paymentForm.nominal,
      metodeBayar: paymentForm.metodeBayar,
      noBukti: paymentForm.noBukti || undefined,
      bankName: paymentForm.bankName || undefined,
      remark: paymentForm.remark || undefined,
      createdBy: currentUser?.fullName || 'Admin',
      createdAt: new Date().toISOString()
    };

    addInvoicePayment(selectedInvoice.id, newPayment);
    setShowPaymentModal(false);
    resetPaymentForm();
    setSelectedInvoice(null);
  };

  // Submit customer
  const handleSubmitCustomer = () => {
    if (!customerForm.namaCustomer || !customerForm.alamat) {
      toast.error('Lengkapi field yang diperlukan!');
      return;
    }

    if (isEditMode && selectedInvoice) {
      updateCustomer(selectedInvoice.id, {
        ...customerForm,
        status: 'Active'
      });
      toast.success('Customer berhasil diupdate!');
    } else {
      const newCustomer = {
        id: 'CUST-' + Date.now(),
        kodeCustomer: generateCustomerCode(),
        ...customerForm,
        status: 'Active' as any,
        createdAt: new Date().toISOString()
      };
      addCustomer(newCustomer);
    }

    setShowCustomerModal(false);
    resetCustomerForm();
    setIsEditMode(false);
  };

  // Send invoice
  const handleSendInvoice = async (invoiceId: string) => {
    const target = normalizedCustomerInvoiceList.find((invoice) => invoice.id === invoiceId);
    if (!target) {
      toast.error('Invoice tidak ditemukan.');
      return;
    }
    if (target.isCustomerMissing) {
      toast.error(`Customer untuk invoice ${target.noInvoice || invoiceId} tidak valid. Pilih customer yang terdaftar dulu.`);
      return;
    }
    await updateCustomerInvoice(invoiceId, {
      status: 'Sent',
      sentAt: new Date().toISOString()
    });
  };

  // Cancel invoice
  const handleCancelInvoice = (invoiceId: string) => {
    updateCustomerInvoice(invoiceId, {
      status: 'Cancelled'
    });
    toast.warning('Invoice dibatalkan!');
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      tanggal: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      sourceMode: 'WITH_PO',
      customerId: '',
      projectId: '',
      perihal: '',
      items: [],
      ppn: 11,
      pph: 0,
      noKontrak: '',
      noPO: '',
      termin: '',
      remark: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      tanggal: new Date().toISOString().split('T')[0],
      nominal: 0,
      metodeBayar: 'Transfer',
      noBukti: '',
      bankName: '',
      remark: ''
    });
  };

  const resetCustomerForm = () => {
    setCustomerForm({
      kodeCustomer: '',
      namaCustomer: '',
      alamat: '',
      kota: '',
      kontak: '',
      telepon: '',
      email: '',
      npwp: '',
      paymentTerms: 'NET 30',
      rating: 5
    });
  };

  // Filter and search
  const filteredInvoices = useMemo(() => {
    const keyword = String(searchTerm || '').toLowerCase();
    return normalizedCustomerInvoiceList
      .map(inv => ({
        ...inv,
        agingDays: calculateAgingDays(inv.dueDate, inv.status)
      }))
      .filter(inv => {
        const matchesSearch = 
          String(inv.noInvoice || '').toLowerCase().includes(keyword) ||
          String(inv.customerName || '').toLowerCase().includes(keyword) ||
          String(inv.projectName || '').toLowerCase().includes(keyword);
        
        const matchesStatus = filterStatus === 'All' || inv.status === filterStatus;
        const matchesCustomer = filterCustomer === 'All' || inv.customerId === filterCustomer;

        return matchesSearch && matchesStatus && matchesCustomer;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [normalizedCustomerInvoiceList, searchTerm, filterStatus, filterCustomer]);

  const fetchArSummary = async (showToast = false) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get<{
        metrics?: typeof summaryMetrics;
        topCustomers?: typeof summaryTopCustomers;
      }>('/dashboard/finance-ar-summary');
      if (data?.metrics) setSummaryMetrics(data.metrics as NonNullable<typeof summaryMetrics>);
      if (Array.isArray(data?.topCustomers)) {
        setSummaryTopCustomers(data.topCustomers as NonNullable<typeof summaryTopCustomers>);
      }
      if (showToast) toast.success('AR summary refreshed');
    } catch {
      if (showToast) toast.error('Gagal refresh AR summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchArSummary(false);
  }, []);

  // Customer stats
  const customerStats = useMemo(() => {
    return safeCustomerList.map(customer => {
      const invoices = normalizedCustomerInvoiceList.filter(inv => inv.customerId === customer.id);
      const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
      const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalNominal, 0);
      const overdueInvoices = invoices.filter(inv => {
        const agingDays = calculateAgingDays(inv.dueDate, inv.status);
        return agingDays > 0 && inv.status !== 'Paid';
      });

      return {
        ...customer,
        totalOutstanding,
        totalInvoiced,
        invoiceCount: invoices.length,
        overdueCount: overdueInvoices.length
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [safeCustomerList, normalizedCustomerInvoiceList]);

  const effectiveMetrics = summaryMetrics || {
    totalAR: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalInvoiceCount: 0,
    activeInvoiceCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    aging0to30: 0,
    aging31to60: 0,
    aging61to90: 0,
    agingOver90: 0,
  };
  const effectiveTopCustomers = summaryTopCustomers || [];

  // Status badge
  const getStatusBadge = (status: string) => {
    const badges: any = {
      'Draft': { color: 'bg-gray-100 text-gray-700', icon: FileText },
      'Sent': { color: 'bg-blue-100 text-blue-700', icon: Send },
      'Partial Paid': { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      'Paid': { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      'Overdue': { color: 'bg-red-100 text-red-700', icon: AlertCircle },
      'Cancelled': { color: 'bg-gray-100 text-gray-500', icon: Ban }
    };

    const badge = badges[status] || badges['Draft'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const getInvoiceSource = (invoice: any): 'WITH_PO' | 'WITHOUT_PO' => {
    if (typeof invoice?.remark === 'string' && invoice.remark.includes('[SOURCE:WITHOUT_PO]')) {
      return 'WITHOUT_PO';
    }
    if (typeof invoice?.remark === 'string' && invoice.remark.includes('[SOURCE:WITH_PO]')) {
      return 'WITH_PO';
    }
    return invoice?.noPO ? 'WITH_PO' : 'WITHOUT_PO';
  };

  const getSourceBadge = (invoice: any) => {
    const source = getInvoiceSource(invoice);
    if (source === 'WITH_PO') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
          With PO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        Without PO
      </span>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
            <span className="truncate">Accounts Receivable (AR)</span>
          </h1>
          <button
            onClick={() => fetchArSummary(true)}
            disabled={summaryLoading}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {summaryLoading ? 'Refreshing...' : 'Refresh Summary'}
          </button>
        </div>
        <p className="text-xs sm:text-sm text-gray-600">Manajemen piutang customer dan invoice tracking</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'invoices', label: 'Invoices', icon: Receipt },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* INVOICES TAB */}
      {activeTab === 'invoices' && (
        <div>
          {/* Actions & Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                setShowInvoiceModal(true);
                setIsEditMode(false);
                resetInvoiceForm();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Buat Invoice
            </button>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari invoice, customer, project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">Semua Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Partial Paid">Partial Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">Semua Customer</option>
              {safeCustomerList.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.namaCustomer}
                </option>
              ))}
            </select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total AR</span>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(effectiveMetrics.totalAR)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Invoiced</span>
                <Receipt className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(effectiveMetrics.totalInvoiced)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Paid</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(effectiveMetrics.totalPaid)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Overdue</span>
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(effectiveMetrics.overdueAmount)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {effectiveMetrics.overdueCount} invoice(s)
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Terbayar</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aging</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        Tidak ada invoice ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{invoice.noInvoice}</div>
                          {invoice.termin && (
                            <div className="text-xs text-gray-500">{invoice.termin}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{new Date(invoice.tanggal).toLocaleDateString('id-ID')}</div>
                          <div className="text-xs text-gray-500">
                            Due: {new Date(invoice.dueDate).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{invoice.customerName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {invoice.projectName || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {getSourceBadge(invoice)}
                            <span className="text-[10px] text-gray-500">
                              {getInvoiceSource(invoice) === 'WITH_PO'
                                ? (invoice.noPO || '-')
                                : (invoice.noKontrak || '-')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(invoice.totalNominal)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {formatCurrency(invoice.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          {formatCurrency(invoice.outstandingAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {invoice.agingDays > 0 ? (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              invoice.agingDays > 90 ? 'bg-red-100 text-red-700' :
                              invoice.agingDays > 60 ? 'bg-orange-100 text-orange-700' :
                              invoice.agingDays > 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {invoice.agingDays} days
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {getStatusBadge(invoice.status)}
                            {invoice.isCustomerMissing && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                                Customer invalid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {invoice.status === 'Draft' && (
                              <button
                                onClick={() => handleSendInvoice(invoice.id)}
                                disabled={invoice.isCustomerMissing}
                                className="p-1 hover:bg-blue-50 rounded text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={invoice.isCustomerMissing ? 'Customer invoice ini tidak valid di master customer' : 'Kirim Invoice'}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {(invoice.status === 'Sent' || invoice.status === 'Partial Paid' || invoice.status === 'Overdue') && (
                              <button
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setShowPaymentModal(true);
                                  setPaymentForm(prev => ({
                                    ...prev,
                                    nominal: invoice.outstandingAmount
                                  }));
                                }}
                                className="p-1 hover:bg-green-50 rounded text-green-600"
                                title="Catat Pembayaran"
                              >
                                <Wallet className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPreviewModal(true);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-600"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
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

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div>
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                setShowCustomerModal(true);
                setIsEditMode(false);
                resetCustomerForm();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Customer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerStats.map(customer => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{customer.namaCustomer}</h3>
                      <p className="text-sm text-gray-500">{customer.kodeCustomer}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                    {customer.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Outstanding:</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(customer.totalOutstanding)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Invoiced:</span>
                    <span className="font-medium">
                      {formatCurrency(customer.totalInvoiced)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoices:</span>
                    <span className="font-medium">{customer.invoiceCount}</span>
                  </div>
                  {customer.overdueCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Overdue:</span>
                      <span className="font-medium text-red-600">{customer.overdueCount}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Kota:</span>
                      <span>{customer.kota || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Terms:</span>
                      <span>{customer.paymentTerms || 'NET 30'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Total AR Outstanding</span>
                <DollarSign className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(effectiveMetrics.totalAR)}
              </div>
              <div className="text-xs opacity-80">
                Dari {effectiveMetrics.activeInvoiceCount} invoice aktif
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Total Invoiced</span>
                <Receipt className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(effectiveMetrics.totalInvoiced)}
              </div>
              <div className="text-xs opacity-80">
                {effectiveMetrics.totalInvoiceCount} total invoices
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Total Collected</span>
                <CheckCircle className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(effectiveMetrics.totalPaid)}
              </div>
              <div className="text-xs opacity-80">
                {((effectiveMetrics.totalPaid / (effectiveMetrics.totalInvoiced || 1)) * 100).toFixed(1)}% collection rate
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Overdue Amount</span>
                <AlertCircle className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(effectiveMetrics.overdueAmount)}
              </div>
              <div className="text-xs opacity-80">
                {effectiveMetrics.overdueCount} overdue invoice(s)
              </div>
            </div>
          </div>

          {/* Aging Analysis */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Aging Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-700 mb-2">Current (0-30 days)</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(effectiveMetrics.aging0to30)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {((effectiveMetrics.aging0to30 / (effectiveMetrics.totalAR || 1)) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-700 mb-2">31-60 days</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(effectiveMetrics.aging31to60)}
                </div>
                <div className="text-xs text-yellow-600 mt-1">
                  {((effectiveMetrics.aging31to60 / (effectiveMetrics.totalAR || 1)) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-700 mb-2">61-90 days</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(effectiveMetrics.aging61to90)}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  {((effectiveMetrics.aging61to90 / (effectiveMetrics.totalAR || 1)) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-700 mb-2">Over 90 days</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(effectiveMetrics.agingOver90)}
                </div>
                <div className="text-xs text-red-600 mt-1">
                  {((effectiveMetrics.agingOver90 / (effectiveMetrics.totalAR || 1)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Top Customers by Outstanding */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Top Customers by Outstanding
            </h3>
            <div className="space-y-3">
              {effectiveTopCustomers.map((customer, index) => (
                <div key={customer.id || `${customer.namaCustomer}-${index}`} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-400 w-8">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{customer.namaCustomer}</div>
                    <div className="text-xs text-gray-500">{customer.invoiceCount} invoices</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">
                      {formatCurrency(customer.totalOutstanding)}
                    </div>
                    {customer.overdueCount > 0 && (
                      <div className="text-xs text-red-600">
                        {customer.overdueCount} overdue
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT INVOICE MODAL */}
      <AnimatePresence>
        {showInvoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowInvoiceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Buat Invoice Baru</h2>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

                <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-semibold text-blue-900 mb-2">Sumber Invoice</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceForm((prev) => ({ ...prev, sourceMode: 'WITH_PO' }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        invoiceForm.sourceMode === 'WITH_PO'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-700 border-blue-300'
                      }`}
                    >
                      Dengan PO
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceForm((prev) => ({
                          ...prev,
                          sourceMode: 'WITHOUT_PO',
                          noPO: '',
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        invoiceForm.sourceMode === 'WITHOUT_PO'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-700 border-blue-300'
                      }`}
                    >
                      Tanpa PO
                    </button>
                  </div>
                  <div className="text-xs text-blue-700 mt-2">
                    {invoiceForm.sourceMode === 'WITH_PO'
                      ? 'Wajib isi No. PO Customer.'
                      : 'Wajib isi No. Kontrak/SPK, Termin, dan Project.'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tanggal Invoice</label>
                    <input
                      type="date"
                      value={invoiceForm.tanggal}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, tanggal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Customer *</label>
                    <select
                      value={invoiceForm.customerId}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, customerId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Pilih Customer</option>
                      {safeCustomerList.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.namaCustomer}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Project (Optional)</label>
                    <select
                      value={invoiceForm.projectId}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, projectId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Pilih Project</option>
                      {safeProjectList.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.namaProject}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Perihal *</label>
                    <input
                      type="text"
                      value={invoiceForm.perihal}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, perihal: e.target.value }))}
                      placeholder="Deskripsi invoice"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">No. Kontrak</label>
                    <input
                      type="text"
                      value={invoiceForm.noKontrak}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, noKontrak: e.target.value }))}
                      placeholder="KONTRAK/2026/001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">No. PO Customer</label>
                    <input
                      type="text"
                      value={invoiceForm.noPO}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, noPO: e.target.value }))}
                      placeholder="PO/CUST/001"
                      disabled={invoiceForm.sourceMode === 'WITHOUT_PO'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Termin</label>
                    <input
                      type="text"
                      value={invoiceForm.termin}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, termin: e.target.value }))}
                      placeholder="Termin 1 (30%)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-bold mb-3">Items</h3>
                  
                  {/* Add Item Form */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Deskripsi item"
                          value={itemForm.deskripsi}
                          onChange={(e) => setItemForm(prev => ({ ...prev, deskripsi: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Qty"
                          value={itemForm.qty || ''}
                          onChange={(e) => setItemForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Satuan"
                          value={itemForm.satuan}
                          onChange={(e) => setItemForm(prev => ({ ...prev, satuan: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Harga Satuan"
                          value={itemForm.hargaSatuan || ''}
                          onChange={(e) => setItemForm(prev => ({ ...prev, hargaSatuan: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddItem}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Item
                    </button>
                  </div>

                  {/* Items List */}
                  {invoiceForm.items.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {invoiceForm.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{item.deskripsi}</div>
                            <div className="text-sm text-gray-600">
                              {item.qty} {item.satuan} × {formatCurrency(item.hargaSatuan)} = {formatCurrency(item.jumlah)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 hover:bg-red-50 rounded text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totals */}
                  {invoiceForm.items.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(calculateTotals().subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>PPN:</span>
                          <input
                            type="number"
                            value={invoiceForm.ppn}
                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, ppn: Number(e.target.value) }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span>%</span>
                        </div>
                        <span className="font-medium">{formatCurrency(calculateTotals().ppn)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>PPh:</span>
                          <input
                            type="number"
                            value={invoiceForm.pph}
                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, pph: Number(e.target.value) }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span>%</span>
                        </div>
                        <span className="font-medium text-red-600">-{formatCurrency(calculateTotals().pph)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-300 flex justify-between">
                        <span className="font-bold">TOTAL:</span>
                        <span className="font-bold text-lg text-blue-600">{formatCurrency(calculateTotals().total)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Catatan</label>
                  <textarea
                    value={invoiceForm.remark}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, remark: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Catatan tambahan..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmitInvoice}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Simpan Invoice
                </button>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Catat Pembayaran</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Invoice</div>
                <div className="font-bold text-lg">{selectedInvoice.noInvoice}</div>
                <div className="text-sm text-gray-600 mt-2">Customer: {selectedInvoice.customerName}</div>
                <div className="text-sm text-gray-600">Outstanding: <span className="font-bold text-red-600">{formatCurrency(selectedInvoice.outstandingAmount)}</span></div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tanggal Pembayaran</label>
                  <input
                    type="date"
                    value={paymentForm.tanggal}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, tanggal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nominal Pembayaran *</label>
                  <input
                    type="number"
                    value={paymentForm.nominal || ''}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, nominal: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Metode Pembayaran</label>
                  <select
                    value={paymentForm.metodeBayar}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, metodeBayar: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Transfer">Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Giro">Giro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">No. Bukti Transfer</label>
                  <input
                    type="text"
                    value={paymentForm.noBukti}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, noBukti: e.target.value }))}
                    placeholder="TRF/2026/001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nama Bank</label>
                  <input
                    type="text"
                    value={paymentForm.bankName}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="BCA, Mandiri, dll"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Catatan</label>
                  <textarea
                    value={paymentForm.remark}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, remark: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmitPayment}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Simpan Pembayaran
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOMER MODAL */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {isEditMode ? 'Edit Customer' : 'Tambah Customer'}
                </h2>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Customer *</label>
                  <input
                    type="text"
                    value={customerForm.namaCustomer}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, namaCustomer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Kota</label>
                  <input
                    type="text"
                    value={customerForm.kota}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, kota: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Alamat *</label>
                  <textarea
                    value={customerForm.alamat}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, alamat: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Kontak Person</label>
                  <input
                    type="text"
                    value={customerForm.kontak}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, kontak: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Telepon</label>
                  <input
                    type="text"
                    value={customerForm.telepon}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, telepon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">NPWP</label>
                  <input
                    type="text"
                    value={customerForm.npwp}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, npwp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Payment Terms</label>
                  <select
                    value={customerForm.paymentTerms}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="NET 30">NET 30</option>
                    <option value="NET 45">NET 45</option>
                    <option value="NET 60">NET 60</option>
                    <option value="NET 90">NET 90</option>
                    <option value="2/10 NET 30">2/10 NET 30</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Rating</label>
                  <select
                    value={customerForm.rating}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐</option>
                    <option value={4}>⭐⭐⭐⭐</option>
                    <option value={3}>⭐⭐⭐</option>
                    <option value={2}>⭐⭐</option>
                    <option value={1}>⭐</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmitCustomer}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isEditMode ? 'Update' : 'Simpan'} Customer
                </button>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREVIEW INVOICE MODAL */}
      <AnimatePresence>
        {showPreviewModal && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Detail Invoice</h2>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm text-gray-600">No. Invoice</div>
                    <div className="text-2xl font-bold">{selectedInvoice.noInvoice}</div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Customer</div>
                    <div className="font-medium">{selectedInvoice.customerName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Project</div>
                    <div className="font-medium">{selectedInvoice.projectName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Tanggal</div>
                    <div className="font-medium">{new Date(selectedInvoice.tanggal).toLocaleDateString('id-ID')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Due Date</div>
                    <div className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString('id-ID')}</div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-bold mb-3">Items</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm">Deskripsi</th>
                        <th className="px-4 py-2 text-center text-sm">Qty</th>
                        <th className="px-4 py-2 text-right text-sm">Harga</th>
                        <th className="px-4 py-2 text-right text-sm">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(selectedInvoice.items) ? selectedInvoice.items : []).map((item: any) => (
                        <tr key={item.id} className="border-t border-gray-200">
                          <td className="px-4 py-2">{item.deskripsi}</td>
                          <td className="px-4 py-2 text-center">{item.qty} {item.satuan}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(item.hargaSatuan)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.jumlah)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.ppn > 0 && (
                    <div className="flex justify-between">
                      <span>PPN ({selectedInvoice.ppn}%):</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.ppn)}</span>
                    </div>
                  )}
                  {selectedInvoice.pph > 0 && (
                    <div className="flex justify-between">
                      <span>PPh ({selectedInvoice.pph}%):</span>
                      <span className="font-medium text-red-600">-{formatCurrency(selectedInvoice.pph)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-300 flex justify-between">
                    <span className="font-bold">TOTAL:</span>
                    <span className="font-bold text-lg text-blue-600">{formatCurrency(selectedInvoice.totalNominal)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Terbayar:</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span className="font-bold">Outstanding:</span>
                    <span className="font-bold">{formatCurrency(selectedInvoice.outstandingAmount)}</span>
                  </div>
                </div>

                {/* Payment History */}
                {(Array.isArray(selectedInvoice.paymentHistory) ? selectedInvoice.paymentHistory : []).length > 0 && (
                  <div>
                    <h3 className="font-bold mb-3">Riwayat Pembayaran</h3>
                    <div className="space-y-2">
                      {(Array.isArray(selectedInvoice.paymentHistory) ? selectedInvoice.paymentHistory : []).map((payment: any) => (
                        <div key={payment.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{formatCurrency(payment.nominal)}</div>
                              <div className="text-sm text-gray-600">
                                {new Date(payment.tanggal).toLocaleDateString('id-ID')} • {payment.metodeBayar}
                              </div>
                              {payment.noBukti && (
                                <div className="text-xs text-gray-500">Bukti: {payment.noBukti}</div>
                              )}
                            </div>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
