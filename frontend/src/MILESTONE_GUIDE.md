# 📋 Milestone Management Guide

## ✨ Fitur Baru yang Ditambahkan

### 1. **Auto-Convert Schedule → Milestone**
Ketika quotation di-**approve**, sistem akan otomatis:
- ✅ Membuat project baru
- ✅ **Mengkonversi semua Schedule dari quotation menjadi Milestone di project**
- ✅ Mentransfer status schedule ke milestone (Completed, In Progress, Pending)

**Contoh Workflow:**
```
Data Collection (Schedule tanpa harga)
    ↓
Quotation (Schedule + harga)
    ↓
Approve Quotation
    ↓
✨ Auto-create Project + Milestones ✨
```

---

### 2. **CRUD Milestone di Project Management**

#### **Tambah Milestone Baru**
1. Buka **Project Management** → pilih project
2. Klik tab **Milestones**
3. Klik tombol **"+ Tambah Milestone"**
4. Isi form:
   - **Nama Milestone** (contoh: "Kick-off Meeting", "Design Phase")
   - **Target Tanggal** (due date)
   - **Status** (Pending / In Progress / Completed)
5. Klik **Simpan**

#### **Edit Milestone**
1. Pada tab Milestones, klik tombol **Edit** (icon pensil) pada milestone yang ingin diubah
2. Update data yang diperlukan
3. Klik **Simpan**

#### **Hapus Milestone**
1. Klik tombol **Hapus** (icon trash) pada milestone yang ingin dihapus
2. Konfirmasi penghapusan

#### **Update Status Milestone**
- **Pending**: Milestone belum dimulai
- **In Progress**: Milestone sedang dikerjakan
- **Completed**: Milestone sudah selesai

---

## 📊 Mapping Schedule → Milestone

| **Field di Schedule**    | **Field di Milestone** |
|--------------------------|------------------------|
| `activity`               | `name`                 |
| `endDate`                | `dueDate`              |
| `status`                 | `status`               |
| - Completed              | → Completed            |
| - In Progress            | → In Progress          |
| - Not Started/Planned    | → Pending              |

---

## 🎯 Contoh Use Case

### **Scenario: Approve Quotation QT-2024-002**

**Quotation memiliki Schedule:**
1. Persiapan Site (2024-02-01 - 2024-02-07) - Completed
2. Pekerjaan Struktur (2024-02-08 - 2024-04-08) - In Progress

**Setelah approve → Project akan memiliki Milestones:**
1. ✅ Persiapan Site - Due: 07 Feb 2024 - Status: Completed
2. 🔵 Pekerjaan Struktur - Due: 08 Apr 2024 - Status: In Progress

User dapat menambah milestone baru seperti:
3. ⏳ Inspeksi Final - Due: 15 Apr 2024 - Status: Pending

---

## 🔧 Technical Details

### **File yang Dimodifikasi:**

1. **`/contexts/AppContext.tsx`**
   - Menambahkan auto-convert Schedule → Milestone di function `updateQuotation`
   - Line: ~2141-2149

2. **`/pages/ProjectManagementPage.tsx`**
   - Menambahkan state management untuk Milestone CRUD
   - Menambahkan handler functions (Add, Edit, Delete, Save)
   - Menambahkan UI form modal untuk Milestone
   - Update tab Milestones dengan tombol CRUD

---

## ✅ Testing Checklist

- [ ] Approve quotation yang punya schedule → cek apakah milestone ter-create
- [ ] Tambah milestone baru di project → simpan → refresh → milestone masih ada
- [ ] Edit milestone → update status → simpan → status berubah
- [ ] Hapus milestone → milestone terhapus
- [ ] Approve quotation tanpa schedule → project dibuat tanpa milestone (tidak error)

---

## 📝 Notes

- Milestone hanya dibuat saat quotation **pertama kali di-approve**
- Jika quotation sudah pernah di-approve sebelumnya, tidak akan membuat project/milestone lagi
- Format tanggal milestone menggunakan format Indonesia (contoh: 7 Februari 2024)
- Status milestone dapat diupdate kapan saja melalui form Edit

---

**Developed by: GM TEKNIK ERP System**  
**Last Updated: 2025-01-23**
