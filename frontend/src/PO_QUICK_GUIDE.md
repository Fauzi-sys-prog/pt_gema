# 🚀 Quick Guide: Purchase Order dengan Project Integration

## 📌 Ringkasan
Purchase Order (PO) sekarang bisa **terhubung ke project** atau berdiri sendiri (general purchase). Fitur ini memudahkan tracking material project dan procurement umum dalam satu sistem.

---

## 🎯 2 Cara Membuat PO

### **Cara 1: PO untuk Material Project** (Recommended) 🔗

**Step-by-step:**

1. **Buka Project Management**
   ```
   Sidebar → Project → Project Management
   ```

2. **Pilih Project & Tab BOQ**
   - Klik "Detail" pada project yang ingin dibuat PO
   - Pilih tab "BOQ Materials"

3. **Klik "Create PO from BOQ"**
   - Button hijau dengan icon 🛒
   - Badge menunjukkan jumlah material "Not Ordered"
   - Button disabled jika tidak ada material yang perlu di-order

4. **Review & Edit PO**
   - Sistem otomatis mengisi:
     - ✅ Project ID & Name
     - ✅ Material dari BOQ → PO items
     - ✅ Supplier (jika sama semua)
     - ✅ Quantity & Prices
   - Anda bisa edit/tambah/hapus items

5. **Input Supplier Info**
   - Nama supplier
   - Alamat
   - Contact person
   - UP (Attention)

6. **Simpan PO**
   - Status BOQ otomatis update: **"Not Ordered" → "Ordered"** ✅

**Keuntungan:**
- ⚡ Hemat waktu - auto-fill dari BOQ
- 🎯 Tidak ada kesalahan input - data langsung dari BOQ
- 📊 Tracking jelas - BOQ status terupdate otomatis
- 💰 Budget control - PO langsung linked ke project budget

---

### **Cara 2: PO General (Standalone)** 📦

**Step-by-step:**

1. **Buka Purchase Order Page**
   ```
   Sidebar → Purchasing → Purchase Order
   ```

2. **Klik "Buat PO Baru"**
   - Button biru dengan icon ➕

3. **Dropdown Project**
   - Pilih **"-- General Purchase --"**
   - Untuk pembelian yang tidak terkait project tertentu

4. **Input Manual**
   - Supplier info
   - Items & quantity
   - Prices
   - Notes

5. **Simpan PO**
   - PO akan muncul dengan label "General" di kolom Project

**Kapan pakai cara ini?**
- 🖊️ Office supplies / ATK
- 🔧 Spare parts umum
- 🏢 Operational purchases
- 🎁 Corporate gifts

---

## 🔍 Fitur Filter & Search

### **Filter PO by Project**
```
┌─────────────────────────────────┐
│ 🔍 Semua Project            │▼  │
├─────────────────────────────────┤
│ 📦 General Purchase              │
│ ━━━━━━━ Projects ━━━━━━━━       │
│ 🔗 PRJ-2024-001                  │
│ 🔗 PRJ-2024-002                  │
└─────────────────────────────────┘
```

**Cara pakai:**
1. Pilih dropdown filter (kolom ke-4)
2. Pilih project yang ingin dilihat PO-nya
3. Table akan filter otomatis
4. Badge info muncul di atas table
5. Klik ❌ untuk clear filter

### **Search PO**
- Cari berdasarkan: **No PO** atau **Supplier**
- Real-time search, langsung filter saat mengetik

### **Filter by Status**
- Draft
- Sent
- Partial
- Received
- Cancelled

---

## 📊 Stats & Indicators

### **Dashboard Cards**
```
┌─────────────┐ ┌──────────────────┐ ┌──────────┐
│ Total PO    │ │ 🔗 Project-Linked │ │ Draft    │
│ 15          │ │ 8                 │ │ 3        │
└─────────────┘ └──────────────────┘ └──────────┘
```

### **Visual Indicators**

**1. Di Table:**
| Project Column | Meaning |
|---------------|---------|
| 🔗 **PRJ-2024-001** | PO linked ke project (clickable) |
| _General_ | General purchase (tidak linked) |

**2. Di Form Modal:**
```
Buat Purchase Order Baru  [🔗 Linked to Project]
                          ↑ Badge muncul jika linked
```

**3. Di BOQ Tab:**
```
[🛒 Create PO from BOQ] [5]
                        ↑ Jumlah material "Not Ordered"
```

---

## 🔗 Navigation & Integration

### **PO → Project**
Klik project code di table PO untuk jump langsung ke project detail:
```
Table PO → Kolom "Project" → Klik [🔗 PRJ-2024-001]
                               ↓
                    Auto-open Project Detail Modal
```

### **Project → PO**
Dari project detail, langsung create PO:
```
Project Detail → Tab "BOQ Materials" → [🛒 Create PO from BOQ]
                                        ↓
                              Navigate to PO Page (auto-filled)
```

### **BOQ Status Flow**
```
BOQ: "Not Ordered" → Create PO → Save PO → BOQ: "Ordered" ✅
```

---

## 💡 Tips & Best Practices

### **✅ DO:**
1. **Gunakan "Create PO from BOQ"** untuk material project
   - Lebih cepat dan akurat
   
2. **Review items** sebelum save
   - Cek quantity, prices, supplier
   
3. **Grouping by supplier** jika memungkinkan
   - Satu PO untuk satu supplier lebih efisien
   
4. **Update status PO** secara berkala
   - Draft → Sent → Received
   
5. **Link ke project** jika pembelian untuk project tertentu
   - Memudahkan cost tracking

### **❌ DON'T:**
1. **Jangan manual input** material project
   - Gunakan auto-fill dari BOQ
   
2. **Jangan lupa supplier info**
   - Alamat, contact, UP harus lengkap
   
3. **Jangan link ke project** untuk general purchase
   - Office supplies, ATK → pilih "General Purchase"
   
4. **Jangan edit PO** yang sudah status "Received"
   - Buat PO baru atau revisi

---

## 🛠️ Troubleshooting

### **Q: Button "Create PO from BOQ" disabled?**
**A:** Tidak ada material dengan status "Not Ordered". Semua material sudah di-order atau digunakan.

### **Q: Auto-fill tidak muncul?**
**A:** Pastikan:
- Navigate dari Project Management → BOQ tab
- Klik button "Create PO from BOQ" (bukan "Buat PO Baru")
- Ada material dengan status "Not Ordered"

### **Q: BOQ status tidak update setelah save PO?**
**A:** Cek:
- PO sudah di-save (bukan draft)
- Item name & quantity match dengan BOQ
- Project ID terisi di PO

### **Q: Project dropdown kosong?**
**A:** Belum ada project aktif. Buat project dulu di Project Management.

### **Q: Tidak bisa edit PO?**
**A:** Hanya PO dengan status "Draft" yang bisa diedit. PO "Sent", "Received", atau "Cancelled" tidak bisa diedit.

---

## 📈 Reporting & Analytics

### **View PO per Project**
1. Gunakan filter dropdown "Project"
2. Pilih project yang ingin dilihat
3. Export atau print PO list

### **Budget Tracking**
```
Project Dashboard → Budget Tab
                    ↓
        Lihat actual cost dari linked PO
```

### **Material Status**
```
Project Detail → BOQ Tab
                 ↓
      Status per material:
      - Not Ordered (merah)
      - Ordered (kuning) 
      - Used (hijau)
```

---

## 🎯 Workflow Summary

```
┌─────────────────────┐
│  Data Collection    │ ← Input qty, spec (no price)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Quotation        │ ← Input prices
└──────────┬──────────┘
           │
           ▼ (Approved)
┌─────────────────────┐
│     Project         │ ← Auto-created with BOQ
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  BOQ Materials      │ ← Status: "Not Ordered"
└──────────┬──────────┘
           │
           ▼ [Create PO from BOQ]
┌─────────────────────┐
│  Purchase Order     │ ← Linked to Project ✅
└──────────┬──────────┘
           │
           ▼ (Save)
┌─────────────────────┐
│  BOQ Status Update  │ ← "Not Ordered" → "Ordered"
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│     Receiving       │ ← Material diterima
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│   Stock In/Out      │ ← Inventory tracking
└─────────────────────┘
```

---

## 🏁 Checklist: Create PO from Project

```
☐ 1. Buka Project Management
☐ 2. Pilih project yang benar
☐ 3. Masuk ke tab "BOQ Materials"
☐ 4. Pastikan ada material "Not Ordered"
☐ 5. Klik "Create PO from BOQ"
☐ 6. Review items yang auto-filled
☐ 7. Edit quantity/prices jika perlu
☐ 8. Input supplier info lengkap
☐ 9. Tambah notes jika perlu
☐ 10. Save PO
☐ 11. Verify BOQ status berubah jadi "Ordered"
```

---

**Happy Ordering! 🎉**

Untuk pertanyaan lebih lanjut, hubungi:
- 📧 Email: support@gmteknik.com
- 💬 Chat: Admin ERP System
- 📱 WhatsApp: +62 812-3456-7890
