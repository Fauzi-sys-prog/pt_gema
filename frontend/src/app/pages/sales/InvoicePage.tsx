import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp, type Invoice } from '../../contexts/AppContext';
import { useNavigate, useLocation } from 'react-router';
import {
  Receipt, Search, Printer, ChevronRight,
  AlertCircle, CheckCircle2, ArrowLeft, Upload, BellRing,
  Check, Plus, X, FileText, Zap, Truck, Clock, ShieldCheck,
  FileCheck, Send, Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { KwitansiTemplate } from '../../components/KwitansiTemplate';
import { motion } from 'motion/react';

// ─── helpers ────────────────────────────────────────────────────────────────

const genNoInvoice = () => {
  const now = new Date();
  return `INV/GTP/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(Math.floor(1000 + Math.random() * 9000))}`;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Sent: 'bg-blue-100 text-blue-700',
  Unpaid: 'bg-amber-100 text-amber-700',
  Partial: 'bg-orange-100 text-orange-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-rose-100 text-rose-700',
};

type InvItem = { deskripsi: string; qty: number; unit: string; hargaSatuan: number; total: number };

const emptyItem = (): InvItem => ({ deskripsi: '', qty: 1, unit: 'Unit', hargaSatuan: 0, total: 0 });

// ─── types ───────────────────────────────────────────────────────────────────

type Source = 'manual' | 'quotation' | 'sj';
type TerminType = 'full' | 'dp' | 'progress' | 'final';

interface FormState {
  source: Source;
  quotationId: string;
  terminType: TerminType;
  terminPercent: number;
  customer: string;
  alamat: string;
  noPO: string;
  perihal: string;
  tanggal: string;
  jatuhTempo: string;
  items: InvItem[];
  ppnEnabled: boolean;
  selectedSJIds: string[];
}

const defaultForm = (): FormState => ({
  source: 'manual',
  quotationId: '',
  terminType: 'full',
  terminPercent: 100,
  customer: '',
  alamat: '',
  noPO: '',
  perihal: '',
  tanggal: new Date().toISOString().split('T')[0],
  jatuhTempo: addDays(new Date().toISOString().split('T')[0], 30),
  items: [emptyItem()],
  ppnEnabled: true,
  selectedSJIds: [],
});

// ─── component ───────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const {
    invoiceList, addInvoice, updateInvoice, createInvoiceWithAR,
    quotationList, suratJalanList, stockItemList, projectList,
    currentUser,
  } = useApp();

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as any;

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewKwitansi, setViewKwitansi] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [showForm, setShowForm] = useState(() => !!locationState?.createFromQuotation);
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [activeTab, setActiveTab] = useState<'all' | 'sj'>('all');
  const [selectedSJ, setSelectedSJ] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── quotations eligible for invoice (client approved) ──────────────────────
  const approvedQuotations = useMemo(() =>
    (quotationList as any[]).filter(q =>
      q.clientApprovalStatus === 'Approved' || q.status === 'Complete'
    ), [quotationList]);

  // ── delivered SJ not yet billed ────────────────────────────────────────────
  const unbilledSJ = useMemo(() =>
    suratJalanList.filter(sj =>
      sj.deliveryStatus === 'Delivered' &&
      !invoiceList.some(inv => inv.source === 'sj' && inv.items.some(it => it.deskripsi.includes(sj.noSurat)))
    ), [suratJalanList, invoiceList]);

  // ── auto-open form from navigation state ──────────────────────────────────
  useEffect(() => {
    if (locationState?.createFromQuotation) {
      const qId = locationState.createFromQuotation;
      setShowForm(true);
      setForm(prev => ({ ...prev, source: 'quotation' }));
      setTimeout(() => loadFromQuotation(qId), 100);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ── invoice list filtered ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = invoiceList;
    if (filterStatus !== 'Semua') list = list.filter(i => i.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(i =>
        i.noInvoice?.toLowerCase().includes(q) ||
        i.customer?.toLowerCase().includes(q) ||
        i.perihal?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (b.createdAt || b.tanggal) > (a.createdAt || a.tanggal) ? 1 : -1);
  }, [invoiceList, filterStatus, searchTerm]);

  // ── stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: invoiceList.reduce((s, i) => s + i.totalBayar, 0),
    unpaid: invoiceList.filter(i => ['Unpaid', 'Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.totalBayar, 0),
    paid: invoiceList.filter(i => i.status === 'Paid').reduce((s, i) => s + i.totalBayar, 0),
    count: invoiceList.length,
  }), [invoiceList]);

  // ── form helpers ──────────────────────────────────────────────────────────
  const setF = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const loadFromQuotation = (qId: string) => {
    const q = (quotationList as any[]).find(x => x.id === qId);
    if (!q) return;
    const items: InvItem[] = [];
    (q.sections || []).forEach((sec: any) => {
      (sec.items || []).forEach((it: any) => {
        if (it.keterangan) {
          items.push({
            deskripsi: it.keterangan,
            qty: it.qty || 1,
            unit: it.satuan || 'Unit',
            hargaSatuan: it.hargaJualUnit || it.hargaJual || 0,
            total: (it.qty || 1) * (it.hargaJualUnit || it.hargaJual || 0),
          });
        }
      });
    });
    setForm(prev => ({
      ...prev,
      quotationId: qId,
      customer: q.kepada || q.customer || '',
      alamat: q.alamatCustomer || q.alamat || prev.alamat,
      perihal: q.perihal || '',
      noPO: q.noPO || prev.noPO,
      items: items.length ? items : [emptyItem()],
    }));
  };

  const applyTermin = (type: TerminType, pct: number) => {
    const base = (quotationList as any[]).find(x => x.id === form.quotationId);
    if (!base) return;
    const grandTotal = base.grandTotal || 0;
    const terminAmt = Math.round(grandTotal * pct / 100);
    const label = type === 'dp' ? `DP ${pct}%` : type === 'progress' ? `Progress ${pct}%` : type === 'final' ? `Pelunasan ${pct}%` : 'Full Payment';
    setF({
      terminType: type,
      terminPercent: pct,
      items: [{
        deskripsi: `${label} — ${base.perihal || 'Pekerjaan'}`,
        qty: 1,
        unit: 'LS',
        hargaSatuan: terminAmt,
        total: terminAmt,
      }],
    });
  };

  const calcTotals = () => {
    const subtotal = form.items.reduce((s, it) => s + it.total, 0);
    const ppn = form.ppnEnabled ? Math.round(subtotal * 0.11) : 0;
    return { subtotal, ppn, totalBayar: subtotal + ppn };
  };

  const updateItem = (idx: number, patch: Partial<InvItem>) => {
    setForm(prev => {
      const items = prev.items.map((it, i) => {
        if (i !== idx) return it;
        const merged = { ...it, ...patch };
        merged.total = merged.qty * merged.hargaSatuan;
        return merged;
      });
      return { ...prev, items };
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!form.customer || !form.tanggal) { toast.error('Customer dan tanggal wajib diisi.'); return; }
    if (form.items.some(it => !it.deskripsi)) { toast.error('Semua item harus ada deskripsinya.'); return; }
    setIsSubmitting(true);

    const { subtotal, ppn, totalBayar } = calcTotals();
    const terminLabel =
      form.terminType === 'dp' ? `DP ${form.terminPercent}%` :
      form.terminType === 'progress' ? `Progress ${form.terminPercent}%` :
      form.terminType === 'final' ? `Pelunasan ${form.terminPercent}%` : '';

    const inv: Invoice = {
      id: `INV-${Date.now()}`,
      noInvoice: genNoInvoice(),
      tanggal: form.tanggal,
      jatuhTempo: form.jatuhTempo,
      customer: form.customer,
      alamat: form.alamat,
      noPO: form.noPO,
      perihal: form.perihal,
      items: form.items,
      subtotal,
      ppn,
      totalBayar,
      paidAmount: 0,
      status: 'Draft',
      source: form.source,
      quotationId: form.quotationId || undefined,
      terminType: form.terminType !== 'full' ? form.terminType : undefined,
      terminLabel: terminLabel || undefined,
      terminPercent: form.terminType !== 'full' ? form.terminPercent : undefined,
      createdBy: currentUser?.name || 'System',
      createdAt: new Date().toISOString(),
    };

    try {
      const created = await createInvoiceWithAR(inv);
      if (created) {
        toast.success(`Invoice ${inv.noInvoice} berhasil dibuat & masuk ke AR.`);
        setShowForm(false);
        setForm(defaultForm());
      }
    } catch (err) {
      toast.error('Invoice gagal dibuat: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateFromSJ = () => {
    if (!selectedSJ.length) return;
    setIsGenerating(true);
    toast.loading('Memverifikasi e-POD & generate invoice...', { id: 'gen' });
    setTimeout(async () => {
      const creations: Promise<boolean>[] = [];
      selectedSJ.forEach(sjId => {
        const sj = suratJalanList.find(s => s.id === sjId);
        if (!sj) return;
        const project = projectList.find(p => p.id === sj.projectId || p.customer === sj.tujuan);
        const quotation = project?.quotationId ? (quotationList as any[]).find(q => q.id === project.quotationId) : null;
        const quoPrices: Record<string, number> = {};
        if (quotation?.sections) {
          quotation.sections.forEach((sec: any) => {
            (sec.items || []).forEach((item: any) => {
              const key = (item.keterangan || '').toLowerCase();
              if (key) quoPrices[key] = item.hargaJualUnit || item.hargaJual || 0;
            });
          });
        }
        const resolveHarga = (nama: string, kode: string) => {
          const fromQuo = quoPrices[(nama || '').toLowerCase()];
          if (fromQuo > 0) return fromQuo;
          const stock = stockItemList.find(s => s.kode === kode || s.nama === nama);
          return stock?.hargaSatuan || 0;
        };
        const items: InvItem[] = sj.items.map((it: any) => {
          const h = resolveHarga(it.namaItem, it.itemKode);
          return { deskripsi: `${it.namaItem} (${sj.noSurat} / Batch: ${it.batchNo || '-'})`, qty: it.jumlah, unit: it.satuan, hargaSatuan: h, total: it.jumlah * h };
        });
        const subtotal = items.reduce((s, i) => s + i.total, 0);
        const ppn = Math.round(subtotal * 0.11);
        const inv: Invoice = {
          id: `INV-SJ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          noInvoice: genNoInvoice(),
          tanggal: new Date().toISOString().split('T')[0],
          jatuhTempo: addDays(new Date().toISOString().split('T')[0], 30),
          customer: sj.tujuan,
          alamat: sj.alamat,
          noPO: sj.noPO || '-',
          items,
          subtotal,
          ppn,
          totalBayar: subtotal + ppn,
          paidAmount: 0,
          status: 'Draft',
          source: 'sj',
          projectId: sj.projectId,
          createdBy: currentUser?.name || 'System',
          createdAt: new Date().toISOString(),
        };
        creations.push(createInvoiceWithAR(inv));
      });
      const results = await Promise.all(creations);
      setIsGenerating(false);
      setSelectedSJ([]);
      const successCount = results.filter(Boolean).length;
      if (successCount) toast.success(`${successCount} invoice berhasil diterbitkan & masuk ke AR.`, { id: 'gen' });
      if (successCount !== selectedSJ.length) toast.error('Sebagian invoice Surat Jalan gagal masuk ke AR.', { id: 'gen' });
    }, 1500);
  };

  const handleMarkSent = (inv: Invoice) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      updateInvoice(inv.id, { status: 'Sent', sentAt: new Date().toISOString() });
      setSelectedInvoice(prev => prev ? { ...prev, status: 'Sent' } : prev);
      toast.success('Invoice ditandai sebagai Terkirim.');
    } catch (err) {
      toast.error('Gagal memperbarui invoice: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInvoice) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateInvoice(selectedInvoice.id, { buktiTransfer: dataUrl });
      setSelectedInvoice(prev => prev ? { ...prev, buktiTransfer: dataUrl } : prev);
      setUploading(false);
      toast.success('Bukti transfer diunggah. Menunggu verifikasi Finance.');
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = () => {
    if (!selectedInvoice || isSubmitting) return;
    if (!window.confirm(`Verifikasi pembayaran invoice ${selectedInvoice.noInvoice} dan tandai LUNAS? Kwitansi akan diterbitkan.`)) return;
    setIsSubmitting(true);
    try {
      const kwitansiNo = `KWT/GTP/${new Date().getFullYear()}${new Date().getMonth() + 1}/0001`;
      updateInvoice(selectedInvoice.id, { status: 'Paid', noKwitansi: kwitansiNo, tanggalBayar: new Date().toISOString().split('T')[0] });
      setSelectedInvoice(prev => prev ? { ...prev, status: 'Paid', noKwitansi: kwitansiNo } : prev);
      toast.success('Invoice Berhasil Diverifikasi! Kwitansi Otomatis Terbit.');
      setViewKwitansi(true);
    } catch (err) {
      toast.error('Verifikasi gagal: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleReminder = () => {
    toast.promise(new Promise(res => setTimeout(res, 2000)), {
      loading: 'Mengirim email pengingat ke customer...',
      success: `Email pengingat berhasil dikirim ke ${selectedInvoice?.customer}!`,
      error: 'Gagal mengirim email.',
    });
  };

  // ── kwitansi view ──────────────────────────────────────────────────────────
  if (selectedInvoice && viewKwitansi) {
    return <KwitansiTemplate invoice={selectedInvoice} onBack={() => setViewKwitansi(false)} />;
  }

  // ── invoice detail view ────────────────────────────────────────────────────
  if (selectedInvoice) {
    return (
      <div className="bg-slate-50 min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto mb-6 flex flex-wrap justify-between items-center gap-4 print:hidden">
          <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors">
            <ArrowLeft size={18} /> Kembali ke Daftar
          </button>
          <div className="flex flex-wrap gap-3">
            {(selectedInvoice.status === 'Draft') && (
              <button onClick={() => handleMarkSent(selectedInvoice)} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md transition-all disabled:opacity-50">
                <Send size={16} /> Tandai Terkirim
              </button>
            )}
            <button onClick={handleToggleReminder} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
              <BellRing size={16} className="text-orange-500" /> Pengingat
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black shadow-lg transition-all">
              <Printer size={18} /> Cetak Invoice
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invoice Paper */}
          <div className="lg:col-span-2 bg-white shadow-2xl p-4 sm:p-8 md:p-[15mm] min-h-0 md:min-h-[297mm] text-slate-900 font-sans print:shadow-none print:p-[15mm]">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 md:mb-12 border-b-4 border-slate-900 pb-6 md:pb-8 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-xs text-center leading-tight flex-shrink-0">GM<br/>TEKNIK</div>
                <div>
                  <h1 className="text-lg md:text-2xl font-black text-red-600 leading-none">PT. GEMA TEKNIK PERKASA</h1>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">General Contractor & Maintenance Services</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Jl. Raya Industri, Bekasi - Jawa Barat</p>
                </div>
              </div>
              <div className="sm:text-right">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">INVOICE</h2>
                <p className="text-sm font-black text-blue-600 mt-1">{selectedInvoice.noInvoice}</p>
                {selectedInvoice.terminLabel && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded uppercase">{selectedInvoice.terminLabel}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ditagihkan Kepada:</p>
                <p className="font-black text-lg uppercase">{selectedInvoice.customer}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{selectedInvoice.alamat}</p>
                {selectedInvoice.perihal && <p className="text-xs text-slate-500 mt-2 italic">{selectedInvoice.perihal}</p>}
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">No. PO Customer:</p>
                  <p className="text-sm font-black text-slate-900">{selectedInvoice.noPO || '-'}</p>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="space-y-2">
                  {[
                    { label: 'Tanggal', val: new Date(selectedInvoice.tanggal).toLocaleDateString('id-ID') },
                    { label: 'Jatuh Tempo', val: new Date(selectedInvoice.jatuhTempo).toLocaleDateString('id-ID'), red: true },
                  ].map(r => (
                    <div key={r.label} className="flex sm:justify-end gap-4 text-sm">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{r.label}:</span>
                      <span className={`font-black ${r.red ? 'text-rose-600' : ''}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-8 md:mb-12">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Deskripsi Item</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest w-20">Qty</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest w-32">Harga Satuan</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-5"><p className="font-black text-slate-900">{item.deskripsi}</p></td>
                      <td className="px-4 py-5 text-center"><p className="text-sm font-bold text-slate-600">{item.qty} {item.unit}</p></td>
                      <td className="px-4 py-5 text-right font-medium">{fmt(item.hargaSatuan)}</td>
                      <td className="px-4 py-5 text-right font-black">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-8 md:mb-12">
              <div className="w-full sm:w-80 space-y-3">
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>SUBTOTAL</span><span>{fmt(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>PPN (11%)</span><span>{fmt(selectedInvoice.ppn)}</span>
                </div>
                <div className="flex justify-between p-4 bg-slate-900 text-white rounded-xl">
                  <span className="font-black text-xs uppercase tracking-widest">Grand Total</span>
                  <span className="text-lg font-black italic">{fmt(selectedInvoice.totalBayar)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 md:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12">
              <div className="p-6 border-2 border-slate-50 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 italic">Informasi Pembayaran:</p>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">Bank Mandiri</p>
                  <p className="text-xs font-bold text-slate-600">A/N PT. Gema Teknik Perkasa</p>
                  <p className="text-base font-black text-blue-600 tracking-widest">156-00-XXXXXXXX-X</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-black mb-20 uppercase">Hormat Kami,</p>
                <p className="font-black text-lg border-b-2 border-slate-900 inline-block px-8 pb-1 uppercase">SYAMSUDIN</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Direktur Utama</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 print:hidden">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Status Pembayaran</h3>
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase ${STATUS_STYLE[selectedInvoice.status] || 'bg-slate-100 text-slate-600'}`}>
                {selectedInvoice.status}
              </span>

              <div className="mt-6">
                {!selectedInvoice.buktiTransfer ? (
                  <div className="space-y-4">
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center hover:border-blue-400 transition-all">
                      <Upload size={28} className="text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-500">Upload bukti transfer customer</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="w-full py-3 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50">
                      {uploading ? 'Mengunggah...' : 'Upload Bukti Transfer'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative group overflow-hidden rounded-2xl border border-slate-100 aspect-[3/4] bg-slate-900">
                      <img src={selectedInvoice.buktiTransfer} alt="Proof" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {selectedInvoice.status !== 'Paid' ? (
                      <button onClick={handleVerify} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50">
                        <Check size={18} /> Verifikasi & Tandai Lunas
                      </button>
                    ) : (
                      <button onClick={() => setViewKwitansi(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black shadow-lg transition-all">
                        <Receipt size={18} /> Lihat Kwitansi Resmi
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-6 text-white">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 italic">Log Keuangan</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0"><Check size={12} /></div>
                  <div>
                    <p className="text-xs font-black italic uppercase">Invoice Dibuat</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{selectedInvoice.tanggal ? new Date(selectedInvoice.tanggal).toLocaleDateString('id-ID') : '-'}</p>
                  </div>
                </div>
                {selectedInvoice.sentAt && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0"><Send size={12} /></div>
                    <div>
                      <p className="text-xs font-black italic uppercase">Dikirim ke Customer</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(selectedInvoice.sentAt).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                )}
                {selectedInvoice.tanggalBayar && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0"><Check size={12} /></div>
                    <div>
                      <p className="text-xs font-black italic uppercase">Pembayaran Diterima</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(selectedInvoice.tanggalBayar).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                )}
                {!selectedInvoice.tanggalBayar && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0"><BellRing size={12} /></div>
                    <div>
                      <p className="text-xs font-black italic uppercase text-slate-500">Menunggu Pembayaran</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Jatuh Tempo: {selectedInvoice.jatuhTempo}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── invoice list / hub view ────────────────────────────────────────────────
  const { subtotal: fSubtotal, ppn: fPpn, totalBayar: fTotal } = calcTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Invoice & Penagihan</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Manajemen Invoice Terpadu</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setForm(defaultForm()); }}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
          <Plus size={18} /> Buat Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tagihan', val: fmt(stats.total), icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Belum Lunas', val: fmt(stats.unpaid), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Sudah Lunas', val: fmt(stats.paid), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Invoice', val: stats.count.toString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            <p className="text-lg font-black text-slate-900 mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'all', label: 'Daftar Invoice', icon: FileText },
          { key: 'sj', label: `Generate dari SJ${unbilledSJ.length ? ` (${unbilledSJ.length})` : ''}`, icon: Zap },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'all' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari invoice, customer..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500 transition-all" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700">
              {['Semua', 'Draft', 'Sent', 'Unpaid', 'Partial', 'Paid', 'Overdue'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {['No. Invoice', 'Customer / Perihal', 'Sumber', 'Total Tagihan', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 font-bold text-sm">Belum ada invoice</td></tr>
                ) : filtered.map(inv => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedInvoice(inv)}>
                    <td className="px-5 py-4">
                      <p className="text-xs font-black text-blue-600 tracking-tighter">{inv.noInvoice}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(inv.tanggal).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{inv.customer}</p>
                      <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{inv.perihal || inv.items[0]?.deskripsi || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        inv.source === 'quotation' ? 'bg-violet-100 text-violet-700' :
                        inv.source === 'sj' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {inv.source === 'quotation' ? 'Quotation' : inv.source === 'sj' ? 'Surat Jalan' : 'Manual'}
                        {inv.terminLabel && <span className="ml-1 opacity-70">· {inv.terminLabel}</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{fmt(inv.totalBayar)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_STYLE[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sj' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">Surat Jalan Terkirim — Belum Ditagih</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{unbilledSJ.length} e-POD siap di-generate</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelectedSJ(unbilledSJ.map(s => s.id))}
                  className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-100 transition-all">
                  Pilih Semua
                </button>
                <button onClick={handleGenerateFromSJ} disabled={!selectedSJ.length || isGenerating}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {isGenerating ? <Clock size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Terbitkan {selectedSJ.length > 0 ? selectedSJ.length : ''} Invoice
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-5 py-4 w-12"></th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">No. Surat Jalan</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Verifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {unbilledSJ.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400 font-bold text-sm">Semua e-POD sudah ditagih</td></tr>
                  ) : unbilledSJ.map(sj => (
                    <tr key={sj.id} onClick={() => setSelectedSJ(prev => prev.includes(sj.id) ? prev.filter(id => id !== sj.id) : [...prev, sj.id])}
                      className={`cursor-pointer hover:bg-slate-50 transition-colors ${selectedSJ.includes(sj.id) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-5 py-4">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedSJ.includes(sj.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {selectedSJ.includes(sj.id) && <Check size={12} className="text-white" />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-black text-blue-600">{sj.noSurat}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{sj.podTime ? new Date(sj.podTime).toLocaleDateString('id-ID') : '-'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-900">{sj.tujuan}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate max-w-[180px]">{sj.alamat}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          {sj.items.slice(0, 2).map((it: any, idx: number) => (
                            <p key={idx} className="text-[11px] font-bold text-slate-700">{it.namaItem} — {it.jumlah} {it.satuan}</p>
                          ))}
                          {sj.items.length > 2 && <p className="text-[10px] text-slate-400 font-bold">+{sj.items.length - 2} lainnya</p>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                          Signed · {sj.podName || 'e-POD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      <>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setShowForm(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 w-full max-w-2xl h-full bg-white shadow-2xl z-[70] flex flex-col overflow-hidden">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Buat Invoice</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">Manual · Quotation · Surat Jalan</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Source */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Sumber Invoice</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'manual' as Source, label: 'Manual', icon: Edit2 },
                      { key: 'quotation' as Source, label: 'Dari Quotation', icon: FileCheck },
                      { key: 'sj' as Source, label: 'Dari Surat Jalan', icon: Truck },
                    ].map(s => (
                      <button key={s.key} onClick={() => setF({ source: s.key, quotationId: '', terminType: 'full', terminPercent: 100 })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-sm font-black transition-all ${form.source === s.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-300 text-slate-500'}`}>
                        <s.icon size={18} />
                        <span className="text-[11px]">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quotation Selector */}
                {form.source === 'quotation' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Pilih Quotation (Client Approved)</label>
                      <select value={form.quotationId} onChange={e => loadFromQuotation(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700">
                        <option value="">— Pilih Quotation —</option>
                        {approvedQuotations.map((q: any) => (
                          <option key={q.id} value={q.id}>{q.noQuotation || q.id} — {q.kepada || q.customer || '-'} — {q.perihal || ''}</option>
                        ))}
                      </select>
                      {approvedQuotations.length === 0 && (
                        <p className="text-[11px] text-amber-600 font-bold mt-2">Belum ada quotation yang disetujui client.</p>
                      )}
                    </div>

                    {/* Termin */}
                    {form.quotationId && (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Jenis Termin</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { type: 'full' as TerminType, label: 'Full Payment', pct: 100 },
                            { type: 'dp' as TerminType, label: 'DP 30%', pct: 30 },
                            { type: 'progress' as TerminType, label: 'Progress 40%', pct: 40 },
                            { type: 'final' as TerminType, label: 'Pelunasan 30%', pct: 30 },
                          ].map(t => (
                            <button key={t.type} onClick={() => applyTermin(t.type, t.pct)}
                              className={`px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${form.terminType === t.type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-300 text-slate-500'}`}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {form.terminType !== 'full' && (
                          <div className="mt-3 flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500 w-24">Custom %:</label>
                            <input type="number" min={1} max={100} value={form.terminPercent}
                              onChange={e => applyTermin(form.terminType, Number(e.target.value))}
                              className="w-24 px-3 py-2 bg-slate-50 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer *</label>
                    <input value={form.customer} onChange={e => setF({ customer: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Nama customer" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">No. PO</label>
                    <input value={form.noPO} onChange={e => setF({ noPO: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="No. PO Customer" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Perihal</label>
                    <input value={form.perihal} onChange={e => setF({ perihal: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Perihal pekerjaan" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Alamat</label>
                    <input value={form.alamat} onChange={e => setF({ alamat: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Alamat customer" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tanggal Invoice *</label>
                    <input type="date" value={form.tanggal} onChange={e => setF({ tanggal: e.target.value, jatuhTempo: addDays(e.target.value, 30) })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Jatuh Tempo</label>
                    <input type="date" value={form.jatuhTempo} onChange={e => setF({ jatuhTempo: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Tagihan</label>
                    <button onClick={() => setF({ items: [...form.items, emptyItem()] })}
                      className="flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-800 transition-colors">
                      <Plus size={14} /> Tambah Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-12 sm:col-span-5">
                          <input value={it.deskripsi} onChange={e => updateItem(idx, { deskripsi: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500" placeholder="Deskripsi" />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input type="number" min={0} value={it.qty} onChange={e => updateItem(idx, { qty: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500" placeholder="Qty" />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input value={it.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500" placeholder="Satuan" />
                        </div>
                        <div className="col-span-5 sm:col-span-2">
                          <input type="number" min={0} value={it.hargaSatuan} onChange={e => updateItem(idx, { hargaSatuan: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500" placeholder="Harga" />
                        </div>
                        <div className="col-span-1 flex justify-center pt-2">
                          {form.items.length > 1 && (
                            <button onClick={() => setF({ items: form.items.filter((_, i) => i !== idx) })} className="text-rose-400 hover:text-rose-600 transition-colors">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PPN Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-black text-slate-900">PPN 11%</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{form.ppnEnabled ? fmt(Math.round(fSubtotal * 0.11)) : 'Tidak dikenakan'}</p>
                  </div>
                  <button onClick={() => setF({ ppnEnabled: !form.ppnEnabled })}
                    className={`w-12 h-6 rounded-full relative transition-all ${form.ppnEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.ppnEnabled ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                {/* Total Preview */}
                <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-2">
                  <div className="flex justify-between text-sm text-slate-400 font-bold">
                    <span>Subtotal</span><span>{fmt(fSubtotal)}</span>
                  </div>
                  {form.ppnEnabled && (
                    <div className="flex justify-between text-sm text-slate-400 font-bold">
                      <span>PPN 11%</span><span>{fmt(fPpn)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black border-t border-slate-700 pt-2 mt-2">
                    <span>Grand Total</span><span className="text-blue-400">{fmt(fTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowForm(false)} disabled={isSubmitting} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all disabled:opacity-50">
                  Batal
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="flex-2 flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Memproses...' : 'Buat Invoice & Masuk AR'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </>
    </div>
  );
}
