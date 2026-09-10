import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  FileText, Plus, X, Printer, Save, Download, DollarSign,
  CheckCircle, XCircle, Clock, Send, Copy, ArrowUpRight,
  TrendingUp, Calculator, Users, Package, Wrench, ShoppingCart,
  Percent, CreditCard, FileCheck, AlertCircle, Building2, Award,
  ChevronDown, ChevronRight, Zap, Target, Settings, Calendar,
  MapPin, Eye, Trash2, History, RotateCcw, Pencil, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadQuotationWordDocument } from '../../components/QuotationWordExport';
import { exportQuotationToXlsx } from '../../utils/quotationExcelExport';
import { loadSampleQuotation } from '../../data/sampleQuotationGTP';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// Quotation Management Page - Transformed to Commercial Pricing Tool
export default function QuotationPage() {
  const { quotationList, addQuotation, updateQuotation, deleteQuotation, addAuditLog, dataCollectionList, addProject, projectList, customerList = [] } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSurveyListModal, setShowSurveyListModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [creationMode, setCreationMode] = useState<'from-survey' | 'manual'>('from-survey');
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isResubmit, setIsResubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});

  // Ensure quotationList is always an array
  const safeQuotationList = Array.isArray(quotationList) ? quotationList : [];

  // Get available surveys for quotation
  const availableSurveys = dataCollectionList.filter(dc => 
    dc.status === 'Completed' || dc.status === 'Verified'
  );

  const [formData, setFormData] = useState({
    noPenawaran: '',
    revisi: 'A',
    tanggal: new Date().toISOString().split('T')[0],
    jenisQuotation: 'Jasa' as 'Jasa' | 'Material',
    kepada: '',
    perusahaan: '',
    lokasi: '',
    up: '',
    lampiran: '-',
    perihal: '',
    validityDays: 30,
    customerId: '',
    dataCollectionId: '', // Track which survey this came from
    // Multi-unit pricing
    unitCount: 1,
    enableMultiUnit: false,
    ppnPercent: 11,
    includePpn: false,
    kotaCustomer: '',
    paragrafPembuka: '',
    kotaPenandatangan: 'Bekasi',
    namaPenandatangan: 'Syamsudin',
  });

  // Pricing Configuration
  const [pricingConfig, setPricingConfig] = useState({
    // Markup by category (%)
    manpowerMarkup: 25,
    materialsMarkup: 20,
    equipmentMarkup: 30,
    consumablesMarkup: 15,
    // Additional fees
    overheadPercent: 10,
    contingencyPercent: 5,
    // Discount
    discountPercent: 0,
    discountReason: '',
  });

  // Payment Terms
  const [paymentTerms, setPaymentTerms] = useState({
    type: 'termin' as 'full' | 'termin' | 'dp-progress',
    termins: [
      { label: 'DP (Down Payment)', percent: 30, timing: 'Setelah PO' },
      { label: 'Termin 1', percent: 30, timing: '30% Progress' },
      { label: 'Termin 2', percent: 30, timing: '60% Progress' },
      { label: 'Pelunasan', percent: 10, timing: 'Setelah BAST' },
    ],
    paymentDueDays: 30,
    retention: 5, // % retention
    retentionPeriod: 90, // days
    // Penalty clause
    penaltyEnabled: false,
    penaltyRate: 0.1,
    penaltyMax: 5,
    penaltyCondition: 'keterlambatan penyelesaian pekerjaan',
  });

  // Commercial Terms
  const [commercialTerms, setCommercialTerms] = useState({
    warranty: '12 bulan setelah BAST',
    delivery: 'FOB Warehouse',
    installation: 'Termasuk instalasi dan commissioning',
    penalty: '0.1% per hari (max 5% dari nilai kontrak)',
    conditions: [
      'Harga belum termasuk PPN 11%',
      'Harga sudah termasuk biaya pengiriman area Jakarta',
      'Pembayaran melalui transfer ke rekening perusahaan',
      'Force majeure: bencana alam, kebakaran, perang, dll',
    ],
    // Scope & Exclusions
    scopeOfWork: [] as string[],
    exclusions: [] as string[],
    projectDuration: 0,
    penaltyOvertime: 0,
  });

  useEscapeKey([
    { condition: showCreateModal, close: () => { setShowCreateModal(false); setEditingId(null); } },
    { condition: showSurveyListModal, close: () => setShowSurveyListModal(false) },
    { condition: showPreview, close: () => setShowPreview(false) },
  ]);

  // Dynamic sections for pricing items
  const [sections, setSections] = useState<Array<{
    id: string;
    nama: string;
    items: Array<{
      id: string;
      keterangan: string;
      subKeterangan: string;
      qty: number;
      satuan: string;
      hargaJualUnit: number;
      disc?: number;
      hargaJual: number;
    }>;
  }>>([{ id: 'sec-1', nama: 'Jasa Kerja', items: [] }]);

  // Generate nomor penawaran
  const generateNoPenawaran = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    
    // Get latest number
    const currentQuotations = safeQuotationList.filter(q => {
      const qYear = new Date(q.tanggal).getFullYear();
      return qYear === year;
    });
    
    const nextNumber = currentQuotations.length + 1;
    
    return `${String(nextNumber).padStart(3, '0')}/${formData.revisi}/PEN/GTP/${romanMonths[month - 1]}/${year}`;
  };

  const openEditQuotation = (q: any) => {
    setEditingId(q.id);
    setCreationMode('manual');
    setFormData({
      noPenawaran: q.noPenawaran || q.nomorQuotation || '',
      revisi: q.revisi || 'A',
      tanggal: q.tanggal || new Date().toISOString().split('T')[0],
      jenisQuotation: q.jenisQuotation || 'Jasa',
      kepada: q.kepada || q.customer?.nama || '',
      perusahaan: q.perusahaan || '',
      lokasi: q.lokasi || q.customer?.alamat || '',
      up: q.up || '',
      lampiran: q.lampiran || '-',
      perihal: q.perihal || '',
      validityDays: q.validityDays || 30,
      customerId: q.customerId || '',
      dataCollectionId: q.dataCollectionId || '',
      unitCount: q.unitCount || 1,
      enableMultiUnit: q.enableMultiUnit || false,
      ppnPercent: q.ppnPercent || 11,
      includePpn: q.includePpn || false,
      openingParagraph: q.openingParagraph || '',
      kotaPenandaTangan: q.kotaPenandaTangan || 'Bekasi',
      namaPenandaTangan: q.namaPenandaTangan || 'Syamsudin',
      discountPercent: q.discountPercent || q.diskonPersen || 0,
      paymentDueDays: q.paymentDueDays || 30,
      retentionPercent: q.retentionPercent || 5,
      retentionDays: q.retentionDays || 90,
      paymentStructure: q.paymentStructure || 'full',
      paymentTermins: q.paymentTermins || [],
      warranty: q.warranty || '12 bulan setelah BAST',
      deliveryTerms: q.deliveryTerms || 'FOB Warehouse',
      installation: q.installation || 'Termasuk instalasi dan commissioning',
      penaltyClause: q.penaltyClause || '0.1% per hari (max 5% dari nilai kontrak)',
      notes: q.notes || q.catatan || [],
    } as any);
    setSections(q.sections || []);
    setShowCreateModal(true);
  };

  // Load data from selected survey
  const loadFromSurvey = (survey: any) => {
    setSelectedSurvey(survey);
    
    // Populate form data
    const matchedCustomer = customerList.find(c =>
      c.namaCustomer?.toLowerCase() === (survey.namaResponden || '').toLowerCase() ||
      c.namaCustomer?.toLowerCase() === (survey.perusahaan || '').toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      kepada: survey.namaResponden || '',
      customerId: matchedCustomer?.id || '',
      lokasi: survey.lokasi || '',
      perihal: `Penawaran ${survey.tipePekerjaan || 'Pekerjaan'}`,
      dataCollectionId: survey.id,
    }));

    // Map survey data ke dynamic sections
    const makeItem = (id: string, keterangan: string, qty: number, satuan: string, _surveyCost: number, notes = '') => {
      // Survey costs are not customer selling prices; enter the agreed price explicitly.
      return { id, keterangan, subKeterangan: notes, qty, satuan, hargaJualUnit: 0, disc: 0, hargaJual: 0 };
    };
    const newSections: typeof sections = [];
    if ((survey.manpower || []).length > 0) newSections.push({ id: `sec-mp-${Date.now()}`, nama: 'Manpower', items: survey.manpower.map((mp: any) => makeItem(`mp-${Date.now()}-${Math.random()}`, mp.position || mp.jabatan || 'Tenaga Kerja', mp.quantity || mp.jumlah || 1, 'Orang', mp.upah || mp.hargaSatuan || 0, mp.notes || mp.keterangan || '')) });
    if ((survey.materials || []).length > 0) newSections.push({ id: `sec-mat-${Date.now()}`, nama: 'Material', items: survey.materials.map((mat: any) => makeItem(`mat-${Date.now()}-${Math.random()}`, mat.materialName || mat.nama || 'Material', mat.qtyEstimate || mat.qty || 0, mat.unit || 'Pcs', mat.hargaSatuan || mat.unitPrice || 0, mat.notes || mat.keterangan || '')) });
    if ((survey.equipment || []).length > 0) newSections.push({ id: `sec-eq-${Date.now()}`, nama: 'Equipment', items: survey.equipment.map((eq: any) => makeItem(`eq-${Date.now()}-${Math.random()}`, eq.equipmentName || eq.namaAlat || 'Equipment', eq.quantity || eq.jumlah || 1, eq.unit || eq.satuan || 'Unit', eq.biayaSewa || eq.hargaSatuan || 0, eq.notes || eq.keterangan || '')) });
    if ((survey.consumables || []).length > 0) newSections.push({ id: `sec-con-${Date.now()}`, nama: 'Consumables', items: survey.consumables.map((con: any) => makeItem(`con-${Date.now()}-${Math.random()}`, con.nama || con.materialName || 'Consumable', con.qty || con.qtyEstimate || 0, con.unit || 'Pcs', con.hargaSatuan || 0, con.notes || '')) });
    if (newSections.length === 0) newSections.push({ id: 'sec-1', nama: 'Item', items: [] });
    setSections(newSections);
    
    toast.success('Data Survey Berhasil Dimuat!', {
      description: `${survey.noKoleksi} - ${survey.namaResponden}`
    });

    setShowSurveyListModal(false);
  };


  // Handle navigation from Data Collection
  React.useEffect(() => {
    if (location.state?.fromDataCollection && location.state?.dataCollectionId) {
      const dcId = location.state.dataCollectionId;
      const dataCollection = dataCollectionList.find(dc => dc.id === dcId);
      
      if (dataCollection) {
        // Auto-open modal and load data
        setCreationMode('from-survey');
        loadFromSurvey(dataCollection);
        setShowCreateModal(true);
        
        // Clear location state to prevent re-triggering
        window.history.replaceState({}, document.title);
        
        toast.success(`📋 Data dari "${dataCollection.namaResponden}" berhasil dimuat!`);
      }
    }
  }, [location.state]);

  // Calculate totals from dynamic sections
  const calculateCommercialTotals = () => {
    let totalHargaJual = 0;
    sections.forEach(sec => sec.items.forEach(item => {
      const qty = item.qty || 0;
      totalHargaJual += (item.hargaJualUnit || 0) * qty;
    }));
    const discount = totalHargaJual * ((pricingConfig.discountPercent || 0) / 100);
    const grandTotal = totalHargaJual - discount;
    return { totalSelling: totalHargaJual, discount, grandTotal };
  };

  // Load Sample Quotation - PT Gema Teknik Perkasa Real Case
  const handleLoadSample = () => {
    const sample = loadSampleQuotation();
    
    setFormData({
      noPenawaran: sample.noPenawaran,
      revisi: sample.revisi,
      tanggal: sample.tanggal,
      jenisQuotation: sample.jenisQuotation,
      kepada: sample.kepada,
      perusahaan: sample.perusahaan,
      lokasi: sample.lokasi,
      up: sample.up,
      lampiran: sample.lampiran,
      perihal: sample.perihal,
      validityDays: sample.validityDays,
      dataCollectionId: '',
      unitCount: sample.unitCount,
      enableMultiUnit: sample.enableMultiUnit,
      ppnPercent: 11,
      includePpn: false,
      kotaCustomer: sample.kotaCustomer || '',
      paragrafPembuka: sample.paragrafPembuka || '',
      kotaPenandatangan: sample.kotaPenandatangan || 'Bekasi',
      namaPenandatangan: sample.namaPenandatangan || 'Syamsudin',
    });

    setPricingConfig(sample.pricingConfig);
    if (sample.sections) setSections(sample.sections);
    setPaymentTerms(sample.paymentTerms);
    setCommercialTerms(sample.commercialTerms);
    
    setCreationMode('manual');
    setShowCreateModal(true);

    toast.success('Sample Quotation Loaded!', {
      description: '573/PEN/GMT/X/2025 - PT Gema Teknik Perkasa Real Case'
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.kepada || !formData.perihal) {
      toast.error('Lengkapi data wajib: Kepada dan Perihal!');
      return;
    }
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    if (totalItems === 0) {
      toast.error('Tambahkan minimal 1 item ke dalam section sebelum menyimpan!');
      return;
    }
    const hasEmptyItem = sections.some(s => s.items.some(i => !i.keterangan.trim() || !i.satuan.trim() || !Number.isFinite(i.qty) || i.qty <= 0 || !Number.isFinite(i.hargaJualUnit) || i.hargaJualUnit <= 0));
    if (hasEmptyItem) {
      toast.error('Lengkapi keterangan, satuan, jumlah, dan harga jual per satuan yang lebih dari 0.');
      return;
    }

    const commercialTotals = calculateCommercialTotals();

    if (editingId) {
      const resubmitFields = isResubmit ? {
        status: 'Pending Approval',
        internalApprovalStatus: 'Pending',
        clientApprovalStatus: 'Pending',
        internalRejectReason: undefined,
        clientRejectReason: undefined,
      } : {};
      setIsSubmitting(true);
      try {
        const saved = await updateQuotation(editingId, {
          ...formData,
          pricingConfig,
          sections,
          paymentTerms,
          commercialTerms,
          ...commercialTotals,
          updatedAt: new Date().toISOString(),
          ...resubmitFields,
        } as any);
        if (saved === undefined) {
          toast.error('Perubahan quotation gagal disimpan ke server.');
          return;
        }
        addAuditLog({
          action: isResubmit ? 'RESUBMIT_QUOTATION' : 'UPDATE_QUOTATION',
          module: 'Sales',
          details: `${isResubmit ? 'Submit ulang' : 'Update'} Quotation ${formData.noPenawaran}`,
          status: 'Success',
        });
        toast.success(isResubmit
          ? `✅ ${formData.noPenawaran} disubmit ulang untuk approval!`
          : `Quotation ${formData.noPenawaran} berhasil diperbarui!`
        );
        setShowCreateModal(false);
        setEditingId(null);
        setIsResubmit(false);
      } catch (error) {
        toast.error(`Quotation gagal diperbarui: ${error instanceof Error ? error.message : 'Kesalahan database'}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const quotationId = `QUO-${Date.now()}`;
    // Nomor final dihitung di backend agar selalu unik untuk semua pengguna.
    const noPenawaran = `AUTO/QUO/${new Date().getFullYear()}/${quotationId.slice(-6)}`;

    const newQuotation = {
      ...formData,
      id: quotationId,
      noPenawaran,
      pricingConfig,
      sections,
      paymentTerms,
      commercialTerms,
      ...commercialTotals,
      status: 'Draft' as any,
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      sourceType: creationMode,
      surveyReference: selectedSurvey ? {
        id: selectedSurvey.id,
        noKoleksi: selectedSurvey.noKoleksi,
        namaResponden: selectedSurvey.namaResponden
      } : null,
    };

    setIsSubmitting(true);
    try {
      await addQuotation(newQuotation);
    } catch (error) {
      toast.error(`Quotation gagal disimpan: ${error instanceof Error ? error.message : 'Kesalahan database'}`);
      setIsSubmitting(false);
      return;
    }
    addAuditLog({
      action: 'CREATE_QUOTATION',
      module: 'Sales',
      details: `Membuat Quotation ${noPenawaran} - ${formData.kepada}`,
      status: 'Success'
    });

    toast.success('Quotation Berhasil Dibuat!', {
      description: `${noPenawaran} | Total: Rp ${commercialTotals.grandTotal.toLocaleString('id-ID')}`
    });

    setIsSubmitting(false);
    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      noPenawaran: '',
      revisi: 'A',
      tanggal: new Date().toISOString().split('T')[0],
      jenisQuotation: 'Jasa',
      kepada: '',
      perusahaan: '',
      lokasi: '',
      up: '',
      lampiran: '-',
      perihal: '',
      validityDays: 30,
      dataCollectionId: '',
      kotaCustomer: '',
      paragrafPembuka: '',
      kotaPenandatangan: 'Bekasi',
      namaPenandatangan: 'Syamsudin',
    });
    setSections([{ id: 'sec-1', nama: 'Jasa Kerja', items: [] }]);
    setSelectedSurvey(null);
    setCreationMode('from-survey');
  };

  // Section helpers
  const addSection = () => {
    const id = `sec-${Date.now()}`;
    setSections(prev => [...prev, { id, nama: 'Section Baru', items: [] }]);
    setExpandedSections(prev => ({ ...prev, [id]: true }));
  };

  const updateSectionName = (secId: string, nama: string) => {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, nama } : s));
  };

  const deleteSection = (secId: string) => {
    setSections(prev => prev.filter(s => s.id !== secId));
  };

  const addItem = (secId: string) => {
    const newItem = { id: `item-${Date.now()}`, keterangan: '', subKeterangan: '', qty: 1, satuan: 'Lot', hargaJualUnit: 0, hargaJual: 0 };
    setSections(prev => prev.map(s => s.id === secId ? { ...s, items: [...s.items, newItem] } : s));
  };

  const updateItemField = (secId: string, itemId: string, field: string, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== secId) return s;
      return {
        ...s,
        items: s.items.map(item => {
          if (item.id !== itemId) return item;
          const updated = { ...item, [field]: value };
          // Recalculate on any relevant field change
          const qty = updated.qty || 0;
          const jualUnit = updated.hargaJualUnit || 0;
          updated.hargaJual = qty * jualUnit;
          return updated;
        })
      };
    }));
  };

  const deleteItem = (secId: string, itemId: string) => {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updatePaymentTermin = (index: number, field: string, value: any) => {
    const newTermins = [...paymentTerms.termins];
    newTermins[index] = { ...newTermins[index], [field]: value };
    setPaymentTerms({ ...paymentTerms, termins: newTermins });
  };

  const addPaymentTermin = () => {
    setPaymentTerms({
      ...paymentTerms,
      termins: [
        ...paymentTerms.termins,
        { label: `Termin ${paymentTerms.termins.length + 1}`, percent: 0, timing: '' }
      ]
    });
  };

  const commercialTotals = calculateCommercialTotals();

  // Filtered quotations
  const filteredQuotations = safeQuotationList.filter(q => {
    const matchSearch = q.noPenawaran?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       q.kepada?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || q.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'Planning':       'bg-slate-100 text-slate-700',
      'Pending Approval': 'bg-yellow-100 text-yellow-800',
      'Approved':       'bg-green-100 text-green-800',
      'In Progress':    'bg-blue-100 text-blue-800',
      'Pending Review': 'bg-orange-100 text-orange-800',
      'On Hold':        'bg-purple-100 text-purple-800',
      'Complete':       'bg-emerald-100 text-emerald-800',
      'Rejected':       'bg-red-100 text-red-800',
      'Draft':          'bg-gray-100 text-gray-600',
      'Revised':        'bg-orange-100 text-orange-700',
      'Sent':           'bg-cyan-100 text-cyan-800',
    };
    return variants[status] || variants['Draft'];
  };

  const getStatusLabel = (quotation: any) => {
    if (quotation.status === 'Approved' && quotation.projectId) return 'Converted to Project';
    if (quotation.status === 'Review') return 'Approval Internal';
    if (quotation.status === 'Sent') return 'Terkirim';
    if (quotation.status === 'Approved') return 'Disetujui';
    if (quotation.status === 'Rejected') return 'Ditolak';
    return quotation.status;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Commercial Quotation Management</h1>
            <p className="text-sm text-gray-600">Transform Technical Data → Commercial Proposal with Smart Pricing</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <FileText className="w-3.5 h-3.5" />
              Total Quotations
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              Pending
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => q.status === 'Pending Approval' || q.status === 'Pending Review' || q.status === 'Draft' || q.status === 'Planning').length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Send className="w-3.5 h-3.5 text-blue-600" />
              In Progress
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => q.status === 'In Progress').length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              Approved / Complete
            </div>
            <div className="font-bold text-gray-900">{safeQuotationList.filter(q => q.status === 'Approved' || q.status === 'Complete').length}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <button
          onClick={() => {
            setCreationMode('from-survey');
            if (availableSurveys.length > 0) {
              setShowSurveyListModal(true);
            } else {
              toast.error('Tidak ada survey yang selesai', {
                description: 'Silakan selesaikan Data Collection terlebih dahulu'
              });
            }
          }}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Zap className="w-5 h-5" />
          Create from Survey (Smart Pricing)
        </button>
        <button
          onClick={() => {
            setCreationMode('manual');
            setShowCreateModal(true);
          }}
          className="flex-1 bg-white text-gray-700 px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Manual Quotation
        </button>
        <button
          onClick={handleLoadSample}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Eye className="w-5 h-5" />
          Load Sample (Real GTP)
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by number or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Quotation List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">No. Penawaran</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Tanggal</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Customer</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700">Perihal</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-700">Grand Total</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Status</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Source</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((quotation) => (
                <tr key={quotation.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="text-sm font-medium text-blue-600">{quotation.noPenawaran}</div>
                    {(quotation.revisionNo || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                        Rev {quotation.revisionNo}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-600">{new Date(quotation.tanggal).toLocaleDateString('id-ID')}</td>
                  <td className="p-3">
                    <div className="text-sm font-medium text-gray-900">{quotation.kepada}</div>
                    {quotation.perusahaan && <div className="text-xs text-gray-500">{quotation.perusahaan}</div>}
                  </td>
                  <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{quotation.perihal}</td>
                  <td className="p-3 text-sm font-semibold text-right text-gray-900">
                    Rp {(quotation.grandTotal || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(quotation.status)}`}>
                      {getStatusLabel(quotation)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {quotation.dataCollectionId ? (() => {
                      const sourceDataCollection = dataCollectionList.find(dc => dc.id === quotation.dataCollectionId);
                      return (
                        <button
                          onClick={() => navigate('/data-collection')}
                          className="flex items-center justify-center gap-1 mx-auto px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition-colors"
                          title={sourceDataCollection ? `From: ${sourceDataCollection.noKoleksi}` : 'From Data Collection'}
                        >
                          <Zap className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-xs text-purple-600 font-medium">Data Collection</span>
                        </button>
                      );
                    })() : (
                      <div className="flex items-center justify-center gap-1">
                        <Settings className="w-3.5 h-3.5 text-gray-600" />
                        <span className="text-xs text-gray-600">Manual</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedQuotation(quotation);
                          setShowPreview(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const filename = `Quotation_${quotation.noPenawaran}_${new Date().toISOString().split('T')[0]}.doc`;
                            downloadQuotationWordDocument(quotation, filename);
                            toast.success('Export Word berhasil!');
                          } catch (error) {
                            toast.error('Export gagal, silakan coba lagi');
                          }
                        }}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Export Word"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditQuotation(quotation)}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Edit / Update"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {(quotation.status === 'Draft' || quotation.status === 'Revised') && (
                        <button
                          disabled={processingId === quotation.id}
                          onClick={async () => {
                            if (!confirm(`Submit "${quotation.noPenawaran}" untuk approval?`)) return;
                            setProcessingId(quotation.id);
                            try {
                              const saved = await updateQuotation(quotation.id, {
                                status: 'Pending Approval',
                                internalApprovalStatus: 'Pending',
                                clientApprovalStatus: 'Pending',
                              } as any);
                              if (saved === undefined) {
                                toast.error('Submit gagal disimpan ke server.');
                                return;
                              }
                              toast.success(`✅ ${quotation.noPenawaran} disubmit untuk approval!`);
                            } catch (err) {
                              toast.error('Submit gagal: ' + (err instanceof Error ? err.message : 'Error'));
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                          title={quotation.status === 'Revised' ? 'Submit Ulang untuk Approval' : 'Submit untuk Approval'}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {(quotation as any).clientApprovalStatus === 'Approved' && (
                        <button
                          onClick={() => navigate('/finance/accounts-receivable', { state: { createFromQuotation: quotation.id } })}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Buat Invoice"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        disabled={processingId === quotation.id}
                        onClick={() => {
                          if (confirm(`Hapus quotation "${quotation.noPenawaran}"? Tindakan ini tidak dapat dibatalkan.`)) {
                            setProcessingId(quotation.id);
                            try {
                              deleteQuotation(quotation.id);
                              toast.success('Quotation deleted');
                            } finally {
                              setProcessingId(null);
                            }
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No quotations found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Survey Selection Modal */}
        {showSurveyListModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSurveyListModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h2 className="font-bold text-xl">Select Survey Data</h2>
                    <p className="text-sm text-blue-100 mt-1">Import technical data and apply commercial pricing</p>
                  </div>
                  <button onClick={() => setShowSurveyListModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-3">
                  {availableSurveys.map(survey => (
                    <div
                      key={survey.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
                      onClick={() => {
                        loadFromSurvey(survey);
                        setShowCreateModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-blue-600">{survey.noKoleksi}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              survey.status === 'Completed' ? 'bg-green-100 text-green-700' :
                              survey.status === 'Verified' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {survey.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900 font-medium mb-1">{survey.namaResponden}</div>
                          <div className="text-xs text-gray-600 mb-2">{survey.lokasi}</div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(survey.tanggalPengumpulan).toLocaleDateString('id-ID')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {(survey.manpower || []).length} Manpower
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5" />
                              {(survey.materials || []).length} Materials
                            </span>
                            <span className="flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              {(survey.equipment || []).length} Equipment
                            </span>
                          </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>

                {availableSurveys.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 font-medium mb-2">No Completed Surveys Available</p>
                    <p className="text-sm text-gray-500">Complete a Data Collection survey first to use Smart Pricing</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* Create/Edit Modal - MEGA FORM */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-7xl w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleCreate}>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <h2 className="font-bold text-xl">
                        {creationMode === 'from-survey' ? '⚡ Smart Commercial Quotation' : 'Manual Quotation'}
                      </h2>
                      <p className="text-sm text-blue-100 mt-1">
                        {creationMode === 'from-survey' && selectedSurvey ? (
                          <>From Survey: {selectedSurvey.noKoleksi} - {selectedSurvey.namaResponden}</>
                        ) : (
                          'Create quotation with manual data entry'
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* SECTION 1: Basic Information */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-600">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-gray-900">Basic Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={formData.tanggal}
                          onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Validity Period (Days)</label>
                        <input
                          type="number"
                          value={formData.validityDays || 30}
                          onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kepada (Customer)</label>
                        <select
                          value={formData.customerId}
                          onChange={(e) => {
                            const cust = customerList.find(c => c.id === e.target.value);
                            setFormData({
                              ...formData,
                              customerId: e.target.value,
                              kepada: cust?.namaCustomer || formData.kepada,
                              perusahaan: cust?.namaCustomer || formData.perusahaan,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 mb-1"
                        >
                          <option value="">-- Pilih dari Master Customer --</option>
                          {customerList.map(c => (
                            <option key={c.id} value={c.id}>{c.namaCustomer}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Atau ketik manual jika belum terdaftar"
                          value={formData.kepada}
                          onChange={(e) => setFormData({ ...formData, kepada: e.target.value, customerId: '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Proyek</label>
                        <input
                          type="text"
                          value={formData.lokasi}
                          onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">UP (Attn)</label>
                        <input
                          type="text"
                          value={formData.up}
                          onChange={(e) => setFormData({ ...formData, up: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Di (Kota Customer)</label>
                        <input
                          type="text"
                          value={formData.kotaCustomer}
                          onChange={(e) => setFormData({ ...formData, kotaCustomer: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="Contoh: Bekasi, Tangerang..."
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perihal</label>
                        <input
                          type="text"
                          value={formData.perihal}
                          onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paragraf Pembuka</label>
                        <textarea
                          value={formData.paragrafPembuka}
                          onChange={(e) => setFormData({ ...formData, paragrafPembuka: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
                          rows={3}
                          placeholder="Contoh: Sehubungan dengan permintaan Bapak/Ibu mengenai penawaran..., maka dengan ini kami ajukan penawaran sebagai berikut :"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Pricing Items */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-green-600">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-gray-900">Rincian Harga</h3>
                      </div>
                      <button
                        type="button"
                        onClick={addSection}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Section
                      </button>
                    </div>

                    {sections.map((sec, secIdx) => (
                      <div key={sec.id} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                        {/* Section Header */}
                        <div className="flex items-center gap-2 bg-slate-100 px-3 py-2">
                          <span className="text-sm font-bold text-slate-600 w-6">{['I','II','III','IV','V','VI','VII','VIII','IX','X'][secIdx] || secIdx+1}</span>
                          <input
                            type="text"
                            value={sec.nama}
                            onChange={e => updateSectionName(sec.id, e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-gray-900 placeholder:text-slate-400"
                            placeholder="Nama section..."
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                            className="p-1 text-slate-500 hover:text-slate-700"
                          >
                            {expandedSections[sec.id] === false ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSection(sec.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {expandedSections[sec.id] !== false && (
                          <div className="p-4 bg-white">
                            <div className="overflow-x-auto mb-3">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left p-2 text-[11px] font-semibold text-gray-900 w-6">No</th>
                                    <th className="text-left p-2 text-[11px] font-semibold text-gray-900">Keterangan</th>
                                    <th className="text-center p-2 text-[11px] font-semibold text-gray-900 w-16">Qty</th>
                                    <th className="text-center p-2 text-[11px] font-semibold text-gray-900 w-20">Satuan</th>
                                    <th className="text-right p-2 text-[11px] font-semibold text-blue-700 w-32">Jual/Unit</th>
                                    <th className="text-right p-2 text-[11px] font-semibold text-green-700 w-32">Total Jual</th>
                                    <th className="w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sec.items.map((item, itemIdx) => (
                                    <tr key={item.id} className="border-t border-gray-100 align-top">
                                      <td className="p-2 text-gray-500 text-xs text-center pt-3">{itemIdx + 1}</td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={item.keterangan}
                                          onChange={e => updateItemField(sec.id, item.id, 'keterangan', e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 mb-1"
                                          placeholder="Keterangan item..."
                                        />
                                        <textarea
                                          value={item.subKeterangan}
                                          onChange={e => updateItemField(sec.id, item.id, 'subKeterangan', e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 resize-none"
                                          rows={2}
                                          placeholder="Spesifikasi / catatan tambahan (opsional)..."
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          value={item.qty}
                                          onChange={e => updateItemField(sec.id, item.id, 'qty', parseFloat(e.target.value) || 0)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-900"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={item.satuan}
                                          onChange={e => updateItemField(sec.id, item.id, 'satuan', e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-900"
                                          placeholder="Lot"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          value={item.hargaJualUnit || ''}
                                          onChange={e => updateItemField(sec.id, item.id, 'hargaJualUnit', parseFloat(e.target.value) || 0)}
                                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm text-right text-blue-900 bg-blue-50 font-medium"
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="p-2 text-right text-sm font-semibold text-green-700 pt-3">
                                        {((item.hargaJualUnit || 0) * (item.qty || 0)).toLocaleString('id-ID')}
                                      </td>
                                      <td className="p-2 pt-3">
                                        <button type="button" onClick={() => deleteItem(sec.id, item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                  {sec.items.length === 0 && (
                                    <tr>
                                      <td colSpan={7} className="p-4 text-center text-gray-400 text-sm italic">Belum ada item. Klik "Tambah Item" untuk menambahkan.</td>
                                    </tr>
                                  )}
                                </tbody>
                                {sec.items.length > 0 && (
                                  <tfoot>
                                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                                      <td colSpan={5} className="p-2 text-right text-xs font-bold text-gray-600 uppercase">Subtotal {sec.nama}</td>
                                      <td className="p-2 text-right text-sm font-bold text-green-700">{sec.items.reduce((s, i) => s + (i.hargaJualUnit || 0) * (i.qty || 0), 0).toLocaleString('id-ID')}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                            <button
                              type="button"
                              onClick={() => addItem(sec.id)}
                              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Tambah Item
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* SECTION 4: Financial Summary */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-yellow-600">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      <h3 className="font-bold text-gray-900">Financial Summary</h3>
                    </div>
                    
                    {/* Multi-Unit Toggle */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enableMultiUnit}
                          onChange={(e) => setFormData({ ...formData, enableMultiUnit: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Multi-Unit Pricing</span>
                      </label>
                      {formData.enableMultiUnit && (
                        <div className="mt-3 flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Unit Count:</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.unitCount}
                            onChange={(e) => setFormData({ ...formData, unitCount: parseInt(e.target.value) || 1 })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                          <span className="text-xs text-gray-500">units</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-600 rounded-lg p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Sub Total (Harga Jual)</div>
                          <div className="font-bold text-2xl text-gray-900">
                            Rp {commercialTotals.totalSelling.toLocaleString('id-ID')}
                          </div>
                        </div>
                        {/* Diskon */}
                        <div className="col-span-2 border-t border-yellow-300 pt-3">
                          <div className="flex items-center gap-3 mb-2">
                            <label className="text-sm font-medium text-gray-700">Diskon (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={pricingConfig.discountPercent || 0}
                              onChange={(e) => setPricingConfig({ ...pricingConfig, discountPercent: parseFloat(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500"
                            />
                            <span className="text-sm text-gray-600">
                              = Rp {(commercialTotals.totalSelling * (pricingConfig.discountPercent || 0) / 100).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Grand Total</div>
                          <div className="font-bold text-2xl text-green-700">
                            Rp {(commercialTotals.totalSelling * (1 - (pricingConfig.discountPercent || 0) / 100)).toLocaleString('id-ID')}
                          </div>
                        </div>
                        {/* PPN */}
                        <div className="col-span-2 border-t border-yellow-300 pt-3">
                          <div className="flex items-center gap-3 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.includePpn}
                                onChange={e => setFormData({ ...formData, includePpn: e.target.checked })}
                                className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                              />
                              <span className="text-sm font-medium text-gray-700">Include PPN</span>
                            </label>
                            {formData.includePpn && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={formData.ppnPercent}
                                  onChange={e => setFormData({ ...formData, ppnPercent: parseFloat(e.target.value) || 0 })}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500"
                                />
                                <span className="text-sm text-gray-600">%</span>
                              </div>
                            )}
                          </div>
                          {formData.includePpn && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-600 mb-1">PPN ({formData.ppnPercent}%)</div>
                                <div className="font-semibold text-lg text-orange-600">
                                  Rp {(commercialTotals.grandTotal * formData.ppnPercent / 100).toLocaleString('id-ID')}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-600 mb-1">Total + PPN</div>
                                <div className="font-bold text-2xl text-green-700">
                                  Rp {(commercialTotals.grandTotal * (1 + formData.ppnPercent / 100)).toLocaleString('id-ID')}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Multi-Unit Total */}
                        {formData.enableMultiUnit && formData.unitCount > 1 && (
                          <div className="col-span-2 bg-emerald-100 border-2 border-emerald-600 rounded-lg p-4 mt-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-emerald-700 mb-1">Total for {formData.unitCount} Units</div>
                                <div className="font-bold text-3xl text-emerald-700">
                                  Rp {(commercialTotals.grandTotal * formData.unitCount).toLocaleString('id-ID')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-emerald-600">Per Unit</div>
                                <div className="text-sm text-emerald-700">
                                  Rp {commercialTotals.grandTotal.toLocaleString('id-ID')}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* SECTION 5: Payment Terms */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-indigo-600">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-gray-900">Payment Terms</h3>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Structure</label>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'full' })}
                          className={`p-2 rounded-lg border-2 text-sm text-gray-900 ${
                            paymentTerms.type === 'full' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          Full Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'termin' })}
                          className={`p-2 rounded-lg border-2 text-sm text-gray-900 ${
                            paymentTerms.type === 'termin' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          Termin
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTerms({ ...paymentTerms, type: 'dp-progress' })}
                          className={`p-2 rounded-lg border-2 text-sm text-gray-900 ${
                            paymentTerms.type === 'dp-progress' ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-white'
                          }`}
                        >
                          DP + Progress
                        </button>
                      </div>

                      {paymentTerms.type !== 'full' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">Payment Schedule</label>
                            <button
                              type="button"
                              onClick={addPaymentTermin}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Termin
                            </button>
                          </div>
                          <div className="space-y-2">
                            {paymentTerms.termins.map((termin, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                  type="text"
                                  value={termin.label}
                                  onChange={(e) => updatePaymentTermin(idx, 'label', e.target.value)}
                                  className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                  placeholder="Label..."
                                />
                                <input
                                  type="number"
                                  value={termin.percent || 0}
                                  onChange={(e) => updatePaymentTermin(idx, 'percent', parseFloat(e.target.value) || 0)}
                                  className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm text-right text-gray-900"
                                  placeholder="%"
                                />
                                <span className="col-span-1 text-sm text-gray-600">%</span>
                                <input
                                  type="text"
                                  value={termin.timing}
                                  onChange={(e) => updatePaymentTermin(idx, 'timing', e.target.value)}
                                  className="col-span-4 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                  placeholder="Timing..."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTermins = paymentTerms.termins.filter((_, i) => i !== idx);
                                    setPaymentTerms({ ...paymentTerms, termins: newTermins });
                                  }}
                                  className="col-span-1 p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-sm font-medium text-indigo-700">
                            Total: {paymentTerms.termins.reduce((sum, t) => sum + t.percent, 0)}%
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due (Days)</label>
                          <input
                            type="number"
                            value={paymentTerms.paymentDueDays || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, paymentDueDays: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Retention %</label>
                          <input
                            type="number"
                            step="0.1"
                            value={paymentTerms.retention || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, retention: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Retention Period (Days)</label>
                          <input
                            type="number"
                            value={paymentTerms.retentionPeriod || 0}
                            onChange={(e) => setPaymentTerms({ ...paymentTerms, retentionPeriod: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 6: Commercial Terms & Conditions */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-teal-600">
                      <FileCheck className="w-5 h-5 text-teal-600" />
                      <h3 className="font-bold text-gray-900">Commercial Terms & Conditions</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                        <input
                          type="text"
                          value={commercialTerms.warranty}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, warranty: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                        <input
                          type="text"
                          value={commercialTerms.delivery}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, delivery: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Installation</label>
                        <input
                          type="text"
                          value={commercialTerms.installation}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, installation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Clause</label>
                        <input
                          type="text"
                          value={commercialTerms.penalty}
                          onChange={(e) => setCommercialTerms({ ...commercialTerms, penalty: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Catatan / Syarat Penawaran</label>
                      {commercialTerms.conditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={cond}
                            onChange={(e) => {
                              const newConditions = [...commercialTerms.conditions];
                              newConditions[idx] = e.target.value;
                              setCommercialTerms({ ...commercialTerms, conditions: newConditions });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newConditions = commercialTerms.conditions.filter((_, i) => i !== idx);
                              setCommercialTerms({ ...commercialTerms, conditions: newConditions });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCommercialTerms({
                            ...commercialTerms,
                            conditions: [...commercialTerms.conditions, '']
                          });
                        }}
                        className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Catatan
                      </button>
                    </div>
                  </div>
                  {/* SECTION 7: Penutup / Tanda Tangan */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gray-400">
                      <Award className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-900">Penutup / Tanda Tangan</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kota Penanda Tangan</label>
                        <input
                          type="text"
                          value={formData.kotaPenandatangan}
                          onChange={(e) => setFormData({ ...formData, kotaPenandatangan: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="Bekasi"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penanda Tangan</label>
                        <input
                          type="text"
                          value={formData.namaPenandatangan}
                          onChange={(e) => setFormData({ ...formData, namaPenandatangan: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="Syamsudin"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    onClick={() => setIsResubmit(false)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    {isSubmitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Create Quotation'}
                  </button>
                  {editingId && (() => {
                    const editedQ = safeQuotationList.find(q => q.id === editingId);
                    if (editedQ?.status === 'Draft' || editedQ?.status === 'Revised') {
                      return (
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          onClick={() => setIsResubmit(true)}
                          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-5 h-5" />
                          Submit untuk Approval
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

      {/* Preview Modal */}
        {showPreview && selectedQuotation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-between">
                <div className="text-white">
                  <h2 className="font-bold text-xl">{selectedQuotation.noPenawaran}</h2>
                  <p className="text-sm text-blue-100">{selectedQuotation.kepada}</p>
                </div>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-4 text-sm text-gray-900">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-900"><strong>Tanggal:</strong> {new Date(selectedQuotation.tanggal).toLocaleDateString('id-ID')}</div>
                    <div className="text-gray-900"><strong>Validity:</strong> {selectedQuotation.validityDays} hari</div>
                    <div className="text-gray-900"><strong>Perusahaan:</strong> {selectedQuotation.perusahaan || '-'}</div>
                    <div className="text-gray-900"><strong>Lokasi:</strong> {selectedQuotation.lokasi}</div>
                    <div className="col-span-2 text-gray-900"><strong>Perihal:</strong> {selectedQuotation.perihal}</div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2 text-gray-900">Financial Summary</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-gray-900">Subtotal Harga Jual:</div>
                        <div className="text-right font-semibold text-gray-900">Rp {(selectedQuotation.totalSelling || 0).toLocaleString('id-ID')}</div>
                        <div className="font-bold text-lg border-t pt-2 text-gray-900">Grand Total:</div>
                        <div className="text-right font-bold text-lg text-green-700 border-t pt-2">Rp {(selectedQuotation.grandTotal || 0).toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Revision History Cards */}
                  {selectedQuotation.revisionHistory?.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <RotateCcw className="w-4 h-4 text-orange-500" />
                        <h4 className="font-bold text-gray-900 text-sm">Riwayat Revisi</h4>
                        <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          {selectedQuotation.revisionHistory.length} revisi
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedQuotation.revisionHistory.map((rev: any) => {
                          const secs: any[] = rev.sections || [];
                          const totalItems = secs.reduce((s: number, sec: any) => s + (sec.items?.length || 0), 0);
                          return (
                            <div key={rev.no} className="border border-orange-100 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-orange-50">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white">Rev {rev.no}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rev.trigger === 'Internal' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                    {rev.trigger === 'Internal' ? 'Internal' : 'Client'}
                                  </span>
                                  <span className="text-xs text-gray-500">oleh {rev.by}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(rev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                              <div className="px-4 py-3 space-y-2">
                                <p className="text-xs text-gray-600 italic">"{rev.reason}"</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>Grand Total saat itu: <strong className="text-gray-800">Rp {(rev.grandTotal || 0).toLocaleString('id-ID')}</strong></span>
                                  <span>{totalItems} item · {secs.length} section</span>
                                </div>
                                {secs.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {secs.map((sec: any, si: number) => (
                                      <div key={si} className="text-[10px] text-gray-500">
                                        <span className="font-semibold text-gray-700">{sec.nama || sec.title || sec.label}:</span>{' '}
                                        {(sec.items || []).map((it: any) => it.keterangan).filter(Boolean).join(', ') || '-'}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Riwayat Approval */}
                  {selectedQuotation.quotationApprovalHistory?.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <History className="w-4 h-4 text-violet-500" />
                        <h4 className="font-bold text-gray-900 text-sm">Riwayat Approval</h4>
                        <span className="ml-auto text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{selectedQuotation.quotationApprovalHistory.length} aksi</span>
                      </div>
                      <div className="space-y-0 relative">
                        {selectedQuotation.quotationApprovalHistory.map((h: any, idx: number) => {
                          const isApproved = h.action.includes('Approved');
                          const isRejected = h.action.includes('Rejected');
                          const isLast = idx === selectedQuotation.quotationApprovalHistory.length - 1;
                          return (
                            <div key={idx} className="flex gap-3 relative">
                              {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-100" />}
                              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                isApproved ? 'bg-emerald-100 text-emerald-600'
                                : isRejected ? 'bg-rose-100 text-rose-500'
                                : 'bg-orange-100 text-orange-500'
                              }`}>
                                {isApproved ? <CheckCircle className="w-3 h-3" /> : isRejected ? <XCircle className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                              </div>
                              <div className="pb-4 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-bold uppercase ${isApproved ? 'text-emerald-700' : isRejected ? 'text-rose-600' : 'text-orange-600'}`}>
                                    {h.action}
                                  </span>
                                  <span className="text-[10px] text-gray-400">oleh {h.by}</span>
                                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                                {h.reason && <p className="text-xs text-gray-500 italic mt-0.5">"{h.reason}"</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedQuotation.dataCollectionId && (() => {
                    const sourceDataCollection = dataCollectionList.find(dc => dc.id === selectedQuotation.dataCollectionId);
                    return (
                      <div className="border-t pt-4">
                        <div className="bg-purple-50 border-2 border-purple-600 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-purple-700" />
                              <div>
                                <div className="font-bold text-purple-900">Created from Data Collection</div>
                                {sourceDataCollection && (
                                  <div className="text-sm text-purple-700">
                                    {sourceDataCollection.noKoleksi} - {sourceDataCollection.namaResponden}
                                  </div>
                                )}
                              </div>
                            </div>
                            {sourceDataCollection && (
                              <button
                                onClick={() => {
                                  setShowPreview(false);
                                  navigate('/data-collection');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                              >
                                <ArrowUpRight size={16} />
                                View Source
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    try {
                      exportQuotationToXlsx(selectedQuotation);
                      toast.success('Export Excel berhasil!');
                    } catch {
                      toast.error('Export gagal, silakan coba lagi');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
    </div>
  );
}
