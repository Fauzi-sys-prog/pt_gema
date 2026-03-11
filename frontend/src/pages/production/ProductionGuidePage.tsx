import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Info, 
  ArrowRight,
  CheckCircle2,
  Settings,
  Database,
  ShieldCheck,
  Zap,
  Layers,
  Search,
  Plus,
  Box,
  LayoutDashboard,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';

export default function ProductionGuidePage() {
  const navigate = useNavigate();

  const anatomyItems = [
    { label: 'GTP', desc: 'Nama Perusahaan (Gema Teknik Perkasa)', color: 'text-blue-500' },
    { label: 'MTR', desc: 'Kategori (Material). Memudahkan filter Supply Chain.', color: 'text-indigo-500' },
    { label: 'PMP', desc: 'Jenis Barang (Pump). Membantu teknisi Technical Survey.', color: 'text-purple-500' },
    { label: 'CNF', desc: 'Sub-Tipe (Centrifugal). Penting untuk spesifikasi.', color: 'text-blue-600' },
    { label: '5HP', desc: 'Spesifikasi Kunci (5 Horsepower). Hindari salah ambil.', color: 'text-cyan-500' },
    { label: '001', desc: 'Nomor urut unik untuk varian tersebut.', color: 'text-slate-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-12 px-6 space-y-16 animate-in fade-in duration-700 pb-32">
      {/* Premium Header */}
      <div className="bg-[#0F172A] rounded-[3.5rem] p-16 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full"></div>
        
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-blue-500/10 text-blue-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-blue-500/20">
            <ShieldCheck size={14} className="text-blue-400" /> Integrated ERP User Manual
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none max-w-3xl">
            Master Data & <span className="text-blue-500">Identity</span> Standards
          </h1>
          <p className="text-slate-400 font-medium max-w-2xl text-xl leading-relaxed">
            Panduan standarisasi input data untuk menjaga akurasi laporan keuangan, 
            perhitungan profitabilitas proyek, dan ketertelusuran material gudang.
          </p>
        </div>
      </div>

      {/* Main SKU Registration Guide (Matching the Image) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Side: SKU Anatomy */}
        <div className="xl:col-span-5 bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-12 space-y-10">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
            <div className="w-14 h-14 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <Database size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight leading-none">Anatomi SKU</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Struktur Penomoran Barang Otomatis</p>
            </div>
          </div>

          <div className="space-y-8">
            {anatomyItems.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-6 items-start group"
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full ${item.color.replace('text', 'bg')} shrink-0 group-hover:scale-150 transition-transform`}></div>
                <div>
                  <span className={`font-black text-xl italic tracking-tighter ${item.color} block mb-1`}>{item.label}</span>
                  <p className="text-slate-500 text-sm font-bold leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-50">
            <p className="text-slate-400 italic text-sm font-medium leading-relaxed">
              "SKU adalah jangkar data. Tanpa SKU yang terstruktur, sistem tidak bisa menghitung biaya material per proyek secara akurat."
            </p>
          </div>
        </div>

        {/* Right Side: Visual Form Registration Mockup */}
        <div className="xl:col-span-7 space-y-8">
          <div className="bg-white rounded-[3.5rem] border-4 border-slate-50 shadow-2xl p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Box size={160} />
            </div>
            
            <div className="relative z-10 space-y-10">
              <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Formulir Registrasi SKU</h4>
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6 col-span-2 md:col-span-1">
                   {/* Integrated BOQ Sync Area */}
                   <div className="p-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-indigo-600 fill-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">BOQ Demand Sync</span>
                      </div>
                      <div className="relative">
                        <div className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-[10px] font-bold text-slate-400 flex justify-between items-center">
                          Pilih dari Bill of Quantities Project...
                          <ChevronDown size={14} />
                        </div>
                      </div>
                      <p className="text-[8px] text-indigo-400 font-bold uppercase">Pilih item dari proyek untuk mengisi form otomatis.</p>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KODE BARANG / SKU</label>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">+ BUAT OTOMATIS</span>
                      </div>
                      <div className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl"></div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI BARANG</label>
                      <div className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center px-4">
                        <span className="text-xs text-slate-300 italic font-medium">e.g. Centrifugal Pump 5HP...</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KATEGORI</label>
                        <div className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center px-4 justify-between">
                           <span className="text-xs font-black text-slate-700">Mechanical</span>
                           <ArrowRight size={14} className="text-slate-300 rotate-90" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SATUAN</label>
                        <div className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center px-4 justify-between">
                           <span className="text-xs font-black text-slate-700">Unit</span>
                           <ArrowRight size={14} className="text-slate-300 rotate-90" />
                        </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-8 col-span-2 md:col-span-1">
                   <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
                      <Box size={80} className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform" />
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-6">SALDO AWAL</p>
                      <div className="flex items-end gap-2">
                        <span className="text-7xl font-black leading-none">0</span>
                        <span className="text-[10px] font-black uppercase opacity-60 mb-2">UNIT</span>
                      </div>
                   </div>

                   <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">HARGA SATUAN (HPP)</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-black text-slate-400 uppercase">RP</span>
                        <span className="text-4xl font-black text-slate-900">0</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex items-center gap-6">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                <Info size={24} />
              </div>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                <span className="text-slate-900">Pro-Tip:</span> Gunakan fitur **BOQ Demand Sync** untuk mengambil data barang langsung dari kebutuhan proyek yang sudah disetujui, sehingga Bapak tidak perlu mengetik ulang nama dan harga.
              </p>
            </div>
            <button 
              onClick={() => navigate('/data-collection')}
              className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl"
            >
              Coba Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Callout */}
      <div className="bg-blue-50 border-4 border-blue-100 rounded-[3.5rem] p-16 flex flex-col md:flex-row items-center gap-12">
        <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shrink-0 shadow-2xl shadow-blue-200">
          <Zap size={44} className="fill-white" />
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-blue-900 uppercase italic tracking-tight leading-none">Sinkronisasi Ledger Otomatis</h2>
          <p className="text-blue-700 text-lg font-bold leading-relaxed max-w-3xl">
            Sistem ini terhubung langsung ke <span className="underline decoration-blue-300">Warehouse Ledger</span>. 
            Setiap pendaftaran barang akan otomatis membuat entri di Stock Journal, memudahkan pelacakan mutasi material masuk (PO) dan keluar (Proyek) tanpa input manual berulang.
          </p>
        </div>
      </div>

      {/* Navigation Shortcuts */}
      <div className="flex flex-wrap justify-center gap-6 pt-10">
        {[
          { label: 'Supply Chain Command', path: '/purchasing/procurement-hub', icon: Layers },
          { label: 'Warehouse Ledger', path: '/inventory/center', icon: Box },
          { label: 'Production Dashboard', path: '/produksi/dashboard', icon: LayoutDashboard },
        ].map(link => (
          <Link 
            key={link.path}
            to={link.path}
            className="flex items-center gap-4 px-10 py-6 bg-white border border-slate-100 rounded-[2rem] text-xs font-black uppercase text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-lg shadow-slate-200/50"
          >
            <link.icon size={20} /> {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
