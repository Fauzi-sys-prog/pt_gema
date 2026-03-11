# Role Menu Matrix

Matrix ini mengikuti logic sidebar saat ini di [Layout.tsx](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/components/Layout.tsx).

## Aji

- Username: `aji`
- Role: `SPV`
- Menu yang muncul:
  - `Guide Book`
  - `Dashboard`
  - `Project`
  - `Production`
  - `Supply Chain Hub`
  - `Commercial & Sales`
  - `Finance & Ledger`
  - `Correspondence`
  - `Logistics Control`
  - `Assets`
  - `Human Capital`
  - `Data Collection`
  - `Settings`

Catatan:

- `SPV` masuk jalur owner-like
- aksesnya memang full lintas modul

## Angesti

- Username: `angesti`
- Role: `SALES`
- Menu yang muncul:
  - `Guide Book`
  - `Dashboard`
  - `Project`
  - `Commercial & Sales`
  - `Correspondence`
  - `Logistics Control`
  - `Data Collection`

Catatan:

- ini sudah pas untuk tim commercial
- tidak melihat gudang full dan finance detail

## Ering

- Username: `ering`
- Role: `SUPPLY_CHAIN`
- Menu yang muncul:
  - `Guide Book`
  - `Dashboard`
  - `Project`
  - `Production`
  - `Supply Chain Hub`
  - `Correspondence`
  - `Logistics Control`
  - `Assets`
  - `Data Collection`

Catatan:

- ini pas untuk procurement + gudang
- masih bisa lihat project dan operasional terkait

## Dewi

- Username: `dewi`
- Role: `ADMIN`
- Menu yang muncul:
  - `Guide Book`
  - `Dashboard`
  - `Project`
  - `Production`
  - `Supply Chain Hub`
  - `Commercial & Sales`
  - `Finance & Ledger`
  - `Correspondence`
  - `Logistics Control`
  - `Assets`
  - `Human Capital`
  - `Data Collection`
  - `Settings`

Catatan penting:

- `ADMIN` saat ini adalah privileged role
- jadi akses Dewi masih terlalu luas kalau targetnya hanya admin dokumen/proyek

## Rekomendasi

### Kalau tidak mau ubah role sekarang

Biarkan:

- `Aji = SPV`
- `Angesti = SALES`
- `Ering = SUPPLY_CHAIN`
- `Dewi = ADMIN`

Tapi pahami:

- `Dewi` akan melihat hampir semua menu

### Kalau mau lebih rapi

Jangan pakai `OPERATIONS` dulu untuk Dewi, karena backend saat ini lebih dekat ke alias `PRODUKSI`.

Pilihan yang benar:

1. tetap `ADMIN` dan terima bahwa aksesnya luas
2. atau bikin role baru khusus admin dokumen/proyek di backend + sidebar

## Kesimpulan

Untuk tim kecil:

- `Aji` sudah pas
- `Angesti` sudah pas
- `Ering` sudah pas
- `Dewi` secara fungsi pas, tapi role `ADMIN` masih terlalu lebar
