# BW Water Hard Questions

Dokumen ini dipakai untuk menghadapi pertanyaan client yang kritis saat demo.

## 1. “Ini cuma demo atau memang bisa dipakai operasional?”

Jawaban:

`Saat ini yang kami tunjukkan adalah environment demo yang merepresentasikan flow operasional nyata. Untuk alur inti seperti survey, quotation, project, supply chain, gudang, logistics, dan finance, sistemnya sudah berjalan secara terhubung. Untuk implementasi penuh, biasanya tetap perlu penyesuaian SOP dan data master sesuai perusahaan.`

## 2. “Kalau satu modul salah input, apakah modul lain ikut rusak?”

Jawaban:

`Karena datanya saling terhubung, kesalahan di satu titik memang bisa berdampak ke proses berikutnya. Justru karena itu sistem dibuat terstruktur per modul, supaya input lebih terkontrol dan jejaknya bisa ditelusuri.`

## 3. “Apa bukti bahwa ini benar-benar terintegrasi?”

Jawaban:

`Buktinya satu sample BW Water yang sama bisa dilacak dari Data Collection, Quotation, Project, PO, Receiving, Gudang, Produksi, Surat Jalan, Berita Acara, Invoice, sampai Payment. Jadi bukan data dummy yang berdiri sendiri per halaman.`

## 4. “Kalau saya tidak mau terlalu kaku, apakah masih bisa input manual?”

Jawaban:

`Bisa. Kami tetap memberi ruang input manual di titik-titik yang memang perlu fleksibel, misalnya registrasi SKU manual dan inbound manual di gudang. Jadi sistem tetap disiplin, tapi tidak memaksa semua harus seratus persen otomatis.`

## 5. “Bagaimana kalau stok di sistem beda dengan fisik?”

Jawaban:

`Secara konsep, itu diselesaikan lewat stock opname. Jadi sistem stok tidak hanya mencatat transaksi masuk dan keluar, tetapi tetap perlu validasi fisik berkala agar angka stok tetap akurat.`

## 6. “Apakah gudang hanya bisa menerima barang dari PO?”

Jawaban:

`Tidak harus. Ada jalur formal lewat PO dan receiving, tapi ada juga jalur manual inbound jika dibutuhkan untuk kebutuhan operasional tertentu.`

## 7. “Apa kelebihan sistem ini dibanding spreadsheet biasa?”

Jawaban:

`Spreadsheet kuat untuk pencatatan terpisah, tapi lemah di integrasi antar departemen. Sistem ini kelebihannya ada di alur data yang saling terhubung, status yang lebih jelas, dan dokumen yang bisa diexport langsung dari proses yang sama.`

## 8. “Kalau perusahaan saya punya SOP berbeda, apakah sistem ini kaku?”

Jawaban:

`Tidak. Struktur utamanya memang tegas, tapi implementasinya bisa disesuaikan dengan SOP perusahaan. Biasanya yang kami pertahankan adalah flow kontrolnya, sementara istilah, field, dan approval bisa disesuaikan.`

## 9. “Apakah export dokumennya sudah layak dipakai?”

Jawaban:

`Untuk kebutuhan presentasi dan operasional dasar, export Word dan Excel sudah dirapikan. Untuk beberapa modul penting seperti Payroll, Piutang, Accounts Payable, General Ledger, Bank Reconciliation, dan Quotation, export-nya juga sudah dibuat lebih formal dan spesifik.`

## 10. “Kalau saya mau audit, apakah jejak datanya ada?”

Jawaban:

`Di banyak modul, jejak referensi antar dokumen sudah ada, misalnya dari PO ke Receiving, dari Work Order ke Stock Out, dari Surat Jalan ke POD, dan dari Invoice ke Payment. Untuk kebutuhan audit formal yang lebih ketat, biasanya tinggal diperkuat pada SOP approval dan dokumentasi penggunaannya.`

## 11. “Apa titik paling rawan dalam sistem seperti ini?”

Jawaban:

`Biasanya titik paling rawan ada di kualitas input user dan disiplin operasional. Sistem bisa membantu kontrol, tapi kalau input dan SOP tidak dijaga, datanya tetap bisa bias. Jadi implementasi sistem harus berjalan bersama disiplin proses.`

## 12. “Apa yang belum atau masih bisa ditingkatkan?”

Jawaban:

`Yang masih bisa ditingkatkan biasanya ada di pendalaman fitur domain tertentu, misalnya stock opname yang lebih lengkap, approval berlapis, atau layout dokumen yang lebih spesifik per perusahaan. Jadi sistem ini sudah punya fondasi alur, lalu detailnya bisa dimatangkan sesuai kebutuhan.`

## 13. “Kalau volume data besar, apakah sistem ini masih masuk akal?”

Jawaban:

`Secara arsitektur, sistem ini memang lebih masuk akal untuk volume data yang sudah tidak efisien lagi dikelola manual. Justru ketika transaksi makin banyak dan modul makin banyak, integrasi seperti ini jadi lebih bernilai.`

## 14. “Apakah user owner atau pimpinan bisa lihat semua?”

Jawaban:

`Iya. Role pimpinan disiapkan untuk bisa memantau chain lintas modul, jadi tidak perlu berpindah sistem atau meminta rekap manual dari setiap departemen.`

## 15. “Kalau saya tidak mau langsung pakai semua modul?”

Jawaban:

`Bisa bertahap. Biasanya implementasi paling aman dimulai dari modul yang paling kritis dulu, misalnya quotation-project-supply chain-finance, lalu gudang dan produksi diperdalam setelah alur inti stabil.`

## 16. “Apa pesan paling aman di akhir demo?”

Jawaban:

`Yang ingin kami tunjukkan bukan sekadar banyak halaman, tetapi satu alur kerja yang konsisten dari awal sampai akhir. Itu yang menjadi nilai utama sistem ini.`
