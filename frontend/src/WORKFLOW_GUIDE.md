# 🔄 WORKFLOW GUIDE - Data Collection → Quotation → Project

Panduan lengkap alur kerja sistem ERP dari Data Collection hingga Project Management.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [3 Main Modules](#3-main-modules)
3. [5 Components System](#5-components-system)
4. [Complete Workflow](#complete-workflow)
5. [Step-by-Step Tutorial](#step-by-step-tutorial)
6. [Data Flow Diagram](#data-flow-diagram)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## 🎯 Overview

Sistem ERP ini memiliki **WORKFLOW UTAMA** yang terdiri dari 3 module terintegrasi:

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│                 │        │                  │        │                     │
│  DATA COLLECTION│   →    │   QUOTATION      │   →    │  PROJECT MANAGEMENT │
│  (Input Awal)   │        │   (Penawaran)    │        │  (Eksekusi)         │
│                 │        │                  │        │                     │
└─────────────────┘        └──────────────────┘        └─────────────────────┘
      STEP 1                    STEP 2                       STEP 3
```

---

## 🏢 3 Main Modules

### **1️⃣ DATA COLLECTION (Pengumpulan Data)**

**Tujuan:** Mengumpulkan semua kebutuhan customer untuk project

**Lokasi Menu:** `Sales & Project → Data Collection`

**Fungsi Utama:**
- Input data requirement customer
- Estimasi kebutuhan material
- Estimasi manpower yang dibutuhkan
- Rencana schedule project
- Kebutuhan consumables
- Kebutuhan equipment

**Output:** Data Collection yang siap ditransfer ke Quotation

---

### **2️⃣ PROJECT QUOTATION (Penawaran)**

**Tujuan:** Membuat penawaran harga berdasarkan Data Collection

**Lokasi Menu:** `Sales & Project → Project Quotation`

**Fungsi Utama:**
- Import data dari Data Collection
- Kalkulasi harga dan biaya
- Tambah PPN
- Generate nomor quotation
- Kirim ke customer
- Track status (Draft, Sent, Approved, Rejected)

**Output:** Quotation yang disetujui customer → siap jadi Project

---

### **3️⃣ PROJECT MANAGEMENT (Manajemen Proyek)**

**Tujuan:** Eksekusi dan monitoring project yang sudah disetujui

**Lokasi Menu:** `Sales & Project → Project Management`

**Fungsi Utama:**
- Convert Quotation menjadi Project
- Monitor progress project
- Track budget vs actual cost
- Manage resources
- Update status project
- Generate reports

**Output:** Project selesai dengan full dokumentasi

---

## 🧩 5 Components System

Setiap module memiliki **5 KOMPONEN YANG SAMA** untuk konsistensi data:

### **1. BOQ Materials (Bill of Quantity - Material)**

```typescript
Material = {
  materialName: string;      // Nama material
  quantity: number;          // Jumlah
  unit: string;             // Satuan (pcs, m2, kg, dll)
  unitPrice: number;        // Harga per unit
  totalPrice: number;       // Total (quantity × unitPrice)
  supplier?: string;        // Supplier
  status?: string;          // Status pesanan
}
```

**Contoh Data:**
```
Material: Semen Portland
Quantity: 500
Unit: Sak
Unit Price: Rp 65,000
Total Price: Rp 32,500,000
```

---

### **2. Manpower (Tenaga Kerja)**

```typescript
Manpower = {
  position: string;         // Posisi/jabatan
  quantity: number;         // Jumlah orang
  dailyRate: number;        // Upah per hari
  duration: number;         // Durasi (hari)
  totalCost: number;        // Total (quantity × dailyRate × duration)
  notes?: string;           // Catatan
}
```

**Contoh Data:**
```
Position: Tukang Bangunan
Quantity: 10 orang
Daily Rate: Rp 150,000/hari
Duration: 60 hari
Total Cost: Rp 90,000,000
```

---

### **3. Schedule (Jadwal Kerja)**

```typescript
Schedule = {
  activity: string;         // Nama aktivitas
  startDate: string;        // Tanggal mulai
  endDate: string;          // Tanggal selesai
  duration: number;         // Durasi (hari)
  status: string;           // Not Started | In Progress | Completed
}
```

**Contoh Data:**
```
Activity: Pekerjaan Pondasi
Start Date: 2025-01-15
End Date: 2025-02-15
Duration: 30 hari
Status: Not Started
```

---

### **4. Consumables (Barang Habis Pakai)**

```typescript
Consumable = {
  itemName: string;         // Nama item
  quantity: number;         // Jumlah
  unit: string;             // Satuan
  unitPrice: number;        // Harga per unit
  totalCost: number;        // Total biaya
  category: string;         // Tools | Safety | Office | Other
}
```

**Contoh Data:**
```
Item: Helm Proyek (Safety Helmet)
Quantity: 50
Unit: Pcs
Unit Price: Rp 75,000
Total Cost: Rp 3,750,000
Category: Safety
```

---

### **5. Equipment (Peralatan)**

```typescript
Equipment = {
  equipmentName: string;    // Nama equipment
  quantity: number;         // Jumlah
  unit: string;             // Satuan
  rentalRate: number;       // Biaya sewa per periode
  duration: number;         // Durasi sewa (hari/bulan)
  totalCost: number;        // Total biaya sewa
  supplier?: string;        // Supplier/penyedia
}
```

**Contoh Data:**
```
Equipment: Excavator Komatsu PC200
Quantity: 2 unit
Rental Rate: Rp 5,000,000/bulan
Duration: 3 bulan
Total Cost: Rp 30,000,000
Supplier: PT Rental Equipment Indonesia
```

---

## 🔄 Complete Workflow

### **FULL BUSINESS PROCESS:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    STEP 1: DATA COLLECTION                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer Request → Sales Team → Input ke Data Collection       │
│                                                                  │
│  Data yang dikumpulkan:                                         │
│  ✅ Info customer (nama, lokasi, contact)                       │
│  ✅ Kebutuhan materials (estimasi)                              │
│  ✅ Kebutuhan manpower (posisi & jumlah)                        │
│  ✅ Schedule project (timeline)                                 │
│  ✅ Consumables yang dibutuhkan                                 │
│  ✅ Equipment yang diperlukan                                   │
│                                                                  │
│  Status: "Data Collection DC-001" → READY                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ TRANSFER (Click "Kirim ke Quotation")
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│                    STEP 2: QUOTATION                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Data Collection → Auto Transfer → Quotation Form               │
│                                                                  │
│  Proses di Quotation:                                           │
│  ✅ Review semua 5 komponen                                     │
│  ✅ Adjust harga jika perlu                                     │
│  ✅ Tambahkan PPN (10% atau custom)                             │
│  ✅ Tambahkan Terms & Conditions                                │
│  ✅ Generate nomor quotation (QT-2025-001)                      │
│  ✅ Set status "Draft" → "Sent"                                 │
│                                                                  │
│  Total Calculation:                                             │
│  • Materials Total:     Rp 500,000,000                          │
│  • Manpower Total:      Rp 200,000,000                          │
│  • Consumables Total:   Rp  50,000,000                          │
│  • Equipment Total:     Rp 100,000,000                          │
│  • Subtotal:           Rp 850,000,000                           │
│  • PPN 10%:            Rp  85,000,000                           │
│  • GRAND TOTAL:        Rp 935,000,000                           │
│                                                                  │
│  Status: "Draft" → "Sent" → "Approved" ✅                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ CONVERT (Click "Convert to Project")
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│                  STEP 3: PROJECT MANAGEMENT                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Approved Quotation → Convert → Active Project                  │
│                                                                  │
│  Project Created:                                               │
│  ✅ Kode Project: PROJ-2025-001                                 │
│  ✅ Budget: Rp 935,000,000 (dari quotation)                     │
│  ✅ Semua 5 komponen ter-copy                                   │
│  ✅ Schedule mulai berjalan                                     │
│  ✅ Material tracking aktif                                     │
│  ✅ Manpower assignment dimulai                                 │
│                                                                  │
│  Monitoring:                                                    │
│  • Budget:        Rp 935,000,000                                │
│  • Actual Cost:   Rp 450,000,000 (48%)                          │
│  • Remaining:     Rp 485,000,000                                │
│  • Progress:      60% completed                                 │
│  • Status:        "In Progress"                                 │
│                                                                  │
│  Status: "Planning" → "In Progress" → "Completed" ✅            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📖 Step-by-Step Tutorial

### **🎬 STEP 1: Buat Data Collection**

#### **1.1 Login & Navigate**
```
1. Login sebagai Sales/Project Manager
   Email: sales@erp.com
   Password: sales123

2. Klik menu "Sales & Project"
3. Pilih "Data Collection"
```

#### **1.2 Create New Data Collection**
```
1. Klik tombol "Buat Data Collection"

2. Tab OVERVIEW - Isi informasi dasar:
   ├─ No Koleksi: DC-002 (auto)
   ├─ Customer Name: PT Maju Jaya
   ├─ Location: Jakarta Selatan
   ├─ Collection Date: 2025-01-10
   ├─ PIC: Budi Santoso
   ├─ Phone: 0812-3456-7890
   ├─ Email: budi@majujaya.com
   └─ Notes: Pembangunan gedung kantor 3 lantai
```

#### **1.3 Tambah Materials (Tab BOQ Materials)**
```
1. Klik tab "BOQ Materials"
2. Klik "Tambah Material"

3. Isi form:
   ├─ Material Name: Semen Portland
   ├─ Qty Estimate: 500
   ├─ Qty Actual: 0 (belum eksekusi)
   ├─ Unit: Sak
   ├─ Unit Price: Rp 65,000
   ├─ Supplier: PT Semen Indonesia
   └─ Status: Not Ordered

4. Klik "Simpan Material"
5. Ulangi untuk material lain (besi, pasir, batu, dll)
```

#### **1.4 Tambah Manpower (Tab Manpower)**
```
1. Klik tab "Manpower"
2. Klik "Tambah Manpower"

3. Isi form:
   ├─ Position: Tukang Bangunan
   ├─ Quantity: 10 orang
   ├─ Daily Rate: Rp 150,000
   ├─ Duration: 60 hari
   ├─ Total Cost: Rp 90,000,000 (auto calculate)
   └─ Notes: Pengalaman minimal 2 tahun

4. Klik "Simpan Manpower"
5. Tambahkan posisi lain (Mandor, Helper, dll)
```

#### **1.5 Tambah Schedule (Tab Schedule)**
```
1. Klik tab "Schedule"
2. Klik "Tambah Schedule"

3. Isi form:
   ├─ Activity: Pekerjaan Pondasi
   ├─ Start Date: 2025-01-15
   ├─ End Date: 2025-02-15
   ├─ Duration: 30 hari (auto calculate)
   └─ Status: Not Started

4. Klik "Simpan Schedule"
5. Tambahkan aktivitas lainnya
```

#### **1.6 Tambah Consumables (Tab Consumables)**
```
1. Klik tab "Consumables"
2. Klik "Tambah Consumable"

3. Isi form:
   ├─ Item Name: Helm Proyek
   ├─ Quantity: 50
   ├─ Unit: Pcs
   ├─ Unit Price: Rp 75,000
   ├─ Total Cost: Rp 3,750,000 (auto)
   └─ Category: Safety

4. Klik "Simpan Consumable"
```

#### **1.7 Tambah Equipment (Tab Equipment)**
```
1. Klik tab "Equipment"
2. Klik "Tambah Equipment"

3. Isi form:
   ├─ Equipment Name: Excavator Komatsu PC200
   ├─ Quantity: 2
   ├─ Unit: Unit
   ├─ Rental Rate: Rp 5,000,000/bulan
   ├─ Duration: 3 bulan
   ├─ Total Cost: Rp 30,000,000 (auto)
   └─ Supplier: PT Rental Equipment

4. Klik "Simpan Equipment"
```

#### **1.8 Save Data Collection**
```
1. Review semua 5 komponen
2. Klik "Simpan Data Collection"
3. Data Collection DC-002 tersimpan! ✅
```

---

### **🎬 STEP 2: Transfer ke Quotation**

#### **2.1 Open Data Collection**
```
1. Di halaman Data Collection list
2. Klik icon "View" (👁️) pada DC-002
3. Modal detail terbuka
```

#### **2.2 Kirim ke Quotation**
```
1. Di modal detail, klik tombol "Kirim ke Quotation"
2. Navigate otomatis ke halaman Project Quotation
3. Modal "Buat Quotation" terbuka dengan data PRE-FILLED! ✨
```

#### **2.3 Review Data di Quotation**
```
Tab OVERVIEW:
✅ Customer: PT Maju Jaya (auto-filled)
✅ Perihal: Pembangunan Gedung Kantor (auto-filled)
✅ Tanggal: 2025-01-10 (auto-filled)
✅ Nomor Quotation: QT-2025-002 (auto generate)

Tab BOQ MATERIALS:
✅ Semua material dari DC-002 sudah masuk!
   - Semen Portland: 500 sak × Rp 65,000 = Rp 32,500,000
   - (dan material lainnya)

Tab MANPOWER:
✅ Semua manpower dari DC-002 sudah masuk!
   - Tukang Bangunan: 10 × Rp 150,000 × 60 = Rp 90,000,000

Tab SCHEDULE:
✅ Semua schedule dari DC-002 sudah masuk!

Tab CONSUMABLES:
✅ Semua consumables dari DC-002 sudah masuk!

Tab EQUIPMENT:
✅ Semua equipment dari DC-002 sudah masuk!
```

#### **2.4 Adjust & Finalize**
```
1. Review semua data
2. Edit jika ada yang perlu disesuaikan
3. Set PPN (default 10%)
4. Tambahkan Terms & Conditions
5. Ubah status dari "Draft" ke "Sent"
6. Klik "Simpan Quotation"
```

#### **2.5 Total Calculation**
```
TOTAL OTOMATIS TERHITUNG:

Materials:       Rp 500,000,000
Manpower:        Rp 200,000,000
Consumables:     Rp  50,000,000
Equipment:       Rp 100,000,000
─────────────────────────────────
Subtotal:        Rp 850,000,000
PPN 10%:         Rp  85,000,000
─────────────────────────────────
GRAND TOTAL:     Rp 935,000,000 ✅
```

---

### **🎬 STEP 3: Convert to Project**

#### **3.1 Approve Quotation**
```
1. Di halaman Project Quotation
2. Klik "View" pada quotation yang sudah "Sent"
3. Ubah status menjadi "Approved"
4. Klik "Update Quotation"
```

#### **3.2 Convert to Project**
```
1. Klik tombol "Convert to Project"
2. Confirm konversi
3. Project otomatis dibuat! 🎉
4. Navigate ke "Project Management"
```

#### **3.3 View New Project**
```
Project Created:
├─ Kode Project: PROJ-2025-002
├─ Nama: Pembangunan Gedung Kantor PT Maju Jaya
├─ Customer: PT Maju Jaya
├─ Budget: Rp 935,000,000
├─ Status: Planning
├─ Progress: 0%
└─ 5 Komponen: ✅ Semua ter-copy dari Quotation!
```

#### **3.4 Start Project Execution**
```
1. Ubah status dari "Planning" ke "In Progress"
2. Assign Project Manager
3. Assign Team Members
4. Update progress secara berkala
5. Track actual cost vs budget
6. Monitor schedule
```

---

## 📊 Data Flow Diagram

### **Detailed Data Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA COLLECTION                              │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ formData = {
                                 │   customerName: "PT Maju Jaya",
                                 │   location: "Jakarta",
                                 │   materials: [Array of 10 items],
                                 │   manpower: [Array of 5 positions],
                                 │   schedule: [Array of 8 activities],
                                 │   consumables: [Array of 15 items],
                                 │   equipment: [Array of 6 items]
                                 │ }
                                 │
                                 ↓
                    ┌────────────────────────────┐
                    │  addDataCollection(data)   │ → Save to AppContext
                    └────────────────────────────┘
                                 │
                                 │
                    ┌────────────────────────────┐
                    │   Click "Kirim ke         │
                    │   Quotation" Button       │
                    └────────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          QUOTATION                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ navigate('/project-quotation', {
                                 │   state: {
                                 │     fromDataCollection: true,
                                 │     dataCollectionId: DC-002,
                                 │     materials: [...],
                                 │     manpower: [...],
                                 │     schedule: [...],
                                 │     consumables: [...],
                                 │     equipment: [...]
                                 │   }
                                 │ })
                                 │
                                 ↓
                    ┌────────────────────────────┐
                    │  Auto Pre-fill Form        │
                    │  with transferred data     │
                    └────────────────────────────┘
                                 │
                                 │ quotationData = {
                                 │   nomorQuotation: "QT-2025-002",
                                 │   customer: { ... },
                                 │   materials: [...],
                                 │   manpower: [...],
                                 │   schedule: [...],
                                 │   consumables: [...],
                                 │   equipment: [...],
                                 │   ppn: 10,
                                 │   status: "Sent"
                                 │ }
                                 │
                                 ↓
                    ┌────────────────────────────┐
                    │  addQuotation(data)        │ → Save to AppContext
                    └────────────────────────────┘
                                 │
                                 │
                    ┌────────────────────────────┐
                    │   Change Status to         │
                    │   "Approved"               │
                    └────────────────────────────┘
                                 │
                                 │
                    ┌────────────────────────────┐
                    │   Click "Convert to        │
                    │   Project" Button          │
                    └────────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       PROJECT MANAGEMENT                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ projectData = {
                                 │   kodeProject: "PROJ-2025-002",
                                 │   namaProject: "...",
                                 │   customer: "PT Maju Jaya",
                                 │   nilaiKontrak: 935000000,
                                 │   materials: [...],
                                 │   manpower: [...],
                                 │   schedule: [...],
                                 │   consumables: [...],
                                 │   equipment: [...],
                                 │   budget: {
                                 │     total: 935000000,
                                 │     material: 500000000,
                                 │     labor: 200000000,
                                 │     equipment: 100000000,
                                 │     overhead: 135000000
                                 │   },
                                 │   progress: 0,
                                 │   status: "Planning"
                                 │ }
                                 │
                                 ↓
                    ┌────────────────────────────┐
                    │  addProject(data)          │ → Save to AppContext
                    └────────────────────────────┘
                                 │
                                 │
                    ┌────────────────────────────┐
                    │   Project Execution:       │
                    │   - Update progress        │
                    │   - Track actual cost      │
                    │   - Monitor schedule       │
                    │   - Manage resources       │
                    └────────────────────────────┘
```

---

## 💻 Code Examples

### **Example 1: Transfer Data Collection to Quotation**

```typescript
// Di DataCollection.tsx
const handleKirimKeQuotation = () => {
  if (!selectedItem) return;
  
  // Navigate dengan data
  navigate('/project-quotation', {
    state: {
      fromDataCollection: true,
      dataCollectionId: selectedItem.id,
      customerName: selectedItem.customerName,
      location: selectedItem.location,
      materials: selectedItem.materials || [],
      manpower: selectedItem.manpower || [],
      schedule: selectedItem.schedule || [],
      consumables: selectedItem.consumables || [],
      equipment: selectedItem.equipment || []
    }
  });
  
  setShowDetailModal(false);
};
```

### **Example 2: Receive Data in Quotation**

```typescript
// Di ProjectQuotationPage.tsx
import { useLocation } from 'react-router-dom';

const location = useLocation();
const transferredData = location.state;

useEffect(() => {
  if (transferredData?.fromDataCollection) {
    // Auto populate form
    setFormData({
      customer: {
        nama: transferredData.customerName,
        alamat: transferredData.location
      },
      materials: transferredData.materials,
      manpower: transferredData.manpower,
      schedule: transferredData.schedule,
      consumables: transferredData.consumables,
      equipment: transferredData.equipment
    });
    
    // Open modal
    setShowModal(true);
  }
}, [transferredData]);
```

### **Example 3: Calculate Total in Quotation**

```typescript
// Di ProjectQuotationPage.tsx
const calculateGrandTotal = (quotation: Quotation) => {
  // 1. Materials Total
  const materialsTotal = (quotation.materials || []).reduce(
    (sum, item) => sum + item.totalPrice, 0
  );
  
  // 2. Manpower Total
  const manpowerTotal = (quotation.manpower || []).reduce(
    (sum, item) => sum + item.totalCost, 0
  );
  
  // 3. Consumables Total
  const consumablesTotal = (quotation.consumables || []).reduce(
    (sum, item) => sum + item.totalCost, 0
  );
  
  // 4. Equipment Total
  const equipmentTotal = (quotation.equipment || []).reduce(
    (sum, item) => sum + item.totalCost, 0
  );
  
  // Subtotal
  const subtotal = materialsTotal + manpowerTotal + 
                   consumablesTotal + equipmentTotal;
  
  // PPN
  const ppnAmount = subtotal * (quotation.ppn / 100);
  
  // Grand Total
  const grandTotal = subtotal + ppnAmount;
  
  return {
    materialsTotal,
    manpowerTotal,
    consumablesTotal,
    equipmentTotal,
    subtotal,
    ppnAmount,
    grandTotal
  };
};
```

### **Example 4: Convert Quotation to Project**

```typescript
// Di ProjectQuotationPage.tsx
const handleConvertToProject = (quotation: Quotation) => {
  const totals = calculateGrandTotal(quotation);
  
  const newProject = {
    id: generateId(),
    kodeProject: `PROJ-${new Date().getFullYear()}-${String(projectList.length + 1).padStart(3, '0')}`,
    namaProject: quotation.perihal,
    customer: quotation.customer.nama,
    nilaiKontrak: totals.grandTotal,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '', // Calculate from schedule
    progress: 0,
    status: 'Planning',
    location: quotation.customer.alamat,
    materials: quotation.materials,
    manpower: quotation.manpower,
    schedule: quotation.schedule,
    consumables: quotation.consumables,
    equipment: quotation.equipment,
    budget: {
      total: totals.grandTotal,
      material: totals.materialsTotal,
      labor: totals.manpowerTotal,
      equipment: totals.equipmentTotal,
      overhead: totals.consumablesTotal
    },
    actualCost: 0,
    remaining: totals.grandTotal
  };
  
  addProject(newProject);
  alert('Project berhasil dibuat!');
  navigate('/project-management');
};
```

---

## ✅ Best Practices

### **1. Data Collection Phase**

```
DO's ✅
- Kumpulkan data selengkap mungkin
- Estimasi quantity dengan akurat
- Catat semua requirement customer
- Dokumentasikan dengan baik
- Konsultasi dengan tim teknis

DON'Ts ❌
- Jangan skip komponen
- Jangan estimasi asal-asalan
- Jangan lupa dokumentasi
- Jangan langsung ke quotation tanpa review
```

### **2. Quotation Phase**

```
DO's ✅
- Review semua data dari Data Collection
- Adjust pricing sesuai margin
- Tambahkan PPN yang sesuai
- Include terms & conditions
- Double-check calculation

DON'Ts ❌
- Jangan kirim quotation tanpa approval manager
- Jangan lupa update status
- Jangan skip review dengan customer
```

### **3. Project Phase**

```
DO's ✅
- Monitor progress secara berkala
- Track actual cost vs budget
- Update status real-time
- Dokumentasi lengkap
- Komunikasi regular dengan team

DON'Ts ❌
- Jangan biarkan progress outdated
- Jangan ignore budget overrun
- Jangan skip milestone updates
```

---

## 🎯 Common Use Cases

### **Use Case 1: Simple Project**

```
Customer: Small renovation
Process:
1. Data Collection (1 hari)
   - 5 materials
   - 2 manpower
   - 1 month schedule
   - Basic consumables
   - No equipment rental

2. Quotation (same day)
   - Review & approve
   - Send to customer

3. Project (1 month execution)
   - Track progress weekly
   - Update actual cost
```

### **Use Case 2: Complex Project**

```
Customer: Large construction
Process:
1. Data Collection (1 minggu)
   - 50+ materials
   - 10+ manpower positions
   - 6 month schedule
   - Extensive consumables
   - Multiple equipment

2. Quotation (2-3 hari)
   - Detailed review
   - Multiple revisions
   - Negotiation dengan customer

3. Project (6 months execution)
   - Daily progress updates
   - Weekly cost tracking
   - Monthly reports
```

---

## 🔍 Troubleshooting

### **Problem 1: Data tidak ke-transfer**

**Solution:**
```
1. Check browser console untuk error
2. Pastikan semua 5 komponen sudah ada data
3. Pastikan format data sesuai interface
4. Clear browser cache dan reload
```

### **Problem 2: Calculation tidak akurat**

**Solution:**
```
1. Check formula di calculateGrandTotal()
2. Pastikan semua unitPrice/dailyRate sudah diisi
3. Verify PPN percentage (default 10%)
4. Check console log untuk debugging
```

### **Problem 3: Status tidak update**

**Solution:**
```
1. Pastikan state management working
2. Check updateQuotation/updateProject function
3. Verify localStorage sync
4. Reload page untuk force refresh
```

---

## 📞 Need Help?

Jika masih ada pertanyaan:

1. 📖 Baca README.md untuk overview
2. 📁 Check PROJECT_STRUCTURE.md untuk file organization
3. 🤝 Lihat CONTRIBUTING.md untuk coding standards
4. 💬 Contact: support@erp.com

---

**Happy Building Projects! 🚀**
