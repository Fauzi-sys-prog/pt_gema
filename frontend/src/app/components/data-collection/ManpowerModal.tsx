import { useState } from 'react';
import { X, Save, Users } from 'lucide-react';

export interface Manpower {
  id: string;
  position: string;
  assignedPerson?: string; // Optional: Nama personil spesifik
  quantity: number;
  duration: number;
  notes?: string;
}

interface ManpowerModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (manpower: Manpower) => void;
  editingItem?: Manpower | null;
}

export function ManpowerModal({ show, onClose, onSave, editingItem }: ManpowerModalProps) {
  const [form, setForm] = useState<Manpower>(editingItem || {
    id: '',
    position: '',
    quantity: 1,
    duration: 1,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      id: form.id || `man-${Date.now()}`,
    });
    onClose();
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-blue-600 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={24} />
            <h3 className="text-xl font-bold">
              {editingItem ? 'Edit Manpower' : 'Tambah Manpower'}
            </h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Position/Jabatan <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={form.position || ''}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Tukang Refractory"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Personil Spesifik (Opsional)
                </label>
                <input
                  type="text"
                  value={form.assignedPerson || ''}
                  onChange={(e) => setForm({ ...form, assignedPerson: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Budi Santoso"
                />
                <p className="text-[10px] text-gray-500 mt-1">Gunakan ini untuk mengecek ketersediaan tim.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Quantity (Orang) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity || 0}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Duration (Hari) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={form.duration || 0}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-semibold">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Catatan tambahan (optional)"
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
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
