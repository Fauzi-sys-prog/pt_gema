# UAT Evidence Sheet

Environment: `Staging`
URL: `https://gemateknik.online:8443`

Project/Release: ____________________
Tester: ____________________
Tanggal: ____________________
Build/Commit: ____________________

## Ringkasan
- Total testcase: 10
- Pass: ___
- Fail: ___
- Blocked: ___

## Evidence Table

| No | Role | Test Case | Step Singkat | Expected | Actual | Status | Screenshot/Link | Catatan |
|---|---|---|---|---|---|---|---|---|
| 1 | Semua | Login & Logout | Login, refresh, logout | Auth stabil, tidak error |  |  |  |  |
| 2 | SALES | Data Collection -> Quotation | Buat/lanjutkan survey lalu quotation | Quotation terbentuk dan tersimpan |  |  |  |  |
| 3 | SPV / OWNER | Approval Komersial | Review dan approve sesuai flow | Status valid, tidak ada 500 |  |  |  |  |
| 4 | PURCHASING | PO Supplier | Buat atau ubah PO supplier | Data procurement tersimpan benar |  |  |  |  |
| 5 | WAREHOUSE | Receiving & Stock | Proses barang masuk / stok | Data receiving sinkron |  |  |  |  |
| 6 | PRODUKSI | WO / SPK / Progress | Jalankan flow kerja lapangan | Status produksi valid |  |  |  |  |
| 7 | WAREHOUSE / PRODUKSI | Surat Jalan / BA | Lanjutkan dokumen proyek | Dokumen tersambung dan tampil |  |  |  |  |
| 8 | FINANCE | Invoice Guard & Payment | Cek invoice, lanjut payment | Hanya invoice layak yang bisa diproses |  |  |  |  |
| 9 | Negative Test | Role Guard | Coba aksi yang bukan hak role | Ditolak atau hidden |  |  |  |  |
| 10 | Semua | Quick Regression | Buka halaman utama role masing-masing | Tidak ada error besar |  |  |  |  |

## Defect Log

| ID | Role | Modul | Severity | Repro Step | Expected | Actual | Screenshot/Link | PIC |
|---|---|---|---|---|---|---|---|---|
| D-001 |  |  |  |  |  |  |  |  |

## Sign-Off
- SPV: ____________________ (Tanggal: __________)
- Owner: ____________________ (Tanggal: __________)
- Tester: ____________________ (Tanggal: __________)
