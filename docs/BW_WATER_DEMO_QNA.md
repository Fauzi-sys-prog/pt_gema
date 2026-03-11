# BW Water Demo Q&A

## Q1. Sistem ini sebenarnya untuk apa?

`Sistem ini dipakai untuk menyatukan alur kerja dari survey, quotation, project, supply chain, gudang, produksi, logistics, sampai finance dalam satu chain data yang saling terhubung.`

## Q2. Apa contoh chain yang dipakai di demo?

`Kami pakai sample BW Water. Flow-nya dimulai dari Data Collection, lalu Quotation, Project, PO, Receiving, Gudang, Produksi, Surat Jalan, Berita Acara, Invoice, sampai Payment.`

## Q3. Bedanya dengan input manual biasa apa?

`Bedanya, data tidak berdiri sendiri per modul. Data survey bisa dipakai sebagai referensi quotation, project menjadi referensi supply chain dan produksi, lalu finance bisa melihat dampaknya sampai invoice dan payment.`

## Q4. Apakah gudang bisa input barang manual?

`Bisa. Di Monitoring Gudang ada Registrasi SKU untuk menambah barang baru manual, dan ada juga Input Manual Inbound untuk memasukkan stok masuk secara manual.`

## Q5. Apakah SKU bisa dibuat manual?

`Bisa. User supply chain bisa mendaftarkan SKU manual langsung dari Monitoring Gudang, termasuk nama barang, kategori, satuan, stok awal, harga satuan, dan lokasi.`

## Q6. Kalau barang masuk dari vendor, alurnya bagaimana?

`Barang dibuat dulu di Purchase Order, lalu diterima di Receiving, masuk ke Stock In, lalu stoknya tampil di Monitoring Gudang. Setelah itu material bisa dikeluarkan ke pekerjaan lewat Material Request, SPK, Work Order, dan Stock Out.`

## Q7. Bagaimana sistem memastikan barang yang dipakai di project tetap terkontrol?

`Sistem mencatat pergerakan barang melalui Stock In, Stock Out, dan Stock Movement. Jadi stok di gudang bisa ditelusuri, dan material yang dipakai ke project juga punya referensi work order.`

## Q8. Kalau mau cek pekerjaan lapangan sudah selesai atau belum?

`Bisa lewat Work Order, Production Report, Production Tracker, dan QC Inspection. Jadi progres kerja dan hasil inspeksi tetap terdokumentasi.`

## Q9. Bagaimana dokumen logistics dikelola?

`Untuk pengiriman dan serah terima ada Surat Jalan, Proof of Delivery, dan Berita Acara. Jadi bukan hanya aktivitas operasional yang tercatat, tapi dokumen administrasinya juga ada.`

## Q10. Apakah finance terhubung ke operasional?

`Iya. Di demo BW Water, invoice customer, vendor expense, dan payment sudah terhubung ke project yang sama. Jadi finance tidak terlepas dari operasional.`

## Q11. Apakah sistem bisa export dokumen?

`Bisa. Beberapa modul sudah bisa export Word dan Excel, misalnya Data Collection, Quotation, Piutang, Accounts Payable, General Ledger, Bank Reconciliation, dan Payroll.`

## Q12. Export-nya masih sekadar tabel atau sudah formal?

`Untuk generic export sudah dirapikan secara global. Untuk modul yang lebih penting seperti Payroll, Piutang, Accounts Payable, General Ledger, Bank Reconciliation, dan Quotation, kami juga sudah siapkan exporter yang lebih domain-specific dan lebih formal.`

## Q13. Kalau nanti user mau audit stok fisik, apakah perlu stock opname?

`Menurut saya perlu, dan cukup versi simple dulu. Karena sistem stok yang lengkap tanpa validasi fisik tetap berisiko menampilkan angka yang rapi tapi tidak sesuai kondisi gudang.`

## Q14. Apakah sistem ini siap dipakai demo end-to-end?

`Iya. Environment ini sudah dibersihkan supaya fokus ke satu chain demo utama yaitu BW Water, jadi saat search dan klik modul-modul utama, yang muncul sudah konsisten.`

## Q15. Kalau ditanya apa kekuatan utama sistem ini?

`Kekuatan utamanya adalah integrasi. Data survey tidak berhenti di lapangan, tapi mengalir sampai quotation, project, supply chain, gudang, produksi, logistics, dan finance.`

## Q16. Kalau client tanya apakah sistem ini fleksibel?

`Iya. Selain flow terstruktur, beberapa area seperti Monitoring Gudang juga tetap memberi ruang untuk input manual, misalnya registrasi SKU dan inbound manual.`

## Q17. Kalau client tanya siapa yang bisa akses semua modul?

`Saat ini role Owner dan SPV sudah diposisikan sebagai role pimpinan yang bisa melihat seluruh chain demo untuk keperluan monitoring dan presentasi.`

## Q18. Kalau client tanya apakah ini bisa langsung dipakai operasional?

`Untuk alur inti, sistem ini sudah cukup layak dipakai operasional dasar dan demo bisnis. Tinggal nanti disesuaikan lagi dengan kebutuhan SOP perusahaan saat implementasi penuh.`
