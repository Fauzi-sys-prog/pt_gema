# PTGema ERP

![Security Fast Gate](https://github.com/Fauzi-sys-prog/pt_gema/actions/workflows/security-fast.yml/badge.svg)

PTGema ERP is a full-stack internal ERP platform for managing operational workflows across project management, quotation, procurement, inventory, logistics, production, HR, finance, and audit reporting in a single system.

## GitHub Description

Use this short description in the GitHub repository settings:

`Full-stack ERP platform built with React, Vite, Express, Prisma, and PostgreSQL for project, finance, procurement, inventory, HR, and logistics operations.`

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Local infrastructure: Docker Compose
- Authentication: JWT-based auth
- Validation and security support: backend middleware, rate limiting, role checks, smoke/security scripts

## Why This Architecture

This project uses a backend-first architecture for business-critical workflows.

- Frontend handles presentation, form state, user interactions, and API consumption.
- Backend owns authentication, authorization, validation, approval logic, relational integrity, and persistence.
- Database access is handled through Prisma to keep data access consistent and type-safe.

This structure is intentional:

- to prevent business rules from leaking into the client
- to reduce the risk of payload tampering from the browser
- to keep approval and finance rules enforced on the server
- to make domain modules easier to extend and maintain

## Security Approach

Security-sensitive rules are enforced in the backend, not only in the UI.

- Auth is checked by middleware before protected routes are executed.
- Role-based access is enforced on the server.
- Approval and finance actions are validated server-side.
- Rate limiting is applied to sensitive auth flows.
- Smoke and security scripts are used to verify that access control and payload handling behave as expected.

This reduces exposure to:

- broken access control
- privilege escalation
- payload tampering
- insecure direct object reference patterns
- brute-force login abuse
- unsafe direct database mutations from the client

## Repository Structure

### Backend

- [backend/src/app.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/app.ts): Express app bootstrap and route registration
- [backend/src/routes](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes): domain-based API routes
- [backend/src/middlewares](/Users/macbook/Downloads/Ptgema-main%202/backend/src/middlewares): auth and rate limiting
- [backend/prisma/schema.prisma](/Users/macbook/Downloads/Ptgema-main%202/backend/prisma/schema.prisma): database schema
- [backend/prisma/migrations](/Users/macbook/Downloads/Ptgema-main%202/backend/prisma/migrations): tracked schema changes

Examples of domain route modules:

- [backend/src/routes/projects.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/projects.ts)
- [backend/src/routes/quotations.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/quotations.ts)
- [backend/src/routes/procurement.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/procurement.ts)
- [backend/src/routes/inventory.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/inventory.ts)
- [backend/src/routes/dashboard.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/dashboard.ts)
- [backend/src/routes/media.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/routes/media.ts)

### Frontend

- [frontend/src/contexts/AppContext.tsx](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/contexts/AppContext.tsx): shared app data flow and API integration layer
- [frontend/src/contexts/AuthContext.tsx](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/contexts/AuthContext.tsx): auth state and session handling
- [frontend/src/pages](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/pages): module pages by business domain
- [frontend/src/components](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/components): reusable UI components
- [frontend/src/utils/normalizeEntityRows.ts](/Users/macbook/Downloads/Ptgema-main%202/frontend/src/utils/normalizeEntityRows.ts): shared client-side normalization helper

## Request Flow

The main request flow is:

1. A user interacts with a React page or form.
2. The frontend sends a request through app/auth context or page-level handlers.
3. The backend receives the request at a domain route.
4. Middleware validates auth, permissions, and request constraints.
5. Domain logic reads or writes data through Prisma.
6. PostgreSQL stores the final state.
7. The frontend renders the response.

This keeps UI concerns and business rules separated while preserving a clean audit trail for sensitive operations.

## Local Development

The project can be started with Docker Compose.

### Services

- `postgres`: PostgreSQL 16
- `backend`: Express + Prisma backend on port `3000`
- `frontend`: built frontend served on port `5173`
- `prisma-studio`: Prisma Studio on port `5555`

### Start

```bash
docker compose up --build
```

### Default local ports

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Prisma Studio: `http://localhost:5555`

## Seed Accounts

Local seed users are configured through [backend/.env.seed.example](/Users/macbook/Downloads/Ptgema-main%202/backend/.env.seed.example) and the local `backend/.env.seed` file.

These accounts are intended for development and smoke validation only.

## Verification

This repository includes smoke checks and security-oriented backend scripts to validate core system readiness.

Examples:

- [backend/src/smokeSidebarBackend.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/smokeSidebarBackend.ts)
- [backend/src/smokeApprovalSecurity.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/smokeApprovalSecurity.ts)
- [backend/src/smokePayloadTampering.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/smokePayloadTampering.ts)
- [backend/src/smokeFinanceActionMatrix.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/smokeFinanceActionMatrix.ts)
- [backend/src/smokeFinanceRoleMatrix.ts](/Users/macbook/Downloads/Ptgema-main%202/backend/src/smokeFinanceRoleMatrix.ts)

## CI

CI workflow `Security Fast Gate` is defined in:

- `.github/workflows/security-fast.yml`

The badge above points to repository `Fauzi-sys-prog/pt_gema`.
