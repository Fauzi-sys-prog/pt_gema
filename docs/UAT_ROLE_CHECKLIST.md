# UAT Role Checklist (Staging)

Tanggal acuan: 2026-03-30
Environment UAT: `https://gemateknik.online:8443`
Tujuan: memastikan tiap role bisa menjalankan tugasnya tanpa error dan tanpa bocor akses.

## Aturan Main
- Jalankan UAT di staging, bukan di production.
- Fokus ke alur kerja nyata, bukan cuma buka halaman.
- Setiap bug dicatat dengan: role, page, langkah, expected, actual, dan screenshot.
- Kalau ada aksi yang seharusnya ditolak, simpan bukti `403` atau bukti tombol tidak muncul.

## Akun Yang Dipakai
- Gunakan akun staging yang sudah di-assign ke role berikut:
  - `OWNER`
  - `SPV`
  - `SALES`
  - `PURCHASING`
  - `WAREHOUSE`
  - `PRODUKSI`
  - `FINANCE`
  - `ADMIN`

Catatan:
- Checklist ini sengaja role-first. Kalau username staging berubah, dokumen ini tetap valid.
- Kalau role bisnis di staging belum sama dengan flow operasional terbaru, samakan dulu sebelum UAT formal.

## Pre-Check Sebelum Mulai
- Bisa buka `https://gemateknik.online:8443`
- Login dan logout normal
- `https://gemateknik.online:8443/api/health` balas `{"status":"OK"}`
- Data dasar minimal tersedia:
  - customer
  - item/material
  - vendor
  - user role yang dibutuhkan

## 1. OWNER
- Bisa login dan masuk dashboard tanpa error.
- Bisa buka `Dashboard`, `Project`, `Quotation`, `Dokumen Proyek`, `Finance`.
- Bisa lihat ringkasan approval dan status bisnis utama.
- Bisa approve atau reject titik approval yang memang owner-level.
- Bisa lihat hasil akhir flow lintas divisi tanpa harus edit semuanya.

Expected:
- Tidak ada `500`.
- Aksi approval sukses saat memang valid.
- Aksi yang tidak relevan tidak membingungkan atau tidak muncul.

## 2. SPV
- Bisa review data awal, quotation, dan project.
- Bisa masuk jalur approval yang memang untuk pimpinan operasional.
- Bisa cek hasil pekerjaan tim tanpa harus jadi owner.
- Bisa melihat dashboard dan task penting harian.

Expected:
- Approval yang boleh untuk `SPV` berhasil.
- SPV tidak perlu workaround manual untuk lanjutkan flow normal.

## 3. SALES
- Bisa login dan buka `Survey Lapangan`, `Quotation`, `Project`, `Invoice`.
- Bisa buat atau edit data collection sesuai flow.
- Bisa buat quotation dari data collection/survey.
- Bisa follow up quotation sampai linked ke project.
- Tidak bisa final approve quotation/project kalau bukan haknya.

Expected:
- Flow `Data Collection -> Quotation -> Project` berjalan.
- Aksi approval final ditolak untuk `SALES`.
- Tidak ada page yang jatuh karena fetch modul lain.

## 4. PURCHASING
- Bisa buka `Procurement`, `Purchase Order`, `Receiving` bila memang dibutuhkan flow pengadaan.
- Bisa cari harga dan buat `PO Supplier`.
- Bisa lihat status item yang menunggu pengadaan atau receiving.
- Tidak bisa masuk approval bisnis yang bukan haknya.

Expected:
- Flow `pricing -> PO supplier` jelas dan tersimpan.
- Tidak ada kebocoran akses ke approval owner/SPV.

## 5. WAREHOUSE
- Bisa buka receiving, stok, `Surat Jalan`, dan dokumen logistik yang relevan.
- Bisa proses barang masuk/keluar sesuai data project.
- Bisa buat atau lanjutkan `Surat Jalan`.
- Bisa support dokumen serah terima lapangan.

Expected:
- Flow `Receiving -> Stock -> Surat Jalan` jalan tanpa mismatch.
- Tidak ada error karena page memanggil endpoint lintas role yang tak perlu.

## 6. PRODUKSI
- Bisa buka dashboard produksi, work order, report, dan dokumen proyek yang relevan.
- Bisa lanjutkan eksekusi pekerjaan dari WO/SPK.
- Bisa support `Surat Jalan` dan `Berita Acara` sesuai flow.
- Tidak bisa final approve hal yang bukan ranah produksi.

Expected:
- Flow `WO/SPK -> Progress -> BA` berjalan.
- Tidak ada status yang lompat tanpa aturan.

## 7. FINANCE
- Bisa buka dashboard finance, invoice, payment, AR/AP, PPN, ledger.
- Bisa cek invoice hanya ketika dokumen pendukung sudah layak.
- Bisa catat payment sesuai flow finance.
- Tidak bisa mengubah approval bisnis yang bukan haknya.

Expected:
- Flow `Invoice -> Payment -> Rekap` berjalan aman.
- Guard invoice sebelum dokumen final tetap aktif.

## 8. ADMIN
- Bisa kelola user dan area admin yang memang diizinkan.
- Tidak bisa assign atau manipulasi `OWNER` sembarangan.
- Tidak merusak role access saat edit user biasa.

Expected:
- Endpoint user management aman.
- Role sensitif tetap terlindungi.

## Negative Test Yang Wajib
- `SALES` coba approval final -> harus ditolak.
- `WAREHOUSE` coba masuk area finance sensitif -> harus ditolak.
- `PRODUKSI` coba aksi owner-only -> harus ditolak.
- `FINANCE` coba aksi logistik/approval yang bukan haknya -> harus ditolak.
- `ADMIN` coba ubah role `OWNER` secara ilegal -> harus ditolak.

## Flow End-to-End Yang Wajib Diuji
1. `Data Collection -> Quotation -> Project`
2. `PO Supplier -> Receiving -> Stock`
3. `WO/SPK -> Surat Jalan -> Berita Acara`
4. `Berita Acara Final -> Invoice -> Payment`

## Evidence Yang Wajib Disimpan
- Screenshot login per role.
- Screenshot sebelum/sesudah status berubah.
- Screenshot negative test yang ditolak.
- Screenshot atau file hasil dokumen utama:
  - quotation
  - project
  - surat jalan
  - berita acara
  - invoice
- Link commit/build yang sedang diuji.

## Exit Criteria
- Tidak ada `500` di flow inti.
- Role utama bisa menjalankan tugasnya masing-masing.
- Negative test sensitif ditolak dengan benar.
- Tidak ada kebingungan besar yang bikin user berhenti kerja.
