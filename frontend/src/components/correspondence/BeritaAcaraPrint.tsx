import React from 'react';
import type { BeritaAcara } from '../../contexts/AppContext';
import logoGM from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

interface BeritaAcaraPrintProps {
  beritaAcara: BeritaAcara;
}

export const BeritaAcaraPrint: React.FC<BeritaAcaraPrintProps> = ({ beritaAcara }) => {
  return (
    <div className="berita-acara-print bg-white p-12 max-w-[210mm] mx-auto" style={{ fontFamily: 'Times New Roman, serif' }}>
      {/* Header with Logo */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-2">
          <img src={logoGM} alt="GM TEKNIK" className="w-12 h-12 object-contain" />
          <div>
            <div className="text-lg font-bold text-red-600">GM TEKNIK</div>
            <div className="text-xs text-gray-600">PT. Gema Teknik Perkasa</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm">{beritaAcara.tempatTanggal}</div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6 mt-8">
        <h1 className="text-lg font-bold mb-2" style={{ letterSpacing: '0.5em' }}>
          B E R I T A  -  A C A R A
        </h1>
        <div className="text-sm">
          ( No : {beritaAcara.noBeritaAcara} )
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed space-y-4 mt-8">
        <p className="mb-4">Yang bertanda tangan dibawah ini :</p>

        {/* Pihak Pertama */}
        <div className="mb-4">
          <table className="w-full mb-2 text-sm">
            <tbody>
              <tr>
                <td className="w-32">Nama</td>
                <td className="w-8">:</td>
                <td>{beritaAcara.namaPihakPertama}</td>
              </tr>
              <tr>
                <td>Perusahaan</td>
                <td>:</td>
                <td>{beritaAcara.perusahaanPihakPertama}</td>
              </tr>
              <tr>
                <td className="align-top">Alamat</td>
                <td className="align-top">:</td>
                <td className="whitespace-pre-line">{beritaAcara.alamatPihakPertama}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-sm">Disebut sebagai <strong>pihak pertama</strong></p>
        </div>

        {/* Pihak Kedua */}
        <div className="mb-4">
          <table className="w-full mb-2 text-sm">
            <tbody>
              <tr>
                <td className="w-32">Nama</td>
                <td className="w-8">:</td>
                <td>{beritaAcara.namaPihakKedua}</td>
              </tr>
              <tr>
                <td>Perusahaan</td>
                <td>:</td>
                <td>{beritaAcara.perusahaanPihakKedua}</td>
              </tr>
              <tr>
                <td className="align-top">Alamat</td>
                <td className="align-top">:</td>
                <td className="whitespace-pre-line">{beritaAcara.alamatPihakKedua}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-sm">Disebut sebagai <strong>pihak kedua</strong>.</p>
        </div>

        {/* Perihal */}
        <p className="mb-3 text-sm">
          Dengan ini menyatakan bahwa pihak pertama telah menyelesaikan pekerjaan <strong>{beritaAcara.perihal}</strong>
        </p>

        {/* Tanggal Pelaksanaan */}
        {beritaAcara.tanggalPelaksanaanMulai && beritaAcara.tanggalPelaksanaanSelesai && (
          <p className="mb-3 text-sm">
            Pekerjaan dilakukan pada tanggal {new Date(beritaAcara.tanggalPelaksanaanMulai).toLocaleDateString('id-ID', { day: 'numeric' })} s/d {new Date(beritaAcara.tanggalPelaksanaanSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        )}

        {/* No PO */}
        {beritaAcara.noPO && beritaAcara.tanggalPO && (
          <p className="mb-3 text-sm">
            Sesuai dengan No PO : <strong>{beritaAcara.noPO}</strong> tanggal {new Date(beritaAcara.tanggalPO).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        )}

        {/* Deskripsi */}
        <p className="mb-4 text-sm">
          {beritaAcara.deskripsi}
        </p>

        {/* Penutup */}
        <p className="mb-8 text-sm">
          Demikian berita acara ini kami buat untuk dipergunakan sebagaimana mestinya.
        </p>

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-8 mt-16">
          {/* Pihak Pertama */}
          <div className="text-center text-sm">
            <p className="mb-1">Pihak pertama</p>
            <p className="font-bold mb-16">{beritaAcara.perusahaanPihakPertama}</p>
            <div className="border-t border-black pt-2 inline-block min-w-[180px]">
              <p className="font-bold">{beritaAcara.namaPihakPertama}</p>
            </div>
          </div>

          {/* Pihak Kedua */}
          <div className="text-center text-sm">
            <p className="mb-1">Pihak kedua</p>
            <p className="font-bold mb-16">{beritaAcara.perusahaanPihakKedua}</p>
            <div className="border-t border-black pt-2 inline-block min-w-[180px]">
              <p className="font-bold">{beritaAcara.namaPihakKedua}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
