import { useState } from "react";
import { useNavigate } from "react-router";
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
  CheckCircle,
  Clock,
  XCircle,
  ShoppingCart,
  Download,
  Calculator,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import type { DataCollection as DataCollectionType } from "../../contexts/AppContext";
import { exportProjectPreparationToWord } from "../../components/DataCollectionWordExport";
import { toast } from 'sonner';
import type { Manpower } from "../../components/data-collection/ManpowerModal";
import type { Schedule } from "../../components/data-collection/ScheduleModal";
import type { Consumable } from "../../components/data-collection/ConsumableModal";
import type { Equipment } from "../../components/data-collection/EquipmentModal";
import { DataCollectionFormModal } from "./DataCollectionFormModal";
import { DataCollectionDetailModal } from "./DataCollectionDetailModal";
import { useEscapeKey } from '../../hooks/useEscapeKey';

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

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DataCollectionType | null>(null);
  const { stockItemList } = useApp();

  useEscapeKey([
    { condition: showModal, close: () => setShowModal(false) },
    { condition: showDetailModal, close: () => setShowDetailModal(false) },
  ]);

  // Signature State
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
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
      fieldType: "Text" | "Number" | "Date" | "Boolean" | "Rating";
    }[],
    materials: [] as any[],
    manpower: [] as Manpower[],
    schedule: [] as Schedule[],
    consumables: [] as Consumable[],
    equipment: [] as Equipment[],
    status: "Draft" as "Draft" | "Verified" | "Completed",
    notes: "",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    tags: [] as string[],
  });

  const handleEditData = (item: DataCollectionType) => {
    setFormData({
      noKoleksi: item.noKoleksi || "",
      namaResponden: item.namaResponden || "",
      kategori: item.kategori || "Survey",
      tanggalPengumpulan: item.tanggalPengumpulan || new Date().toISOString().split("T")[0],
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
  const filteredData = (dataCollectionList || []).filter((item) => {
    if (!item) return false;
    const search = (searchTerm || "").toLowerCase();
    const matchSearch =
      (item.namaResponden || "").toLowerCase().includes(search) ||
      (item.noKoleksi || "").toLowerCase().includes(search) ||
      (item.lokasi || "").toLowerCase().includes(search) ||
      (item.namaKolektor || "").toLowerCase().includes(search);
    return matchSearch;
  });

  // Statistics
  const stats = {
    total: (dataCollectionList || []).length,
    completed: (dataCollectionList || []).filter((d) => d && String(d.status).toLowerCase() === "completed").length,
    verified: (dataCollectionList || []).filter((d) => d && String(d.status).toLowerCase() === "verified").length,
    draft: (dataCollectionList || []).filter((d) => d && String(d.status).toLowerCase() === "draft").length,
    totalMaterials: (dataCollectionList || []).reduce(
      (sum, d) => sum + (d && d.materials ? d.materials.length : 0),
      0,
    ),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // A collection may be saved as an empty Draft while it is being prepared,
    // but it cannot be verified/completed until it contains at least one
    // planning item (material, manpower, schedule, consumable, or equipment).
    const planningItemCount = formData.materials.length + formData.manpower.length +
      formData.schedule.length + formData.consumables.length + formData.equipment.length;
    if (formData.status !== "Draft" && planningItemCount === 0) {
      toast.error("Data belum siap", { description: "Tambahkan minimal satu item sebelum diverifikasi atau diselesaikan." });
      return;
    }

    if (editingId) {
      updateDataCollection(editingId, {
        ...formData,
        signature: signatureData || undefined,
      });
      alert("✅ Data Collection berhasil diperbarui!");
      setEditingId(null);
    } else {
      const newId = `DC-${Date.now()}`;
      const newData: DataCollectionType = {
        id: newId,
        noKoleksi:
          formData.noKoleksi ||
          `KOL-${new Date().getFullYear()}-${String(dataCollectionList.length + 1).padStart(4, "0")}`,
        ...formData,
        signature: signatureData || undefined,
      };

      addDataCollection(newData);
      alert("✅ Data Collection berhasil disimpan!");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      noKoleksi: "",
      namaResponden: "",
      kategori: "Survey",
      tanggalPengumpulan: new Date().toISOString().split("T")[0],
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
    setEditingId(null);
    setShowModal(false);
  };

  const handleViewDetail = (item: DataCollectionType) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      deleteDataCollection(id);
      alert("✅ Data Collection berhasil dihapus!");
    }
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
          <div className="text-gray-600 mb-2">Total Materials</div>
          <div className="text-red-600">{stats.totalMaterials}</div>
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

      {/* Data Collection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map((item) => {
          const materialCount = item.materials?.length || 0;
          const planningItemCount = materialCount + (item.manpower?.length || 0) +
            (item.schedule?.length || 0) + (item.consumables?.length || 0) + (item.equipment?.length || 0);
          const canCreateQuotation = planningItemCount > 0;

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
                  <span className="text-gray-900 font-semibold">{item.kategori}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={16} />
                  <span>{formatDisplayDate(item.tanggalPengumpulan)}</span>
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
                  <span className="text-gray-900 font-semibold">{materialCount} items</span>
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-900 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-black"
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
                <button
                  onClick={async () => {
                    try {
                      await exportProjectPreparationToWord({
                        namaProyek: `${item.kategori} - ${item.namaResponden}`,
                        customer: item.namaResponden,
                        lokasiKerja: item.lokasi,
                        durasiProyek: item.jenisKontrak || "TBD",
                        notes: item.notes || "",
                        scopeOfWork: [
                          { item: "Bongkar Material Existing", owner: "Gema" },
                          { item: "Supply Material", owner: "Gema" },
                          { item: "Pemasangan dan Instalasi", owner: "Gema" },
                          { item: "Testing & Commissioning", owner: "Gema" },
                          { item: "Working Permit", owner: "User" },
                          { item: "Medical Check up", owner: "User" },
                        ],
                        equipment: item.equipment?.map((eq: any) => ({
                          namaPeralatan: eq.equipmentName || eq.namaPeralatan || "",
                          jenisPeralatan: eq.unit || "Unit",
                          jumlah: eq.quantity || eq.jumlah || 0,
                          keterangan: eq.supplier || eq.keterangan || "-",
                        })) || [],
                        manpower: item.manpower?.map((man: any) => ({
                          jabatan: man.position || man.jabatan || "",
                          jumlah: man.quantity || man.jumlah || 0,
                          sertifikat: man.assignedPerson || man.sertifikat || "-",
                          keterangan: man.notes || man.keterangan || "-",
                        })) || [],
                        schedule: item.schedule?.map((sch: any) => ({
                          deskripsiPekerjaan: sch.activity || sch.deskripsiPekerjaan || "",
                          area: sch.status || sch.area || "General",
                          jumlahHari: sch.duration || sch.jumlahHari || 0,
                          keterangan: sch.dependencies?.join(", ") || sch.keterangan || "-",
                        })) || [],
                        consumables: item.consumables?.map((con: any) => ({
                          deskripsiConsumable: con.itemName || con.deskripsiConsumable || "",
                          unit: con.unit || "Pcs",
                          jumlahBarang: con.quantity || con.jumlahBarang || 0,
                          keterangan: con.category || con.keterangan || "-",
                        })) || [],
                        bomDetailed: item.materials?.map((mat: any, idx: number) => ({
                          no: idx + 1,
                          area: mat.area || "General",
                          product: mat.materialName,
                          kgM3: mat.density,
                          thickness: mat.thickness,
                          surface: mat.surface,
                          volume: mat.volume,
                          weightInstalled: mat.qtyEstimate,
                          quantityInstalled: mat.qtyEstimate,
                          unit: mat.unit,
                          reversePercent: 10,
                          unitSize: mat.unitSize,
                          quantityDelivery: mat.qtyEstimate * 1.1,
                        })) || [],
                        bomSummary: item.materials?.reduce((acc: any[], mat: any) => {
                          const existing = acc.find((a) => a.product === mat.materialName);
                          if (existing) {
                            existing.quantityInstalled += mat.qtyEstimate;
                            existing.quantityDelivered += mat.qtyEstimate * 1.1;
                          } else {
                            acc.push({
                              no: acc.length + 1,
                              product: mat.materialName,
                              density: mat.density,
                              volume: mat.volume,
                              quantityInstalled: mat.qtyEstimate,
                              quantityDelivered: mat.qtyEstimate * 1.1,
                              unit: mat.unit,
                              totalWeight: mat.qtyEstimate * (mat.density || 1),
                            });
                          }
                          return acc;
                        }, []) || [],
                        createdBy: item.namaKolektor,
                        date: item.tanggalPengumpulan,
                        rev: "0",
                        version: "1.0",
                        approvedBy: "Management",
                      });
                      toast.success("✅ Data Persiapan Pekerjaan Proyek berhasil diexport ke Word!", {
                        description: `File: Data_Persiapan_${item.namaResponden.replace(/[^a-zA-Z0-9]/g, '_')}.docx`,
                        duration: 4000,
                      });
                    } catch (error) {
                      console.error("Export error:", error);
                      toast.error("❌ Gagal export ke Word!", {
                        description: "Terjadi kesalahan saat generate dokumen. Silakan coba lagi.",
                        duration: 4000,
                      });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-colors font-semibold"
                >
                  <Download size={18} />
                  Export to Word
                </button>

                {hasQuotation ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        navigate("/sales/quotation", {
                          state: { fromDataCollection: true, dataCollectionId: item.id },
                        });
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                    >
                      <Plus size={18} />
                      New
                    </button>
                    <button
                      onClick={() => navigate("/sales/quotation")}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors font-semibold"
                    >
                      <Calculator size={18} />
                      View All
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={!canCreateQuotation}
                    onClick={() => {
                      if (!canCreateQuotation) {
                        toast.error("Belum siap dibuat quotation", { description: "Tambahkan minimal satu item perencanaan terlebih dahulu." });
                        return;
                      }
                      navigate("/sales/quotation", {
                        state: { fromDataCollection: true, dataCollectionId: item.id },
                      });
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-semibold ${
                      canCreateQuotation
                        ? "bg-gradient-to-r from-red-600 to-gray-900 text-white hover:from-red-700 hover:to-black"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Calculator size={18} />
                    {canCreateQuotation ? "Create Quotation" : "Tambah Item untuk Quotation"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DataCollectionFormModal
        show={showModal}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        signatureData={signatureData}
        setSignatureData={setSignatureData}
        onSubmit={handleSubmit}
        onClose={resetForm}
        stockItemList={stockItemList}
        dataCollectionListLength={dataCollectionList.length}
      />

      <DataCollectionDetailModal
        show={showDetailModal}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        onClose={() => setShowDetailModal(false)}
        updateDataCollection={updateDataCollection}
      />
    </div>
  );
}
