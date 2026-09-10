import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ImageRun } from 'docx';
import logoImage from 'figma:asset/c160c5e311765b579db730c3b0e0bd4dd7d18339.png';

interface AuditPackData {
  reportType: string;
  finStats: {
    totalRevenue: number;
    totalReceivable: number;
    inventoryValue: number;
    netPosition: number;
  };
  opsStats: {
    efficiency: number;
    activeProjects: number;
    completedProjects: number;
    totalWO: number;
  };
  projects: Array<{
    name: string;
    status: string;
    nilaiKontrak?: number;
    progress?: number;
  }>;
  inventoryItems?: Array<{
    nama: string;
    kategori: string;
    jumlah: number;
    satuan: string;
    hargaSatuan: number;
  }>;
  invoices?: Array<{
    nomorInvoice: string;
    projectName?: string;
    totalAmount: number;
    status: string;
  }>;
}

export const exportAuditPackToWord = async (data: AuditPackData) => {
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

  // Build document content based on report type
  const children: any[] = [
    // Header - Logo and Company Info
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: "4F46E5" },
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
          text: 'EXECUTIVE COMMAND CENTER',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '4F46E5',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `AUDIT REPORT - ${data.reportType.toUpperCase()}`,
          bold: true,
          size: 28,
          font: 'Arial',
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
              shading: { fill: "F1F5F9" },
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
                      text: data.reportType,
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
              shading: { fill: "F1F5F9" },
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
              shading: { fill: "F1F5F9" },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Classification',
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
                      text: 'CONFIDENTIAL - INTERNAL USE ONLY',
                      size: 20,
                      font: 'Arial',
                      color: 'DC2626',
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

    // Spacing
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),

    // Section 1: Executive Summary
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: '1. EXECUTIVE SUMMARY',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '1E293B',
        }),
      ],
    }),

    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Laporan ini menyajikan konsolidasi data finansial dan operasional PT Gema Teknik Perkasa yang telah diverifikasi melalui sistem Premium Warehouse Ledger dengan prinsip zero re-typing.',
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
  ];

  // Add Financial Consolidation Table
  if (data.reportType === 'Financial Consolidation' || data.reportType === 'Full Compliance Pack') {
    children.push(
      new Paragraph({
        spacing: { before: 150, after: 150 },
        children: [
          new TextRun({
            text: '2. KONSOLIDASI FINANSIAL',
            bold: true,
            size: 22,
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
          // Header Row
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "4F46E5" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'INDIKATOR UTAMA',
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
                shading: { fill: "4F46E5" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'NILAI (IDR)',
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
                shading: { fill: "4F46E5" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'STATUS',
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
          // Data Rows
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Aggregate Revenue',
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
                        text: formatCurrency(data.finStats.totalRevenue),
                        size: 20,
                        font: 'Arial',
                        bold: true,
                        color: '4F46E5',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: "F8FAFC" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'VERIFIED',
                        size: 18,
                        font: 'Arial',
                        color: '059669',
                        bold: true,
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
                        text: 'Accounts Receivable (AR)',
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
                        text: formatCurrency(data.finStats.totalReceivable),
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
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'ACTION REQUIRED',
                        size: 18,
                        font: 'Arial',
                        color: 'DC2626',
                        bold: true,
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
                        text: 'Inventory Capital',
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
                        text: formatCurrency(data.finStats.inventoryValue),
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
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'STABLE',
                        size: 18,
                        font: 'Arial',
                        color: '0284C7',
                        bold: true,
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
                        text: 'Net Cash Position',
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
                        text: formatCurrency(data.finStats.netPosition),
                        size: 20,
                        font: 'Arial',
                        bold: true,
                        color: '4F46E5',
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
                        text: 'LIQUID',
                        size: 18,
                        font: 'Arial',
                        color: '059669',
                        bold: true,
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

  // Add Operational Audit
  if (data.reportType === 'Operational Audit' || data.reportType === 'Full Compliance Pack') {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        spacing: { before: 200, after: 150 },
        children: [
          new TextRun({
            text: '3. OPERATIONAL AUDIT',
            bold: true,
            size: 22,
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
                shading: { fill: "4F46E5" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'OPERATIONAL METRICS',
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
                shading: { fill: "4F46E5" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: 'VALUE',
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
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Manufacturing Output Efficiency',
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
                        text: `${Math.round(data.opsStats.efficiency)}%`,
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
                        text: 'Active Projects',
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
                        text: data.opsStats.activeProjects.toString(),
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
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "F8FAFC" },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Completed Projects',
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
                        text: data.opsStats.completedProjects.toString(),
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
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Total Work Orders',
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
                        text: data.opsStats.totalWO.toString(),
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
      })
    );

    // Top 5 Projects Table
    if (data.projects && data.projects.length > 0) {
      const topProjects = data.projects.slice(0, 5);
      children.push(
        new Paragraph({ text: '' }),
        new Paragraph({
          spacing: { before: 150, after: 100 },
          children: [
            new TextRun({
              text: '3.1 Top 5 Active Projects',
              bold: true,
              size: 20,
              font: 'Arial',
              color: '475569',
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
                  shading: { fill: "F1F5F9" },
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'Project Name',
                          bold: true,
                          size: 18,
                          font: 'Arial',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { fill: "F1F5F9" },
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: 'Status',
                          bold: true,
                          size: 18,
                          font: 'Arial',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { fill: "F1F5F9" },
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: 'Contract Value',
                          bold: true,
                          size: 18,
                          font: 'Arial',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            ...topProjects.map((project, idx) => new TableRow({
              children: [
                new TableCell({
                  shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: project.name,
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
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: project.status,
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
                          text: formatCurrency(project.nilaiKontrak || 0),
                          size: 18,
                          font: 'Arial',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })),
          ],
        })
      );
    }
  }

  // Add Inventory Valuation
  if (data.reportType === 'Inventory Valuation' || data.reportType === 'Full Compliance Pack') {
    if (data.inventoryItems && data.inventoryItems.length > 0) {
      const topInventory = data.inventoryItems.slice(0, 10);
      children.push(
        new Paragraph({ text: '' }),
        new Paragraph({
          spacing: { before: 200, after: 150 },
          children: [
            new TextRun({
              text: '4. INVENTORY VALUATION & STOCK ANALYSIS',
              bold: true,
              size: 22,
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
                  shading: { fill: "4F46E5" },
                  width: { size: 35, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'Item Name',
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
                  shading: { fill: "4F46E5" },
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'Category',
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
                  shading: { fill: "4F46E5" },
                  width: { size: 15, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: 'Qty',
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
                  shading: { fill: "4F46E5" },
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: 'Total Value',
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
            ...topInventory.map((item, idx) => new TableRow({
              children: [
                new TableCell({
                  shading: { fill: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item.nama,
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
                      children: [
                        new TextRun({
                          text: item.kategori,
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
                          text: `${item.jumlah} ${item.satuan}`,
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
                          text: formatCurrency(item.jumlah * item.hargaSatuan),
                          size: 18,
                          font: 'Arial',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })),
          ],
        })
      );
    }
  }

  // Footer Section
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: 'DATA INTEGRITY STATEMENT',
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
          text: 'Seluruh data di atas mencakup laporan material dari site aktif dan telah melewati proses audit sinkronisasi zero re-typing. Data ini dihasilkan langsung dari sistem Premium Warehouse Ledger yang mengintegrasikan modul Human Capital dan Logistik ke General Ledger untuk memastikan akurasi margin proyek secara real-time.',
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
              children: [new Paragraph({ text: '' })],
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
  link.download = `GTP_AUDIT_${data.reportType.toUpperCase().replace(/\s/g, '_')}_${currentDate.getFullYear()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
