# 📋 Quotation Specifications Feature Guide

## ✅ **FITUR BARU: SPECIFICATION DETAIL UNTUK ITEM PENAWARAN**

Fitur ini memungkinkan setiap item material di Penawaran memiliki **specification detail** yang lengkap seperti di dokumen penawaran resmi PT GEMA TEKNIK PERKASA.

---

## 🎯 **APA YANG SUDAH DITAMBAHKAN?**

### **1. ✅ Interface Update**
- **Material Interface** di `ProjectQuotationPage.tsx` sekarang punya field `specifications?: string[]`
- **QuotationItem** di `AppContext.tsx` sudah support `spesifikasi?: string[]`

### **2. ✅ Form Input Specifications**
Di **Material Modal**, sekarang ada section baru:
- **Input field** untuk mengetik specification
- **Tekan Enter** atau klik tombol **+** untuk menambahkan spec ke list
- **Preview list** dengan bullet points
- **Tombol hapus** untuk setiap spec line
- **Scroll** untuk spec yang banyak (max-height: 192px)

**Contoh Cara Pakai:**
1. Klik "Add Material" di Quotation Form
2. Isi "Material Name": `W2-SER Shotcrete Machine`
3. Di section "Specifications", ketik:
   - `Electric Motor Machine 1 Set` → Enter
   - `Pre-dampening Nozzle Assy 1 Set` → Enter
   - `Conveying Hose Ø38mm 50ft. Length 1 Pcs` → Enter
   - ... (dst)
4. Isi Quantity, Unit, Unit Price
5. Simpan

### **3. ✅ Print Preview Format**
Di **Print Modal / Detail Quotation**, spec ditampilkan dengan format:

```
┌─────────────────────────────────────────────────┐
│ No │ Jenis Barang                               │
├────┼────────────────────────────────────────────┤
│ 1  │ W2-SER Shotcrete Machine                   │
│    │ Specification :                            │
│    │ - Electric Motor Machine 1 Set             │
│    │ - Pre-dampening Nozzle Assy 1 Set          │
│    │ - Conveying Hose Ø38mm 50ft. Length 1 Pcs  │
│    │ - Double - double nozzle tip 2 pcs         │
│    │ - Water Hose ID13. L=50m 1 pcs             │
│    │ ... (dan seterusnya)                       │
└────┴────────────────────────────────────────────┘
```

**Format sesuai dokumen asli:**
- ✅ Nama barang **bold** di baris pertama
- ✅ Kata "Specification :" di baris kedua
- ✅ Spec detail sebagai **bullet list** dengan dash (-)
- ✅ Semua dalam satu cell kolom "Jenis Barang"

### **4. ✅ Display di Material List (Form)**
Di tabel material list (sebelum print), ada indicator:
```
Semen Portland
2 specs  ← menunjukkan jumlah spec
```

### **5. ✅ Mock Data Examples**

**Contoh 1: Semen Portland (Simple)**
```javascript
{
  materialName: "Semen Portland",
  specifications: [
    "Tipe I sesuai SNI 2049:2015",
    "Kemasan 50kg per sak",
    "Kuat tekan minimum 250 kg/cm²",
    "Sertifikat quality test dari pabrik"
  ],
  quantity: 500,
  unit: "sak",
  unitPrice: 65000
}
```

**Contoh 2: W2-SER Shotcrete Machine (Complex)**
```javascript
{
  materialName: "W2-SER Shotcrete Machine",
  specifications: [
    "Electric Motor Machine 1 Set",
    "Pre-dampening Nozzle Assy 1 Set",
    "Conveying Hose Ø38mm 50ft. Length 1 Pcs",
    "Double - double nozzle tip 2 pcs",
    "Water Hose ID13. L=50m 1 pcs",
    "Water Nozzle ( Long ) 1 pcs",
    "Rubber Hose Joint ( Short ) 1 pcs",
    "Quick Coupling 2 pcs",
    "Upper Sealing Plate 1 pcs",
    "Lower Sealing Plate 1 pcs",
    "High Pressure Water Pump 1 set",
    "Electric Motor Driven:",
    "- Model : TQB80/0.37",
    "- Max. Horizontal Conveying Distance 200m",
    "- Max. Vertical Conveying Distance 100m",
    "- Conveying Capacity: 3m³/h",
    "- Working Pressure: 0.2~0.4Mpa",
    "- Max. Aggregate Size: 15mm",
    "- Rated Voltage: 380V/50Hz",
    "- Total Power: 5.5kw"
  ],
  quantity: 2,
  unit: "Set",
  unitPrice: 45000000
}
```

---

## 📱 **UX IMPROVEMENTS**

### **Material Modal Enhancements:**
1. ✅ **Width lebih lebar:** `max-w-2xl` (dari `max-w-md`)
2. ✅ **Scrollable modal:** Jika spec banyak, modal bisa scroll
3. ✅ **Real-time preview:** Langsung lihat spec yang sudah ditambahkan
4. ✅ **Easy deletion:** Tombol X untuk hapus spec yang salah
5. ✅ **Keyboard friendly:** Tekan Enter untuk add spec
6. ✅ **Placeholder hints:** Ada contoh di placeholder text

### **Spec Input Section:**
```
┌─────────────────────────────────────────────────┐
│ Specifications (Optional)                      │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │ Ketik spec dan tekan Enter...         [+]│   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ • Electric Motor Machine 1 Set            [X]   │
│ • Pre-dampening Nozzle Assy 1 Set         [X]   │
│ • Conveying Hose Ø38mm 50ft. Length 1 Pcs [X]   │
│ ... (scrollable jika banyak)                    │
└─────────────────────────────────────────────────┘
```

---

## 🔧 **TECHNICAL DETAILS**

### **Files Modified:**

1. **`/pages/ProjectQuotationPage.tsx`**
   - ✅ Interface `Material` ditambah `specifications?: string[]`
   - ✅ State `specInput` untuk temporary input
   - ✅ Material Modal UI update (form input spec)
   - ✅ Print preview update (display spec)
   - ✅ Material list display update (show spec count)

2. **`/contexts/AppContext.tsx`**
   - ✅ Mock data Quotation #1 update (Semen + Besi dengan spec)
   - ✅ Mock data Quotation #2 update (Shotcrete Machine dengan 20+ spec)
   - ✅ Items array update untuk include specifications

### **Data Flow:**
```
User Input → specInput (state)
           ↓ (Enter / Click +)
materialForm.specifications[] (array)
           ↓ (Save Material)
formData.materials[].specifications
           ↓ (Submit Quotation)
quotationData.items[].spesifikasi
           ↓ (Save to Context)
AppContext.quotationList[]
           ↓ (Print / View)
Print Modal Display (formatted)
```

---

## 🎨 **STYLING DETAILS**

### **Spec Input Container:**
- Background: `bg-gray-50`
- Border: `border border-gray-300`
- Padding: `p-3`
- Border radius: `rounded-lg`

### **Spec List Items:**
- Background: `bg-white`
- Border: `border border-gray-200`
- Padding: `px-3 py-2`
- Text size: `text-sm`
- Bullet: `text-gray-600 text-xs`

### **Print View:**
- Spec header: `font-semibold mb-1`
- Spec items: `space-y-0.5 text-sm`
- Bullet format: Dash (-) dengan flex layout

---

## 📊 **COMPARISON: BEFORE vs AFTER**

### **BEFORE (Sebelum Fitur Spec):**
```
Quotation Print:
┌────┬─────────────────┬─────────┐
│ No │ Jenis Barang    │ Harga   │
├────┼─────────────────┼─────────┤
│ 1  │ Semen Portland  │ 65.000  │ ← Hanya nama barang
└────┴─────────────────┴─────────┘
```

### **AFTER (Dengan Fitur Spec):**
```
Quotation Print:
┌────┬─────────────────────────────────┬─────────┐
│ No │ Jenis Barang                    │ Harga   │
├────┼─────────────────────────────────┼─────────┤
│ 1  │ Semen Portland                  │ 65.000  │
│    │ Specification :                 │         │
│    │ - Tipe I sesuai SNI 2049:2015   │         │
│    │ - Kemasan 50kg per sak          │         │
│    │ - Kuat tekan minimum 250 kg/cm² │         │
│    │ - Sertifikat quality test       │         │
└────┴─────────────────────────────────┴─────────┘
```

---

## 🚀 **USAGE WORKFLOW**

### **Scenario: Create Quotation with Detailed Specs**

1. **Navigate:** Project → Quotations
2. **Create:** Klik "Buat Penawaran Baru"
3. **Fill Basic Info:**
   - No. Quotation
   - Perihal
   - Customer details
4. **Add Material:**
   - Tab "Materials" → "Add Material"
   - Material Name: `W2-SER Shotcrete Machine`
5. **Add Specifications:**
   - Ketik: `Electric Motor Machine 1 Set` → Enter
   - Ketik: `Pre-dampening Nozzle Assy 1 Set` → Enter
   - Ketik: `Conveying Hose Ø38mm 50ft. Length 1 Pcs` → Enter
   - ... (continue)
6. **Fill Pricing:**
   - Quantity: 2
   - Unit: Set
   - Unit Price: 45000000
7. **Save Material**
8. **Preview:** Klik "Print" untuk lihat format
9. **Submit:** Save Quotation

---

## ✅ **VALIDATION & EDGE CASES**

### **Handled Cases:**
- ✅ **Optional field:** Spec boleh kosong (tidak wajib)
- ✅ **Empty array:** Jika tidak ada spec, tidak tampil di print
- ✅ **Edit existing:** Bisa edit spec material yang sudah ada
- ✅ **Delete spec line:** Bisa hapus spec individu
- ✅ **Long spec list:** Auto scroll jika > 48 lines
- ✅ **Keyboard UX:** Enter untuk add, tidak submit form
- ✅ **Trim whitespace:** Auto trim spec input
- ✅ **Duplicate prevention:** User bisa add duplicate (by design, karena kadang spec mirip)

---

## 🎯 **NEXT STEPS (Opsional)**

Jika nanti mau enhance lebih lanjut:

1. **Template Spec Library**
   - Simpan spec template yang sering dipakai
   - Quick insert dari template

2. **Spec Grouping**
   - Group spec by category (misal: "Electric Motor", "Accessories")
   - Collapsible groups di print

3. **Rich Text Spec**
   - Support bold, italic di spec text
   - Nested bullet points

4. **Import Spec from File**
   - Upload spec dari .txt atau .csv
   - Bulk insert

5. **Spec Versioning**
   - Track changes di spec
   - History log

---

## 📞 **SUPPORT**

Jika ada issue atau pertanyaan:
- Cek file: `/pages/ProjectQuotationPage.tsx` (line 1291-1400 untuk Material Modal)
- Cek file: `/contexts/AppContext.tsx` (line 695-955 untuk mock data)
- Cek print preview: line 1484-1498 di ProjectQuotationPage.tsx

---

**Status:** ✅ **IMPLEMENTED & READY TO USE**

**Date:** Friday, January 24, 2025  
**Version:** 1.0.0  
**Feature:** Quotation Item Specifications Detail
