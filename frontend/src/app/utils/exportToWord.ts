import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } from 'docx';

interface ExportDataCollectionProps {
  noKoleksi: string;
  namaResponden: string;
  kategori: string;
  tanggalPengumpulan: string;
  lokasi: string;
  namaKolektor: string;
  tipePekerjaan: string;
  jenisKontrak: string;
  notes: string;
  complexityRating?: number;
  gpsCoordinates?: string;
  materials?: {
    materialName: string;
    qtyEstimate: number;
    qtyActual: number;
    unit: string;
    unitPrice: number;
    supplier: string;
    status: string;
  }[];
}

export const exportDataCollectionToWord = async (data: ExportDataCollectionProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const totalBudget = data.materials?.reduce((sum, mat) => sum + (mat.qtyEstimate * mat.unitPrice), 0) || 0;

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,  // 0.5 inch
            right: 720,
            bottom: 720,
            left: 720,
          },
        },
      },
      children: [
        // Header - Company Info
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'GEMA TEKNIK PERKASA',
              bold: true,
              size: 28,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'REFRACTORY FURNACE AND BOILER',
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Jl. Nurushshoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510',
              size: 18,
              font: 'Arial',
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Phone : 085100420221 , 021.88354139  Fax : 021.88354139',
              size: 18,
              font: 'Arial',
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Email : gemateknik@gmail.com',
              size: 18,
              font: 'Arial',
              italics: true,
              color: '0000FF',
            }),
          ],
        }),

        // Spacing
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Date
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: `Bekasi, ${formatDate(data.tanggalPengumpulan)}`,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        // Spacing
        new Paragraph({ text: '' }),

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'B E R I T A - A C A R A',
              bold: true,
              size: 28,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `( No : ${data.noKoleksi} )`,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        // Spacing
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Opening
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'Yang bertanda tangan dibawah ini :',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        // Spacing
        new Paragraph({ text: '' }),

        // Pihak Pertama
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: 'Nama', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 5, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: data.namaKolektor, spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Perusahaan', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Gema Teknik Perkasa', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Alamat', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Jl Nurushshoba II No 13 Setia Mekar Tambun Bekasi', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'Disebut sebagai pihak pertama',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // TECHNICAL DATA SECTION
        new Paragraph({
          children: [
            new TextRun({
              text: 'DATA TEKNIS SURVEY LAPANGAN',
              bold: true,
              size: 24,
              font: 'Arial',
              underline: {},
            }),
          ],
        }),
        new Paragraph({ text: '' }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 40, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: 'Complexity Rating (Tingkat Kesulitan)', bold: true })],
                  shading: { fill: 'F0F0F0' },
                }),
                new TableCell({
                  width: { size: 60, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: `${data.complexityRating || '3'} / 5` })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'GPS Coordinates', bold: true })],
                  shading: { fill: 'F0F0F0' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.gpsCoordinates || 'Not Recorded' })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Tipe Pekerjaan', bold: true })],
                  shading: { fill: 'F0F0F0' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.tipePekerjaan })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Jenis Kontrak', bold: true })],
                  shading: { fill: 'F0F0F0' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.jenisKontrak })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Lokasi Survey', bold: true })],
                  shading: { fill: 'F0F0F0' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.lokasi })],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // Pihak Kedua
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: 'Nama', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 5, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: data.namaResponden, spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Perusahaan', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.kategori, spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Alamat', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: ':', spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.lokasi, spacing: { after: 100 } })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'Disebut sebagai pihak kedua.',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // Content
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: `Dengan ini menyatakan bahwa pihak pertama telah menyelesaikan pekerjaan ${data.kategori} untuk ${data.namaResponden}.`,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: `Pekerjaan dilaksanakan pada tanggal ${formatDate(data.tanggalPengumpulan)}.`,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: 'Sesuai dengan No PO yang telah disepakati.',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // Material List (if any)
        ...(data.materials && data.materials.length > 0 ? [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'Rincian Material:',
                bold: true,
                size: 22,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'No', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Material', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Qty', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Unit', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Harga Satuan', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Total', alignment: AlignmentType.CENTER })],
                    shading: { fill: 'D3D3D3' },
                  }),
                ],
              }),
              ...data.materials.map((mat, idx) => 
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: String(idx + 1), alignment: AlignmentType.CENTER })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: mat.materialName })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: mat.qtyEstimate.toString(), alignment: AlignmentType.RIGHT })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: mat.unit, alignment: AlignmentType.CENTER })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: formatCurrency(mat.unitPrice), alignment: AlignmentType.RIGHT })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: formatCurrency(mat.qtyEstimate * mat.unitPrice), alignment: AlignmentType.RIGHT })],
                    }),
                  ],
                })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 5,
                    children: [new Paragraph({ text: 'TOTAL', alignment: AlignmentType.CENTER, bold: true })],
                    shading: { fill: 'F0F0F0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: formatCurrency(totalBudget), 
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({ text: formatCurrency(totalBudget), bold: true })
                      ]
                    })],
                    shading: { fill: 'F0F0F0' },
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '' }),
        ] : []),

        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: 'Pekerjaan tersebut telah dilaksanakan dan diselesaikan oleh pihak pertama, sesuai dengan kesepakatan dan schedule yang dikeluarkan.',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: 'Demikian berita acara ini kami buat untuk dipergunakan sebagaimana mestinya.',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Signature section
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({ 
                      text: 'Pihak pertama', 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({ 
                      text: 'Pihak kedua', 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: 'PT. Gema Teknik Perkasa', 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 1200 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: data.namaResponden, 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 1200 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: '', 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 400 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: '', 
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 400 }
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: data.namaKolektor, 
                      alignment: AlignmentType.CENTER,
                      bold: true
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ 
                      text: data.namaResponden, 
                      alignment: AlignmentType.CENTER,
                      bold: true
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
          ],
        }),

        // Notes
        ...(data.notes ? [
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'Catatan:',
                bold: true,
                size: 22,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: data.notes,
                size: 22,
                font: 'Arial',
                italics: true,
              }),
            ],
          }),
        ] : []),
      ],
    }],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Berita_Acara_${data.noKoleksi}_${data.namaResponden.replace(/\s+/g, '_')}.docx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const exportSPKToWord = async (project: any, spk: any) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        // Header
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'PT. GEMA TEKNIK PERKASA', bold: true, size: 28, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'REFRACTORY FURNACE AND BOILER', size: 18, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'SURAT PERINTAH KERJA (SPK)', bold: true, size: 24, font: 'Arial', underline: {} }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `No: ${spk.noSPK}`, size: 20, font: 'Arial' }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Details Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: 'Proyek', bold: true })] }),
                new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: ':' })] }),
                new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: project.namaProject })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Customer', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: ':' })] }),
                new TableCell({ children: [new Paragraph({ text: project.customer })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Tanggal SPK', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: ':' })] }),
                new TableCell({ children: [new Paragraph({ text: formatDate(spk.tanggal) })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Pekerjaan', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: ':' })] }),
                new TableCell({ children: [new Paragraph({ text: spk.pekerjaan })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Teknisi', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: ':' })] }),
                new TableCell({ children: [new Paragraph({ text: spk.teknisi })] }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Material List Section
        new Paragraph({
          children: [
            new TextRun({ text: 'DAFTAR MATERIAL / BOQ TERKAIT:', bold: true, size: 20, font: 'Arial' }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'No', alignment: AlignmentType.CENTER })], shading: { fill: 'EFEFEF' } }),
                new TableCell({ children: [new Paragraph({ text: 'Nama Material', alignment: AlignmentType.CENTER })], shading: { fill: 'EFEFEF' } }),
                new TableCell({ children: [new Paragraph({ text: 'Qty', alignment: AlignmentType.CENTER })], shading: { fill: 'EFEFEF' } }),
                new TableCell({ children: [new Paragraph({ text: 'Satuan', alignment: AlignmentType.CENTER })], shading: { fill: 'EFEFEF' } }),
              ],
            }),
            ...(project.boq?.map((item: any, idx: number) => (
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: String(idx + 1), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: item.materialName })] }),
                  new TableCell({ children: [new Paragraph({ text: item.qtyEstimate.toString(), alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
                ],
              })
            )) || []),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Instructions
        new Paragraph({
          children: [
            new TextRun({ text: 'INSTRUKSI KERJA:', bold: true, size: 20, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: '1. Laksanakan pekerjaan sesuai dengan standar kualitas PT. Gema Teknik Perkasa.' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: '2. Pastikan penggunaan APD dan keselamatan kerja (K3) diutamakan.' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: '3. Laporkan hasil kerja setiap hari melalui Laporan Harian Produksi (LHP).' }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Signature
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
                new TableCell({ children: [new Paragraph({ text: 'Dibuat Oleh,', alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Diterima Oleh,', alignment: AlignmentType.CENTER })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '', spacing: { before: 1000 } })] }),
                new TableCell({ children: [new Paragraph({ text: '', spacing: { before: 1000 } })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '( Admin Produksi )', alignment: AlignmentType.CENTER, bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: `( ${spk.teknisi.split(',')[0]} )`, alignment: AlignmentType.CENTER, bold: true })] }),
              ],
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `SPK_${spk.noSPK.replace(/\//g, '_')}.docx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportLHPToWord = async (report: any) => {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        // Header
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'PT. GEMA TEKNIK PERKASA', bold: true, size: 28, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'LAPORAN HASIL PRODUKSI (LHP)', bold: true, size: 24, font: 'Arial', underline: {} }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Details Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'ID Laporan', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.id })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Tanggal', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.tanggal })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Shift', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.shift })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Teknisi', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.workerName })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Aktivitas Pekerjaan', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.activity })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Hasil Output', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: `${report.outputQty} ${report.unit}` })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Status / Keterangan', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: report.remarks || 'Selesai' })] }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: 'Demikian laporan hasil kerja ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagai bahan evaluasi progres proyek.' }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Signature
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
                new TableCell({ children: [new Paragraph({ text: 'Teknisi Pelaksana,', alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Mengetahui,', alignment: AlignmentType.CENTER })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '', spacing: { before: 1000 } })] }),
                new TableCell({ children: [new Paragraph({ text: '', spacing: { before: 1000 } })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: `( ${report.workerName} )`, alignment: AlignmentType.CENTER, bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: '( Produksi Manager )', alignment: AlignmentType.CENTER, bold: true })] }),
              ],
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `LHP_${report.id}.docx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
