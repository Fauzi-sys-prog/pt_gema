import React from 'react';
import type { SuratJalan } from '../../contexts/AppContext';

interface SuratJalanPrintProps {
  data: SuratJalan;
}

export const SuratJalanPrint: React.FC<SuratJalanPrintProps> = ({ data }) => {
  const formatDateIndonesian = (dateStr: string) => {
    if (!dateStr) return '';
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const date = new Date(dateStr);
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="bg-white p-8 w-full max-w-[21cm] mx-auto text-black font-serif print:p-0">
      {/* Header / Kop Surat */}
      <div className="flex items-start border-b-4 border-black pb-2 mb-4">
        <div className="w-24 h-24 mr-4 flex-shrink-0 flex items-center justify-center border-2 border-red-600 bg-red-600 text-white font-bold text-center leading-tight">
          <div className="bg-black text-white p-1 w-full">
            <span className="text-xl block">GM</span>
            <span className="text-xs">TEKNIK</span>
          </div>
        </div>
        <div className="flex-grow">
          <h1 className="text-2xl font-bold italic">GEMA TEKNIK PERKASA</h1>
          <p className="text-sm italic font-semibold">General Suplier & Trading</p>
          <p className="text-xs">Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510</p>
          <p className="text-xs">Phone : 085100420221 , 021.88354139 Fax : 021.88354139</p>
          <p className="text-xs">Email : <span className="text-blue-600 underline">gemateknik@gmail.com</span></p>
        </div>
      </div>

      {/* Date and Location */}
      <div className="text-right mb-6">
        <p>{data.kota}, {formatDateIndonesian(data.tanggal)}</p>
      </div>

      {/* Recipient */}
      <div className="mb-8">
        <p>Kepada Yth,</p>
        <p className="font-bold">{data.kepadaYth}</p>
        <p>Di</p>
        <p>{data.alamatTujuan}</p>
        {data.up && <p className="mt-4">Up/. {data.up}</p>}
      </div>

      {/* Content Start */}
      <div className="mb-6">
        <p>Dengan Hormat,</p>
        <p className="mt-4">Dengan surat ini kami kirimkan kendaraan kami :</p>
      </div>

      {/* Vehicle Info Table-like Layout */}
      <div className="mb-8 pl-4">
        <div className="grid grid-cols-[150px_20px_1fr] gap-1 mb-2">
          <span>No Kendaraan</span>
          <span>:</span>
          <span className="font-bold">{data.noKendaraan}</span>
        </div>
        <div className="grid grid-cols-[150px_20px_1fr] gap-1 mb-2">
          <span>Nama Sopir</span>
          <span>:</span>
          <span className="font-bold">{data.namaSopir}</span>
        </div>
        <div className="grid grid-cols-[150px_20px_1fr] gap-1 mb-2">
          <span>No. PO</span>
          <span>:</span>
          <span className="font-bold">{data.noPO}</span>
        </div>
      </div>

      {/* Purpose */}
      <div className="mb-8">
        <p>Untuk mengambil :</p>
        <div className="mt-4 pl-8">
          {data.items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <span>{index + 1}.</span>
              <span>{item.nama} sebanyak {item.qty} {item.unit}.</span>
            </div>
          ))}
        </div>
      </div>

      {/* Closing */}
      <div className="mb-12">
        <p>Demikian terima kasih.</p>
      </div>

      {/* Signature */}
      <div className="flex flex-col">
        <p className="mb-20">PT. Gema Teknik Perkasa</p>
        <p className="font-bold underline">{data.penandaTangan}</p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
};