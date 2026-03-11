# 🔄 Quotation to Project Auto-Sync System

## Overview

**SEMUA quotation (apapun statusnya) otomatis menjadi project!** Tidak perlu approve dulu. Sistem melakukan **real-time sync** antara quotation dan project.

---

## 🎯 Konsep Auto-Sync

### Logic Flow:
```
CREATE/UPDATE QUOTATION
     ↓
AUTO-SYNC TO PROJECT
     ↓
PROJECT UPDATED REAL-TIME
```

### Status Mapping:
| Quotation Status | Project Status |
|------------------|----------------|
| **Draft** | Planning |
| **Sent** | Planning |
| **Approved** | In Progress |
| **Rejected** | Cancelled |

---

## ⚡ Cara Kerja

### 1️⃣ Buat Quotation Baru

Ketika Anda membuat quotation baru:

```typescript
addQuotation(newQuotation);
```

**Sistem otomatis:**
1. ✅ Simpan quotation
2. ✅ Create project baru dari quotation
3. ✅ Link quotation ↔ project (2-way link)
4. ✅ Transfer semua data:
   - Materials → BOQ
   - Manpower → Budget Labor
   - Schedule → Milestones
   - Consumables → Budget Other
   - Equipment → Budget Equipment

**Result:** Quotation langsung punya project, project langsung punya quotationId!

---

### 2️⃣ Update Quotation

Ketika Anda update quotation (edit data atau ubah status):

```typescript
updateQuotation(quotationId, {
  status: 'Approved',
  materials: [...],
  // ...
});
```

**Sistem otomatis:**
1. ✅ Update quotation
2. ✅ Find linked project
3. ✅ Update project dengan data terbaru
4. ✅ Update status project sesuai mapping
5. ✅ Re-calculate budget
6. ✅ Update BOQ dan milestones

**Result:** Project selalu sync dengan quotation!

---

### 3️⃣ Delete Quotation

Ketika Anda delete quotation:

```typescript
deleteQuotation(quotationId);
```

**Sistem otomatis:**
1. ✅ Delete quotation
2. ✅ Find linked project
3. ✅ Delete project juga

**Result:** Tidak ada orphan project!

---

## 📊 Status Sync Example

### Scenario 1: Draft Quotation
```
Quotation:
- Status: Draft
- Nilai: Rp 500.000.000

Project (Auto-created):
- Status: Planning
- Nilai Kontrak: Rp 500.000.000
- Progress: 0%
```

### Scenario 2: Send to Customer
```
User Action: Klik "Send" button

Quotation:
- Status: Draft → Sent

Project (Auto-updated):
- Status: Planning (tetap)
- Data: Updated
```

### Scenario 3: Customer Approve
```
User Action: Klik "Approve" button

Quotation:
- Status: Sent → Approved

Project (Auto-updated):
- Status: Planning → In Progress
- Ready untuk execution!
```

### Scenario 4: Customer Reject
```
User Action: Klik "Reject" button (jika ada)

Quotation:
- Status: Sent → Rejected

Project (Auto-updated):
- Status: Planning → Cancelled
```

---

## 🔧 Technical Implementation

### syncQuotationToProject Function

```typescript
const syncQuotationToProject = (quotation: Quotation) => {
  // 1. Calculate totals
  const nilaiKontrak = calculateTotal(quotation);
  
  // 2. Map status
  const projectStatus = mapStatus(quotation.status);
  
  // 3. Check if project exists
  const existingProject = projectList.find(p => p.quotationId === quotation.id);
  
  if (existingProject) {
    // UPDATE existing project
    updateProject(existingProject.id, {
      ...mappedData,
      status: projectStatus
    });
  } else {
    // CREATE new project
    const newProject = createProjectFromQuotation(quotation);
    addProject(newProject);
  }
};
```

### Auto-trigger Points:

1. **addQuotation()**
   ```typescript
   const addQuotation = (data: Quotation) => {
     setQuotationList([...quotationList, data]);
     const projectId = syncQuotationToProject(data); // ← AUTO-SYNC
     data.projectId = projectId;
   };
   ```

2. **updateQuotation()**
   ```typescript
   const updateQuotation = (id: string, data: Partial<Quotation>) => {
     const updatedQuotation = { ...quotation, ...data };
     const projectId = syncQuotationToProject(updatedQuotation); // ← AUTO-SYNC
     setQuotationList([...]);
   };
   ```

3. **deleteQuotation()**
   ```typescript
   const deleteQuotation = (id: string) => {
     const quotation = quotationList.find(q => q.id === id);
     setQuotationList(quotationList.filter(q => q.id !== id));
     if (quotation?.projectId) {
       setProjectList(projectList.filter(p => p.id !== quotation.projectId)); // ← AUTO-DELETE
     }
   };
   ```

---

## 📋 Data Transfer Mapping

### Complete Data Flow:

| Quotation Field | Project Field | Notes |
|----------------|---------------|-------|
| `id` | `quotationId` | Link back to quotation |
| `nomorQuotation` | Used in `description` | Reference |
| `perihal` | `namaProject` | Project name |
| `customer.nama` | `customer` | Customer name |
| `customer.alamat` | `location` | Project location |
| `status` | `status` | Mapped (see table above) |
| `materials[]` | `boq[]` | Bill of Quantity |
| `manpower[]` | `budget.labor` | Labor cost |
| `schedule[]` | `milestones[]` | Timeline |
| `consumables[]` | `budget.other` | Other costs |
| `equipment[]` | `budget.equipment` | Equipment budget |
| Calculated Total | `nilaiKontrak` | Contract value |

---

## 🎨 UI Indicators

### Quotation List:
- ✅ Badge "💼 Project" untuk quotation yang punya project
- ✅ Badge status (Draft/Sent/Approved/Rejected)
- ✅ Button "View Project" untuk langsung ke project

### Project List:
- ✅ Badge "📋 From Quotation" untuk project dari quotation
- ✅ Status color-coded:
  - 🟡 Planning (Draft/Sent)
  - 🟢 In Progress (Approved)
  - 🔴 Cancelled (Rejected)

### Dashboard Stats:
- ✅ Total Quotations
- ✅ Status breakdown (Draft/Sent/Approved/Rejected)
- ✅ Projects Synced count
- ✅ Sync Rate (should be 100%)

---

## 💡 Benefits

### 1. **No Manual Work**
- User tidak perlu manually create project
- Data otomatis sync, tidak perlu copy-paste

### 2. **Real-time Sync**
- Update quotation = update project
- Tidak ada data inconsistency

### 3. **Single Source of Truth**
- Quotation adalah master data
- Project adalah execution view

### 4. **Seamless Workflow**
```
Draft Quotation 
  → Send to Customer 
    → Customer Approve 
      → Project Ready untuk Execution 
        → Create PO dari BOQ 
          → Receiving 
            → Project Execution
```

### 5. **Data Integrity**
- 2-way linking (quotation ↔ project)
- Delete cascade (delete quotation = delete project)
- No orphan records

---

## 🔍 Debugging

### Check Console:
```javascript
// Saat create quotation
✅ Project created from quotation:
   projectId: PRJ-1234567890
   quotationId: 2
   status: Planning

// Saat update quotation
🔄 Project updated from quotation:
   projectId: PRJ-1234567890
   quotationId: 2
   status: In Progress

// Saat delete quotation
🗑️ Project deleted along with quotation:
   quotationId: 2
   projectId: PRJ-1234567890
```

### Verify Links:
```javascript
// Check quotation has projectId
console.log(quotation.projectId); // Should exist

// Check project has quotationId
console.log(project.quotationId); // Should exist

// Verify match
const quotation = quotationList.find(q => q.id === '2');
const project = projectList.find(p => p.quotationId === '2');
console.log(quotation.projectId === project.id); // Should be true
```

---

## 📈 Expected Behavior

### After Creating 2 Quotations:
```
Quotation List: 2 items
  - QT-2024-001 (Status: Approved) → projectId: PRJ-APPROVED-001
  - QT-2024-002 (Status: Sent) → projectId: PRJ-SENT-001

Project List: 2 items (from existing + from quotations)
  - PRJ-2024-001 (Status: In Progress) ← quotationId: 1
  - PRJ-2024-002 (Status: Planning) ← quotationId: 2
  - ... (other manual projects)

Sync Rate: 100% (2/2 quotations have projects)
```

---

## 🎯 User Workflow

### Simple Flow:
1. **Create Quotation** → Project auto-created (Planning)
2. **Send Quotation** → Project still Planning
3. **Approve Quotation** → Project becomes In Progress
4. **Execute Project** → Use converted PO, Receiving, etc.

### No Need To:
- ❌ Manually create project
- ❌ Copy data from quotation to project
- ❌ Link quotation dan project manually
- ❌ Update project when quotation changes

### Everything Auto!
- ✅ Create
- ✅ Update
- ✅ Link
- ✅ Sync
- ✅ Delete

---

## 🚀 Quick Start

1. **Buat Quotation:**
   - Klik "Add Quotation"
   - Isi data lengkap (5 komponen)
   - Save

2. **Lihat Project:**
   - Klik tab "Projects"
   - Project sudah ada!
   - Status: Planning

3. **Update Status:**
   - Send quotation → Project tetap Planning
   - Approve quotation → Project jadi In Progress

4. **Execute:**
   - Convert BOQ to PO
   - Create Receiving
   - Project execution!

---

**That's it! 🎉 Semua quotation otomatis jadi project!**
