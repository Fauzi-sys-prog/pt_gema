import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, FileText } from 'lucide-react';
import type { SuratJalan } from '../contexts/AppContext';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun
} from 'docx';
import FileSaver from 'file-saver';
import { toast } from 'sonner';

interface SuratJalanTemplateProps {
  data: SuratJalan;
  onBack: () => void;
}

export const SuratJalanTemplate: React.FC<SuratJalanTemplateProps> = ({ data, onBack }) => {
  const [logoImage, setLogoImage] = useState('');
  useEffect(() => {
    import('figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png')
      .then((m: { default: string }) => setLogoImage(m.default))
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = async () => {
    const loadingToast = toast.loading("Sedang menyiapkan dokumen Word...");
    
    try {
      // 1. Fetch logo
      let logoBuffer: ArrayBuffer | null = null;
      try {
        const response = await fetch(logoImage);
        if (response.ok) {
          logoBuffer = await response.arrayBuffer();
        }
      } catch (e) {
        console.error("Logo fetch failed:", e);
      }

      // 2. Prepare Data Safely
      const safeData = {
        noSurat: data.noSurat || 'SJ-UNKNOWN',
        tanggal: data.tanggal || new Date().toISOString(),
        tujuan: (data.tujuan || '').toUpperCase(),
        alamat: (data.alamat || '').toUpperCase(),
        up: data.up || '',
        noPolisi: data.noPolisi || '-',
        sopir: data.sopir || '-',
        pengirim: (data.pengirim || 'ADMIN').toUpperCase(),
        items: data.items || []
      };

      const formattedDate = new Date(safeData.tanggal).toLocaleDateString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });

      // 3. Create Document
      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
          },
          children: [
            // Header
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.DOUBLE, size: 4, color: "000000" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 60, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            ...(logoBuffer ? [
                              new ImageRun({
                                data: logoBuffer,
                                transformation: { width: 60, height: 45 },
                              }),
                              new TextRun({ text: "  " })
                            ] : []),
                            new TextRun({ text: "GM", bold: true, size: 48, color: "CC0000", italic: true }),
                            new TextRun({ text: " TEKNIK", bold: true, size: 44, color: "000000", italic: true }),
                          ],
                        }),
                        new Paragraph({ children: [new TextRun({ text: "PT. GEMA TEKNIK PERKASA", bold: true, size: 20 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Workshop & Engineering Services", size: 14, italic: true })] }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 40, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "SURAT JALAN", bold: true, size: 36 })] }),
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `No: ${safeData.noSurat}`, bold: true, size: 18 })] }),
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Date: ${safeData.tanggal}`, size: 16 })] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: "", spacing: { before: 400 } }),

            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `Bekasi, ${formattedDate}`, size: 24 })]
            }),

            new Paragraph({ text: "", spacing: { before: 200 } }),
            new Paragraph({ children: [new TextRun({ text: "Kepada Yth,", bold: true, size: 24 })] }),
            new Paragraph({ children: [new TextRun({ text: safeData.tujuan, bold: true, size: 28 })] }),
            new Paragraph({ children: [new TextRun({ text: "Di", bold: true, size: 24 })] }),
            new Paragraph({ children: [new TextRun({ text: safeData.alamat, bold: true, size: 24 })] }),

            ...(safeData.up ? [
              new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Up/. ${safeData.up}`, bold: true, italic: true, size: 24 })] })
            ] : []),

            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Paragraph({ children: [new TextRun({ text: "Dengan Hormat,", size: 24 })] }),
            new Paragraph({ children: [new TextRun({ text: "Dengan surat ini kami kirimkan kendaraan kami :", size: 24 })] }),

            new Paragraph({ text: "", spacing: { before: 200 } }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "No Kendaraan", size: 22 })] })] }),
                    new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: ":", size: 22 })] })] }),
                    new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: safeData.noPolisi, bold: true, size: 22 })] })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Sopir", size: 22 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ":", size: 22 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: safeData.sopir, bold: true, size: 22 })] })] }),
                  ]
                })
              ]
            }),

            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Paragraph({ children: [new TextRun({ text: "Untuk mengambil / mengirim :", size: 24 })] }),
            new Paragraph({ text: "", spacing: { before: 200 } }),

            ...safeData.items.map((item: any, index: number) => (
              new Paragraph({
                spacing: { before: 100 },
                children: [
                  new TextRun({ text: `${index + 1}. `, size: 24 }),
                  new TextRun({ text: `${item.nama} sebanyak ${item.qty} ${item.unit}.`, bold: true, underline: {}, size: 24 }),
                  ...(item.batchNo ? [new TextRun({ text: ` (Batch No: ${item.batchNo})`, size: 20, color: "666666" })] : [])
                ]
              })
            )),

            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Paragraph({ children: [new TextRun({ text: "Demikian terima kasih.", size: 24 })] }),
            new Paragraph({ text: "", spacing: { before: 800 } }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "PT. GEMA TEKNIK PERKASA", bold: true, size: 24 })] }),
                        new Paragraph({ text: "", spacing: { before: 1200 } }),
                        new Paragraph({ children: [new TextRun({ text: safeData.pengirim, bold: true, underline: {}, size: 24 })] }),
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Penerima,", size: 24 })] }),
                        new Paragraph({ text: "", spacing: { before: 1200 } }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "( ............................. )", size: 24 })] }),
                      ]
                    })
                  ]
                })
              ]
            })
          ],
        }],
      });

      // 4. Generate & Save
      const blob = await Packer.toBlob(doc);
      FileSaver.saveAs(blob, `SuratJalan_${safeData.noSurat.replace(/[\/\\?%*:|"<>]/g, '_')}.docx`);
      
      toast.dismiss(loadingToast);
      toast.success("Word berhasil diunduh!");
    } catch (error) {
      console.error("Word Error:", error);
      toast.dismiss(loadingToast);
      toast.error("Gagal export Word. Silakan gunakan tombol Cetak untuk sementara.");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8">
      {/* Controls - Hidden on Print */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadWord}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <FileText size={18} className="text-blue-600" /> Download Word (.docx)
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black shadow-lg transition-all"
          >
            <Printer size={18} /> Cetak Surat
          </button>
        </div>
      </div>

      {/* A4 Paper Container */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-[20mm] min-h-[297mm] text-slate-900 font-serif print:shadow-none print:p-0 print:mx-0">
        {/* Date */}
        <div className="text-right mb-12">
          <p className="text-lg">Bekasi, {new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Recipient */}
        <div className="mb-12">
          <p className="font-bold">Kepada Yth,</p>
          <p className="font-bold text-lg uppercase">{data.tujuan}</p>
          <p className="font-bold">Di</p>
          <p className="font-bold uppercase">{data.alamat}</p>
          
          {data.up && (
            <div className="mt-6">
              <p className="font-bold italic">Up/. {data.up}</p>
            </div>
          )}
        </div>

        {/* Opening */}
        <div className="mb-8">
          <p className="mb-4">Dengan Hormat,</p>
          <p>Dengan surat ini kami kirimkan kendaraan kami :</p>
        </div>

        {/* Vehicle Info Table */}
        <div className="mb-10 ml-4">
          <table className="w-full max-w-md">
            <tbody>
              <tr>
                <td className="py-1 w-40">No Kendaraan</td>
                <td className="py-1 w-4">:</td>
                <td className="py-1 font-bold">{data.noPolisi || '-'}</td>
              </tr>
              <tr>
                <td className="py-1">Nama Sopir</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{data.sopir || '-'}</td>
              </tr>
              <tr>
                <td className="py-1">No. PO</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{data.noPO || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Purpose */}
        <div className="mb-12">
          <p className="mb-6">Untuk mengambil / mengirim :</p>
          <div className="space-y-4 ml-4">
            {data.items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <span className="mt-0.5">{index + 1}.</span>
                <div>
                  <p className="font-bold underline decoration-1 underline-offset-4 leading-tight">
                    {item.nama} sebanyak {item.qty} {item.unit}.
                  </p>
                  {item.batchNo && (
                    <p className="text-[10px] font-sans font-black text-slate-500 mt-1 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded inline-block border border-slate-200">
                      Batch No: {item.batchNo}
                    </p>
                  )}
                  {item.keterangan && (
                    <p className="text-[10px] italic text-slate-400 mt-0.5">{item.keterangan}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Closing */}
        <div className="mb-20">
          <p>Demikian terima kasih.</p>
        </div>

        {/* Signature */}
        <div className="flex items-end justify-between mt-20">
          <div className="flex flex-col items-start">
            <p className="font-bold text-lg mb-24">PT. GEMA TEKNIK PERKASA</p>
            <p className="font-bold text-xl border-b-2 border-slate-900 pb-1 uppercase">{data.pengirim}</p>
          </div>
          
          {/* QR Verification */}
          <div className="flex flex-col items-center p-2 border border-slate-100 rounded-lg">
            <div className="w-24 h-24 bg-slate-50 flex items-center justify-center border border-slate-200 mb-2">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED-GTP-${data.noSurat}`} 
                alt="Verification QR"
                className="w-20 h-20"
              />
            </div>
            <p className="text-[8px] font-sans font-bold text-slate-400 uppercase text-center leading-tight">
              Scan to Verify<br/>Authenticity
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
