# UI Clarity Rules (Wajib)

Tujuan: mencegah UI yang membingungkan di seluruh modul ERP.

## 1) Satu istilah untuk satu makna
- `Quotation Status` jangan dicampur dengan `Project Approval`.
- `Project Execution Status` harus terpisah dari `Project Approval Status`.

## 2) Tombol invalid harus disabled
- Jangan biarkan user klik aksi yang pasti gagal.
- Tooltip wajib menjelaskan kenapa disable dan harus ke halaman mana.

## 3) Semua flow penting tampil sebagai hint bar
- Minimal tampilkan:
  - urutan state
  - kondisi final (kapan bisa export/finalize)
  - shortcut ke halaman terkait (Approval Hub / Project / Quotation)

## 4) Approval harus terpusat
- Approval lintas dokumen dipusatkan di `/finance/approvals`.
- Halaman modul boleh menampilkan status, tapi jangan bikin alur approval tandingan.

## 5) Error message harus action-oriented
- Hindari pesan generik.
- Format:
  - masalahnya apa
  - langkah berikutnya apa
  - arahkan user ke route yang benar

## 6) Checklist sebelum merge UI
1. Tidak ada dua badge status dengan nama ambigu.
2. Tidak ada tombol aksi yang bisa menimbulkan error “state invalid”.
3. Tersedia flow hint di atas table/list utama.
4. User role non-authorized tidak melihat aksi approve/reject.
5. Jalur dari Quotation -> Approval Hub -> Project bisa ditempuh <= 2 klik.
