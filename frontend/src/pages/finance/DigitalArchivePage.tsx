import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Search,
  Download,
  Eye,
  X,
  Filter,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Database,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../../contexts/AppContext";
import type { ArchiveEntry } from "../../contexts/AppContext";
import api from "../../services/api";
import { toast } from "sonner@2.0.3";

export default function DigitalArchivePage() {
  const { archiveRegistry, addAuditLog, currentUser } = useApp();
  const [serverArchiveRegistry, setServerArchiveRegistry] = useState<ArchiveEntry[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"visual" | "data">("data");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"All" | "AR" | "AP" | "PETTY" | "BK">("All");
  const effectiveArchiveRegistry = serverArchiveRegistry ?? archiveRegistry;

  const fetchArchiveRegistry = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get("/archive-registry");
      const rows = Array.isArray(response.data) ? response.data : [];
      const items = rows as ArchiveEntry[];
      setServerArchiveRegistry(items);
    } catch {
      setServerArchiveRegistry(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArchiveRegistry();
  }, []);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return effectiveArchiveRegistry.filter((item) => {
      const matchesSearch =
        item.description.toLowerCase().includes(q) ||
        item.ref.toLowerCase().includes(q) ||
        item.project.toLowerCase().includes(q);
      const matchesType = filterType === "All" || item.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [effectiveArchiveRegistry, searchQuery, filterType]);

  const selectedDoc = useMemo(
    () => filteredData.find((d) => d.id === selectedDocId) ?? null,
    [filteredData, selectedDocId],
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);

  const totalAmount = useMemo(
    () => filteredData.reduce((sum, item) => sum + item.amount, 0),
    [filteredData],
  );

  const handleExportAudit = async () => {
    if (filteredData.length === 0) {
      toast.info("Tidak ada data arsip untuk diekspor.");
      return;
    }
    const rows = [
      ["Date", "Ref", "Description", "Project", "Amount", "Type", "Admin", "Source"],
      ...filteredData.map((item) => [
        item.date,
        item.ref,
        item.description,
        item.project,
        item.amount,
        item.type,
        item.admin,
        item.source,
      ]),
    ];
    const dateKey = new Date().toISOString().slice(0, 10);
    const payload = {
      filename: `digital-archive-${dateKey}`,
      title: "Digital Archive Ledger Report",
      subtitle: `Tanggal ${dateKey} | Tipe ${filterType} | Total dokumen ${filteredData.length}`,
      columns: rows[0],
      rows: rows.slice(1),
      notes: `Ringkasan arsip: total nilai ${formatCurrency(totalAmount)}, mode tampilan ${viewMode}, export mengikuti filter pencarian dan tipe arsip yang aktif.`,
      generatedBy: currentUser?.fullName || currentUser?.username || "Finance Archive",
    };
    try {
      const [excelRes, wordRes] = await Promise.all([
        api.post("/exports/tabular-report/excel", payload, { responseType: "blob" }),
        api.post("/exports/tabular-report/word", payload, { responseType: "blob" }),
      ]);

      const excelUrl = URL.createObjectURL(new Blob([excelRes.data], { type: "application/vnd.ms-excel" }));
      const excelLink = document.createElement("a");
      excelLink.href = excelUrl;
      excelLink.download = `digital-archive-${dateKey}.xls`;
      document.body.appendChild(excelLink);
      excelLink.click();
      document.body.removeChild(excelLink);
      URL.revokeObjectURL(excelUrl);

      const wordUrl = URL.createObjectURL(new Blob([wordRes.data], { type: "application/msword" }));
      const wordLink = document.createElement("a");
      wordLink.href = wordUrl;
      wordLink.download = `digital-archive-${dateKey}.doc`;
      document.body.appendChild(wordLink);
      wordLink.click();
      document.body.removeChild(wordLink);
      URL.revokeObjectURL(wordUrl);

      addAuditLog({
        action: "DIGITAL_ARCHIVE_EXPORTED",
        module: "Finance",
        details: `Export digital archive (${filteredData.length} baris)`,
        status: "Success",
      });
      toast.success("Arsip digital Word + Excel berhasil diekspor.");
    } catch {
      toast.error("Export arsip digital gagal.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arsip Digital Ledger</h1>
          <p className="text-gray-500 italic font-medium">
            PT Gema Teknik Perkasa • Digital Sovereignty Platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode("visual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                viewMode === "visual" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
              }`}
            >
              <ImageIcon size={14} /> Visual
            </button>
            <button
              onClick={() => setViewMode("data")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                viewMode === "data" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
              }`}
            >
              <Database size={14} /> Data Registry
            </button>
          </div>
          <button onClick={handleExportAudit} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-black transition-all shadow-lg text-xs font-black uppercase tracking-widest">
            <Download size={16} />
            <span>Ekspor Audit</span>
          </button>
          <button
            onClick={fetchArchiveRegistry}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white text-slate-700 px-6 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Database size={16} className={isRefreshing ? "animate-pulse" : ""} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari dokumen..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          >
            <option value="All">Semua Tipe</option>
            <option value="AR">Piutang (AR)</option>
            <option value="AP">Hutang (AP)</option>
            <option value="PETTY">Petty Cash</option>
            <option value="BK">Bank</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Total Dokumen</p>
          <p className="text-2xl font-black text-gray-900">{filteredData.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Total Nilai</p>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-bold">Sumber Data</p>
          <p className="text-sm font-black text-blue-600 uppercase">Database Archive Registry</p>
        </div>
      </div>

      {viewMode === "visual" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredData.map((doc) => (
            <motion.button
              key={doc.id}
              layoutId={`doc-${doc.id}`}
              className="text-left bg-white rounded-xl border border-gray-200 overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
              onClick={() => setSelectedDocId(doc.id)}
            >
              <div className="aspect-[4/3] relative bg-slate-50 p-4 border-b border-gray-100 flex items-center justify-center">
                <FileText className="text-slate-400" size={38} />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm bg-blue-600 text-white">
                    {doc.type}
                  </span>
                </div>
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white p-2 rounded-full text-blue-600 shadow-lg">
                    <Eye size={22} />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-bold text-gray-900 truncate uppercase italic text-xs">{doc.ref}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{doc.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                    <Calendar size={12} />
                    <span>{doc.date}</span>
                  </div>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic">Reference No</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic">Description</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic">Project</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic text-right">Amount (IDR)</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest italic text-center">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 text-[11px] font-bold text-gray-500">{item.date}</td>
                    <td className="px-6 py-4 text-[11px] font-black text-blue-600 uppercase italic">{item.ref}</td>
                    <td className="px-6 py-4 text-[11px] font-black text-gray-900 uppercase italic">{item.description}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[9px] font-black uppercase italic tracking-tighter">
                        {item.project}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-black text-gray-900 text-right italic">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-center text-[10px] font-bold text-gray-400 uppercase italic">{item.admin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedDocId(null)}
            />
            <motion.div
              layoutId={`doc-${selectedDoc.id}`}
              className="relative bg-white w-full max-w-3xl rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedDoc.ref}</h2>
                  <p className="text-xs text-gray-500">{selectedDoc.type} • {selectedDoc.date}</p>
                </div>
                <button
                  onClick={() => setSelectedDocId(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm"><span className="font-bold">Description:</span> {selectedDoc.description}</p>
                <p className="text-sm"><span className="font-bold">Project:</span> {selectedDoc.project}</p>
                <p className="text-sm"><span className="font-bold">Amount:</span> {formatCurrency(selectedDoc.amount)}</p>
                <p className="text-sm"><span className="font-bold">Source:</span> {selectedDoc.source}</p>
                <p className="text-sm"><span className="font-bold">Admin:</span> {selectedDoc.admin}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl flex items-start gap-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
          <AlertCircle size={24} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-lg">Protokol Digitalisasi Dokumen</h4>
          <p className="text-blue-800/80 mt-1">
            Halaman ini sekarang sepenuhnya membaca data dari tabel archive registry, tidak dari file dummy statis.
          </p>
        </div>
      </div>
    </div>
  );
}
