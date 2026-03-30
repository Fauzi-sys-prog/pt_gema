# Staging UAT Runbook

Dokumen ini dipakai untuk menjalankan UAT di staging dengan cara yang rapi dan konsisten.

## Environment
- Staging web: `https://gemateknik.online:8443`
- Staging API health: `https://gemateknik.online:8443/api/health`
- Production web: `https://gemateknik.online`

## Tujuan
- memastikan perubahan baru tidak merusak app utama
- memastikan role dan flow operasional benar-benar nyaman dipakai
- mengumpulkan bukti UAT sebelum perubahan masuk penuh ke production

## Siapa Yang Terlibat
- `OWNER`: sign-off akhir
- `SPV`: validasi flow approval dan operasional
- `SALES`: validasi flow komersial awal
- `PURCHASING`: validasi pengadaan
- `WAREHOUSE`: validasi stok dan pengiriman
- `PRODUKSI`: validasi eksekusi lapangan
- `FINANCE`: validasi tagihan dan pembayaran
- `ADMIN`: validasi user dan kontrol operasional

## Urutan UAT Yang Disarankan
1. Pre-check environment
2. Login semua role utama
3. Jalankan flow komersial awal
4. Jalankan flow pengadaan dan stok
5. Jalankan flow dokumen proyek dan produksi
6. Jalankan flow invoice dan payment
7. Jalankan negative test role
8. Rekap bug dan sign-off

## Pre-Check
- buka staging web
- cek health API
- pastikan staging bukan production
- pastikan user role yang dibutuhkan aktif
- pastikan ada data minimum untuk dicoba

## Sesi UAT 1: Access & Login
- Login setiap role
- Cek landing dashboard sesuai konteks kerja
- Cek menu yang muncul terasa relevan
- Logout lalu login ulang

Lulus jika:
- tidak ada error login/logout
- role tidak nyasar ke menu yang tidak relevan

## Sesi UAT 2: Flow Komersial
- `SALES` buat atau lanjutkan `Data Collection`
- `SALES` buat `Quotation`
- `SPV/OWNER` review approval jika memang perlu
- pastikan project linked bisa dilihat

Lulus jika:
- flow awal tidak mentok
- status jelas
- tidak ada `500`

## Sesi UAT 3: Procurement & Stock
- `PURCHASING` buat atau cek `PO Supplier`
- `WAREHOUSE` proses `Receiving`
- cek stok masuk/keluar dan konsistensi data

Lulus jika:
- data procurement dan stok sinkron
- receiving tidak bikin relasi putus

## Sesi UAT 4: Produksi & Dokumen
- `PRODUKSI` lanjutkan `WO/SPK`
- `WAREHOUSE` atau role terkait lanjutkan `Surat Jalan`
- `PRODUKSI` / user terkait buat `Berita Acara`

Lulus jika:
- dokumen proyek tersambung antar langkah
- tidak ada page yang jatuh gara-gara role mismatch

## Sesi UAT 5: Finance
- `FINANCE` cek invoice yang sudah layak
- coba payment / AR / AP sesuai flow
- pastikan invoice tidak lolos kalau dokumen belum final

Lulus jika:
- invoice guard tetap aktif
- page finance stabil

## Sesi UAT 6: Negative Test
- role non-approval coba approval sensitif
- role non-finance coba akses finance sensitif
- role non-admin coba aksi admin sensitif

Lulus jika:
- sistem menolak dengan benar
- UI tidak menampilkan aksi yang seharusnya tidak ada

## Evidence
Simpan minimal:
- screenshot per step penting
- screenshot negative test
- commit/build yang sedang diuji
- catatan bug: role, page, repro, expected, actual

Gunakan lembar ini juga:
- [docs/UAT_EVIDENCE_SHEET.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_EVIDENCE_SHEET.md)
- [docs/UAT_ROLE_CHECKLIST.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_ROLE_CHECKLIST.md)

## Sign-Off
- SPV menyatakan flow operasional aman
- OWNER menyatakan staging layak promote
- bug blocker = `0`
- bug minor dicatat untuk batch berikutnya
