import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner@2.0.3";
import type { AppSetting, AppSettingScope } from "../../services/settingsApi";
import {
  fetchAppSettings,
  createAppSetting,
  updateAppSetting,
  deleteAppSetting,
} from "../../services/settingsApi";

const SCOPES: AppSettingScope[] = [
  "GLOBAL",
  "PROJECT",
  "PRODUCTION",
  "SUPPLY_CHAIN",
  "FINANCE",
  "HR",
  "LOGISTICS",
  "CORRESPONDENCE",
  "ASSET",
];

function newSettingDraft(): AppSetting {
  const id = `SET-${Date.now()}`;
  return {
    id,
    key: "",
    label: "",
    description: "",
    scope: "GLOBAL",
    value: {},
    isActive: true,
  };
}

export default function AppSettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<AppSetting>(newSettingDraft());

  const load = async () => {
    try {
      setLoading(true);
      const rows = await fetchAppSettings();
      setSettings(rows);
    } catch (err: any) {
      toast.error(String(err?.response?.data?.error || "Gagal load app settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return settings;
    return settings.filter((s) => {
      return (
        s.key.toLowerCase().includes(q) ||
        String(s.label || "").toLowerCase().includes(q) ||
        String(s.scope || "").toLowerCase().includes(q)
      );
    });
  }, [settings, search]);

  const handleCreate = async () => {
    if (!draft.key.trim()) {
      toast.error("Key wajib diisi");
      return;
    }
    const optimistic = { ...draft, key: draft.key.trim() };
    setSettings((prev) => [optimistic, ...prev]);
    setDraft(newSettingDraft());
    try {
      await createAppSetting(optimistic);
      toast.success("Setting berhasil ditambahkan");
    } catch (err: any) {
      setSettings((prev) => prev.filter((x) => x.id !== optimistic.id));
      toast.error(String(err?.response?.data?.error || "Gagal menambahkan setting"));
    }
  };

  const handlePatch = async (next: AppSetting, prev: AppSetting) => {
    setSavingId(next.id);
    setSettings((all) => all.map((s) => (s.id === next.id ? next : s)));
    try {
      await updateAppSetting(next);
    } catch (err: any) {
      setSettings((all) => all.map((s) => (s.id === prev.id ? prev : s)));
      toast.error(String(err?.response?.data?.error || "Gagal menyimpan setting"));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = settings;
    setSettings((all) => all.filter((s) => s.id !== id));
    try {
      await deleteAppSetting(id);
      toast.success("Setting dihapus");
    } catch (err: any) {
      setSettings(prev);
      toast.error(String(err?.response?.data?.error || "Gagal hapus setting"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">Settings Master</h1>
          <p className="text-gray-600">Konfigurasi global sistem via endpoint dedicated `/app-settings`</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Key (e.g. feature.production.timeline)"
            value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
          />
          <input
            className="px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Label"
            value={draft.label || ""}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg"
            value={draft.scope}
            onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value as AppSettingScope }))}
          >
            {SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={2}
          placeholder="Description"
          value={draft.description || ""}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          rows={4}
          placeholder='JSON value, contoh: {"enabled":true}'
          value={typeof draft.value === "string" ? draft.value : JSON.stringify(draft.value, null, 2)}
          onChange={(e) => {
            const raw = e.target.value;
            try {
              setDraft((d) => ({ ...d, value: JSON.parse(raw) }));
            } catch {
              setDraft((d) => ({ ...d, value: raw }));
            }
          }}
        />
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Tambah Setting
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            className="w-full px-2 py-1 outline-none"
            placeholder="Cari key / label / scope"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-600">Key</th>
                <th className="px-4 py-2 text-left text-gray-600">Scope</th>
                <th className="px-4 py-2 text-left text-gray-600">Active</th>
                <th className="px-4 py-2 text-left text-gray-600">Value (JSON)</th>
                <th className="px-4 py-2 text-left text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2">
                    <input
                      value={s.key}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      onChange={(e) => setSettings((all) => all.map((x) => (x.id === s.id ? { ...x, key: e.target.value } : x)))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={s.scope}
                      className="px-2 py-1 border border-gray-300 rounded"
                      onChange={(e) =>
                        setSettings((all) => all.map((x) => (x.id === s.id ? { ...x, scope: e.target.value as AppSettingScope } : x)))
                      }
                    >
                      {SCOPES.map((scope) => (
                        <option key={scope} value={scope}>
                          {scope}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={s.isActive}
                      onChange={(e) =>
                        setSettings((all) => all.map((x) => (x.id === s.id ? { ...x, isActive: e.target.checked } : x)))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <textarea
                      className="w-full min-w-[320px] px-2 py-1 border border-gray-300 rounded font-mono text-xs"
                      rows={3}
                      value={typeof s.value === "string" ? s.value : JSON.stringify(s.value, null, 2)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        let next: unknown = raw;
                        try {
                          next = JSON.parse(raw);
                        } catch {
                          next = raw;
                        }
                        setSettings((all) => all.map((x) => (x.id === s.id ? { ...x, value: next } : x)));
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                        disabled={savingId === s.id}
                        onClick={() => {
                          const prev = settings.find((x) => x.id === s.id);
                          if (!prev) return;
                          handlePatch(s, prev);
                        }}
                      >
                        <Save size={14} />
                        Save
                      </button>
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Belum ada data settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
