import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { Invoice } from '../../contexts/AppContext';
import { 
  Receipt, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  BellRing,
  Check
} from 'lucide-react';
import logoImage from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';
import { toast } from 'sonner@2.0.3';
import api from '../../services/api';

import { KwitansiTemplate } from '../../components/KwitansiTemplate';

type InvoiceResource = 'invoices' | 'customer-invoices';
type StatusFilter = 'ALL' | 'Draft' | 'Sent' | 'Unpaid' | 'Partial' | 'Overdue' | 'Paid';
type POQuickFilter = 'ALL' | 'WITH_PO' | 'WITHOUT_PO';
type NormalizedInvoice = Invoice & {
  resource: InvoiceResource;
  rawStatus: string;
};

const toNum = (v: unknown) => Number(v ?? 0) || 0;
const toDate = (v: unknown) => {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};

const mapStatus = (value: unknown): { status: Invoice['status']; raw: string } => {
  const raw = String(value || '').trim() || 'Unpaid';
  const norm = raw.toLowerCase();
  if (norm === 'paid' || norm === 'lunas') return { status: 'Paid', raw };
  if (norm === 'partial paid' || norm === 'partial') return { status: 'Partial', raw };
  return { status: 'Unpaid', raw };
};

const normalizeRow = (row: any, resource: InvoiceResource): NormalizedInvoice | null => {
  const payload = row?.payload ?? {};
  const obj = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : row;
  if (!obj || typeof obj !== 'object') return null;
  const id = String(obj.id || row?.entityId || '').trim();
  if (!id) return null;

  const customer = String((obj as any).customer || (obj as any).customerName || (obj as any).namaCustomer || '-').trim();
  const due = toDate((obj as any).jatuhTempo || (obj as any).dueDate);
  const amount = toNum((obj as any).totalBayar || (obj as any).totalNominal || (obj as any).grandTotal || (obj as any).total);
  const mapped = mapStatus((obj as any).status);
  const rawItems = Array.isArray((obj as any).items) ? (obj as any).items : [];
  const items = rawItems.map((it: any) => ({
    deskripsi: String(it?.deskripsi || it?.description || '-'),
    qty: toNum(it?.qty),
    unit: String(it?.unit || it?.satuan || 'unit'),
    hargaSatuan: toNum(it?.hargaSatuan || it?.unitPrice),
    total: toNum(it?.total || it?.jumlah),
    sourceRef: it?.sourceRef ? String(it.sourceRef) : undefined,
    batchNo: it?.batchNo ? String(it.batchNo) : undefined,
  }));

  return {
    id,
    noInvoice: String((obj as any).noInvoice || (obj as any).invoiceNumber || `INV/${id}`),
    tanggal: toDate((obj as any).tanggal || (obj as any).invoiceDate || (obj as any).createdAt) || new Date().toISOString().slice(0, 10),
    jatuhTempo: due,
    customer,
    alamat: String((obj as any).alamat || (obj as any).address || '-'),
    noPO: String((obj as any).noPO || (obj as any).poNumber || '-'),
    items,
    subtotal: toNum((obj as any).subtotal),
    ppn: toNum((obj as any).ppn),
    totalBayar: amount,
    status: mapped.status,
    projectId: (obj as any).projectId ? String((obj as any).projectId) : undefined,
    buktiTransfer: (obj as any).buktiTransfer ? String((obj as any).buktiTransfer) : undefined,
    noKwitansi: (obj as any).noKwitansi ? String((obj as any).noKwitansi) : undefined,
    tanggalBayar: toDate((obj as any).tanggalBayar) || undefined,
    resource,
    rawStatus: mapped.raw,
  };
};

export default function InvoicePage() {
  const { invoiceList, addAuditLog, addArchiveEntry, currentUser } = useApp();
  const [serverInvoiceList, setServerInvoiceList] = useState<NormalizedInvoice[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<NormalizedInvoice | null>(null);
  const [viewKwitansi, setViewKwitansi] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [poQuickFilter, setPoQuickFilter] = useState<POQuickFilter>('ALL');
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveInvoiceList = (serverInvoiceList ??
    ((invoiceList || []).map((inv) => normalizeRow(inv, 'invoices')).filter(Boolean) as NormalizedInvoice[]));
  const safeInvoiceList = (effectiveInvoiceList || []).filter(Boolean);
  const fmt = (v: unknown) => toNum(v).toLocaleString('id-ID');

  const patchInvoiceResource = async (invoice: NormalizedInvoice, updates: Record<string, unknown>) => {
    const path =
      invoice.resource === 'customer-invoices'
        ? `/finance/customer-invoices/${invoice.id}`
        : `/invoices/${invoice.id}`;
    const { data } = await api.patch(path, { ...invoice, ...updates });
    const normalized = normalizeRow(data, invoice.resource);
    if (!normalized) throw new Error('Invoice response invalid');
    setServerInvoiceList((prev) =>
      prev ? prev.map((row) => (row.id === invoice.id && row.resource === invoice.resource ? normalized : row)) : prev
    );
    return normalized;
  };

  const fetchInvoices = async () => {
    try {
      setIsRefreshing(true);
      const [invoiceRes, customerRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/finance/customer-invoices'),
      ]);
      const invoiceRows = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
      const customerRows = Array.isArray(customerRes.data) ? customerRes.data : [];
      const invoices = [
        ...invoiceRows.map((row: any) => normalizeRow(row, 'invoices')),
        ...customerRows.map((row: any) => normalizeRow(row, 'customer-invoices')),
      ].filter(Boolean) as NormalizedInvoice[];
      setServerInvoiceList(invoices);
    } catch {
      setServerInvoiceList(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchInvoices();
  }, []);

  const isOverdue = (inv: NormalizedInvoice) => {
    if (inv.status === 'Paid') return false;
    if (!inv.jatuhTempo) return false;
    const due = new Date(inv.jatuhTempo);
    if (Number.isNaN(due.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return due < now;
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasPO = (inv: NormalizedInvoice) => {
      const po = String(inv.noPO || '').trim();
      return po !== '' && po !== '-';
    };

    return safeInvoiceList.filter((inv) => {
      const overdue = isOverdue(inv);

      if (poQuickFilter === 'WITH_PO' && !hasPO(inv)) return false;
      if (poQuickFilter === 'WITHOUT_PO' && hasPO(inv)) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Overdue' && !overdue) return false;
        if (statusFilter !== 'Overdue' && inv.status !== statusFilter) return false;
      }
      if (!q) return true;
      const haystack = `${inv.noInvoice} ${inv.customer} ${inv.noPO} ${inv.projectId || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [safeInvoiceList, search, statusFilter, poQuickFilter]);

  // Aging logic
  const getAgingStats = () => {
    const unpaid = safeInvoiceList.filter((inv) => inv.status !== 'Paid');
    return {
      total: safeInvoiceList.reduce((acc, inv) => acc + toNum(inv.totalBayar), 0),
      current: unpaid.reduce((acc, inv) => acc + toNum(inv.totalBayar), 0),
      overdue: unpaid.filter((inv) => isOverdue(inv)).reduce((acc, inv) => acc + toNum(inv.totalBayar), 0),
    };
  };

  const handleProofFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!selectedInvoice || !file) return;

    const readAsDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });

    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl();
      const uploadRes = await api.post('/media/invoice-transfer-proofs', {
        resource: selectedInvoice.resource,
        invoiceId: selectedInvoice.id,
        fileName: file.name,
        dataUrl,
      });
      const publicUrl = String(uploadRes?.data?.publicUrl || '').trim();
      if (!publicUrl) throw new Error('URL bukti transfer tidak valid');
      const updated = await patchInvoiceResource(selectedInvoice, { buktiTransfer: publicUrl });
      setSelectedInvoice(updated);
      addAuditLog({
        action: "INVOICE_PROOF_UPLOADED",
        module: "Sales",
        details: `Bukti transfer diunggah untuk ${selectedInvoice.noInvoice}`,
        status: "Success",
      });
      toast.success("Bukti transfer berhasil diunggah. Menunggu verifikasi Finance.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Gagal upload bukti transfer');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleToggleReminder = () => {
    if (!selectedInvoice) return;
    addAuditLog({
      action: "INVOICE_REMINDER_SENT",
      module: "Sales",
      details: `Reminder jatuh tempo dikirim ke ${selectedInvoice.customer} (${selectedInvoice.noInvoice})`,
      status: "Success",
    });
    toast.success(`Email pengingat jatuh tempo berhasil dikirim ke ${selectedInvoice.customer}!`);
  };

  const handleVerify = async () => {
    if (selectedInvoice) {
      const kwitansiNo = `KWT/GTP/${new Date().getFullYear()}${new Date().getMonth() + 1}/0001`;
      const paidDate = new Date().toISOString().split("T")[0];
      const totalBayar = toNum(selectedInvoice.totalBayar);
      const updatedInvoice = {
        ...selectedInvoice,
        status: "Paid" as const,
        paidAmount: totalBayar,
        outstandingAmount: 0,
        noKwitansi: kwitansiNo,
        tanggalBayar: paidDate,
      };

      try {
        await patchInvoiceResource(selectedInvoice, {
          status: 'Paid',
          paidAmount: totalBayar,
          outstandingAmount: 0,
          noKwitansi: kwitansiNo,
          tanggalBayar: paidDate
        });
      } catch {
        return;
      }
      setSelectedInvoice({
        ...updatedInvoice,
        status: 'Paid',
        paidAmount: totalBayar,
        outstandingAmount: 0,
        noKwitansi: kwitansiNo,
        tanggalBayar: paidDate,
      });

      addArchiveEntry({
        date: paidDate,
        ref: kwitansiNo,
        description: `Pelunasan invoice ${selectedInvoice.noInvoice}`,
        amount: selectedInvoice.totalBayar || 0,
        project: selectedInvoice.projectId || selectedInvoice.customer || "General",
        admin: currentUser?.fullName || currentUser?.username || "System",
        type: "AR",
        source: `invoice-payment|invoiceId=${selectedInvoice.id}`,
      });

      addAuditLog({
        action: "INVOICE_VERIFIED_PAID",
        module: "Finance",
        details: `Invoice ${selectedInvoice.noInvoice} diverifikasi lunas`,
        status: "Success",
      });

      toast.success('Invoice Berhasil Diverifikasi! Kwitansi Otomatis Terbit.');
      setViewKwitansi(true);
    }
  };

  if (selectedInvoice && viewKwitansi) {
    return <KwitansiTemplate invoice={selectedInvoice} onBack={() => setViewKwitansi(false)} />;
  }

  if (selectedInvoice) {
    return (
      <div className="bg-slate-50 min-h-screen p-4 md:p-8">
        <input
          ref={proofInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleProofFileChange(e)}
        />
        <div className="max-w-6xl mx-auto mb-6 flex flex-wrap justify-between items-center gap-4 print:hidden">
          <button 
            onClick={() => setSelectedInvoice(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors"
          >
            <ArrowLeft size={18} /> Kembali ke Daftar
          </button>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleToggleReminder}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              <BellRing size={16} className="text-orange-500" /> Aktifkan Pengingat
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black shadow-lg transition-all">
              <Printer size={18} /> Cetak Invoice
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invoice Paper */}
          <div className="lg:col-span-2 bg-white shadow-2xl p-[15mm] min-h-[297mm] text-slate-900 font-sans print:shadow-none print:p-0">
            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
              <div className="flex items-center gap-4">
                <img src={logoImage} alt="GM Teknik" className="w-16 h-16 object-contain" />
                <div>
                  <h1 className="text-2xl font-black text-red-600 leading-none">PT. GEMA TEKNIK PERKASA</h1>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">General Contractor & Maintenance Services</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Jl. Raya Industri, Bekasi - Jawa Barat</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">INVOICE</h2>
                <p className="text-sm font-black text-blue-600 mt-1">{selectedInvoice.noInvoice}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ditagihkan Kepada:</p>
                <p className="font-black text-lg uppercase">{selectedInvoice.customer}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{selectedInvoice.alamat}</p>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">No. PO Customer:</p>
                  <p className="text-sm font-black text-slate-900">{selectedInvoice.noPO}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="space-y-2">
                  <div className="flex justify-end gap-4 text-sm">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Tanggal:</span>
                    <span className="font-black">{new Date(selectedInvoice.tanggal).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex justify-end gap-4 text-sm">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Jatuh Tempo:</span>
                    <span className="font-black text-rose-600">{new Date(selectedInvoice.jatuhTempo).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full mb-12">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Deskripsi Item</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest w-24">Qty</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest w-40">Harga Satuan</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest w-40">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                {(Array.isArray((selectedInvoice as any)?.items) ? (selectedInvoice as any).items : []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-6">
                      <p className="font-black text-slate-900">{item.deskripsi}</p>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <p className="text-sm font-bold text-slate-600">{item.qty} {item.unit}</p>
                    </td>
                    <td className="px-4 py-6 text-right font-medium">
                      Rp {fmt(item.hargaSatuan)}
                    </td>
                    <td className="px-4 py-6 text-right font-black">
                      Rp {fmt(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-80 space-y-3">
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>SUBTOTAL</span>
                  <span>Rp {fmt(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>PPN (11%)</span>
                  <span>Rp {fmt(toNum(selectedInvoice.subtotal) * 0.11)}</span>
                </div>
                <div className="flex justify-between p-4 bg-slate-900 text-white rounded-xl">
                  <span className="font-black text-xs uppercase tracking-widest">Grand Total</span>
                  <span className="text-lg font-black italic">Rp {fmt(selectedInvoice.totalBayar)}</span>
                </div>
              </div>
            </div>

            <div className="mt-20 grid grid-cols-2 gap-12">
              <div className="p-6 border-2 border-slate-50 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 italic">Informasi Pembayaran:</p>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">Bank Mandiri</p>
                  <p className="text-xs font-bold text-slate-600">A/N PT. Gema Teknik Perkasa</p>
                  <p className="text-base font-black text-blue-600 tracking-widest">156-00-XXXXXXXX-X</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-black mb-24 uppercase">Hormat Kami,</p>
                <p className="font-black text-lg border-b-2 border-slate-900 inline-block px-8 pb-1 uppercase">SYAMSUDIN</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Direktur Utama</p>
              </div>
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="space-y-6 print:hidden">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Status Verifikasi Pembayaran</h3>
              
              {!selectedInvoice.buktiTransfer ? (
                <div className="space-y-6">
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center group hover:border-blue-500 transition-all">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all mb-4">
                      <Upload size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-900">Belum Ada Bukti</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-relaxed">
                      Klik tombol dibawah untuk mengunggah bukti transfer customer
                    </p>
                  </div>
                  <button 
                    onClick={() => proofInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                  >
                    {uploading ? 'Mengunggah...' : 'Upload Bukti Transfer'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-100 aspect-[3/4] bg-slate-900">
                    <img 
                      src={selectedInvoice.buktiTransfer} 
                      alt="Proof" 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon size={32} className="mb-2" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Lihat Foto</span>
                    </div>
                  </div>
                  
                  {selectedInvoice.status === 'Unpaid' ? (
                    <button 
                      onClick={() => { void handleVerify(); }}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
                    >
                      <Check size={18} /> Verifikasi & Tandai Lunas
                    </button>
                  ) : (
                    <button 
                      onClick={() => setViewKwitansi(true)}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black shadow-lg transition-all"
                    >
                      <Receipt size={18} /> Lihat Kwitansi Resmi
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 italic underline">Log Keuangan:</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-black italic uppercase">Invoice Diterbitkan</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">25 Okt 2025 - System</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                    <BellRing size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-black italic uppercase text-slate-500">Reminder Scheduled</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">21 Nov 2025 - Auto</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = getAgingStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Invoice & Accounts Receivable</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Financial Billing Management</p>
          </div>
        </div>
        <button
          onClick={() => void fetchInvoices()}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Unpaid Invoices', value: `Rp ${(stats.current / 1000000).toFixed(1)}M`, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total Billed', value: `Rp ${(stats.total / 1000000).toFixed(1)}M`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Overdue (Est)', value: `Rp ${(stats.overdue / 1000000).toFixed(1)}M`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Invoice Count', value: safeInvoiceList.length.toString(), icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="relative w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Invoice atau Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                { key: 'ALL' as const, label: 'All' },
                { key: 'WITH_PO' as const, label: 'With PO' },
                { key: 'WITHOUT_PO' as const, label: 'Without PO' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPoQuickFilter(opt.key)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    poQuickFilter === opt.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 bg-slate-50 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 border border-slate-200"
              >
                <option value="ALL">Semua</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Overdue">Overdue</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">No. Invoice</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer / Project</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Tagihan</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.map((inv) => (
                <tr 
                  key={inv.id} 
                  className="group hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-blue-600 tracking-tighter">{inv.noInvoice}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        {inv.tanggal ? new Date(inv.tanggal).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{inv.customer}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">PO: {inv.noPO}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-black text-slate-900 italic">Rp {fmt(inv.totalBayar)}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                      inv.status === 'Paid'
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                        : isOverdue(inv)
                        ? 'text-rose-600 bg-rose-50 border-rose-100'
                        : 'text-amber-600 bg-amber-50 border-amber-100'
                    }`}>
                      {isOverdue(inv) && inv.status !== 'Paid' ? 'Overdue' : inv.rawStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
