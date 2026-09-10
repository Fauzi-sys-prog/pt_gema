import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun } from 'docx';
import logoImage from 'figma:asset/c160c5e311765b579db730c3b0e0bd4dd7d18339.png';

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerExportData {
  journalEntries: JournalEntry[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  ledgerHealth: number;
  totalAR: number;
  totalAP: number;
  availableCash: number;
  reportType?: 'full' | 'summary';
}

export const exportGeneralLedgerToWord = async (data: LedgerExportData) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatDateTime = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${formatDate(date.toISOString())} - ${h}:${m} WIB`;
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
    logoBuffer = await fetchImageAsBuffer(logoImage);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }

  const currentDate = new Date();
  const isFull = data.reportType === 'full';

  // Calculate totals
  const totalDebit = data.journalEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = data.journalEntries.reduce((sum, e) => sum + e.credit, 0);
  const netBalance = totalDebit - totalCredit;

  const children: any[] = [
    // Header - Logo and Company Info
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: "2563EB" },
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

    // Spacing
    new Paragraph({ text: '' }),

    // Title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'GENERAL LEDGER CONTROL',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '2563EB',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: isFull ? 'COMPLETE FINANCIAL STATEMENT REPORT' : 'LEDGER SUMMARY EXPORT',
          bold: true,
          size: 28,
          font: 'Arial',
        }),
      ],
    }),

    // Subtitle
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'Pusat Digitalisasi Arus Kas & Verifikasi Transaksi Finansial',
          size: 18,
          font: 'Arial',
          italics: true,
          color: '64748B',
        }),
      ],
    }),

    // Metadata Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: "EFF6FF" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Report Type',
                      bold: true,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: isFull ? 'Complete Financial Statement' : 'General Ledger Summary',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "EFF6FF" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Generated On',
                      bold: true,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatDateTime(currentDate),
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "EFF6FF" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Fiscal Period',
                      bold: true,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Year to Date ${currentDate.getFullYear()}`,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // Spacing
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),

    // KPI Summary Section
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: '1. EXECUTIVE FINANCIAL SUMMARY',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '1E293B',
        }),
      ],
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      rows: [
        // Header
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "2563EB" },
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'KEY PERFORMANCE INDICATOR',
                      bold: true,
                      size: 20,
                      font: 'Arial',
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "2563EB" },
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'VALUE (IDR)',
                      bold: true,
                      size: 20,
                      font: 'Arial',
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Data rows
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total Revenue (YTD)',
                      size: 20,
                      font: 'Arial',
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.totalRevenue),
                      size: 20,
                      font: 'Arial',
                      bold: true,
                      color: '2563EB',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total Expenses (YTD)',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.totalExpenses),
                      size: 20,
                      font: 'Arial',
                      color: 'DC2626',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Net Profit (YTD)',
                      size: 20,
                      font: 'Arial',
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.netProfit),
                      size: 20,
                      font: 'Arial',
                      bold: true,
                      color: data.netProfit >= 0 ? '059669' : 'DC2626',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Ledger Health Score',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${data.ledgerHealth.toFixed(1)}%`,
                      size: 20,
                      font: 'Arial',
                      bold: true,
                      color: '059669',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ text: '' }),

    // Current Ledger Balance Section
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: '2. CURRENT LEDGER BALANCE',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '1E293B',
        }),
      ],
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "1E293B" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Available Cash',
                      size: 20,
                      font: 'Arial',
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "1E293B" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.availableCash),
                      size: 22,
                      font: 'Arial',
                      bold: true,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total Piutang (AR)',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "F8FAFC" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.totalAR),
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total Hutang (AP)',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.totalAP),
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // Add Journal Entries Detail Table (for Full Report)
  if (isFull && data.journalEntries.length > 0) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        spacing: { before: 200, after: 150 },
        children: [
          new TextRun({
            text: '3. DETAILED JOURNAL ENTRIES',
            bold: true,
            size: 24,
            font: 'Arial',
            color: '1E293B',
          }),
        ],
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        },
        rows: [
          // Header
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 12, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Date',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Reference',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 28, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Description',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'Debit',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'Credit',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "2563EB" },
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'Balance',
                        bold: true,
                        size: 18,
                        font: 'Arial',
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Data rows
          ...data.journalEntries.map((entry, idx) => new TableRow({
            children: [
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: formatDate(entry.date),
                        size: 16,
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: entry.reference,
                        size: 16,
                        font: 'Arial',
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: entry.description,
                        size: 16,
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(entry.debit),
                        size: 16,
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(entry.credit),
                        size: 16,
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(entry.balance),
                        size: 16,
                        font: 'Arial',
                        bold: true,
                        color: entry.balance >= 0 ? '059669' : 'DC2626',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })),
          // Totals row
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "FEF3C7" },
                columnSpan: 3,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'TOTAL',
                        size: 18,
                        font: 'Arial',
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "FEF3C7" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(totalDebit),
                        size: 18,
                        font: 'Arial',
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "FEF3C7" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(totalCredit),
                        size: 18,
                        font: 'Arial',
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "FEF3C7" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(netBalance),
                        size: 18,
                        font: 'Arial',
                        bold: true,
                        color: netBalance >= 0 ? '059669' : 'DC2626',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Footer Section
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: 'DATA INTEGRITY & VERIFICATION',
          bold: true,
          size: 20,
          font: 'Arial',
          color: '475569',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Laporan ini dihasilkan langsung dari sistem Premium Warehouse Ledger yang mengintegrasikan modul Human Capital dan Logistik ke General Ledger. Semua transaksi telah diverifikasi melalui prinsip zero re-typing untuk memastikan akurasi data finansial secara real-time.',
          size: 18,
          font: 'Arial',
          italics: true,
        }),
      ],
    }),

    // Signature Section
    new Paragraph({ text: '' }),
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
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Bekasi, ${formatDate(currentDate.toISOString())}`,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: '(_____________________)',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Finance Manager',
                      size: 20,
                      font: 'Arial',
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Bekasi, ${formatDate(currentDate.toISOString())}`,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: '(_____________________)',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Direktur Utama',
                      size: 20,
                      font: 'Arial',
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // Final Footer
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '© 2026 PT GEMA TEKNIK PERKASA',
          size: 16,
          font: 'Arial',
          color: '94A3B8',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Dokumen ini bersifat rahasia dan hanya untuk kepentingan internal perusahaan.',
          size: 16,
          font: 'Arial',
          color: '94A3B8',
          italics: true,
        }),
      ],
    })
  );

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
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const reportTypeName = isFull ? 'FULL_REPORT' : 'LEDGER_SUMMARY';
  link.download = `GTP_GENERAL_LEDGER_${reportTypeName}_${currentDate.getFullYear()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
