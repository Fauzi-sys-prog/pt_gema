import React from 'react';
import type { Invoice } from '../contexts/AppContext';
import { ArrowLeft, Printer, CheckCircle } from 'lucide-react';
import logoImage from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

interface KwitansiTemplateProps {
  invoice: Invoice;
  onBack: () => void;
}

export const KwitansiTemplate: React.FC<KwitansiTemplateProps> = ({ invoice, onBack }) => {
  // Simple helper to convert number to Indonesian words (simplified for demo)
  const terbilang = (n: number) => {
    return "Dua Puluh Delapan Juta Tiga Ratus Lima Ribu Rupiah"; // Mock implementation
  };

  return (
    <div className="bg-slate-100 min-h-screen p-8">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <button className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black shadow-lg transition-all">
          <Printer size={18} /> Cetak Kwitansi
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white shadow-xl p-[15mm] border-8 border-double border-slate-200 relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-[-45deg]">
          <h1 className="text-[150px] font-black">LUNAS</h1>
        </div>

        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            <img src={logoImage} alt="Logo" className="w-14 h-14" />
            <div>
              <h2 className="text-xl font-black text-rose-600 leading-none">PT. GEMA TEKNIK PERKASA</h2>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">General Contractor & Maintenance Services</p>
            </div>
          </div>
          <div className="text-right border-l-4 border-slate-900 pl-6">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">KWITANSI</h1>
            <p className="text-xs font-black text-blue-600 uppercase">NO: {invoice.noKwitansi || 'KWT/GTP/2025/001'}</p>
          </div>
        </div>

        <div className="space-y-6 text-sm relative z-10">
          <div className="grid grid-cols-4 gap-4 items-center border-b border-slate-100 pb-4">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Telah Terima Dari :</span>
            <span className="col-span-3 font-black text-lg uppercase tracking-tight">{invoice.customer}</span>
          </div>

          <div className="grid grid-cols-4 gap-4 items-center border-b border-slate-100 pb-4">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Sejumlah Uang :</span>
            <div className="col-span-3 bg-slate-50 p-4 rounded-xl italic font-serif text-slate-700 border border-slate-100">
              " {terbilang(invoice.totalBayar)} "
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 items-center border-b border-slate-100 pb-4">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Untuk Pembayaran :</span>
            <span className="col-span-3 font-bold text-slate-900 leading-relaxed">
              Pelunasan Invoice {invoice.noInvoice} - {invoice.items[0].deskripsi} (PO: {invoice.noPO})
            </span>
          </div>
        </div>

        <div className="mt-12 flex justify-between items-end">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-br-3xl rounded-tl-3xl shadow-lg relative">
            <span className="absolute -top-3 left-4 text-[9px] font-black uppercase text-slate-400">Terbilang :</span>
            <span className="text-2xl font-black italic tracking-widest">Rp {invoice.totalBayar.toLocaleString('id-ID')},-</span>
          </div>
          
          <div className="text-center w-64">
            <p className="text-xs font-bold text-slate-500 mb-20">Bekasi, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <div className="relative inline-block">
              {/* Stamp effect */}
              <div className="absolute -top-12 -left-8 w-24 h-24 border-4 border-red-500/30 rounded-full flex items-center justify-center rotate-12 pointer-events-none">
                <span className="text-[10px] font-black text-red-500/40 text-center uppercase leading-none">PAID<br/>VERIFIED</span>
              </div>
              <p className="font-black text-lg uppercase border-b-2 border-slate-900 inline-block px-8 pb-1">SYAMSUDIN</p>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Authorized Signature</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex justify-between items-center italic text-[10px] text-slate-400 font-medium">
          <p>* Kwitansi ini sah apabila pembayaran telah dinyatakan lunas oleh PT. GTP</p>
          <div className="flex items-center gap-2">
            <CheckCircle size={12} className="text-emerald-500" />
            <span>Digital Proof of Payment</span>
          </div>
        </div>
      </div>
    </div>
  );
};
