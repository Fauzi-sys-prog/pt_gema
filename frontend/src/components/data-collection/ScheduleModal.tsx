import { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';

export interface Schedule {
  id: string;
  activity: string;
  startDate: string;
  endDate: string;
  duration: number;
  dependencies?: string[];
  status: 'Not Started' | 'In Progress' | 'Completed';
}

interface ScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (schedule: Schedule) => void;
  editingItem?: Schedule | null;
  allSchedules?: Schedule[];
}

export function ScheduleModal({ show, onClose, onSave, editingItem, allSchedules = [] }: ScheduleModalProps) {
  const [form, setForm] = useState<Schedule>(editingItem || {
    id: '',
    activity: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    duration: 1,
    dependencies: [],
    status: 'Not Started'
  });

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleStartDateChange = (value: string) => {
    setForm(prev => {
      const duration = calculateDuration(value, prev.endDate);
      return { ...prev, startDate: value, duration };
    });
  };

  const handleEndDateChange = (value: string) => {
    setForm(prev => {
      const duration = calculateDuration(prev.startDate, value);
      return { ...prev, endDate: value, duration };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      id: form.id || `sch-${Date.now()}`
    });
    onClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-100 text-gray-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg w-full max-w-2xl mx-4 z-[70] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-green-600 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={24} />
            <h3 className="text-xl font-bold">
              {editingItem ? 'Edit Schedule' : 'Tambah Schedule'}
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
                Activity/Kegiatan <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.activity || ''}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Mobilisasi, Pembongkaran, Pemasangan"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Start Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  End Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={form.endDate || ''}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  min={form.startDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-semibold">Duration:</span>
                <span className="text-2xl font-bold text-green-600">
                  {form.duration} Hari
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {new Date(form.startDate).toLocaleDateString('id-ID')} s/d {new Date(form.endDate).toLocaleDateString('id-ID')}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-semibold">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Not Started', 'In Progress', 'Completed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm({ ...form, status })}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      form.status === status
                        ? getStatusColor(status) + ' ring-2 ring-offset-2 ring-green-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {allSchedules.length > 0 && (
              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Dependencies (Optional)
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                  {allSchedules.filter(s => s.id !== form.id).map((schedule) => (
                    <label key={schedule.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.dependencies?.includes(schedule.id) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(prev => ({
                              ...prev,
                              dependencies: [...(prev.dependencies || []), schedule.id]
                            }));
                          } else {
                            setForm(prev => ({
                              ...prev,
                              dependencies: (prev.dependencies || []).filter(id => id !== schedule.id)
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{schedule.activity}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
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
