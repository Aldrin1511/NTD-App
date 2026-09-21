# Test Credentials — TRIAS Skin & NTD (prototype)

App is client-only (React + localStorage). Login via the sign-in screen.

| Role | Email | Password | Scope |
|------|-------|----------|-------|
| Admin (all data) | admin@trias.health | Admin@123 | all |
| Health worker | joseph@trias.health | Health@123 | own |
| Supervisor (view only) | mary@trias.health | Health@123 | province |

## Useful patients / routes
- Ante Natal (female adult): **PNG0000002** (Grace Waim). Route: `/patients/:id/antenatal`
- Well Baby / Malnutrition (child): **PNG0000004** (Lucy Sipa). Routes: `/patients/:id/wellbaby`, `/patients/:id/malnutrition`
- Condition tabs on record: `/patients/:id?tab=<antenatal|wellbaby|malnutrition|scabies>`
- School Health (top-level): `/school-health` and `/school-health/:visitId`
- Admin Masters: `/admin` → Masters tab → Immunization schedule / Lab master / Feature config

## Notes for testers
- New condition encounters route to `/patients/:id/<wellbaby|malnutrition|antenatal>`, NOT `/patients/:id/encounter/:disease`.
- `ChoiceRow` toggles off on a second click — don't re-click a default option.
- Malnutrition case types: New / Restart / Transfer in.
- Growth chart uses representative WHO/CDC/IAP curves (not official tables).
