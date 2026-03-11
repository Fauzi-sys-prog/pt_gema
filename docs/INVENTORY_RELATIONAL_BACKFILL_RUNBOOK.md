# Inventory Relational Backfill Runbook

Dokumen ini menjelaskan urutan aman untuk mengaktifkan tabel inventory relational baru tanpa memutus jalur hybrid lama.

## Tujuan

- Menambahkan tabel relational inventory baru.
- Menyalin data dari model hybrid lama ke model baru.
- Menjaga endpoint lama tetap hidup selama masa transisi.

## File yang terlibat

- Prisma schema:
  - `backend/prisma/schema.prisma`
- Migration:
  - `backend/prisma/migrations/20260311103000_add_relational_inventory_tables/migration.sql`
- Backfill script:
  - `backend/scripts/backfillInventoryRelational.cjs`

## Urutan eksekusi

1. Validasi schema

```bash
cd backend
npx prisma validate
```

2. Generate Prisma client

```bash
cd backend
npx prisma generate
```

3. Apply migration

```bash
cd backend
npx prisma migrate dev
```

Catatan:
- Jika environment demo tidak ingin membuat migration baru, cukup pastikan migration `20260311103000_add_relational_inventory_tables` ikut ter-apply.

4. Jalankan backfill

```bash
cd backend
npm run backfill:inventory-relational
```

5. Verifikasi hasil

Minimal cek jumlah row:

```sql
SELECT COUNT(*) FROM "InventoryItem";
SELECT COUNT(*) FROM "InventoryStockIn";
SELECT COUNT(*) FROM "InventoryStockOut";
SELECT COUNT(*) FROM "InventoryStockMovement";
SELECT COUNT(*) FROM "InventoryStockOpname";
```

6. Smoke check aplikasi

- Halaman inventory lama tetap bisa dibuka.
- Export inventory lama tetap jalan.
- Tidak ada data hilang.

## Prinsip transisi

- Jalur lama tetap dianggap source of truth selama fase transisi pertama.
- Tabel baru hanya diisi backfill dulu.
- Read path dan write path baru dipindah setelah hasil backfill tervalidasi.

## Definition of done fase ini

- Schema valid.
- Migration tersedia.
- Backfill script tersedia.
- Backfill bisa dijalankan ulang tanpa menduplikasi record inti.
- Jalur hybrid lama belum dihapus.
