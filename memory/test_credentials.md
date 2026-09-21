# Test Credentials — TRIAS Skin & NTD (prototype)

App is client-only (React + localStorage). Login via the sign-in screen.

| Role | Email | Password | Scope |
|------|-------|----------|-------|
| Admin (all data) | admin@trias.health | Admin@123 | all |
| Health worker | joseph@trias.health | Health@123 | own |
| Supervisor (view only) | mary@trias.health | Health@123 | province |

## Useful data
- Female adult patient for Ante Natal testing: **PNG0000002** (Grace Waim) — also PNG0000006 (Rita Manam).
- Ante Natal entry route: `/patients/:id/antenatal?fac=<facility>&vt=<visitType>`
- Ante Natal dashboard: patient record page, "Ante Natal" tab (`/patients/:id?tab=antenatal`).
