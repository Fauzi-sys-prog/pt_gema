# 🚀 QUICK GUIDE: Auto-Create Project dari Quotation

## 📌 APA YANG BERUBAH?

### ✅ QUOTATION PAGE
Sekarang ada tombol untuk **Approve** quotation yang otomatis bikin project!

### ❌ PROJECT PAGE
Tombol **Edit** di list project sudah **DIHAPUS** (project dari quotation adalah read-only).

---

## 🎯 CARA PAKAI (3 LANGKAH MUDAH)

### STEP 1: Buat Quotation
1. Buka **Project Quotation**
2. Klik **+ Add Quotation**
3. Isi data lengkap:
   - Customer info
   - Materials (BOQ) + harga
   - Manpower + cost
   - Consumables
   - Equipment
4. **Save** → Status: **Draft**

### STEP 2: Send ke Customer
1. Di list quotation, klik tombol **📧 Send** (warna purple)
2. Confirm
3. Status berubah → **Sent**

### STEP 3: Approve Quotation
1. Di list quotation, klik tombol **✅ Approve** (warna hijau)
2. Akan muncul confirmation:
   ```
   ✅ APPROVE QUOTATION?
   
   Quotation: QUO-2026-001
   Customer: PT. ABC
   Value: Rp 500,000,000
   
   ✨ Project baru akan otomatis dibuat!
   ```
3. Klik **OK**
4. Muncul success message
5. Badge **"✅ Project"** muncul di quotation
6. **OTOMATIS!** Project baru sudah dibuat! 🎉

---

## 🔍 CARA CEK PROJECT YANG DIBUAT

1. Buka menu **Project Management**
2. Project baru otomatis ada di list
3. Klik **Detail** untuk lihat:
   - ✅ Customer info lengkap
   - ✅ Budget (nilai kontrak)
   - ✅ BOQ materials lengkap
   - ✅ Manpower schedule
   - ✅ Consumables
   - ✅ Equipment
   - ✅ Status: Planning

---

## 🎨 VISUAL GUIDE

### Tombol di List Quotation:

| Status | Tombol Tersedia | Warna | Icon |
|--------|----------------|-------|------|
| **Draft** | View, Edit, Print, **Send**, Delete | Purple | 📧 |
| **Sent** | View, Edit, Print, **Approve**, **Reject**, Delete | Green/Red | ✅ ❌ |
| **Approved** | View, Edit, Print, **Badge: "✅ Project"** | - | - |
| **Rejected** | View, Edit, Print, Delete | - | - |

### Tombol di List Project:

| Sebelumnya | Sekarang |
|------------|----------|
| View, **~~Edit~~**, Delete | View, Delete |

---

## ⚠️ CATATAN PENTING

1. **Delete Protection**: Quotation yang sudah Approved **tidak bisa di-delete** (tombol hidden)

2. **Double Approve Protection**: Kalau coba approve lagi, akan muncul peringatan:
   ```
   ⚠️ Quotation ini sudah di-approve dan project sudah dibuat!
   ```

3. **Project Read-Only**: Project yang dibuat dari quotation tidak bisa di-edit lewat tombol Edit (karena tombol sudah dihapus)

4. **Two-Way Link**: 
   - Quotation punya link ke Project (`projectId`)
   - Project punya link ke Quotation (`quotationId`)

---

## 💡 TIPS & TRICKS

### Workflow Terbaik:
```
Data Collection (qty saja) 
  → Quotation (tambah harga) 
  → Send 
  → Approve 
  → Project Created! 
  → Start Execution
```

### Quick Check:
- **Quotation berhasil di-approve?** → Cek badge "✅ Project"
- **Project sudah dibuat?** → Buka Project Management, cek list terbaru
- **Data transfer lengkap?** → Klik Detail di project, verify BOQ

---

## ❓ FAQ

**Q: Bisa edit project yang dari quotation?**
A: Tidak lewat tombol Edit di list (karena sudah dihapus). Tapi bisa update lewat menu lain (mis: update progress, actual cost, dll)

**Q: Kalau quotation di-reject, gimana?**
A: Project tidak akan dibuat. Quotation status jadi "Rejected" dan bisa di-delete.

**Q: Bisa approve quotation tanpa harga?**
A: Bisa, tapi project yang dibuat akan punya nilai kontrak Rp 0 (tidak recommended)

**Q: Bisa delete quotation yang sudah approved?**
A: Tidak. Tombol Delete hidden untuk approved quotation (data protection)

**Q: Bisa approve quotation yang masih Draft?**
A: Tidak. Harus Send dulu, baru bisa Approve.

---

**Selamat mencoba! 🎉**

Kalau ada pertanyaan atau bug, silakan report.
