# FE -> BE Endpoint Matrix

Tanggal cek: 2026-03-05

## Ringkasan
- Total page FE (`frontend/src/pages/*.tsx`): **92**
- Page yang terhubung data/auth (`api.*` atau `useApp/useAuth/FinanceSimpleCrudPage`): **90**
- Page statis (guide/manual, tidak perlu endpoint): **2**
  - `frontend/src/pages/production/ProductionGuidePage.tsx`
  - `frontend/src/pages/guide/GuideHubPage.tsx`
- Total signature endpoint yang dipakai FE (`METHOD + PATH` unik): **66**
- Status coverage endpoint FE di backend: **66/66 covered**

## A. Endpoint Langsung (non-generic)

### Auth
- `POST /auth/login` -> `backend/src/routes/auth.ts`
- `POST /auth/logout` -> `backend/src/routes/auth.ts`

### User Management
- `GET /users` -> `backend/src/routes/users.ts`
- `POST /users` -> `backend/src/routes/users.ts`

### Projects
- `GET /projects` -> `backend/src/routes/projects.ts`
- `PUT /projects/bulk` -> `backend/src/routes/projects.ts`

### Data Collections
- `GET /data-collections` -> `backend/src/routes/dataCollections.ts`
- `POST /data-collections` -> `backend/src/routes/dataCollections.ts`

### Quotations
- `GET /quotations` -> `backend/src/routes/quotations.ts`
- `GET /quotations/sample` -> `backend/src/routes/quotations.ts`
- `POST /quotations` -> `backend/src/routes/quotations.ts`

### Procurement Domain Routes
- `GET /purchase-orders` -> `backend/src/routes/procurement.ts`
- `PUT /purchase-orders/bulk` -> `backend/src/routes/procurement.ts`
- `GET /receivings` -> `backend/src/routes/procurement.ts`
- `PUT /receivings/bulk` -> `backend/src/routes/procurement.ts`

### Operations Domain Routes
- `GET /work-orders` -> `backend/src/routes/operations.ts`
- `PUT /work-orders/bulk` -> `backend/src/routes/operations.ts`
- `GET /stock-ins` -> `backend/src/routes/operations.ts`
- `PUT /stock-ins/bulk` -> `backend/src/routes/operations.ts`
- `GET /stock-outs` -> `backend/src/routes/operations.ts`
- `PUT /stock-outs/bulk` -> `backend/src/routes/operations.ts`
- `GET /stock-movements` -> `backend/src/routes/operations.ts`
- `PUT /stock-movements/bulk` -> `backend/src/routes/operations.ts`
- `GET /surat-jalan` -> `backend/src/routes/operations.ts`
- `PUT /surat-jalan/bulk` -> `backend/src/routes/operations.ts`
- `GET /material-requests` -> `backend/src/routes/operations.ts`
- `PUT /material-requests/bulk` -> `backend/src/routes/operations.ts`

### HR Domain Routes
- `GET /employees` -> `backend/src/routes/hr.ts`
- `PUT /employees/bulk` -> `backend/src/routes/hr.ts`
- `GET /attendances` -> `backend/src/routes/hr.ts`
- `PUT /attendances/bulk` -> `backend/src/routes/hr.ts`

## B. Generic Resource Endpoints (`/data/:resource`)
Ditangani oleh: `backend/src/routes/data.ts`

### GET dipakai FE
- `GET /archive-registry`
- `GET /assets`
- `GET /attendances`
- `GET /audit-logs`
- `GET /data/berita-acara`
- `GET /data/customer-invoices`
- `GET /employees`
- `GET /hr-leaves`
- `GET /hr-online-status`
- `GET /invoices`
- `GET /maintenances`
- `GET /payrolls`
- `GET /data/stock-ins`
- `GET /data/stock-items`
- `GET /data/stock-movements`
- `GET /data/stock-opnames`
- `GET /data/stock-outs`
- `GET /data/surat-jalan`
- `GET /surat-keluar`
- `GET /surat-masuk`
- `GET /data/vendor-invoices`
- `GET /data/work-orders`
- `GET /data/working-expense-sheets`

### POST dipakai FE
- `POST /audit-logs`
- `POST /hr-leaves`
- `POST /invoices`
- `POST /data/production-reports`
- `POST /data/purchase-orders`
- `POST /data/receivings`
- `POST /data/stock-ins`
- `POST /data/stock-items`
- `POST /data/stock-movements`
- `POST /data/stock-opnames`
- `POST /data/stock-outs`
- `POST /data/surat-jalan`

## C. Catatan Penting
- FE kamu menggunakan **kombinasi endpoint domain spesifik + generic data engine**.
- Walau jumlah file route sedikit, coverage tetap penuh karena pattern route dinamis + resource delegate mapping.
- Untuk kebutuhan FE saat ini, **tidak ada signature endpoint yang belum tersedia**.
