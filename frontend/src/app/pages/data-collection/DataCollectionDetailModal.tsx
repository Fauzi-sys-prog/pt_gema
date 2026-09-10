import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Users,
  Calendar,
  ShoppingCart,
  Save,
  X,
  XCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
} from "lucide-react";
import { exportDataCollectionToWord } from "../../utils/exportToWord";
import { ManpowerModal } from "../../components/data-collection/ManpowerModal";
import type { Manpower } from "../../components/data-collection/ManpowerModal";
import { ScheduleModal } from "../../components/data-collection/ScheduleModal";
import type { Schedule } from "../../components/data-collection/ScheduleModal";
import { ConsumableModal } from "../../components/data-collection/ConsumableModal";
import type { Consumable } from "../../components/data-collection/ConsumableModal";
import { EquipmentModal } from "../../components/data-collection/EquipmentModal";
import type { Equipment } from "../../components/data-collection/EquipmentModal";
import { useEscapeKey } from '../../hooks/useEscapeKey';

// Helper functions
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

// Material Interface (for the detail material edit modal)
interface Material {
  id: string;
  materialName: string;
  qtyEstimate: number;
  qtyActual: number;
  unit: string;
  supplier: string;
  status?: string;
}

interface DataCollectionDetailModalProps {
  show: boolean;
  selectedItem: any;
  setSelectedItem: (item: any) => void;
  onClose: () => void;
  updateDataCollection: (id: string, data: any) => void;
}

export function DataCollectionDetailModal({
  show,
  selectedItem,
  setSelectedItem,
  onClose,
  updateDataCollection,
}: DataCollectionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "materials" | "manpower" | "schedule" | "consumables" | "equipment"
  >("overview");

  // Material Modal state
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);
  const [materialForm, setMaterialForm] = useState<Material>({
    id: "",
    materialName: "",
    qtyEstimate: 0,
    qtyActual: 0,
    unit: "",
    supplier: "",
  });

  // Manpower state
  const [showManpowerModal, setShowManpowerModal] = useState(false);
  const [editingManpowerIndex, setEditingManpowerIndex] = useState<number | null>(null);

  // Schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);

  // Consumable state
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [editingConsumableIndex, setEditingConsumableIndex] = useState<number | null>(null);

  // Equipment state
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);

  useEscapeKey([
    { condition: showMaterialModal, close: () => setShowMaterialModal(false) },
    { condition: showManpowerModal, close: () => setShowManpowerModal(false) },
    { condition: showScheduleModal, close: () => setShowScheduleModal(false) },
    { condition: showConsumableModal, close: () => setShowConsumableModal(false) },
    { condition: showEquipmentModal, close: () => setShowEquipmentModal(false) },
  ]);


  // Material CRUD
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
        updatedMaterials = updatedMaterials.map((item: any, idx: number) =>
          idx === editingMaterialIndex ? materialForm : item,
        );
        alert("Material berhasil diupdate!");
      } else {
        updatedMaterials = [...updatedMaterials, materialForm];
        alert("Material berhasil ditambahkan!");
      }
      const updatedItem = { ...selectedItem, materials: updatedMaterials };
      setSelectedItem(updatedItem);
      updateDataCollection(selectedItem.id, { materials: updatedMaterials });
    }
    setShowMaterialModal(false);
  };

  const handleDeleteMaterial = (index: number) => {
    if (confirm("Hapus material ini?")) {
      if (selectedItem && selectedItem.materials) {
        const updatedMaterials = selectedItem.materials.filter((_: any, i: number) => i !== index);
        setSelectedItem({ ...selectedItem, materials: updatedMaterials });
        updateDataCollection(selectedItem.id, { materials: updatedMaterials });
        alert("Material berhasil dihapus!");
      }
    }
  };

  // Manpower CRUD
  const handleSaveManpower = (manpower: Manpower) => {
    if (selectedItem) {
      let updatedManpower = selectedItem.manpower || [];
      if (editingManpowerIndex !== null) {
        updatedManpower = updatedManpower.map((item: any, idx: number) =>
          idx === editingManpowerIndex ? manpower : item,
        );
        alert("Manpower berhasil diupdate!");
      } else {
        updatedManpower = [...updatedManpower, manpower];
        alert("Manpower berhasil ditambahkan!");
      }
      setSelectedItem({ ...selectedItem, manpower: updatedManpower });
      updateDataCollection(selectedItem.id, { manpower: updatedManpower });
    }
    setShowManpowerModal(false);
    setEditingManpowerIndex(null);
  };

  const handleEditManpower = (index: number) => {
    setEditingManpowerIndex(index);
    setShowManpowerModal(true);
  };

  const handleDeleteManpower = (index: number) => {
    if (confirm("Hapus manpower ini?")) {
      if (selectedItem && selectedItem.manpower) {
        const updatedManpower = selectedItem.manpower.filter((_: any, i: number) => i !== index);
        setSelectedItem({ ...selectedItem, manpower: updatedManpower });
        updateDataCollection(selectedItem.id, { manpower: updatedManpower });
        alert("Manpower berhasil dihapus!");
      }
    }
  };

  // Schedule CRUD
  const handleSaveSchedule = (schedule: Schedule) => {
    if (selectedItem) {
      let updatedSchedule = selectedItem.schedule || [];
      if (editingScheduleIndex !== null) {
        updatedSchedule = updatedSchedule.map((item: any, idx: number) =>
          idx === editingScheduleIndex ? schedule : item,
        );
        alert("Schedule berhasil diupdate!");
      } else {
        updatedSchedule = [...updatedSchedule, schedule];
        alert("Schedule berhasil ditambahkan!");
      }
      setSelectedItem({ ...selectedItem, schedule: updatedSchedule });
      updateDataCollection(selectedItem.id, { schedule: updatedSchedule });
    }
    setShowScheduleModal(false);
    setEditingScheduleIndex(null);
  };

  const handleEditSchedule = (index: number) => {
    setEditingScheduleIndex(index);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = (index: number) => {
    if (confirm("Hapus schedule ini?")) {
      if (selectedItem && selectedItem.schedule) {
        const updatedSchedule = selectedItem.schedule.filter((_: any, i: number) => i !== index);
        setSelectedItem({ ...selectedItem, schedule: updatedSchedule });
        updateDataCollection(selectedItem.id, { schedule: updatedSchedule });
        alert("Schedule berhasil dihapus!");
      }
    }
  };

  // Consumable CRUD
  const handleSaveConsumable = (consumable: Consumable) => {
    if (selectedItem) {
      let updatedConsumables = selectedItem.consumables || [];
      if (editingConsumableIndex !== null) {
        updatedConsumables = updatedConsumables.map((item: any, idx: number) =>
          idx === editingConsumableIndex ? consumable : item,
        );
        alert("Consumable berhasil diupdate!");
      } else {
        updatedConsumables = [...updatedConsumables, consumable];
        alert("Consumable berhasil ditambahkan!");
      }
      setSelectedItem({ ...selectedItem, consumables: updatedConsumables });
      updateDataCollection(selectedItem.id, { consumables: updatedConsumables });
    }
    setShowConsumableModal(false);
    setEditingConsumableIndex(null);
  };

  const handleEditConsumable = (index: number) => {
    setEditingConsumableIndex(index);
    setShowConsumableModal(true);
  };

  const handleDeleteConsumable = (index: number) => {
    if (confirm("Hapus consumable ini?")) {
      if (selectedItem && selectedItem.consumables) {
        const updatedConsumables = selectedItem.consumables.filter((_: any, i: number) => i !== index);
        setSelectedItem({ ...selectedItem, consumables: updatedConsumables });
        updateDataCollection(selectedItem.id, { consumables: updatedConsumables });
        alert("Consumable berhasil dihapus!");
      }
    }
  };

  // Equipment CRUD
  const handleSaveEquipment = (equipment: Equipment) => {
    if (selectedItem) {
      let updatedEquipment = selectedItem.equipment || [];
      if (editingEquipmentIndex !== null) {
        updatedEquipment = updatedEquipment.map((item: any, idx: number) =>
          idx === editingEquipmentIndex ? equipment : item,
        );
        alert("Equipment berhasil diupdate!");
      } else {
        updatedEquipment = [...updatedEquipment, equipment];
        alert("Equipment berhasil ditambahkan!");
      }
      setSelectedItem({ ...selectedItem, equipment: updatedEquipment });
      updateDataCollection(selectedItem.id, { equipment: updatedEquipment });
    }
    setShowEquipmentModal(false);
    setEditingEquipmentIndex(null);
  };

  const handleEditEquipment = (index: number) => {
    setEditingEquipmentIndex(index);
    setShowEquipmentModal(true);
  };

  const handleDeleteEquipment = (index: number) => {
    if (confirm("Hapus equipment ini?")) {
      if (selectedItem && selectedItem.equipment) {
        const updatedEquipment = selectedItem.equipment.filter((_: any, i: number) => i !== index);
        setSelectedItem({ ...selectedItem, equipment: updatedEquipment });
        updateDataCollection(selectedItem.id, { equipment: updatedEquipment });
        alert("Equipment berhasil dihapus!");
      }
    }
  };

  if (!show || !selectedItem) return null;

  return (
    <>
      {/* Detail Modal dengan TABS */}
      <div className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-gray-200 shadow-sm ml-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 py-3">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "overview"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("materials")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "materials"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                📦 Material BOQ
              </button>
              <button
                onClick={() => setActiveTab("manpower")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "manpower"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                👷 Manpower
              </button>
              <button
                onClick={() => setActiveTab("schedule")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "schedule"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                📅 Schedule
              </button>
              <button
                onClick={() => setActiveTab("consumables")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "consumables"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                🔧 Consumables
              </button>
              <button
                onClick={() => setActiveTab("equipment")}
                className={`w-full rounded-lg py-3 px-2 border-2 text-center transition-colors ${
                  activeTab === "equipment"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                🚜 Equipment
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "overview" && (
              <div className="w-full max-w-4xl mx-auto">
                <div className="space-y-4">
                  <h3 className="text-gray-900 mb-3">Informasi Data Collection</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Kategori</span>
                    <span className="text-gray-900 font-semibold">{selectedItem.kategori}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tanggal Pengumpulan</span>
                    <span className="text-gray-900 font-bold">
                      {formatDisplayDate(selectedItem.tanggalPengumpulan)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Lokasi</span>
                    <span className="text-gray-900">{selectedItem.lokasi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Kolektor</span>
                    <span className="text-gray-900">{selectedItem.namaKolektor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tipe Pekerjaan</span>
                    <span className="text-gray-900">{selectedItem.tipePekerjaan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Jenis Kontrak</span>
                    <span className="text-gray-900">{selectedItem.jenisKontrak}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Priority</span>
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
                      <span className="text-gray-600 block mb-2">Catatan</span>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {selectedItem.notes}
                      </div>
                    </div>
                  )}
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div>
                      <span className="text-gray-600 block mb-2">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.tags.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* EXECUTIVE COMMAND CENTER PREVIEW */}
                  <div className="mt-8 pt-6 border-t-2 border-gray-900 bg-gray-50 -mx-6 px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest italic flex items-center gap-2">
                        <TrendingUp size={16} className="text-red-600" />
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
                          {selectedItem.materials?.length > 10 ? "HIGH" : "MEDIUM"}
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-red-600 h-full"
                            style={{ width: selectedItem.materials?.length > 10 ? "85%" : "45%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Manpower Intensity
                        </div>
                        <div className="text-xl font-black text-gray-900">
                          {selectedItem.manpower?.length > 5 ? "INTENSE" : "NORMAL"}
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full"
                            style={{ width: selectedItem.manpower?.length > 5 ? "90%" : "50%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Project Readiness
                        </div>
                        <div className="text-xl font-black text-gray-900">
                          {selectedItem.status === "Verified" ? "100%" : "65%"}
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full"
                            style={{ width: selectedItem.status === "Verified" ? "100%" : "65%" }}
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
                  <h3 className="text-gray-900">Material BOQ List</h3>
                  <button
                    onClick={handleAddMaterial}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Plus size={18} className="inline mr-2" />
                    Add Material
                  </button>
                </div>

                {selectedItem.materials && selectedItem.materials.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-red-600 to-gray-900 text-white">
                          <tr>
                            <th className="px-4 py-3 text-left">Material Name</th>
                            <th className="px-4 py-3 text-left">Supplier</th>
                            <th className="px-4 py-3 text-right">Qty Estimate</th>
                            <th className="px-4 py-3 text-right">Qty Actual</th>
                            <th className="px-4 py-3 text-right">Variance</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedItem.materials.map((item: any, idx: number) => {
                            const qtyEstimate = Number(
                              item.qtyEstimate ?? item.qtyDelivery ?? item.qtyInstalled ?? 0,
                            );
                            const qtyActual = Number(item.qtyActual ?? item.qtyInstalled ?? 0);
                            const variance = qtyActual - qtyEstimate;
                            const materialName = item.materialName || item.productName || "Material";
                            const unit = item.unit || item.unitDelivery || item.unitInstalled || "-";
                            return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="text-gray-900 font-semibold">{materialName}</div>
                                  <div className="text-sm text-gray-600">{unit}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{item.supplier}</td>
                                <td className="px-4 py-3 text-right text-gray-900">
                                  {qtyEstimate.toLocaleString("id-ID")}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900">
                                  {qtyActual.toLocaleString("id-ID")}
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
                                  {variance.toLocaleString("id-ID")}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getMaterialStatusColor(item.status)}`}
                                    >
                                      {getMaterialStatusIcon(item.status)}
                                      {item.status}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleEditMaterial(idx)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit Material"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMaterial(idx)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Hapus Material"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Material Summary */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <div className="text-blue-700 text-sm font-bold mb-1">Total Materials</div>
                        <div className="text-blue-900 font-bold text-lg">
                          {selectedItem.materials.length} items
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                        <div className="text-gray-700 text-sm font-bold mb-1">Total Qty (Estimate)</div>
                        <div className="text-gray-900 font-bold text-lg">
                          {(selectedItem.materials || [])
                            .reduce(
                              (sum: number, item: any) =>
                                sum + Number(item.qtyEstimate ?? item.qtyDelivery ?? item.qtyInstalled ?? 0),
                              0,
                            )
                            .toLocaleString("id-ID")}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Package size={48} className="mx-auto mb-3 opacity-50" />
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
                    <Users size={24} className="text-blue-600" />
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

                {selectedItem?.manpower && selectedItem.manpower.length > 0 ? (
                  <>
                    <div className="overflow-x-auto rounded-lg border-2 border-gray-200">
                      <table className="w-full border-collapse">
                        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold">Position</th>
                            <th className="px-4 py-3 text-center font-bold">Qty<br />(Orang)</th>
                            <th className="px-4 py-3 text-center font-bold">Duration<br />(Hari)</th>
                            <th className="px-4 py-3 text-left font-bold">Notes</th>
                            <th className="px-4 py-3 text-center font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItem.manpower.map((item: any, index: number) => (
                            <tr key={item.id} className="border-b hover:bg-blue-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900">{item.position}</div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-blue-600">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold">{item.duration}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.notes || "-"}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleEditManpower(index)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteManpower(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold text-lg mb-2">Belum ada data manpower</p>
                    <p className="text-sm">Klik "Add Manpower" untuk menambahkan tenaga kerja</p>
                  </div>
                )}
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === "schedule" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 font-bold text-lg">
                    Schedule ({selectedItem.schedule?.length || 0})
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

                {selectedItem.schedule && selectedItem.schedule.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">#</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Activity</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Start Date</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">End Date</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Duration</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Status</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Progress</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItem.schedule.map((item: any, index: number) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                {index + 1}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="font-semibold text-gray-900">{item.activity}</div>
                                {item.notes && (
                                  <div className="text-xs text-gray-600 mt-1">{item.notes}</div>
                                )}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-gray-700">{item.startDate}</td>
                              <td className="border border-gray-300 px-4 py-3 text-gray-700">{item.endDate}</td>
                              <td className="border border-gray-300 px-4 py-3 text-center">
                                <span className="font-semibold text-blue-600">{item.duration} days</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    item.status === "Completed"
                                      ? "bg-green-100 text-green-700"
                                      : item.status === "In Progress"
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
                                      style={{ width: `${item.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-gray-700">{item.progress}%</span>
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleEditSchedule(index)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchedule(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Calendar size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold text-lg mb-2">Belum ada schedule</p>
                    <p className="text-sm">Klik "Add Schedule" untuk menambahkan jadwal</p>
                  </div>
                )}
              </div>
            )}

            {/* Consumables Tab */}
            {activeTab === "consumables" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 font-bold text-lg">
                    Consumables ({selectedItem.consumables?.length || 0})
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

                {selectedItem.consumables && selectedItem.consumables.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">#</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Item Name</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Category</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Quantity</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItem.consumables.map((item: any, index: number) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                {index + 1}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="font-semibold text-gray-900">{item.itemName}</div>
                                {item.notes && (
                                  <div className="text-xs text-gray-600 mt-1">{item.notes}</div>
                                )}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    item.category === "Tools"
                                      ? "bg-blue-100 text-blue-700"
                                      : item.category === "Safety"
                                      ? "bg-green-100 text-green-700"
                                      : item.category === ""
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {item.category}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-center">
                                <span className="font-semibold text-gray-700">
                                  {item.quantity} {item.unit}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleEditConsumable(index)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConsumable(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <ShoppingCart size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold text-lg mb-2">Belum ada consumables</p>
                    <p className="text-sm">Klik "Add Consumable" untuk menambahkan item</p>
                  </div>
                )}
              </div>
            )}

            {/* Equipment Tab */}
            {activeTab === "equipment" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 font-bold text-lg">
                    Equipment ({selectedItem.equipment?.length || 0})
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

                {selectedItem.equipment && selectedItem.equipment.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-600 to-gray-900 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">#</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Equipment Name</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Quantity</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Duration</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-bold text-sm">Supplier</th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-bold text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItem.equipment.map((item: any, index: number) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                                {index + 1}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="font-semibold text-gray-900">
                                  {item.equipmentName || item.name || "Equipment"}
                                </div>
                                {item.notes && (
                                  <div className="text-xs text-gray-600 mt-1">{item.notes}</div>
                                )}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-center">
                                <span className="font-semibold text-gray-700">
                                  {item.quantity} {item.unit}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-center">
                                <span className="font-semibold text-blue-600">
                                  {item.duration} {item.durationType}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-gray-700">
                                {item.supplier}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleEditEquipment(index)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEquipment(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Package size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold text-lg mb-2">Belum ada equipment</p>
                    <p className="text-sm">Klik "Add Equipment" untuk menambahkan peralatan</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <button
                onClick={async () => {
                  try {
                    await exportDataCollectionToWord({
                      noKoleksi: selectedItem.noKoleksi,
                      namaResponden: selectedItem.namaResponden,
                      kategori: selectedItem.kategori,
                      tanggalPengumpulan: selectedItem.tanggalPengumpulan,
                      lokasi: selectedItem.lokasi,
                      namaKolektor: selectedItem.namaKolektor,
                      tipePekerjaan: selectedItem.tipePekerjaan,
                      jenisKontrak: selectedItem.jenisKontrak,
                      notes: selectedItem.notes || "",
                      materials: selectedItem.materials || [],
                    });
                    alert("✅ Berita Acara berhasil diexport ke Word!");
                  } catch (error) {
                    console.error("Export error:", error);
                    alert("❌ Gagal export ke Word!");
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-colors font-semibold"
              >
                <Download size={18} />
                Export to Word
              </button>

              <button
                onClick={onClose}
                className="px-6 py-2 border-2 border-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Material Modal */}
      {showMaterialModal && (
        <>
          <div
            className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm z-[60]"
            onClick={() => setShowMaterialModal(false)}
          />

          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 bg-gradient-to-r from-red-600 to-gray-900 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package size={24} />
                {editingMaterialIndex !== null ? "Edit Material BOQ" : "Tambah Material BOQ"}
              </h3>
              <button
                onClick={() => setShowMaterialModal(false)}
                className="text-white hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-900 font-bold mb-2">Nama Material *</label>
                  <input
                    type="text"
                    value={materialForm.materialName}
                    onChange={(e) => setMaterialForm({ ...materialForm, materialName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: Semen Portland"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">Supplier *</label>
                  <input
                    type="text"
                    value={materialForm.supplier}
                    onChange={(e) => setMaterialForm({ ...materialForm, supplier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: PT Semen Indonesia"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Qty Estimasi *</label>
                    <input
                      type="number"
                      value={materialForm.qtyEstimate}
                      onChange={(e) =>
                        setMaterialForm({ ...materialForm, qtyEstimate: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Qty Aktual</label>
                    <input
                      type="number"
                      value={materialForm.qtyActual}
                      onChange={(e) =>
                        setMaterialForm({ ...materialForm, qtyActual: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Unit *</label>
                    <input
                      type="text"
                      list="dc-detail-unit-options"
                      value={materialForm.unit}
                      onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-bold text-slate-700"
                      placeholder="kg, pcs, lot, dll"
                      required
                    />
                    <datalist id="dc-detail-unit-options">
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

      {/* Sub-modals */}
      <ManpowerModal
        show={showManpowerModal}
        onClose={() => {
          setShowManpowerModal(false);
          setEditingManpowerIndex(null);
        }}
        onSave={handleSaveManpower}
        editingItem={
          editingManpowerIndex !== null
            ? selectedItem?.manpower?.[editingManpowerIndex]
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
            ? selectedItem?.schedule?.[editingScheduleIndex]
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
            ? selectedItem?.consumables?.[editingConsumableIndex]
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
            ? selectedItem?.equipment?.[editingEquipmentIndex]
            : null
        }
      />
    </>
  );
}
