# 🎯 Panduan Approve Quotation & Auto-Create Project

## Overview
Fitur ini memungkinkan Anda untuk mengubah quotation yang sudah di-approve menjadi project secara **otomatis**. Semua data dari quotation akan ditransfer ke project baru tanpa perlu input ulang.

---

## 📋 Langkah-Langkah Menggunakan Fitur

### 1️⃣ Buat Quotation Baru

1. **Masuk ke Menu Project**
   - Klik menu "Project" di sidebar
   - Pilih tab **"Quotations"**

2. **Klik "Add Quotation"**
   - Isi data header quotation:
     - Nomor Quotation (auto-generated)
     - Tanggal
     - Perihal (judul project)
     - Customer (nama, alamat, PIC)
     - PPN (%)

3. **Lengkapi 5 Komponen Quotation:**

   #### a. BOQ Materials
   - Klik "Add Material"
   - Isi: Material Name, Quantity, Unit, Unit Price
   - Total Price akan auto-calculate
   
   #### b. Manpower
   - Klik "Add Manpower"
   - Isi: Position, Quantity, Daily Rate, Duration (days)
   - Total Cost akan auto-calculate
   
   #### c. Schedule
   - Klik "Add Schedule"
   - Isi: Activity, Start Date, End Date
   - Duration akan auto-calculate
   
   #### d. Consumables
   - Klik "Add Consumable"
   - Isi: Item Name, Quantity, Unit, Unit Price, Category
   - Total Cost akan auto-calculate
   
   #### e. Equipment
   - Klik "Add Equipment"
   - Isi: Equipment Name, Quantity, Unit, Rental Rate, Duration
   - Total Cost akan auto-calculate

4. **Review & Save**
   - Review semua data
   - Klik "Save Quotation"
   - Status awal: **"Draft"**

---

### 2️⃣ Send Quotation ke Customer

1. **Di List Quotations**
   - Cari quotation yang sudah dibuat
   - Klik button **"📧 Send"**
   - Konfirmasi: "Send Quotation ke customer?"
   
2. **Status Berubah**
   - Status otomatis berubah menjadi **"Sent"**
   - Quotation siap dikirim ke customer

---

### 3️⃣ Approve Quotation ✅ (Auto-Create Project)

**Ini adalah langkah PENTING yang akan auto-create project!**

1. **Klik Button "✅ Approve"**
   - Di quotation list, klik button approve (hijau dengan icon checkmark)
   
2. **Konfirmasi Dialog Muncul:**
   ```
   ✅ APPROVE QUOTATION?
   
   Quotation: QT-2024-XXX
   Customer: PT Nama Customer
   Value: Rp XXX.XXX.XXX
   
   ✨ Project baru akan otomatis dibuat dari quotation ini!
   ```

3. **Klik "OK" untuk Approve**

4. **Sistem Otomatis Melakukan:**
   
   ✅ **Update Status**
   - Quotation status → "Approved"
   
   ✅ **Calculate Total Nilai Kontrak**
   ```
   Total Materials   = Σ (materials.totalPrice)
   Total Manpower    = Σ (manpower.totalCost)
   Total Consumables = Σ (consumables.totalCost)
   Total Equipment   = Σ (equipment.totalCost)
   
   Subtotal = Total Materials + Manpower + Consumables + Equipment
   PPN      = Subtotal × (ppn / 100)
   
   Nilai Kontrak = Subtotal + PPN
   ```
   
   ✅ **Create New Project**
   - Project ID: `PRJ-{timestamp}`
   - Kode Project: `PRJ-2024-XXX` (auto-increment)
   - Status: "Planning"
   
   ✅ **Transfer Data ke Project:**
   | From Quotation | To Project |
   |----------------|------------|
   | `perihal` | `namaProject` |
   | `customer.nama` | `customer` |
   | `customer.alamat` | `location` |
   | `materials[]` | `boq[]` (Bill of Quantity) |
   | `schedule[]` | `milestones[]` |
   | Calculated total | `nilaiKontrak` |
   | All costs | `budget` breakdown |
   
   ✅ **Link Quotation ↔ Project**
   - Quotation.projectId = new project ID
   - Project.quotationId = quotation ID
   
   ✅ **Log to Console** (for debugging)
   ```
   ✅ Project created successfully:
     projectId: PRJ-1234567890
     kodeProject: PRJ-2024-003
     quotationId: 1
     nomorQuotation: QT-2024-001
   ```

5. **Alert Success Muncul:**
   ```
   🎉 QUOTATION APPROVED!
   
   ✅ Status: Approved
   ✅ Project baru telah dibuat!
   
   📋 Data yang ditransfer:
   • BOQ Materials
   • Manpower
   • Schedule → Milestones
   • Consumables → Other Budget
   • Equipment Budget
   
   👉 Buka menu "Project" untuk melihat project baru!
   ```

---

### 4️⃣ Lihat Project yang Dibuat

1. **Klik Tab "Projects"**
   - Di halaman yang sama, klik tab "Projects"
   
2. **Cari Project Baru**
   - Project akan muncul dengan badge **"📋 From Quotation"**
   - Nama project = perihal quotation
   - Status: "Planning"

3. **Klik "View Detail"**
   - Lihat semua data yang sudah ditransfer
   - BOQ Materials sudah terisi
   - Milestones sudah terisi dari schedule
   - Budget breakdown sudah terisi

4. **Info Box Muncul di Overview:**
   ```
   🔗 Project Link Info
   Project: PRJ-2024-003
   
   ✅ Created from Quotation: QT-2024-001
   → Penawaran Renovasi Gedung Kantor
   
   Customer: PT Maju Jaya
   Approved Date: 2024-01-10
   ```

---

## 📊 Visual Indicators

### Di Halaman Quotations:

1. **Status Badge**
   - 🟢 **Approved** = Quotation telah di-approve
   
2. **Project Badge**
   - 💼 **Project** = Project sudah dibuat
   
3. **Detail Modal**
   - **"Project Created"** info box (hijau)
   - Button **"View Project"** untuk langsung ke project

### Di Halaman Projects:

1. **Project Card Badge**
   - 📋 **"From Quotation"** = Project dibuat dari quotation
   
2. **Quotation Stats Widget** (di atas)
   - Total Quotations
   - Approved count
   - Projects Created count
   - Conversion Rate (%)
   
3. **Progress Bars**
   - Approval Rate
   - Project Creation Success Rate

---

## 🔍 Verifikasi & Troubleshooting

### ✅ Cara Memverifikasi Project Sudah Dibuat:

1. **Check Console Log:**
   - Buka Developer Tools (F12)
   - Tab Console
   - Cari: `✅ Project created successfully:`

2. **Check Quotation:**
   - Buka quotation detail
   - Lihat badge "💼 Project"
   - Lihat info "Project Created" dengan ID

3. **Check Project List:**
   - Tab "Projects"
   - Lihat badge "📋 From Quotation"
   - Klik detail, lihat link info ke quotation

### ⚠️ Troubleshooting:

**Problem: Project tidak dibuat setelah approve**

Kemungkinan penyebab:
1. Quotation sudah punya projectId → Tidak akan create duplikat
2. Status quotation sudah "Approved" sebelumnya → Tidak akan create lagi
3. Data quotation tidak lengkap → Check console error

**Solution:**
- Check quotation.projectId di console
- Check quotation.status sebelum approve
- Pastikan materials/manpower/schedule ada data

---

## 💡 Tips & Best Practices

### ✅ DO:
1. **Isi semua 5 komponen** quotation sebelum approve
2. **Review total value** sebelum approve
3. **Pastikan schedule** memiliki start/end date yang valid
4. **Check customer info** sudah benar
5. **Gunakan notes** untuk informasi tambahan

### ❌ DON'T:
1. **Jangan approve** quotation yang belum siap
2. **Jangan delete** quotation yang sudah approved
3. **Jangan edit** quotation approved tanpa konfirmasi
4. **Jangan approve** quotation yang sudah punya projectId

---

## 🎯 Workflow Lengkap: Quotation → Project → PO

```
1. CREATE QUOTATION
   ↓
2. SEND TO CUSTOMER
   ↓
3. APPROVE QUOTATION ← Auto-create Project
   ↓
4. PROJECT CREATED
   ↓
5. CONVERT BOQ → PO
   ↓
6. CREATE RECEIVING
   ↓
7. PROJECT EXECUTION
```

---

## 📈 Metrics & Analytics

### Dashboard Stats:
- **Total Quotations**: Semua quotation (all status)
- **Approved**: Quotation dengan status "Approved"
- **Projects Created**: Jumlah project dari quotation
- **Conversion Rate**: (Approved / Total) × 100%
- **Success Rate**: (Projects Created / Approved) × 100%

### Expected Values:
- Conversion Rate: 30-50% (industri normal)
- Success Rate: 100% (jika sistem bekerja normal)

---

## 🔐 Security & Validation

### Auto-Create akan GAGAL jika:
1. Quotation sudah memiliki `projectId`
2. Quotation status sudah "Approved" sebelumnya
3. Data quotation tidak valid
4. Missing required fields

### Data Validation:
- Materials: minimal 1 item
- Customer: nama & alamat required
- Nilai kontrak: > 0
- Schedule: start date < end date

---

## 📞 Support

Jika mengalami masalah:
1. Check console log untuk error
2. Verifikasi data quotation lengkap
3. Review QUOTATION_TO_PROJECT_FLOW.md
4. Check AppContext.tsx untuk logic auto-create

---

**Happy Quoting! 🎉**
