// Sample Quotation Data - PT Gema Teknik Perkasa Real Case
// No: 573/PEN/GMT/X/2025 - Repair Thermal Oxidizer PT Petrochina

export const sampleQuotationGTP = {
  // Header
  noPenawaran: '573/PEN/GMT/X/2025',
  revisi: 'A',
  tanggal: '2025-10-30',
  jenisQuotation: 'Jasa',
  kepada: 'PT. Farrel Internusa Pratama',
  perusahaan: 'PT. Farrel Internusa Pratama',
  lokasi: 'Jakarta',
  up: '',
  lampiran: '-',
  perihal: 'Penawaran Harga Jasa Repair Thermal Oxidizer 1 Unit PT. Petrochina',
  validityDays: 30,
  
  // Multi-unit pricing
  unitCount: 2,
  enableMultiUnit: true,

  // Pricing Strategy
  pricingStrategy: 'cost-plus',
  
  // Pricing Config (no markup for this real quotation - prices already final)
  pricingConfig: {
    manpowerMarkup: 0, // Already selling price
    materialsMarkup: 0,
    equipmentMarkup: 0,
    consumablesMarkup: 0,
    overheadPercent: 0,
    contingencyPercent: 0,
    discountPercent: 0,
    discountReason: '',
  },

  // Pricing Items - Structured by Sections (I, II, III, IV, V, VI)
  pricingItems: {
    // Section I: JASA KERJA
    manpower: [
      {
        id: 'MAN-1',
        description: 'Jasa Repair Refractory',
        quantity: 1,
        unit: 'Lot',
        duration: 70, // 70 hari kerja
        costPerUnit: 575000000, // Already final price (no cost separation in original)
        sellingPrice: 575000000,
        markup: 0,
        notes: 'Pekerjaan meliputi pembongkaran refractory lama dan pemasangan refractory baru',
        supplier: '',
        sectionTitle: 'I. JASA KERJA',
        sectionNumber: 'I'
      }
    ],

    // Section II: HAND TOOL & SAFETY + Section IV: MOB-DEMOB + Section V: AKOMODASI
    // (Grouped as consumables/support costs)
    consumables: [
      // Section II
      {
        id: 'CONS-1',
        description: 'Hand Tool & Consumable',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 37500000,
        sellingPrice: 37500000,
        markup: 0,
        sectionTitle: 'II. HAND TOOL & SAFETY EQUIPMENT',
        sectionNumber: 'II'
      },
      {
        id: 'CONS-2',
        description: 'Begisting',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 50000000,
        sellingPrice: 50000000,
        markup: 0,
        sectionTitle: 'II. HAND TOOL & SAFETY EQUIPMENT',
        sectionNumber: 'II'
      },
      {
        id: 'CONS-3',
        description: 'Safety Equipment',
        quantity: 12,
        unit: 'Orang',
        costPerUnit: 2500000,
        sellingPrice: 2500000,
        markup: 0,
        notes: '12 pekerja × Rp 2.5jt',
        sectionTitle: 'II. HAND TOOL & SAFETY EQUIPMENT',
        sectionNumber: 'II'
      },
      
      // Section IV: MOB-DEMOB
      {
        id: 'CONS-4',
        description: 'Transport ManPower Tambun - Jambi PP',
        quantity: 12,
        unit: 'Org/PP',
        costPerUnit: 5000000,
        sellingPrice: 5000000,
        markup: 0,
        notes: '12 orang pulang pergi',
        sectionTitle: 'IV. MOB-DEMOB (Manpower/Perlengkapan)',
        sectionNumber: 'IV'
      },
      {
        id: 'CONS-5',
        description: 'Transport Equipment Tambun - Jambi PP',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 70000000,
        sellingPrice: 70000000,
        markup: 0,
        sectionTitle: 'IV. MOB-DEMOB (Manpower/Perlengkapan)',
        sectionNumber: 'IV'
      },

      // Section V: AKOMODASI & LOKAL TRANSPORT
      {
        id: 'CONS-6',
        description: 'Penginapan',
        quantity: 2,
        unit: 'Lot',
        costPerUnit: 10000000,
        sellingPrice: 10000000,
        markup: 0,
        sectionTitle: 'V. AKOMODASI & LOKAL TRANSPORT',
        sectionNumber: 'V'
      },
      {
        id: 'CONS-7',
        description: 'Makan 12 Orang',
        quantity: 70,
        unit: 'Hari',
        costPerUnit: 75000,
        sellingPrice: 75000,
        markup: 0,
        notes: '12 orang × Rp 75k × 70 hari = Rp 63jt',
        sectionTitle: 'V. AKOMODASI & LOKAL TRANSPORT',
        sectionNumber: 'V'
      },
      {
        id: 'CONS-8',
        description: 'Transportasi selama proyek',
        quantity: 70,
        unit: 'Hari',
        costPerUnit: 1000000,
        sellingPrice: 1000000,
        markup: 0,
        sectionTitle: 'V. AKOMODASI & LOKAL TRANSPORT',
        sectionNumber: 'V'
      },

      // Section VI: LAIN-LAIN
      {
        id: 'CONS-9',
        description: 'Asuransi Pekerja',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 2500000,
        sellingPrice: 2500000,
        markup: 0,
        sectionTitle: 'VI. LAIN-LAIN',
        sectionNumber: 'VI'
      },
      {
        id: 'CONS-10',
        description: 'Asuransi Pendamping',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 15186575,
        sellingPrice: 15186575,
        markup: 0,
        sectionTitle: 'VI. LAIN-LAIN',
        sectionNumber: 'VI'
      },
      {
        id: 'CONS-11',
        description: 'MCU (Medical Check Up)',
        quantity: 12,
        unit: 'Orang',
        costPerUnit: 12500000,
        sellingPrice: 12500000,
        markup: 0,
        notes: 'Note: Ada typo di original (harusnya total Rp 150jt)',
        sectionTitle: 'VI. LAIN-LAIN',
        sectionNumber: 'VI'
      },
      {
        id: 'CONS-12',
        description: 'Biaya Lain-lain',
        quantity: 1,
        unit: 'Lot',
        costPerUnit: 7500000,
        sellingPrice: 7500000,
        markup: 0,
        sectionTitle: 'VI. LAIN-LAIN',
        sectionNumber: 'VI'
      }
    ],

    // Section III: EQUIPMENT
    equipment: [
      {
        id: 'EQ-1',
        description: 'Mesin Jackhammer 8 Unit',
        quantity: 8,
        unit: 'Unit',
        duration: 20,
        costPerUnit: 2400000,
        sellingPrice: 2400000,
        markup: 0,
        notes: '8 unit × Rp 2.4jt × 20 hari',
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      },
      {
        id: 'EQ-2',
        description: 'Mesin Gunning + Accessories',
        quantity: 1,
        unit: 'Unit',
        duration: 30,
        costPerUnit: 55000000,
        sellingPrice: 55000000,
        markup: 0,
        notes: '1 unit × 1 bulan',
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      },
      {
        id: 'EQ-3',
        description: 'Mesin Mixer 2 Unit',
        quantity: 2,
        unit: 'Unit',
        duration: 30,
        costPerUnit: 700000,
        sellingPrice: 700000,
        markup: 0,
        notes: '2 unit × Rp 700k × 30 hari',
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      },
      {
        id: 'EQ-4',
        description: 'Mesin Vibrator 4 Unit',
        quantity: 4,
        unit: 'Unit',
        duration: 30,
        costPerUnit: 600000,
        sellingPrice: 600000,
        markup: 0,
        notes: '4 unit × Rp 600k × 30 hari',
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      },
      {
        id: 'EQ-5',
        description: 'Mesin Cutting Brick',
        quantity: 1,
        unit: 'Unit',
        duration: 5,
        costPerUnit: 200000,
        sellingPrice: 200000,
        markup: 0,
        notes: '1 unit × 5 hari',
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      },
      {
        id: 'EQ-6',
        description: 'Diamond Blade',
        quantity: 1,
        unit: 'Pcs',
        duration: 1,
        costPerUnit: 3000000,
        sellingPrice: 3000000,
        markup: 0,
        sectionTitle: 'III. EQUIPMENT',
        sectionNumber: 'III'
      }
    ],

    // No materials in this quotation (all provided by customer)
    materials: []
  },

  // Payment Terms
  paymentTerms: {
    type: 'termin',
    termins: [
      { label: 'DP (Down Payment)', percent: 40, timing: 'Saat PO kami terima' },
      { label: 'Progress Bulanan', percent: 60, timing: 'Bulanan sesuai pekerjaan yang telah dikerjakan' }
    ],
    paymentDueDays: 30,
    retention: 0,
    retentionPeriod: 0,
    penaltyEnabled: true,
    penaltyRate: 10000000, // Rp 10jt per day (flat rate, not percentage)
    penaltyMax: 0,
    penaltyCondition: 'Lama pekerjaan 70 hari, apabila lebih dari 70 hari akan dikenakan biaya tambahan Rp 10.000.000/hari'
  },

  // Commercial Terms
  commercialTerms: {
    warranty: 'Sesuai ketentuan kontrak',
    delivery: 'Pekerjaan di Petrochina - Jabung, Jambi',
    installation: 'Termasuk pembongkaran refractory lama dan pemasangan refractory baru',
    penalty: 'Rp 10.000.000/hari untuk keterlambatan lebih dari 70 hari',
    conditions: [
      'Penawaran harga belum termasuk PPN 11%',
      'Pekerjaan dilakukan di Petrochina - Jabung, Jambi',
      'Lama pekerjaan 70 hari kerja',
      'Pekerja standby dikarenakan penundaan pekerjaan di proyek akan dihitung kerja normal'
    ],
    
    // Scope of Work
    scopeOfWork: [
      'Pembongkaran refractory lama',
      'Pemasangan refractory baru',
      'Pekerjaan repair thermal oxidizer 1 unit'
    ],

    // Exclusions - Disediakan oleh PT. Farrel Internusa Pratama
    exclusions: [
      'Sewa Scaffolding + Pasang & Bongkar',
      'Mesin Compressor + Bahan Bakar + Operator',
      'Pembuangan Limbah',
      'Truk di Area Kerja',
      'Forklift & Alat Angkut Berat',
      'Sumber air bersih, listrik 220V & 380V beserta kabel di area kerja',
      'Seluruh material refractory (sudah tersedia di area kerja)',
      'Scaffolding bila diperlukan',
      'Pemasangan dan pembongkaran scaffolding',
      'Fork lift dan driver',
      'Lampu penerangan dan circulation/exhaust fan di area kerja',
      'Pemasangan exhaust fan',
      'Sarana Transportasi alat dan material di area kerja',
      'Alat angkut vertical (Hoist/Winchy, Crane, Catrol)',
      'Heating up, bahan bakar heating up dan supervisi heating up',
      'Tempat penyimpanan/countainer ruangan AC',
      'Water Chiller/Es Batu apabila diperlukan',
      'Hydrotest apabila ada',
      'Pembuangan bongkaran refractory lama dari luar furnace ke TPA',
      'Sarana toilet dan air bersih',
      'Inspector API 936 apabila diperlukan',
      'Mekanik & Electrik',
      'Pekerjaan casing/mekanikal jika ada',
      'Segala jenis pekerjaan pengelasan anchor, wiremesh, dll'
    ],

    projectDuration: 70, // days
    penaltyOvertime: 10000000 // Rp 10jt per day
  },

  // Calculated totals (1 unit)
  totalCost: 1296686575, // Same as selling (no cost breakdown in original)
  totalSelling: 1296686575,
  overhead: 0,
  contingency: 0,
  discount: 0,
  grandTotal: 1296686575,
  grossProfit: 0,
  marginPercent: 0,

  // Multi-unit total (2 units)
  multiUnitTotal: 2593373150,

  status: 'Draft'
};

// Helper to load sample data
export const loadSampleQuotation = () => {
  return sampleQuotationGTP;
};
