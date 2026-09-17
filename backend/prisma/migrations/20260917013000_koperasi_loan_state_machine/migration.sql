-- Audit identity untuk maker-checker pinjaman koperasi.
ALTER TABLE "KoperasiPinjaman"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "disbursedByUserId" TEXT;

-- Satu anggota hanya boleh memiliki satu pinjaman yang masih terbuka.
-- Settled / Rejected tidak memblokir pengajuan berikutnya.
CREATE UNIQUE INDEX "KoperasiPinjaman_one_open_loan_per_member_key"
ON "KoperasiPinjaman" ("memberId")
WHERE status IN ('Pending', 'Approved', 'Active');
