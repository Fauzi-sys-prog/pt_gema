import { useState, useEffect, useMemo } from 'react'; import { useLocation, useNavigate } from 'react-router-dom'; import {    Plus, Search, Eye, Edit, Trash2, Printer, FileText, Briefcase, CheckCircle, Users, Calendar, Package, Wrench, Save, X, ShoppingCart, XCircle, Send } from 'lucide-react'; import { useApp } from '../contexts/AppContext';
import type { Quotation, QuotationItem } from '../contexts/AppContext';
import { toast } from 'sonner@2.0.3';
import api from '../services/api';

// Import modal components from Data Collection
import { ManpowerModal, Manpower } from '../components/data-collection/ManpowerModal';
import { ScheduleModal, Schedule } from '../components/data-collection/ScheduleModal';
import { ConsumableModal, Consumable } from '../components/data-collection/ConsumableModal';
import { EquipmentModal, Equipment } from '../components/data-collection/EquipmentModal';

// Import quotation status actions
import { QuotationStatusActions } from '../components/quotation/QuotationStatusActions';
import { useQuotationActions } from '../hooks/useQuotationActions';

// Material Interface (same as Data Collection)
interface Material {
  id: string;
  materialName: string;
  specifications?: string[]; // Added for detailed item spec
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export default function ProjectQuotationPage() {
  const { quotationList, addQuotation, updateQuotation, deleteQuotation } = useApp();
  const [serverQuotationList, setServerQuotationList] = useState<Quotation[] | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'manpower' | 'schedule' | 'consumables' | 'equipment'>('overview');
  
  // Form State
  const [formData, setFormData] = useState<{
    nomorQuotation: string;
    tanggal: string;
    perihal: string;
    customerNama: string;
    customerAlamat: string;
    customerPIC: string;
    ppn: number;
    notes: string[];
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    materials: Material[];
    manpower: Manpower[];
    schedule: Schedule[];
    consumables: Consumable[];
    equipment: Equipment[];
    kategori: string;
    tipePekerjaan: string;
    jenisKontrak: string;
    dataCollectionRef?: string;
  }>({
    nomorQuotation: '',
    tanggal: new Date().toISOString().split('T')[0],
    perihal: '',
    customerNama: '',
    customerAlamat: '',
    customerPIC: '',
    ppn: 11,
    notes: [
      'Harga sudah termasuk pengiriman wilayah Jakarta dan sekitarnya',
      'Pembayaran 50% DP, 50% setelah barang diterima',
      'Waktu pengiriman 7-14 hari kerja',
      'Garansi 1 tahun untuk material dan workmanship'
    ],
    status: 'Draft',
    materials: [],
    manpower: [],
    schedule: [],
    consumables: [],
    equipment: [],
    kategori: '',
    tipePekerjaan: '',
    jenisKontrak: ''
  });
  
  // Material Modal State
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);
  const [materialForm, setMaterialForm] = useState<Material>({
    id: '',
    materialName: '',
    specifications: [],
    quantity: 0,
    unit: '',
    unitPrice: 0,
    totalPrice: 0
  });
  const [specInput, setSpecInput] = useState(''); // For adding new specification line
  
  // Manpower Modal State
  const [showManpowerModal, setShowManpowerModal] = useState(false);
  const [editingManpowerIndex, setEditingManpowerIndex] = useState<number | null>(null);
  
  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  
  // Consumable Modal State
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [editingConsumableIndex, setEditingConsumableIndex] = useState<number | null>(null);
  
  // Equipment Modal State
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  
  useEffect(() => {
    let mounted = true;
    const normalizeList = (payload: unknown): Quotation[] => {
      if (Array.isArray(payload)) return payload as Quotation[];
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return (payload as { items: Quotation[] }).items;
      }
      return [];
    };

    const loadQuotations = async () => {
      try {
        const response = await api.get('/quotations');
        if (!mounted) return;
        setServerQuotationList(normalizeList(response.data));
      } catch {
        if (!mounted) return;
        setServerQuotationList(null);
      }
    };

    loadQuotations();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveQuotationList = useMemo(() => {
    const merged = new Map<string, Quotation>();
    for (const row of serverQuotationList || []) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      merged.set(key, row);
    }
    for (const row of quotationList || []) {
      const key = String(row?.id || `${row?.nomorQuotation || ''}-${row?.tanggal || ''}`).trim();
      if (!key) continue;
      // Context wins for immediate UI updates after create/update/delete.
      merged.set(key, row);
    }
    return Array.from(merged.values());
  }, [serverQuotationList, quotationList]);
  
  // Check if coming from Data Collection
  useEffect(() => {
    if (location.state?.fromDataCollection) {
      const { 
        customerName, 
        location: custLocation, 
        materials, 
        manpower,
        schedule,
        consumables,
        equipment,
        kategori,
        tipePekerjaan,
        jenisKontrak,
        noKoleksi,
        dataCollectionId 
      } = location.state;
      
      // Pre-fill form with data from Data Collection
      setFormData(prev => ({
        ...prev,
        perihal: `Penawaran Harga untuk ${customerName}`,
        customerNama: customerName,
        customerAlamat: custLocation || '',
        kategori: kategori || '',
        tipePekerjaan: tipePekerjaan || '',
        jenisKontrak: jenisKontrak || '',
        materials: materials || [],
        manpower: manpower || [],
        schedule: schedule || [],
        consumables: consumables || [],
        equipment: equipment || [],
        dataCollectionRef: dataCollectionId
      }));
      
      // Show modal
      setShowModal(true);
      
      // Show success message
      toast.success(`Data Collection ${noKoleksi} berhasil dimuat`, {
        description: `Customer: ${customerName} | Materials: ${materials?.length || 0} | Manpower: ${manpower?.length || 0}`,
      });
    }
  }, [location.state]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateSubtotal = (materials: Material[]) => {
    return materials.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateTotalValue = (quotation: Quotation) => {
    const materialTotal = (quotation.materials || []).reduce((sum, item) => sum + item.totalPrice, 0);
    const manpowerTotal = (quotation.manpower || []).reduce((sum, item) => sum + item.totalCost, 0);
    const consumableTotal = (quotation.consumables || []).reduce((sum, item) => sum + item.totalCost, 0);
    const equipmentTotal = (quotation.equipment || []).reduce((sum, item) => sum + item.totalCost, 0);
    const subtotal = materialTotal + manpowerTotal + consumableTotal + equipmentTotal;
    const ppnValue = calculatePPN(subtotal, quotation.ppn);
    return calculateGrandTotal(subtotal, ppnValue);
  };

  const calculatePPN = (subtotal: number, ppnPercent: number) => {
    return subtotal * (ppnPercent / 100);
  };

  const calculateGrandTotal = (subtotal: number, ppn: number) => {
    return subtotal + ppn;
  };

  const filteredData = effectiveQuotationList.filter(item =>
    (item.nomorQuotation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.perihal || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.customer?.nama || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize quotation actions hook
  const { handleReject, handleSendToCustomer } = useQuotationActions({
    updateQuotation,
    formatCurrency,
    calculateTotalValue,
  });

  const handleViewDetail = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowDetailModal(true);
  };

  const handleEdit = (quotation: Quotation) => {
    setEditMode(true);
    setEditingId(quotation.id);
    setFormData({
      nomorQuotation: quotation.nomorQuotation,
      tanggal: quotation.tanggal,
      perihal: quotation.perihal,
      customerNama: quotation.customer?.nama || '',
      customerAlamat: quotation.customer?.alamat || '',
      customerPIC: quotation.customer?.pic || '',
      ppn: quotation.ppn,
      notes: quotation.notes,
      status: quotation.status,
      kategori: quotation.kategori || '',
      tipePekerjaan: quotation.tipePekerjaan || '',
      jenisKontrak: quotation.jenisKontrak || '',
      materials: quotation.materials || [],
      manpower: quotation.manpower || [],
      schedule: quotation.schedule || [],
      consumables: quotation.consumables || [],
      equipment: quotation.equipment || [],
      dataCollectionRef: quotation.dataCollectionRef
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quotationData = {
      id: editMode && editingId ? editingId : `QT-${Date.now()}`,
      nomorQuotation: formData.nomorQuotation || `QT-${new Date().getFullYear()}-${String(effectiveQuotationList.length + 1).padStart(3, '0')}`,
      tanggal: formData.tanggal,
      perihal: formData.perihal,
      customer: {
        nama: formData.customerNama,
        alamat: formData.customerAlamat,
        pic: formData.customerPIC
      },
      items: formData.materials.map((mat, idx) => ({
        no: idx + 1,
        namaBarang: mat.materialName,
        spesifikasi: mat.specifications || [],
        hargaUnit: mat.unitPrice,
        jumlah: mat.quantity,
        satuan: mat.unit
      })),
      ppn: formData.ppn,
      notes: formData.notes,
      status: formData.status,
      kategori: formData.kategori,
      tipePekerjaan: formData.tipePekerjaan,
      jenisKontrak: formData.jenisKontrak,
      materials: formData.materials,
      manpower: formData.manpower,
      schedule: formData.schedule,
      consumables: formData.consumables,
      equipment: formData.equipment,
      dataCollectionRef: formData.dataCollectionRef
    };
    
    try {
      if (editMode && editingId) {
        await updateQuotation(editingId, quotationData);
        toast.success('Quotation berhasil diupdate');
      } else {
        await addQuotation(quotationData as any);
        toast.success('Quotation berhasil dibuat');
      }
      resetForm();
    } catch {
      // error toast from AppContext
    }
  };

  const resetForm = () => {
    setFormData({
      nomorQuotation: '',
      tanggal: new Date().toISOString().split('T')[0],
      perihal: '',
      customerNama: '',
      customerAlamat: '',
      customerPIC: '',
      ppn: 11,
      notes: [
        'Harga sudah termasuk pengiriman wilayah Jakarta dan sekitarnya',
        'Pembayaran 50% DP, 50% setelah barang diterima',
        'Waktu pengiriman 7-14 hari kerja',
        'Garansi 1 tahun untuk material dan workmanship'
      ],
      status: 'Draft',
      materials: [],
      manpower: [],
      schedule: [],
      consumables: [],
      equipment: [],
      kategori: '',
      tipePekerjaan: '',
      jenisKontrak: ''
    });
    setShowModal(false);
    setEditMode(false);
    setEditingId(null);
    setActiveTab('overview');
  };

  const handlePrint = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleConvertToProject = (quotation: Quotation) => {
    const subtotal = calculateSubtotal(quotation.materials || []);
    const ppnValue = calculatePPN(subtotal, quotation.ppn);
    const grandTotal = calculateGrandTotal(subtotal, ppnValue);
    
    navigate('/project', {
      state: {
        fromQuotation: true,
        quotationId: quotation.id,
        quotationNumber: quotation.nomorQuotation,
        customerName: quotation.customer?.nama || '',
        customerAddress: quotation.customer?.alamat || '',
        customerPIC: quotation.customer?.pic || '',
        budget: grandTotal,
        perihal: quotation.perihal,
        materials: quotation.materials,
        manpower: quotation.manpower,
        schedule: quotation.schedule,
        consumables: quotation.consumables,
        equipment: quotation.equipment,
        dataCollectionRef: quotation.dataCollectionRef
      }
    });
  };

  const handleDelete = (quotation: Quotation) => {
    const confirmMsg = `Hapus quotation ${quotation.nomorQuotation}?\n\nCustomer: ${quotation.customer?.nama || 'N/A'}\nPerihal: ${quotation.perihal}\n\nData akan dihapus permanen!`;
    
    if (window.confirm(confirmMsg)) {
      deleteQuotation(quotation.id);
      toast.success('Quotation berhasil dihapus');
    }
  };

  // Material CRUD
  const handleAddMaterial = () => {
    setMaterialForm({
      id: '',
      materialName: '',
      specifications: [],
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0
    });
    setEditingMaterialIndex(null);
    setSpecInput('');
    setShowMaterialModal(true);
  };

  const handleEditMaterial = (index: number) => {
    setMaterialForm(formData.materials[index]);
    setEditingMaterialIndex(index);
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = (material: Material) => {
    const newMaterial = {
      ...material,
      id: material.id || `mat-${Date.now()}`,
      totalPrice: material.quantity * material.unitPrice
    };
    
    if (editingMaterialIndex !== null) {
      const updated = [...formData.materials];
      updated[editingMaterialIndex] = newMaterial;
      setFormData({ ...formData, materials: updated });
    } else {
      setFormData({ ...formData, materials: [...formData.materials, newMaterial] });
    }
    
    setShowMaterialModal(false);
  };

  const handleDeleteMaterial = (index: number) => {
    if (window.confirm('Hapus material ini?')) {
      const updated = formData.materials.filter((_, i) => i !== index);
      setFormData({ ...formData, materials: updated });
    }
  };

  // Manpower CRUD
  const handleAddManpower = () => {
    setEditingManpowerIndex(null);
    setShowManpowerModal(true);
  };

  const handleEditManpower = (index: number) => {
    setEditingManpowerIndex(index);
    setShowManpowerModal(true);
  };

  const handleSaveManpower = (manpower: Manpower) => {
    if (editingManpowerIndex !== null) {
      const updated = [...formData.manpower];
      updated[editingManpowerIndex] = manpower;
      setFormData({ ...formData, manpower: updated });
    } else {
      setFormData({ ...formData, manpower: [...formData.manpower, manpower] });
    }
    setShowManpowerModal(false);
  };

  const handleDeleteManpower = (index: number) => {
    if (window.confirm('Hapus manpower ini?')) {
      const updated = formData.manpower.filter((_, i) => i !== index);
      setFormData({ ...formData, manpower: updated });
    }
  };

  // Schedule CRUD
  const handleAddSchedule = () => {
    setEditingScheduleIndex(null);
    setShowScheduleModal(true);
  };

  const handleEditSchedule = (index: number) => {
    setEditingScheduleIndex(index);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = (schedule: Schedule) => {
    if (editingScheduleIndex !== null) {
      const updated = [...formData.schedule];
      updated[editingScheduleIndex] = schedule;
      setFormData({ ...formData, schedule: updated });
    } else {
      setFormData({ ...formData, schedule: [...formData.schedule, schedule] });
    }
    setShowScheduleModal(false);
  };

  const handleDeleteSchedule = (index: number) => {
    if (window.confirm('Hapus schedule ini?')) {
      const updated = formData.schedule.filter((_, i) => i !== index);
      setFormData({ ...formData, schedule: updated });
    }
  };

  // Consumable CRUD
  const handleAddConsumable = () => {
    setEditingConsumableIndex(null);
    setShowConsumableModal(true);
  };

  const handleEditConsumable = (index: number) => {
    setEditingConsumableIndex(index);
    setShowConsumableModal(true);
  };

  const handleSaveConsumable = (consumable: Consumable) => {
    if (editingConsumableIndex !== null) {
      const updated = [...formData.consumables];
      updated[editingConsumableIndex] = consumable;
      setFormData({ ...formData, consumables: updated });
    } else {
      setFormData({ ...formData, consumables: [...formData.consumables, consumable] });
    }
    setShowConsumableModal(false);
  };

  const handleDeleteConsumable = (index: number) => {
    if (window.confirm('Hapus consumable ini?')) {
      const updated = formData.consumables.filter((_, i) => i !== index);
      setFormData({ ...formData, consumables: updated });
    }
  };

  // Equipment CRUD
  const handleAddEquipment = () => {
    setEditingEquipmentIndex(null);
    setShowEquipmentModal(true);
  };

  const handleEditEquipment = (index: number) => {
    setEditingEquipmentIndex(index);
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = (equipment: Equipment) => {
    if (editingEquipmentIndex !== null) {
      const updated = [...formData.equipment];
      updated[editingEquipmentIndex] = equipment;
      setFormData({ ...formData, equipment: updated });
    } else {
      setFormData({ ...formData, equipment: [...formData.equipment, equipment] });
    }
    setShowEquipmentModal(false);
  };

  const handleDeleteEquipment = (index: number) => {
    if (window.confirm('Hapus equipment ini?')) {
      const updated = formData.equipment.filter((_, i) => i !== index);
      setFormData({ ...formData, equipment: updated });
    }
  };

  // Calculate Totals
  const totalMaterialsCost = formData.materials.reduce((sum, mat) => sum + mat.totalPrice, 0);
  const totalManpowerCost = formData.manpower.reduce((sum, man) => sum + man.totalCost, 0);
  const totalConsumablesCost = formData.consumables.reduce((sum, con) => sum + con.totalCost, 0);
  const totalEquipmentCost = formData.equipment.reduce((sum, eq) => sum + eq.totalCost, 0);
  const subtotal = totalMaterialsCost + totalManpowerCost + totalConsumablesCost + totalEquipmentCost;
  const ppnValue = calculatePPN(subtotal, formData.ppn);
  const grandTotal = calculateGrandTotal(subtotal, ppnValue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Project Quotation</h1>
          <p className="text-gray-600">Kelola penawaran harga untuk project</p>
        </div>
        <button 
          onClick={() => {
            setEditMode(false);
            setEditingId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Buat Quotation Baru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Total Quotations</div>
          <div className="text-gray-900">{effectiveQuotationList.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Draft</div>
          <div className="text-gray-600">{effectiveQuotationList.filter(q => q.status === 'Draft').length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Sent</div>
          <div className="text-blue-600">{effectiveQuotationList.filter(q => q.status === 'Sent').length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Approved</div>
          <div className="text-green-600">{effectiveQuotationList.filter(q => q.status === 'Approved').length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari quotation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-700">No. Quotation</th>
                <th className="px-6 py-3 text-left text-gray-700">Tanggal</th>
                <th className="px-6 py-3 text-left text-gray-700">Perihal</th>
                <th className="px-6 py-3 text-left text-gray-700">Customer</th>
                <th className="px-6 py-3 text-right text-gray-700">Total Value</th>
                <th className="px-6 py-3 text-center text-gray-700">Status</th>
                <th className="px-6 py-3 text-center text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((quotation) => {
                const grandTotal = calculateTotalValue(quotation);

                return (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{quotation.nomorQuotation}</td>
                    <td className="px-6 py-4 text-gray-700">{quotation.tanggal}</td>
                    <td className="px-6 py-4 text-gray-900">{quotation.perihal}</td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{quotation.customer?.nama || 'N/A'}</div>
                      {quotation.customer?.pic && (
                        <div className="text-sm text-gray-600">PIC: {quotation.customer?.pic}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(grandTotal)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`px-3 py-1 rounded-full ${getStatusColor(quotation.status)}`}>
                          {quotation.status}
                        </span>
                        {quotation.status === 'Approved' && quotation.projectId && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full flex items-center gap-1" title="Project telah dibuat">
                            <Briefcase size={12} />
                            Project
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetail(quotation)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Detail"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleEdit(quotation)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handlePrint(quotation)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Print"
                        >
                          <Printer size={18} />
                        </button>
                        
                        {/* Status Action Buttons */}
                        <QuotationStatusActions
                          quotation={quotation}
                          onReject={handleReject}
                          onSend={handleSendToCustomer}
                        />
                        
                        {/* Delete button - only show if not approved */}
                        {quotation.status !== 'Approved' && (
                          <button
                            onClick={() => handleDelete(quotation)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-6xl my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-gray-900">{editMode ? 'Edit Quotation' : 'Buat Quotation Baru'}</h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              {/* Reference Info */}
              {formData.dataCollectionRef && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
                  <FileText size={18} />
                  <span className="text-sm">📋 Data dari Data Collection: <strong>{formData.dataCollectionRef}</strong></span>
                </div>
              )}
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText size={18} className="inline mr-2" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'materials'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ShoppingCart size={18} className="inline mr-2" />
                  BOQ Materials ({formData.materials.length})
                </button>
                <button
                  onClick={() => setActiveTab('manpower')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'manpower'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users size={18} className="inline mr-2" />
                  Manpower ({formData.manpower.length})
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'schedule'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar size={18} className="inline mr-2" />
                  Schedule ({formData.schedule.length})
                </button>
                <button
                  onClick={() => setActiveTab('consumables')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'consumables'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Package size={18} className="inline mr-2" />
                  Consumables ({formData.consumables.length})
                </button>
                <button
                  onClick={() => setActiveTab('equipment')}
                  className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'equipment'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Wrench size={18} className="inline mr-2" />
                  Equipment ({formData.equipment.length})
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 mb-2">No. Quotation</label>
                        <input 
                          type="text" 
                          value={formData.nomorQuotation}
                          onChange={(e) => setFormData({ ...formData, nomorQuotation: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="Auto generated" 
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Tanggal *</label>
                        <input 
                          type="date" 
                          value={formData.tanggal}
                          onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 mb-2">Perihal *</label>
                      <input 
                        type="text" 
                        value={formData.perihal}
                        onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                        placeholder="Penawaran Harga..." 
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 mb-2">Nama Customer *</label>
                        <input 
                          type="text" 
                          value={formData.customerNama}
                          onChange={(e) => setFormData({ ...formData, customerNama: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="PT. ..." 
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">PIC Customer</label>
                        <input 
                          type="text" 
                          value={formData.customerPIC}
                          onChange={(e) => setFormData({ ...formData, customerPIC: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="Nama PIC" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-700 mb-2">Alamat Customer *</label>
                      <textarea 
                        rows={2} 
                        value={formData.customerAlamat}
                        onChange={(e) => setFormData({ ...formData, customerAlamat: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                        placeholder="Alamat lengkap" 
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-gray-700 mb-2">Kategori</label>
                        <input 
                          type="text" 
                          value={formData.kategori}
                          onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="Email/Telepon/Visit" 
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Tipe Pekerjaan</label>
                        <input 
                          type="text" 
                          value={formData.tipePekerjaan}
                          onChange={(e) => setFormData({ ...formData, tipePekerjaan: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="Pasang baru/Repair" 
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Jenis Kontrak</label>
                        <input 
                          type="text" 
                          value={formData.jenisKontrak}
                          onChange={(e) => setFormData({ ...formData, jenisKontrak: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          placeholder="Subcontractor/Direct" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 mb-2">PPN (%)</label>
                        <input 
                          type="number" 
                          value={formData.ppn}
                          onChange={(e) => setFormData({ ...formData, ppn: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Status</label>
                        <select 
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="border-t pt-4 mt-6">
                      <h3 className="text-gray-900 mb-3">Cost Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Materials:</span>
                          <span className="text-gray-900">{formatCurrency(totalMaterialsCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Manpower:</span>
                          <span className="text-gray-900">{formatCurrency(totalManpowerCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Consumables:</span>
                          <span className="text-gray-900">{formatCurrency(totalConsumablesCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Equipment:</span>
                          <span className="text-gray-900">{formatCurrency(totalEquipmentCost)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-700 font-medium">Subtotal:</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">PPN ({formData.ppn}%):</span>
                          <span className="text-gray-900">{formatCurrency(ppnValue)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-900 font-bold">Grand Total:</span>
                          <span className="text-blue-600 font-bold text-lg">{formatCurrency(grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Materials Tab */}
                {activeTab === 'materials' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-gray-900">BOQ Materials</h3>
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Material
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Material Name</th>
                            <th className="px-4 py-2 text-right text-gray-700">Quantity</th>
                            <th className="px-4 py-2 text-left text-gray-700">Unit</th>
                            <th className="px-4 py-2 text-right text-gray-700">Unit Price</th>
                            <th className="px-4 py-2 text-right text-gray-700">Total</th>
                            <th className="px-4 py-2 text-center text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.materials.map((material, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-gray-900">
                                <div className="font-medium">{material.materialName}</div>
                                {material.specifications && material.specifications.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {material.specifications.length} spec{material.specifications.length > 1 ? 's' : ''}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700">{material.quantity}</td>
                              <td className="px-4 py-2 text-gray-700">{material.unit}</td>
                              <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(material.unitPrice)}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(material.totalPrice)}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditMaterial(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaterial(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {formData.materials.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                Belum ada material. Klik "Add Material" untuk menambah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Manpower Tab */}
                {activeTab === 'manpower' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-gray-900">Manpower</h3>
                      <button
                        type="button"
                        onClick={handleAddManpower}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Manpower
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Position</th>
                            <th className="px-4 py-2 text-right text-gray-700">Quantity</th>
                            <th className="px-4 py-2 text-right text-gray-700">Daily Rate</th>
                            <th className="px-4 py-2 text-right text-gray-700">Duration (days)</th>
                            <th className="px-4 py-2 text-right text-gray-700">Total Cost</th>
                            <th className="px-4 py-2 text-center text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.manpower.map((man, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-gray-900">{man.position}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{man.quantity}</td>
                              <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(man.dailyRate)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{man.duration}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(man.totalCost)}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditManpower(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteManpower(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {formData.manpower.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                Belum ada manpower. Klik "Add Manpower" untuk menambah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-gray-900">Schedule</h3>
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Schedule
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Activity</th>
                            <th className="px-4 py-2 text-left text-gray-700">Start Date</th>
                            <th className="px-4 py-2 text-left text-gray-700">End Date</th>
                            <th className="px-4 py-2 text-right text-gray-700">Duration (days)</th>
                            <th className="px-4 py-2 text-center text-gray-700">Status</th>
                            <th className="px-4 py-2 text-center text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.schedule.map((sch, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-gray-900">{sch.activity}</td>
                              <td className="px-4 py-2 text-gray-700">{sch.startDate}</td>
                              <td className="px-4 py-2 text-gray-700">{sch.endDate}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{sch.duration}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  sch.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                  sch.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {sch.status}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditSchedule(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSchedule(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {formData.schedule.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                Belum ada schedule. Klik "Add Schedule" untuk menambah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Consumables Tab */}
                {activeTab === 'consumables' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-gray-900">Consumables</h3>
                      <button
                        type="button"
                        onClick={handleAddConsumable}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Consumable
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Item Name</th>
                            <th className="px-4 py-2 text-left text-gray-700">Category</th>
                            <th className="px-4 py-2 text-right text-gray-700">Quantity</th>
                            <th className="px-4 py-2 text-left text-gray-700">Unit</th>
                            <th className="px-4 py-2 text-right text-gray-700">Unit Price</th>
                            <th className="px-4 py-2 text-right text-gray-700">Total Cost</th>
                            <th className="px-4 py-2 text-center text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.consumables.map((con, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-gray-900">{con.itemName}</td>
                              <td className="px-4 py-2 text-gray-700">{con.category}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{con.quantity}</td>
                              <td className="px-4 py-2 text-gray-700">{con.unit}</td>
                              <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(con.unitPrice)}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(con.totalCost)}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditConsumable(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteConsumable(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {formData.consumables.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                Belum ada consumables. Klik "Add Consumable" untuk menambah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Equipment Tab */}
                {activeTab === 'equipment' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-gray-900">Equipment</h3>
                      <button
                        type="button"
                        onClick={handleAddEquipment}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Add Equipment
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Equipment Name</th>
                            <th className="px-4 py-2 text-right text-gray-700">Quantity</th>
                            <th className="px-4 py-2 text-left text-gray-700">Unit</th>
                            <th className="px-4 py-2 text-right text-gray-700">Rental Rate</th>
                            <th className="px-4 py-2 text-right text-gray-700">Duration (days)</th>
                            <th className="px-4 py-2 text-right text-gray-700">Total Cost</th>
                            <th className="px-4 py-2 text-center text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.equipment.map((eq, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-gray-900">{eq.equipmentName}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{eq.quantity}</td>
                              <td className="px-4 py-2 text-gray-700">{eq.unit}</td>
                              <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(eq.rentalRate)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{eq.duration}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(eq.totalCost)}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditEquipment(index)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEquipment(index)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {formData.equipment.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                Belum ada equipment. Klik "Add Equipment" untuk menambah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save size={18} />
                  {editMode ? 'Update Quotation' : 'Simpan Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h3 className="text-gray-900 mb-4">{editingMaterialIndex !== null ? 'Edit Material' : 'Add Material'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveMaterial(materialForm);
              setSpecInput('');
            }} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Material Name *</label>
                <input
                  type="text"
                  value={materialForm.materialName}
                  onChange={(e) => setMaterialForm({ ...materialForm, materialName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Contoh: W2-SER Shotcrete Machine"
                  required
                />
              </div>

              {/* Specifications Section */}
              <div>
                <label className="block text-gray-700 mb-2">Specifications (Optional)</label>
                <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                  {/* Add Spec Input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (specInput.trim()) {
                            setMaterialForm({
                              ...materialForm,
                              specifications: [...(materialForm.specifications || []), specInput.trim()]
                            });
                            setSpecInput('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Ketik spec dan tekan Enter, contoh: Electric Motor Machine 1 Set"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (specInput.trim()) {
                          setMaterialForm({
                            ...materialForm,
                            specifications: [...(materialForm.specifications || []), specInput.trim()]
                          });
                          setSpecInput('');
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Spec List */}
                  {materialForm.specifications && materialForm.specifications.length > 0 ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {materialForm.specifications.map((spec, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-white px-3 py-2 rounded border border-gray-200">
                          <span className="text-gray-600 text-xs mt-0.5">•</span>
                          <span className="flex-1 text-sm text-gray-700">{spec}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialForm({
                                ...materialForm,
                                specifications: materialForm.specifications?.filter((_, i) => i !== idx)
                              });
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Belum ada specification. Tambahkan spec detail di atas.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Unit *</label>
                  <input
                    type="text"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Set, Unit, Pcs, dll"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Unit Price *</label>
                <input
                  type="number"
                  value={materialForm.unitPrice}
                  onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialModal(false);
                    setSpecInput('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manpower Modal */}
      {showManpowerModal && (
        <ManpowerModal
          isOpen={showManpowerModal}
          onClose={() => setShowManpowerModal(false)}
          onSave={handleSaveManpower}
          initialData={editingManpowerIndex !== null ? formData.manpower[editingManpowerIndex] : undefined}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSave={handleSaveSchedule}
          initialData={editingScheduleIndex !== null ? formData.schedule[editingScheduleIndex] : undefined}
        />
      )}

      {/* Consumable Modal */}
      {showConsumableModal && (
        <ConsumableModal
          isOpen={showConsumableModal}
          onClose={() => setShowConsumableModal(false)}
          onSave={handleSaveConsumable}
          initialData={editingConsumableIndex !== null ? formData.consumables[editingConsumableIndex] : undefined}
        />
      )}

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <EquipmentModal
          isOpen={showEquipmentModal}
          onClose={() => setShowEquipmentModal(false)}
          onSave={handleSaveEquipment}
          initialData={editingEquipmentIndex !== null ? formData.equipment[editingEquipmentIndex] : undefined}
        />
      )}

      {/* Detail/Print Modal */}
      {showDetailModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Print View */}
            <div className="p-8" id="printable-quotation">
              {/* Header */}
              <div className="border-2 border-black">
                {/* Company Header */}
                <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold">GM</div>
                    <div className="text-xs">TEKNIK</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold">GEMA TEKNIK PERKASA</div>
                    <div>REFRACTORY FURNACE AND BOILER</div>
                  </div>
                </div>

                {/* Company Info */}
                <div className="px-6 py-2 border-b border-black text-xs">
                  <p>Jl. Narogong Km 13 Setia Mulya, Tambun Selatan, Bekasi 17510</p>
                  <p>Phone: 08510048521, 021 89534139 Fax: 021 89534139 Email: gemat123@gmail.com</p>
                </div>

                {/* Quotation Info */}
                <div className="px-6 py-3 border-b border-black">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-24">No</td>
                        <td className="w-4">:</td>
                        <td>{selectedQuotation.nomorQuotation}</td>
                      </tr>
                      <tr>
                        <td>Perihal</td>
                        <td>:</td>
                        <td>{selectedQuotation.perihal}</td>
                      </tr>
                      <tr>
                        <td>Kategori</td>
                        <td>:</td>
                        <td>{selectedQuotation.kategori || '-'}</td>
                      </tr>
                      <tr>
                        <td>Tipe/Jenis</td>
                        <td>:</td>
                        <td>{selectedQuotation.tipePekerjaan || '-'} / {selectedQuotation.jenisKontrak || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Customer & Date */}
                <div className="px-6 py-3 border-b border-black">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-24">Yth,</td>
                        <td>{selectedQuotation.customer?.nama || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td></td>
                        <td>{selectedQuotation.customer?.alamat || '-'}</td>
                      </tr>
                      {selectedQuotation.customer?.pic && (
                        <tr>
                          <td>U/P</td>
                          <td>: {selectedQuotation.customer?.pic}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Items Table */}
                <div className="px-6 py-3">
                  <p className="text-sm mb-3">
                    Sehubungan dengan permintaan Anda/Bapak mengenai penawaran equipment refractory, maka dengan ini kami sampaikan penawaran sebagai berikut:
                  </p>
                  
                  <table className="w-full border border-black text-sm">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="border-r border-black px-2 py-2 text-left">No</th>
                        <th className="border-r border-black px-2 py-2 text-left">Jenis Barang</th>
                        <th className="border-r border-black px-2 py-2 text-right">Harga/unit</th>
                        <th className="border-r border-black px-2 py-2 text-center">Jumlah</th>
                        <th className="px-2 py-2 text-right">Total Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedQuotation.materials || []).map((material, idx) => (
                        <tr key={idx} className="border-b border-black">
                          <td className="border-r border-black px-2 py-2 align-top">{idx + 1}</td>
                          <td className="border-r border-black px-2 py-2">
                            <div className="font-semibold mb-1">{material.materialName}</div>
                            {material.specifications && material.specifications.length > 0 && (
                              <div className="mt-2">
                                <div className="font-semibold mb-1">Specification :</div>
                                <div className="space-y-0.5 text-sm">
                                  {material.specifications.map((spec, specIdx) => (
                                    <div key={specIdx} className="flex items-start gap-1">
                                      <span>-</span>
                                      <span>{spec}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="border-r border-black px-2 py-2 text-right align-top">
                            {formatCurrency(material.unitPrice)}
                          </td>
                          <td className="border-r border-black px-2 py-2 text-center align-top">
                            {material.quantity} {material.unit}
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            {formatCurrency(material.totalPrice)}
                          </td>
                        </tr>
                      ))}

                      {/* Subtotal, PPN, Grand Total */}
                      <tr className="border-b border-black">
                        <td colSpan={4} className="px-2 py-2 text-right font-semibold">Sub harga</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(calculateSubtotal(selectedQuotation.materials || []))}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td colSpan={4} className="px-2 py-2 text-right">PPN {selectedQuotation.ppn}%</td>
                        <td className="px-2 py-2 text-right">
                          {formatCurrency(calculatePPN(calculateSubtotal(selectedQuotation.materials || []), selectedQuotation.ppn))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-2 py-2 text-right font-bold">Grand Total</td>
                        <td className="px-2 py-2 text-right font-bold">
                          {formatCurrency(calculateGrandTotal(
                            calculateSubtotal(selectedQuotation.materials || []),
                            calculatePPN(calculateSubtotal(selectedQuotation.materials || []), selectedQuotation.ppn)
                          ))}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Notes */}
                  <div className="mt-4 text-sm">
                    <p className="font-semibold mb-2">Notes:</p>
                    <ul className="space-y-1">
                      {selectedQuotation.notes.map((note, idx) => (
                        <li key={idx}>- {note}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Closing */}
                  <p className="mt-4 text-sm">
                    Demikian penawaran ini kami buat atas kerjasama yang baik. kami ucapkan terima kasih.
                  </p>

                  {/* Signature */}
                  <div className="mt-8">
                    <p className="text-sm">Bekasi, {new Date(selectedQuotation.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="text-sm mt-1">Hormat kami,</p>
                    <div className="mt-16 mb-2">
                      <p className="text-sm font-semibold">_________________</p>
                      <p className="text-sm">Syamsudin</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 flex justify-between items-center gap-3 print:hidden">
              {/* Project Info or Convert Button */}
              <div>
                {selectedQuotation.status === 'Approved' && selectedQuotation.projectId ? (
                  <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    <CheckCircle className="text-green-600" size={20} />
                    <div>
                      <div className="text-sm font-semibold text-green-800">Project Created</div>
                      <div className="text-xs text-green-600">ID: {selectedQuotation.projectId}</div>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/project');
                      }}
                      className="ml-2 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Briefcase size={14} />
                      View Project
                    </button>
                  </div>
                ) : selectedQuotation.status === 'Approved' ? (
                  <button
                    onClick={() => {
                      const confirmed = window.confirm(
                        `🚀 Convert Quotation ke Project?\\n\\n` +
                        `Quotation: ${selectedQuotation.nomorQuotation}\\n` +
                        `Customer: ${selectedQuotation.customer?.nama || 'N/A'}\\n` +
                        `Budget: ${formatCurrency(calculateGrandTotal(
                          calculateSubtotal(selectedQuotation.materials || []),
                          calculatePPN(calculateSubtotal(selectedQuotation.materials || []), selectedQuotation.ppn)
                        ))}\\n\\n` +
                        `✅ Project baru akan dibuat dengan data dari quotation ini.`
                      );
                      
                      if (confirmed) {
                        handleConvertToProject(selectedQuotation);
                      }
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-colors font-semibold flex items-center gap-2"
                  >
                    <Briefcase size={18} />
                    Convert to Project
                  </button>
                ) : null}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-quotation, #printable-quotation * {
            visibility: visible;
          }
          #printable-quotation {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
