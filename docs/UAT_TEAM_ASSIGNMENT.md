# UAT Team Assignment (Staging)

Tanggal acuan: 2026-03-30
Environment: `https://gemateknik.online:8443`

Dokumen ini dipakai supaya UAT tidak bingung. Setiap orang cukup fokus ke modul dan flow yang memang paling dekat dengan kerjaannya.

## Aturan Pakai
- Gunakan staging, bukan production.
- Satu orang fokus ke test miliknya dulu.
- Kalau ada bug, catat di [docs/UAT_EVIDENCE_SHEET.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_EVIDENCE_SHEET.md).
- Kalau satu role selesai, baru lanjut bantu regression cepat role lain.

## PIC Utama

| Nama | Akun Staging | Role Saat Ini | Fokus Test | Prioritas |
|---|---|---|---|---|
| Syamsudin | `syamsudin` | `OWNER` | sign-off akhir, approval, ringkasan bisnis | tinggi |
| Aji | `aji` | `SPV` | approval operasional, dashboard, project review | tinggi |
| Angesti | `angesti` | `SALES` | survey/data collection, quotation, project awal | tinggi |
| Ering | `ering` | `SUPPLY_CHAIN` | procurement, receiving, stock, surat jalan awal | tinggi |
| Ening | `ening` | `FINANCE` | invoice, payment, AR/AP, finance summary | tinggi |
| Produksi | `produksi` | `PRODUKSI` | WO/SPK, progress lapangan, BA | tinggi |
| Dewi | `dewi` | `ADMIN` | user management, kontrol admin, quick regression | sedang |
| Admin Backup | `admin` | `ADMIN` | backup tester untuk regression dan negative test | sedang |

## Siapa Ngetes Apa

### 1. Syamsudin (`OWNER`)
- Login dan cek dashboard utama.
- Review flow approval penting.
- Cek hasil akhir quotation/project yang sudah masuk ke jalur pimpinan.
- Pastikan role non-owner tidak bisa ambil aksi owner-only.

Lulus jika:
- approval owner jalan
- tidak ada error `500`
- data final bisa dibaca dengan jelas

### 2. Aji (`SPV`)
- Login dan cek dashboard role.
- Review `Quotation` dan `Project`.
- Cek approval operasional yang memang untuk SPV.
- Cek task yang perlu ditindaklanjuti dari sisi lapangan/komersial.

Lulus jika:
- SPV bisa kerja tanpa bantuan owner
- flow review tidak mentok

### 3. Angesti (`SALES`)
- Buat atau lanjutkan `Data Collection`.
- Buat `Quotation` dari survey/data.
- Cek apakah project linked bisa kelihatan setelah flow awal jalan.
- Coba negative test: jangan sampai bisa final approve.

Lulus jika:
- flow `Data Collection -> Quotation -> Project` jalan
- approval final ditolak untuk sales

### 4. Ering (`SUPPLY_CHAIN`)
- Cek procurement yang relevan.
- Cek `Receiving`.
- Cek stok atau movement yang nyambung ke barang masuk/keluar.
- Cek `Surat Jalan` dari sisi supply/logistik bila relevan.

Catatan:
- Saat ini akun staging yang aktif adalah `SUPPLY_CHAIN`, jadi test procurement dan stok digabung di sesi Ering.

Lulus jika:
- procurement dan receiving sinkron
- tidak ada relasi data yang putus

### 5. Ening (`FINANCE`)
- Cek halaman finance inti:
  - invoice
  - payment
  - AR/AP
  - PPN/ledger jika perlu
- Pastikan invoice hanya diproses kalau dokumen pendukung memang layak.
- Coba negative test ke area non-finance yang sensitif.

Lulus jika:
- invoice guard tetap aktif
- page finance stabil

### 6. Produksi (`PRODUKSI`)
- Cek `WO/SPK`.
- Cek progress/report produksi.
- Lanjutkan `Berita Acara` atau dokumen yang dekat ke hasil kerja lapangan.
- Pastikan role produksi tidak bisa ambil aksi approval final yang bukan miliknya.

Lulus jika:
- flow `WO/SPK -> Progress -> BA` jalan
- tidak ada status yang lompat aneh

### 7. Dewi (`ADMIN`)
- Cek `User Management`.
- Cek user edit biasa.
- Pastikan role sensitif tidak bisa dimanipulasi ilegal.
- Bantu quick regression halaman penting sesudah tim selesai test.

Lulus jika:
- area admin stabil
- perubahan user biasa tidak merusak role access

### 8. Admin Backup (`ADMIN`)
- Dipakai kalau ada sesi paralel atau kalau tester utama butuh backup.
- Fokus:
  - quick regression
  - negative test sederhana
  - bukti screenshot tambahan

## Urutan Test Yang Paling Enak
1. `Angesti`
2. `Aji`
3. `Syamsudin`
4. `Ering`
5. `Produksi`
6. `Ening`
7. `Dewi`
8. `Admin Backup`

Alasan:
- flow komersial dibuka dulu
- lalu approval
- lalu pengadaan/logistik/produksi
- terakhir finance dan admin

## Output Yang Harus Dikirim Tiap Orang
- Status: `Pass / Fail / Blocked`
- 1 screenshot bukti untuk test utama
- 1 screenshot untuk bug atau negative test kalau ada
- Catatan singkat:
  - page
  - langkah
  - hasil

## Done Criteria Tim
- semua PIC selesai minimal 1 putaran
- tidak ada bug blocker
- semua role utama bisa kerja di staging
- owner dan SPV setuju staging layak promote
