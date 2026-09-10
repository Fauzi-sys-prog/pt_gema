import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Printer, Download, X, Link as LinkIcon, Package, TruckIcon, FileText, FileDown, Send, UserPlus, Warehouse } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { PurchaseOrder } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { SKURegistrationModal } from '../../components/SKURegistrationModal';
import FileSaver from 'file-saver';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  VerticalAlign,
  ImageRun
} from 'docx';
import gmLogo from "figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png";
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface POItem {
  no: number;
  nama: string;
  qty: number;
  unit: string;
  harga: number;
  kategori?: string;
  kode?: string;
}

interface LocationState {
  fromProject?: boolean;
  projectId?: string;
  projectNo?: string;
  projectName?: string;
  boqItems?: Array<{
    materialName: string;
    qtyEstimate: number;
    unit: string;
    unitPrice: number;
    supplier: string;
    status: string;
  }>;
  fromMR?: boolean;
  mrId?: string;
  mrNo?: string;
  mrItems?: Array<{
    itemKode: string;
    itemNama: string;
    qty: number;
    unit: string;
  }>;
}

export default function PurchaseOrderPage() {
  const { poList, setPoList, addPO, updatePO, projectList, updateProject, stockItemList } = useApp();
  const { currentUser } = useAuth();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedPOId, setHighlightedPOId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
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
    items: [],
    notes: '',
    ppn: 11,
    ppnRate: 11,
    top: 30, // Default 30 days
    deliveryDate: '',
    signatoryName: 'SYAMSUDIN',
  });

  const handleClearAllPO = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua data Purchase Order? Tindakan ini tidak dapat dibatalkan.')) {
      setPoList([]);
      toast.success('Semua data Purchase Order telah dihapus.');
    }
  };

  const [items, setItems] = useState<POItem[]>([
    { no: 1, nama: '', qty: 1, unit: 'pcs', harga: 0 }
  ]);

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
    { condition: showSkuModal, close: () => setShowSkuModal(false) },
  ]);


  // Auto-fill logic (same as before)
  useEffect(() => {
    if (locationState?.fromProject && locationState?.boqItems) {
      const { projectId, projectNo, projectName, boqItems } = locationState;
      const project = projectList.find(p => p.id === projectId);
      const customerPT = project?.customer || "";
      
      setFormData(prev => ({
        ...prev,
        projectId: projectId,
        notes: `PO untuk Project: ${projectNo} - ${projectName}${customerPT ? ` - ${customerPT}` : ""}`,
      }));
      const poItems: POItem[] = boqItems.map((item, index) => {
        // Strict matching: Check by kode first, then name
        const existingStock = stockItemList.find(s => 
          (item.itemKode && s.kode === item.itemKode) || 
          (s.nama.toLowerCase() === item.materialName.toLowerCase())
        );
        
        // Ensure quantity is always positive for PO
        const absoluteQty = Math.abs(item.qtyEstimate || 0);
        
        return {
          no: index + 1,
          nama: item.materialName,
          qty: absoluteQty,
          unit: item.unit,
          harga: item.unitPrice,
          kode: existingStock?.kode || item.itemKode || `GTP-MTR-${item.materialName.substring(0,3).toUpperCase()}-${Math.floor(100+Math.random()*900)}`,
          kategori: existingStock?.kategori || 'General'
        };
      });
      setItems(poItems);
      calculateTotal(poItems);
      const suppliers = boqItems.map(item => item.supplier).filter(Boolean);
      const uniqueSuppliers = [...new Set(suppliers)];
      if (uniqueSuppliers.length === 1) {
        setFormData(prev => ({ ...prev, supplier: uniqueSuppliers[0] }));
      }
      setShowModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }

  }, [locationState]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number) => {
    const newItems = [...items];
    
    if (field === 'nama' && typeof value === 'string') {
      const trimmedValue = value.trim();
      const found = stockItemList.find(s => s.nama.toLowerCase() === trimmedValue.toLowerCase());
      
      if (found) {
        newItems[index] = {
          ...newItems[index],
          nama: found.nama,
          unit: found.satuan,
          harga: found.hargaSatuan,
          kategori: found.kategori,
          kode: found.kode
        };
      } else {
        newItems[index] = {
          ...newItems[index],
          nama: value,
          kode: '',
          kategori: '',
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

  const handleSubmit = (e: React.FormEvent, submitForApproval = false) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Safety check for negative QTY
    const hasNegativeQty = items.some(item => (item.qty || 0) < 0);
    if (hasNegativeQty) {
      toast.error("Jumlah barang (QTY) tidak boleh negatif!");
      return;
    }
    setIsSubmitting(true);

    const poData = {
      ...formData,
      status: submitForApproval ? 'Pending' : formData.status,
      items: items.map(item => ({
        nama: item.nama,
        qty: item.qty,
        unit: item.unit,
        harga: item.harga,
        kode: item.kode || stockItemList.find(s => s.nama === item.nama)?.kode,
      })),
    };

    try {
      if (editMode && selectedPO) {
        updatePO(selectedPO.id, poData);
      } else {
        const newPO: PurchaseOrder = {
          id: `PO-${Date.now()}`,
          noPO: formData.noPO || `PO-${new Date().getFullYear()}-${String(poList.length + 1).padStart(3, '0')}`,
          ...poData as PurchaseOrder,
        };
        addPO(newPO);

        // Update BOQ Status in Project if linked
        if (formData.projectId) {
          const project = projectList.find(p => p.id === formData.projectId);
          if (project && project.boq) {
            const updatedBOQ = project.boq.map(boqItem => {
              // Check if this BOQ item is in the PO items
              const matchedPOItem = items.find(pi =>
                (pi.kode && pi.kode === boqItem.itemKode) ||
                (pi.nama.toLowerCase() === boqItem.materialName.toLowerCase())
              );

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
            } catch (boqErr) {
              // PO sudah tersimpan — laporkan kegagalan sinkronisasi BOQ secara eksplisit.
              toast.error('PO tersimpan, tapi status BOQ project gagal diperbarui: ' + (boqErr instanceof Error ? boqErr.message : 'Error'));
            }
          }
        }
      }
      if (submitForApproval) {
        toast.success('PO dikirim ke Approver — menunggu persetujuan.');
      } else {
        toast.success(editMode ? 'Purchase Order diperbarui.' : 'Purchase Order disimpan sebagai Draft.');
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error('PO gagal disimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
      items: [],
      notes: '',
      ppn: 11,
      ppnRate: 11,
      top: 30,
      deliveryDate: '',
      signatoryName: 'SYAMSUDIN',
    });
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
    // Fetch the logo as a blob/buffer for docx
    let logoData;
    try {
      const response = await fetch(gmLogo);
      logoData = await response.arrayBuffer();
    } catch (e) {
      console.error("Failed to load logo for Word document", e);
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          // HEADER TABLE
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 24, color: "000000" },
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      logoData ? new Paragraph({
                        children: [
                          new ImageRun({
                            data: logoData,
                            transformation: { width: 140, height: 60 },
                          }),
                        ],
                      }) : new Paragraph("GM TEKNIK"),
                    ],
                  }),
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "GEMA TEKNIK PERKASA", bold: true, size: 26, font: "Arial" }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "General Trading & Supplier", italic: true, size: 18, font: "Arial" }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "JL. Nurushoba II No 13 RT 04/03 Setia Mekar Tambun Selatan Bekasi 17510", size: 14, font: "Arial" }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "Phone : 085100420221, 021.88354139 | Email : gemateknik@gmail.com", size: 14, font: "Arial" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 200 } }),

          // INFO SECTION
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "DITUJUKAN KEPADA / TO:", bold: true, size: 18, font: "Arial" })] }),
                      new Paragraph({ children: [new TextRun({ text: po.supplier.toUpperCase(), bold: true, size: 20, font: "Arial" })] }),
                      new Paragraph({ children: [new TextRun({ text: po.supplierAddress || "Alamat tidak tersedia", size: 18, font: "Arial" })] }),
                      new Paragraph({ children: [new TextRun({ text: `UP / Attention: ${po.attention || "-"}`, bold: true, size: 18, font: "Arial" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ 
                        alignment: AlignmentType.RIGHT, 
                        children: [
                          new TextRun({ text: "TANGGAL : ", bold: true, size: 18, font: "Arial" }),
                          new TextRun({ text: new Date(po.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), size: 18, font: "Arial" })
                        ] 
                      }),
                      new Paragraph({ 
                        alignment: AlignmentType.RIGHT, 
                        children: [
                          new TextRun({ text: "NO. PO : ", bold: true, size: 18, font: "Arial" }),
                          new TextRun({ text: po.noPO, bold: true, size: 18, font: "Arial" })
                        ] 
                      }),
                      new Paragraph({ 
                        alignment: AlignmentType.RIGHT, 
                        children: [
                          new TextRun({ text: "REF : ", bold: true, size: 18, font: "Arial" }),
                          new TextRun({ text: po.ref || "-", size: 18, font: "Arial" })
                        ] 
                      }),
                      new Paragraph({ 
                        alignment: AlignmentType.RIGHT, 
                        children: [
                          new TextRun({ text: "NPWP : ", bold: true, size: 16, font: "Arial" }),
                          new TextRun({ text: "83.117.677.1.435.000", size: 16, font: "Arial" })
                        ] 
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({ text: "PURCHASE ORDER", bold: true, size: 32, underline: { type: "single" }, font: "Arial" }),
            ],
          }),

          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Harap disiapkan pesanan barang kami sebagai berikut:", italic: true, size: 18, font: "Arial" }),
            ],
          }),

          // ITEMS TABLE
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NO", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NAMA BARANG / SPESIFIKASI", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "QTY", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HARGA SATUAN", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TOTAL", bold: true, size: 18, font: "Arial" })] })] }),
                ],
              }),
              ...po.items.map((item, idx) => (
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (idx + 1).toString(), size: 18, font: "Arial" })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.nama.toUpperCase(), size: 18, font: "Arial" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.qty} ${item.unit}`, size: 18, font: "Arial" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(item.harga), size: 18, font: "Arial" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(item.qty * item.harga), bold: true, size: 18, font: "Arial" })] })] }),
                  ],
                })
              )),
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 3, borders: { left: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } }, children: [] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "SUBTOTAL (Rp)", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(po.total), bold: true, size: 18, font: "Arial" })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 3, borders: { left: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } }, children: [] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `PPN ${po.ppn || 11}% (Rp)`, bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(po.total * (po.ppn || 11) / 100), bold: true, size: 18, font: "Arial" })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 3, borders: { left: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } }, children: [] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "GRAND TOTAL (Rp)", bold: true, size: 18, font: "Arial" })] })] }),
                  new TableCell({ shading: { fill: "D9D9D9" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(po.total + (po.total * (po.ppn || 11) / 100)), bold: true, size: 18, font: "Arial" })] })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "CATATAN / NOTES:", bold: true, size: 18, font: "Arial", underline: {} })] }),
          ...(po.notes ? po.notes.split('\n') : ["- Pembayaran dilakukan via Transfer Bank / COD", "- Barang dikirim sesuai dengan spesifikasi yang tertera"]).map(noteLine => 
            new Paragraph({ children: [new TextRun({ text: noteLine, size: 18, font: "Arial" })] })
          ),

          new Paragraph({ spacing: { before: 800 } }),

          // SIGNATURES
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DITERIMA OLEH / RECEIVED BY,", bold: true, size: 18, font: "Arial" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: "( ............................................... )", bold: true, size: 18, font: "Arial" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Supplier Signature & Stamp", size: 14, italic: true, font: "Arial" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HORMAT KAMI / BEST REGARDS,", bold: true, size: 18, font: "Arial" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: (po.signatoryName || "SYAMSUDIN").toUpperCase(), bold: true, size: 18, font: "Arial" })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Authorized Signature", size: 14, italic: true, font: "Arial" })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    FileSaver.saveAs(blob, `PO_${po.noPO.replace(/\//g, '_')}.docx`);
    toast.success("Dokumen Word PO berhasil diunduh.");
  };

  const filteredPO = poList.filter((po) => {
    const matchesSearch = po.noPO.toLowerCase().includes(searchTerm.toLowerCase()) || po.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
    const matchesProject = filterProject === 'all' || (filterProject === 'general' && !po.projectId) || (filterProject !== 'general' && po.projectId === filterProject);
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
          <button
            onClick={() => navigate('/inventory/center')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
          >
            <Warehouse size={18} /> Cek Stok
          </button>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          >
            <option value="all">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending (Review)</option>
            <option value="Approved">Approved</option>
            <option value="Partial">Partial</option>
            <option value="Received">Received</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
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
                  {po.projectId && <p className="text-blue-600 text-[10px] font-bold">Project: {projectList.find(p => p.id === po.projectId)?.kodeProject}</p>}
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
                      <button onClick={() => { setSelectedPO(po); setFormData(po); setItems(po.items.map((it, i) => ({ ...it, no: i + 1 }))); setEditMode(true); setShowModal(true); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Edit"><Edit size={18} /></button>
                    )}
                    <button onClick={() => { setSelectedPO(po); setShowDetailModal(true); setTimeout(() => window.print(), 300); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Print PDF"><Printer size={18} /></button>
                    <button onClick={() => handleDownloadWord(po)} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg" title="Download Word"><FileDown size={18} /></button>
                    {po.status === 'Approved' || po.status === 'Partial' ? (
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
                    <input type="text" name="noPO" value={formData.noPO || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" placeholder="Contoh: 49/GMT/PO/III/2025" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Tanggal</label>
                      <input type="date" name="tanggal" value={formData.tanggal || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Ref</label>
                      <input type="text" name="ref" value={formData.ref || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">TOP (Hari)</label>
                      <input type="number" name="top" value={formData.top || 0} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" placeholder="30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">PPN (%)</label>
                      <input type="number" name="ppnRate" value={formData.ppnRate || 0} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" placeholder="11" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black italic text-orange-800 border-b pb-1 flex items-center gap-2 uppercase tracking-tighter">🏢 Supplier</h3>
                  <div>
                    <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Nama Supplier</label>
                    <input type="text" name="supplier" value={formData.supplier || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">UP / Attention</label>
                    <input type="text" name="attention" value={formData.attention || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" placeholder="Contoh: Ibu Yenah" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black italic text-purple-800 border-b pb-1 flex items-center gap-2 uppercase tracking-tighter">📍 Lokasi & Project</h3>
                  <div className="flex items-end gap-2">
                    <div className="flex-grow">
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Project</label>
                      <select name="projectId" value={formData.projectId || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black">
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
                          const project = projectList.find(p => p.id === formData.projectId);
                          if (project && project.boq && project.boq.length > 0) {
                            const boqItems: POItem[] = project.boq.map((item, index) => {
                              const remainingQty = Math.max(0, (item.qtyEstimate || 0) - (item.qtyActual || 0));
                              
                              // Check if item exists in master data
                              const existingStock = stockItemList.find(s => 
                                (item.itemKode && s.kode === item.itemKode) || 
                                (s.materialName && s.nama.toLowerCase() === item.materialName.toLowerCase())
                              );

                              return {
                                no: index + 1,
                                nama: item.materialName,
                                qty: remainingQty,
                                unit: item.unit,
                                harga: item.unitPrice,
                                kode: existingStock?.kode || item.itemKode || `GTP-MTR-${item.materialName.substring(0,3).toUpperCase()}-${Math.floor(100+Math.random()*900)}`,
                                supplier: item.supplier
                              };
                            });
                            setItems(boqItems);
                            calculateTotal(boqItems);
                            if (boqItems.length > 0 && boqItems[0].supplier) {
                              setFormData(prev => ({ 
                                ...prev, 
                                supplier: boqItems[0].supplier,
                                notes: prev.notes || `PO untuk Project: ${project.kodeProject} - ${project.namaProject || project.customer}`
                              }));
                            }
                            toast.success(`Berhasil mengimpor ${boqItems.length} item dari BOQ Proyek.`);
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
                    <textarea name="supplierAddress" value={formData.supplierAddress || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" rows={1} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Telepon Supplier</label>
                      <input type="text" name="supplierPhone" value={formData.supplierPhone || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" placeholder="021-..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Fax Supplier</label>
                      <input type="text" name="supplierFax" value={formData.supplierFax || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" placeholder="021-..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black italic text-gray-500 uppercase mb-1 tracking-widest">Contact Person</label>
                      <input type="text" name="supplierContact" value={formData.supplierContact || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" placeholder="Nama PIC" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Tanggal Pengiriman (Delivery Date)</label>
                    <input type="date" name="deliveryDate" value={formData.deliveryDate || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic text-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Catatan Internal / PO Notes</label>
                    <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" rows={1} placeholder="Catatan yang akan muncul di dokumen PO" />
                  </div>
                  <div>
                    <label className="block text-xs font-black italic text-gray-500 uppercase mb-1 tracking-widest">Hormat Kami (Nama Penandatangan)</label>
                    <input type="text" name="signatoryName" value={formData.signatoryName || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-black italic uppercase tracking-tighter text-black" placeholder="SYAMSUDIN" />
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
                                {item.kode && (
                                  <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                                    SKU: {item.kode}
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                list="sku-suggestions"
                                value={item.nama || ''}
                                onChange={e => handleItemChange(index, 'nama', e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-black italic uppercase tracking-tighter"
                                placeholder="Cari nama barang dari master stok..."
                              />
                              <datalist id="sku-suggestions">
                                {stockItemList.map(s => <option key={s.id} value={s.nama}>{s.kode} - {s.kategori}</option>)}
                              </datalist>
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Qty</label>
                              <input type="number" value={item.qty ?? 0} onChange={e => handleItemChange(index, 'qty', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic text-black" />
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Unit</label>
                              <input type="text" value={item.unit || ''} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic uppercase tracking-widest text-black" />
                            </div>

                            <div className="col-span-12 lg:col-span-2">
                              <label className="block text-[10px] font-black italic text-gray-400 uppercase tracking-widest mb-1">Harga Satuan</label>
                              <input type="number" value={item.harga ?? 0} onChange={e => handleItemChange(index, 'harga', Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-black italic text-indigo-600" />
                            </div>
                          </div>

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
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={isSubmitting} className="px-6 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Batal</button>
                {!editMode && (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e as any, false)}
                    disabled={isSubmitting}
                    className="px-6 py-2 border border-slate-300 bg-white rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Simpan Draft
                  </button>
                )}
                <button
                  type={editMode ? 'submit' : 'button'}
                  onClick={editMode ? undefined : (e) => handleSubmit(e as any, true)}
                  disabled={isSubmitting}
                  className="px-8 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  {isSubmitting ? 'Memproses...' : editMode ? 'Simpan Perubahan' : 'Submit untuk Approval'}
                </button>
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
                  <FileDown size={18} /> Word PO
                </button>
                <button
                  onClick={() => navigate('/surat-menyurat/surat-jalan', {
                    state: {
                      fromPO: true,
                      poId: selectedPO.id,
                      poNo: selectedPO.noPO,
                      supplier: selectedPO.supplier,
                      projectId: selectedPO.projectId,
                      items: selectedPO.items,
                    }
                  })}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg"
                >
                  <TruckIcon size={18} /> Buat Surat Jalan
                </button>
                {(selectedPO.status === 'Approved' || selectedPO.status === 'Partial') && (
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
                          {formatCurrency(item.harga)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {formatCurrency(item.qty * item.harga)}
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
