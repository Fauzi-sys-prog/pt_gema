import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun } from 'docx';

// Export Sales Analytics to Word
interface SalesAnalyticsData {
  data2025: {
    month: string;
    omzet: number;
    prevYear: number;
    target: number;
  }[];
  totalSales2025: number;
  totalSales2024: number;
  growth: number;
  avgMonthlySales: number;
  topPerformanceMonth: string;
  exportDate: string;
}

export const exportSalesAnalyticsToWord = async (data: SalesAnalyticsData) => {
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

  const formatShortIDR = (val: number) => {
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} Miliar`;
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)} Juta`;
    return formatCurrency(val);
  };

  // Fetch and convert logo to buffer
  const fetchImageAsBuffer = async (imageUrl: string): Promise<Uint8Array> => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  };

  let logoBuffer: Uint8Array | null = null;
  try {
    const { default: logoImage } = await import('figma:asset/c160c5e311765b579db730c3b0e0bd4dd7d18339.png');
    logoBuffer = await fetchImageAsBuffer(logoImage);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720,
          },
        },
      },
      children: [
        // Header - Logo and Company Info
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  children: logoBuffer ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: logoBuffer,
                          transformation: {
                            width: 80,
                            height: 60,
                          },
                        }),
                      ],
                    }),
                  ] : [new Paragraph({ text: '' })],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  width: { size: 80, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: 'PT GEMA TEKNIK PERKASA',
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
                          size: 16,
                          font: 'Arial',
                          italics: true,
                        }),
                      ],
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
        
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'SALES PERFORMANCE ANALYTICS',
              bold: true,
              size: 28,
              font: 'Arial',
              underline: {},
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'REVENUE INTELLIGENCE REPORT',
              size: 20,
              font: 'Arial',
              italics: true,
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // Date
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: `Bekasi, ${formatDate(data.exportDate)}`,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // KPI Summary Section
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'RINGKASAN PERFORMA PENJUALAN',
              bold: true,
              size: 24,
              font: 'Arial',
              underline: {},
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // KPI Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 40, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: 'INDIKATOR', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  width: { size: 60, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: 'NILAI', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                  verticalAlign: VerticalAlign.CENTER,
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Total Omzet 2025 (Year to Date)', bold: true })],
                  shading: { fill: 'F0F8FF' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatShortIDR(data.totalSales2025), bold: true, alignment: AlignmentType.RIGHT })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Total Omzet 2024', bold: true })],
                  shading: { fill: 'F0F8FF' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatShortIDR(data.totalSales2024), alignment: AlignmentType.RIGHT })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Pertumbuhan Year-over-Year (YoY)', bold: true })],
                  shading: { fill: 'F0F8FF' },
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: `${data.growth > 0 ? '+' : ''}${data.growth.toFixed(2)}%`, 
                    bold: true,
                    alignment: AlignmentType.RIGHT 
                  })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Rata-rata Penjualan Per Bulan', bold: true })],
                  shading: { fill: 'F0F8FF' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatShortIDR(data.avgMonthlySales), alignment: AlignmentType.RIGHT })],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Bulan dengan Performa Tertinggi', bold: true })],
                  shading: { fill: 'F0F8FF' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: data.topPerformanceMonth, bold: true, alignment: AlignmentType.RIGHT })],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Monthly Detail Section
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'REKAPITULASI OMZET PER BULAN (2025 VS 2024)',
              bold: true,
              size: 24,
              font: 'Arial',
              underline: {},
            }),
          ],
        }),

        new Paragraph({ text: '' }),

        // Monthly Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'BULAN', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'OMZET 2025', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'OMZET 2024', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'SELISIH', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'GROWTH %', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: '2563EB' },
                }),
              ],
            }),
            ...data.data2025.map((row, idx) => {
              const diff = row.omzet - row.prevYear;
              const growthPercent = row.prevYear !== 0 ? ((diff / row.prevYear) * 100) : 0;
              const isUp = diff > 0;
              
              return new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: row.month, bold: true, alignment: AlignmentType.CENTER })],
                    shading: { fill: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: formatCurrency(row.omzet), alignment: AlignmentType.RIGHT })],
                    shading: { fill: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: formatCurrency(row.prevYear), alignment: AlignmentType.RIGHT })],
                    shading: { fill: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: `${isUp ? '+' : ''}${formatCurrency(diff)}`,
                      bold: true,
                      alignment: AlignmentType.RIGHT 
                    })],
                    shading: { fill: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: `${isUp ? '+' : ''}${growthPercent.toFixed(1)}%`,
                      bold: true,
                      alignment: AlignmentType.RIGHT 
                    })],
                    shading: { fill: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' },
                  }),
                ],
              });
            }),
            // Total Row
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'TOTAL', bold: true, alignment: AlignmentType.CENTER })],
                  shading: { fill: 'FFD700' },
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: formatCurrency(data.totalSales2025), 
                    bold: true,
                    alignment: AlignmentType.RIGHT 
                  })],
                  shading: { fill: 'FFD700' },
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: formatCurrency(data.totalSales2024), 
                    bold: true,
                    alignment: AlignmentType.RIGHT 
                  })],
                  shading: { fill: 'FFD700' },
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: `${data.growth > 0 ? '+' : ''}${formatCurrency(data.totalSales2025 - data.totalSales2024)}`,
                    bold: true,
                    alignment: AlignmentType.RIGHT 
                  })],
                  shading: { fill: 'FFD700' },
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: `${data.growth > 0 ? '+' : ''}${data.growth.toFixed(2)}%`,
                    bold: true,
                    alignment: AlignmentType.RIGHT 
                  })],
                  shading: { fill: 'FFD700' },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Footer Notes
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'CATATAN:',
              bold: true,
              size: 22,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: '• Data di atas merupakan rekapitulasi penjualan perusahaan periode 2024 dan 2025',
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: '• Pertumbuhan (Growth) dihitung berdasarkan perbandingan tahun-ke-tahun (Year-over-Year)',
              size: 20,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: '• Dokumen ini bersifat RAHASIA dan hanya untuk keperluan internal manajemen',
              size: 20,
              font: 'Arial',
              bold: true,
            }),
          ],
        }),

        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),

        // Signature
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
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({ text: '', spacing: { after: 1200 } }),
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
                      text: 'Mengetahui,', 
                      alignment: AlignmentType.CENTER 
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
                    new Paragraph({ text: '', spacing: { after: 800 } }),
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
                    new Paragraph({ text: '', spacing: { after: 800 } }),
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
                    new Paragraph({ text: '' }),
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
                      text: '( Direktur Utama )', 
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
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Sales_Performance_Analytics_${new Date().toISOString().split('T')[0]}.docx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
