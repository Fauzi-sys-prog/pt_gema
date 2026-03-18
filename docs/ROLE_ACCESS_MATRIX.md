# Role Access Matrix

Dokumen ini merangkum role yang benar-benar relevan di PTGema saat ini:

- role apa saja yang dipakai
- menu apa yang muncul di sidebar
- aksi apa yang boleh dilakukan
- aksi apa yang harus ditolak

Sumber utama:

- [frontend/src/components/Layout.tsx](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/components/Layout.tsx)
- [docs/UAT_ROLE_CHECKLIST.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_ROLE_CHECKLIST.md)
- [docs/ROLE_MENU_MATRIX.md](/Users/macbook/Downloads/Ptgema-main%202/docs/ROLE_MENU_MATRIX.md)
- [backend/src/routes/users.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/users.ts)
- [backend/src/routes/quotations.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/quotations.ts)

## Role Yang Aktif Dipakai

Role bisnis yang paling jelas dipakai sekarang:

- `OWNER`
- `SPV`
- `ADMIN`
- `SALES`
- `FINANCE`
- `SUPPLY_CHAIN`
- `PRODUKSI`

Role lain memang ada di schema, tetapi belum sejelas role di atas dalam implementasi bisnis saat ini:

- `MANAGER`
- `HR`
- `PURCHASING`
- `WAREHOUSE`
- `OPERATIONS`
- `USER`

## Ringkasan Cepat

| Role | Posisi | Cakupan Akses |
|---|---|---|
| `OWNER` | Pimpinan utama | Full access + final approval |
| `SPV` | Pimpinan / supervisor | Full-like access + review/approval operasional |
| `ADMIN` | Admin sistem | Akses luas, termasuk user management dengan batasan OWNER |
| `SALES` | Commercial / sales | Quotation, project terkait, data collection |
| `FINANCE` | Finance | Finance pages, summary, ledger, finance CRUD |
| `SUPPLY_CHAIN` | Procurement / warehouse flow | PO, receiving, stock, surat jalan, supply flow |
| `PRODUKSI` | Produksi | Work order, tracker, QC, laporan produksi |

## Menu Sidebar Per Role

### OWNER

Menu:

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

Hak utama:

- akses hampir semua modul
- final approve/reject quotation
- approve/reject/unlock/relock project
- lihat approval logs
- export final project/quotation yang memenuhi syarat
- delete user

Larangan penting:

- `OWNER` tidak boleh dihapus
- role `OWNER` tidak boleh diubah sembarangan

### SPV

Menu:

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

Hak utama:

- diperlakukan `owner-like` di UI/sidebar
- bisa review atau approve flow operasional tertentu
- bisa approve/reject/unlock/relock project
- bisa melihat approval logs

Batasan:

- quotation final approval tetap punya guard OWNER pada flow tertentu
- SPV berfungsi sebagai jalur review pimpinan sebelum final owner

### ADMIN

Menu:

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

Hak utama:

- privileged access lintas modul
- bisa create/update user
- bisa baca daftar user dan pengaturan sistem

Batasan:

- tidak bisa create role `OWNER`
- tidak bisa assign role `OWNER`
- tidak bisa update `OWNER` secara ilegal
- tidak bisa delete `OWNER`

Catatan:

- secara implementasi saat ini, `ADMIN` masih terlalu luas untuk admin biasa

### SALES

Menu:

- `Guide Book`
- `Dashboard`
- `Project`
- `Commercial & Sales`
- `Correspondence`
- `Logistics Control`
- `Data Collection`

Hak utama:

- create quotation dari survey/data collection
- edit quotation saat status masih `Draft` atau `Sent`
- mengikuti flow komersial dan data collection
- bisa melihat approval queue tertentu untuk workflow quotation

Larangan:

- tidak bisa final approve quotation
- tidak bisa final approve project
- tidak boleh punya owner-only actions

Expected backend behavior:

- aksi approval dari SALES harus ditolak `403`

### FINANCE

Menu:

- `Guide Book`
- `Dashboard`
- `Project`
- `Finance & Ledger`
- `Correspondence`
- `Human Capital`

Hak utama:

- akses finance dashboard dan finance summary
- CRUD data finance
- akses AR/AP, cashflow, ledger, vendor payment, reconciliations

Larangan:

- tidak boleh approve quotation final
- tidak boleh menjalankan owner-only approval flow
- tidak boleh ubah status di luar transition yang diizinkan finance

### SUPPLY_CHAIN

Menu:

- `Guide Book`
- `Dashboard`
- `Project`
- `Production`
- `Supply Chain Hub`
- `Correspondence`
- `Logistics Control`
- `Assets`
- `Data Collection`

Hak utama:

- kelola procurement
- kelola purchase order
- receiving / stock movement / stock in / stock out
- surat jalan dan logistik terkait
- update resource supply-chain yang diizinkan

Larangan:

- tidak bisa final approve quotation
- tidak bisa final approve project

### PRODUKSI

Menu:

- `Guide Book`
- `Dashboard`
- `Production`
- `Supply Chain Hub`
- `Correspondence`
- `Assets`

Hak utama:

- work order
- production tracker
- QC inspection
- laporan produksi
- update workflow produksi sesuai transition yang diizinkan

Larangan:

- tidak bisa final approve project
- tidak bisa owner-only approval

## Guard Yang Penting Di Backend

### User Management

Di [backend/src/routes/users.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/users.ts):

- create user: `OWNER` dan `ADMIN`
- update user: `OWNER` dan `ADMIN`
- delete user: `OWNER` only
- `ADMIN` tidak boleh membuat atau meng-assign `OWNER`
- `OWNER` tidak boleh dihapus

### Quotation Approval

Di [backend/src/routes/quotations.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/quotations.ts):

- SALES bisa membuat quotation
- SPV berperan di tahap review
- OWNER memegang final approve/reject quotation
- approval logs hanya bisa dibaca role yang berwenang

### Project Approval

Berdasarkan flow aplikasi dan UAT:

- `OWNER` dan `SPV` menangani approval project
- role non-pimpinan tidak boleh approve/reject/unlock/relock

## Catatan Penting

- `OWNER`, `SPV`, `ADMIN`, dan `MANAGER` diperlakukan sebagai privileged roles di sidebar saat ini.
- `MANAGER` ada di schema, tapi belum terlihat sebagai role utama operasional di seed/UAT sekarang.
- `OPERATIONS`, `WAREHOUSE`, `PURCHASING`, `HR`, dan `USER` sudah ada di system model, tetapi implementasi bisnisnya belum sejelas role utama di atas.
- Jika ingin pembatasan yang lebih ketat, role `ADMIN` perlu dipersempit atau dipecah jadi role admin operasional yang lebih spesifik.

## Kesimpulan Praktis

Kalau dijelaskan ke user atau recruiter:

- `OWNER` dan `SPV` adalah role pimpinan
- `ADMIN` adalah admin sistem dengan akses luas
- `SALES` fokus di quotation dan data collection
- `FINANCE` fokus di ledger dan transaksi finance
- `SUPPLY_CHAIN` fokus di procurement, warehouse, dan logistics flow
- `PRODUKSI` fokus di work order, QC, dan report produksi

Secara implementasi sekarang, sistem sudah punya role separation yang nyata, tetapi masih ada ruang untuk memperketat privileged access, terutama pada role `ADMIN`.
