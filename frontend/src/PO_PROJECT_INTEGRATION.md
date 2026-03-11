# 🔗 Purchase Order - Project Integration

## 📋 Overview
Implementasi sistem Purchase Order (PO) dengan integrasi opsional ke Project Management. PO bisa terhubung ke project tertentu (untuk material BOQ) atau standalone (untuk general procurement).

---

## ✨ Fitur Utama

### 1. **PO dengan Link ke Project (Opsional)**
- ✅ PO bisa linked ke project tertentu
- ✅ PO bisa standalone (General Purchase)
- ✅ Field `projectId?: string | null` di interface PurchaseOrder
- ✅ Visual indicator untuk PO yang linked ke project

### 2. **Auto-Create PO from BOQ**
- ✅ Tombol "Create PO from BOQ" di tab BOQ Project Management
- ✅ Otomatis convert BOQ material → PO items
- ✅ Filter hanya material dengan status "Not Ordered"
- ✅ Auto-fill supplier jika semua item dari supplier yang sama
- ✅ Auto-fill notes dengan info project

### 3. **BOQ Status Update**
- ✅ Otomatis update status BOQ dari "Not Ordered" → "Ordered" saat PO disimpan
- ✅ Matching berdasarkan nama material dan quantity

### 4. **Visual Indicators**
- ✅ Badge "Linked to Project" di form modal
- ✅ Project column di PO list table
- ✅ Icon dan project code di PO list
- ✅ Stats card untuk Project-Linked PO
- ✅ Project info di detail/print modal

---

## 🎯 Workflow

### **Scenario A: PO untuk Project Material** 📦

```
1. Project Management → Pilih Project → Tab "BOQ Materials"
   ↓
2. Klik "Create PO from BOQ"
   ↓
3. Sistem filter material dengan status "Not Ordered"
   ↓
4. Navigate ke PO page dengan data pre-filled:
   - Project ID & Name auto-filled
   - BOQ items → PO items
   - Supplier auto-filled (jika sama semua)
   - Notes berisi info project
   ↓
5. User review & edit PO (tambah/hapus item, edit harga, dll)
   ↓
6. Simpan PO
   ↓
7. BOQ status otomatis update: "Not Ordered" → "Ordered"
```

### **Scenario B: PO untuk General Purchase** 🏢

```
1. Purchase Order → Klik "Buat PO Baru"
   ↓
2. Dropdown "Project" → Pilih "-- General Purchase --"
   ↓
3. Input manual:
   - Supplier info
   - Items & prices
   - Notes
   ↓
4. Simpan PO (projectId = null)
```

---

## 🗂️ Data Structure

### **PurchaseOrder Interface**
```typescript
interface PurchaseOrder {
  id: string;
  noPO: string;
  supplier: string;
  tanggal: string;
  total: number;
  status: "Draft" | "Sent" | "Partial" | "Received" | "Cancelled";
  
  // PROJECT LINK (OPTIONAL)
  projectId?: string | null;  // 👈 Link ke project
  
  items: {
    nama: string;
    qty: number;
    unit: string;
    harga: number;
    qtyReceived?: number;
  }[];
  
  // Additional fields
  supplierAddress?: string;
  supplierContact?: string;
  attention?: string;
  notes?: string;
  ppn?: number;
  deliveryDate?: string;
}
```

### **Project BOQ Interface**
```typescript
interface Project {
  id: string;
  kodeProject: string;
  namaProject: string;
  // ... other fields
  
  boq?: {
    materialName: string;
    qtyEstimate: number;
    qtyActual: number;
    unit: string;
    unitPrice: number;
    supplier: string;
    status: "Not Ordered" | "Ordered" | "Used";  // 👈 Status tracking
  }[];
}
```

---

## 🔧 Implementation Details

### **File Changes**

#### 1. `/pages/ProjectManagementPage.tsx`
- ✅ Tambah button "Create PO from BOQ"
- ✅ Filter BOQ items dengan status "Not Ordered"
- ✅ Navigate dengan state ke PO page

```typescript
onClick={() => {
  const notOrderedItems = selectedProject.boq?.filter(
    (item) => item.status === "Not Ordered"
  );
  if (notOrderedItems && notOrderedItems.length > 0) {
    navigate("/purchasing/purchase-order", {
      state: {
        fromProject: true,
        projectId: selectedProject.id,
        projectNo: selectedProject.kodeProject,
        projectName: selectedProject.namaProject,
        boqItems: notOrderedItems,
      },
    });
  }
}}
```

#### 2. `/pages/purchasing/PurchaseOrderPage.tsx`
- ✅ Import `useLocation`, `useNavigate` dari react-router
- ✅ Import `updateProject` dari AppContext
- ✅ useEffect untuk handle auto-fill dari BOQ
- ✅ Update handleSubmit untuk update BOQ status
- ✅ Tambah kolom "Project" di table
- ✅ Visual indicators (badges, icons, stats)

```typescript
// Auto-fill from BOQ
useEffect(() => {
  if (locationState?.fromProject && locationState?.boqItems) {
    // Convert BOQ → PO items
    const poItems: POItem[] = boqItems.map((item, index) => ({
      no: index + 1,
      nama: item.materialName,
      qty: item.qtyEstimate,
      unit: item.unit,
      harga: item.unitPrice,
    }));
    setItems(poItems);
    setFormData(prev => ({
      ...prev,
      projectId: projectId,
      notes: `PO untuk Project: ${projectNo} - ${projectName}`,
    }));
    setShowModal(true);
  }
}, [locationState]);
```

#### 3. `/contexts/AppContext.tsx`
- ✅ Interface PurchaseOrder sudah ada field `projectId?: string`
- ✅ Mock data PO sudah include projectId
- ✅ No changes needed (already compatible)

---

## 🎨 UI Components

### **1. PO List Table**
| No PO | Tanggal | Supplier | **Project** | Total | Status | Aksi |
|-------|---------|----------|-------------|-------|--------|------|
| PO-2024-001 | 25 Jan | PT Semen | 🔗 **PRJ-001** | Rp 32.5M | Received | 👁️ 🖨️ |
| PO-2024-002 | 28 Jan | CV Baja | _General_ | Rp 15M | Sent | 👁️ ✏️ 🖨️ |

### **2. Stats Cards**
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total PO       │ │ Project-Linked │ │ Draft          │
│ 15             │ │ 🔗 8           │ │ 3              │
└────────────────┘ └────────────────┘ └────────────────┘
```

### **3. Form Modal Header**
```
┌─────────────────────────────────────────────────────┐
│  Buat Purchase Order Baru  [🔗 Linked to Project]  │
└─────────────────────────────────────────────────────┘
```

### **4. Project Dropdown**
```
Project (Opsional) [Link PO to specific project]
┌──────────────────────────────────────┐
│ -- General Purchase --               │▼
├──────────────────────────────────────┤
│ PRJ-2024-001 - Pembangunan Gedung   │
│ PRJ-2024-002 - Renovasi Pabrik      │
└──────────────────────────────────────┘
💡 PO ini akan terhubung dengan project PRJ-2024-001
```

---

## 📊 Benefits

### **Untuk Project-Based Purchase:**
1. ✅ **Budget Tracking** - Tracking cost per project jelas
2. ✅ **Material Tracking** - Material actual vs estimate terkontrol
3. ✅ **Audit Trail** - Material mana untuk project apa tercatat
4. ✅ **Automated Workflow** - Auto-fill dari BOQ, auto-update status
5. ✅ **Reports** - Laporan cost per project akurat

### **Untuk General Purchase:**
1. ✅ **Flexibility** - Bisa beli office supplies, ATK, spare parts umum
2. ✅ **No Restrictions** - Tidak perlu bikin dummy project
3. ✅ **Simple Process** - Input manual seperti biasa

---

## 🔍 Testing Scenarios

### **Test Case 1: Create PO from BOQ**
1. Login sebagai user dengan role Purchasing/Admin
2. Navigate ke Project Management
3. Pilih project yang ada BOQ material
4. Klik tab "BOQ Materials"
5. Klik button "Create PO from BOQ"
6. Verify:
   - ✅ Navigate ke PO page
   - ✅ Form modal auto-open
   - ✅ Project ID pre-filled
   - ✅ Items dari BOQ muncul di table
   - ✅ Supplier auto-filled (jika applicable)
   - ✅ Badge "Linked to Project" muncul

### **Test Case 2: Save PO & Update BOQ Status**
1. Lanjut dari Test Case 1
2. Edit/review PO items jika perlu
3. Fill supplier info
4. Klik "Simpan PO"
5. Verify:
   - ✅ PO tersimpan di list
   - ✅ PO muncul dengan project link di table
   - ✅ Navigate kembali ke Project Management
   - ✅ Cek BOQ tab - status berubah jadi "Ordered"

### **Test Case 3: General Purchase**
1. Navigate ke Purchase Order page
2. Klik "Buat PO Baru"
3. Dropdown "Project" → pilih "-- General Purchase --"
4. Input supplier & items manual
5. Simpan PO
6. Verify:
   - ✅ PO tersimpan dengan projectId = null
   - ✅ Column "Project" shows "General"
   - ✅ No BOQ status update

### **Test Case 4: Filter & Stats**
1. Navigate ke Purchase Order page
2. Verify stats card shows:
   - ✅ Total PO count
   - ✅ Project-Linked PO count (with icon)
3. Check table:
   - ✅ Project column shows project code (linked) atau "General"
   - ✅ Icon indicator visible

---

## 🚀 Future Enhancements

### **Potential Improvements:**
1. 📊 **Reports** - Laporan PO per project
2. 🔄 **Batch Create** - Buat multiple PO dari BOQ sekaligus
3. 📧 **Notifications** - Email notification ke PM saat PO untuk projectnya dibuat
4. 🔗 **Reverse Link** - Di project detail, show list of related POs
5. 💰 **Budget Warning** - Alert jika PO amount exceed project budget
6. 📅 **Timeline Integration** - Link PO delivery date dengan project milestone
7. 🔍 **Advanced Filters** - Filter PO by project, date range, supplier
8. 📤 **Export** - Export PO data per project ke Excel

---

## 📝 Notes

- Field `projectId` adalah **OPTIONAL** - tidak akan break existing PO yang tidak punya projectId
- BOQ status update hanya terjadi saat **SAVE PO** (bukan draft)
- Matching BOQ ↔ PO items menggunakan **nama material & quantity**
- Project dropdown di form PO menampilkan **semua active projects**
- "General Purchase" tidak perlu project, cocok untuk operational purchases

---

## 👥 User Permissions

| Role | Create PO from BOQ | View Project Column | Link/Unlink Project |
|------|-------------------|---------------------|---------------------|
| Admin | ✅ | ✅ | ✅ |
| Purchasing | ✅ | ✅ | ✅ |
| Project Manager | ✅ | ✅ | ✅ |
| Finance | ❌ | ✅ | ❌ |
| Warehouse | ❌ | ✅ | ❌ |

---

**Status:** ✅ Implemented & Ready for Testing
**Version:** 1.0.0
**Last Updated:** January 2025
