# LAPORAN MASTER AUDIT ERP — PT GEMA TEKNIK PERKASA
Tanggal: 6 September 2026 | Sumber: Ubuntu production (fresh sync) + PostgreSQL live
Lensa: 5 (Backend endpoints, Frontend forms, Alur bisnis, Security, Verifikasi data live)

---

## RINGKASAN EKSEKUTIF

| Area | Skor | Catatan |
|---|---|---|
| **Data integrity (DB live)** | ✅ 95% | 8 cek anomali lolos, hanya 3 opening-balance stok tanpa movement |
| **Frontend persistence** | ✅ 97% | Semua form masuk DB; hanya addEquipmentUsage localStorage-only |
| **Backend atomicity** | ✅ 80% | ~60 endpoint atomic, ~23 audit-log di luar transaksi (minor) |
| **Security** | ⚠️ 75% | Fondasi kuat (CSRF/rate-limit/injection bersih), TAPI role matrix /data/* terbuka |
| **Alur bisnis** | ✅ 90% | Semua rantai utama nyambung; POD upload tidak buat DB record |

**Aplikasi layak dipakai harian.** Temuan di bawah adalah perbaikan bertahap, bukan penghambat operasional — kecuali P0-1 (role matrix) yang sebaiknya segera diputuskan.

---

## PRIORITAS PERBAIKAN

### ✅ P0-1 — SELESAI & LIVE (6 Sept): Role matrix /data/* diaktifkan
- `canWriteDataResource`: `return true` dihapus → matrix `DATA_WRITE_ROLES_BY_RESOURCE` (53 resource) aktif
- `PRIVILEGED_ROLES` dipangkas ke OWNER/SPV/ADMIN/MANAGER (sebelumnya semua role enum utama bypass matrix)
- `ROLE_ALIASES` diperluas: FINANCE_ACCOUNTING→FINANCE, SALES_MARKETING→SALES, OPERATIONAL_PRODUCTION→PRODUKSI/SUPPLY_CHAIN/WAREHOUSE, MANAGER→OWNER
- Read tetap terbuka semua role (matrix hanya membatasi tulis)
- **20/20 unit test PASS** + verifikasi live container: HR→surat-jalan=false, OWNER→surat-jalan=true, OPS→work-orders=true, OPS→payrolls=false
- Catatan: user aktif saat ini hanya OWNER+ADMIN (ter-cover semua resource) — tidak ada yang terkunci

### ✅ P0-2 — SELESAI & LIVE (6 Sept): Pembayaran AP lewat endpoint payment
- Store function baru `payVendorInvoice` → `POST /finance/vendor-invoices/:id/payments` (atomic: payment + saldo + history + record rekonsiliasi bank dalam 1 transaksi)
- `handlePay` AccountsPayablePage tidak lagi menghitung saldo/history di client
- Validasi status server-side ditambahkan (AP + AR): invoice Draft/Rejected ditolak "belum disetujui dan tidak boleh dibayar"
- Verifikasi live: route terdaftar, validasi terkompilasi, AP_PAYMENT bank-rec creation aktif, frontend bundle mengandung payVendorInvoice, backend log bersih

### 🟡 P1 — Minggu ini

**P1-1. 3 opening balance stok tanpa movement** (MAT-DEMO-01/02, MAT-E2E-001)
Saldo awal diinput tanpa movement "Opening Balance" → ledger tidak bisa direkonsiliasi penuh. Fix: insert 3 movement historis + tambahkan logic opening-balance movement saat create stock item dengan stok awal > 0. ~30 menit.

**P1-2. POD upload tidak buat DB record** (media.ts:365)
Foto/tanda tangan POD disimpan ke disk tapi tidak ada row DB yang menghubungkan ke surat jalan → file orphan kalau client gagal PATCH. Fix: buat row asset (mirror pola qc-drawings). ~1 jam.

**P1-3. Approve top-up kas tanpa role check** (financeOps.ts:16)
Endpoint approve top-up hanya `authenticate` — semua role bisa approve. Fix: tambahkan authorize(OWNER/SPV/MANAGER/FINANCE). ~15 menit.

**P1-4. 8 form finance fire-and-forget** (AP pay/kirim/approve/reject + expense approve/reject ×2)
Persist tapi tanpa rollback — UI bisa tidak sinkpn sampai refresh. Fix: tambahkan rollback di store functions. ~1-2 jam. (P0-2 otomatis menyelesaikan bagian AP pay.)

### 🟢 P2 — Bulan ini (nice-to-have)

- **P2-1.** Audit log di luar $transaction (~23 endpoint: data.ts, resourceAliases, operations legacy) — jejak audit bisa hilang jika log gagal; write utama aman. Bertahap.
- **P2-2.** Upload: tambah magic-byte validation (sekarang percaya MIME header); batasi invoice-proof ke role finance.
- **P2-3.** Backup files .bak/.pre-*/.before-* bersarang di src/routes — hygiene, hapus atau pindah ke luar source tree.
- **P2-4.** addEquipmentUsage (FieldProjectRecord) localStorage-only → tambah persist.
- **P2-5.** ~16 model Prisma dead weight (dedicated tables tidak pernah ditulis karena data masuk AppEntity) — konsolidasi arsitektur jangka panjang.
- **P2-6.** Dual stock path (data.ts vs inventory.ts) — refactor terencana (BE-C7 family).

---

## DETAIL PER LENSA

### Lensa 1 — Backend Endpoints (~137 mutating endpoint diperiksa)
- ✅ **Atomic ($transaction)**: ~60 — semua modul inti (inventory stock-in/out Serializable+retry, koperasi advisory lock, finance payment service, quotations, projects, procurement CRUD, hr, users)
- ⚠️ **Multi-write non-atomic**: ~23 — dominan pola "write lalu audit-log terpisah"; write utama single-statement jadi data bisnis aman, hanya jejak audit yang berisiko hilang
- ✅ Auth: **100% endpoint mutasi terproteksi authenticate** (klaim subagent "21 tanpa auth" terbukti SALAH setelah verifikasi)
- ✅ Injection: semua raw SQL parameterized (tagged template)
- ⚠️ Validasi: sebagian PATCH pakai passthrough (id enforced, extra keys diterima)
- ❌ Tidak persist: hanya POST /media/pod-assets (P1-2)

### Lensa 2 — Frontend Forms (semua modul, ~60 store function dianalisis)
- ✅ **Persist + rollback**: modul produksi (addProductionReport, addQCInspection), sales (addQuotation, addProject, createInvoiceWithAR), koperasi (member/simpanan/pinjaman), SPK/SJ composite
- ✅ **Persist selalu-API**: HR (attendance, employee, kasbon, leave, overtime, penilaian), inventory (stock item/in/opname), purchasing (PO, receiving), data collection
- ✅ **Persist + fallback offline** (aman by design): asset, surat-*, approveProject, addExpense, createStockOut
- ⚠️ **Fire-and-forget (dengan rollback catch)**: addEmployeeAdvance, addPayrollRun, addOnlineEmployee — data tetap tersimpan, UI diberi tahu jika gagal (pattern sudah benar, hanya tidak await)
- ❌ **localStorage-only**: addEquipmentUsage (FieldProjectRecord) — P2-4
- 📖 Read-only: semua halaman laporan

### Lensa 3 — Alur Bisnis (7 flow)
| Flow | Status |
|---|---|
| Sales: quotation → approval → convert → project | ✅ (dual-write Quotation+AppEntity terjaga di $transaction) |
| Procurement: PO → receiving → stock-in (manual via dropdown) → AP → bayar | ⚠️ AP payment path (P0-2) |
| Produksi: WO → LHP → QC → stock-in → progress | ✅ (submit-lhp atomic 12 tabel, advisory lock) |
| AR: invoice → approval → payment → bank rec → GL | ✅ (payment service atomic + FOR UPDATE) |
| HR: attendance → payroll → disburse → kasbon/koperasi | ✅ (payroll post atomic, advisory lock) |
| Petty cash: entry → top-up → approve → bank rec | ✅ (approve atomic: entry+bank rec+request) |
| Delivery: SJ → POD → invoice | ⚠️ POD tidak buat DB record (P1-2) |

### Lensa 4 — Security
| Cek | Hasil |
|---|---|
| CSRF (4 lapis) | ✅ solid |
| Rate limit | ✅ komprehensif |
| SQL injection | ✅ bersih |
| Path traversal upload | ✅ terproteksi (server-generated filename + resolve check) |
| Secrets | ✅ JWT via env, tidak hardcoded |
| Bootstrap-owner | ✅ guarded (403 jika owner ada) |
| users.ts authorization | ✅ model terbaik (OWNER/ADMIN/SPV dengan escalation guards) |
| **Role matrix /data/*** | 🔴 terbuka semua role (P0-1, by design "temporary") |
| Approve top-up | ⚠️ tanpa role check (P1-3) |
| Upload MIME | ⚠️ tanpa magic-byte (P2-2) |

### Lensa 5 — Verifikasi Data Live (PostgreSQL production)
- Row count 21 tabel — semua flow terisi data nyata
- 8 anomali scan: AR overpaid=0, AR/AP balance=0 mismatch, payroll duplikat=0, WO qty=0 mismatch, bank rec tanpa sumber=0, AR payment→bank rec=0 bolong ✅
- ⚠️ 3 opening balance tanpa movement (P1-1)
- 🔴 FinanceVendorInvoicePayment=0 baris (bukti P0-2)

---

## CATATAN METODOLOGI
- Koneksi model API tidak stabil (8x reset) — laporan diekstraksi bertahap + audit frontend dikerjakan manual
- 3 klaim subagent terbukti SALAH setelah verifikasi langsung (21 endpoint tanpa auth, notifications tanpa auth, syncInventoryFromReceiving dipanggil) — dibatalkan dari laporan ini

---

## LAMPIRAN: PENUTUPAN GAP (sesi lanjutan, 6 Sept)

Area yang semula NOT AUDITED telah diverifikasi langsung:

### 1. Dashboard family (12 file) ✅ BERSIH
- Hanya **1 endpoint mutasi** di seluruh dashboard family: `POST /dashboard/finance-approval-action` (dashboard.ts:448)
- Role enforcement ADA: approve PO/reject = OWNER/SPV (canApprovePoByRole), verify invoice = OWNER/ADMIN/MANAGER/FINANCE (canVerifyInvoiceByRole) — dicek internal di executeFinanceApprovalAction
- QUOTATION action: `$transaction` penuh ✅; non-quotation (PO): updateFinanceResourceDoc pakai `$transaction` internal ✅
- Audit log lewat db param yang sama ✅

### 2. dataCollections.ts ✅ BERSIH
- 4 endpoint mutasi (POST/PATCH/DELETE/bulk PUT) — **semua authenticate + $transaction** ✅

### 3. exports.ts (4.382 baris) ✅ READ-ONLY MURNI
- 26 endpoint POST = semua generator dokumen (Word/Excel) — **0 tulis database**, semua authenticate
- salesAnalytics.ts, health.ts: 0 mutasi, 0 tulis ✅

### 4. data.ts contract handlers (4185-5620) ✅ PATTERN TERKONFIRMASI
- Single POST/PATCH: write tunggal (atomic by nature) + audit log terpisah (⚠️ sudah tercatat P2-1)
- Bulk PUT: 21 endpoint pakai `$transaction` ✅
- Validasi: zod + sanitize + referential check ✅ — Auth: authenticate + canWriteDataResource ✅ (P0-1 berlaku)

### 5. Alur bisnis (verifikasi data live) ✅ SEMUA NYAMBUNG
- **Sales**: 8 project punya quotationId valid; 0 quotation Approved yang tidak ter-convert ✅
- **HR payroll**: 4 payroll run (Calculated/Approved) konsisten; 0 run Disbursed tanpa audit log PAYROLL_DISBURSED ✅
- **Petty cash**: semua top-up Approved tercatat di rekonsiliasi bank ✅ — 1 inkonsistensi kosmetik: record backfill lama menunjuk sourceId=entry kas, record baru menunjuk sourceId=request top-up (uang lengkap, hanya perbedaan pola linkage)

### KESIMPULAN PENUTUPAN GAP
Coverage audit kini **100%** dari area yang teridentifikasi. Tidak ada temuan CRITICAL baru dari gap closure — temuan valid tetap yang sama: P0-1 (role matrix), P0-2 (AP payment path), dan P1/P2 yang sudah tercantum di atas.
