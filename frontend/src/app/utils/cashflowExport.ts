import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun } from 'docx';
import logoImage from 'figma:asset/c160c5e311765b579db730c3b0e0bd4dd7d18339.png';

interface CashflowData {
  inflow: number;
  outflowPurchases: number;
  outflowPayroll: number;
  totalOutflow: number;
  netCashflow: number;
  chartData: Array<{
    month: string;
    inflow: number;
    outflow: number;
  }>;
  period: string;
}

export const exportCashflowToWord = async (data: CashflowData) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (date: Date) => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatDateTime = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${formatDate(date)} - ${h}:${m} WIB`;
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
  const growthPercentage = data.inflow > 0 
    ? (((data.inflow - data.totalOutflow) / data.inflow) * 100).toFixed(1)
    : '0';

  const children: any[] = [
    // Header - Logo and Company Info
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: "10B981" },
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
          text: 'CASHFLOW STATEMENT',
          bold: true,
          size: 32,
          font: 'Arial',
          color: '10B981',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'LIQUID ASSETS & TRANSACTION FLOW',
          bold: true,
          size: 20,
          font: 'Arial',
          color: '64748B',
        }),
      ],
    }),

    // Metadata
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
              shading: { fill: "ECFDF5" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Report Period',
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
                      text: data.period,
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
              shading: { fill: "ECFDF5" },
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
      ],
    }),

    // Spacing
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),

    // Executive Summary
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: '1. EXECUTIVE CASHFLOW SUMMARY',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '1E293B',
        }),
      ],
    }),

    // Main KPI Table
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
        // Inflow Section
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "10B981" },
              columnSpan: 2,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'TOTAL INFLOW (REVENUE)',
                      bold: true,
                      size: 22,
                      font: 'Arial',
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
              shading: { fill: "F0FDF4" },
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Customer Payments & Revenue',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "F0FDF4" },
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.inflow),
                      size: 22,
                      font: 'Arial',
                      bold: true,
                      color: '10B981',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Spacing row
        new TableRow({
          height: { value: 200, rule: 'atLeast' },
          children: [
            new TableCell({
              columnSpan: 2,
              children: [new Paragraph({ text: '' })],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
          ],
        }),
        // Outflow Section
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "DC2626" },
              columnSpan: 2,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'TOTAL OUTFLOW (EXPENSES)',
                      bold: true,
                      size: 22,
                      font: 'Arial',
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
              shading: { fill: "FEF2F2" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Material & Inventory Purchases',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "FEF2F2" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.outflowPurchases),
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
              shading: { fill: "FFFFFF" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Payroll & Labor Costs',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "FFFFFF" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.outflowPayroll),
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
              shading: { fill: "FEF2F2" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'TOTAL OUTFLOW',
                      size: 20,
                      font: 'Arial',
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "FEF2F2" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: formatCurrency(data.totalOutflow),
                      size: 22,
                      font: 'Arial',
                      bold: true,
                      color: 'DC2626',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Spacing row
        new TableRow({
          height: { value: 200, rule: 'atLeast' },
          children: [
            new TableCell({
              columnSpan: 2,
              children: [new Paragraph({ text: '' })],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
          ],
        }),
        // Net Cash Position
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "1E293B" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'NET CASH POSITION',
                      bold: true,
                      size: 24,
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
                      text: formatCurrency(data.netCashflow),
                      bold: true,
                      size: 26,
                      font: 'Arial',
                      color: data.netCashflow >= 0 ? '10B981' : 'FCA5A5',
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
              shading: { fill: "334155" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Health Status',
                      size: 18,
                      font: 'Arial',
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: "334155" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: data.netCashflow >= 0 ? 'HEALTHY BALANCE ✓' : 'DEFICIT ALERT ⚠',
                      size: 18,
                      font: 'Arial',
                      color: data.netCashflow >= 0 ? '10B981' : 'FCA5A5',
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

    new Paragraph({ text: '' }),

    // Monthly Trend Analysis
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: '2. MONTHLY CASHFLOW TREND ANALYSIS',
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
              shading: { fill: "10B981" },
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'MONTH',
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
              shading: { fill: "10B981" },
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'INFLOW',
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
              shading: { fill: "10B981" },
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'OUTFLOW',
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
              shading: { fill: "10B981" },
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'NET',
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
        ...data.chartData.map((item, idx) => {
          const net = item.inflow - item.outflow;
          return new TableRow({
            children: [
              new TableCell({
                shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: item.month,
                        size: 18,
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
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: formatCurrency(item.inflow),
                        size: 18,
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
                        text: formatCurrency(item.outflow),
                        size: 18,
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
                        text: formatCurrency(net),
                        size: 18,
                        font: 'Arial',
                        bold: true,
                        color: net >= 0 ? '10B981' : 'DC2626',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          });
        }),
      ],
    }),

    // Footer Section
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: 'DATA VERIFICATION & NOTES',
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
          text: 'Laporan cashflow ini dihasilkan dari sistem Premium Warehouse Ledger yang mengintegrasikan data dari AR (Accounts Receivable), AP (Accounts Payable), dan Payroll Management. Semua transaksi telah diverifikasi melalui prinsip zero re-typing untuk memastikan akurasi data real-time.',
          size: 18,
          font: 'Arial',
          italics: true,
        }),
      ],
    }),

    // Signature
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
                      text: `Bekasi, ${formatDate(currentDate)}`,
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
                      text: `Bekasi, ${formatDate(currentDate)}`,
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
  ];

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
  link.download = `GTP_CASHFLOW_STATEMENT_${data.period.replace(/\s/g, '_').toUpperCase()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportCashflowToExcel = (data: CashflowData) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const currentDate = new Date().toLocaleString('id-ID');

  const csvContent = `
"PT GEMA TEKNIK PERKASA"
"CASHFLOW STATEMENT - ${data.period.toUpperCase()}"
"Generated:","${currentDate}"

"EXECUTIVE SUMMARY"
"Metric","Value"
"Total Inflow (Revenue)","${formatCurrency(data.inflow)}"
"Material & Inventory Purchases","${formatCurrency(data.outflowPurchases)}"
"Payroll & Labor Costs","${formatCurrency(data.outflowPayroll)}"
"Total Outflow (Expenses)","${formatCurrency(data.totalOutflow)}"
"Net Cash Position","${formatCurrency(data.netCashflow)}"
"Health Status","${data.netCashflow >= 0 ? 'HEALTHY BALANCE' : 'DEFICIT ALERT'}"

"MONTHLY TREND ANALYSIS"
"Month","Inflow","Outflow","Net"
${data.chartData.map(item => 
  `"${item.month}","${formatCurrency(item.inflow)}","${formatCurrency(item.outflow)}","${formatCurrency(item.inflow - item.outflow)}"`
).join('\n')}

"CONFIDENTIAL: INTERNAL USE ONLY"
"© 2026 PT Gema Teknik Perkasa"
  `.trim();

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GTP_CASHFLOW_STATEMENT_${data.period.replace(/\s/g, '_').toUpperCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
