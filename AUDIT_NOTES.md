# Catatan Audit Aplikasi

Tanggal audit: 30 Agustus 2026

## Scope yang diaudit

- Production Dashboard / Work Order
- Project Quotation
- Human Capital Payroll
- Persistence database dan potensi duplikasi
- Build frontend dan backend

## Hasil browser

- Login menggunakan akun seed berhasil.
- Dashboard Production berhasil dibuka.
- Form Create Work Order berhasil dibuka.
- Field `Target Hasil Produksi` tampil terpisah dari QTY teknisi.
- Field `Satuan` tampil dengan default `Pcs`.
- Halaman `/hr/payroll-pro` berhasil dibuka.
- Daftar payroll run, status, total gross, dan total THP tampil normal.
- Modal `Buat Payroll Baru` berhasil dibuka.

## Hasil database lokal

- Akun aktif: 2 (`e2e_admin` dan `owner`).
- Payroll run: 4 record.
- Quotation: 1 record.
- Work Order Production: 3 record.
- Duplikasi key `resource + entityId` pada `AppEntity`: 0.
- Database memiliki unique constraint `AppEntity_resource_entityId_key`.

## Temuan dan validasi alur

- Production menyimpan Work Order melalui endpoint `/work-orders`.
- Quotation menyimpan data melalui `/quotations` dan melakukan rollback state bila request gagal.
- Payroll menyimpan data melalui `/hr-payroll-runs`.
- Urutan status payroll: `Calculated` → `Approved` → `Disbursed` → `Closed`.
- Potongan kasbon/koperasi diposting saat payroll `Disbursed`, bukan saat baru dihitung.
- Payroll mencegah pemrosesan ulang karyawan pada periode dan rentang tanggal yang sama di sisi UI.
- Total quotation dihitung dari material, manpower, consumable, equipment, lalu PPN.
- Target output Work Order tidak lagi mengambil nilai dari jumlah teknisi.

## Build

- Frontend build: lulus.
- Backend build: lulus.
- Backend lokal berhasil direstart pada port 3000.

## Catatan lanjutan

Audit ini mencakup modul yang sedang dikerjakan. Audit seluruh modul aplikasi lain masih perlu dilakukan sebagai pekerjaan terpisah.

## Matriks status audit

| Halaman / Modul | Status | Yang sudah aman | Bukti / pengecekan |
|---|---|---|---|
| Production Dashboard / Work Order | Aman | Target output terpisah dari QTY teknisi; satuan tersedia; penyimpanan API aktif | Browser test + source review + database |
| Project Quotation | Aman | Formula jumlah × harga; subtotal dan PPN konsisten; satuan material tersedia; rollback saat API gagal | Source review + database |
| HR Payroll Pro | Aman | Alur status berurutan; validasi periode; pencegahan proses ulang di UI; potongan diposting saat disburse | Browser test + database |
| Database AppEntity | Aman | Unique key `(resource, entityId)` mencegah duplikasi | Query database: 0 duplicate keys |
| Login / akun | Aman | Login seed berhasil; akun aktif terdeteksi | Browser test + query User |
| Frontend build | Aman | Build production berhasil | `npm run build` |
| Backend build | Aman | Build backend berhasil | `npm run build` |

## Halaman berikutnya untuk diaudit

Urutan yang disarankan:

1. Project dan SPK — cek alur quotation → project → SPK, duplikasi nomor, dan relasi project.
2. Supply Chain / Warehouse — cek stock in/out, saldo stok, movement, dan transaksi ganda.
3. Production execution dan LHP — cek start, progress, QC, pemakaian material, dan hasil akhir.
4. Human Capital master — cek employee, compensation, attendance, leave, overtime, dan kasbon.
5. Finance — cek invoice, petty cash, payment, jurnal, dan rekonsiliasi.
6. Logistics — cek surat jalan, delivery, equipment loan, dan status pengembalian.
7. Settings / user management — cek role access, perubahan password, dan audit trail.

Untuk setiap halaman berikutnya, checklist auditnya sama: uji browser, simpan data, reload, verifikasi database, cek duplikasi, cek rollback saat API gagal, dan cek apakah alurnya mudah dipahami user.

## Audit lanjutan Project / SPK

- `ProjectRecord`: 2 record, duplicate ID: 0.
- `Quotation`: 2 record, duplicate nomor quotation: 0.
- `ProductionWorkOrder`: 3 record.
- `SpkRecord`: 0 record.
- `ProjectSpkRecord`: 0 record.

Catatan: relasi Project → SPK perlu audit UI lanjutan karena database saat ini belum memiliki record pada tabel SPK khusus, walaupun Work Order Production sudah ada. Ini menjadi prioritas pengecekan berikutnya agar user tidak bingung membedakan Quotation, Project, SPK, dan Work Order.

Perbaikan awal: halaman Surat Perintah Kerja sekarang menolak nomor SPK duplikat sebelum membuat SPK/work order.

## Audit lanjutan Human Capital master

- Employee ID kini divalidasi unik di backend saat create/update (`EMPLOYEE_ID_EXISTS`, HTTP 409).
- Penyimpanan kompensasi dan kasbon memakai persistence strict dengan rollback state lokal serta toast error bila API gagal.
- Frontend dan backend build production kembali berhasil setelah perubahan ini.

## Audit lanjutan Finance

- Invoice dan penerimaan pembayaran sudah memiliki rollback state saat API gagal.
- Transaksi kas kecil, kas gudang, dan permintaan top-up kini memakai persistence strict; state optimistis dibatalkan bila server menolak/gagal.
- Frontend production build berhasil setelah hardening Finance.

## Audit lanjutan Logistics

- Surat Jalan, Surat Masuk, dan Surat Keluar sudah memakai optimistic update dengan rollback saat API gagal.
- Penghapusan dokumen juga memulihkan state lokal bila server menolak.
- Tidak ditemukan perubahan kode tambahan yang aman diperlukan pada alur Logistics saat audit ini.

## Audit lanjutan Settings / user management

- Backend membatasi pembuatan user ke OWNER/ADMIN dan mencegah ADMIN membuat atau mengambil alih role OWNER.
- SPV hanya dapat mereset password; user tidak dapat menonaktifkan akunnya sendiri; role OWNER tidak dapat diturunkan.
- Password di-hash dengan bcrypt dan username/email duplicate ditangani melalui constraint database.

## Audit seluruh Finance pages

- Mencakup AR, AP, Payment, Approval Center, petty cash, bank reconciliation, GL, PPN, payroll, cash flow, P&L, working expense, dan year-end closing.
- Temuan diperbaiki: penerimaan pembayaran kini menolak nominal tidak valid (<= 0), NaN, dan pembayaran melebihi sisa invoice.
- Frontend production build berhasil setelah validasi tambahan.
