# UAT Evidence Sheet

Project: ____________________  
Tester: ____________________  
Tanggal: ____________________  
Build/Commit: ____________________

## Ringkasan
- Total testcase: 6
- Pass: ___
- Fail: ___
- Blocked: ___

## Evidence Table

| No | Test Case | Step Singkat | Expected | Actual | Status (Pass/Fail) | Screenshot/Link | Catatan |
|---|---|---|---|---|---|---|---|
| 1 | Quotation dari Survey | Create from Survey, simpan quotation | Data masuk list dan DB quotation |  |  |  |  |
| 2 | Workflow Quotation | Draft -> Sent -> Approved | Transisi valid, final ready |  |  |  |  |
| 3 | Lock setelah Project Approved | Buat project dari quotation, approve project | Quotation jadi locked |  |  |  |  |
| 4 | Export Guard Quotation | Export saat Draft/Sent lalu Approved | Non-approved ditolak, Approved berhasil |  |  |  |  |
| 5 | Export Guard Project | Export saat Pending/Rejected lalu Approved | Non-approved ditolak, Approved berhasil |  |  |  |  |
| 6 | Unlock/Relock | Unlock project approved lalu relock | Status berubah sesuai rule |  |  |  |  |

## Defect Log (Jika Ada)

| ID | Modul | Severity | Repro Step | Expected | Actual | Screenshot/Link | PIC |
|---|---|---|---|---|---|---|---|
| D-001 |  |  |  |  |  |  |  |

## Sign-off
- QA/Tester: ____________________ (Tanggal: __________)
- Product Owner: ____________________ (Tanggal: __________)
- Tech Lead: ____________________ (Tanggal: __________)

