import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { motion } from 'motion/react';
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
  Wallet,
  FileSpreadsheet,
  RotateCcw,
  XCircle,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { exportPiutangToWord } from '../../utils/financeExports';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { exportInvoiceToXlsx } from '../../utils/invoiceExcelExport';

const COMPANY_BANK_ACCOUNTS = [
  { id: 'BCA-1', label: 'BCA — Rekening Perusahaan 1' },
  { id: 'BCA-2', label: 'BCA — Rekening Perusahaan 2' },
  { id: 'BNI-1', label: 'BNI — Rekening Perusahaan' },
] as const;

const DEFAULT_COMPANY_ACCOUNT = COMPANY_BANK_ACCOUNTS[0].id;

export default function AccountsReceivablePage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const {
    customerInvoiceList,
    beritaAcaraList,
    customerList,
    projectList,
    quotationList,
    invoiceList,
    addCustomerInvoice,
    updateCustomerInvoice,
    deleteCustomerInvoice,
    addInvoicePayment,
    approveCustomerInvoice,
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [invoiceForm, setInvoiceForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerId: '',
    customerName: '', // fallback jika customer belum ada di masterdata
    projectId: '',
    perihal: '',
    items: [] as any[],
    ppn: 11,
    pph: 0,
    diskon: 0,
    noKontrak: '',
    noPO: '',
    tanggalPO: '',
    up: '',
    termin: '',
    remark: '',
    quotationId: '',
    invoiceId: '',
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
    bankPengirim: '',
    rekeningTujuan: DEFAULT_COMPANY_ACCOUNT,
    namaPengirim: '',
    remark: '',
    buktiTransferUrl: '',
    buktiTransferName: '',
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

  useEscapeKey([
    { condition: showInvoiceModal, close: () => setShowInvoiceModal(false) },
    { condition: showCustomerModal, close: () => setShowCustomerModal(false) },
    { condition: showPaymentModal, close: () => setShowPaymentModal(false) },
    { condition: showPreviewModal, close: () => setShowPreviewModal(false) },
    { condition: showExportModal, close: () => setShowExportModal(false) },
  ]);


  // Open the canonical payment form for an invoice selected in Project Detail.
  useEffect(() => {
    const invoiceId = (location.state as { paymentInvoiceId?: string } | null)?.paymentInvoiceId;
    if (!invoiceId) return;
    const invoice = customerInvoiceList.find(item => item.id === invoiceId);
    if (!invoice) return; // Wait for invoices to finish loading.
    setActiveTab('invoices');
    setSearchTerm(invoice.noInvoice || '');
    if (['Approved', 'Sent', 'Partial Paid', 'Overdue'].includes(invoice.status)) {
      setSelectedInvoice(invoice);
      setPaymentForm(prev => ({
        ...prev,
        nominal: Math.max(0, invoice.totalNominal - invoice.paidAmount),
        namaPengirim: invoice.customerName || '',
      }));
      setShowPaymentModal(true);
    } else {
      toast.error('Invoice belum dapat dibayar. Periksa status persetujuannya.');
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, customerInvoiceList, navigate]);

  // Handle navigation from Project page
  useEffect(() => {
    if (location.state && (location.state as any).fromProject) {
      const state = location.state as any;
      
      // Find or create customer
      let customerId = '';
      const existingCustomer = customerList.find(c => c.namaCustomer === state.customerName);
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
      
      setInvoiceForm({
        tanggal: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customerId: customerId,
        projectId: state.projectId || '',
        perihal: `Invoice for ${state.projectName}`,
        items: [{
          deskripsi: state.projectName,
          qty: 1,
          satuan: 'Lot',
          hargaSatuan: state.defaultAmount || 0
        }],
        ppn: 11,
        pph: 0,
        diskon: 0,
        noKontrak: '',
        noPO: '',
        termin: 'Termin 1',
        remark: `Auto-generated from Project: ${state.projectName}`
      });
      
      setShowInvoiceModal(true);
      setIsEditMode(false);
      
      toast.success('✅ Invoice form auto-populated from Project!', {
        description: `Ready to create invoice for ${state.projectName}`
      });
      
      // Clear location state
      navigate(location.pathname, { replace: true, state: {} });
    }

  }, [location.state, customerList, navigate, location.pathname]);

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthRoman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth()];
    const todayInvoices = customerInvoiceList.filter(i => i.tanggal.startsWith(`${year}-${month}`));
    const nextNum = String(todayInvoices.length + 1).padStart(3, '0');
    return `${nextNum}/TAG/GMT/${monthRoman}/${year}`;
  };

  // Generate customer code
  const generateCustomerCode = () => {
    const nextNum = String(customerList.length + 1).padStart(3, '0');
    return `CUST-${nextNum}`;
  };

  // Calculate aging days — negative = belum jatuh tempo (Current), positive = sudah lewat jatuh tempo (Overdue)
  const calculateAgingDays = (dueDate: string, status: string) => {
    if (status === 'Paid') return 0;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Add item to invoice
  const handleAddItem = () => {
    if (!itemForm.deskripsi.trim() || !itemForm.satuan.trim() || !Number.isFinite(itemForm.qty) || itemForm.qty <= 0 || !Number.isFinite(itemForm.hargaSatuan) || itemForm.hargaSatuan <= 0) {
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
    const diskonAmount = invoiceForm.diskon > 0 ? (subtotal * invoiceForm.diskon / 100) : 0;
    const afterDiskon = subtotal - diskonAmount;
    const ppn = invoiceForm.ppn > 0 ? (afterDiskon * invoiceForm.ppn / 100) : 0;
    const pph = invoiceForm.pph > 0 ? (afterDiskon * invoiceForm.pph / 100) : 0;
    const total = afterDiskon + ppn - pph;
    return { subtotal, diskonAmount, ppn, pph, total };
  };

  // Load form from quotation
  const handleLoadFromQuotation = (qId: string) => {
    if (!qId) {
      setInvoiceForm(prev => ({ ...prev, quotationId: '' }));
      return;
    }
    const q = (quotationList || []).find(q => q.id === qId);
    if (!q) return;

    const customerName = q.kepada || q.customer?.nama || (q as any).perusahaan || '';
    const existingCustomer = customerList.find(c =>
      c.namaCustomer === customerName ||
      c.namaCustomer?.toLowerCase().includes(customerName.toLowerCase().split(' ').slice(0, 2).join(' ')) ||
      customerName.toLowerCase().includes((c.namaCustomer || '').toLowerCase().split(' ').slice(0, 2).join(' '))
    );

    const items: any[] = [];
    (q.sections || []).forEach((sec: any) => {
      (sec.items || []).forEach((item: any) => {
        // Quotation hargaUnit/total are HPP, not the customer selling price.
        // Qty already carries the unit (e.g. kg); never treat a money total as qty.
        const qty = Number(item.qty ?? 1);
        const harga = Number(item.hargaJualUnit ?? item.hargaSatuan ?? 0);
        const total = qty * harga;
        items.push({
          id: 'ITEM-' + Date.now() + Math.random(),
          deskripsi: item.keterangan || item.deskripsi || item.nama || '',
          qty,
          satuan: item.satuan || 'LS',
          hargaSatuan: harga,
          jumlah: total
        });
      });
    });

    const qAny = q as any;
    const ppnRate = q.ppn
      ? (q.ppn > 1 ? q.ppn : q.ppn * 100)
      : (qAny.pricingConfig?.includePPN ? 11 : 0);
    const diskon = q.diskonPersen ?? qAny.pricingConfig?.discountPercent ?? 0;
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setInvoiceForm(prev => ({
      ...prev,
      quotationId: qId,
      customerId: existingCustomer?.id || prev.customerId,
      customerName: customerName,
      perihal: q.perihal || prev.perihal,
      items: items.length > 0 ? items : prev.items,
      ppn: ppnRate,
      diskon,
      tanggal: new Date().toISOString().split('T')[0],
      dueDate,
    }));

    toast.success('Data quotation berhasil dimuat!', {
      description: `${q.nomorQuotation || q.noPenawaran} — semua field masih bisa diedit.`
    });
  };

  // Submit invoice
  // Handle navigate from QuotationPage "Buat Invoice"
  useEffect(() => {
    if (location.state && (location.state as any).createFromQuotation) {
      const qId = (location.state as any).createFromQuotation;
      setShowInvoiceModal(true);
      setIsEditMode(false);
      handleLoadFromQuotation(qId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, quotationList, customerList]);

  const handleSubmitInvoice = async () => {
    if (isSubmitting) return;
    const hasCustomer = invoiceForm.customerId || invoiceForm.customerName;
    if (!hasCustomer || !invoiceForm.perihal || invoiceForm.items.length === 0) {
      toast.error('Lengkapi semua field yang diperlukan!', {
        description: !hasCustomer ? 'Customer belum dipilih.' : !invoiceForm.perihal ? 'Perihal kosong.' : 'Minimal 1 item harus diisi.'
      });
      return;
    }

    const customer = customerList.find(c => c.id === invoiceForm.customerId);
    const project = projectList.find(p => p.id === invoiceForm.projectId);
    if (project?.status === 'Completed') {
      const hasBast = (beritaAcaraList || []).some((ba: any) =>
        ba.refProject === project.id && (!ba.status || ba.status === 'Approved') && ['Penerimaan Pekerjaan', 'Penyelesaian Pekerjaan', 'Serah Terima Barang', 'Serah Terima'].includes(ba.jenisBA || ba.jenis)
      );
      if (!hasBast) {
        toast.error('Invoice final belum dapat dibuat', { description: 'Project Completed wajib memiliki BAST yang terhubung.' });
        return;
      }
    }
    const resolvedCustomerName = customer?.namaCustomer || invoiceForm.customerName;
    const { subtotal, diskonAmount, ppn, pph, total } = calculateTotals();

    const newInvoice = {
      id: 'INV-' + Date.now(),
      noInvoice: generateInvoiceNumber(),
      tanggal: invoiceForm.tanggal,
      dueDate: invoiceForm.dueDate,
      customerId: invoiceForm.customerId || undefined,
      customerName: resolvedCustomerName,
      projectId: invoiceForm.projectId || undefined,
      projectName: project?.namaProject || undefined,
      perihal: invoiceForm.perihal,
      items: invoiceForm.items,
      subtotal,
      diskon: invoiceForm.diskon || undefined,
      diskonAmount: diskonAmount || undefined,
      ppnRate: invoiceForm.ppn,
      ppn,
      pphRate: invoiceForm.pph,
      pph,
      totalNominal: total,
      paidAmount: 0,
      outstandingAmount: total,
      status: 'Draft' as any,
      paymentHistory: [],
      noKontrak: invoiceForm.noKontrak || undefined,
      noPO: invoiceForm.noPO || undefined,
      tanggalPO: invoiceForm.tanggalPO || undefined,
      up: invoiceForm.up || undefined,
      termin: invoiceForm.termin || undefined,
      remark: invoiceForm.remark || undefined,
      quotationId: invoiceForm.quotationId || undefined,
      invoiceId: invoiceForm.invoiceId || undefined,
      createdBy: currentUser?.fullName || 'Admin',
      createdAt: new Date().toISOString()
    };

    setIsSubmitting(true);
    try {
      await addCustomerInvoice(newInvoice);
      setShowInvoiceModal(false);
      resetInvoiceForm();
    } catch (err) {
      toast.error('Gagal menyimpan invoice: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit payment
  const handleSubmitPayment = async () => {
    if (isSubmitting) return;
    if (!selectedInvoice || paymentForm.nominal <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0!');
      return;
    }

    // Gunakan data live dari store agar tidak bisa over-pay jika ada concurrent update
    const liveInvoice = customerInvoiceList.find(inv => inv.id === selectedInvoice.id);
    const currentOutstanding = liveInvoice?.outstandingAmount ?? selectedInvoice.outstandingAmount;

    if (paymentForm.nominal > currentOutstanding) {
      toast.error(`Nominal melebihi sisa tagihan (${formatCurrency(currentOutstanding)})!`);
      return;
    }

    const newPayment = {
      id: 'PAY-' + Date.now(),
      tanggal: paymentForm.tanggal,
      nominal: paymentForm.nominal,
      metodeBayar: paymentForm.metodeBayar,
      noBukti: paymentForm.noBukti || undefined,
      bankPengirim: paymentForm.bankPengirim || undefined,
      rekeningTujuan: paymentForm.rekeningTujuan || undefined,
      namaPengirim: paymentForm.namaPengirim || undefined,
      buktiTransferUrl: paymentForm.buktiTransferUrl || undefined,
      buktiTransferName: paymentForm.buktiTransferName || undefined,
      remark: paymentForm.remark || undefined,
      createdBy: currentUser?.fullName || 'Admin',
      createdAt: new Date().toISOString()
    };

    setIsSubmitting(true);
    try {
      const saved = await addInvoicePayment(selectedInvoice.id, newPayment);
      if (!saved) return;
      setShowPaymentModal(false);
      resetPaymentForm();
      setSelectedInvoice(null);
    } catch (err) {
      toast.error('Gagal mencatat pembayaran: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit customer
  const handleSubmitCustomer = async () => {
    if (isSubmitting) return;
    if (!customerForm.namaCustomer || !customerForm.alamat) {
      toast.error('Lengkapi field yang diperlukan!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && selectedInvoice) {
        await updateCustomer(selectedInvoice.id, {
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
        await addCustomer(newCustomer);
      }

      setShowCustomerModal(false);
      resetCustomerForm();
      setIsEditMode(false);
    } catch (err) {
      toast.error('Gagal menyimpan customer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send invoice
  const handleSendInvoice = async (invoiceId: string) => {
    if (processingId) return;
    setProcessingId(invoiceId);
    try {
      await updateCustomerInvoice(invoiceId, {
        status: 'Pending',
        sentAt: new Date().toISOString()
      });
      toast.success('Invoice dikirim ke Approval Center untuk disetujui.');
    } catch (err) {
      toast.error('Gagal mengirim invoice: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  // Cancel invoice
  const handleCancelInvoice = async (invoiceId: string) => {
    if (processingId) return;
    if (!window.confirm('Yakin ingin membatalkan invoice ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setProcessingId(invoiceId);
    try {
      await updateCustomerInvoice(invoiceId, {
        status: 'Cancelled'
      });
      toast.warning('Invoice dibatalkan!');
    } catch (err) {
      toast.error('Gagal membatalkan invoice: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      tanggal: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customerId: '',
      customerName: '',
      projectId: '',
      perihal: '',
      items: [],
      ppn: 11,
      pph: 0,
      diskon: 0,
      noKontrak: '',
      noPO: '',
      tanggalPO: '',
      up: '',
      termin: '',
      remark: '',
      quotationId: '',
      invoiceId: '',
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      tanggal: new Date().toISOString().split('T')[0],
      nominal: 0,
      metodeBayar: 'Transfer',
      noBukti: '',
      bankPengirim: '',
      rekeningTujuan: DEFAULT_COMPANY_ACCOUNT,
      namaPengirim: '',
      remark: '',
      buktiTransferUrl: '',
      buktiTransferName: '',
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
    return customerInvoiceList
      .map(inv => ({
        ...inv,
        agingDays: calculateAgingDays(inv.dueDate, inv.status)
      }))
      .filter(inv => {
        const matchesSearch = 
          inv.noInvoice.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (inv.projectName && inv.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = filterStatus === 'All' || inv.status === filterStatus;
        const matchesCustomer = filterCustomer === 'All' || inv.customerId === filterCustomer;

        return matchesSearch && matchesStatus && matchesCustomer;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [customerInvoiceList, searchTerm, filterStatus, filterCustomer]);

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalAR = customerInvoiceList.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalInvoiced = customerInvoiceList.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalPaid = customerInvoiceList.reduce((sum, inv) => sum + inv.paidAmount, 0);
    
    const overdueInvoices = customerInvoiceList.filter(inv => {
      if (inv.status === 'Paid') return false;
      const agingDays = calculateAgingDays(inv.dueDate, inv.status);
      return agingDays > 0;
    });
    
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    // Aging brackets
    const aging0to30 = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days >= 0 && days <= 30 && inv.status !== 'Paid';
    }).reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const aging31to60 = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days >= 31 && days <= 60 && inv.status !== 'Paid';
    }).reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const aging61to90 = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days >= 61 && days <= 90 && inv.status !== 'Paid';
    }).reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const agingOver90 = customerInvoiceList.filter(inv => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 90 && inv.status !== 'Paid';
    }).reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    return {
      totalAR,
      totalInvoiced,
      totalPaid,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      aging0to30,
      aging31to60,
      aging61to90,
      agingOver90
    };
  }, [customerInvoiceList]);

  // Customer stats
  const customerStats = useMemo(() => {
    return customerList.map(customer => {
      const invoices = customerInvoiceList.filter(inv => inv.customerId === customer.id);
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
  }, [customerList, customerInvoiceList]);

  // Status badge
  const getStatusBadge = (status: string) => {
    const badges: any = {
      'Draft': { color: 'bg-gray-100 text-gray-700', icon: FileText },
      'Pending': { color: 'bg-amber-100 text-amber-700', icon: Clock },
      'Approved': { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
      'Revision': { color: 'bg-orange-100 text-orange-700', icon: RotateCcw },
      'Rejected': { color: 'bg-rose-100 text-rose-700', icon: XCircle },
      'Sent': { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
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
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
            <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <span className="truncate">Accounts Receivable (AR)</span>
        </h1>
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
              <option value="Pending">Pending Approval</option>
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
              {customerList.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.namaCustomer}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total AR</span>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(dashboardMetrics.totalAR)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Invoiced</span>
                <Receipt className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(dashboardMetrics.totalInvoiced)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Paid</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardMetrics.totalPaid)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Overdue</span>
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(dashboardMetrics.overdueAmount)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dashboardMetrics.overdueCount} invoice(s)
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sumber</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
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
                        <td className="px-4 py-3 text-center">
                          {invoice.quotationId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title={`Dari Quotation: ${(quotationList || []).find(q => q.id === invoice.quotationId)?.noPenawaran || invoice.quotationId}`}>
                              <FileText className="w-3 h-3" /> Quotation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Manual
                            </span>
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
                          {invoice.status === 'Paid' ? (
                            <span className="text-gray-400 text-xs">Lunas</span>
                          ) : invoice.agingDays < 0 ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                              Current ({Math.abs(invoice.agingDays)}h lagi)
                            </span>
                          ) : invoice.agingDays === 0 ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                              Jatuh Tempo Hari Ini
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              invoice.agingDays > 90 ? 'bg-red-100 text-red-700' :
                              invoice.agingDays > 60 ? 'bg-orange-100 text-orange-700' :
                              invoice.agingDays > 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-50 text-red-600'
                            }`}>
                              Telat {invoice.agingDays} hari
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {(invoice.status === 'Draft' || invoice.status === 'Rejected') && (
                              <button
                                onClick={() => handleSendInvoice(invoice.id)}
                                disabled={processingId === invoice.id}
                                className="p-1 hover:bg-blue-50 rounded text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Kirim Invoice"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {(invoice.status === 'Approved' || invoice.status === 'Sent' || invoice.status === 'Partial Paid' || invoice.status === 'Overdue') && (
                              <button
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setShowPaymentModal(true);
                                  setPaymentForm(prev => ({
                                    ...prev,
                                    nominal: invoice.outstandingAmount,
                                    namaPengirim: invoice.customerName || '',
                                    rekeningTujuan: invoice.rekeningTujuan || prev.rekeningTujuan || DEFAULT_COMPANY_ACCOUNT,
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
                            <button
                              onClick={async () => {
                                try {
                                  await exportInvoiceToXlsx({
                                    ...invoice,
                                    customer: invoice.customerName,
                                    alamat: invoice.customerAddress || invoice.alamat || '',
                                    jatuhTempo: invoice.dueDate,
                                    totalBayar: invoice.totalNominal,
                                    items: invoice.items || [],
                                  });
                                  toast.success('Invoice Excel berhasil diunduh!');
                                } catch {
                                  toast.error('Export invoice gagal');
                                }
                              }}
                              className="p-1 hover:bg-emerald-50 rounded text-emerald-600"
                              title="Download Invoice Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
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
                {formatCurrency(dashboardMetrics.totalAR)}
              </div>
              <div className="text-xs opacity-80">
                Dari {customerInvoiceList.filter(inv => inv.status !== 'Paid').length} invoice aktif
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Total Invoiced</span>
                <Receipt className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(dashboardMetrics.totalInvoiced)}
              </div>
              <div className="text-xs opacity-80">
                {customerInvoiceList.length} total invoices
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Total Collected</span>
                <CheckCircle className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(dashboardMetrics.totalPaid)}
              </div>
              <div className="text-xs opacity-80">
                {((dashboardMetrics.totalPaid / dashboardMetrics.totalInvoiced) * 100).toFixed(1)}% collection rate
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium opacity-90">Overdue Amount</span>
                <AlertCircle className="w-6 h-6 opacity-80" />
              </div>
              <div className="text-3xl font-bold mb-2">
                {formatCurrency(dashboardMetrics.overdueAmount)}
              </div>
              <div className="text-xs opacity-80">
                {dashboardMetrics.overdueCount} overdue invoice(s)
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
                  {formatCurrency(dashboardMetrics.aging0to30)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {((dashboardMetrics.aging0to30 / dashboardMetrics.totalAR) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-700 mb-2">31-60 days</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(dashboardMetrics.aging31to60)}
                </div>
                <div className="text-xs text-yellow-600 mt-1">
                  {((dashboardMetrics.aging31to60 / dashboardMetrics.totalAR) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-700 mb-2">61-90 days</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(dashboardMetrics.aging61to90)}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  {((dashboardMetrics.aging61to90 / dashboardMetrics.totalAR) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-700 mb-2">Over 90 days</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(dashboardMetrics.agingOver90)}
                </div>
                <div className="text-xs text-red-600 mt-1">
                  {((dashboardMetrics.agingOver90 / dashboardMetrics.totalAR) * 100).toFixed(1)}%
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
              {customerStats.slice(0, 5).map((customer, index) => (
                <div key={customer.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
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
                {/* Pilih dari Quotation */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-blue-800 mb-2">
                    Isi otomatis dari Quotation <span className="font-normal text-blue-600">(opsional — field tetap bisa diedit)</span>
                  </label>
                  <select
                    value={invoiceForm.quotationId}
                    onChange={(e) => handleLoadFromQuotation(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                  >
                    <option value="">-- Input manual --</option>
                    {(quotationList || []).filter(q => q.clientApprovalStatus === 'Approved' || q.status === 'Approved').map(q => (
                      <option key={q.id} value={q.id}>
                        {q.nomorQuotation || q.noPenawaran} — {q.kepada || q.customer?.nama || q.perusahaan}
                      </option>
                    ))}
                  </select>
                  {invoiceForm.quotationId && (
                    <p className="text-xs text-blue-600 mt-1">✓ Data dari quotation dimuat. Semua field di bawah bisa diubah.</p>
                  )}
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
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, customerId: e.target.value, customerName: '' }))}
                      className={`w-full px-3 py-2 border rounded-lg ${!invoiceForm.customerId && invoiceForm.customerName ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
                    >
                      <option value="">
                        {invoiceForm.customerName ? `— ${invoiceForm.customerName} (dari quotation) —` : 'Pilih Customer'}
                      </option>
                      {customerList.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.namaCustomer}
                        </option>
                      ))}
                    </select>
                    {!invoiceForm.customerId && invoiceForm.customerName && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠ "{invoiceForm.customerName}" belum ada di masterdata. Invoice tetap bisa disimpan, atau pilih customer dari daftar.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Project (Optional)</label>
                    <select
                      value={invoiceForm.projectId}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, projectId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Pilih Project</option>
                      {projectList.map(project => (
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tanggal PO</label>
                    <input
                      type="date"
                      value={invoiceForm.tanggalPO}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, tanggalPO: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">UP / Attn</label>
                    <input
                      type="text"
                      value={invoiceForm.up}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, up: e.target.value }))}
                      placeholder="Accounting Department / Nama PIC"
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
                          aria-label="Jumlah"
                          placeholder="Jumlah (contoh: 2,5)"
                          min="0"
                          step="any"
                          value={itemForm.qty || ''}
                          onChange={(e) => setItemForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          aria-label="Satuan"
                          placeholder="Satuan (kg, pcs, Lot)"
                          value={itemForm.satuan}
                          onChange={(e) => setItemForm(prev => ({ ...prev, satuan: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          aria-label="Harga per Satuan"
                          placeholder="Harga per Satuan"
                          min="0"
                          step="any"
                          value={itemForm.hargaSatuan || ''}
                          onChange={(e) => setItemForm(prev => ({ ...prev, hargaSatuan: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-700">
                      Harga untuk 1 {itemForm.satuan.trim() || 'satuan'}. Total otomatis: <strong>{formatCurrency(itemForm.qty * itemForm.hargaSatuan)}</strong>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Jumlah × harga per satuan, dihitung sekali. Untuk harga total paket, gunakan jumlah 1 dan satuan Lot.</p>
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
                          <span>Diskon:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={invoiceForm.diskon}
                            onChange={(e) => setInvoiceForm(prev => ({ ...prev, diskon: Number(e.target.value) }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span>%</span>
                        </div>
                        <span className="font-medium text-orange-600">-{formatCurrency(calculateTotals().diskonAmount)}</span>
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
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Invoice'}
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

      {/* PAYMENT MODAL */}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Nominal Pembayaran *</label>
                    <button
                      type="button"
                      onClick={() => setPaymentForm(prev => ({ ...prev, nominal: selectedInvoice.outstandingAmount }))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Fill Outstanding ({formatCurrency(selectedInvoice.outstandingAmount)})
                    </button>
                  </div>
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
                  <label className="block text-sm font-medium mb-1">
                    Nama Pengirim <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentForm.namaPengirim}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, namaPengirim: e.target.value }))}
                    placeholder="Otomatis memakai nama customer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Bank Pengirim <span className="text-gray-400 font-normal">(opsional)</span>
                    </label>
                    <select
                      value={['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN'].includes(paymentForm.bankPengirim) || paymentForm.bankPengirim === '' ? paymentForm.bankPengirim : 'Lainnya'}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, bankPengirim: e.target.value === 'Lainnya' ? '' : e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">— Pilih Bank —</option>
                      {['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN','Lainnya'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {!['BCA','Mandiri','BNI','BRI','CIMB Niaga','Permata','Danamon','BSI','BTN',''].includes(paymentForm.bankPengirim) && (
                      <input
                        type="text"
                        autoFocus
                        value={paymentForm.bankPengirim}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, bankPengirim: e.target.value }))}
                        placeholder="Nama bank..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1.5"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rekening Perusahaan Penerima *</label>
                    <select
                      value={paymentForm.rekeningTujuan}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, rekeningTujuan: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {COMPANY_BANK_ACCOUNTS.map(account => (
                        <option key={account.id} value={account.id}>{account.label}</option>
                      ))}
                    </select>
                  </div>
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
                  <label className="block text-sm font-medium mb-1">
                    Upload Bukti Transfer <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  {paymentForm.buktiTransferUrl ? (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-3">
                      {paymentForm.buktiTransferUrl.startsWith('data:image') ? (
                        <img
                          src={paymentForm.buktiTransferUrl}
                          alt="Bukti Transfer"
                          className="w-16 h-16 object-cover rounded-lg border border-green-200 cursor-pointer"
                          onClick={() => window.open(paymentForm.buktiTransferUrl, '_blank')}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-7 h-7 text-green-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 truncate">{paymentForm.buktiTransferName}</p>
                        <p className="text-xs text-green-600">File berhasil diupload</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentForm(prev => ({ ...prev, buktiTransferUrl: '', buktiTransferName: '' }))}
                        className="p-1 hover:bg-green-100 rounded text-green-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Download className="w-6 h-6 rotate-180" />
                        <span className="text-sm font-medium">Klik untuk upload</span>
                        <span className="text-xs">PNG, JPG, PDF (maks. 5MB)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('File terlalu besar! Maksimal 5MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setPaymentForm(prev => ({
                              ...prev,
                              buktiTransferUrl: ev.target?.result as string,
                              buktiTransferName: file.name,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
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
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
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

      {/* CUSTOMER MODAL */}
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
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Menyimpan...' : `${isEditMode ? 'Update' : 'Simpan'} Customer`}
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

      {/* PREVIEW INVOICE MODAL */}
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
                  {selectedInvoice.noPO && (
                    <div>
                      <div className="text-sm text-gray-600">No. PO</div>
                      <div className="font-medium">{selectedInvoice.noPO}</div>
                    </div>
                  )}
                  {selectedInvoice.tanggalPO && (
                    <div>
                      <div className="text-sm text-gray-600">Tanggal PO</div>
                      <div className="font-medium">{new Date(selectedInvoice.tanggalPO).toLocaleDateString('id-ID')}</div>
                    </div>
                  )}
                  {selectedInvoice.up && (
                    <div className="col-span-2">
                      <div className="text-sm text-gray-600">UP / Attn</div>
                      <div className="font-medium">{selectedInvoice.up}</div>
                    </div>
                  )}
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
                      {selectedInvoice.items.map((item: any) => (
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
                      <span>PPN ({selectedInvoice.ppnRate ?? Math.round(selectedInvoice.ppn / selectedInvoice.subtotal * 100)}%):</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.ppn)}</span>
                    </div>
                  )}
                  {selectedInvoice.pph > 0 && (
                    <div className="flex justify-between">
                      <span>PPh ({selectedInvoice.pphRate ?? Math.round(selectedInvoice.pph / selectedInvoice.subtotal * 100)}%):</span>
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

                {/* Approval History */}
                {selectedInvoice.approvalHistory?.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Riwayat Approval</h3>
                    <div className="space-y-2">
                      {selectedInvoice.approvalHistory.map((h: any, i: number) => (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${h.action === 'Approved' ? 'bg-emerald-50 border-emerald-200' : h.action === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`font-bold text-xs uppercase tracking-wide ${h.action === 'Approved' ? 'text-emerald-700' : h.action === 'Rejected' ? 'text-rose-700' : 'text-orange-700'}`}>{h.action === 'Revision' ? 'Diminta Revisi' : h.action}</span>
                              <div className="text-gray-600 mt-0.5">oleh <span className="font-medium">{h.by}</span> • {new Date(h.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
                              {h.reason && <div className="mt-1 text-gray-700 italic">"{h.reason}"</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment History */}
                {selectedInvoice.paymentHistory.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-3">Riwayat Pembayaran</h3>
                    <div className="space-y-2">
                      {selectedInvoice.paymentHistory.map((payment: any) => (
                        <div key={payment.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <div className="font-medium">{formatCurrency(payment.nominal)}</div>
                              <div className="text-sm text-gray-600">
                                {new Date(payment.tanggal).toLocaleDateString('id-ID')} • {payment.metodeBayar}
                              </div>
                              {payment.namaPengirim && <div className="text-xs text-gray-500">Dari: {payment.namaPengirim}</div>}
                              {payment.bankPengirim && <div className="text-xs text-gray-500">Bank: {payment.bankPengirim}</div>}
                              {payment.noBukti && <div className="text-xs text-gray-500">No. Bukti: {payment.noBukti}</div>}
                              {payment.remark && <div className="text-xs text-gray-500 italic">{payment.remark}</div>}
                            </div>
                            <div className="flex items-start gap-2">
                              {payment.buktiTransferUrl && (
                                payment.buktiTransferUrl.startsWith('data:image') ? (
                                  <img
                                    src={payment.buktiTransferUrl}
                                    alt="Bukti TF"
                                    className="w-14 h-14 object-cover rounded-lg border border-green-300 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(payment.buktiTransferUrl, '_blank')}
                                    title={payment.buktiTransferName}
                                  />
                                ) : (
                                  <a
                                    href={payment.buktiTransferUrl}
                                    download={payment.buktiTransferName}
                                    className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 border border-green-300"
                                    title={payment.buktiTransferName}
                                  >
                                    <FileText className="w-6 h-6 text-green-600" />
                                  </a>
                                )
                              )}
                              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                            </div>
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

      {/* Export Modal */}
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Export Rekap Piutang</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-gray-500 mb-5">Pilih format export untuk laporan AR/piutang saat ini.</p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    toast.loading('Generating Word...', { id: 'ar-word' });
                    try {
                      const unpaid = customerInvoiceList.filter(i => i.status !== 'Paid');
                      await exportPiutangToWord({
                        totalOutstanding: unpaid.reduce((s, i) => s + i.outstandingAmount, 0),
                        overdueInvoices: unpaid.filter(i => new Date(i.dueDate) < new Date()).length,
                        invoiceList: unpaid.map(i => ({
                          invoiceNo: i.noInvoice,
                          customer: customerList.find(c => c.id === i.customerId)?.namaCustomer || '-',
                          amount: i.totalNominal,
                          dueDate: i.dueDate,
                          status: new Date(i.dueDate) < new Date() ? 'Overdue' : 'Pending',
                          daysOverdue: Math.max(0, Math.ceil((new Date().getTime() - new Date(i.dueDate).getTime()) / 86400000))
                        }))
                      });
                      toast.success('Word exported!', { id: 'ar-word' });
                    } catch { toast.error('Export gagal', { id: 'ar-word' }); }
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-3 font-medium"
                >
                  <FileText className="w-5 h-5" /> Export ke Word (.doc)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
    </div>
  );
}
