import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } from 'docx';

interface ExportProjectPreparationProps {
  // Informasi Umum
  namaProyek: string;
  customer: string;
  lokasiKerja: string;
  durasiProyek: string;
  notes: string;
  
  // Scope of Work
  scopeOfWork?: Array<{
    item: string;
    owner: 'Gema' | 'User' | 'Customer';
    notes?: string;
  }>;
  
  // Tools & Equipment
  equipment?: Array<{
    namaPeralatan: string;
    jenisPeralatan: string;
    jumlah: number;
    keterangan: string;
  }>;
  
  // Manpower
  manpower?: Array<{
    jabatan: string;
    jumlah: number;
    sertifikat: string;
    keterangan: string;
  }>;
  
  // Schedule
  schedule?: Array<{
    deskripsiPekerjaan: string;
    area: string;
    jumlahHari: number;
    keterangan: string;
  }>;
  
  // Consumables
  consumables?: Array<{
    deskripsiConsumable: string;
    unit: string;
    jumlahBarang: number;
    keterangan: string;
  }>;
  
  // BOM Materials (Detailed)
  bomDetailed?: Array<{
    no: number;
    area: string;
    product: string;
    kgM3?: number;
    thickness?: number;
    surface?: number;
    volume?: number;
    weightInstalled?: number;
    quantityInstalled?: number;
    unit: string;
    reversePercent?: number;
    unitSize?: number;
    quantityDelivery?: number;
  }>;
  
  // BOM Summary
  bomSummary?: Array<{
    no: number;
    product: string;
    density?: number;
    volume?: number;
    quantityInstalled?: number;
    quantityDelivered?: number;
    unit: string;
    totalWeight?: number;
  }>;
  
  // Document metadata
  createdBy: string;
  date: string;
  rev: string;
  version?: string;
  approvedBy?: string;
}

export const exportProjectPreparationToWord = async (data: ExportProjectPreparationProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatNumber = (num: number | undefined) => {
    if (!num && num !== 0) return '-';
    return num.toLocaleString('id-ID');
  };

  // Helper function to create blue header cells
  const createBlueHeaderCell = (text: string, width?: number) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
              color: 'FFFFFF',
              size: 18,
            })
          ],
          alignment: AlignmentType.CENTER,
        })
      ],
      shading: { fill: '4472C4' },
      verticalAlign: VerticalAlign.CENTER,
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      margins: {
        top: 100,
        bottom: 100,
        left: 100,
        right: 100,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' },
      },
    });
  };

  // Helper function to create orange header cells (for BOM)
  const createOrangeHeaderCell = (text: string, width?: number) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
              color: '000000',
              size: 18,
            })
          ],
          alignment: AlignmentType.CENTER,
        })
      ],
      shading: { fill: 'FFC000' },
      verticalAlign: VerticalAlign.CENTER,
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      margins: {
        top: 100,
        bottom: 100,
        left: 100,
        right: 100,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: 'FFC000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'FFC000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: 'FFC000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: 'FFC000' },
      },
    });
  };

  // Helper function to create data cells
  const createDataCell = (text: string, align: AlignmentType = AlignmentType.LEFT, width?: number, shading?: string) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: 18,
            })
          ],
          alignment: align,
        })
      ],
      verticalAlign: VerticalAlign.CENTER,
      width: width ? { size: width, type: WidthType.DXA } : undefined,
      shading: shading ? { fill: shading } : undefined,
      margins: {
        top: 80,
        bottom: 80,
        left: 100,
        right: 100,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC' },
      },
    });
  };

  // Helper for subtotal cells
  const createSubtotalCell = (text: string, align: AlignmentType = AlignmentType.CENTER) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
              size: 18,
            })
          ],
          alignment: align,
        })
      ],
      shading: { fill: 'E7E6E6' },
      verticalAlign: VerticalAlign.CENTER,
      margins: {
        top: 80,
        bottom: 80,
        left: 100,
        right: 100,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
      },
    });
  };

  // Calculate totals
  const totalScheduleDays = data.schedule?.reduce((sum, item) => sum + item.jumlahHari, 0) || 0;
  const totalManpower = data.manpower?.reduce((sum, item) => sum + item.jumlah, 0) || 0;

  const children: any[] = [];

  // ==================== HEADER: Title & Document Info ====================
  
  // Date and Version - Right aligned
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Date : ${formatDate(data.date)}`,
          size: 18,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Versi : ${data.version || 'Ver. Multi-Aksis'}`,
          size: 18,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
    })
  );

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Data Persiapan Pekerjaan Proyek',
          bold: true,
          size: 32,
          color: '4472C4',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // ==================== ROW 1: INFORMASI UMUM & SCOPE OF WORK (2 COLUMNS) ====================
  
  // Build Informasi Umum Table
  const infoUmumTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 3, color: "CCCCCC" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Informasi Umum',
                    bold: true,
                    color: 'FFFFFF',
                    size: 20,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            shading: { fill: '4472C4' },
            verticalAlign: VerticalAlign.CENTER,
            margins: {
              top: 120,
              bottom: 120,
              left: 100,
              right: 100,
            },
          }),
        ],
      }),
      new TableRow({
        children: [
          createDataCell('Nama Proyek : ' + data.namaProyek),
        ],
      }),
      new TableRow({
        children: [
          createDataCell('Customer : ' + data.customer),
        ],
      }),
      new TableRow({
        children: [
          createDataCell('Lokasi Kerja : ' + data.lokasiKerja),
        ],
      }),
      new TableRow({
        children: [
          createDataCell('Durasi Proyek : ' + data.durasiProyek),
        ],
      }),
    ],
  });

  // Build Scope of Work Table
  const scopeRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Scope Of Work',
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                })
              ],
              alignment: AlignmentType.CENTER,
            })
          ],
          shading: { fill: '4472C4' },
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 5,
          margins: {
            top: 120,
            bottom: 120,
            left: 100,
            right: 100,
          },
        }),
      ],
    }),
    new TableRow({
      children: [
        createBlueHeaderCell('Scope Nama Lingkup', 40),
        createBlueHeaderCell('Owner', 15),
        createBlueHeaderCell('Supply Material', 15),
        createBlueHeaderCell('Works', 15),
        createBlueHeaderCell('Notes', 15),
      ],
    }),
  ];

  if (data.scopeOfWork && data.scopeOfWork.length > 0) {
    data.scopeOfWork.forEach((item) => {
      scopeRows.push(
        new TableRow({
          children: [
            createDataCell(item.item, AlignmentType.LEFT, 40),
            createDataCell(item.owner, AlignmentType.CENTER, 15),
            createDataCell(item.owner === 'Gema' ? 'Yes' : '-', AlignmentType.CENTER, 15),
            createDataCell(item.owner === 'Customer' ? 'Yes' : '-', AlignmentType.CENTER, 15),
            createDataCell(item.notes || '-', AlignmentType.LEFT, 15),
          ],
        })
      );
    });
  }

  const scopeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: scopeRows,
  });

  // Create 2-column layout using a table
  children.push(
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
      columnWidths: [4800, 400, 4800], // Balanced columns with gap
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [infoUmumTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph('')],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              width: { size: 4, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [scopeTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    })
  );

  // Notes Section
  children.push(
    new Paragraph({
      text: '',
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      rows: [
        new TableRow({
          children: [
            createBlueHeaderCell('Notes', 100),
          ],
        }),
        new TableRow({
          children: [
            createDataCell(data.notes || '-', AlignmentType.LEFT, 100),
          ],
        }),
      ],
    })
  );

  // ==================== ROW 2: TOOLS & MANPOWER (2 COLUMNS) ====================
  
  children.push(
    new Paragraph({
      text: '',
      spacing: { before: 200, after: 100 },
    })
  );

  // Build Tools Table
  const toolsRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Tools',
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                })
              ],
              alignment: AlignmentType.CENTER,
            })
          ],
          shading: { fill: '4472C4' },
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 4,
          margins: {
            top: 120,
            bottom: 120,
            left: 100,
            right: 100,
          },
        }),
      ],
    }),
    new TableRow({
      children: [
        createBlueHeaderCell('Nama Peralatan', 35),
        createBlueHeaderCell('Jenis Peralatan', 30),
        createBlueHeaderCell('Jumlah', 15),
        createBlueHeaderCell('Keterangan', 20),
      ],
    }),
  ];

  if (data.equipment && data.equipment.length > 0) {
    data.equipment.forEach((item) => {
      toolsRows.push(
        new TableRow({
          children: [
            createDataCell(item.namaPeralatan, AlignmentType.LEFT, 35),
            createDataCell(item.jenisPeralatan, AlignmentType.CENTER, 30),
            createDataCell(String(item.jumlah), AlignmentType.CENTER, 15),
            createDataCell(item.keterangan, AlignmentType.LEFT, 20),
          ],
        })
      );
    });
  }

  const toolsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: toolsRows,
  });

  // Build Manpower Table
  const manpowerRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Manpower',
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                })
              ],
              alignment: AlignmentType.CENTER,
            })
          ],
          shading: { fill: '4472C4' },
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 4,
          margins: {
            top: 120,
            bottom: 120,
            left: 100,
            right: 100,
          },
        }),
      ],
    }),
    new TableRow({
      children: [
        createBlueHeaderCell('Jabatan', 30),
        createBlueHeaderCell('Jumlah', 15),
        createBlueHeaderCell('Sertifikat', 25),
        createBlueHeaderCell('Keterangan', 30),
      ],
    }),
  ];

  if (data.manpower && data.manpower.length > 0) {
    data.manpower.forEach((item) => {
      manpowerRows.push(
        new TableRow({
          children: [
            createDataCell(item.jabatan, AlignmentType.LEFT, 30),
            createDataCell(String(item.jumlah), AlignmentType.CENTER, 15),
            createDataCell(item.sertifikat, AlignmentType.CENTER, 25),
            createDataCell(item.keterangan, AlignmentType.LEFT, 30),
          ],
        })
      );
    });

    // Subtotal row
    manpowerRows.push(
      new TableRow({
        children: [
          createSubtotalCell('Subtotal', AlignmentType.RIGHT),
          createSubtotalCell(String(totalManpower), AlignmentType.CENTER),
          new TableCell({
            children: [new Paragraph('')],
            shading: { fill: 'E7E6E6' },
            columnSpan: 2,
          }),
        ],
      })
    );
  }

  const manpowerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: manpowerRows,
  });

  // Create 2-column layout for Tools & Manpower
  children.push(
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
      columnWidths: [4800, 400, 4800],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [toolsTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph('')],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              width: { size: 4, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [manpowerTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    })
  );

  // ==================== ROW 3: SCHEDULE & CONSUMABLES (2 COLUMNS) ====================
  
  children.push(
    new Paragraph({
      text: '',
      spacing: { before: 200, after: 100 },
    })
  );

  // Build Schedule Table
  const scheduleRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Schedule Pekerjaan',
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                })
              ],
              alignment: AlignmentType.CENTER,
            })
          ],
          shading: { fill: '4472C4' },
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 4,
          margins: {
            top: 120,
            bottom: 120,
            left: 100,
            right: 100,
          },
        }),
      ],
    }),
    new TableRow({
      children: [
        createBlueHeaderCell('Deskripsi Pekerjaan', 40),
        createBlueHeaderCell('Area', 20),
        createBlueHeaderCell('Jumlah Hari', 15),
        createBlueHeaderCell('Keterangan', 25),
      ],
    }),
  ];

  if (data.schedule && data.schedule.length > 0) {
    data.schedule.forEach((item) => {
      scheduleRows.push(
        new TableRow({
          children: [
            createDataCell(item.deskripsiPekerjaan, AlignmentType.LEFT, 40),
            createDataCell(item.area, AlignmentType.CENTER, 20),
            createDataCell(String(item.jumlahHari), AlignmentType.CENTER, 15),
            createDataCell(item.keterangan, AlignmentType.LEFT, 25),
          ],
        })
      );
    });

    // Subtotal row
    scheduleRows.push(
      new TableRow({
        children: [
          createSubtotalCell('Subtotal', AlignmentType.RIGHT),
          new TableCell({
            children: [new Paragraph('')],
            shading: { fill: 'E7E6E6' },
          }),
          createSubtotalCell(String(totalScheduleDays), AlignmentType.CENTER),
          new TableCell({
            children: [new Paragraph('')],
            shading: { fill: 'E7E6E6' },
          }),
        ],
      })
    );
  }

  const scheduleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: scheduleRows,
  });

  // Build Consumables Table
  const consumableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Consumable Pekerjaan',
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                })
              ],
              alignment: AlignmentType.CENTER,
            })
          ],
          shading: { fill: '4472C4' },
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 4,
          margins: {
            top: 120,
            bottom: 120,
            left: 100,
            right: 100,
          },
        }),
      ],
    }),
    new TableRow({
      children: [
        createBlueHeaderCell('Deskripsi', 50),
        createBlueHeaderCell('Unit', 15),
        createBlueHeaderCell('Jumlah', 15),
        createBlueHeaderCell('Keterangan', 20),
      ],
    }),
  ];

  if (data.consumables && data.consumables.length > 0) {
    data.consumables.forEach((item) => {
      consumableRows.push(
        new TableRow({
          children: [
            createDataCell(item.deskripsiConsumable, AlignmentType.LEFT, 50),
            createDataCell(item.unit, AlignmentType.CENTER, 15),
            createDataCell(String(item.jumlahBarang), AlignmentType.CENTER, 15),
            createDataCell(item.keterangan, AlignmentType.LEFT, 20),
          ],
        })
      );
    });
  }

  const consumableTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4472C4" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: consumableRows,
  });

  // Create 2-column layout for Schedule & Consumables
  children.push(
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
      columnWidths: [4800, 400, 4800],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [scheduleTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph('')],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              width: { size: 4, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [consumableTable],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    })
  );

  // ==================== PAGE 2: BILL OF MATERIAL - DETAILED BOM ====================
  
  if (data.bomDetailed && data.bomDetailed.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'BILL OF MATERIAL',
            bold: true,
            size: 28,
            color: '4472C4',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100 },
        pageBreakBefore: true,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Detailed BOM',
            size: 24,
            color: '4472C4',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Technical Information Header
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'TECHNICAL INFORMATION',
                        bold: true,
                        color: '000000',
                        size: 20,
                      })
                    ],
                    alignment: AlignmentType.CENTER,
                  })
                ],
                shading: { fill: 'FFC000' },
                verticalAlign: VerticalAlign.CENTER,
                columnSpan: 2,
                margins: {
                  top: 120,
                  bottom: 120,
                  left: 100,
                  right: 100,
                },
              }),
            ],
          }),
          new TableRow({
            children: [
              createDataCell(`Project Name: ${data.namaProyek}`, AlignmentType.LEFT, 50),
              createDataCell(`Customer: ${data.customer}`, AlignmentType.LEFT, 50),
            ],
          }),
          new TableRow({
            children: [
              createDataCell(`Location: ${data.lokasiKerja}`, AlignmentType.LEFT, 50),
              createDataCell(`Date: ${formatDate(data.date)}`, AlignmentType.LEFT, 50),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
      })
    );

    // Detailed BOM Table
    const bomDetailedRows: TableRow[] = [
      new TableRow({
        children: [
          createOrangeHeaderCell('NO', 4),
          createOrangeHeaderCell('AREA', 12),
          createOrangeHeaderCell('PRODUCT', 18),
          createOrangeHeaderCell('Kg/m3', 8),
          createOrangeHeaderCell('Thickness (mm)', 8),
          createOrangeHeaderCell('Surface (m2)', 8),
          createOrangeHeaderCell('Volume (m3)', 8),
          createOrangeHeaderCell('Weight Installed', 10),
          createOrangeHeaderCell('Qty Installed', 8),
          createOrangeHeaderCell('Unit', 6),
          createOrangeHeaderCell('Rev %', 5),
          createOrangeHeaderCell('Qty Delivery', 5),
        ],
      }),
    ];

    data.bomDetailed.forEach((item) => {
      bomDetailedRows.push(
        new TableRow({
          children: [
            createDataCell(String(item.no), AlignmentType.CENTER, 4),
            createDataCell(item.area, AlignmentType.LEFT, 12),
            createDataCell(item.product, AlignmentType.LEFT, 18),
            createDataCell(formatNumber(item.kgM3), AlignmentType.RIGHT, 8),
            createDataCell(formatNumber(item.thickness), AlignmentType.RIGHT, 8),
            createDataCell(formatNumber(item.surface), AlignmentType.RIGHT, 8),
            createDataCell(formatNumber(item.volume), AlignmentType.RIGHT, 8),
            createDataCell(formatNumber(item.weightInstalled), AlignmentType.RIGHT, 10),
            createDataCell(formatNumber(item.quantityInstalled), AlignmentType.RIGHT, 8),
            createDataCell(item.unit, AlignmentType.CENTER, 6),
            createDataCell(String(item.reversePercent || 10) + '%', AlignmentType.CENTER, 5),
            createDataCell(formatNumber(item.quantityDelivery), AlignmentType.RIGHT, 5),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows: bomDetailedRows,
      })
    );
  }

  // ==================== PAGE 3: BILL OF MATERIAL - SUMMARY BOM ====================
  
  if (data.bomSummary && data.bomSummary.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'BILL OF MATERIAL',
            bold: true,
            size: 28,
            color: '4472C4',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100 },
        pageBreakBefore: true,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Summary BOM',
            size: 24,
            color: '4472C4',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Technical Information Header
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'TECHNICAL INFORMATION',
                        bold: true,
                        color: '000000',
                        size: 20,
                      })
                    ],
                    alignment: AlignmentType.CENTER,
                  })
                ],
                shading: { fill: 'FFC000' },
                verticalAlign: VerticalAlign.CENTER,
                columnSpan: 2,
                margins: {
                  top: 120,
                  bottom: 120,
                  left: 100,
                  right: 100,
                },
              }),
            ],
          }),
          new TableRow({
            children: [
              createDataCell(`Project Name: ${data.namaProyek}`, AlignmentType.LEFT, 50),
              createDataCell(`Rev: ${data.rev}`, AlignmentType.LEFT, 50),
            ],
          }),
          new TableRow({
            children: [
              createDataCell(`Customer: ${data.customer}`, AlignmentType.LEFT, 50),
              createDataCell(`Date: ${formatDate(data.date)}`, AlignmentType.LEFT, 50),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
      })
    );

    // Summary BOM Table
    const bomSummaryRows: TableRow[] = [
      new TableRow({
        children: [
          createOrangeHeaderCell('NO', 5),
          createOrangeHeaderCell('PRODUCT', 30),
          createOrangeHeaderCell('Density (Kg/m3)', 12),
          createOrangeHeaderCell('Volume (m3)', 12),
          createOrangeHeaderCell('Quantity Installed', 13),
          createOrangeHeaderCell('Quantity Delivered', 13),
          createOrangeHeaderCell('Unit', 8),
          createOrangeHeaderCell('Total Weight (kg)', 12),
        ],
      }),
    ];

    let totalQuantityInstalled = 0;
    let totalQuantityDelivered = 0;
    let totalWeight = 0;

    data.bomSummary.forEach((item) => {
      totalQuantityInstalled += item.quantityInstalled || 0;
      totalQuantityDelivered += item.quantityDelivered || 0;
      totalWeight += item.totalWeight || 0;

      bomSummaryRows.push(
        new TableRow({
          children: [
            createDataCell(String(item.no), AlignmentType.CENTER, 5),
            createDataCell(item.product, AlignmentType.LEFT, 30),
            createDataCell(formatNumber(item.density), AlignmentType.RIGHT, 12),
            createDataCell(formatNumber(item.volume), AlignmentType.RIGHT, 12),
            createDataCell(formatNumber(item.quantityInstalled), AlignmentType.RIGHT, 13),
            createDataCell(formatNumber(item.quantityDelivered), AlignmentType.RIGHT, 13),
            createDataCell(item.unit, AlignmentType.CENTER, 8),
            createDataCell(formatNumber(item.totalWeight), AlignmentType.RIGHT, 12),
          ],
        })
      );
    });

    // Total row with blue background
    bomSummaryRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'TOTAL',
                    bold: true,
                    color: 'FFFFFF',
                    size: 18,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            shading: { fill: '4472C4' },
            columnSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatNumber(totalQuantityInstalled),
                    bold: true,
                    color: 'FFFFFF',
                    size: 18,
                  })
                ],
                alignment: AlignmentType.RIGHT,
              })
            ],
            shading: { fill: '4472C4' },
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatNumber(totalQuantityDelivered),
                    bold: true,
                    color: 'FFFFFF',
                    size: 18,
                  })
                ],
                alignment: AlignmentType.RIGHT,
              })
            ],
            shading: { fill: '4472C4' },
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph('')],
            shading: { fill: '4472C4' },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatNumber(totalWeight),
                    bold: true,
                    color: 'FFFFFF',
                    size: 18,
                  })
                ],
                alignment: AlignmentType.RIGHT,
              })
            ],
            shading: { fill: '4472C4' },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "FFC000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows: bomSummaryRows,
      })
    );

    // Note at bottom
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Note : *',
            italics: true,
            size: 16,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { before: 200 },
      })
    );
  }

  // ==================== FOOTER ====================
  children.push(
    new Paragraph({
      text: '',
      spacing: { before: 400 },
    })
  );

  children.push(
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
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Dibuat Oleh : ', bold: true, size: 18 }),
                    new TextRun({ text: data.createdBy, size: 18 }),
                  ],
                })
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
                  children: [
                    new TextRun({ text: 'Mengetahui : ', bold: true, size: 18 }),
                    new TextRun({ text: data.approvedBy || 'Management', size: 18 }),
                  ],
                })
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
    })
  );

  // Create document
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
      children: children,
    }],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Data_Persiapan_${data.namaProyek.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().getTime()}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};