import { useState } from "react";
import { X, Save, Wrench } from "lucide-react";

export interface Consumable {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  category: "Tools" | "Safety" | "Other";
}

interface ConsumableModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (consumable: Consumable) => void;
  editingItem?: Consumable | null;
}

export function ConsumableModal({
  show,
  onClose,
  onSave,
  editingItem,
}: ConsumableModalProps) {
  const [form, setForm] = useState<Consumable>(
    editingItem || {
      id: "",
      itemName: "",
      quantity: 1,
      unit: "",
      category: "Tools",
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      id: form.id || `con-${Date.now()}`,
    });
    onClose();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Tools":
        return "bg-blue-100 text-blue-700";
      case "Safety":
        return "bg-red-100 text-red-700";
      case "Other":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-orange-600 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench size={24} />
            <h3 className="text-xl font-bold">
              {editingItem
                ? "Edit Consumable"
                : "Tambah Consumable"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto flex-1"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2 font-semibold">
                Item Name{" "}
                <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.itemName || ""}
                onChange={(e) =>
                  setForm({ ...form, itemName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., Kawat Las, Helm Safety, Sarung Tangan"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-semibold">
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    "Tools",
                    "Safety",
                    "Other",
                  ] as const
                ).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, category })
                    }
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      form.category === category
                        ? getCategoryColor(category) +
                          " ring-2 ring-offset-2 ring-orange-500"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Quantity{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity || 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Unit <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="unit-options"
                    value={form.unit || ""}
                    onChange={(e) =>
                      setForm({ ...form, unit: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Pilih atau ketik satuan (kg, pcs...)"
                    required
                  />
                  <datalist id="unit-options">
                    <option value="pcs" />
                    <option value="set" />
                    <option value="kg" />
                    <option value="gram" />
                    <option value="liter" />
                    <option value="ml" />
                    <option value="box" />
                    <option value="roll" />
                    <option value="m" />
                    <option value="m2" />
                    <option value="m3" />
                    <option value="pasang" />
                    <option value="unit" />
                    <option value="sak" />
                    <option value="pail" />
                    <option value="can" />
                    <option value="btl" />
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold flex items-center gap-2"
            >
              <Save size={18} />
              {editingItem ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}