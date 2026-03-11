# BW Water Presentation Variants

## Versi Formal Ke Client

### Opening

`Pada demo ini kami akan menunjukkan bagaimana sistem mengelola alur pekerjaan secara end-to-end, mulai dari survey lapangan, penawaran, project execution, supply chain, warehouse control, logistics, hingga finance dan dokumentasi export.`

### Data Collection

`Tahap awal dimulai dari data collection. Semua kebutuhan teknis di lapangan dicatat lebih dulu, termasuk material, manpower, equipment, schedule, dan consumables. Dengan pendekatan ini, data survey tidak berhenti sebagai catatan, tetapi menjadi dasar bagi proses komersial dan operasional berikutnya.`

### Quotation

`Setelah survey selesai, data tersebut dapat langsung diturunkan menjadi quotation. Ini mengurangi duplikasi input dan memastikan bahwa penawaran yang dibuat tetap konsisten dengan kebutuhan teknis di lapangan.`

### Project

`Ketika quotation sudah disetujui, sistem melanjutkan proses ke level project. Project menjadi titik referensi utama yang menghubungkan modul pengadaan, gudang, produksi, logistics, dan finance.`

### Supply Chain dan Gudang

`Dari sisi supply chain, pengadaan dapat dimonitor melalui purchase order dan receiving. Dari sisi warehouse, material yang diterima masuk ke inventory, lalu dikeluarkan ke project melalui work order dan stock movement yang tercatat dengan jelas.`

### Produksi dan QC

`Pada tahap eksekusi, pekerjaan dipantau melalui work order, production report, production tracker, dan quality control. Dengan demikian, progres pekerjaan dan hasil inspeksi dapat ditelusuri secara sistematis.`

### Logistics dan Dokumen Serah Terima

`Untuk pengiriman dan penyerahan pekerjaan, sistem menyediakan surat jalan, proof of delivery, dan berita acara. Dokumen ini memperkuat aspek kontrol operasional sekaligus administrasi serah terima.`

### Finance

`Di sisi finance, invoice customer, vendor expense, serta status pembayaran sudah terhubung ke chain project yang sama. Jadi pengguna bisa melihat hubungan antara aktivitas operasional dengan dampak finansialnya.`

### Closing

`Inti dari sistem ini adalah integrasi. Setiap modul tidak berjalan sendiri-sendiri, melainkan membentuk satu alur data yang utuh dari awal hingga akhir pekerjaan.`

## Versi Santai Untuk Demo Internal

### Opening

`Saya tunjukin satu flow penuh pakai sample BW Water. Jadi kita lihat dari awal survey sampai invoice dibayar itu nyambung semua.`

### Data Collection

`Mulainya dari data collection. Di sini kita isi hasil survey lapangan dulu, materialnya apa, manpower-nya siapa, alatnya apa, dan jadwal kerjanya seperti apa.`

### Quotation

`Dari data collection ini kita langsung bisa bikin quotation. Jadi sales tidak perlu ngetik ulang dari nol.`

### Project

`Kalau quotation sudah approve, lanjut jadi project. Nah project ini yang nanti dipakai semua modul lain.`

### Supply Chain

`Berikutnya masuk ke PO dan receiving. Jadi barang yang dibeli vendor masuk dulu ke sistem sebelum dipakai.`

### Gudang

`Di monitoring gudang kita bisa lihat material yang masuk, stoknya berapa, bahkan supply chain juga bisa nambah barang manual dan registrasi SKU langsung dari sini.`

### Produksi

`Begitu material sudah siap, kita lanjut ke MR, SPK, work order, report produksi, tracker, sampai QC. Jadi progres kerja dan hasil inspeksi ada semua.`

### Logistics

`Kalau barang atau hasil kerja diserahkan, kita punya surat jalan, POD, dan berita acara.`

### Finance

`Terakhir masuk ke finance. Invoice customer-nya ada, status pembayarannya juga kebaca. Jadi benar-benar dari survey sampai uang masuk bisa ditrack.`

### Closing

`Jadi kalau ditanya inti sistemnya apa, jawabannya: semua modul nyambung, bukan aplikasi yang berdiri sendiri-sendiri.`

## Urutan Klik Per Halaman

### Skenario Ringkas

1. `Data Collection`
   - search: `BW Water`
   - klik `Lihat Detail`
   - klik `Preview` atau `Word`

2. `Quotation`
   - search: `001/BWW/GMT/II/2026`
   - buka detail / export

3. `Project`
   - search: `PRJ-BWW-2602-001`

4. `Purchase Order`
   - search: `PO/BWW/II/2026/001`

5. `Receiving`
   - search: `RCV/BWW/III/2026/001`

6. `Monitoring Gudang`
   - search: `MAT-CS-001`
   - tunjukkan `Registrasi SKU`
   - tunjukkan `Input Manual Inbound`

7. `Material Request`
   - search: `MR/BWW/III/2026/001`

8. `SPK`
   - search: `SPK/BWW/III/2026/001`

9. `Work Order`
   - search: `WO/BWW/III/2026/001`

10. `Production Report`
   - search: `PRD-BWW-2602-001`

11. `QC Inspection`
   - search: `QC-BWW-2602-001`

12. `Surat Jalan`
   - search: `SJ/BWW/III/2026/001`

13. `Berita Acara`
   - search: `BA/BWW/III/2026/001`

14. `Piutang / Customer Invoice`
   - search: `INV/BWW/III/2026/001`
   - tunjukkan `Paid`
   - klik export

## Jawaban Cepat Kalau Ditanya

### “Sistem ini buat apa?”

`Untuk menghubungkan proses operasional dan finance dalam satu alur data yang konsisten.`

### “Apa bedanya dengan input manual biasa?”

`Di sini data survey, quotation, project, gudang, produksi, logistics, dan finance saling referensi. Jadi tidak terputus antar departemen.`

### “Apa yang paling kuat dari demo ini?”

`Satu sample BW Water bisa menunjukkan chain penuh dari awal sampai akhir, termasuk export dokumen.`
