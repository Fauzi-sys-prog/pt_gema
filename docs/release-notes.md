# Release Notes

## Bahasa Indonesia

PTGema ERP mendapatkan pembaruan besar pada arsitektur data dan integrasi modul lintas divisi. Update ini mencakup penambahan alur media, perluasan skema relasional, penyesuaian endpoint dashboard dan data, serta sinkronisasi antarmuka pada modul finance, project, procurement, inventory, HR, logistics, production, dan sales.

Di sisi teknis, pembaruan ini juga menambahkan migration Prisma baru, route backend untuk media handling, utilitas backfill, serta script smoke dan e2e untuk membantu validasi sistem. Dokumentasi repository juga diperluas agar stack, arsitektur, pendekatan keamanan, dan setup lokal lebih mudah dipahami oleh recruiter maupun engineer lain.

## Formal Recruiter Version

PTGema ERP has recently been enhanced with a broader backend-first alignment across multiple enterprise modules, including finance, procurement, projects, inventory, HR, logistics, production, and reporting. The update introduced additional relational schema migrations, server-side media handling flows, domain-specific backend refinements, frontend synchronization across operational pages, and verification support through smoke and end-to-end scripts.

In addition to feature and architecture work, the repository documentation was improved to better communicate the project’s technology stack, security-oriented design, system structure, and development workflow. This makes the project easier to evaluate from both an engineering and product perspective.

## Technical Changelog

- Added new Prisma migrations for media assets, invoice payment fields, and project labor entries.
- Added backend media routes and supporting storage integration.
- Refined dashboard, data, procurement, operations, inventory, project, quotation, and finance-related backend flows.
- Updated frontend contexts and multiple ERP module pages to align with backend changes.
- Added frontend smoke/e2e scripts for operational flow verification.
- Expanded README documentation with stack, architecture, security approach, repository structure, and local setup guidance.
- Added a personal branding documentation pack for recruiter-facing and portfolio use.
