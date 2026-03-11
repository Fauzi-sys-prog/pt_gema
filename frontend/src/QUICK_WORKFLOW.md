# 📊 Quick Workflow Reference

Visual quick reference untuk workflow sistem ERP.

---

## 🎯 3-Step Process

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│     STEP 1   │      │     STEP 2   │      │     STEP 3   │
│              │  →   │              │  →   │              │
│    DATA      │      │  QUOTATION   │      │   PROJECT    │
│  COLLECTION  │      │  (Penawaran) │      │  MANAGEMENT  │
│              │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
 Input awal            Hitung harga          Eksekusi
 Survey customer       Kirim penawaran       Monitor progress
```

---

## 🧩 5 Components (Sama di semua module)

```
┌─────────────────────────────────────────────────────┐
│  1. 📦 BOQ MATERIALS     → Kebutuhan material       │
│  2. 👷 MANPOWER          → Tenaga kerja             │
│  3. 📅 SCHEDULE          → Jadwal kerja             │
│  4. 🛠️ CONSUMABLES       → Barang habis pakai       │
│  5. 🚜 EQUIPMENT         → Alat/mesin               │
└─────────────────────────────────────────────────────┘
```

---

## 💡 Quick Actions

### **STEP 1: Data Collection**

```bash
Menu: Sales & Project → Data Collection

Actions:
1. Klik "Buat Data Collection"
2. Isi customer info
3. Tambah 5 komponen
4. Simpan
5. Klik "Kirim ke Quotation" ✨
```

### **STEP 2: Quotation**

```bash
Menu: Sales & Project → Project Quotation

Actions:
1. Data auto pre-fill dari Data Collection ✅
2. Review & adjust harga
3. Tambah PPN (10%)
4. Set status "Sent"
5. Tunggu approval
6. Klik "Convert to Project" ✨
```

### **STEP 3: Project**

```bash
Menu: Sales & Project → Project Management

Actions:
1. Project otomatis terbuat ✅
2. Set status "In Progress"
3. Update progress berkala
4. Track actual cost
5. Complete project
```

---

## 📋 Data Flow

```
DATA COLLECTION          QUOTATION              PROJECT
─────────────────        ─────────────          ──────────

DC-001                   QT-2025-001            PROJ-2025-001
├─ Customer Info    →    ├─ Customer      →     ├─ Customer
├─ 5 Materials      →    ├─ 5 Materials   →     ├─ 5 Materials
├─ 3 Manpower       →    ├─ 3 Manpower    →     ├─ 3 Manpower
├─ 8 Schedule       →    ├─ 8 Schedule    →     ├─ 8 Schedule
├─ 10 Consumables   →    ├─ 10 Consumables →    ├─ 10 Consumables
└─ 4 Equipment      →    └─ 4 Equipment   →     └─ 4 Equipment
                         + PPN 10%               + Budget Tracking
                         + Terms                 + Progress Monitor
                         = Rp 935,000,000        = Rp 935,000,000
```

---

## 🎨 Status Flow

```
DATA COLLECTION:
└─ Active / Inactive

QUOTATION:
Draft → Sent → Approved → [Convert to Project]
              ↓
           Rejected

PROJECT:
Planning → In Progress → Completed
                ↓
             On Hold
```

---

## 💰 Calculation Example

```
MATERIALS:       Rp 500,000,000
MANPOWER:        Rp 200,000,000
CONSUMABLES:     Rp  50,000,000
EQUIPMENT:       Rp 100,000,000
────────────────────────────────
SUBTOTAL:        Rp 850,000,000
PPN 10%:         Rp  85,000,000
────────────────────────────────
GRAND TOTAL:     Rp 935,000,000 ✅
```

---

## 🚀 Quick Tips

```
✅ Selalu lengkapi 5 komponen
✅ Review data sebelum transfer
✅ Double-check calculation
✅ Update status secara berkala
✅ Dokumentasi lengkap

❌ Jangan skip komponen
❌ Jangan estimasi asal
❌ Jangan lupa PPN
❌ Jangan ignore budget overrun
```

---

## 📞 Need Detail?

Baca dokumentasi lengkap: **WORKFLOW_GUIDE.md**

---

**Simple. Fast. Integrated. 🎯**
