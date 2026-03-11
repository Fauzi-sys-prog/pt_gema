# ⚡ QUICK GUIDE: Auto-Sync Quotation ke Project

## 🎯 Ringkasan Singkat

**SEMUA quotation otomatis jadi project!** Tidak perlu approve dulu, tidak perlu manual create project.

---

## ✅ Yang Berubah

### ❌ DULU (Old Logic):
```
1. Buat Quotation (Draft)
2. Send ke Customer (Sent)
3. ⭐ APPROVE → Baru create project
4. Project muncul
```

### ✅ SEKARANG (New Logic):
```
1. Buat Quotation (Draft) → Project AUTO-CREATED ✨
2. Send ke Customer (Sent) → Project AUTO-UPDATED ✨
3. Approve/Reject → Project STATUS AUTO-UPDATED ✨
```

---

## 📊 Status Mapping

| Quotation | → | Project |
|-----------|---|---------|
| Draft | → | Planning |
| Sent | → | Planning |
| **Approved** | → | **In Progress** ✅ |
| Rejected | → | Cancelled |

---

## 🚀 Cara Pakai

### 1. Buat Quotation
```
Menu Project → Tab Quotations → Add Quotation
Isi data → Save
```

**Hasil:**
- ✅ Quotation tersimpan (Status: Draft)
- ✅ Project AUTO-CREATED (Status: Planning)
- ✅ Badge "📋 From Quotation" muncul di project

### 2. Send Quotation
```
Klik button "📧 Send" di quotation list
```

**Hasil:**
- ✅ Quotation status: Draft → Sent
- ✅ Project status: Planning (no change)
- ✅ Data ter-update

### 3. Approve Quotation
```
Klik button "✅ Approve" di quotation list
```

**Hasil:**
- ✅ Quotation status: Sent → Approved
- ✅ Project status: Planning → In Progress
- ✅ Project ready untuk execution!

---

## 🔍 Verifikasi

### Di Tab Quotations:
- Lihat badge **"💼 Project"** di setiap quotation
- Klik "View Detail" → Lihat link ke project

### Di Tab Projects:
- Lihat badge **"📋 From Quotation"** di project
- Klik "View Detail" → Tab "Overview" → Lihat link ke quotation

### Di Dashboard Stats:
- **Projects Synced** = Total quotations
- **Sync Rate** = 100%

---

## 💡 Tips

### DO:
✅ Langsung buat quotation, project otomatis muncul
✅ Edit quotation kapan saja, project auto-update
✅ Approve quotation, project langsung "In Progress"

### DON'T:
❌ Jangan manually create project dari quotation (sudah auto!)
❌ Jangan copy-paste data (sudah auto-sync!)
❌ Jangan khawatir data tidak sync (real-time!)

---

## 📝 Example

### Skenario: Buat Quotation Baru

**Action:**
```
1. Klik "Add Quotation"
2. Isi:
   - Perihal: "Renovasi Kantor ABC"
   - Customer: "PT ABC Corp"
   - Materials: Semen 500 sak @ Rp 65.000
   - Manpower: Mandor 1 orang, 120 hari @ Rp 250.000
   - PPN: 11%
3. Klik "Save Quotation"
```

**Result:**
```
✅ Quotation Created:
   - Nomor: QT-2024-003
   - Status: Draft
   - projectId: PRJ-1234567890 ← AUTO-LINKED

✅ Project Created:
   - Kode: PRJ-2024-003
   - Nama: "Renovasi Kantor ABC"
   - Status: Planning
   - quotationId: 3 ← AUTO-LINKED
   - Nilai Kontrak: Rp XXX.XXX.XXX (auto-calculated)
   - BOQ: Semen 500 sak (from materials)
   - Budget Labor: Rp 30.000.000 (from manpower)
```

### Lihat Hasilnya:

**Tab Quotations:**
```
📄 QT-2024-003 - Renovasi Kantor ABC
   Status: 🟡 Draft
   Badge: 💼 Project ← Project sudah dibuat!
   Customer: PT ABC Corp
```

**Tab Projects:**
```
📋 PRJ-2024-003 - Renovasi Kantor ABC
   Status: 🟡 Planning
   Badge: 📋 From Quotation ← Dari quotation!
   Customer: PT ABC Corp
   Nilai: Rp XXX.XXX.XXX
```

---

## 🎉 Done!

Sekarang quotation dan project selalu sync otomatis. 
Fokus aja ke proses approval dan execution!

---

**Questions?** Check: `/QUOTATION_AUTO_SYNC.md` untuk detail lengkap.
