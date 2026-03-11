# UAT Role Checklist

Tanggal acuan: 2026-03-04
Status sistem saat checklist ini dibuat: coverage API 100%, smoke security pass.

## Akun UAT
- OWNER: `aji / changeMeAji123`
- SALES: `angesti / changeMeAngesti123`
- FINANCE: `ening / changeMeEning123`
- SUPPLY_CHAIN: `dewi / changeMeDewi123`
- ADMIN: `admin / changeMeAdmin123`
- PRODUKSI: `produksi / changeMeProduksi123`

## 1. OWNER
- Bisa login dan buka `Dashboard`, `Quotation`, `Project`, `Data Collection`.
- Bisa approve quotation `Sent -> Approved`.
- Bisa approve/reject project.
- Bisa unlock/relock project.
- Bisa lihat approval logs project dan quotation.
- Bisa export final Word/Excel project approved.

Expected:
- Semua aksi approval return sukses, tidak 500.
- Status UI berubah real-time setelah refresh.

## 2. SALES
- Bisa create quotation dari survey.
- Bisa edit quotation saat status masih Draft/Sent (sesuai aturan UI).
- Tidak bisa final approve quotation/project.
- Tidak bisa akses approval logs project jika endpoint dibatasi.

Expected:
- Aksi approve oleh SALES ditolak (403).
- Flow data collection -> quotation tetap jalan.

## 3. FINANCE
- Bisa akses halaman finance dan CRUD data finance.
- Bisa baca dashboard finance summary.
- Untuk workflow yang dibatasi, hanya status yang diizinkan role FINANCE yang bisa diubah.

Expected:
- Endpoint finance sukses.
- Tidak ada status transition ilegal.

## 4. SUPPLY_CHAIN
- Bisa kelola procurement, receiving, stock, surat jalan.
- Bisa update resource supply-chain yang diizinkan.
- Tidak bisa approve project/quotation final.

Expected:
- CRUD procurement dan inventory sukses.
- Role guard menolak aksi approval owner-only.

## 5. PRODUKSI
- Bisa kelola work order/production tracker/QC/report.
- Bisa update status produksi sesuai workflow transition.
- Tidak bisa approve project final.

Expected:
- Workflow produksi valid.
- Tidak ada akses ke aksi owner-only.

## 6. ADMIN
- Bisa kelola user (kecuali batasan OWNER).
- Tidak bisa assign role OWNER secara ilegal.
- Tidak bisa delete OWNER.

Expected:
- Endpoint `/users` aman sesuai aturan.

## 7. Regression Quick Pass
- Logout/login ulang tiap role.
- Refresh browser pada halaman utama.
- Cek network: tidak ada 500 di endpoint kritikal.

## Evidence yang wajib disimpan
- Screenshot status sebelum/sesudah approval.
- Screenshot network request gagal (403) untuk negative test role.
- File export Word/Excel hasil project approved.
- Catatan bug (jika ada): endpoint, payload, role, waktu.
