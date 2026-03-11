import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Package,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingCart,
  Save,
  X,
  FileText,
  Star,
  AlertCircle,
  Download,
  ClipboardList,
  Wrench,
  Camera,
  Send,
  ChevronDown,
  ChevronUp,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import type { DataCollection as DataCollectionType } from "../../contexts/AppContext";
import api from "../../services/api";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { toast } from "sonner@2.0.3";
import {
  ManpowerModal,
} from "../../components/data-collection/ManpowerModal";
import type { Manpower } from "../../components/data-collection/ManpowerModal";
import {
  ScheduleModal,
} from "../../components/data-collection/ScheduleModal";
import type { Schedule } from "../../components/data-collection/ScheduleModal";
import {
  ConsumableModal,
} from "../../components/data-collection/ConsumableModal";
import type { Consumable } from "../../components/data-collection/ConsumableModal";
import {
  EquipmentModal,
} from "../../components/data-collection/EquipmentModal";
import type { Equipment } from "../../components/data-collection/EquipmentModal";
import {
  BOMMaterialModal,
} from "../../components/data-collection/BOMMaterialModal";
import type { BOMMaterial } from "../../components/data-collection/BOMMaterialModal";
import { BOMSummaryTable } from "../../components/data-collection/BOMSummaryTable";

// Material Interface
interface Material {
  id: string;
  materialName: string;
  qtyEstimate: number;
  qtyActual: number;
  unit: string;
  supplier: string;
  status?: string;
}

// Signature Canvas Component
const SignatureCanvas = ({
  onSave,
}: {
  onSave: (data: string) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
      }
    }
  }, []);

  const startDrawing = (
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      const x =
        "touches" in e
          ? e.touches[0].clientX - rect.left
          : e.clientX - rect.left;
      const y =
        "touches" in e
          ? e.touches[0].clientY - rect.top
          : e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      const x =
        "touches" in e
          ? e.touches[0].clientX - rect.left
          : e.clientX - rect.left;
      const y =
        "touches" in e
          ? e.touches[0].clientY - rect.top
          : e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseOut={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="w-full h-48 cursor-crosshair"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-bold transition-colors"
        >
          <Trash2 size={14} /> Clear
        </button>
        <button
          type="button"
          onClick={save}
          className="flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition-colors shadow-sm"
        >
          <CheckCircle size={14} /> Simpan Tanda Tangan
        </button>
      </div>
    </div>
  );
};

export default function DataCollection() {
  const {
    dataCollectionList,
    addDataCollection,
    updateDataCollection,
    deleteDataCollection,
    addProject,
    quotationList,
  } = useApp();
  const navigate = useNavigate();
  const [serverDataCollectionList, setServerDataCollectionList] = useState<DataCollectionType[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveDataCollectionList = serverDataCollectionList ?? dataCollectionList;

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<DataCollectionType | null>(null);
  const [exportingKey, setExportingKey] = useState("");
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "materials"
    | "manpower"
    | "schedule"
    | "consumables"
    | "equipment"
    | "datafields"
    | "verification"
  >("overview");
  const { stockItemList } = useApp();

  // Signature State
  const [signatureData, setSignatureData] = useState<
    string | null
  >(null);

  // Material Modal
  const [showMaterialModal, setShowMaterialModal] =
    useState(false);
  const [editingMaterialIndex, setEditingMaterialIndex] =
    useState<number | null>(null);
  const [materialForm, setMaterialForm] = useState<Material>({
    id: "",
    materialName: "",
    qtyEstimate: 0,
    qtyActual: 0,
    unit: "",
    supplier: "",
  });

  // Material Modal untuk CREATE FORM
  const [
    showCreateFormMaterialModal,
    setShowCreateFormMaterialModal,
  ] = useState(false);
  const [
    editingCreateFormMaterialIndex,
    setEditingCreateFormMaterialIndex,
  ] = useState<number | null>(null);
  const [materialSearchTerm, setMaterialSearchTerm] =
    useState("");
  const [createFormMaterialForm, setCreateFormMaterialForm] =
    useState<Material>({
      id: "",
      materialName: "",
      qtyEstimate: 0,
      qtyActual: 0,
      unit: "",
      supplier: "",
      status: "Not Ordered",
    });

  // Suggestion list from stock
  const suggestedMaterials = stockItemList
    .filter(
      (item) =>
        (item.nama || "")
          .toLowerCase()
          .includes(materialSearchTerm.toLowerCase()) ||
        (item.kode || "")
          .toLowerCase()
          .includes(materialSearchTerm.toLowerCase()),
    )
    .slice(0, 5);

  // Manpower State
  const [showManpowerModal, setShowManpowerModal] =
    useState(false);
  const [editingManpowerIndex, setEditingManpowerIndex] =
    useState<number | null>(null);

  // Schedule State
  const [showScheduleModal, setShowScheduleModal] =
    useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] =
    useState<number | null>(null);

  // Consumable State
  const [showConsumableModal, setShowConsumableModal] =
    useState(false);
  const [editingConsumableIndex, setEditingConsumableIndex] =
    useState<number | null>(null);

  // Equipment State
  const [showEquipmentModal, setShowEquipmentModal] =
    useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] =
    useState<number | null>(null);

  // BOM Material State
  const [showBOMMaterialModal, setShowBOMMaterialModal] =
    useState(false);
  const [editingBOMMaterialIndex, setEditingBOMMaterialIndex] =
    useState<number | null>(null);

  // Create Quotation after save state
  const [
    createQuotationAfterSave,
    setCreateQuotationAfterSave,
  ] = useState(false);

  // Advanced Options Collapse State
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(
    null,
  );
  const [formData, setFormData] = useState({
    noKoleksi: "",
    namaResponden: "",
    kategori: "Survey",
    tanggalPengumpulan: new Date().toISOString().split("T")[0],
    lokasi: "",
    namaKolektor: "",
    tipePekerjaan: "Pasang baru",
    jenisKontrak: "Subcontractor",
    dataFields: [] as {
      fieldName: string;
      fieldValue: string;
      fieldType:
        | "Text"
        | "Number"
        | "Date"
        | "Boolean"
        | "Rating";
    }[],
    materials: [] as any[], // Support both Material[] and BOMMaterial[]
    manpower: [] as Manpower[],
    schedule: [] as Schedule[],
    consumables: [] as Consumable[],
    equipment: [] as Equipment[],
    status: "Draft" as "Draft" | "Verified" | "Completed",
    notes: "",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    tags: [] as string[],
  });

  const fetchDataCollections = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get("/data-collections");
      const rows = Array.isArray(response.data) ? (response.data as DataCollectionType[]) : [];
      setServerDataCollectionList(rows);
    } catch {
      setServerDataCollectionList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDataCollections();
  }, []);

  const handleEditData = (item: DataCollectionType) => {
    setFormData({
      noKoleksi: item.noKoleksi || "",
      namaResponden: item.namaResponden || "",
      kategori: item.kategori || "Survey",
      tanggalPengumpulan:
        item.tanggalPengumpulan ||
        new Date().toISOString().split("T")[0],
      lokasi: item.lokasi || "",
      namaKolektor: item.namaKolektor || "",
      tipePekerjaan: item.tipePekerjaan || "Pasang baru",
      jenisKontrak: item.jenisKontrak || "Subcontractor",
      dataFields: item.dataFields || [],
      materials: item.materials || [],
      manpower: item.manpower || [],
      schedule: item.schedule || [],
      consumables: item.consumables || [],
      equipment: item.equipment || [],
      status: item.status || "Draft",
      notes: item.notes || "",
      priority: item.priority || "Medium",
      tags: item.tags || [],
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  // Filter data
  const filteredData = (effectiveDataCollectionList || []).filter(
    (item) => {
      if (!item) return false;
      const search = (searchTerm || "").toLowerCase();

      const matchSearch =
        (item.namaResponden || "")
          .toLowerCase()
          .includes(search) ||
        (item.noKoleksi || "").toLowerCase().includes(search) ||
        (item.lokasi || "").toLowerCase().includes(search) ||
        (item.namaKolektor || "")
          .toLowerCase()
          .includes(search);

      return matchSearch;
    },
  );

  // Statistics
  const stats = {
    total: (effectiveDataCollectionList || []).length,
    completed: (effectiveDataCollectionList || []).filter(
      (d) => d && d.status === "Completed",
    ).length,
    verified: (effectiveDataCollectionList || []).filter(
      (d) => d && d.status === "Verified",
    ).length,
    draft: (effectiveDataCollectionList || []).filter(
      (d) => d && d.status === "Draft",
    ).length,
    totalMaterials: (effectiveDataCollectionList || []).reduce(
      (sum, d) =>
        sum + (d && d.materials ? d.materials.length : 0),
      0,
    ),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalId = editingId;

    if (editingId) {
      updateDataCollection(editingId, {
        ...formData,
        signature: signatureData || undefined,
      });
      toast.success("Data Collection berhasil diperbarui");
      setEditingId(null);
    } else {
      const newId = `DC-${Date.now()}`;
      finalId = newId;
      const newData: DataCollectionType = {
        id: newId,
        noKoleksi:
          formData.noKoleksi ||
          `KOL-${new Date().getFullYear()}-${String(effectiveDataCollectionList.length + 1).padStart(4, "0")}`,
        ...formData,
        signature: signatureData || undefined,
      };

      addDataCollection(newData);
      toast.success("Data Collection berhasil disimpan");
    }

    // Jika checkbox "Create Quotation" checked, navigate ke halaman Quotation utama
    if (createQuotationAfterSave) {
      setShowModal(false);
      navigate("/sales/quotation", {
        state: {
          openQuotationModal: true,
          selectedDataCollectionId: finalId,
        },
      });
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      noKoleksi: "",
      namaResponden: "",
      kategori: "Survey",
      tanggalPengumpulan: new Date()
        .toISOString()
        .split("T")[0],
      lokasi: "",
      namaKolektor: "",
      tipePekerjaan: "Pasang baru",
      jenisKontrak: "Subcontractor",
      dataFields: [],
      materials: [],
      manpower: [],
      schedule: [],
      consumables: [],
      equipment: [],
      status: "Draft",
      notes: "",
      priority: "Medium",
      tags: [],
    });
    setSignatureData(null);
    setCreateQuotationAfterSave(false);
    setEditingId(null);
    setShowAdvanced(false); // Reset advanced options collapse
    setShowModal(false);
  };

  const handleViewDetail = (item: DataCollectionType) => {
    setSelectedItem(item);
    setActiveTab("overview");
    setShowDetailModal(true);
  };

  const handleDelete = (id: string) => {
    if (
      window.confirm("Apakah Anda yakin ingin menghapus data ini?")
    ) {
      deleteDataCollection(id);
      toast.success("Data Collection berhasil dihapus");
    }
  };

  const getFilenameFromDisposition = (
    disposition: string | undefined,
    fallback: string,
  ) => {
    if (!disposition) return fallback;
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch && utfMatch[1]) {
      try {
        return decodeURIComponent(utfMatch[1]);
      } catch {
        return utfMatch[1];
      }
    }
    const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
    return normalMatch?.[1] || fallback;
  };

  const handleBackendExport = async (
    item: DataCollectionType,
    format: "preview" | "word" | "excel",
  ) => {
    const id = String(item.id || "").trim();
    if (!id) {
      toast.error("ID Data Collection tidak valid");
      return;
    }

    const key = `${id}:${format}`;
    setExportingKey(key);
    try {
      const endpoint =
        format === "preview"
          ? `/exports/preview/data-collections/${id}`
          : `/exports/data-collections/${id}/${format}`;
      const response = await api.get(endpoint, { responseType: "blob" });
      const blob = new Blob([response.data], {
        type:
          format === "preview"
            ? "text/html;charset=utf-8"
            : format === "word"
              ? "application/msword"
              : "application/vnd.ms-excel",
      });
      const url = window.URL.createObjectURL(blob);

      if (format === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        return;
      }

      const fallbackName = `data-collection-${id}.${format === "word" ? "doc" : "xls"}`;
      const filename = getFilenameFromDisposition(
        response.headers?.["content-disposition"] as string | undefined,
        fallbackName,
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} berhasil`);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        toast.error(
          "Data Collection belum tersedia di backend export. Jalankan pipeline publish dulu.",
        );
      } else if (status === 401 || status === 403) {
        toast.error("Akses export ditolak. Silakan login ulang.");
      } else {
        toast.error(`Gagal export ${format.toUpperCase()}`);
      }
    } finally {
      setExportingKey("");
    }
  };

  // Material CRUD Functions
  const handleAddMaterial = () => {
    setMaterialForm({
      id: `MAT-${Date.now()}`,
      materialName: "",
      qtyEstimate: 0,
      qtyActual: 0,
      unit: "",
      supplier: "",
      status: "Not Ordered",
    });
    setEditingMaterialIndex(null);
    setShowMaterialModal(true);
  };

  const handleEditMaterial = (index: number) => {
    if (selectedItem && selectedItem.materials) {
      setMaterialForm(selectedItem.materials[index]);
      setEditingMaterialIndex(index);
      setShowMaterialModal(true);
    }
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItem) {
      let updatedMaterials = selectedItem.materials || [];

      if (editingMaterialIndex !== null) {
        updatedMaterials = updatedMaterials.map((item, idx) =>
          idx === editingMaterialIndex ? materialForm : item,
        );
        toast.success("Material berhasil diupdate");
      } else {
        updatedMaterials = [...updatedMaterials, materialForm];
        toast.success("Material berhasil ditambahkan");
      }

      const updatedItem = {
        ...selectedItem,
        materials: updatedMaterials,
      };

      setSelectedItem(updatedItem);
      // Sync with main context
      updateDataCollection(selectedItem.id, {
        materials: updatedMaterials,
      });
    } else if (showModal) {
      let updatedMaterials = formData.materials || [];

      if (editingMaterialIndex !== null) {
        updatedMaterials = updatedMaterials.map((item, idx) =>
          idx === editingMaterialIndex ? materialForm : item,
        );
      } else {
        updatedMaterials = [...updatedMaterials, materialForm];
      }

      setFormData({ ...formData, materials: updatedMaterials });
    }
    setShowMaterialModal(false);
  };

  const handleDeleteMaterial = (index: number) => {
    if (window.confirm("Hapus material ini?")) {
      if (selectedItem && selectedItem.materials) {
        const updatedMaterials = selectedItem.materials.filter(
          (_, i) => i !== index,
        );
        setSelectedItem({
          ...selectedItem,
          materials: updatedMaterials,
        });
        // Sync with main context
        updateDataCollection(selectedItem.id, {
          materials: updatedMaterials,
        });
        toast.success("Material berhasil dihapus");
      }
    }
  };

  // Manpower CRUD Functions
  const handleSaveManpower = (manpower: Manpower) => {
    if (showDetailModal && selectedItem) {
      let updatedManpower = selectedItem.manpower || [];

      if (editingManpowerIndex !== null) {
        updatedManpower = updatedManpower.map((item, idx) =>
          idx === editingManpowerIndex ? manpower : item,
        );
        toast.success("Manpower berhasil diupdate");
      } else {
        updatedManpower = [...updatedManpower, manpower];
        toast.success("Manpower berhasil ditambahkan");
      }

      setSelectedItem({
        ...selectedItem,
        manpower: updatedManpower,
      });

      // Sync with main context
      updateDataCollection(selectedItem.id, {
        manpower: updatedManpower,
      });
    } else if (showModal) {
      let updatedManpower = formData.manpower || [];

      if (editingManpowerIndex !== null) {
        updatedManpower = updatedManpower.map((item, idx) =>
          idx === editingManpowerIndex ? manpower : item,
        );
      } else {
        updatedManpower = [...updatedManpower, manpower];
      }

      setFormData({ ...formData, manpower: updatedManpower });
    }

    setShowManpowerModal(false);
    setEditingManpowerIndex(null);
  };

  const handleEditManpower = (index: number) => {
    setEditingManpowerIndex(index);
    setShowManpowerModal(true);
  };

  const handleDeleteManpower = (index: number) => {
    if (window.confirm("Hapus manpower ini?")) {
      if (selectedItem && selectedItem.manpower) {
        const updatedManpower = selectedItem.manpower.filter(
          (_, i) => i !== index,
        );
        setSelectedItem({
          ...selectedItem,
          manpower: updatedManpower,
        });
        // Sync with main context
        updateDataCollection(selectedItem.id, {
          manpower: updatedManpower,
        });
        toast.success("Manpower berhasil dihapus");
      }
    }
  };

  // Schedule CRUD Functions
  const handleSaveSchedule = (schedule: Schedule) => {
    if (showDetailModal && selectedItem) {
      let updatedSchedule = selectedItem.schedule || [];

      if (editingScheduleIndex !== null) {
        updatedSchedule = updatedSchedule.map((item, idx) =>
          idx === editingScheduleIndex ? schedule : item,
        );
        toast.success("Schedule berhasil diupdate");
      } else {
        updatedSchedule = [...updatedSchedule, schedule];
        toast.success("Schedule berhasil ditambahkan");
      }

      setSelectedItem({
        ...selectedItem,
        schedule: updatedSchedule,
      });

      // Sync with main context
      updateDataCollection(selectedItem.id, {
        schedule: updatedSchedule,
      });
    } else if (showModal) {
      let updatedSchedule = formData.schedule || [];

      if (editingScheduleIndex !== null) {
        updatedSchedule = updatedSchedule.map((item, idx) =>
          idx === editingScheduleIndex ? schedule : item,
        );
      } else {
        updatedSchedule = [...updatedSchedule, schedule];
      }

      setFormData({ ...formData, schedule: updatedSchedule });
    }

    setShowScheduleModal(false);
    setEditingScheduleIndex(null);
  };

  const handleEditSchedule = (index: number) => {
    setEditingScheduleIndex(index);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = (index: number) => {
    if (window.confirm("Hapus schedule ini?")) {
      if (selectedItem && selectedItem.schedule) {
        const updatedSchedule = selectedItem.schedule.filter(
          (_, i) => i !== index,
        );
        setSelectedItem({
          ...selectedItem,
          schedule: updatedSchedule,
        });
        // Sync with main context
        updateDataCollection(selectedItem.id, {
          schedule: updatedSchedule,
        });
        toast.success("Schedule berhasil dihapus");
      }
    }
  };

  // Consumable CRUD Functions
  const handleSaveConsumable = (consumable: Consumable) => {
    if (showDetailModal && selectedItem) {
      let updatedConsumables = selectedItem.consumables || [];

      if (editingConsumableIndex !== null) {
        updatedConsumables = updatedConsumables.map(
          (item, idx) =>
            idx === editingConsumableIndex ? consumable : item,
        );
        toast.success("Consumable berhasil diupdate");
      } else {
        updatedConsumables = [
          ...updatedConsumables,
          consumable,
        ];
        toast.success("Consumable berhasil ditambahkan");
      }

      setSelectedItem({
        ...selectedItem,
        consumables: updatedConsumables,
      });

      // Sync with main context
      updateDataCollection(selectedItem.id, {
        consumables: updatedConsumables,
      });
    } else if (showModal) {
      let updatedConsumables = formData.consumables || [];

      if (editingConsumableIndex !== null) {
        updatedConsumables = updatedConsumables.map(
          (item, idx) =>
            idx === editingConsumableIndex ? consumable : item,
        );
      } else {
        updatedConsumables = [
          ...updatedConsumables,
          consumable,
        ];
      }

      setFormData({
        ...formData,
        consumables: updatedConsumables,
      });
    }

    setShowConsumableModal(false);
    setEditingConsumableIndex(null);
  };

  const handleEditConsumable = (index: number) => {
    setEditingConsumableIndex(index);
    setShowConsumableModal(true);
  };

  const handleDeleteConsumable = (index: number) => {
    if (window.confirm("Hapus consumable ini?")) {
      if (selectedItem && selectedItem.consumables) {
        const updatedConsumables =
          selectedItem.consumables.filter(
            (_, i) => i !== index,
          );
        setSelectedItem({
          ...selectedItem,
          consumables: updatedConsumables,
        });
        // Sync with main context
        updateDataCollection(selectedItem.id, {
          consumables: updatedConsumables,
        });
        toast.success("Consumable berhasil dihapus");
      }
    }
  };

  // Equipment CRUD Functions
  const handleSaveEquipment = (equipment: Equipment) => {
    if (showDetailModal && selectedItem) {
      let updatedEquipment = selectedItem.equipment || [];

      if (editingEquipmentIndex !== null) {
        updatedEquipment = updatedEquipment.map((item, idx) =>
          idx === editingEquipmentIndex ? equipment : item,
        );
        toast.success("Equipment berhasil diupdate");
      } else {
        updatedEquipment = [...updatedEquipment, equipment];
        toast.success("Equipment berhasil ditambahkan");
      }

      setSelectedItem({
        ...selectedItem,
        equipment: updatedEquipment,
      });

      // Sync with main context
      updateDataCollection(selectedItem.id, {
        equipment: updatedEquipment,
      });
    } else if (showModal) {
      let updatedEquipment = formData.equipment || [];

      if (editingEquipmentIndex !== null) {
        updatedEquipment = updatedEquipment.map((item, idx) =>
          idx === editingEquipmentIndex ? equipment : item,
        );
      } else {
        updatedEquipment = [...updatedEquipment, equipment];
      }

      setFormData({ ...formData, equipment: updatedEquipment });
    }

    setShowEquipmentModal(false);
    setEditingEquipmentIndex(null);
  };

  const handleEditEquipment = (index: number) => {
    setEditingEquipmentIndex(index);
    setShowEquipmentModal(true);
  };

  const handleDeleteEquipment = (index: number) => {
    if (window.confirm("Hapus equipment ini?")) {
      if (selectedItem && selectedItem.equipment) {
        const updatedEquipment = selectedItem.equipment.filter(
          (_, i) => i !== index,
        );
        setSelectedItem({
          ...selectedItem,
          equipment: updatedEquipment,
        });
        // Sync with main context
        updateDataCollection(selectedItem.id, {
          equipment: updatedEquipment,
        });
        toast.success("Equipment berhasil dihapus");
      }
    }
  };

  // BOM Material CRUD Functions
  const handleSaveBOMMaterial = (bomMaterial: BOMMaterial) => {
    if (showModal) {
      let updatedBOMMaterials = (formData.materials || []) as BOMMaterial[];

      if (editingBOMMaterialIndex !== null) {
        updatedBOMMaterials = updatedBOMMaterials.map((item, idx) =>
          idx === editingBOMMaterialIndex ? bomMaterial : item,
        );
        toast.success("BOM Material berhasil diupdate");
      } else {
        updatedBOMMaterials = [...updatedBOMMaterials, bomMaterial];
        toast.success("BOM Material berhasil ditambahkan");
      }

      setFormData({ ...formData, materials: updatedBOMMaterials });
    }

    setShowBOMMaterialModal(false);
    setEditingBOMMaterialIndex(null);
  };

  const handleEditBOMMaterial = (index: number) => {
    setEditingBOMMaterialIndex(index);
    setShowBOMMaterialModal(true);
  };

  const handleDeleteBOMMaterial = (index: number) => {
    if (window.confirm("Hapus BOM Material ini?")) {
      const updatedBOMMaterials = (formData.materials || []).filter(
        (_, i) => i !== index,
      );
      setFormData({ ...formData, materials: updatedBOMMaterials });
      toast.success("BOM Material berhasil dihapus");
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const [year, month, day] = dateStr.split("-");
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft":
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Low":
        return "bg-gray-100 text-gray-600";
      case "Medium":
        return "bg-yellow-100 text-yellow-700";
      case "High":
        return "bg-orange-100 text-orange-700";
      case "Urgent":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getMaterialStatusColor = (status: string) => {
    switch (status) {
      case "Not Ordered":
        return "bg-gray-100 text-gray-700";
      case "Ordered":
        return "bg-yellow-100 text-yellow-700";
      case "Received":
        return "bg-blue-100 text-blue-700";
      case "Used":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMaterialStatusIcon = (status: string) => {
    switch (status) {
      case "Not Ordered":
        return <XCircle size={16} />;
      case "Ordered":
        return <ShoppingCart size={16} />;
      case "Received":
        return <Package size={16} />;
      case "Used":
        return <CheckCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Data Collection</h1>
          <p className="text-gray-600">
            Kelola data pengumpulan yang akan menjadi Project
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDataCollections}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus size={20} />
            Tambah Data Baru
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg border-2 border-gray-900">
          <div className="text-gray-600 mb-2">Total Data</div>
          <div className="text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Completed</div>
          <div className="text-blue-600">{stats.completed}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Verified</div>
          <div className="text-green-600">{stats.verified}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">Draft</div>
          <div className="text-gray-600">{stats.draft}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 mb-2">
            Total Materials
          </div>
          <div className="text-red-600">
            {stats.totalMaterials}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Cari data collection..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Data Collection Cards - SAMA DENGAN PROJECT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((item) => {
          const materialCount = item.materials?.length || 0;
          
          // Check if this data collection has quotations
          const hasQuotation = quotationList?.some((q: any) => q.dataCollectionId === item.id);
          const quotationCount = quotationList?.filter((q: any) => q.dataCollectionId === item.id).length || 0;

          return (
            <div
              key={item.id}
              className="bg-white rounded-lg border-2 border-red-600 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-gray-900 mb-1 font-bold">
                    {item.namaResponden}
                  </div>
                  <div className="text-gray-600 font-mono text-sm">
                    {item.noKoleksi}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(item.status)}`}
                  >
                    {item.status}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Kategori:</span>
                  <span className="text-gray-900 font-semibold">
                    {item.kategori}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={16} />
                  <span>
                    {formatDisplayDate(item.tanggalPengumpulan)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={16} />
                  <span>{item.lokasi}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users size={16} />
                  <span>{item.namaKolektor}</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-gray-600 mb-2">
                  <span className="flex items-center gap-2">
                    <Package size={16} />
                    Materials
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {materialCount} items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(item.priority)}`}
                  >
                    {item.priority}
                  </span>
                  {hasQuotation && (
                    <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-full text-xs font-bold flex items-center gap-1">
                      <Calculator size={14} />
                      {quotationCount} Quotation{quotationCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {item.tags?.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleViewDetail(item)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-900 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  <Eye size={18} />
                  Lihat Detail
                </button>
                <button
                  onClick={() => handleEditData(item)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                >
                  <Edit size={18} />
                  Edit Data
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleBackendExport(item, "preview")}
                    disabled={exportingKey === `${item.id}:preview`}
                    className="flex items-center justify-center gap-1 px-3 py-2 border-2 border-slate-700 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold text-sm disabled:opacity-60"
                    title="Preview export backend"
                  >
                    <Eye size={16} />
                    Preview
                  </button>
                  <button
                    onClick={() => handleBackendExport(item, "word")}
                    disabled={exportingKey === `${item.id}:word`}
                    className="flex items-center justify-center gap-1 px-3 py-2 border-2 border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors font-semibold text-sm disabled:opacity-60"
                    title="Download Word dari backend"
                  >
                    <FileText size={16} />
                    Word
                  </button>
                  <button
                    onClick={() => handleBackendExport(item, "excel")}
                    disabled={exportingKey === `${item.id}:excel`}
                    className="flex items-center justify-center gap-1 px-3 py-2 border-2 border-indigo-600 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors font-semibold text-sm disabled:opacity-60"
                    title="Download Excel dari backend"
                  >
                    <Download size={16} />
                    Excel
                  </button>
                </div>
                {hasQuotation ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        navigate("/sales/quotation", {
                          state: {
                            fromDataCollection: true,
                            dataCollectionId: item.id,
                          },
                        });
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                    >
                      <Plus size={18} />
                      New
                    </button>
                    <button
                      onClick={() => {
                        navigate("/sales/quotation");
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors font-semibold"
                    >
                      <Calculator size={18} />
                      View All
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      navigate("/sales/quotation", {
                        state: {
                          fromDataCollection: true,
                          dataCollectionId: item.id,
                        },
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors font-semibold"
                  >
                    <Calculator size={18} />
                    Create Quotation
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 via-gray-900 to-black text-white p-6 border-b-4 border-red-600 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingId
                    ? "Update Data Collection"
                    : "Tambah Data Collection Baru"}
                </h2>
                <button
                  onClick={() => resetForm()}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Form - Always Show! */}
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-6"
            >
              {/* ESSENTIAL INFO - Always Visible */}
              <div className="bg-gradient-to-br from-red-50 to-white border-2 border-red-600 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      Informasi Project
                    </h3>
                    <p className="text-xs text-gray-600">Isi 3 field wajib, lalu scroll kebawah pilih mau tambah apa (Material / Manpower / Equipment / dll)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      📋 Nama Customer / Project *
                    </label>
                    <input
                      type="text"
                      value={formData.namaResponden || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          namaResponden: e.target.value,
                        })
                      }
                      required
                      placeholder="PT. Nama Customer..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 text-base font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      📍 Lokasi Project *
                    </label>
                    <input
                      type="text"
                      value={formData.lokasi || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lokasi: e.target.value,
                        })
                      }
                      required
                      placeholder="Jakarta, Surabaya, dll..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 text-base font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      📅 Tanggal
                    </label>
                    <input
                      type="date"
                      value={formData.tanggalPengumpulan || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tanggalPengumpulan: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 text-base font-semibold"
                    />
                  </div>
                </div>

                {/* Auto-generated No. Koleksi info */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>No. Koleksi:</strong> Akan di-generate otomatis (KOL-{new Date().getFullYear()}-{String(effectiveDataCollectionList.length + 1).padStart(4, "0")})
                  </p>
                </div>
              </div>

              {/* ADVANCED OPTIONS - Collapsible */}
              <div className="border-2 border-gray-300 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-gray-600" />
                    <span className="font-bold text-gray-900">
                      Advanced Options (Opsional)
                    </span>
                    <span className="text-xs text-gray-500 italic">
                      - Klik untuk expand
                    </span>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp size={20} className="text-gray-600" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-600" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-5 bg-white border-t-2 border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Kategori
                        </label>
                        <div className="space-y-2">
                          <select
                            value={
                              ["Survey", "Email", "User"].includes(
                                formData.kategori,
                              )
                                ? formData.kategori
                                : "Lainnya"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== "Lainnya") {
                                setFormData({
                                  ...formData,
                                  kategori: val,
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  kategori: "",
                                });
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          >
                            <option value="Survey">Survey</option>
                            <option value="Email">Email</option>
                            <option value="User">User</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          {!["Survey", "Email", "User"].includes(
                            formData.kategori,
                          ) && (
                            <input
                              type="text"
                              value={formData.kategori || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  kategori: e.target.value,
                                })
                              }
                              placeholder="Sebutkan kategori lainnya..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Nama Kolektor (PM)
                        </label>
                        <input
                          type="text"
                          value={formData.namaKolektor || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              namaKolektor: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Tipe Pekerjaan
                        </label>
                        <div className="space-y-2">
                          <select
                            value={
                              [
                                "Pasang baru",
                                "Repair",
                                "Modifikasi",
                              ].includes(formData.tipePekerjaan)
                                ? formData.tipePekerjaan
                                : "Lainnya"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== "Lainnya") {
                                setFormData({
                                  ...formData,
                                  tipePekerjaan: val,
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  tipePekerjaan: "",
                                });
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          >
                            <option value="Pasang baru">
                              Pasang baru
                            </option>
                            <option value="Repair">Repair</option>
                            <option value="Modifikasi">
                              Modifikasi
                            </option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          {![
                            "Pasang baru",
                            "Repair",
                            "Modifikasi",
                          ].includes(formData.tipePekerjaan) && (
                            <input
                              type="text"
                              value={formData.tipePekerjaan || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  tipePekerjaan: e.target.value,
                                })
                              }
                              placeholder="Sebutkan lainnya..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Jenis Kontrak
                        </label>
                        <div className="space-y-2">
                          <select
                            value={
                              [
                                "Subcontractor",
                                "Main contractor",
                              ].includes(formData.jenisKontrak)
                                ? formData.jenisKontrak
                                : "Lainnya"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== "Lainnya") {
                                setFormData({
                                  ...formData,
                                  jenisKontrak: val,
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  jenisKontrak: "",
                                });
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          >
                            <option value="Subcontractor">
                              Subcontractor
                            </option>
                            <option value="Main contractor">
                              Main contractor
                            </option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          {![
                            "Subcontractor",
                            "Main contractor",
                          ].includes(formData.jenisKontrak) && (
                            <input
                              type="text"
                              value={formData.jenisKontrak || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  jenisKontrak: e.target.value,
                                })
                              }
                              placeholder="Sebutkan lainnya..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              status: e.target.value as "Draft" | "Verified" | "Completed",
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-bold"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Verified">Verified</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Prioritas
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              priority: e.target.value as "Low" | "Medium" | "High" | "Urgent",
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Catatan / Deskripsi Project
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              notes: e.target.value,
                            })
                          }
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                          placeholder="Catatan ini akan menjadi deskripsi project..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* MATERIAL BOQ SECTION - Always Visible! */}
              <div className="bg-gradient-to-br from-red-50 via-white to-gray-50 border-4 border-red-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-2xl flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                        <Package size={24} className="text-white" />
                      </div>
                      📋 Bill of Material (BOM)
                    </h3>
                    <p className="text-sm text-gray-600 ml-14">Material untuk project - isi jika project butuh material</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBOMMaterialIndex(null);
                      setShowBOMMaterialModal(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-xl hover:from-red-700 hover:to-black transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
                  >
                    <Plus size={24} />
                    Tambah Material
                  </button>
                </div>

                <BOMSummaryTable bomMaterials={formData.materials as BOMMaterial[]} />
              </div>

              {/* MANPOWER SECTION - Always Visible! */}
              <div className="bg-gradient-to-br from-blue-50 via-white to-gray-50 border-4 border-blue-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-2xl flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Users size={24} className="text-white" />
                      </div>
                      👷 Manpower
                    </h3>
                    <p className="text-sm text-gray-600 ml-14">Tenaga kerja untuk project - isi jika project butuh manpower</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingManpowerIndex(null);
                      setShowManpowerModal(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
                  >
                    <Plus size={24} />
                    Tambah Manpower
                  </button>
                </div>

                {formData.manpower.length > 0 ? (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                        <thead className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                          <tr>
                            <th className="px-3 py-2 text-left text-sm">
                              #
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Position
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Duration (days)
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Notes
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {formData.manpower.map((man, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-gray-700 font-semibold">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-gray-900 font-semibold">
                                  {man.position}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-blue-600 font-bold">
                                {man.quantity}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700 font-semibold">
                                {man.duration}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-sm">
                                {man.notes || "-"}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingManpowerIndex(
                                        idx,
                                      );
                                      setShowManpowerModal(
                                        true,
                                      );
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Hapus manpower ini?",
                                        )
                                      ) {
                                        setFormData({
                                          ...formData,
                                          manpower:
                                            formData.manpower.filter(
                                              (_, i) =>
                                                i !== idx,
                                            ),
                                        });
                                      }
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600 to-gray-900 text-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">
                          Total Manpower
                        </span>
                        <span className="font-bold text-2xl">
                          {formData.manpower.length} position(s)
                        </span>
                      </div>
                      <div className="text-sm text-blue-100 mt-1">
                        💡 Harga akan diinput di Quotation
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users
                      size={48}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    <p className="text-gray-600 font-semibold">
                      Belum ada manpower
                    </p>
                    <p className="text-sm text-gray-500">
                      Klik "Add Manpower" untuk menambahkan
                    </p>
                  </div>
                )}
              </div>

              {/* SCHEDULE SECTION - Always Visible! */}
              <div className="bg-gradient-to-br from-purple-50 via-white to-gray-50 border-4 border-purple-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-2xl flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Calendar size={24} className="text-white" />
                      </div>
                      📅 Schedule
                    </h3>
                    <p className="text-sm text-gray-600 ml-14">Jadwal pekerjaan - isi jika perlu atur timeline</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingScheduleIndex(null);
                      setShowScheduleModal(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
                  >
                    <Plus size={24} />
                    Tambah Schedule
                  </button>
                </div>

                {formData.schedule.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                      <thead className="bg-gradient-to-r from-purple-600 to-gray-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-sm">
                            Activity
                          </th>
                          <th className="px-3 py-2 text-left text-sm">
                            Start Date
                          </th>
                          <th className="px-3 py-2 text-left text-sm">
                            End Date
                          </th>
                          <th className="px-3 py-2 text-right text-sm">
                            Duration
                          </th>
                          <th className="px-3 py-2 text-center text-sm">
                            Status
                          </th>
                          <th className="px-3 py-2 text-center text-sm">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {formData.schedule.map((sch, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 text-gray-700 font-semibold">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-gray-900 font-semibold">
                                {sch.activity}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {sch.startDate}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {sch.endDate}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900">
                              {sch.duration} days
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  sch.status === "Completed"
                                    ? "bg-green-100 text-green-700"
                                    : sch.status ===
                                        "In Progress"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {sch.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingScheduleIndex(
                                      idx,
                                    );
                                    setShowScheduleModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Hapus schedule ini?",
                                      )
                                    ) {
                                      setFormData({
                                        ...formData,
                                        schedule:
                                          formData.schedule.filter(
                                            (_, i) => i !== idx,
                                          ),
                                      });
                                    }
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Calendar
                      size={48}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    <p className="text-gray-600 font-semibold">
                      Belum ada schedule
                    </p>
                    <p className="text-sm text-gray-500">
                      Klik "Add Schedule" untuk menambahkan
                    </p>
                  </div>
                )}
              </div>

              {/* CONSUMABLES SECTION - Always Visible! */}
              <div className="bg-gradient-to-br from-green-50 via-white to-gray-50 border-4 border-green-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-2xl flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                        <Package size={24} className="text-white" />
                      </div>
                      🔧 Consumables
                    </h3>
                    <p className="text-sm text-gray-600 ml-14">Material habis pakai - isi jika project butuh consumables</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingConsumableIndex(null);
                      setShowConsumableModal(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
                  >
                    <Plus size={24} />
                    Tambah Consumable
                  </button>
                </div>

                {formData.consumables.length > 0 ? (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                        <thead className="bg-gradient-to-r from-green-600 to-gray-900 text-white">
                          <tr>
                            <th className="px-3 py-2 text-left text-sm">
                              #
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Item Name
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Category
                            </th>
                            <th className="px-3 py-2 text-right text-sm">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Unit
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {formData.consumables.map(
                            (con, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-3 py-2 text-gray-700 font-semibold">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="text-gray-900 font-semibold">
                                    {con.itemName}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {con.category}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-900">
                                  {con.quantity}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {con.unit}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingConsumableIndex(
                                          idx,
                                        );
                                        setShowConsumableModal(
                                          true,
                                        );
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            "Hapus consumable ini?",
                                          )
                                        ) {
                                          setFormData({
                                            ...formData,
                                            consumables:
                                              formData.consumables.filter(
                                                (_, i) =>
                                                  i !== idx,
                                              ),
                                          });
                                        }
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-gradient-to-r from-green-600 to-gray-900 text-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">
                          Total Consumables
                        </span>
                        <span className="font-bold text-2xl">
                          {formData.consumables.length} item(s)
                        </span>
                      </div>
                      <div className="text-sm text-green-100 mt-1">
                        {formData.consumables.length} item(s)
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Package
                      size={48}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    <p className="text-gray-600 font-semibold">
                      Belum ada consumables
                    </p>
                    <p className="text-sm text-gray-500">
                      Klik "Add Consumable" untuk menambahkan
                    </p>
                  </div>
                )}
              </div>

              {/* EQUIPMENT SECTION - Always Visible! */}
              <div className="bg-gradient-to-br from-orange-50 via-white to-gray-50 border-4 border-orange-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-2xl flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                        <ShoppingCart size={24} className="text-white" />
                      </div>
                      🚜 Equipment
                    </h3>
                    <p className="text-sm text-gray-600 ml-14">Peralatan kerja - isi jika project butuh tools/equipment</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEquipmentIndex(null);
                      setShowEquipmentModal(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transform"
                  >
                    <Plus size={24} />
                    Tambah Equipment
                  </button>
                </div>

                {formData.equipment.length > 0 ? (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                        <thead className="bg-gradient-to-r from-orange-600 to-gray-900 text-white">
                          <tr>
                            <th className="px-3 py-2 text-left text-sm">
                              #
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Equipment Name
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Unit
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Duration (Period)
                            </th>
                            <th className="px-3 py-2 text-left text-sm">
                              Supplier
                            </th>
                            <th className="px-3 py-2 text-center text-sm">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {formData.equipment.map((eq, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-gray-700 font-semibold">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-gray-900 font-semibold">
                                  {eq.equipmentName}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-orange-600 font-bold">
                                {eq.quantity}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700 font-semibold">
                                {eq.unit}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700 font-semibold">
                                {eq.duration}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-sm">
                                {eq.supplier || "-"}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEquipmentIndex(
                                        idx,
                                      );
                                      setShowEquipmentModal(
                                        true,
                                      );
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Hapus equipment ini?",
                                        )
                                      ) {
                                        setFormData({
                                          ...formData,
                                          equipment:
                                            formData.equipment.filter(
                                              (_, i) =>
                                                i !== idx,
                                            ),
                                        });
                                      }
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-gradient-to-r from-orange-600 to-gray-900 text-white p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">
                          Total Equipment
                        </span>
                        <span className="font-bold text-2xl">
                          {formData.equipment.length} item(s)
                        </span>
                      </div>
                      <div className="text-sm text-orange-100 mt-1">
                        {formData.equipment.length} equipment(s)
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <ShoppingCart
                      size={48}
                      className="mx-auto mb-2 text-gray-400"
                    />
                    <p className="text-gray-600 font-semibold">
                      Belum ada equipment
                    </p>
                    <p className="text-sm text-gray-500">
                      Klik "Add Equipment" untuk menambahkan
                    </p>
                  </div>
                )}
              </div>

              {/* DATA FIELDS SECTION - Show for both types */}
              <div className="bg-gradient-to-br from-indigo-50 via-white to-gray-50 border-2 border-indigo-600 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                      <FileText
                        size={20}
                        className="text-indigo-600"
                      />
                      Custom Data Fields
                    </h3>
                    <p className="text-xs text-indigo-600 font-medium">
                      Tambahkan informasi spesifik project yang
                      tidak ada di form standar
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        dataFields: [
                          ...formData.dataFields,
                          {
                            fieldName: "",
                            fieldValue: "",
                            fieldType: "Text",
                          },
                        ],
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-sm"
                  >
                    <Plus size={18} />
                    Add New Field
                  </button>
                </div>

                {formData.dataFields.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <div className="col-span-4">
                        Nama Field
                      </div>
                      <div className="col-span-4">
                        Nilai / Value
                      </div>
                      <div className="col-span-3">
                        Tipe Data
                      </div>
                      <div className="col-span-1 text-center">
                        Aksi
                      </div>
                    </div>
                    {formData.dataFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="group grid grid-cols-12 gap-3 items-center bg-white p-2 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all"
                      >
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={field.fieldName}
                            onChange={(e) => {
                              const updated = [
                                ...formData.dataFields,
                              ];
                              updated[idx].fieldName =
                                e.target.value;
                              setFormData({
                                ...formData,
                                dataFields: updated,
                              });
                            }}
                            placeholder="Contoh: Dimensi Furnace"
                            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all font-semibold"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={field.fieldValue}
                            onChange={(e) => {
                              const updated = [
                                ...formData.dataFields,
                              ];
                              updated[idx].fieldValue =
                                e.target.value;
                              setFormData({
                                ...formData,
                                dataFields: updated,
                              });
                            }}
                            placeholder="Masukkan nilai..."
                            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={field.fieldType}
                            onChange={(e) => {
                              const updated = [
                                ...formData.dataFields,
                              ];
                              updated[idx].fieldType = e.target
                                .value as any;
                              setFormData({
                                ...formData,
                                dataFields: updated,
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all font-medium"
                          >
                            <option value="Text">
                              📝 Text
                            </option>
                            <option value="Number">
                              🔢 Number
                            </option>
                            <option value="Date">
                              📅 Date
                            </option>
                            <option value="Boolean">
                              🔘 Yes/No
                            </option>
                            <option value="Rating">
                              ⭐ Rating
                            </option>
                          </select>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                dataFields:
                                  formData.dataFields.filter(
                                    (_, i) => i !== idx,
                                  ),
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Field"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText
                        size={32}
                        className="text-indigo-400"
                      />
                    </div>
                    <p className="text-gray-900 font-bold">
                      Belum ada custom data fields
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Field ini berguna untuk mencatat detail
                      teknis khusus.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          dataFields: [
                            {
                              fieldName: "",
                              fieldValue: "",
                              fieldType: "Text",
                            },
                          ],
                        });
                      }}
                      className="px-4 py-2 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all font-bold text-sm"
                    >
                      + Tambah Field Pertama
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="text-yellow-600 flex-shrink-0 mt-1"
                    size={20}
                  />
                  <div>
                    <div className="font-bold text-yellow-900 mb-1">
                      💡 Info: Integrasi dengan Quotation
                    </div>
                    <div className="text-sm text-yellow-800">
                      • Data Collection hanya untuk input{" "}
                      <strong>Qty, Unit, Spesifikasi</strong>{" "}
                      (TANPA HARGA)
                      <br />• Harga dan costing akan diinput di{" "}
                      <strong>Quotation</strong>
                      <br />• Anda bisa langsung create
                      quotation setelah menyimpan data ini
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkbox untuk Create Quotation */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-400 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createQuotationAfterSave}
                    onChange={(e) =>
                      setCreateQuotationAfterSave(
                        e.target.checked,
                      )
                    }
                    className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div>
                    <div className="font-bold text-purple-900">
                      🚀 Create Quotation setelah save
                    </div>
                    <div className="text-sm text-purple-800 mt-1">
                      Setelah menyimpan Data Collection ini,
                      langsung buka form Create Quotation dengan
                      data ini sudah terpilih. Anda bisa
                      langsung input harga dan membuat
                      penawaran.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-all font-bold border-2 border-gray-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-600 to-gray-900 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-black transition-all font-bold"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal dengan TABS - SAMA DENGAN PROJECT */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b-4 border-red-600 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                    {selectedItem.namaResponden}
                  </h2>
                  <div className="inline-block px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono font-bold border border-gray-300">
                    {selectedItem.noKoleksi}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      Status Data
                    </span>
                    <span
                      className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter shadow-sm border ${getStatusColor(selectedItem.status)}`}
                    >
                      {selectedItem.status}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      navigate("/sales/penawaran", {
                        state: {
                          openQuotationModal: true,
                          selectedDataCollectionId:
                            selectedItem.id,
                        },
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-bold shadow-sm ml-4"
                  >
                    <Send size={18} />
                    Buat Quotation
                  </button>

                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="w-10 h-10 flex items-center justify-center bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-gray-200 shadow-sm ml-2"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "overview"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("materials")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "materials"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📦 Material BOQ
                </button>
                <button
                  onClick={() => setActiveTab("manpower")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "manpower"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  👷 Manpower
                </button>
                <button
                  onClick={() => setActiveTab("schedule")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "schedule"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📅 Schedule
                </button>
                <button
                  onClick={() => setActiveTab("consumables")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "consumables"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🔧 Consumables
                </button>
                <button
                  onClick={() => setActiveTab("equipment")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "equipment"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🚜 Equipment
                </button>
                <button
                  onClick={() => setActiveTab("datafields")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "datafields"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Data Fields
                </button>
                <button
                  onClick={() => setActiveTab("verification")}
                  className={`py-3 px-1 border-b-2 transition-colors ${
                    activeTab === "verification"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Verification
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-gray-900 mb-3">
                      Informasi Data Collection
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Kategori
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {selectedItem.kategori}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Tanggal Pengumpulan
                      </span>
                      <span className="text-gray-900 font-bold">
                        {formatDisplayDate(
                          selectedItem.tanggalPengumpulan,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Lokasi
                      </span>
                      <span className="text-gray-900">
                        {selectedItem.lokasi}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Kolektor
                      </span>
                      <span className="text-gray-900">
                        {selectedItem.namaKolektor}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Tipe Pekerjaan
                      </span>
                      <span className="text-gray-900">
                        {selectedItem.tipePekerjaan}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Jenis Kontrak
                      </span>
                      <span className="text-gray-900">
                        {selectedItem.jenisKontrak}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Priority
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(selectedItem.priority)}`}
                      >
                        {selectedItem.priority}
                      </span>
                    </div>
                    {selectedItem.signature && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <span className="text-gray-600 block mb-2 font-bold text-xs uppercase tracking-wider text-red-600">
                          Verified Signature:
                        </span>
                        <div className="bg-white border border-gray-300 p-2 rounded-lg inline-block shadow-sm">
                          <img
                            src={selectedItem.signature}
                            alt="Signature"
                            className="h-24 object-contain"
                          />
                        </div>
                      </div>
                    )}

                    <h3 className="text-gray-900 mb-3 pt-4 border-t border-gray-200">
                      Deskripsi & Tags
                    </h3>
                    {selectedItem.notes && (
                      <div>
                        <span className="text-gray-600 block mb-2">
                          Catatan
                        </span>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          {selectedItem.notes}
                        </div>
                      </div>
                    )}
                    {selectedItem.tags &&
                      selectedItem.tags.length > 0 && (
                        <div>
                          <span className="text-gray-600 block mb-2">
                            Tags
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {selectedItem.tags.map(
                              (tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                                >
                                  #{tag}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {/* EXECUTIVE COMMAND CENTER PREVIEW */}
                    <div className="mt-8 pt-6 border-t-2 border-gray-900 bg-gray-50 -mx-6 px-6 pb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest italic flex items-center gap-2">
                          <TrendingUp
                            size={16}
                            className="text-red-600"
                          />
                          Executive Survey Analysis
                        </h3>
                        <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-tighter rounded italic">
                          Predictive Model
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            Complexity
                          </div>
                          <div className="text-xl font-black text-gray-900">
                            {selectedItem.materials?.length > 10
                              ? "HIGH"
                              : "MEDIUM"}
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-red-600 h-full"
                              style={{
                                width:
                                  selectedItem.materials
                                    ?.length > 10
                                    ? "85%"
                                    : "45%",
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            Manpower Intensity
                          </div>
                          <div className="text-xl font-black text-gray-900">
                            {selectedItem.manpower?.length > 5
                              ? "INTENSE"
                              : "NORMAL"}
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full"
                              style={{
                                width:
                                  selectedItem.manpower
                                    ?.length > 5
                                    ? "90%"
                                    : "50%",
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            Project Readiness
                          </div>
                          <div className="text-xl font-black text-gray-900">
                            {selectedItem.status === "Verified"
                              ? "100%"
                              : "65%"}
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full"
                              style={{
                                width:
                                  selectedItem.status ===
                                  "Verified"
                                    ? "100%"
                                    : "65%",
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "materials" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900">
                      Material BOQ List
                    </h3>
                    <button
                      onClick={handleAddMaterial}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Plus size={18} className="inline mr-2" />
                      Add Material
                    </button>
                  </div>

                  {selectedItem.materials &&
                  selectedItem.materials.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-red-600 to-gray-900 text-white">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                Material Name
                              </th>
                              <th className="px-4 py-3 text-left">
                                Supplier
                              </th>
                              <th className="px-4 py-3 text-right">
                                Qty Estimate
                              </th>
                              <th className="px-4 py-3 text-right">
                                Qty Actual
                              </th>
                              <th className="px-4 py-3 text-right">
                                Variance
                              </th>
                              <th className="px-4 py-3 text-center">
                                Status
                              </th>
                              <th className="px-4 py-3 text-center">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedItem.materials.map(
                              (item, idx) => {
                                const variance =
                                  item.qtyActual -
                                  item.qtyEstimate;
                                return (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="text-gray-900 font-semibold">
                                        {item.materialName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {item.unit}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {item.supplier}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                      {item.qtyEstimate.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                      {item.qtyActual.toLocaleString()}
                                    </td>
                                    <td
                                      className={`px-4 py-3 text-right font-semibold ${
                                        variance > 0
                                          ? "text-red-600"
                                          : variance < 0
                                            ? "text-green-600"
                                            : "text-gray-600"
                                      }`}
                                    >
                                      {variance > 0 && "+"}
                                      {variance.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getMaterialStatusColor(item.status)}`}
                                        >
                                          {getMaterialStatusIcon(
                                            item.status,
                                          )}
                                          {item.status}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() =>
                                            handleEditMaterial(
                                              idx,
                                            )
                                          }
                                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Edit Material"
                                        >
                                          <Edit size={16} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteMaterial(
                                              idx,
                                            )
                                          }
                                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Hapus Material"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Material Summary */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                          <div className="text-blue-700 text-sm font-bold mb-1">
                            Total Materials
                          </div>
                          <div className="text-blue-900 font-bold text-lg">
                            {selectedItem.materials.length}{" "}
                            items
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                          <div className="text-gray-700 text-sm font-bold mb-1">
                            Total Qty (Estimate)
                          </div>
                          <div className="text-gray-900 font-bold text-lg">
                            {(selectedItem.materials || [])
                              .reduce(
                                (sum, item) =>
                                  sum + (item.qtyEstimate || 0),
                                0,
                              )
                              .toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Package
                        size={48}
                        className="mx-auto mb-3 opacity-50"
                      />
                      <p>Belum ada data material BOQ</p>
                    </div>
                  )}
                </div>
              )}

              {/* Manpower Tab */}
              {activeTab === "manpower" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-gray-900 text-xl font-bold flex items-center gap-2">
                      <Users
                        size={24}
                        className="text-blue-600"
                      />
                      👷 Manpower List
                    </h3>
                    <button
                      onClick={() => {
                        setEditingManpowerIndex(null);
                        setShowManpowerModal(true);
                      }}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold transition-colors"
                    >
                      <Plus size={18} />
                      Add Manpower
                    </button>
                  </div>

                  {selectedItem?.manpower &&
                  selectedItem.manpower.length > 0 ? (
                    <>
                      <div className="overflow-x-auto rounded-lg border-2 border-gray-200">
                        <table className="w-full border-collapse">
                          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold">
                                Position
                              </th>
                              <th className="px-4 py-3 text-center font-bold">
                                Qty
                                <br />
                                (Orang)
                              </th>
                              <th className="px-4 py-3 text-center font-bold">
                                Duration
                                <br />
                                (Hari)
                              </th>
                              <th className="px-4 py-3 text-left font-bold">
                                Notes
                              </th>
                              <th className="px-4 py-3 text-center font-bold">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.manpower.map(
                              (item, index) => (
                                <tr
                                  key={item.id}
                                  className="border-b hover:bg-blue-50 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-900">
                                      {item.position}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-blue-600">
                                    {item.quantity}
                                  </td>
                                  <td className="px-4 py-3 text-center font-semibold">
                                    {item.duration}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {item.notes || "-"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() =>
                                          handleEditManpower(
                                            index,
                                          )
                                        }
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteManpower(
                                            index,
                                          )
                                        }
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Users
                        size={64}
                        className="mx-auto mb-4 text-gray-400"
                      />
                      <p className="font-semibold text-lg mb-2">
                        Belum ada data manpower
                      </p>
                      <p className="text-sm">
                        Klik "Add Manpower" untuk menambahkan
                        tenaga kerja
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Schedule Tab */}
              {activeTab === "schedule" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900 font-bold text-lg">
                      Schedule (
                      {selectedItem.schedule?.length || 0})
                    </h3>
                    <button
                      onClick={() => {
                        setEditingScheduleIndex(null);
                        setShowScheduleModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-gray-900 text-white rounded-lg hover:from-blue-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                    >
                      <Plus size={18} />
                      Add Schedule
                    </button>
                  </div>

                  {selectedItem.schedule &&
                  selectedItem.schedule.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                #
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Activity
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Start Date
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                End Date
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Duration
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Status
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Progress
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.schedule.map(
                              (item, index) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                    {index + 1}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="font-semibold text-gray-900">
                                      {item.activity}
                                    </div>
                                    {item.notes && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-gray-700">
                                    {item.startDate}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-gray-700">
                                    {item.endDate}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-center">
                                    <span className="font-semibold text-blue-600">
                                      {item.duration} days
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-center">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        item.status ===
                                        "Completed"
                                          ? "bg-green-100 text-green-700"
                                          : item.status ===
                                              "In Progress"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                          className="bg-blue-600 h-2 rounded-full transition-all"
                                          style={{
                                            width: `${item.progress}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-gray-700">
                                        {item.progress}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() =>
                                          handleEditSchedule(
                                            index,
                                          )
                                        }
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteSchedule(
                                            index,
                                          )
                                        }
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Calendar
                        size={64}
                        className="mx-auto mb-4 text-gray-400"
                      />
                      <p className="font-semibold text-lg mb-2">
                        Belum ada schedule
                      </p>
                      <p className="text-sm">
                        Klik "Add Schedule" untuk menambahkan
                        jadwal
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Consumables Tab */}
              {activeTab === "consumables" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900 font-bold text-lg">
                      Consumables (
                      {selectedItem.consumables?.length || 0})
                    </h3>
                    <button
                      onClick={() => {
                        setEditingConsumableIndex(null);
                        setShowConsumableModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-gray-900 text-white rounded-lg hover:from-blue-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                    >
                      <Plus size={18} />
                      Add Consumable
                    </button>
                  </div>

                  {selectedItem.consumables &&
                  selectedItem.consumables.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                #
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Item Name
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Category
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Quantity
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.consumables.map(
                              (item, index) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                    {index + 1}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="font-semibold text-gray-900">
                                      {item.itemName}
                                    </div>
                                    {item.notes && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        item.category ===
                                        "Tools"
                                          ? "bg-blue-100 text-blue-700"
                                          : item.category ===
                                              "Safety"
                                            ? "bg-green-100 text-green-700"
                                            : item.category ===
                                                ""
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {item.category}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-center">
                                    <span className="font-semibold text-gray-700">
                                      {item.quantity}{" "}
                                      {item.unit}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() =>
                                          handleEditConsumable(
                                            index,
                                          )
                                        }
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteConsumable(
                                            index,
                                          )
                                        }
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <ShoppingCart
                        size={64}
                        className="mx-auto mb-4 text-gray-400"
                      />
                      <p className="font-semibold text-lg mb-2">
                        Belum ada consumables
                      </p>
                      <p className="text-sm">
                        Klik "Add Consumable" untuk menambahkan
                        item
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Equipment Tab */}
              {activeTab === "equipment" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900 font-bold text-lg">
                      Equipment (
                      {selectedItem.equipment?.length || 0})
                    </h3>
                    <button
                      onClick={() => {
                        setEditingEquipmentIndex(null);
                        setShowEquipmentModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-gray-900 text-white rounded-lg hover:from-blue-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                    >
                      <Plus size={18} />
                      Add Equipment
                    </button>
                  </div>

                  {selectedItem.equipment &&
                  selectedItem.equipment.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                #
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Equipment Name
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Quantity
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Duration
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">
                                Supplier
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.equipment.map(
                              (item, index) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                    {index + 1}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="font-semibold text-gray-900">
                                      {item.equipmentName}
                                    </div>
                                    {item.notes && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-center">
                                    <span className="font-semibold text-gray-700">
                                      {item.quantity}{" "}
                                      {item.unit}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-center">
                                    <span className="font-semibold text-blue-600">
                                      {item.duration}{" "}
                                      {item.durationType}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-gray-700">
                                    {item.supplier}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() =>
                                          handleEditEquipment(
                                            index,
                                          )
                                        }
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteEquipment(
                                            index,
                                          )
                                        }
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Package
                        size={64}
                        className="mx-auto mb-4 text-gray-400"
                      />
                      <p className="font-semibold text-lg mb-2">
                        Belum ada equipment
                      </p>
                      <p className="text-sm">
                        Klik "Add Equipment" untuk menambahkan
                        peralatan
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "datafields" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-gray-900 font-bold text-xl">
                        Custom Data Fields
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Informasi spesifik tambahan untuk
                        koleksi data ini
                      </p>
                    </div>
                    <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold">
                      {selectedItem.dataFields?.length || 0}{" "}
                      Fields Recorded
                    </div>
                  </div>

                  {selectedItem.dataFields &&
                  selectedItem.dataFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedItem.dataFields.map(
                        (field, index) => (
                          <div
                            key={index}
                            className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm hover:border-indigo-200 transition-all group"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">
                                {field.fieldType === "Text" &&
                                  "📝 Text"}
                                {field.fieldType === "Number" &&
                                  "🔢 Number"}
                                {field.fieldType === "Date" &&
                                  "📅 Date"}
                                {field.fieldType ===
                                  "Boolean" && "🔘 Toggle"}
                                {field.fieldType === "Rating" &&
                                  "⭐ Rating"}
                              </span>
                            </div>
                            <div className="text-gray-500 text-xs font-bold uppercase mb-1">
                              {field.fieldName}
                            </div>
                            <div className="text-gray-900 font-bold text-lg break-words">
                              {field.fieldType === "Boolean" ? (
                                <span
                                  className={`inline-flex items-center gap-1 ${field.fieldValue === "true" || field.fieldValue === "Yes" ? "text-green-600" : "text-rose-600"}`}
                                >
                                  {field.fieldValue ===
                                    "true" ||
                                  field.fieldValue === "Yes" ? (
                                    <CheckCircle size={16} />
                                  ) : (
                                    <XCircle size={16} />
                                  )}
                                  {field.fieldValue ===
                                    "true" ||
                                  field.fieldValue === "Yes"
                                    ? "YES"
                                    : "NO"}
                                </span>
                              ) : field.fieldType ===
                                "Rating" ? (
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map(
                                    (star) => (
                                      <Star
                                        key={star}
                                        size={16}
                                        className={
                                          star <=
                                          parseInt(
                                            field.fieldValue,
                                          )
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-gray-200"
                                        }
                                      />
                                    ),
                                  )}
                                  <span className="ml-2 text-sm text-gray-400">
                                    ({field.fieldValue}/5)
                                  </span>
                                </div>
                              ) : (
                                field.fieldValue || "-"
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <FileText
                        size={64}
                        className="mx-auto mb-4 text-gray-300"
                      />
                      <p className="font-bold text-xl text-gray-400">
                        No custom data fields found
                      </p>
                      <p className="text-gray-400">
                        Informasi tambahan tidak direkam untuk
                        data ini.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "verification" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg border-2 border-gray-900 shadow-sm">
                    <h3 className="text-gray-900 font-bold text-lg mb-4 flex items-center gap-2">
                      <FileText
                        size={20}
                        className="text-red-600"
                      />
                      Digital Validation & Signature
                    </h3>
                    <p className="text-gray-600 text-sm mb-6">
                      Lakukan validasi laporan lapangan dengan
                      tanda tangan digital di bawah ini. Tanda
                      tangan ini akan tersimpan dalam data
                      koleksi dan muncul pada Berita Acara.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-2">
                          Input Tanda Tangan Digital
                        </label>
                        <SignatureCanvas
                          onSave={(data) => {
                            setSignatureData(data);
                            if (selectedItem) {
                              setSelectedItem({
                                ...selectedItem,
                                signature: data,
                              });
                              // Sync with main context
                              updateDataCollection(
                                selectedItem.id,
                                {
                                  signature: data,
                                },
                              );
                              toast.success(
                                "Tanda tangan berhasil diperbarui",
                              );
                            }
                          }}
                        />
                      </div>

                      <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                        <label className="block text-sm font-bold text-gray-900 mb-4 self-start">
                          Preview Tanda Tangan Tersimpan
                        </label>
                        {selectedItem?.signature ||
                        signatureData ? (
                          <div className="bg-white p-4 border border-gray-200 rounded shadow-inner w-full flex justify-center mb-4">
                            <img
                              src={
                                selectedItem?.signature ||
                                signatureData ||
                                ""
                              }
                              alt="Signature Preview"
                              className="max-h-32 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-10 mb-4 w-full">
                            <Clock
                              size={48}
                              className="mx-auto mb-2 opacity-50"
                            />
                            <p>
                              Belum ada tanda tangan tersimpan
                            </p>
                          </div>
                        )}

                        {!selectedItem.verifiedBy &&
                          (selectedItem.signature ||
                            signatureData) && (
                            <button
                              onClick={() => {
                                const now = new Date();
                                const dateStr =
                                  now.toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  );

                                const updatedData = {
                                  status: "Verified" as any,
                                  verifiedBy: "Admin GTP", // Simulasi user aktif
                                  verifiedDate: dateStr,
                                };

                                setSelectedItem({
                                  ...selectedItem,
                                  ...updatedData,
                                });

                                updateDataCollection(
                                  selectedItem.id,
                                  updatedData,
                                );
                                toast.success(
                                  "Data Collection berhasil diverifikasi",
                                );
                              }}
                              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-black shadow-lg uppercase tracking-tighter"
                            >
                              <CheckCircle size={20} />
                              Verifikasi Sekarang
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {selectedItem.verifiedBy && (
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                      <div className="flex items-center gap-2 text-green-700 font-bold mb-4">
                        <Star size={24} />
                        <span className="text-lg">
                          Verified Information
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-600 text-sm">
                            Verified By:
                          </span>
                          <div className="font-semibold text-gray-900 text-lg">
                            {selectedItem.verifiedBy}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 text-sm">
                            Verified Date:
                          </span>
                          <div className="font-semibold text-gray-900 text-lg">
                            {selectedItem.verifiedDate}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <CheckCircle size={18} />
                      Validation Protocol
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-2 list-disc pl-5">
                      <li>
                        Tanda tangan digital ini sah dan
                        mewakili persetujuan kolektor data.
                      </li>
                      <li>
                        Data ini akan secara otomatis
                        disinkronkan ke Premium Warehouse
                        Ledger.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleBackendExport(selectedItem, "word")}
                  disabled={exportingKey === `${selectedItem.id}:word`}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-colors font-semibold"
                >
                  <Download size={18} />
                  Export Word (Detail)
                </button>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 border-2 border-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            onClick={() => setShowMaterialModal(false)}
          />

          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 bg-gradient-to-r from-red-600 to-gray-900 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package size={24} />
                {editingMaterialIndex !== null
                  ? "Edit Material BOQ"
                  : "Tambah Material BOQ"}
              </h3>
              <button
                onClick={() => setShowMaterialModal(false)}
                className="text-white hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleSaveMaterial}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-900 font-bold mb-2">
                    Nama Material *
                  </label>
                  <input
                    type="text"
                    value={materialForm.materialName}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        materialName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: Semen Portland"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">
                    Supplier *
                  </label>
                  <input
                    type="text"
                    value={materialForm.supplier}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: PT Semen Indonesia"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">
                      Qty Estimasi *
                    </label>
                    <input
                      type="number"
                      value={materialForm.qtyEstimate}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          qtyEstimate:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">
                      Qty Aktual
                    </label>
                    <input
                      type="number"
                      value={materialForm.qtyActual}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          qtyActual:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">
                      Unit *
                    </label>
                    <input
                      type="text"
                      list="dc-unit-options"
                      value={materialForm.unit}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          unit: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-bold text-slate-700"
                      placeholder="kg, pcs, lot, dll"
                      required
                    />
                    <datalist id="dc-unit-options">
                      <option value="kg" />
                      <option value="pcs" />
                      <option value="set" />
                      <option value="m" />
                      <option value="m2" />
                      <option value="m3" />
                      <option value="lot" />
                      <option value="sak" />
                      <option value="liter" />
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-6 py-2 border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                >
                  <Save size={18} />
                  Simpan Material
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Material Modal untuk CREATE FORM */}
      {showCreateFormMaterialModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            onClick={() =>
              setShowCreateFormMaterialModal(false)
            }
          />

          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 bg-gradient-to-r from-red-600 to-gray-900 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package size={24} />
                {editingCreateFormMaterialIndex !== null
                  ? "Edit Material BOQ"
                  : "Tambah Material BOQ"}
              </h3>
              <button
                onClick={() =>
                  setShowCreateFormMaterialModal(false)
                }
                className="text-white hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();

                let updatedMaterials = [...formData.materials];

                if (editingCreateFormMaterialIndex !== null) {
                  // Edit existing
                  updatedMaterials = updatedMaterials.map(
                    (item, idx) =>
                      idx === editingCreateFormMaterialIndex
                        ? createFormMaterialForm
                        : item,
                  );
                } else {
                  // Add new
                  updatedMaterials = [
                    ...updatedMaterials,
                    createFormMaterialForm,
                  ];
                }

                setFormData({
                  ...formData,
                  materials: updatedMaterials,
                });
                setShowCreateFormMaterialModal(false);
              }}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-6 space-y-4">
                {/* Inventory Selection Search */}
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <label className="block text-red-900 font-bold mb-2 flex items-center gap-2 text-sm">
                    <Search size={16} />
                    Integrasi Supply Chain: Cari Material
                    Inventaris
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama atau kode material refractory..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                      onChange={(e) =>
                        setMaterialSearchTerm(e.target.value)
                      }
                      value={materialSearchTerm}
                    />
                    {materialSearchTerm && (
                      <button
                        type="button"
                        onClick={() =>
                          setMaterialSearchTerm("")
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {materialSearchTerm && (
                    <div className="mt-2 bg-white border border-gray-300 rounded-lg max-h-48 overflow-y-auto shadow-xl z-50">
                      {stockItemList
                        .filter(
                          (item) =>
                            item.nama
                              .toLowerCase()
                              .includes(
                                materialSearchTerm.toLowerCase(),
                              ) ||
                            item.kode
                              .toLowerCase()
                              .includes(
                                materialSearchTerm.toLowerCase(),
                              ),
                        )
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-red-50 border-b border-gray-100 last:border-0 transition-colors"
                            onClick={() => {
                              setCreateFormMaterialForm({
                                ...createFormMaterialForm,
                                materialName: item.nama,
                                unit: item.satuan,
                                supplier:
                                  item.supplier ||
                                  "PT Gema Teknik (Stok)",
                              });
                              setMaterialSearchTerm("");
                            }}
                          >
                            <div className="font-bold text-sm text-gray-900">
                              {item.nama}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] text-gray-500 font-mono">
                                ID: {item.kode} •{" "}
                                {item.kategori}
                              </span>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                Stok: {item.stok} {item.satuan}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">
                    Nama Material *
                  </label>
                  <input
                    type="text"
                    value={createFormMaterialForm.materialName}
                    onChange={(e) =>
                      setCreateFormMaterialForm({
                        ...createFormMaterialForm,
                        materialName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: Semen Portland"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">
                    Supplier *
                  </label>
                  <input
                    type="text"
                    value={createFormMaterialForm.supplier}
                    onChange={(e) =>
                      setCreateFormMaterialForm({
                        ...createFormMaterialForm,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: PT Semen Indonesia"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">
                      Qty Estimasi *
                    </label>
                    <input
                      type="number"
                      value={createFormMaterialForm.qtyEstimate}
                      onChange={(e) =>
                        setCreateFormMaterialForm({
                          ...createFormMaterialForm,
                          qtyEstimate:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-bold"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-900 font-bold mb-2">
                      Unit *
                    </label>
                    <input
                      type="text"
                      list="dc-create-unit-options"
                      value={createFormMaterialForm.unit}
                      onChange={(e) =>
                        setCreateFormMaterialForm({
                          ...createFormMaterialForm,
                          unit: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-bold text-slate-700"
                      placeholder="kg, pcs, lot, dll"
                      required
                    />
                    <datalist id="dc-create-unit-options">
                      <option value="kg" />
                      <option value="pcs" />
                      <option value="set" />
                      <option value="m" />
                      <option value="m2" />
                      <option value="m3" />
                      <option value="lot" />
                      <option value="sak" />
                      <option value="liter" />
                    </datalist>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4 flex items-center justify-between">
                  <span className="text-gray-700 font-bold italic text-sm">
                    Informasi harga dan margin akan ditentukan
                    pada tahap Quotation.
                  </span>
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">
                    Status *
                  </label>
                  <select
                    value={createFormMaterialForm.status}
                    onChange={(e) =>
                      setCreateFormMaterialForm({
                        ...createFormMaterialForm,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    required
                  >
                    <option value="Not Ordered">
                      Not Ordered
                    </option>
                    <option value="Ordered">Ordered</option>
                    <option value="Received">Received</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateFormMaterialModal(false)
                  }
                  className="px-6 py-2 border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                >
                  <Save size={18} />
                  {editingCreateFormMaterialIndex !== null
                    ? "Update Material"
                    : "Tambah Material"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Modals */}
      <ManpowerModal
        show={showManpowerModal}
        onClose={() => {
          setShowManpowerModal(false);
          setEditingManpowerIndex(null);
        }}
        onSave={handleSaveManpower}
        editingItem={
          editingManpowerIndex !== null
            ? showDetailModal
              ? selectedItem?.manpower?.[editingManpowerIndex]
              : formData.manpower?.[editingManpowerIndex]
            : null
        }
      />

      <ScheduleModal
        show={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditingScheduleIndex(null);
        }}
        onSave={handleSaveSchedule}
        editingItem={
          editingScheduleIndex !== null
            ? showDetailModal
              ? selectedItem?.schedule?.[editingScheduleIndex]
              : formData.schedule?.[editingScheduleIndex]
            : null
        }
      />

      <ConsumableModal
        show={showConsumableModal}
        onClose={() => {
          setShowConsumableModal(false);
          setEditingConsumableIndex(null);
        }}
        onSave={handleSaveConsumable}
        editingItem={
          editingConsumableIndex !== null
            ? showDetailModal
              ? selectedItem?.consumables?.[
                  editingConsumableIndex
                ]
              : formData.consumables?.[editingConsumableIndex]
            : null
        }
      />

      <EquipmentModal
        show={showEquipmentModal}
        onClose={() => {
          setShowEquipmentModal(false);
          setEditingEquipmentIndex(null);
        }}
        onSave={handleSaveEquipment}
        editingItem={
          editingEquipmentIndex !== null
            ? showDetailModal
              ? selectedItem?.equipment?.[editingEquipmentIndex]
              : formData.equipment?.[editingEquipmentIndex]
            : null
        }
      />

      {/* BOM Material Modal */}
      <BOMMaterialModal
        isOpen={showBOMMaterialModal}
        onClose={() => {
          setShowBOMMaterialModal(false);
          setEditingBOMMaterialIndex(null);
        }}
        onSave={handleSaveBOMMaterial}
        editingMaterial={
          editingBOMMaterialIndex !== null
            ? (formData.materials as BOMMaterial[])?.[editingBOMMaterialIndex]
            : null
        }
        editingIndex={editingBOMMaterialIndex}
      />
    </div>
  );
}
