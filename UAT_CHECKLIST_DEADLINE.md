# UAT Checklist (Deadline Mode)

Tanggal: 2026-03-03  
Tujuan: validasi alur utama tanpa muter-muter.

## 1) Login & Role
- Login `OWNER` (`aji`) berhasil.
- Login non-owner (`angesti`/`admin`) berhasil.
- Tombol `Approve/Reject/Unlock/Relock` project:
  - Muncul untuk `OWNER`.
  - Tidak bisa dipakai role non-owner (403 atau hidden di UI).

## 2) Data Collection -> Quotation
- Buat / pastikan 1 data collection status selesai.
- Klik `Create from Survey (Smart Pricing)` di Quotation.
- Verifikasi quotation baru muncul di list quotation.
- Verifikasi field penting terisi:
  - `perihal`, `kepada/customer`, `grandTotal`, `pricingItems`.

## 3) Quotation Workflow
- Ubah status `Draft -> Sent`.
- Login sebagai `OWNER`, ubah `Sent -> Approved`.
- Verifikasi:
  - no penawaran terisi.
  - tidak ada error 500.
  - approval log quotation tercatat.

## 4) Quotation -> Project
- Dari quotation approved, pastikan project linked muncul.
- Buka detail project:
  - jika sudah approved: tampil `Quotation Snapshot`.
  - jika belum approved: tampil `Quotation Linked Preview`.
  - scope of work/exclusions tampil.

## 5) Project Approval
- Approve project sebagai `OWNER`.
- Verifikasi:
  - badge status project berubah `Approved`.
  - log project approval tercatat.
  - `quotationSnapshot` tersimpan di payload project.

- Reject project sebagai `OWNER`.
- Verifikasi:
  - badge status project `Rejected`.
  - UI menampilkan rejected info (bukan approved info).

## 6) Export Final
- Project belum approved: export Word/Excel harus ditolak.
- Project approved: export Word/Excel berhasil download.
- Cek isi export:
  - metadata project.
  - quotation reference.
  - scope of work / exclusions.
  - BOQ (fallback dari pricingItems jika BOQ kosong).

## 7) Dashboard Summary
- Buka Dashboard.
- Verifikasi tidak error console untuk `/dashboard/summary`.
- Nilai card utama terisi dari backend summary (approval/revenue/payroll exposure).

## 8) Regression cepat
- Logout -> login lagi.
- Buka halaman: Dashboard, Project, Quotation, Data Collection.
- Pastikan tidak ada 500 di Network untuk endpoint utama.

## Done Criteria (siap demo)
- Tidak ada error 500 di alur utama.
- Owner approval bekerja end-to-end.
- Export final berhasil dan isi sesuai.
- Data linked antar modul terbaca (data collection -> quotation -> project).
