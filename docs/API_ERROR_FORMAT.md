# API Error Format

Mulai saat ini, middleware backend mengembalikan error dengan format standar:

```json
{
  "code": "SOME_ERROR_CODE",
  "message": "Human-readable message",
  "error": "Legacy compatibility value",
  "details": {}
}
```

Keterangan:
- `code`: kode error stabil untuk handling di FE.
- `message`: pesan utama untuk user/log.
- `error`: kompatibilitas ke contract lama FE yang masih membaca field `error`.
- `details`: opsional, dipakai untuk validasi (contoh Zod `flatten()`).

Contoh kode yang sudah distandarkan di middleware:
- `AUTH_REQUIRED`
- `AUTH_FORMAT_INVALID`
- `TOKEN_PAYLOAD_INVALID`
- `TOKEN_REVOKED`
- `TOKEN_LOGOUT_ALL_EXPIRED`
- `ACCOUNT_INACTIVE`
- `TOKEN_INVALID`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `INVALID_JSON`
- `CORS_DENIED`
- `INTERNAL_ERROR`

## Rollout Status

Sudah menerapkan `sendError` (route-level):
- `backend/src/routes/data.ts`
- `backend/src/routes/projects.ts`
- `backend/src/routes/quotations.ts`
- `backend/src/routes/dataCollections.ts`
- `backend/src/routes/procurement.ts`
- `backend/src/routes/operations.ts`
- `backend/src/routes/hr.ts`
- `backend/src/routes/resourceAliases.ts`

Sudah menerapkan `sendError` (cross-cutting middleware):
- `backend/src/middlewares/auth.ts`
- `backend/src/middlewares/errorHandler.ts`

Catatan:
- Kontrak lama FE tetap aman karena field `error` masih dikirim.
- Field baru `code` dan `message` sudah bisa dipakai FE secara bertahap.
