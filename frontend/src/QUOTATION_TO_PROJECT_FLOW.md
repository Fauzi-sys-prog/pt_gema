# 📋 Quotation to Project Flow

## Alur Workflow: Quotation → Project

Fitur ini memungkinkan data quotation yang di-approve secara otomatis membuat project baru di sistem.

---

## ✨ Fitur Utama

### 1. **Auto-Create Project on Approval**
Ketika status quotation diubah menjadi "Approved", sistem akan:
- ✅ Otomatis membuat project baru
- ✅ Transfer semua data dari quotation ke project
- ✅ Set link quotationId di project
- ✅ Set projectId di quotation

### 2. **Data Transfer Lengkap**
Data yang ditransfer dari Quotation ke Project:

| Quotation Field | → | Project Field |
|----------------|---|---------------|
| `perihal` | → | `namaProject` |
| `customer.nama` | → | `customer` |
| `customer.alamat` | → | `location` |
| `materials[]` | → | `boq[]` |
| `manpower[]` | → | `budget.labor` |
| `schedule[]` | → | `milestones[]` |
| `consumables[]` | → | `budget.other` |
| `equipment[]` | → | `budget.equipment` |
| Total + PPN | → | `nilaiKontrak` |

### 3. **Visual Indicators**

#### Di Halaman Quotation:
- 🏷️ Badge "Project" untuk quotation yang sudah approved
- ✅ Info "Project Created" dengan ID project
- 🔗 Button "View Project" untuk langsung ke project

#### Di Halaman Project:
- 📋 Badge "From Quotation" untuk project yang berasal dari quotation
- 🔗 Link ke quotation asli (jika ada)

---

## 🔄 Cara Kerja

### Step 1: Buat Quotation
1. Masuk ke menu **Project → Tab Quotations**
2. Klik **"+ Add Quotation"**
3. Isi data quotation lengkap dengan 5 komponen:
   - BOQ Materials
   - Manpower
   - Schedule
   - Consumables
   - Equipment
4. Save sebagai Draft

### Step 2: Send Quotation
1. Ubah status menjadi **"Sent"** untuk dikirim ke customer
2. Customer review quotation

### Step 3: Approve Quotation
1. Klik button **"✅ Approve"** pada quotation
2. Konfirmasi approval
3. **Sistem otomatis:**
   - Membuat project baru
   - Transfer semua data
   - Hitung total nilai kontrak (termasuk PPN)
   - Set status project: "Planning"
   - Link quotation ↔ project
4. Alert muncul: "🎉 Project baru telah dibuat!"

### Step 4: Kelola Project
1. Buka menu **Project → Tab Projects**
2. Lihat project baru dengan badge **"📋 From Quotation"**
3. Kelola BOQ, Milestones, Budget

---

## 💻 Technical Implementation

### AppContext.tsx
```typescript
const updateQuotation = (id: string, data: Partial<Quotation>) => {
  // ... existing code ...
  
  // Auto-create project when quotation is approved
  if (data.status === "Approved" && !quotation.projectId) {
    // Calculate nilai kontrak
    const nilaiKontrak = /* sum all components + PPN */;
    
    // Create new project
    const newProject: Project = {
      id: `PRJ-${Date.now()}`,
      kodeProject: `PRJ-${year}-${number}`,
      namaProject: quotation.perihal,
      customer: quotation.customer.nama,
      nilaiKontrak: nilaiKontrak,
      quotationId: quotation.id,
      // ... convert all data ...
    };
    
    setProjectList([...projectList, newProject]);
    updatedQuotation.projectId = newProjectId;
  }
};
```

### useQuotationActions Hook
```typescript
const handleApprove = (quotation: Quotation) => {
  if (quotation.projectId) {
    alert('⚠️ Project sudah dibuat!');
    return;
  }
  
  if (confirm('Approve quotation?')) {
    updateQuotation(quotation.id, { status: 'Approved' });
    alert('✅ Project baru telah dibuat!');
  }
};
```

---

## 🎯 Benefits

1. **Efisiensi**: No manual data entry untuk project
2. **Akurasi**: Data konsisten antara quotation dan project
3. **Traceability**: Link jelas antara quotation ↔ project
4. **Audit Trail**: History lengkap dari quotation sampai project

---

## 📊 Mock Data Example

### Quotation (Approved)
```typescript
{
  id: "1",
  nomorQuotation: "QT-2024-001",
  perihal: "Penawaran Renovasi Gedung Kantor",
  customer: { nama: "PT Maju Jaya" },
  status: "Approved",
  projectId: "PRJ-APPROVED-001", // Auto-linked
  materials: [...],
  manpower: [...],
  schedule: [...],
  consumables: [...],
  equipment: [...]
}
```

### Project (Created from Quotation)
```typescript
{
  id: "PRJ-APPROVED-001",
  kodeProject: "PRJ-2024-001",
  namaProject: "Penawaran Renovasi Gedung Kantor",
  customer: "PT Maju Jaya",
  status: "Planning",
  quotationId: "1", // Link back to quotation
  boq: [...], // From materials
  milestones: [...], // From schedule
  budget: {
    materials: 62500000,
    labor: 165000000,
    equipment: 594000000,
    other: 3500000,
    total: 907500000
  }
}
```

---

## 🔍 Debugging

Console log akan muncul ketika project dibuat:
```
✅ Project created successfully:
  projectId: PRJ-APPROVED-001
  kodeProject: PRJ-2024-001
  quotationId: 1
  nomorQuotation: QT-2024-001
```

---

## 📝 Notes

- ⚠️ Quotation yang sudah approved **tidak bisa dihapus**
- ⚠️ Hanya quotation dengan status "Approved" yang bisa create project
- ✅ Jika quotation sudah punya projectId, tidak akan create project duplikat
- ✅ Project dibuat dengan status "Planning" secara default
