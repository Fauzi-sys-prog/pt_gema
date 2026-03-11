import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Book, 
  Search, 
  ChevronRight, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Hammer, 
  Truck, 
  DollarSign, 
  Users, 
  Mail, 
  Database,
  Info,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function GuideHubPage() {
  const [activeTab, setActiveTab] = useState('Overview');

  const modules = [
    { 
      id: 'Overview', 
      title: 'Sistem Overview', 
      icon: <LayoutDashboard size={20} />,
      description: 'Filosofi ERP Premium Warehouse Ledger & Alur Kerja Utama.'
    },
    { 
      id: 'Sales', 
      title: 'Commercial & Sales', 
      icon: <ShoppingCart size={20} />,
      description: 'Manajemen Quotation (RAB/SOW), Invoicing, dan Project Analytics.'
    },
    { 
      id: 'Purchasing', 
      title: 'Supply Chain & Purchasing', 
      icon: <ShoppingCart size={20} />,
      description: 'Alur Procurement: PR to PO, Vendor Analysis, dan Receiving.'
    },
    { 
      id: 'Inventory', 
      title: 'Inventory & Warehouse', 
      icon: <Package size={20} />,
      description: 'Manajemen Stok FEFO, Traceability Batch, dan Stock Opname.'
    },
    { 
      id: 'Production', 
      title: 'Production & QC', 
      icon: <Hammer size={20} />,
      description: 'Workshop Control: Work Order (WO), LHP, dan Verifikasi BOM.'
    },
    { 
      id: 'Logistics', 
      title: 'Logistics & Correspondence', 
      icon: <Truck size={20} />,
      description: 'Pengiriman Barang, Surat Jalan Digital, dan Arsip Berita Acara.'
    },
    { 
      id: 'Finance', 
      title: 'Finance & Ledger', 
      icon: <DollarSign size={20} />,
      description: 'P&L Proyek, Cashflow, Buku Hutang/Piutang, dan Rekonsiliasi Bank.'
    },
    { 
      id: 'HR', 
      title: 'Human Capital', 
      icon: <Users size={20} />,
      description: 'Manajemen Karyawan, Absensi, Cuti, dan Payroll Otomatis.'
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
          <Book size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">User Guide Hub</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 italic">Panduan Operasional Terintegrasi PT Gema Teknik Perkasa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all duration-300 text-left ${
                activeTab === m.id 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xl translate-x-2' 
                  : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              <div className={`${activeTab === m.id ? 'text-blue-400' : 'text-slate-400'}`}>
                {m.icon}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 italic">Module</p>
                <p className="text-sm font-black uppercase italic tracking-tight">{m.title}</p>
              </div>
              <ChevronRight size={16} className={`ml-auto ${activeTab === m.id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[3rem] border-2 border-slate-100 p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5">
              {modules.find(m => m.id === activeTab)?.icon}
            </div>

            <ContentRenderer activeTab={activeTab} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentRenderer({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'Overview':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">Filosofi Sistem Premium Warehouse Ledger</h2>
            <p className="text-slate-600 leading-relaxed font-medium italic">
              Sistem ini dirancang khusus untuk PT Gema Teknik Perkasa untuk menyatukan alur kerja dari Survey Lapangan hingga Laporan P&L Finansial. Inti dari sistem ini adalah <span className="text-blue-600 font-bold">Integritas Data Transaksional</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-blue-200 transition-all">
              <h4 className="text-sm font-black text-slate-900 uppercase italic mb-3 flex items-center gap-2">
                <Zap className="text-amber-500 group-hover:animate-pulse" size={18} /> Dual-Terminology (RAB/SOW)
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                Sistem mendukung pendekatan teknis (SOW) untuk tim workshop dan pendekatan finansial (RAB) untuk tim sales dalam satu dokumen Quotation yang sama.
              </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
              <h4 className="text-sm font-black text-slate-900 uppercase italic mb-3 flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={18} /> Segregation of Duties
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                Pemisahan hak akses yang ketat antara Warehouse, Purchasing, dan Finance untuk mencegah duplikasi pembayaran atau manipulasi stok.
              </p>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-lg font-black text-slate-900 uppercase italic border-b-2 border-slate-100 pb-2">Alur Kerja Utama (Core Flow)</h3>
             <div className="flex flex-col gap-4">
                {[
                  '1. Survey & Data Collection: Tim lapangan mengumpulkan kebutuhan teknis.',
                  '2. Quotation: Sales membuat penawaran berbasis RAB/SOW.',
                  '3. Work Order (WO): Workshop menerima instruksi kerja & memotong stok otomatis.',
                  '4. Logistics Control: Pengiriman barang disertai Surat Jalan & Digital POD.',
                  '5. Financial Invoicing: Finance menagih berdasarkan milestone proyek yang tervalidasi.'
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                     <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">{i+1}</span>
                     <p className="text-xs font-bold text-slate-700 uppercase italic">{step}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>
      );
    case 'Sales':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Commercial & Sales</h2>
          <div className="space-y-6 text-slate-600">
            <section className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase italic flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs">1</div>
                Quotation
              </h3>
              <p className="text-sm font-medium italic">Pusat pembuatan penawaran. Pilih mode <span className="font-bold">RAB</span> untuk rincian biaya atau <span className="font-bold">SOW</span> untuk rincian lingkup kerja teknis.</p>
              <div className="bg-white p-3 rounded-xl border border-slate-200 mt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase italic">Key Requirement:</p>
                <p className="text-[10px] text-blue-600 font-bold uppercase">Data Collection harus Terverifikasi sebelum Quotation dibuat.</p>
              </div>
            </section>
            <section className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase italic flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs">2</div>
                Invoicing & Penagihan
              </h3>
              <p className="text-sm font-medium italic">Sistem membantu penerbitan invoice ketika ada Berita Acara (BA) disetujui atau milestone proyek tercapai.</p>
            </section>
            <section className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase italic flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs">3</div>
                Sales Analytics
              </h3>
              <p className="text-sm font-medium italic">Pantau target penjualan dan performa customer. Bapak bisa melihat customer mana yang paling loyal dan mana yang memiliki piutang macet.</p>
            </section>
          </div>
        </div>
      );
    case 'Purchasing':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Supply Chain & Purchasing</h2>
          <div className="grid grid-cols-1 gap-6">
            <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase italic tracking-tight text-blue-400 mb-4">Prosedur Pengadaan Barang</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-blue-400 flex flex-shrink-0 items-center justify-center text-xs font-black">PO</div>
                    <div>
                      <p className="text-sm font-black italic uppercase">Penerbitan Purchase Order</p>
                      <p className="text-[11px] text-slate-400 font-medium italic">Tim Purchasing membuat PO berdasarkan requisition proyek. PO harus disetujui Manager/Finance sebelum dikirim ke Vendor.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-emerald-400 flex flex-shrink-0 items-center justify-center text-xs font-black">RC</div>
                    <div>
                      <p className="text-sm font-black italic uppercase">Receiving & GRN</p>
                      <p className="text-[11px] text-slate-400 font-medium italic">Gudang memverifikasi barang fisik vs Dokumen PO. Setiap selisih (Damaged/Shortage) wajib dicatat dengan lampiran foto.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
              <h4 className="text-sm font-black text-amber-900 uppercase italic mb-2 flex items-center gap-2">
                <Info size={18} /> Vendor Analysis Bridge
              </h4>
              <p className="text-xs text-amber-700 font-medium leading-relaxed italic">
                Gunakan fitur ini untuk membandingkan harga antar supplier. Sistem secara otomatis mencatat riwayat harga beli (History Price) untuk memastikan efisiensi anggaran.
              </p>
            </div>
          </div>
        </div>
      );
    case 'Inventory':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Inventory & Warehouse</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900 uppercase italic flex items-center gap-2">
                <Package className="text-blue-600" /> Warehouse Ledger
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Buku besar gudang. Gunakan pencarian cerdas untuk melacak lokasi rak barang dan tanggal kadaluarsa (FEFO).</p>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                 <p className="text-[10px] font-black text-amber-600 uppercase mb-2 italic flex items-center gap-2"><Info size={14}/> Pro Tip:</p>
                 <p className="text-[10px] text-slate-600 font-bold uppercase italic leading-tight">Gunakan fitur Stock Card Detail untuk melihat histori keluar masuk per-item secara spesifik.</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900 uppercase italic flex items-center gap-2">
                <ArrowRight className="text-blue-600" /> Stock Out (Issue)
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Setiap barang keluar HARUS terhubung ke nomor Work Order (WO) atau Proyek. Jika tidak, data P&L akan menjadi tidak akurat.</p>
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                 <p className="text-[10px] font-black text-emerald-600 uppercase mb-2 italic flex items-center gap-2"><ShieldCheck size={14}/> FEFO Logic:</p>
                 <p className="text-[10px] text-slate-600 font-bold uppercase italic leading-tight">Sistem akan otomatis merekomendasikan batch dengan masa kadaluarsa terdekat (misal: Castable/Resin).</p>
              </div>
            </div>
          </div>
        </div>
      );
    case 'Production':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Production & QC</h2>
          <div className="space-y-5">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase italic mb-4">Flow Produksi End-to-End</h3>
              <div className="space-y-3">
                {[
                  { no: "01", text: "Project approved -> buat Work Order (WO)." },
                  { no: "02", text: "Validasi BOM & ketersediaan stok material." },
                  { no: "03", text: "Mulai eksekusi workshop dan update progress." },
                  { no: "04", text: "Input LHP harian (output, mesin, teknisi)." },
                  { no: "05", text: "QC inspection (pass/reject)." },
                  { no: "06", text: "Stock Out + Surat Jalan + Proof of Delivery." },
                ].map((step) => (
                  <div key={step.no} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                      {step.no}
                    </span>
                    <p className="text-[11px] font-black text-slate-700 uppercase italic">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-3xl">
                <h4 className="text-[11px] font-black uppercase italic text-slate-900 mb-3">Page Yang Dipakai Tim Produksi</h4>
                <div className="space-y-2">
                  <Link to="/produksi/dashboard" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-700">Control Center (WO)</span>
                    <ArrowRight size={12} className="text-slate-500" />
                  </Link>
                  <Link to="/produksi/report" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-700">Laporan Harian (LHP)</span>
                    <ArrowRight size={12} className="text-slate-500" />
                  </Link>
                  <Link to="/produksi/timeline" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-700">Timeline & Tracker</span>
                    <ArrowRight size={12} className="text-slate-500" />
                  </Link>
                  <Link to="/produksi/qc" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-700">Quality Control (QC)</span>
                    <ArrowRight size={12} className="text-slate-500" />
                  </Link>
                </div>
              </div>

              <div className="p-5 bg-slate-900 text-white rounded-3xl">
                <h4 className="text-[11px] font-black uppercase italic text-amber-300 mb-3">Page Pendukung (Lintas Modul)</h4>
                <div className="space-y-2">
                  <Link to="/inventory/stock-out" className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                    <span className="text-[10px] font-black uppercase">Stock Out (Issue)</span>
                    <ArrowRight size={12} />
                  </Link>
                  <Link to="/surat-menyurat/surat-jalan" className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                    <span className="text-[10px] font-black uppercase">Surat Jalan / POD</span>
                    <ArrowRight size={12} />
                  </Link>
                  <Link to="/project" className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                    <span className="text-[10px] font-black uppercase">Project Detail (BOQ/Status)</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl">
              <p className="text-[11px] font-black uppercase italic text-amber-800 leading-relaxed">
                Catatan penting: jika QC status Reject, jangan lanjut Surat Jalan dulu. perbaiki hasil produksi dan re-check QC sampai Pass.
              </p>
            </div>
          </div>
        </div>
      );
    case 'Logistics':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Logistics & Correspondence</h2>
          <div className="space-y-6">
            <section className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
              <h3 className="text-lg font-black text-blue-900 uppercase italic mb-2">1. Surat Jalan & Digital POD</h3>
              <p className="text-sm text-blue-700 font-medium italic">Setiap pengiriman barang disertai QR-Code unik. Supir dapat melakukan konfirmasi "Terkirim" di lokasi pelanggan melalui link digital.</p>
            </section>
            <section className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase italic mb-2">2. Berita Acara (BAST)</h3>
              <p className="text-sm text-slate-600 font-medium italic">Dokumen bukti penyelesaian pekerjaan. BA yang sudah "Disetujui" adalah syarat utama bagi Finance untuk menerbitkan Tagihan/Invoice.</p>
            </section>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                <Mail className="text-slate-400" size={20} />
                <p className="text-[10px] font-black text-slate-500 uppercase italic">Archive Document Management</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                <Truck className="text-slate-400" size={20} />
                <p className="text-[10px] font-black text-slate-500 uppercase italic">Fleet Tracking Integration</p>
              </div>
            </div>
          </div>
        </div>
      );
    case 'Finance':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Finance & Ledger</h2>
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
               <DollarSign size={120} />
             </div>
             <h3 className="text-lg font-black uppercase italic tracking-tight text-emerald-400">Financial Command Center</h3>
             <p className="text-xs text-slate-400 font-medium leading-relaxed italic relative z-10">
                Modul ini adalah muara dari seluruh data transaksional. Finance tidak perlu input manual biaya material jika tim Warehouse sudah melakukan Stock Out ke Proyek.
             </p>
             <div className="grid grid-cols-2 gap-4 pt-4 relative z-10">
                <div className="border-l-2 border-emerald-500 pl-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Project P&L</p>
                   <p className="text-xs font-black italic">Otomatis bandingkan Nilai Kontrak vs Biaya PO vs Biaya Material.</p>
                </div>
                <div className="border-l-2 border-blue-500 pl-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">AP/AR Ledger</p>
                   <p className="text-xs font-black italic">Buku hutang ke vendor dan piutang dari customer terpusat.</p>
                </div>
             </div>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h4 className="text-sm font-black text-slate-900 uppercase italic mb-3">Rekonsiliasi Bank</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
              Cocokkan mutasi rekening koran dengan Payment Registry di sistem setiap akhir pekan untuk memastikan saldo kas akurat.
            </p>
          </div>
        </div>
      );
    case 'HR':
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Guide: Human Capital</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase italic mb-2">Absensi & Monitoring</h3>
                <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                  Sistem mencatat kehadiran karyawan workshop dan staff kantor. Rekap absensi akan menjadi dasar perhitungan Gaji Pokok dan Uang Makan.
                </p>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase italic mb-2">Manajemen Cuti</h3>
                <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                  Pengajuan cuti dilakukan digital. Approval oleh Manager akan otomatis memotong kuota cuti tahunan karyawan.
                </p>
              </div>
            </div>
            <div className="p-8 bg-blue-600 text-white rounded-[2.5rem] flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-2">Automatic Payroll</h3>
                <p className="text-xs text-blue-100 font-medium italic leading-relaxed">
                  Sistem menghitung Take Home Pay (THP) berdasarkan: Gaji Pokok + Tunjangan + Insentif Output Produksi - Potongan Absensi.
                </p>
              </div>
              <button className="mt-6 py-3 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all">
                Review Payroll Policy
              </button>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
            <Info size={40} />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Content Refinement</h3>
          <p className="text-sm text-slate-400 font-medium uppercase italic max-w-xs">Modul ini sedang dalam proses sinkronisasi konten detail. Silakan hubungi Administrator sistem.</p>
        </div>
      );
  }
}
