import { useState } from 'react';
import { X, Save, Truck } from 'lucide-react';

export interface Equipment {
  id: string;
  equipmentName: string;
  quantity: number;
  unit: string;
  duration: number;
  supplier?: string;
}

interface EquipmentModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (equipment: Equipment) => void;
  editingItem?: Equipment | null;
}

export function EquipmentModal({ show, onClose, onSave, editingItem }: EquipmentModalProps) {
  const [form, setForm] = useState<Equipment>(editingItem || {
    id: '',
    equipmentName: '',
    quantity: 1,
    unit: 'unit',
    duration: 1,
    supplier: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      id: form.id || `eq-${Date.now()}`,
    });
    onClose();
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-purple-600 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck size={24} />
            <h3 className="text-xl font-bold">
              {editingItem ? 'Edit Equipment' : 'Tambah Equipment'}
            </h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2 font-semibold">
                Equipment Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.equipmentName || ''}
                onChange={(e) => setForm({ ...form, equipmentName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Crane 5 Ton, Genset 100 KVA, Scaffolding"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity || 0}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    list="equipment-unit-options"
                    value={form.unit || ''}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="unit/set/hari..."
                    required
                  />
                  <datalist id="equipment-unit-options">
                    <option value="unit" />
                    <option value="set" />
                    <option value="hari" />
                    <option value="jam" />
                    <option value="bulan" />
                    <option value="trip" />
                    <option value="m3" />
                    <option value="kg" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Duration (Period) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={form.duration || 0}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min="1"
                  placeholder="Durasi sewa"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-semibold">Supplier (Optional)</label>
              <input
                type="text"
                value={form.supplier || ''}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nama supplier/rental"
              />
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
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center gap-2"
            >
              <Save size={18} />
              {editingItem ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
