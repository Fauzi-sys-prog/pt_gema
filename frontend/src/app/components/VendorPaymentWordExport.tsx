import { 
  Document, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  HeadingLevel,
  convertInchesToTwip,
  Packer
} from 'docx';
import type { VendorExpense, Project, Vendor } from '../contexts/AppContext';

export const downloadExpenseReportWord = async (
  expenses: VendorExpense[],
  projects: Project[],
  vendors: Vendor[]
) => {
  const today = new Date().toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.totalNominal, 0);
  const pendingCount = expenses.filter(e => e.status === 'Pending Approval').length;
  const approvedCount = expenses.filter(e => e.status === 'Approved').length;
  const paidCount = expenses.filter(e => e.status === 'Paid').length;

  // Group by category
  const byCategory = expenses.reduce((acc, exp) => {
    acc[exp.kategori] = (acc[exp.kategori] || 0) + exp.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  // Group by vendor
  const byVendor = expenses.reduce((acc, exp) => {
    acc[exp.vendorName] = (acc[exp.vendorName] || 0) + exp.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children: [
          // HEADER - Company Logo & Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'GM TEKNIK',
                bold: true,
                size: 32,
                font: 'Arial Black',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'PT. GEMA TEKNIK PERKASA',
                bold: true,
                size: 24,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Jl. Raya Narogong KM 16, Cileungsi - Bogor 16820',
                size: 18,
                font: 'Arial',
                italics: true,
              }),
            ],
          }),

          // Border Line
          new Paragraph({
            border: {
              bottom: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { after: 300 },
          }),

          // Document Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'LAPORAN VENDOR PAYMENT & EXPENSE TRACKING',
                bold: true,
                size: 28,
                font: 'Arial Black',
                allCaps: true,
              }),
            ],
          }),

          // Report Info
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: `Tanggal Cetak: ${today}`,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `Total Transaksi: ${expenses.length} expenses`,
                size: 20,
                font: 'Arial',
                bold: true,
              }),
            ],
          }),

          // EXECUTIVE SUMMARY
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: 'EXECUTIVE SUMMARY',
                bold: true,
                size: 24,
                font: 'Arial Black',
                allCaps: true,
              }),
            ],
          }),

          // Summary Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: '2563EB' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'METRIK',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '2563EB' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'NILAI',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
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
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Total Expenses',
                            size: 20,
                            font: 'Arial',
                            bold: true,
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
                            text: `Rp ${totalExpenses.toLocaleString('id-ID')}`,
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
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Pending Approval',
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
                            text: `${pendingCount} items`,
                            size: 20,
                            font: 'Arial',
                            color: 'D97706',
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
                            text: 'Approved',
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
                            text: `${approvedCount} items`,
                            size: 20,
                            font: 'Arial',
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
                            text: 'Paid',
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
                            text: `${paidCount} items`,
                            size: 20,
                            font: 'Arial',
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

          // EXPENSE BY CATEGORY
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BREAKDOWN BY CATEGORY',
                bold: true,
                size: 24,
                font: 'Arial Black',
                allCaps: true,
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: '059669' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'KATEGORI',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '059669' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'NOMINAL',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '059669' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'PERCENTAGE',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const percentage = ((amount / totalExpenses) * 100).toFixed(1);
                  return new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: category,
                                size: 20,
                                font: 'Arial',
                                bold: true,
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
                                text: `Rp ${amount.toLocaleString('id-ID')}`,
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
                                text: `${percentage}%`,
                                size: 20,
                                font: 'Arial',
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

          // TOP VENDORS
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'TOP VENDORS BY SPENDING',
                bold: true,
                size: 24,
                font: 'Arial Black',
                allCaps: true,
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'DC2626' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: 'RANK',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: 'DC2626' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'VENDOR',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: 'DC2626' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'TOTAL SPENDING',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...Object.entries(byVendor)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([vendorName, amount], index) => {
                  return new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: `#${index + 1}`,
                                size: 20,
                                font: 'Arial Black',
                                bold: true,
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
                                text: vendorName,
                                size: 20,
                                font: 'Arial',
                                bold: true,
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
                                text: `Rp ${amount.toLocaleString('id-ID')}`,
                                size: 20,
                                font: 'Arial',
                                bold: true,
                                color: 'DC2626',
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

          // DETAILED EXPENSE LIST
          new Paragraph({
            spacing: { before: 400, after: 200 },
            pageBreakBefore: true,
            children: [
              new TextRun({
                text: 'DETAILED EXPENSE LIST',
                bold: true,
                size: 24,
                font: 'Arial Black',
                allCaps: true,
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'NO',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'TANGGAL',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'VENDOR',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'KATEGORI',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'KETERANGAN',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'NOMINAL',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: '1E293B' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: 'STATUS',
                            bold: true,
                            size: 18,
                            font: 'Arial Black',
                            color: 'FFFFFF',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...expenses.map((expense, index) => {
                return new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: (index + 1).toString(),
                              size: 18,
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
                              text: new Date(expense.tanggal).toLocaleDateString('id-ID'),
                              size: 18,
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
                              text: expense.vendorName,
                              size: 18,
                              font: 'Arial',
                              bold: true,
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
                              text: expense.kategori,
                              size: 18,
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
                              text: expense.keterangan,
                              size: 18,
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
                              text: `Rp ${expense.totalNominal.toLocaleString('id-ID')}`,
                              size: 18,
                              font: 'Arial',
                              bold: true,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: expense.status,
                              size: 18,
                              font: 'Arial',
                              bold: true,
                              color: 
                                expense.status === 'Paid' ? '059669' :
                                expense.status === 'Approved' ? '2563EB' :
                                expense.status === 'Pending Approval' ? 'D97706' :
                                expense.status === 'Rejected' ? 'DC2626' :
                                '64748B',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                });
              }),
              // TOTAL ROW
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 5,
                    shading: { fill: 'F1F5F9' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: 'TOTAL:',
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: 'F1F5F9' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: `Rp ${totalExpenses.toLocaleString('id-ID')}`,
                            bold: true,
                            size: 20,
                            font: 'Arial Black',
                            color: '059669',
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: 'F1F5F9' },
                    children: [new Paragraph({ text: '' })],
                  }),
                ],
              }),
            ],
          }),

          // FOOTER
          new Paragraph({
            spacing: { before: 400 },
            border: {
              top: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: 'PT. GEMA TEKNIK PERKASA',
                size: 18,
                font: 'Arial',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Dicetak pada: ${today}`,
                size: 16,
                font: 'Arial',
                italics: true,
                color: '64748B',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  
  // Download the file using browser API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Expense_Report_${new Date().toISOString().split('T')[0]}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};