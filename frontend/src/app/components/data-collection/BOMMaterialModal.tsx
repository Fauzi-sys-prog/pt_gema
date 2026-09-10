import { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";

/**
 * BOM Material Interface
 * Based on PT Starmortar Bill of Material format
 */
export interface BOMMaterial {
  id: string;
  // Area Information
  area: string; // e.g., "Dinding Utara 2775x2700mm"
  areaNumber: number; // 1, 2, 3
  
  // Product Information
  productName: string; // e.g., "LR 68", "LW 1300", "Calcium Silica Board"
  category: "Monolithic" | "Brick/Precast" | "Mortar" | "Insulation" | "Anchoring" | "Accessory" | "Others";
  
  // Technical Specifications
  density: number; // Kg/m³
  thickness: number; // mm
  surface: number; // m²
  volume: number; // m³
  
  // Quantities
  weightInstalled: number; // Kg
  qtyInstalled: number; // Quantity installed
  unitInstalled: string; // Kgs, Pcs, Roll, etc.
  
  // Delivery with Reserve/Wastage
  reversePercent: number; // % (usually 10%)
  unitSize: number; // Size per unit (e.g., 25 Kg bags)
  qtyDelivery: number; // Quantity for delivery (with reserve)
  unitDelivery: string; // Unit for delivery
  
  // Additional Info
  notes?: string;
  supplier?: string;
}

interface BOMMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: BOMMaterial) => void;
  editingMaterial?: BOMMaterial | null;
  editingIndex?: number | null;
}

export const BOMMaterialModal = ({
  isOpen,
  onClose,
  onSave,
  editingMaterial,
  editingIndex,
}: BOMMaterialModalProps) => {
  const [formData, setFormData] = useState<BOMMaterial>({
    id: "",
    area: "",
    areaNumber: 1,
    productName: "",
    category: "Monolithic",
    density: 0,
    thickness: 0,
    surface: 0,
    volume: 0,
    weightInstalled: 0,
    qtyInstalled: 0,
    unitInstalled: "Kgs",
    reversePercent: 10,
    unitSize: 25,
    qtyDelivery: 0,
    unitDelivery: "Kgs",
    notes: "",
    supplier: "",
  });

  useEffect(() => {
    if (editingMaterial) {
      setFormData(editingMaterial);
    } else {
      // Reset form
      setFormData({
        id: `BOM-${Date.now()}`,
        area: "",
        areaNumber: 1,
        productName: "",
        category: "Monolithic",
        density: 0,
        thickness: 0,
        surface: 0,
        volume: 0,
        weightInstalled: 0,
        qtyInstalled: 0,
        unitInstalled: "Kgs",
        reversePercent: 10,
        unitSize: 25,
        qtyDelivery: 0,
        unitDelivery: "Kgs",
        notes: "",
        supplier: "",
      });
    }
  }, [editingMaterial, isOpen]);

  // Auto-calculate volume from surface and thickness
  useEffect(() => {
    if (formData.surface > 0 && formData.thickness > 0) {
      const volumeCalc = (formData.surface * formData.thickness) / 1000; // mm to m
      setFormData((prev) => ({ ...prev, volume: Number(volumeCalc.toFixed(4)) }));
    }
  }, [formData.surface, formData.thickness]);

  // Auto-calculate weight from volume and density
  useEffect(() => {
    if (formData.volume > 0 && formData.density > 0) {
      const weightCalc = formData.volume * formData.density;
      setFormData((prev) => ({
        ...prev,
        weightInstalled: Number(weightCalc.toFixed(2)),
        qtyInstalled: Number(weightCalc.toFixed(0)),
      }));
    }
  }, [formData.volume, formData.density]);

  // Auto-calculate delivery quantity with reverse percentage
  useEffect(() => {
    if (formData.qtyInstalled > 0 && formData.reversePercent >= 0) {
      const deliveryCalc = formData.qtyInstalled * (1 + formData.reversePercent / 100);
      
      // If unit size is defined, calculate packages needed
      if (formData.unitSize > 0 && formData.unitInstalled === "Kgs") {
        const packagesNeeded = Math.ceil(deliveryCalc / formData.unitSize) * formData.unitSize;
        setFormData((prev) => ({ ...prev, qtyDelivery: packagesNeeded }));
      } else {
        setFormData((prev) => ({ ...prev, qtyDelivery: Number(deliveryCalc.toFixed(0)) }));
      }
    }
  }, [formData.qtyInstalled, formData.reversePercent, formData.unitSize, formData.unitInstalled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 via-gray-900 to-black text-white p-6 border-b-4 border-red-600 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package size={28} />
                {editingIndex !== null ? "Edit BOM Material" : "Tambah BOM Material"}
              </h2>
              <p className="text-sm text-gray-300 mt-1">Bill of Material - Professional Format</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Area Information */}
          <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-600 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
              📍 Area Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Area Number *
                </label>
                <input
                  type="number"
                  value={formData.areaNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, areaNumber: Number(e.target.value) })
                  }
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Area Name & Dimensions *
                </label>
                <input
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="e.g., Dinding Utara 2775x2700mm"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Format: Location + Dimensions</p>
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="bg-gradient-to-br from-red-50 to-white border-2 border-red-600 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
              📦 Product Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                  placeholder="e.g., LR 68, Calcium Silica Board"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as BOMMaterial["category"],
                    })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="Monolithic">Monolithic (Castable)</option>
                  <option value="Brick/Precast">Brick / Precast</option>
                  <option value="Mortar">Mortar</option>
                  <option value="Insulation">Insulation</option>
                  <option value="Anchoring">Anchoring</option>
                  <option value="Accessory">Accessory Materials</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                  placeholder="Supplier name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-600 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
              🔬 Technical Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Density (Kg/m³) *
                </label>
                <input
                  type="number"
                  value={formData.density}
                  onChange={(e) =>
                    setFormData({ ...formData, density: Number(e.target.value) })
                  }
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g., 2300"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Thickness (mm) *
                </label>
                <input
                  type="number"
                  value={formData.thickness}
                  onChange={(e) =>
                    setFormData({ ...formData, thickness: Number(e.target.value) })
                  }
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g., 300"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Surface Area (m²) *
                </label>
                <input
                  type="number"
                  value={formData.surface}
                  onChange={(e) =>
                    setFormData({ ...formData, surface: Number(e.target.value) })
                  }
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g., 7.49"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Volume (m³)
                </label>
                <input
                  type="number"
                  value={formData.volume}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
              </div>
            </div>
          </div>

          {/* Quantity Installed */}
          <div className="bg-gradient-to-br from-orange-50 to-white border-2 border-orange-600 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
              📊 Quantity Installed
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Weight Installed (Kg)
                </label>
                <input
                  type="number"
                  value={formData.weightInstalled}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono font-bold"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated from volume × density</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Quantity Installed
                </label>
                <input
                  type="number"
                  value={formData.qtyInstalled}
                  onChange={(e) =>
                    setFormData({ ...formData, qtyInstalled: Number(e.target.value) })
                  }
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Unit *
                </label>
                <select
                  value={formData.unitInstalled}
                  onChange={(e) =>
                    setFormData({ ...formData, unitInstalled: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="Kgs">Kgs</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Roll">Roll</option>
                  <option value="m²">m²</option>
                  <option value="m³">m³</option>
                  <option value="Lembar">Lembar</option>
                  <option value="Unit">Unit</option>
                </select>
              </div>
            </div>
          </div>

          {/* Delivery Quantity (with Reserve) */}
          <div className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-600 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
              🚚 Delivery Quantity (with Reserve/Wastage)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Reserve (%) *
                </label>
                <input
                  type="number"
                  value={formData.reversePercent}
                  onChange={(e) =>
                    setFormData({ ...formData, reversePercent: Number(e.target.value) })
                  }
                  required
                  min="0"
                  max="100"
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Usually 10%</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Unit Size (Kg/Bag)
                </label>
                <input
                  type="number"
                  value={formData.unitSize}
                  onChange={(e) =>
                    setFormData({ ...formData, unitSize: Number(e.target.value) })
                  }
                  min="0"
                  step="1"
                  placeholder="e.g., 25"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">For packaging calculation</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Quantity Delivery
                </label>
                <input
                  type="number"
                  value={formData.qtyDelivery}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-purple-50 text-purple-900 font-mono font-bold text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Installed + Reserve</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Unit Delivery
                </label>
                <input
                  type="text"
                  value={formData.unitDelivery}
                  onChange={(e) =>
                    setFormData({ ...formData, unitDelivery: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-lg">📝 Notes</h3>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes, special requirements, etc..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-gray-900 text-white rounded-lg hover:from-red-700 hover:to-black transition-colors flex items-center gap-2 font-bold"
            >
              <Save size={18} />
              {editingIndex !== null ? "Update Material" : "Simpan Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
