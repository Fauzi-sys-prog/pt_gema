import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Printer, X, Link as LinkIcon, Package, TruckIcon, FileText, FileDown, CheckCircle, XCircle, Send } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { PurchaseOrder } from '../../contexts/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';
import { SKURegistrationModal } from '../../components/SKURegistrationModal';
import StatusGuideCard from '../../components/ui/StatusGuideCard';
import gmLogo from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

interface POItem {
  no: number;
  nama: string;
  qty: number;
  unit: string;
  harga: number;
  isNewSku?: boolean;
  kategori?: string;
  kode?: string;
  source?: string;
  sourceRef?: string;
  supplier?: string;
}

interface LocationState {
  fromProject?: boolean;
  projectId?: string;
  projectNo?: string;
  projectName?: string;
  boqItems?: Array<{
    itemKode?: string;
    materialName: string;
    qtyEstimate: number;
    unit: string;
    unitPrice: number;
    supplier: string;
    category?: string;
    status: string;
  }>;
}

interface POFormData {
  noPO: string;
  tanggal: string;
  ref: string;
  supplier: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierFax: string;
  supplierContact: string;
  attention: string;
  total: number;
  status: PurchaseOrder['status'];
  notes: string;
  ppn: number;
  ppnRate: number;
  top: number;
  deliveryDate: string;
  signatoryName: string;
  projectId?: string;
}

const createDefaultFormData = (): POFormData => ({
  noPO: '',
  tanggal: new Date().toISOString().split('T')[0],
  ref: '',
  supplier: '',
  supplierAddress: '',
  supplierPhone: '',
  supplierFax: '',
  supplierContact: '',
  attention: '',
  total: 0,
  status: 'Draft',
  notes: '',
  ppn: 11,
  ppnRate: 11,
  top: 30,
  deliveryDate: '',
  signatoryName: 'SYAMSUDIN',
  projectId: '',
});

const toFiniteNonNegative = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const normalizeKey = (value: unknown) => String(value || '').trim().toLowerCase();

export default function PurchaseOrderPage() {
  const { poList, setPoList, addPO, updatePO, projectList, updateProject, stockItemList, setStockItemList } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LocationState;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [skuInitialName, setSkuInitialName] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState<POFormData>(createDefaultFormData());
  const skuSuggestions = useMemo(() => {
    const source = Array.isArray(stockItemList) ? stockItemList : [];
    const byCode = new Map<string, typeof source[number]>();
    const byName = new Map<string, typeof source[number]>();
    for (const item of source) {
      const codeKey = normalizeKey(item?.kode);
      const nameKey = normalizeKey(item?.nama);
      if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, item);
      if (!codeKey && nameKey && !byName.has(nameKey)) byName.set(nameKey, item);
    }
    return [...byCode.values(), ...byName.values()];
  }, [stockItemList]);

  const toFormDataFromPO = (po: PurchaseOrder): POFormData => {
    const src = po as any;
    const rate = toFiniteNonNegative(src.ppnRate ?? src.ppn, 11);
    return {
      noPO: String(src.noPO || ''),
      tanggal: String(src.tanggal || new Date().toISOString().split('T')[0]),
      ref: String(src.ref || ''),
      supplier: String(src.supplier || ''),
      supplierAddress: String(src.supplierAddress || ''),
      supplierPhone: String(src.supplierPhone || ''),
      supplierFax: String(src.supplierFax || ''),
      supplierContact: String(src.supplierContact || ''),
      attention: String(src.attention || ''),
      total: toFiniteNonNegative(src.total, 0),
      status: (src.status as PurchaseOrder['status']) || 'Draft',
      notes: String(src.notes || ''),
      ppn: rate,
      ppnRate: rate,
      top: toFiniteNonNegative(src.top, 30),
      deliveryDate: String(src.deliveryDate || ''),
      signatoryName: String(src.signatoryName || 'SYAMSUDIN'),
      projectId: String(src.projectId || ''),
    };
  };

  const getItemUnitPrice = (item: any) => Number(item?.unitPrice ?? item?.harga ?? 0);
  const getItemLineTotal = (item: any) =>
    Number(item?.total ?? (Number(item?.qty || 0) * getItemUnitPrice(item)));

  const toEditorItem = (item: any, index: number): POItem => ({
    no: index + 1,
    nama: String(item?.nama || ''),
    qty: Number(item?.qty || 0),
    unit: String(item?.unit || 'pcs'),
    harga: getItemUnitPrice(item),
    kode: item?.kode || '',
    source: item?.source,
    sourceRef: item?.sourceRef,
  });

  const getPOSourceLabel = (po: PurchaseOrder) => {
    const labels = Array.from(
      new Set((po.items || []).map((it: any) => String(it?.source || '').trim()).filter(Boolean))
    );
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return labels.join(', ');
  };

  const handleApprovePO = async (po: PurchaseOrder) => {
    try {
      await updatePO(po.id, { ...po, status: 'Approved' });
    } catch {
      // Error toast handled in AppContext
    }
  };

  const handleSendPO = async (po: PurchaseOrder) => {
    try {
      await updatePO(po.id, { ...po, status: 'Sent' });
    } catch {
      // Error toast handled in AppContext
    }
  };

  const handleRejectPO = async (po: PurchaseOrder) => {
    try {
      await updatePO(po.id, { ...po, status: 'Rejected' });
    } catch {
      // Error toast handled in AppContext
    }
  };

  const handleClearAllPO = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus semua data Purchase Order? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    if (poList.length === 0) {
      toast.info('Tidak ada data Purchase Order untuk dihapus.');
      return;
    }

    const toastId = toast.loading('Menghapus semua data Purchase Order...');
    const results = await Promise.allSettled(
      poList.map((po) => api.delete(`/purchase-orders/${po.id}`))
    );

    const deletedIds = poList
      .filter((_, index) => results[index].status === 'fulfilled')
      .map((po) => po.id);
    const failedCount = results.length - deletedIds.length;

    if (deletedIds.length > 0) {
      setPoList((prev) => prev.filter((po) => !deletedIds.includes(po.id)));
    }

    if (failedCount > 0) {
      toast.warning(
        `${deletedIds.length} PO berhasil dihapus, ${failedCount} gagal. Cek koneksi/backend.`,
        { id: toastId }
      );
      return;
    }

    toast.success('Semua data Purchase Order telah dihapus.', { id: toastId });
  };

  const [items, setItems] = useState<POItem[]>([
    { no: 1, nama: '', qty: 1, unit: 'pcs', harga: 0 }
  ]);

  const resolveProjectByRef = (ref?: string) => {
    const key = String(ref || '').trim();
    if (!key) return undefined;
    return projectList.find((p) => p.id === key || p.kodeProject === key);
  };

  const normalizeProjectRef = (ref?: string) => resolveProjectByRef(ref)?.id || String(ref || '');
  const getBoqBudgetQty = (item: { qtyEstimate?: number; budgetQty?: number; qty?: number }) => {
    const raw = Number(item.qtyEstimate ?? item.budgetQty ?? item.qty ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.abs(raw));
  };
  const isNonProcurementBOQItem = (item: { unit?: string; category?: string; materialName?: string }) => {
    const unit = String(item.unit || '').trim().toLowerCase();
    const category = String(item.category || '').trim().toLowerCase();
    const name = String(item.materialName || '').trim().toLowerCase();

    // Manpower/jasa tidak boleh masuk Purchase Order material.
    const manpowerUnits = new Set(['orang', 'man', 'mandays', 'man-day', 'man day', 'hari', 'day', 'jam', 'hour']);
    const manpowerCategories = ['manpower', 'jasa', 'service', 'labour', 'labor'];
    const manpowerKeywords = ['mandor', 'teknisi', 'helper', 'pekerja', 'operator', 'supervisor', 'welder', 'safety'];

    return (
      manpowerUnits.has(unit) ||
      manpowerCategories.some((k) => category.includes(k)) ||
      manpowerKeywords.some((k) => name.includes(k))
    );
  };

  // Auto-fill logic (same as before)
  useEffect(() => {
    if (locationState?.fromProject && Array.isArray(locationState?.boqItems)) {
      const { projectId, projectNo, projectName, boqItems } = locationState;
      const project = resolveProjectByRef(projectId);
      const customerPT = project?.customer || "";
      
      setFormData(prev => ({
        ...prev,
        projectId: normalizeProjectRef(projectId),
        notes: `PO untuk Project: ${projectNo} - ${projectName}${customerPT ? ` - ${customerPT}` : ""}`,
      }));
      const materialBoqItems = boqItems.filter((item) => !isNonProcurementBOQItem(item));
      const skipped = boqItems.length - materialBoqItems.length;
      const poItems: POItem[] = materialBoqItems.map((item, index) => {
        // Strict matching: Check by kode first, then name
        const existingStock = stockItemList.find(s => 
          (item.itemKode && s.kode === item.itemKode) || 
          (s.nama.toLowerCase() === item.materialName.toLowerCase())
        );
        
        const boqQty = getBoqBudgetQty(item);
        
        return {
          no: index + 1,
          nama: item.materialName,
          qty: boqQty,
          unit: item.unit,
          harga: item.unitPrice,
          isNewSku: !existingStock,
          kode: existingStock?.kode || item.itemKode || `GTP-MTR-${item.materialName.substring(0,3).toUpperCase()}-${Math.floor(100+Math.random()*900)}`,
          kategori: existingStock?.kategori || 'General'
        };
      });
      setItems(poItems);
      calculateTotal(poItems);
      const suppliers = materialBoqItems.map(item => item.supplier).filter(Boolean);
      const uniqueSuppliers = [...new Set(suppliers)];
      if (uniqueSuppliers.length === 1) {
        setFormData(prev => ({ ...prev, supplier: uniqueSuppliers[0] }));
      }
      if (skipped > 0) {
        toast.info(`${skipped} item manpower/jasa tidak dimasukkan ke Purchase Order.`);
      }
      setShowModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [locationState]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'projectId') {
        return { ...prev, projectId: normalizeProjectRef(value) };
      }
      if (name === 'ppn' || name === 'ppnRate' || name === 'top') {
        return { ...prev, [name]: toFiniteNonNegative(value, 0) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number) => {
    const newItems = [...items];
    
    if (field === 'nama' && typeof value === 'string') {
      const trimmedValue = value.trim();
      const needle = normalizeKey(trimmedValue);
      const found = skuSuggestions.find((s) => normalizeKey(s.nama) === needle || normalizeKey(s.kode) === needle);
      
      if (found) {
        newItems[index] = { 
          ...newItems[index], 
          nama: found.nama,
          unit: found.satuan,
          harga: found.hargaSatuan,
          isNewSku: false,
          kategori: found.kategori,
          kode: found.kode
        };
      } else {
        newItems[index] = { 
          ...newItems[index], 
          nama: value,
          isNewSku: trimmedValue.length > 0,
          // SKU final will be generated by backend on stock-items create.
          kode: ''
        };
      }
    } else if (field === 'qty') {
      // Ensure QTY is always positive
      newItems[index] = { ...newItems[index], [field]: Math.max(0, Number(value)) };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
    calculateTotal(newItems);
  };

  const addItem = () => {
    setItems([...items, { no: items.length + 1, nama: '', qty: 1, unit: 'pcs', harga: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      newItems.forEach((item, i) => item.no = i + 1);
      setItems(newItems);
      calculateTotal(newItems);
    }
  };

  const calculateTotal = (currentItems: POItem[]) => {
    const subtotal = currentItems.reduce((sum, item) => sum + (item.qty * item.harga), 0);
    setFormData(prev => ({ ...prev, total: subtotal }));
  };

  const isEditorItemEmpty = (item: POItem) => {
    const name = String(item.nama || '').trim();
    const qty = Number(item.qty || 0);
    const price = Number(item.harga || 0);
    return !name && qty <= 0 && price <= 0;
  };

  const mergeItemsWithProjectBoq = (existingItems: POItem[], boqItems: POItem[]) => {
    const base = existingItems.filter((it) => !isEditorItemEmpty(it)).map((it) => ({ ...it }));
    let importedCount = 0;
    let mergedCount = 0;

    for (const boqItem of boqItems) {
      const boqCode = normalizeKey(boqItem.kode);
      const boqName = normalizeKey(boqItem.nama);
      const idx = base.findIndex((it) => {
        const code = normalizeKey(it.kode);
        const name = normalizeKey(it.nama);
        return (boqCode && code && boqCode === code) || (boqName && name && boqName === name);
      });

      if (idx >= 0) {
        base[idx] = {
          ...base[idx],
          qty: Number(base[idx].qty || 0) + Number(boqItem.qty || 0),
          unit: boqItem.unit || base[idx].unit,
          harga: Number(base[idx].harga || 0) > 0 ? Number(base[idx].harga || 0) : Number(boqItem.harga || 0),
          source: base[idx].source || boqItem.source,
          sourceRef: base[idx].sourceRef || boqItem.sourceRef,
          supplier: base[idx].supplier || boqItem.supplier,
        };
        mergedCount += 1;
      } else {
        base.push({ ...boqItem });
        importedCount += 1;
      }
    }

    if (base.length === 0) {
      base.push({ no: 1, nama: '', qty: 1, unit: 'pcs', harga: 0 });
    }

    const reindexed = base.map((it, i) => ({ ...it, no: i + 1 }));
    return { items: reindexed, importedCount, mergedCount };
  };

  const calculatePPN = () => {
    const subtotal = formData.total || 0;
    const rate = formData.ppnRate !== undefined ? formData.ppnRate : (formData.ppn || 11);
    return subtotal * rate / 100;
  };

  const calculateGrandTotal = () => {
    const subtotal = formData.total || 0;
    const ppn = calculatePPN();
    return subtotal + ppn;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeStockItems = Array.isArray(stockItemList) ? stockItemList : [];
    const normalizedItems = items.map((item) => ({
      ...item,
      nama: String(item.nama || '').trim(),
      unit: String(item.unit || 'pcs').trim() || 'pcs',
      qty: toFiniteNonNegative(item.qty, 0),
      harga: toFiniteNonNegative(item.harga, 0),
      kode: String(item.kode || '').trim(),
    }));
    const invalidName = normalizedItems.some((item) => !item.nama);
    if (invalidName) {
      toast.error('Nama barang tidak boleh kosong.');
      return;
    }
    
    // Safety check for negative QTY
    const hasNegativeQty = normalizedItems.some(item => (item.qty || 0) < 0);
    if (hasNegativeQty) {
      toast.error("Jumlah barang (QTY) tidak boleh negatif!");
      return;
    }
    const hasZeroQty = normalizedItems.some(item => Number(item.qty || 0) <= 0);
    if (hasZeroQty) {
      toast.error("Jumlah barang (QTY) harus lebih dari 0.");
      return;
    }

    // Process new SKUs
    const draftNewStockItems = normalizedItems
      .filter(item => item.isNewSku && item.nama)
      .map(item => {
        return {
          id: `STK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          kode: String(item.kode || '').trim(),
          nama: item.nama,
          kategori: item.kategori || 'General',
          satuan: item.unit,
          supplier: formData.supplier || '',
          stokAwal: 0,
          stok: 0,
          reserved: 0,
          minStock: 5,
          hargaSatuan: item.harga,
          lokasi: 'Gudang Utama',
          lastUpdate: new Date().toISOString().split('T')[0],
        };
      });

    const createdNewStockItems: any[] = [];
    if (draftNewStockItems.length > 0) {
      const failedNames: string[] = [];
      for (const item of draftNewStockItems) {
        try {
          const res = await api.post('/inventory/items', item);
          const saved = (res?.data?.payload || item) as any;
          createdNewStockItems.push({ ...saved, id: res?.data?.entityId || item.id });
        } catch (err) {
          console.error('Failed to sync auto-created SKU from PO:', err);
          failedNames.push(item.nama);
        }
      }
      if (failedNames.length > 0) {
        toast.error(`Gagal simpan SKU ke database: ${failedNames.join(', ')}.`);
        return;
      }
      setStockItemList(prev => [...(Array.isArray(prev) ? prev : []), ...createdNewStockItems]);
      toast.success(`${createdNewStockItems.length} SKU baru tersimpan ke database.`);
    }

    // Backfill supplier ke stock item existing yang belum punya supplier
    if (formData.supplier) {
      const poItemNames = new Set(normalizedItems.map((it) => String(it.nama || '').trim().toLowerCase()).filter(Boolean));
      const poItemCodes = new Set(normalizedItems.map((it) => String(it.kode || '').trim().toLowerCase()).filter(Boolean));
      const toUpdate = safeStockItems.filter((stk) => {
        if (String(stk.supplier || '').trim()) return false;
        const code = String(stk.kode || '').trim().toLowerCase();
        const name = String(stk.nama || '').trim().toLowerCase();
        return poItemCodes.has(code) || poItemNames.has(name);
      });
      if (toUpdate.length) {
        setStockItemList((prev) =>
          (Array.isArray(prev) ? prev : []).map((stk) =>
            toUpdate.some((u) => u.id === stk.id) ? { ...stk, supplier: formData.supplier || '' } : stk
          )
        );
        for (const stk of toUpdate) {
          const payload = { ...stk, supplier: formData.supplier || '' };
          api.patch(`/inventory/items/${stk.id}`, payload).catch((err) => {
            console.error('Failed to backfill supplier on stock item:', err);
          });
        }
      }
    }

    const poItemsPayload = normalizedItems.map((item, idx) => {
        const kodeResolved = item.isNewSku
          ? createdNewStockItems.find(s => String(s.nama || '').trim().toLowerCase() === String(item.nama || '').trim().toLowerCase())?.kode
          : (safeStockItems.find(s => s.nama === item.nama)?.kode || item.kode);
        const unitPrice = Number(item.harga || 0);
        const qty = Number(item.qty || 0);
        return {
          id: `poi-${Date.now()}-${idx}`,
          nama: item.nama,
          qty,
          unit: item.unit,
          unitPrice,
          total: qty * unitPrice,
          // keep legacy key for backward compatibility in old payload consumers
          harga: unitPrice,
          kode: kodeResolved || `GTP-ITEM-${idx + 1}`,
          source: item.source,
          sourceRef: item.sourceRef,
        };
      });

    const poData = {
      noPO: String(formData.noPO || '').trim(),
      tanggal: String(formData.tanggal || new Date().toISOString().split('T')[0]),
      supplier: String(formData.supplier || '').trim(),
      total: toFiniteNonNegative(formData.total, 0),
      status: formData.status || 'Draft',
      projectId: normalizeProjectRef(String(formData.projectId || '')) || undefined,
      items: poItemsPayload,
      ref: String(formData.ref || '').trim(),
      supplierAddress: String(formData.supplierAddress || '').trim(),
      supplierPhone: String(formData.supplierPhone || '').trim(),
      supplierFax: String(formData.supplierFax || '').trim(),
      supplierContact: String(formData.supplierContact || '').trim(),
      attention: String(formData.attention || '').trim(),
      notes: String(formData.notes || ''),
      ppn: toFiniteNonNegative(formData.ppn ?? formData.ppnRate, 11),
      ppnRate: toFiniteNonNegative(formData.ppnRate ?? formData.ppn, 11),
      top: toFiniteNonNegative(formData.top, 30),
      deliveryDate: String(formData.deliveryDate || '').trim(),
      signatoryName: String(formData.signatoryName || 'SYAMSUDIN').trim(),
    };

    console.log('[PO] submit payload', {
      mode: editMode ? 'edit' : 'create',
      poId: selectedPO?.id || null,
      payload: poData,
    });

    try {
      if (editMode && selectedPO) {
        await updatePO(selectedPO.id, poData as Partial<PurchaseOrder>);
      } else {
        const resolvedNoPO = poData.noPO || `PO-${new Date().getFullYear()}-${String(poList.length + 1).padStart(3, '0')}`;
        const newPO: PurchaseOrder = {
          id: `PO-${Date.now()}`,
          noPO: resolvedNoPO,
          ...poData as PurchaseOrder,
        };
        await addPO(newPO);
        
        // Update BOQ Status in Project if linked
        if (formData.projectId) {
          const project = resolveProjectByRef(String(formData.projectId));
          if (project && Array.isArray(project.boq)) {
            const updatedBOQ = project.boq.map((boqItem: any) => {
              const boqCode = String(boqItem?.itemKode || '').trim();
              const boqName = String(boqItem?.materialName || '').trim().toLowerCase();
              const matchedPOItem = normalizedItems.find((pi) => {
                const poCode = String(pi?.kode || '').trim();
                const poName = String(pi?.nama || '').trim().toLowerCase();
                return (poCode && boqCode && poCode === boqCode) || (poName && boqName && poName === boqName);
              });
              
              if (matchedPOItem) {
                return {
                  ...boqItem,
                  status: 'Ordered' as const,
                  qtyActual: (boqItem.qtyActual || 0) + matchedPOItem.qty
                };
              }
              return boqItem;
            });
            try {
              updateProject(project.id, { boq: updatedBOQ });
            } catch (err) {
              console.error('Failed to update project BOQ status after PO create:', err);
            }
          }
        }
      }
    } catch {
      if (createdNewStockItems.length > 0) {
        await Promise.allSettled(
          createdNewStockItems
            .map((item) => String(item?.id || '').trim())
            .filter(Boolean)
            .map((id) => api.delete(`/inventory/items/${id}`))
        );
        setStockItemList((prev) =>
          (Array.isArray(prev) ? prev : []).filter(
            (item) => !createdNewStockItems.some((created) => created.id === item.id)
          )
        );
      }
      return;
    }
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData(createDefaultFormData());
    setItems([{ no: 1, nama: '', qty: 1, unit: 'pcs', harga: 0 }]);
    setEditMode(false);
    setSelectedPO(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleDownloadWord = async (po: PurchaseOrder) => {
    const poId = String(po.id || "").trim();
    if (!poId) {
      toast.error("ID PO tidak valid untuk export.");
      return;
    }
    const safeNo = String(po.noPO || poId).replace(/[^\w.-]+/g, "_");
    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/purchase-orders/${poId}/word`, { responseType: "blob" }),
        api.get(`/exports/purchase-orders/${poId}/excel`, { responseType: "blob" }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: "application/msword" });
      const excelBlob = new Blob([excelResponse.data], { type: "application/vnd.ms-excel" });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `PO_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `PO_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      toast.success("Dokumen PO Word + Excel berhasil diunduh.");
    } catch {
      toast.error("Export PO Word + Excel gagal.");
    }
  };

  const handleDownloadSuratJalan = async (po: PurchaseOrder) => {
    const poId = String(po.id || "").trim();
    if (!poId) {
      toast.error("ID PO tidak valid untuk export SJ.");
      return;
    }
    const safeNo = String(po.noPO || poId).replace(/[^\w.-]+/g, "_");
    try {
      const [wordResponse, excelResponse] = await Promise.all([
        api.get(`/exports/purchase-orders/${poId}/surat-jalan/word`, { responseType: "blob" }),
        api.get(`/exports/purchase-orders/${poId}/surat-jalan/excel`, { responseType: "blob" }),
      ]);

      const wordBlob = new Blob([wordResponse.data], { type: "application/msword" });
      const excelBlob = new Blob([excelResponse.data], { type: "application/vnd.ms-excel" });
      const wordUrl = URL.createObjectURL(wordBlob);
      const excelUrl = URL.createObjectURL(excelBlob);

      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `SJ_${safeNo}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `SJ_${safeNo}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      toast.success("Dokumen SJ Word + Excel berhasil diunduh.");
    } catch {
      toast.error("Export SJ Word + Excel dari PO gagal.");
    }
  };

  const filteredPO = poList.filter((po) => {
    const keyword = String(searchTerm || '').toLowerCase();
    const matchesSearch =
      String(po.noPO || '').toLowerCase().includes(keyword) ||
      String(po.supplier || '').toLowerCase().includes(keyword);
    const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
    const normalizedPoProjectId = normalizeProjectRef(String(po.projectId || ''));
    const matchesProject =
      filterProject === 'all' ||
      (filterProject === 'general' && !normalizedPoProjectId) ||
      (filterProject !== 'general' && normalizedPoProjectId === filterProject);
    return matchesSearch && matchesStatus && matchesProject;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">🛒 Purchase Order</h1>
          <p className="text-gray-600 italic">Manajemen Pembelian & Pesanan Barang</p>
        </div>
        <div className="flex gap-2">
          {poList.length > 0 && (
            <button
              onClick={handleClearAllPO}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-red-200 transition-all"
            >
              <Trash2 size={20} /> Hapus Semua
            </button>
          )}
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
          >
            <Plus size={20} /> Buat PO Baru
          </button>
        </div>
      </div>

      <StatusGuideCard
        title="Panduan Status Purchase Order"
        helper="Status PO menentukan kapan dokumen masih disusun, kapan boleh dikirim, dan kapan tim gudang bisa lanjut receiving."
        className="mb-6"
        sections={[
          {
            title: "Alur Inti PO",
            items: [
              {
                label: "Draft",
                tone: "neutral",
                description: "PO masih dirapikan dan item atau supplier masih bisa disunting sebelum dikirim.",
              },
              {
                label: "Pending / Sent",
                tone: "warning",
                description: "PO sudah diajukan atau diterbitkan dan sedang menunggu review atau tindak lanjut supplier.",
              },
              {
                label: "Approved",
                tone: "success",
                description: "PO sudah disetujui dan siap diteruskan ke vendor atau proses penerimaan barang.",
              },
              {
                label: "Rejected / Cancelled",
                tone: "danger",
                description: "PO dihentikan, jadi dokumen ini tidak boleh dipakai lanjut receiving tanpa revisi atau pembuatan ulang.",
              },
            ],
          },
          {
            title: "Status Barang Datang",
            items: [
              {
                label: "Partial",
                tone: "info",
                description: "Barang baru datang sebagian. Receiving tetap bisa dibuat, tapi PO belum dianggap selesai penuh.",
              },
              {
                label: "Received",
                tone: "success",
                description: "Semua item PO sudah diterima penuh dan dokumen pembelian bisa dianggap tuntas.",
              },
            ],
          },
        ]}
      />

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari nomor PO atau supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Partial">Partial</option>
            <option value="Received">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Project</option>
            <option value="general">General Purchase</option>
            {projectList.map(p => <option key={p.id} value={p.id}>{p.kodeProject}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-4">No PO / Tanggal</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {filteredPO.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900">{po.noPO}</p>
                  <p className="text-gray-500 text-xs">{new Date(po.tanggal).toLocaleDateString('id-ID')}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{po.supplier}</p>
                  {getPOSourceLabel(po) ? (
                    <p className="text-[10px] font-bold text-violet-600">Source: {getPOSourceLabel(po)}</p>
                  ) : null}
                  {po.projectId && <p className="text-blue-600 text-[10px] font-bold">Project: {resolveProjectByRef(String(po.projectId || ''))?.kodeProject || po.projectId}</p>}
                </td>
                <td className="px-6 py-4 font-bold text-gray-900">Rp {formatCurrency(po.total)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    po.status === 'Received' ? 'bg-green-100 text-green-700' : 
                    po.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 
                    po.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    po.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                    po.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {po.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedPO(po); setShowDetailModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Lihat Detail"><Eye size={18} /></button>
                    {po.status === 'Draft' && (
                      <>
                        <button onClick={() => { setSelectedPO(po); setFormData(toFormDataFromPO(po)); setItems(po.items.map((it, i) => toEditorItem(it, i))); setEditMode(true); setShowModal(true); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Edit"><Edit size={18} /></button>
                        <button onClick={() => { void handleSendPO(po); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Kirim PO (Ready for Receiving)"><Send size={18} /></button>
                      </>
                    )}
                    {po.status === 'Pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => { void handleApprovePO(po); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Approve"><CheckCircle size={18} /></button>
                        <button onClick={() => { void handleRejectPO(po); }} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" title="Reject"><XCircle size={18} /></button>
                      </div>
                    )}
                    <button onClick={() => { setSelectedPO(po); setShowDetailModal(true); setTimeout(() => window.print(), 300); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Print PDF"><Printer size={18} /></button>
                    <button onClick={() => handleDownloadWord(po)} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg" title="Download Word + Excel"><FileDown size={18} /></button>
                    {po.status === 'Approved' || po.status === 'Sent' || po.status === 'Partial' ? (
                      <button 
                        onClick={() => navigate('/purchasing/receiving', { 
                          state: { 
                            fromPO: true, 
                            poId: po.id, 
                            poNo: po.noPO, 
                            supplier: po.supplier, 
                            projectId: po.projectId, 
                            items: po.items 
                          } 
                        })} 
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg" 
                        title="Terima Barang"
                      >
                        <Package size={18} />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Input */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText size={24} className="text-blue-600" />
                {editMode ? 'Edit Purchase Order' : 'Buat Purchase Order Baru'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-grow bg-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="font-black italic text-blue-800 border-b pb-1 flex items-center gap-2 uppercase tracking-tighter">📝 Administrasi</h3>
                  <div>
                    <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">No. PO</label>
                    <input type="text" name="noPO" value={formData.noPO || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" placeholder="Contoh: 49/GMT/PO/III/2025" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Tanggal</label>
                      <input type="date" name="tanggal" value={formData.tanggal || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Ref</label>
                      <input type="text" name="ref" value={formData.ref || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">TOP (Hari)</label>
                      <input type="number" name="top" value={formData.top || 0} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic" placeholder="30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">PPN (%)</label>
                      <input type="number" name="ppnRate" value={formData.ppnRate || 0} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic" placeholder="11" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black italic text-orange-800 border-b pb-1 flex items-center gap-2 uppercase tracking-tighter">🏢 Supplier</h3>
                  <div>
                    <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Nama Supplier</label>
                    <input type="text" name="supplier" value={formData.supplier || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">UP / Attention</label>
                    <input type="text" name="attention" value={formData.attention || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" placeholder="Contoh: Ibu Yenah" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black italic text-purple-800 border-b pb-1 flex items-center gap-2 uppercase tracking-tighter">📍 Lokasi & Project</h3>
                  <div className="flex items-end gap-2">
                    <div className="flex-grow">
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Project</label>
                      <select name="projectId" value={formData.projectId || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter">
                        <option value="">General Purchase</option>
                        {projectList.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.kodeProject} - {p.namaProject || p.customer}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formData.projectId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const project = resolveProjectByRef(String(formData.projectId || ''));
                          if (project && Array.isArray(project.boq) && project.boq.length > 0) {
                          const materialBoq = project.boq.filter((item: any) => !isNonProcurementBOQItem(item));
                          const skipped = project.boq.length - materialBoq.length;
                          const boqItems: POItem[] = materialBoq.map((item, index) => {
                            const boqQty = getBoqBudgetQty(item);
                              
                            // Check if item exists in master data
                            const existingStock = stockItemList.find(s => 
                              (item.itemKode && s.kode === item.itemKode) || 
                              (s.nama.toLowerCase() === item.materialName.toLowerCase())
                            );

                            return {
                              no: index + 1,
                              nama: item.materialName,
                              qty: boqQty,
                              unit: item.unit,
                              harga: item.unitPrice,
                              isNewSku: !existingStock,
                                kode: existingStock?.kode || item.itemKode || `GTP-MTR-${item.materialName.substring(0,3).toUpperCase()}-${Math.floor(100+Math.random()*900)}`,
                                supplier: item.supplier,
                                source: 'Project BOQ',
                                sourceRef: project.id
                              };
                            });
                            const merged = mergeItemsWithProjectBoq(items, boqItems);
                            setItems(merged.items);
                            calculateTotal(merged.items);
                            if (!formData.supplier && boqItems.length > 0 && boqItems[0].supplier) {
                              setFormData(prev => ({ 
                                ...prev, 
                                supplier: boqItems[0].supplier,
                                notes: prev.notes || `PO untuk Project: ${project.kodeProject} - ${project.namaProject || project.customer}`
                              }));
                            }
                            toast.success(
                              `BOQ diimport: ${merged.importedCount} item baru, ${merged.mergedCount} item digabung.`
                            );
                            if (skipped > 0) {
                              toast.info(`${skipped} item manpower/jasa tidak dimasukkan ke Purchase Order.`);
                            }
                          } else {
                            toast.error("Proyek ini belum memiliki BOQ atau semua item sudah teralokasi.");
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
                        title="Tarik data dari Bill of Quantities Proyek"
                      >
                        <LinkIcon size={14} /> BOQ
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Alamat Supplier</label>
                    <textarea name="supplierAddress" value={formData.supplierAddress || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" rows={1} />
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Catatan Internal / PO Notes</label>
                    <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" rows={1} placeholder="Catatan yang akan muncul di dokumen PO" />
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Hormat Kami (Nama Penandatangan)</label>
                    <input type="text" name="signatoryName" value={formData.signatoryName || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter" placeholder="SYAMSUDIN" />
                  </div>
                </div>
              </div>

              {/* Items Table Input */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800">Daftar Barang</h3>
                  <button type="button" onClick={addItem} className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"><Plus size={16} /> Tambah Baris</button>
                </div>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-blue-200">
                      <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-black text-gray-400 mt-6">{index + 1}</div>
                        
                        <div className="flex-grow space-y-3">
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 lg:col-span-6">
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest">Nama Barang / Spesifikasi</label>
                                {item.isNewSku ? (
                                  <span className="text-[9px] font-mono font-bold bg-indigo-600 text-white px-2 py-0.5 rounded border border-indigo-700 uppercase tracking-tighter shadow-sm animate-pulse">
                                    AUTO-REGISTER SKU (DB): {item.kode || 'AUTO'}
                                  </span>
                                ) : (
                                  item.kode && (
                                    <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                                      MATCH SKU: {item.kode}
                                    </span>
                                  )
                                )}
                              </div>
                              <input 
                                type="text" 
                                list="sku-suggestions"
                                autoComplete="off"
                                value={item.nama || ''} 
                                onChange={e => handleItemChange(index, 'nama', e.target.value)} 
                                className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-black italic uppercase tracking-tighter ${item.isNewSku ? 'border-indigo-200' : 'border-gray-200'}`}
                                placeholder="Cari atau ketik nama barang baru..."
                              />
                              <datalist id="sku-suggestions">
                                {skuSuggestions.map(s => (
                                  <option key={s.id} value={s.nama}>
                                    {s.kode} - {s.kategori}
                                  </option>
                                ))}
                              </datalist>
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Qty</label>
                              <input type="number" value={item.qty ?? 0} onChange={e => handleItemChange(index, 'qty', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic" />
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Unit</label>
                              <input type="text" value={item.unit || ''} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic uppercase tracking-widest" />
                            </div>

                            <div className="col-span-12 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Harga Satuan</label>
                              <input type="number" value={item.harga ?? 0} onChange={e => handleItemChange(index, 'harga', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic text-indigo-600" />
                            </div>
                          </div>

                          {item.isNewSku && (
                            <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                              <div className="flex-shrink-0">
                                <Package className="w-5 h-5 text-indigo-500" />
                              </div>
                              <div className="flex-grow grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-black italic text-indigo-400 uppercase tracking-widest mb-1">Kategori SKU Baru</label>
                                  <input 
                                    type="text"
                                    value={item.kategori || ''} 
                                    onChange={e => handleItemChange(index, 'kategori', e.target.value)}
                                    placeholder="Contoh: PPE, Castable, dll"
                                    className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-black italic text-indigo-900 outline-none placeholder:text-indigo-200 uppercase tracking-widest"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black italic text-indigo-400 uppercase tracking-widest mb-1">Kode SKU (Opsional)</label>
                                  <input 
                                    type="text" 
                                    placeholder="Auto-generated if blank"
                                    value={item.kode || ''} 
                                    onChange={e => handleItemChange(index, 'kode', e.target.value)}
                                    className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-mono font-black text-indigo-900 outline-none uppercase italic"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl mt-6 transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-6">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">Simpan Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal (Print Layout) */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-[21cm] min-h-[29.7cm] shadow-2xl relative my-8 print:my-0 print:shadow-none print:w-full">
            {/* Close & Download Buttons (Hidden during print) */}
            <div className="absolute -top-14 right-0 flex gap-3 print:hidden items-center">
                <button onClick={() => handleDownloadWord(selectedPO)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg">
                  <FileDown size={18} /> Export PO Word + Excel
                </button>
                <button onClick={() => handleDownloadSuratJalan(selectedPO)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg">
                  <TruckIcon size={18} /> Surat Jalan
                </button>
                {(selectedPO.status === 'Sent' || selectedPO.status === 'Partial') && (
                  <button 
                    onClick={() => navigate('/purchasing/receiving', { 
                      state: { 
                        fromPO: true, 
                        poId: selectedPO.id, 
                        poNo: selectedPO.noPO, 
                        supplier: selectedPO.supplier, 
                        projectId: selectedPO.projectId, 
                        items: selectedPO.items 
                      } 
                    })} 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg"
                  >
                    <Package size={18} /> Terima Barang
                  </button>
                )}
                <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                <Printer size={18} /> Print PDF
              </button>
              <button 
                onClick={() => setShowDetailModal(false)} 
                className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full transition-all shadow-xl border-2 border-white ml-2"
                title="Tutup Detail"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-[1.5cm] text-black">
              {/* Kop Surat */}
              <div className="border-b-[3px] border-black pb-4 mb-6 flex justify-between items-center">
                <div className="flex-shrink-0">
                  <ImageWithFallback src={gmLogo} alt="GM Teknik Logo" className="h-16 w-auto object-contain" />
                </div>
                <div className="text-right flex-grow">
                  <h1 className="text-2xl font-black tracking-tight text-black leading-none mb-1 uppercase">GEMA TEKNIK PERKASA</h1>
                  <p className="text-[11px] font-bold italic text-black mb-1">General Trading & Supplier</p>
                  <p className="text-[10px] font-medium leading-tight text-black max-w-[400px] ml-auto">
                    JL. Nurushoba II No 13 RT 04/03 Setia Mekar, Tambun Selatan Bekasi 17510
                  </p>
                  <p className="text-[10px] font-medium leading-tight text-black">
                    Phone : 085100420221, 021.88354139 | Email : gemateknik@gmail.com
                  </p>
                </div>
              </div>

              {/* Admin Info */}
              <div className="flex justify-between mb-8 text-[11px] font-sans">
                <div className="space-y-1">
                  <p className="font-bold mb-1">DITUJUKAN KEPADA / TO:</p>
                  <p className="font-black text-[13px] uppercase">{selectedPO.supplier}</p>
                  <p className="max-w-[300px] leading-tight text-[11px]">{selectedPO.supplierAddress || 'Alamat tidak tersedia'}</p>
                  <div className="pt-2 flex gap-1">
                    <span className="font-bold">UP / Attention:</span>
                    <span className="font-black uppercase">{selectedPO.attention || '-'}</span>
                  </div>
                </div>
                <div className="text-right space-y-1 w-[250px]">
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">TANGGAL :</span>
                    <span className="font-medium">{new Date(selectedPO.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">NO. PO :</span>
                    <span className="font-black">{selectedPO.noPO}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">REF :</span>
                    <span className="font-medium">{selectedPO.ref || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">NPWP :</span>
                    <span className="font-medium">83.117.677.1.435.000</span>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black border-b-2 border-black inline-block px-10 pb-1 uppercase tracking-widest font-serif">Purchase Order</h2>
              </div>

              <p className="text-[11px] mb-4 italic font-medium">Harap disiapkan pesanan barang kami sebagai berikut:</p>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full border-[1.5px] border-black text-[11px] font-sans table-fixed">
                  <thead>
                    <tr className="bg-gray-200 border-b-[1.5px] border-black h-10">
                      <th className="border-r-[1.5px] border-black text-center w-10">NO</th>
                      <th className="border-r-[1.5px] border-black px-3 text-left">NAMA BARANG / SPESIFIKASI</th>
                      <th className="border-r-[1.5px] border-black text-center w-20">QTY</th>
                      <th className="border-r-[1.5px] border-black text-center w-32">HARGA SATUAN</th>
                      <th className="text-center w-32">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-400 min-h-[40px]">
                        <td className="border-r-[1.5px] border-black py-2 text-center font-bold">{idx + 1}</td>
                        <td className="border-r-[1.5px] border-black py-2 px-3 font-medium uppercase break-words">{item.nama}</td>
                        <td className="border-r-[1.5px] border-black py-2 text-center font-bold uppercase">{item.qty} {item.unit}</td>
                        <td className="border-r-[1.5px] border-black py-2 px-3 text-right font-medium">
                          {formatCurrency(getItemUnitPrice(item))}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {formatCurrency(getItemLineTotal(item))}
                        </td>
                      </tr>
                    ))}
                    {/* Calculations Rows inside Table */}
                    <tr className="border-t-[1.5px] border-black font-bold h-8">
                      <td colSpan={3} className="border-r-[1.5px] border-black bg-white"></td>
                      <td className="border-r-[1.5px] border-black px-3 text-right uppercase bg-gray-50">Subtotal (Rp)</td>
                      <td className="px-3 text-right bg-gray-50 font-black">{formatCurrency(selectedPO.total)}</td>
                    </tr>
                    <tr className="border-t border-black font-bold h-8">
                      <td colSpan={3} className="border-r-[1.5px] border-black"></td>
                      <td className="border-r-[1.5px] border-black px-3 text-right uppercase bg-gray-50">PPN {selectedPO.ppn || 11}% (Rp)</td>
                      <td className="px-3 text-right bg-gray-50 font-black">{formatCurrency(selectedPO.total * (selectedPO.ppn || 11) / 100)}</td>
                    </tr>
                    <tr className="border-t-[1.5px] border-black font-bold h-10">
                      <td colSpan={3} className="border-r-[1.5px] border-black"></td>
                      <td className="border-r-[1.5px] border-black px-3 text-right uppercase bg-gray-300 text-[12px]">Grand Total (Rp)</td>
                      <td className="px-3 text-right bg-gray-300 text-[12px] font-black">{formatCurrency(selectedPO.total + (selectedPO.total * (selectedPO.ppn || 11) / 100))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Catatan Section */}
              <div className="mt-6 text-[11px] font-sans text-black">
                <p className="font-bold mb-2 uppercase border-b border-black inline-block">Catatan / Notes :</p>
                <div className="space-y-1 ml-2 whitespace-pre-line leading-relaxed italic">
                  {selectedPO.notes || '- Pembayaran COD ( Cash On Delivery )\n- Barang dikirim sesuai dengan spesifikasi yang tertera'}
                </div>
              </div>

              {/* Signatures Area - Styled to match screenshot */}
              <div className="flex justify-between mt-12 text-[11px] font-sans">
                <div className="text-center w-[250px]">
                  <p className="font-bold mb-20 text-black uppercase">DITERIMA OLEH / RECEIVED BY,</p>
                  <p className="font-bold text-black">( ............................................... )</p>
                  <p className="text-[9px] italic mt-1 text-gray-500">Supplier Signature & Stamp</p>
                </div>
                <div className="text-center w-[250px]">
                  <p className="font-bold mb-20 text-black uppercase">HORMAT KAMI / BEST REGARDS,</p>
                  <p className="font-black text-black underline uppercase underline-offset-4 tracking-tight decoration-black decoration-1 text-[12px]">{selectedPO.signatoryName || 'SYAMSUDIN'}</p>
                  <p className="text-[9px] italic mt-1 text-gray-500">Authorized Signature</p>
                </div>
              </div>

              {/* Back button at the bottom for convenience */}
              <div className="mt-12 flex justify-center print:hidden border-t pt-8">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-10 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border border-gray-300 shadow-sm"
                >
                  <X size={20} /> Tutup Preview Dokumen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles for Printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:w-full { width: 100% !important; }
          .print\\:max-w-none { max-w: none !important; }
          .print\\:h-auto { height: auto !important; }
          .fixed.inset-0 { 
            position: absolute !important; 
            top: 0; left: 0; 
            background: white !important; 
            visibility: visible !important;
          }
          .fixed.inset-0 > div {
            visibility: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      {/* SKU Registration Modal Bridge */}
      <SKURegistrationModal 
        isOpen={showSkuModal} 
        onClose={() => setShowSkuModal(false)} 
        initialName={skuInitialName}
      />
    </div>
  );
}
