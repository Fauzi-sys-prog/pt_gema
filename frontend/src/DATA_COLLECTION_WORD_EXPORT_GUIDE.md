# Data Collection Word Export - Quick Guide

## Fitur Baru: Export "Data Persiapan Pekerjaan Proyek"

Sistem Data Collection sekarang sudah dilengkapi dengan fitur **Export to Word** yang menghasilkan dokumen komprehensif "Data Persiapan Pekerjaan Proyek" dalam format profesional.

---

## 📄 Dokumen yang Di-Generate

Dokumen Word yang dihasilkan mencakup semua section berikut:

### 1. **Informasi Umum**
- Nama Proyek
- Customer
- Lokasi Kerja
- Durasi Proyek
- Notes

### 2. **Scope of Work**
Daftar item pekerjaan dengan penanggung jawab (Gema/User/Customer):
- Bongkar Material Existing
- Supply Material
- Pemasangan dan Instalasi
- Testing & Commissioning
- Working Permit
- Medical Check up
- dll.

### 3. **Tools & Equipment**
Tabel equipment dengan kolom:
- Nama Peralatan
- Jenis Peralatan
- Jumlah
- Keterangan

### 4. **Manpower**
Tabel tenaga kerja dengan kolom:
- Jabatan
- Jumlah
- Sertifikat
- Keterangan
- **Subtotal**: Total jumlah manpower

### 5. **Schedule Pekerjaan**
Tabel jadwal dengan kolom:
- Deskripsi Pekerjaan
- Area
- Jumlah Hari
- Keterangan
- **Subtotal**: Total hari

### 6. **Consumable Pekerjaan**
Tabel consumables dengan kolom:
- Deskripsi Consumable
- Unit
- Jumlah Barang
- Keterangan

### 7. **BILL OF MATERIAL - Detailed BOM**
Tabel detail material dengan kolom:
- NO, AREA, PRODUCT
- Kg/m3, Thickness, Surface, Volume
- Weight (Installed), Quantity (Installed)
- Unit, Reverse (%), Quantity (Delivery)

### 8. **BILL OF MATERIAL - Summary BOM**
Tabel ringkasan material dengan kolom:
- NO, PRODUCT
- Density, Volume
- Quantity Installed, Quantity Delivered
- Unit, Total Weight

### 9. **Footer - Document Info**
- Dibuat Oleh
- Mengetahui (Management)
- Date
- Rev (Revision number)
- Versi

---

## 🎯 Cara Menggunakan

### Step 1: Buat Data Collection Lengkap
Di halaman **Data Collection**, klik "Tambah Data Collection Baru" dan isi semua section:

1. **Informasi Project** (wajib):
   - Nama Customer / Project
   - Lokasi Project
   - Tanggal

2. **Material** (opsional):
   - Klik "➕ Tambah Material"
   - Isi detail material melalui BOM Material Modal

3. **Manpower** (opsional):
   - Klik "👥 Tambah Manpower"
   - Isi jabatan, jumlah, sertifikat

4. **Equipment** (opsional):
   - Klik "🚛 Tambah Equipment"
   - Isi nama equipment, quantity, supplier

5. **Schedule** (opsional):
   - Klik "📅 Tambah Schedule"
   - Isi activity, start date, end date

6. **Consumables** (opsional):
   - Klik "🔧 Tambah Consumable"
   - Isi item name, quantity, category

### Step 2: Export ke Word
1. Setelah data lengkap, klik tombol **"Export to Word"** (hijau dengan icon Download)
2. Sistem akan generate dokumen Word secara otomatis
3. File akan ter-download dengan nama: `Data_Persiapan_[NamaProyek]_[timestamp].docx`

---

## 📊 Field Mapping

### Equipment Modal → Word Export
```typescript
equipmentName  → namaPeralatan
unit           → jenisPeralatan
quantity       → jumlah
supplier       → keterangan
```

### Manpower Modal → Word Export
```typescript
position       → jabatan
quantity       → jumlah
assignedPerson → sertifikat
notes          → keterangan
```

### Schedule Modal → Word Export
```typescript
activity       → deskripsiPekerjaan
status         → area
duration       → jumlahHari
dependencies   → keterangan
```

### Consumable Modal → Word Export
```typescript
itemName       → deskripsiConsumable
unit           → unit
quantity       → jumlahBarang
category       → keterangan
```

### BOM Material → Word Export
```typescript
materialName   → product
density        → kgM3
thickness      → thickness
surface        → surface
volume         → volume
qtyEstimate    → quantityInstalled, weightInstalled
unit           → unit
```

---

## 🔥 Fitur Khusus

### 1. **Auto-Calculate Reserve**
- Sistem otomatis menambah 10% reserve untuk Quantity Delivery
- Formula: `quantityDelivery = quantityInstalled * 1.1`

### 2. **BOM Grouping**
- BOM Summary otomatis menggabungkan material yang sama
- Total weight dihitung: `qtyEstimate * density`

### 3. **Subtotals**
- Total Manpower dihitung otomatis
- Total Schedule Days dihitung otomatis

### 4. **Default Scope of Work**
Jika belum ada Scope of Work, sistem generate default:
- Bongkar Material Existing (Gema)
- Supply Material (Gema)
- Pemasangan dan Instalasi (Gema)
- Testing & Commissioning (Gema)
- Working Permit (User)
- Medical Check up (User)

---

## 🎨 Format Dokumen

### Header Style
- Title: **Data Persiapan Pekerjaan Proyek**
- Font: Arial
- Section headers: Bold, underline, size 28

### Table Style
- Border: Single line, black
- Header row: Gray background (#D3D3D3)
- Data alignment: 
  - Text: Left
  - Numbers: Right
  - Unit: Center

### Page Layout
- Margin: 0.5 inch (720 twip) semua sisi
- Orientation: Portrait

---

## ⚡ Tips & Best Practices

1. **Lengkapi Semua Section**:
   - Semakin lengkap data yang diisi, semakin komprehensif dokumen Word yang dihasilkan
   - Section yang kosong tidak akan muncul di dokumen

2. **Consistency**:
   - Gunakan naming convention yang konsisten untuk material, equipment, dll
   - Ini memudahkan grouping di BOM Summary

3. **Review Before Export**:
   - Pastikan semua data sudah benar sebelum export
   - Cek kembali quantity, unit, dan notes

4. **Use for Quotation**:
   - Dokumen ini bisa dijadikan attachment untuk quotation ke customer
   - Bisa juga untuk internal project preparation

---

## 🚀 Integration dengan Modul Lain

### Data Collection → Quotation
1. Export "Data Persiapan Pekerjaan Proyek" dari Data Collection
2. Klik "Create Quotation" untuk auto-load data ke Quotation Module
3. Quotation Module juga bisa export Word dengan format penawaran

### Data Collection → Project
1. Data dari Data Collection bisa dilink ke Project
2. Material, manpower, equipment akan sync ke Project execution

---

## 📝 File Location

**Export Component**: `/components/DataCollectionWordExport.tsx`
**Usage in**: `/pages/data-collection/DataCollection.tsx`

---

## 🎯 Example Output

**Filename**: `Data_Persiapan_Repair_Furnace_PT_StarMortar_1737190800000.docx`

**Content Structure**:
```
Data Persiapan Pekerjaan Proyek
├── Informasi Umum
├── Scope Of Work
├── Tools (Equipment)
├── Manpower
├── Schedule Pekerjaan
├── Consumable Pekerjaan
├── BILL OF MATERIAL - Detailed BOM
├── BILL OF MATERIAL - Summary BOM
└── Footer (Created by, Date, Rev, Version)
```

---

## ✅ Checklist Sebelum Export

- [ ] Informasi Umum sudah diisi lengkap
- [ ] Material sudah ditambahkan (jika ada)
- [ ] Manpower sudah ditambahkan (jika ada)
- [ ] Equipment sudah ditambahkan (jika ada)
- [ ] Schedule sudah ditambahkan (jika ada)
- [ ] Consumables sudah ditambahkan (jika ada)
- [ ] Review semua data sudah benar
- [ ] Klik "Export to Word"
- [ ] Download dokumen berhasil

---

**Version**: 1.0  
**Last Updated**: 18 Feb 2026  
**Created By**: Premium Warehouse Ledger Team
