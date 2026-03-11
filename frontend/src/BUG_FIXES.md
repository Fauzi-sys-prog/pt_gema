# Bug Fixes - Null Safety Issues

## Summary
Fixed all TypeError issues related to calling `.toLowerCase()` on undefined values across multiple pages.

## Files Fixed

### 1. `/pages/finance/ApprovalCenterPage.tsx`
**Issue:** Trying to call `.toLowerCase()` on potentially undefined properties
**Fix:** Added null coalescing operators (`|| ''`) to all filter operations
- `po.noPO` → `(po.noPO || '')`
- `po.supplier` → `(po.supplier || '')`
- `q.nomorQuotation` → `(q.nomorQuotation || '')`
- `inv.noInvoice` → `(inv.noInvoice || '')`
- `inv.customer` → `(inv.customer || '')`
- `mr.noRequest` → `(mr.noRequest || '')`
- `mr.projectName` → `(mr.projectName || '')`

### 2. `/pages/ProjectQuotationPage.tsx`
**Fix:** Added null safety to quotation filters
- `item.nomorQuotation` → `(item.nomorQuotation || '')`
- `item.perihal` → `(item.perihal || '')`

### 3. `/pages/asset/DaftarAsset.tsx`
**Fix:** Added null safety to asset filters
- `asset.name` → `(asset.name || '')`
- `asset.assetCode` → `(asset.assetCode || '')`

### 4. `/pages/asset/InternalUsagePage.tsx`
**Fix:** Added null safety to internal asset filters
- `a.name` → `(a.name || '')`
- `a.assetCode` → `(a.assetCode || '')`

### 5. `/pages/asset/RentalOutPage.tsx`
**Fix:** Added null safety to rental asset filters
- `a.name` → `(a.name || '')`
- `a.assetCode` → `(a.assetCode || '')`
- `a.rentedTo` → `(a.rentedTo || '')`

### 6. `/pages/correspondence/BeritaAcaraPage.tsx`
**Fix:** Added null safety to Berita Acara filters
- `ba.noBA` → `(ba.noBA || '')`
- `ba.pihakKedua` → `(ba.pihakKedua || '')`
- `ba.jenisBA` → `(ba.jenisBA || '')`

### 7. `/pages/correspondence/SuratJalanPage.tsx`
**Fix:** Added null safety to Surat Jalan filters
- `sj.noSurat` → `(sj.noSurat || '')`
- `sj.tujuan` → `(sj.tujuan || '')`

### 8. `/pages/correspondence/SuratKeluarPage.tsx`
**Fix:** Added null safety to Surat Keluar filters
- `surat.noSurat` → `(surat.noSurat || '')`
- `surat.tujuan` → `(surat.tujuan || '')`
- `surat.perihal` → `(surat.perihal || '')`

### 9. `/pages/correspondence/SuratMasukPage.tsx`
**Fix:** Added null safety to Surat Masuk filters
- `surat.noSurat` → `(surat.noSurat || '')`
- `surat.pengirim` → `(surat.pengirim || '')`
- `surat.perihal` → `(surat.perihal || '')`

### 10. `/pages/correspondence/SuratPerintahKerjaPage.tsx`
**Fix:** Added null safety to SPK filters
- `spk.noSPK` → `(spk.noSPK || '')`
- `spk.pekerjaan` → `(spk.pekerjaan || '')`
- `spk.projectName` → `(spk.projectName || '')`

### 11. `/pages/data-collection/DataCollection.tsx`
**Fix:** Added null safety to material search
- `item.nama` → `(item.nama || '')`
- `item.kode` → `(item.kode || '')`

### 12. `/pages/dashboard/MainDashboard.tsx`
**Fix:** Added null safety to project name comparisons
- `m.projectName?.toLowerCase()` → `(m.projectName || '').toLowerCase()`
- `project.namaProject.toLowerCase()` → `(project.namaProject || '').toLowerCase()`
- `m.refNo.includes()` → `(m.refNo || '').includes()`

### 13. `/components/finance/ProjectProfitabilityRanking.tsx`
**Fix:** Same as MainDashboard - project name comparison

### 14. `/components/project/ProjectRanking.tsx`
**Fix:** Same as MainDashboard - project name comparison

### 15. `/pages/finance/ProjectProfitLossPage.tsx`
**Fix:** Same as MainDashboard - project name comparison

### 16. `/pages/hr/AttendanceRecapPage.tsx`
**Fix:** Added null safety to employee name filter
- `e.name.toLowerCase()` → `(e.name || '').toLowerCase()`

## Pattern Used

All fixes follow the same pattern:
```typescript
// ❌ Before (can throw TypeError if property is undefined)
someValue.toLowerCase()

// ✅ After (safe - defaults to empty string)
(someValue || '').toLowerCase()
```

## React Router

Confirmed that no files are using 'react-router-dom' - all are correctly using 'react-router'.

## Testing Recommendations

1. Test all search/filter functionality across all pages
2. Verify that empty or undefined values don't cause errors
3. Test with minimal/incomplete data to ensure robustness
4. Check ApprovalCenterPage specifically as it was the main source of the error

## Prevention

To prevent similar issues in the future:
1. Always use optional chaining (`?.`) or null coalescing (`|| ''`) when working with potentially undefined data
2. Add TypeScript strict null checks if not already enabled
3. Consider creating utility filter functions that handle null safety automatically
