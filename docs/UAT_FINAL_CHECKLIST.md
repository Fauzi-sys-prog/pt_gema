# UAT Final Checklist (Data Collection -> Quotation -> Project)

Target: verifikasi alur utama end-to-end sebelum release.
Estimasi: 10-15 menit.

## Persiapan
1. Login sebagai `OWNER`.
2. Pastikan backend + frontend aktif.
3. Buka halaman:
   - Data Collection
   - Quotation Management
   - Project Ledger

## Skenario 1 - Quotation dari Survey
1. Dari Quotation, klik `Create from Survey (Smart Pricing)`.
2. Pilih 1 survey yang berisi data pricing.
3. Simpan quotation.
4. Verifikasi:
   - Quotation tampil di list.
   - Source = `Data Collection`.
   - Status awal = `Draft`.

Expected:
- Data quotation tersimpan ke database quotation.
- Belum bisa export final saat status belum `Approved`.

## Skenario 2 - Workflow Status Quotation
1. Ubah status `Draft -> Sent`.
2. Ubah status `Sent -> Approved` (OWNER).

Expected:
- Transisi valid.
- Badge `FINAL EXPORT READY` muncul saat `Approved`.
- Tombol export Word aktif hanya saat `Approved`.

## Skenario 3 - Lock Quotation setelah Project Approved
1. Buat project dari quotation.
2. Buka detail project, klik `Approve` (OWNER).
3. Kembali ke Quotation list.

Expected:
- Quotation terkait menjadi `Locked`.
- Edit/Delete/Refresh quotation terkunci.
- Status final tetap konsisten.

## Skenario 4 - Export Guard
1. Coba export quotation status `Draft/Sent`.
2. Coba export quotation status `Approved`.
3. Coba export project status `Pending/Rejected`.
4. Coba export project status `Approved`.

Expected:
- `Draft/Sent` ditolak untuk export final.
- `Approved` berhasil export.
- Project non-approved ditolak export.
- Project approved berhasil export.

## Skenario 5 - Unlock/Relock Project
1. Pada project approved, klik `Unlock` (isi alasan opsional).
2. Cek status project jadi `Pending`.
3. Klik `Relock`.

Expected:
- Unlock menurunkan status approval ke `Pending`.
- Relock mengembalikan ke `Approved`.
- Akses dan guard mengikuti status terbaru.

## Skenario 6 - Manual Quotation
1. Klik `Create Manual Quotation`.
2. Isi field minimal dan simpan.
3. Ubah status sampai `Approved`.

Expected:
- Quotation manual masuk database quotation.
- Workflow status + export rule sama seperti quotation dari survey.

## Kriteria Lulus UAT
1. Data Collection dapat menghasilkan quotation.
2. Quotation tersimpan, dapat diapprove, dan export final hanya saat approved.
3. Project approval hanya via owner dan mengunci data terkait sesuai aturan.
4. Export guard backend dan disable UI konsisten.
5. Tidak ada error 500 pada flow utama.

