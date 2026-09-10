# Audit Atomicity Menyeluruh (Static)

Tanggal snapshot: 3 September 2026  
Sumber audit: `/root/pt_gema` pada server Ubuntu  
Lingkup: seluruh jalur tulis backend Express/Prisma yang terdaftar di `backend/src/app.ts`, termasuk efek database, audit log, sinkronisasi antarmodel, filesystem, dan risiko concurrency.

## Batas audit

Audit ini berbasis pembacaan source dan schema. Tidak dilakukan mutasi data produksi, fault injection, rollback test, load test, atau concurrency test. Karena itu, temuan berlabel **Confirmed** dibuktikan langsung oleh alur source; risiko race berlabel **Concurrency risk** masih perlu direproduksi dengan dua request paralel.

Definisi yang dipakai:

- **Atomic**: semua perubahan yang merupakan satu business event berhasil bersama atau rollback bersama.
- **Non-atomic**: sebagian perubahan dapat commit sementara langkah lain gagal.
- **Concurrency risk**: satu request mungkin transactional, tetapi dua request bersamaan dapat menghasilkan lost update, double posting, atau keputusan dari state basi.

## Ringkasan eksekutif

Status sistem belum atomic secara menyeluruh. Perbaikan sebelumnya sudah membuat jalur utama Procurement, HR employee/attendance, Operations generic/LHP/QC, serta Finance generic menyatukan data dan audit log dalam transaksi. Namun masih ada empat kelompok risiko besar:

1. Jalur legacy/generic dan beberapa dedicated route menyimpan data lebih dulu lalu audit log di luar transaksi.
2. Proses saldo, stok, pembayaran, approval, dan cicilan masih banyak memakai pola read-calculate-write tanpa row lock, conditional update, atau constraint idempotensi.
3. Quotation conversion, perubahan password, serta upload media melibatkan langkah lanjutan di luar transaksi utama.
4. Belum ada test suite khusus rollback dan request paralel untuk membuktikan invariant bisnis.

Prioritas keseluruhan: **P0 untuk uang/stok/security**, **P1 untuk audit trail dan sinkronisasi lintas model**, **P2 untuk hardening route generic dan coverage test**.

## Temuan P0

### 1. Pembayaran customer/vendor rawan double posting dan lost update

Status: **Concurrency risk — tinggi**

`financeOps.ts` menaruh payment, perubahan invoice, dan audit dalam transaksi, tetapi saldo invoice dihitung dari nilai `paidAmount` yang dibaca sebelumnya. `FinanceCustomerInvoicePayment.proofNo` dan `FinanceVendorInvoicePayment.noBukti` tidak mempunyai unique constraint pada schema. Dua request paralel dapat sama-sama lolos pengecekan idempotensi dan menulis payment ganda atau menimpa hasil perhitungan request lain.

Dampak: outstanding invoice salah, pembayaran duplikat, status Paid/Partial tidak konsisten.

Perbaikan: unique key idempotensi per invoice, conditional update atau row lock, transaksi Serializable dengan retry untuk konflik, dan invariant `paidAmount = sum(payments)`.

### 2. Mutasi stok memakai nilai absolut dari snapshot lama

Status: **Concurrency risk — tinggi**

Jalur Inventory dan submit LHP mengelompokkan record utama, item, movement, dan audit dalam transaksi. Namun stok dibaca, dihitung di aplikasi, lalu disimpan sebagai nilai absolut. Contoh Operations berada di `backend/src/routes/operations.ts:821-873` dan `987-1080`. Dua transaksi bersamaan terhadap item yang sama dapat kehilangan salah satu update atau sama-sama melewati pemeriksaan stok cukup.

Dampak: on-hand berbeda dari ledger movement, stok negatif, atau hasil produksi/pemakaian material tidak akurat.

Perbaikan: atomic increment/decrement dengan guard `onHandQty >= qty`, lock baris item, Serializable + retry, serta rekonsiliasi invariant ledger-versus-on-hand.

### 3. Koperasi approval/cicilan/payroll posting belum idempotent terhadap request paralel

Status: **Concurrency risk — tinggi**

Proses approval pinjaman, posting cicilan, dan posting potongan payroll memakai transaksi database, tetapi status dan saldo dibaca sebelum update tanpa conditional state transition atau unique business key yang cukup. Dua request paralel dapat sama-sama melihat status Pending/Approved atau nomor cicilan yang sama lalu membuat transaksi kas/potongan ganda.

Dampak: kas koperasi, outstanding pinjaman, jumlah cicilan, dan payroll deduction tidak akurat.

Perbaikan: compare-and-set status, unique reference untuk setiap posting, row lock/Serializable + retry, dan idempotency key pada endpoint.

### 4. Change password dan invalidasi semua sesi terpisah

Status: **Confirmed non-atomic — tinggi**

Di `backend/src/routes/auth.ts:317-333`, password diubah lebih dahulu, kemudian marker logout-all di-upsert terpisah. Jika langkah kedua gagal, password sudah berubah tetapi sesi lama belum dibatalkan.

Dampak: jaminan keamanan “ubah password memutus sesi lama” tidak terpenuhi.

Perbaikan: satukan update password dan revoked-token marker dalam satu transaksi; gunakan conditional password update untuk menghindari dua perubahan bersamaan dari snapshot password lama.

### 5. Bootstrap OWNER memiliki race check-then-create

Status: **Concurrency risk — tinggi saat bootstrap terbuka**

`backend/src/routes/auth.ts:51-74` menghitung OWNER lalu membuat user di operasi terpisah. Schema tidak membatasi jumlah OWNER menjadi satu. Dua request awal paralel dapat membuat dua OWNER dengan email/username berbeda.

Perbaikan: advisory lock/serializable bootstrap transaction atau singleton bootstrap record dengan unique constraint; matikan endpoint setelah provisioning.

## Temuan P1

### 6. Resource aliases: data commit sebelum audit log

Status: **Confirmed non-atomic**

Di `backend/src/routes/resourceAliases.ts:243,306,327,353`, create/update/delete/bulk selesai lebih dahulu lalu `writeAuditLog` dipanggil melalui client global. Alias ini mencakup sejumlah resource HR, Finance, dan inventory legacy.

Dampak: data berhasil berubah tetapi audit hilang; kegagalan audit juga dapat membuat API mengembalikan error setelah data telanjur commit.

### 7. Dedicated dan generic routes di data.ts masih memisahkan data dan audit

Status: **Confirmed non-atomic**

Kelompok terdampak:

- Dedicated-contract create/update/delete: `data.ts:3950,4016,4044`.
- Archive registry: `data.ts:4281`.
- Assets: `data.ts:4348-4409`.
- Maintenances: `data.ts:4479-4574`.
- Invoices: `data.ts:4652-4775` (header dan item sendiri sudah dikelompokkan, audit masih di luar).
- Template surat: `data.ts:4939-4997`.
- App settings: `data.ts:5181-5248`.
- HR leaves: `data.ts:5292-5351`.
- HR online status: `data.ts:5395-5454`.
- Generic `/data/:resource`: `data.ts:5741-6040`.

Surat masuk, surat keluar, dan relational payroll sudah mengirim transaction client ke audit writer, sehingga lebih baik pada dimensi data+audit.

### 8. User management menjadikan audit best-effort

Status: **Confirmed non-atomic**

Create/update/soft-delete user menyimpan user terlebih dahulu dan audit dilakukan terpisah; error audit ditelan dengan `.catch(() => undefined)` pada `backend/src/routes/users.ts`.

Dampak: perubahan akun atau privilege dapat terjadi tanpa jejak audit.

Perbaikan: user write dan audit log dalam transaksi yang sama; authorization-sensitive update memakai conditional predicate terhadap state terkini.

### 9. Quotation commit terpisah dari project conversion dan approval log

Status: **Confirmed non-atomic**

Create/update quotation meng-commit quotation, sections/items, dan AppEntity lebih dahulu. Setelah itu project conversion dan approval log dijalankan pada `backend/src/routes/quotations.ts:1408-1410` dan `1689-1727`.

Dampak: quotation bisa menyatakan converted tetapi project belum sinkron; approval state berubah tanpa log; retry setelah response error berpotensi mengulang efek samping.

Catatan: aksi approval quotation melalui dashboard memakai satu transaction client dan lebih kuat. Aksi PO/invoice dashboard masih perlu disatukan dengan audit pada transaksi yang sama.

### 10. Stock opname confirm: perubahan stok commit sebelum audit

Status: **Confirmed non-atomic**

Konfirmasi opname mengubah item, movement, dan status opname dalam transaksi, lalu audit ditulis setelah commit di `backend/src/routes/inventory.ts:1051`. Bila audit gagal, koreksi stok tetap berlaku tanpa audit.

### 11. Upload filesystem dan insert database tidak mempunyai kompensasi

Status: **Confirmed non-atomic**

`storeImageDataUrl` menulis file pada `backend/src/utils/mediaStorage.ts:111-112`. QC drawing dan LHP photo baru membuat row asset sesudah file selesai (`backend/src/routes/media.ts:125-161` dan `232-268`). `materializeMediaDataUrls` juga dipakai sebelum sebagian write di `data.ts`.

Dampak: kegagalan database meninggalkan file yatim; penghapusan/update data dapat meninggalkan file lama.

Perbaikan: staging file + finalize setelah DB, compensating unlink saat DB gagal, garbage collector terjadwal, dan reference registry.

### 12. Validasi tahun buku berada di luar transaksi write

Status: **Concurrency risk — tinggi untuk closing period**

`ensureFinancialYearsOpen` dipanggil sebelum transaksi pada Finance Ops, Finance Misc, dan relational payroll. Tahun dapat ditutup setelah validasi tetapi sebelum commit transaksi.

Dampak: transaksi baru masuk ke periode yang sudah ditutup.

Perbaikan: lock/snapshot closed-year di transaksi yang sama, atau database constraint/trigger dengan versi period lock.

## Temuan P2

### 13. Banyak PATCH memakai stale read dan full replacement

Status: **Concurrency risk — menengah**

Projects, data collections, HR, Operations, Procurement, route alias, dan beberapa route `data.ts` membaca existing row di luar transaksi, merge payload di aplikasi, lalu menyimpan hasil penuh. Dua editor dapat saling menimpa field tanpa konflik terdeteksi.

Perbaikan: optimistic locking (`version`/`updatedAt` compare-and-set), transaction-scoped read, dan response 409 pada konflik.

### 14. Employee ID hanya indexed, bukan unique

Status: **Confirmed schema gap**

`EmployeeRecord.employeeId` mempunyai `@@index`, bukan `@unique`. Duplicate check pada aplikasi tidak melindungi request paralel.

Perbaikan: bersihkan duplikat lalu tambah unique constraint jika employeeId memang business key.

### 15. Generic data authorization terlalu longgar

Status: **Material observation, bukan isu atomicity**

`canReadDataResource` dan `canWriteDataResource` pada `dataResourceRules.ts` saat ini mengizinkan seluruh role terautentikasi. Blocklist dedicated resource mengurangi sebagian exposure, tetapi route generic nonblocked tetap luas.

Perbaikan: allowlist per resource dan role; jangan mengandalkan blocklist sebagai boundary utama.

## Area yang relatif baik

- Procurement CRUD/bulk: data dan audit sudah dalam satu transaksi.
- HR employee/attendance CRUD/bulk: data dan audit sudah dalam satu transaksi.
- Operations generic CRUD/bulk dan submit LHP/QC: data dan audit sudah satu transaksi; concurrency stok tetap perlu diperbaiki.
- Finance Ops dan Finance Misc generic CRUD/bulk: data dan audit sudah satu transaksi. Bank reconciliation memakai Serializable.
