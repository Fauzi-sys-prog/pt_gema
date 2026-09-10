import { useState, useRef, useEffect } from "react";
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
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Search,
} from "lucide-react";
import { ManpowerModal } from "../../components/data-collection/ManpowerModal";
import type { Manpower } from "../../components/data-collection/ManpowerModal";
import { ScheduleModal } from "../../components/data-collection/ScheduleModal";
import type { Schedule } from "../../components/data-collection/ScheduleModal";
import { ConsumableModal } from "../../components/data-collection/ConsumableModal";
import type { Consumable } from "../../components/data-collection/ConsumableModal";
import { EquipmentModal } from "../../components/data-collection/EquipmentModal";
import type { Equipment } from "../../components/data-collection/EquipmentModal";
import { BOMMaterialModal } from "../../components/data-collection/BOMMaterialModal";
import type { BOMMaterial } from "../../components/data-collection/BOMMaterialModal";
import { BOMSummaryTable } from "../../components/data-collection/BOMSummaryTable";
import { useEscapeKey } from '../../hooks/useEscapeKey';

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

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
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

interface DataCollectionFormModalProps {
  show: boolean;
  editingId: string | null;
  formData: any;
  setFormData: (d: any) => void;
  signatureData: string | null;
  setSignatureData: (d: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  stockItemList: any[];
  dataCollectionListLength: number;
}

export function DataCollectionFormModal({
  show,
  editingId,
  formData,
  setFormData,
  signatureData,
  setSignatureData,
  onSubmit,
  onClose,
  stockItemList,
  dataCollectionListLength,
}: DataCollectionFormModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateFormMaterialModal, setShowCreateFormMaterialModal] = useState(false);
  const [editingCreateFormMaterialIndex, setEditingCreateFormMaterialIndex] = useState<number | null>(null);
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  const [createFormMaterialForm, setCreateFormMaterialForm] = useState<Material>({
    id: "",
    materialName: "",
    qtyEstimate: 0,
    qtyActual: 0,
    unit: "",
    supplier: "",
    status: "Not Ordered",
  });

  const [showManpowerModal, setShowManpowerModal] = useState(false);
  const [editingManpowerIndex, setEditingManpowerIndex] = useState<number | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [editingConsumableIndex, setEditingConsumableIndex] = useState<number | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [showBOMMaterialModal, setShowBOMMaterialModal] = useState(false);
  const [editingBOMMaterialIndex, setEditingBOMMaterialIndex] = useState<number | null>(null);

  useEscapeKey([
    { condition: showAdvanced, close: () => setShowAdvanced(false) },
    { condition: showCreateFormMaterialModal, close: () => setShowCreateFormMaterialModal(false) },
    { condition: showManpowerModal, close: () => setShowManpowerModal(false) },
    { condition: showScheduleModal, close: () => setShowScheduleModal(false) },
    { condition: showConsumableModal, close: () => setShowConsumableModal(false) },
    { condition: showEquipmentModal, close: () => setShowEquipmentModal(false) },
    { condition: showBOMMaterialModal, close: () => setShowBOMMaterialModal(false) },
  ]);


  const handleSaveManpower = (manpower: Manpower) => {
    let updatedManpower = formData.manpower || [];
    if (editingManpowerIndex !== null) {
      updatedManpower = updatedManpower.map((item: any, idx: number) =>
        idx === editingManpowerIndex ? manpower : item,
      );
    } else {
      updatedManpower = [...updatedManpower, manpower];
    }
    setFormData({ ...formData, manpower: updatedManpower });
    setShowManpowerModal(false);
    setEditingManpowerIndex(null);
  };

  const handleSaveSchedule = (schedule: Schedule) => {
    let updatedSchedule = formData.schedule || [];
    if (editingScheduleIndex !== null) {
      updatedSchedule = updatedSchedule.map((item: any, idx: number) =>
        idx === editingScheduleIndex ? schedule : item,
      );
    } else {
      updatedSchedule = [...updatedSchedule, schedule];
    }
    setFormData({ ...formData, schedule: updatedSchedule });
    setShowScheduleModal(false);
    setEditingScheduleIndex(null);
  };

  const handleSaveConsumable = (consumable: Consumable) => {
    let updatedConsumables = formData.consumables || [];
    if (editingConsumableIndex !== null) {
      updatedConsumables = updatedConsumables.map((item: any, idx: number) =>
        idx === editingConsumableIndex ? consumable : item,
      );
    } else {
      updatedConsumables = [...updatedConsumables, consumable];
    }
    setFormData({ ...formData, consumables: updatedConsumables });
    setShowConsumableModal(false);
    setEditingConsumableIndex(null);
  };

  const handleSaveEquipment = (equipment: Equipment) => {
    let updatedEquipment = formData.equipment || [];
    if (editingEquipmentIndex !== null) {
      updatedEquipment = updatedEquipment.map((item: any, idx: number) =>
        idx === editingEquipmentIndex ? equipment : item,
      );
    } else {
      updatedEquipment = [...updatedEquipment, equipment];
    }
    setFormData({ ...formData, equipment: updatedEquipment });
    setShowEquipmentModal(false);
    setEditingEquipmentIndex(null);
  };

  const handleSaveBOMMaterial = (bomMaterial: BOMMaterial) => {
    let updatedBOMMaterials = (formData.materials || []) as BOMMaterial[];
    if (editingBOMMaterialIndex !== null) {
      updatedBOMMaterials = updatedBOMMaterials.map((item, idx) =>
        idx === editingBOMMaterialIndex ? bomMaterial : item,
      );
      alert("BOM Material berhasil diupdate!");
    } else {
      updatedBOMMaterials = [...updatedBOMMaterials, bomMaterial];
      alert("BOM Material berhasil ditambahkan!");
    }
    setFormData({ ...formData, materials: updatedBOMMaterials });
    setShowBOMMaterialModal(false);
    setEditingBOMMaterialIndex(null);
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gradient-to-r from-red-600 via-gray-900 to-black text-white p-6 border-b-4 border-red-600 z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingId
                  ? "Update Data Collection"
                  : "Tambah Data Collection Baru"}
              </h2>
              <button
                onClick={() => onClose()}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Form - Always Show! */}
          <form onSubmit={onSubmit} className="p-6 space-y-6">
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
                      setFormData({ ...formData, namaResponden: e.target.value })
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
                      setFormData({ ...formData, lokasi: e.target.value })
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
                      setFormData({ ...formData, tanggalPengumpulan: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 text-base font-semibold"
                  />
                </div>
              </div>

              {/* Auto-generated No. Koleksi info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>No. Koleksi:</strong> Akan di-generate otomatis (KOL-{new Date().getFullYear()}-{String(dataCollectionListLength + 1).padStart(4, "0")})
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
                            ["Survey", "Email", "User"].includes(formData.kategori)
                              ? formData.kategori
                              : "Lainnya"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "Lainnya") {
                              setFormData({ ...formData, kategori: val });
                            } else {
                              setFormData({ ...formData, kategori: "" });
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        >
                          <option value="Survey">Survey</option>
                          <option value="Email">Email</option>
                          <option value="User">User</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                        {!["Survey", "Email", "User"].includes(formData.kategori) && (
                          <input
                            type="text"
                            value={formData.kategori || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, kategori: e.target.value })
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
                          setFormData({ ...formData, namaKolektor: e.target.value })
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
                            ["Pasang baru", "Repair", "Modifikasi"].includes(formData.tipePekerjaan)
                              ? formData.tipePekerjaan
                              : "Lainnya"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "Lainnya") {
                              setFormData({ ...formData, tipePekerjaan: val });
                            } else {
                              setFormData({ ...formData, tipePekerjaan: "" });
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        >
                          <option value="Pasang baru">Pasang baru</option>
                          <option value="Repair">Repair</option>
                          <option value="Modifikasi">Modifikasi</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                        {!["Pasang baru", "Repair", "Modifikasi"].includes(formData.tipePekerjaan) && (
                          <input
                            type="text"
                            value={formData.tipePekerjaan || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, tipePekerjaan: e.target.value })
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
                            ["Subcontractor", "Main contractor"].includes(formData.jenisKontrak)
                              ? formData.jenisKontrak
                              : "Lainnya"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "Lainnya") {
                              setFormData({ ...formData, jenisKontrak: val });
                            } else {
                              setFormData({ ...formData, jenisKontrak: "" });
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        >
                          <option value="Subcontractor">Subcontractor</option>
                          <option value="Main contractor">Main contractor</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                        {!["Subcontractor", "Main contractor"].includes(formData.jenisKontrak) && (
                          <input
                            type="text"
                            value={formData.jenisKontrak || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, jenisKontrak: e.target.value })
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
                          setFormData({ ...formData, notes: e.target.value })
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
                          <th className="px-3 py-2 text-left text-sm">#</th>
                          <th className="px-3 py-2 text-left text-sm">Position</th>
                          <th className="px-3 py-2 text-center text-sm">Qty</th>
                          <th className="px-3 py-2 text-center text-sm">Duration (days)</th>
                          <th className="px-3 py-2 text-left text-sm">Notes</th>
                          <th className="px-3 py-2 text-center text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {formData.manpower.map((man: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="text-gray-900 font-semibold">{man.position}</div>
                            </td>
                            <td className="px-3 py-2 text-center text-blue-600 font-bold">{man.quantity}</td>
                            <td className="px-3 py-2 text-center text-gray-700 font-semibold">{man.duration}</td>
                            <td className="px-3 py-2 text-gray-600 text-sm">{man.notes || "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingManpowerIndex(idx);
                                    setShowManpowerModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Hapus manpower ini?")) {
                                      setFormData({
                                        ...formData,
                                        manpower: formData.manpower.filter((_: any, i: number) => i !== idx),
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
                      <span className="font-bold text-lg">Total Manpower</span>
                      <span className="font-bold text-2xl">{formData.manpower.length} position(s)</span>
                    </div>
                    <div className="text-sm text-blue-100 mt-1">
                      💡 Harga akan diinput di Quotation
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Users size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 font-semibold">Belum ada manpower</p>
                  <p className="text-sm text-gray-500">Klik "Add Manpower" untuk menambahkan</p>
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
                        <th className="px-3 py-2 text-left text-sm">#</th>
                        <th className="px-3 py-2 text-left text-sm">Activity</th>
                        <th className="px-3 py-2 text-left text-sm">Start Date</th>
                        <th className="px-3 py-2 text-left text-sm">End Date</th>
                        <th className="px-3 py-2 text-right text-sm">Duration</th>
                        <th className="px-3 py-2 text-center text-sm">Status</th>
                        <th className="px-3 py-2 text-center text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {formData.schedule.map((sch: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 font-semibold">{sch.activity}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{sch.startDate}</td>
                          <td className="px-3 py-2 text-gray-700">{sch.endDate}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{sch.duration} days</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                sch.status === "Completed"
                                  ? "bg-green-100 text-green-700"
                                  : sch.status === "In Progress"
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
                                  setEditingScheduleIndex(idx);
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
                                  if (confirm("Hapus schedule ini?")) {
                                    setFormData({
                                      ...formData,
                                      schedule: formData.schedule.filter((_: any, i: number) => i !== idx),
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
                  <Calendar size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 font-semibold">Belum ada schedule</p>
                  <p className="text-sm text-gray-500">Klik "Add Schedule" untuk menambahkan</p>
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
                          <th className="px-3 py-2 text-left text-sm">#</th>
                          <th className="px-3 py-2 text-left text-sm">Item Name</th>
                          <th className="px-3 py-2 text-left text-sm">Category</th>
                          <th className="px-3 py-2 text-right text-sm">Qty</th>
                          <th className="px-3 py-2 text-left text-sm">Unit</th>
                          <th className="px-3 py-2 text-center text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {formData.consumables.map((con: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="text-gray-900 font-semibold">{con.itemName}</div>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{con.category}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{con.quantity}</td>
                            <td className="px-3 py-2 text-gray-700">{con.unit}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingConsumableIndex(idx);
                                    setShowConsumableModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Hapus consumable ini?")) {
                                      setFormData({
                                        ...formData,
                                        consumables: formData.consumables.filter((_: any, i: number) => i !== idx),
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

                  <div className="bg-gradient-to-r from-green-600 to-gray-900 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">Total Consumables</span>
                      <span className="font-bold text-2xl">{formData.consumables.length} item(s)</span>
                    </div>
                    <div className="text-sm text-green-100 mt-1">
                      {formData.consumables.length} item(s)
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Package size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 font-semibold">Belum ada consumables</p>
                  <p className="text-sm text-gray-500">Klik "Add Consumable" untuk menambahkan</p>
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
                          <th className="px-3 py-2 text-left text-sm">#</th>
                          <th className="px-3 py-2 text-left text-sm">Equipment Name</th>
                          <th className="px-3 py-2 text-center text-sm">Qty</th>
                          <th className="px-3 py-2 text-center text-sm">Unit</th>
                          <th className="px-3 py-2 text-center text-sm">Duration (Period)</th>
                          <th className="px-3 py-2 text-left text-sm">Supplier</th>
                          <th className="px-3 py-2 text-center text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {formData.equipment.map((eq: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="text-gray-900 font-semibold">{eq.equipmentName}</div>
                            </td>
                            <td className="px-3 py-2 text-center text-orange-600 font-bold">{eq.quantity}</td>
                            <td className="px-3 py-2 text-center text-gray-700 font-semibold">{eq.unit}</td>
                            <td className="px-3 py-2 text-center text-gray-700 font-semibold">{eq.duration}</td>
                            <td className="px-3 py-2 text-gray-600 text-sm">{eq.supplier || "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEquipmentIndex(idx);
                                    setShowEquipmentModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Hapus equipment ini?")) {
                                      setFormData({
                                        ...formData,
                                        equipment: formData.equipment.filter((_: any, i: number) => i !== idx),
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
                      <span className="font-bold text-lg">Total Equipment</span>
                      <span className="font-bold text-2xl">{formData.equipment.length} item(s)</span>
                    </div>
                    <div className="text-sm text-orange-100 mt-1">
                      {formData.equipment.length} equipment(s)
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <ShoppingCart size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 font-semibold">Belum ada equipment</p>
                  <p className="text-sm text-gray-500">Klik "Add Equipment" untuk menambahkan</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={onClose}
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

      {/* Material Modal untuk CREATE FORM */}
      {showCreateFormMaterialModal && (
        <>
          <div
            className="fixed inset-0 bg-white bg-opacity-60 backdrop-blur-sm z-[60]"
            onClick={() => setShowCreateFormMaterialModal(false)}
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
                onClick={() => setShowCreateFormMaterialModal(false)}
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
                  updatedMaterials = updatedMaterials.map((item, idx) =>
                    idx === editingCreateFormMaterialIndex ? createFormMaterialForm : item,
                  );
                } else {
                  updatedMaterials = [...updatedMaterials, createFormMaterialForm];
                }
                setFormData({ ...formData, materials: updatedMaterials });
                setShowCreateFormMaterialModal(false);
              }}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-6 space-y-4">
                {/* Inventory Selection Search */}
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <label className="block text-red-900 font-bold mb-2 flex items-center gap-2 text-sm">
                    <Search size={16} />
                    Integrasi Supply Chain: Cari Material Inventaris
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama atau kode material refractory..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                      onChange={(e) => setMaterialSearchTerm(e.target.value)}
                      value={materialSearchTerm}
                    />
                    {materialSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setMaterialSearchTerm("")}
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
                            item.nama.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
                            item.kode.toLowerCase().includes(materialSearchTerm.toLowerCase()),
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
                                supplier: item.supplier || "PT Gema Teknik (Stok)",
                              });
                              setMaterialSearchTerm("");
                            }}
                          >
                            <div className="font-bold text-sm text-gray-900">{item.nama}</div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] text-gray-500 font-mono">
                                ID: {item.kode} • {item.kategori}
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
                  <label className="block text-gray-900 font-bold mb-2">Nama Material *</label>
                  <input
                    type="text"
                    value={createFormMaterialForm.materialName}
                    onChange={(e) =>
                      setCreateFormMaterialForm({ ...createFormMaterialForm, materialName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="Contoh: Semen Portland"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">Supplier *</label>
                  <input
                    type="text"
                    value={createFormMaterialForm.supplier}
                    onChange={(e) =>
                      setCreateFormMaterialForm({ ...createFormMaterialForm, supplier: e.target.value })
                    }
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
                      value={createFormMaterialForm.qtyEstimate}
                      onChange={(e) =>
                        setCreateFormMaterialForm({
                          ...createFormMaterialForm,
                          qtyEstimate: parseFloat(e.target.value) || 0,
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
                    <label className="block text-gray-900 font-bold mb-2">Unit *</label>
                    <input
                      type="text"
                      list="dc-create-unit-options"
                      value={createFormMaterialForm.unit}
                      onChange={(e) =>
                        setCreateFormMaterialForm({ ...createFormMaterialForm, unit: e.target.value })
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
                    Informasi harga dan margin akan ditentukan pada tahap Quotation.
                  </span>
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">Status *</label>
                  <select
                    value={createFormMaterialForm.status}
                    onChange={(e) =>
                      setCreateFormMaterialForm({ ...createFormMaterialForm, status: e.target.value as any })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    required
                  >
                    <option value="Not Ordered">Not Ordered</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Received">Received</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowCreateFormMaterialModal(false)}
                  className="px-6 py-2 border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
                >
                  <Save size={18} />
                  {editingCreateFormMaterialIndex !== null ? "Update Material" : "Tambah Material"}
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
            ? formData.manpower?.[editingManpowerIndex]
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
            ? formData.schedule?.[editingScheduleIndex]
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
            ? formData.consumables?.[editingConsumableIndex]
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
            ? formData.equipment?.[editingEquipmentIndex]
            : null
        }
      />

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
    </>
  );
}
