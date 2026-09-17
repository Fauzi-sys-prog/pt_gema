import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Plus,
  X,
  Search,
  Upload,
  Clock,
  Eye,
  Tag,
  Trash2,
  Edit3,
  ChevronDown,
  PlayCircle,
  Film,
  Users,
  Loader2,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

type BackendRole =
  | "OWNER"
  | "SPV"
  | "ADMIN"
  | "MANAGER"
  | "FINANCE_ACCOUNTING"
  | "SALES_MARKETING"
  | "OPERATIONAL_PRODUCTION"
  | "HR"
  | "HSE"
  | "PURCHASING"
  | "USER"
  | "PRODUKSI"
  | "SALES"
  | "FINANCE"
  | "SUPPLY_CHAIN"
  | "WAREHOUSE"
  | "OPERATIONS"
  | "ADMIN_PENAWARAN";

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  originalFileName?: string;
  storedFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  allRoles: boolean;
  allowedRoles: BackendRole[];
  views: number;
  createdAt: string;
  updatedAt?: string;
}

type FormState = {
  title: string;
  description: string;
  category: string;
  allRoles: boolean;
  allowedRoles: BackendRole[];
};

const CATEGORIES = [
  "Semua",
  "Produksi",
  "HRD",
  "Keuangan",
  "Proyek",
  "Pengadaan",
  "Sales & Marketing",
  "HSE",
  "Umum",
  "Lainnya",
];

const ROLE_OPTIONS: Array<{ value: BackendRole; label: string }> = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "SPV", label: "SPV" },
  { value: "FINANCE_ACCOUNTING", label: "Finance & Accounting" },
  { value: "SALES_MARKETING", label: "Sales & Marketing" },
  { value: "OPERATIONAL_PRODUCTION", label: "Operasional & Produksi" },
  { value: "HR", label: "HR" },
  { value: "HSE", label: "HSE" },
  { value: "PURCHASING", label: "Purchasing" },
  { value: "SUPPLY_CHAIN", label: "Supply Chain" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "PRODUKSI", label: "Produksi" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "FINANCE", label: "Finance" },
  { value: "SALES", label: "Sales" },
  { value: "ADMIN_PENAWARAN", label: "Admin Penawaran" },
  { value: "USER", label: "User" },
];

const MANAGE_ROLES = new Set<BackendRole>([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SPV",
]);

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "Lainnya",
  allRoles: true,
  allowedRoles: [],
};

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0);
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

export default function VideoTutorialPage() {
  const { currentUser } = useAuth();

  const backendRole = currentUser?.backendRole as BackendRole | undefined;
  const canManage = !!backendRole && MANAGE_ROLES.has(backendRole);

  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Semua");
  const [playing, setPlaying] = useState<VideoTutorial | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VideoTutorial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const rows = await api.request<VideoTutorial[]>(
        `/video-tutorials${canManage ? "?manage=1" : ""}`,
      );
      setVideos(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil Video Tutorial",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVideos();
  }, [canManage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return videos.filter((video) => {
      const matchCategory = cat === "Semua" || video.category === cat;
      const matchSearch =
        !q ||
        video.title.toLowerCase().includes(q) ||
        video.description?.toLowerCase().includes(q) ||
        video.category.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [videos, search, cat]);

  const counts = useMemo(() => {
    return CATEGORIES.reduce<Record<string, number>>((acc, category) => {
      acc[category] =
        category === "Semua"
          ? videos.length
          : videos.filter((video) => video.category === category).length;
      return acc;
    }, {});
  }, [videos]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSelectedFile(null);
    setShowForm(true);
  };

  const openEdit = (video: VideoTutorial) => {
    setEditTarget(video);
    setSelectedFile(null);
    setForm({
      title: video.title,
      description: video.description || "",
      category: video.category || "Lainnya",
      allRoles: video.allRoles === true,
      allowedRoles: Array.isArray(video.allowedRoles)
        ? video.allowedRoles
        : [],
    });
    setShowForm(true);
  };

  const toggleRole = (role: BackendRole) => {
    setForm((current) => {
      const selected = current.allowedRoles.includes(role);

      return {
        ...current,
        allRoles: false,
        allowedRoles: selected
          ? current.allowedRoles.filter((item) => item !== role)
          : [...current.allowedRoles, role],
      };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Judul video wajib diisi");
      return;
    }

    if (!form.category.trim()) {
      toast.error("Kategori wajib dipilih");
      return;
    }

    if (!form.allRoles && form.allowedRoles.length === 0) {
      toast.error("Pilih minimal satu role atau gunakan Semua Role");
      return;
    }

    if (!editTarget && !selectedFile) {
      toast.error("File video wajib dipilih");
      return;
    }

    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("description", form.description.trim());
    data.append("category", form.category);
    data.append("allRoles", String(form.allRoles));
    data.append(
      "allowedRoles",
      JSON.stringify(form.allRoles ? [] : form.allowedRoles),
    );

    if (selectedFile) {
      data.append("video", selectedFile);
    }

    setSaving(true);

    try {
      if (editTarget) {
        const updated = await api.request<VideoTutorial>(
          `/video-tutorials/${editTarget.id}`,
          {
            method: "PATCH",
            body: data,
          },
        );

        setVideos((current) =>
          current.map((video) =>
            video.id === updated.id ? updated : video,
          ),
        );

        toast.success("Video berhasil diperbarui");
      } else {
        const created = await api.request<VideoTutorial>(
          "/video-tutorials",
          {
            method: "POST",
            body: data,
          },
        );

        setVideos((current) => [created, ...current]);
        toast.success("Video berhasil ditambahkan");
      }

      setShowForm(false);
      setEditTarget(null);
      setSelectedFile(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan Video Tutorial",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (video: VideoTutorial) => {
    if (
      !window.confirm(
        `Hapus video "${video.title}"?\n\nFile video juga akan dihapus dari server.`,
      )
    ) {
      return;
    }

    try {
      await api.request<{ message: string }>(
        `/video-tutorials/${video.id}`,
        {
          method: "DELETE",
        },
      );

      setVideos((current) =>
        current.filter((item) => item.id !== video.id),
      );

      if (playing?.id === video.id) {
        setPlaying(null);
      }

      toast.success("Video berhasil dihapus");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus Video Tutorial",
      );
    }
  };

  const handlePlay = async (video: VideoTutorial) => {
    setPlaying(video);

    const roleCanView =
      video.allRoles ||
      (!!backendRole && video.allowedRoles?.includes(backendRole));

    if (!roleCanView) return;

    try {
      const result = await api.request<{ id: string; views: number }>(
        `/video-tutorials/${video.id}/view`,
        {
          method: "POST",
        },
      );

      setVideos((current) =>
        current.map((item) =>
          item.id === video.id
            ? { ...item, views: result.views }
            : item,
        ),
      );

      setPlaying((current) =>
        current?.id === video.id
          ? { ...current, views: result.views }
          : current,
      );
    } catch {
      // playback tetap jalan meskipun update counter gagal
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className="px-6 pt-8 pb-8"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)",
        }}
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.2)",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                <Film size={22} className="text-indigo-300" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Video Tutorial
                </h1>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "#64748b" }}
                >
                  Panduan penggunaan sistem dalam format video
                </p>
              </div>
            </div>

            {canManage && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 shrink-0"
                style={{
                  background: "#4f46e5",
                  boxShadow: "0 4px 14px rgba(79,70,229,0.4)",
                }}
              >
                <Plus size={15} />
                Tambah Video
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              {
                label: "Total Video",
                val: videos.length,
                clr: "#a5b4fc",
              },
              {
                label: "Total Ditonton",
                val: videos.reduce(
                  (sum, video) => sum + Number(video.views || 0),
                  0,
                ),
                clr: "#6ee7b7",
              },
              {
                label: "Kategori",
                val: new Set(videos.map((video) => video.category)).size,
                clr: "#fde68a",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="px-4 py-2 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "#475569" }}
                >
                  {stat.label}{" "}
                </span>
                <span
                  className="text-sm font-black ml-1"
                  style={{ color: stat.clr }}
                >
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="bg-white border-b border-slate-100 sticky top-0 z-20"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setCat(category)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border ${
                  cat === category
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                }`}
              >
                {category}

                {(counts[category] || 0) > 0 && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      cat === category
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {counts[category]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari video..."
              className="w-full pl-8 pr-4 py-2 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="py-32 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm font-bold">
              Memuat Video Tutorial...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
              <PlayCircle size={36} className="text-slate-300" />
            </div>

            <div className="text-center">
              <p className="text-base font-black text-slate-300 uppercase italic">
                Belum ada video
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {canManage
                  ? "Tambah video tutorial pertama"
                  : "Belum ada tutorial untuk role kamu"}
              </p>
            </div>

            {canManage && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-500 transition-all mt-1"
              >
                <Plus size={14} />
                Tambah Video
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                canManage={canManage}
                onPlay={handlePlay}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3 px-1">
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  {playing.category}
                </span>

                <p className="text-base font-black text-white mt-0.5 leading-tight">
                  {playing.title}
                </p>
              </div>

              <button
                onClick={() => setPlaying(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all shrink-0 mt-0.5"
              >
                <X size={15} />
              </button>
            </div>

            <div
              className="rounded-2xl overflow-hidden bg-black"
              style={{ aspectRatio: "16/9" }}
            >
              <video
                key={playing.videoUrl}
                src={playing.videoUrl}
                crossOrigin="use-credentials"
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-3 px-1">
              {playing.description && (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {playing.description}
                </p>
              )}

              <div className="flex gap-3 mt-2 text-[11px] text-slate-500 font-bold">
                <span className="flex items-center gap-1">
                  <Eye size={11} />
                  {playing.views || 0} ditonton
                </span>

                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {fmtDate(playing.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh]"
            style={{
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {editTarget ? "Edit Video" : "Tambah Video Baru"}
                </p>

                <p className="text-base font-black text-slate-900 mt-0.5">
                  {editTarget
                    ? "Perbarui video dan target role"
                    : "Upload video tutorial dari komputer"}
                </p>
              </div>

              <button
                disabled={saving}
                onClick={() => setShowForm(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  File Video{" "}
                  {!editTarget && (
                    <span className="text-red-500">*</span>
                  )}
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  className="hidden"
                  onChange={(event) =>
                    setSelectedFile(
                      event.target.files?.[0] || null,
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-2xl p-5 transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Upload size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-700">
                        {selectedFile
                          ? selectedFile.name
                          : editTarget
                            ? "Ganti file video (opsional)"
                            : "Pilih file video"}
                      </p>

                      <p className="text-[11px] text-slate-400 mt-1">
                        MP4 atau WebM
                        {selectedFile
                          ? ` • ${formatBytes(selectedFile.size)}`
                          : editTarget?.originalFileName
                            ? ` • Saat ini: ${editTarget.originalFileName}`
                            : ""}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Judul <span className="text-red-500">*</span>
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Cara Input Laporan Produksi Harian"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Kategori
                </label>

                <div className="relative">
                  <Tag
                    size={13}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {CATEGORIES.filter(
                      (category) => category !== "Semua",
                    ).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Deskripsi
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Jelaskan singkat isi video ini..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none resize-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-slate-400" />
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Video Untuk Role
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      allRoles: !current.allRoles,
                      allowedRoles: [],
                    }))
                  }
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-black text-left transition-all ${
                    form.allRoles
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Semua Role
                  <span className="block text-[10px] font-medium mt-0.5 opacity-70">
                    Video dapat dilihat seluruh user yang login
                  </span>
                </button>

                {!form.allRoles && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {ROLE_OPTIONS.map((role) => {
                      const active = form.allowedRoles.includes(
                        role.value,
                      );

                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => toggleRole(role.value)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                            active
                              ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!form.allRoles &&
                  form.allowedRoles.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-bold mt-2">
                      Pilih minimal satu role.
                    </p>
                  )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "#4f46e5" }}
                >
                  {saving && (
                    <Loader2 size={14} className="animate-spin" />
                  )}

                  {editTarget
                    ? "Simpan Perubahan"
                    : "Upload Video"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCard({
  video,
  canManage,
  onPlay,
  onEdit,
  onDelete,
}: {
  video: VideoTutorial;
  canManage: boolean;
  onPlay: (video: VideoTutorial) => void;
  onEdit: (video: VideoTutorial) => void;
  onDelete: (video: VideoTutorial) => void;
}) {
  const CAT_COLORS: Record<string, [string, string]> = {
    Produksi: ["#eff6ff", "#3b82f6"],
    HRD: ["#f0fdf4", "#16a34a"],
    Keuangan: ["#fffbeb", "#d97706"],
    Proyek: ["#fdf4ff", "#9333ea"],
    Pengadaan: ["#fff1f2", "#e11d48"],
    "Sales & Marketing": ["#fff7ed", "#ea580c"],
    HSE: ["#ecfeff", "#0891b2"],
    Umum: ["#eef2ff", "#4f46e5"],
    Lainnya: ["#f1f5f9", "#64748b"],
  };

  const [categoryBackground, categoryForeground] =
    CAT_COLORS[video.category] || CAT_COLORS.Lainnya;

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden group hover:border-indigo-200 hover:shadow-lg transition-all"
      style={{
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{ aspectRatio: "16/9" }}
        onClick={() => onPlay(video)}
      >
        <video
          src={video.videoUrl}
          crossOrigin="use-credentials"
          preload="metadata"
          muted
          playsInline
          className="w-full h-full object-cover bg-slate-950"
        />

        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
            <Play size={22} className="text-indigo-700 ml-1" />
          </div>
        </div>

        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[9px] font-black">
          VIDEO
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: categoryBackground,
              color: categoryForeground,
            }}
          >
            {video.category}
          </span>

          {canManage && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onEdit(video)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Edit"
              >
                <Edit3 size={12} />
              </button>

              <button
                onClick={() => onDelete(video)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Hapus"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        <h3
          className="text-sm font-black text-slate-900 leading-snug line-clamp-2 cursor-pointer hover:text-indigo-700 transition-colors"
          onClick={() => onPlay(video)}
        >
          {video.title}
        </h3>

        {video.description && (
          <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {video.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-slate-50">
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Eye size={10} />
            {video.views || 0}
          </span>

          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Clock size={10} />
            {fmtDate(video.createdAt)}
          </span>

          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 min-w-0">
            <Users size={10} />
            <span className="truncate max-w-[180px]">
              {video.allRoles
                ? "Semua Role"
                : video.allowedRoles
                    ?.map(roleLabel)
                    .join(", ") || "-"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
