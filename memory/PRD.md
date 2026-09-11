# TRIAS Skin & NTD — PRD

## Original problem statement
Build a device-responsive, offline-first PWA for managing Neglected Tropical Diseases (NTDs) for Papua New Guinea programme use. Scope: Authentication, Admin (user creation + data access control, client branding/logo), Patients (rapid registration + access-controlled list), Treatment (disease-specific encounter flows, encounter-wise compounded clinical record, 5 diseases starting with Scabies), MIS (KPIs with date/province/district/village/disease filters), PWA install, responsive desktop/tablet/mobile. Detailed Scabies Patient Encounter Chart v1.0 supplied covering suspect screening, clinical history, interactive body chart, lab/diagnostics, IACS diagnosis, decision-support drug catalogue with weight-based ivermectin dosing, household contact tracing, visit notes, treatment outcome, recommendations and colour-coded clinical alerts. Data model: PATIENT → ENCOUNTER → (screen/history/assessment/lab/dx/treatment/notes/outcome) and PATIENT → HOUSEHOLD → CONTACTS, with a Scabies Episode ID. **User requested UX design/prototype first before development go-ahead.**

## User choices (confirmed)
1. Clickable UI prototype — real screens, mock data, no backend
2. JWT email/password authentication (mocked in prototype)
3. Scabies module full depth + Admin, Patients, MIS, PWA
4. IndexedDB local-first + background sync to cloud (concept demonstrated)
5. No branding preference — design decided by the agent

## Architecture (current: prototype)
- React 19 + CRA/craco, Tailwind, shadcn/ui, recharts, lucide-react, sonner
- All state in a React context (`/app/frontend/src/store.js`) persisted to `localStorage` key `trias.state.v1`
- Mock domain data in `/app/frontend/src/mock/data.js`
- PWA: `public/manifest.json`, `public/sw.js` (cache-first-fallback service worker), `public/icon.svg`
- No backend / no MongoDB used yet (by design for design sign-off)

## Design system
Swiss high-contrast clinical: Work Sans headings + IBM Plex Sans body, Medical Blue `#0F52BA`, flat white surfaces with 1px borders (no shadows/glass), 48px minimum tap targets, alert colours red/orange/green, left-aligned dense layouts, bottom nav on mobile, sticky wizard footer.

## User personas
- **Community health worker (low skill, field, offline)** — quick patient registration, guided 9-step wizard, big tap targets
- **Facility supervisor** — facility-wide view, often view-only
- **Programme admin / M&E** — user + access management, branding, MIS indicators

## Core requirements (static)
Auth · Admin & access control · Patient registry · Disease-specific encounter flows · MIS/KPIs · Offline-first sync · PWA · Full responsiveness

## Implemented — 2026-06 (prototype, verified by testing agent 100%)
- Login / Register with 3 demo roles and demo-account panel
- Role-based data scoping (own / facility / all) + edit-permission gating (view-only banner, disabled actions)
- Admin: user table with live scope dropdown, edit/active toggles, create-user dialog, client name/subtitle/logo branding, reset demo data
- Patients: search (name/patient ID/episode ID), village + classification filters, access-scoped list, sync chips
- Quick registration: identity, geography cascade (province→district→village), household link, live ivermectin/pregnancy contraindication alerts, auto Patient ID + Scabies Episode ID
- Patient record: encounter timeline (compounded view), patient header, disease module grid (Scabies live, 4 locked), household coverage card
- Scabies 9-step wizard: suspect screening with system-generated suspect flag, clinical history, interactive SVG body chart (front/back, lesion type/severity/number/evidence, crusted assessment), lab/diagnostics, IACS diagnosis + ICD-10, drug catalogue with weight-based ivermectin dose calculator and <15kg/pregnancy blocks, household & contact tracing with coverage %, visit notes with structured snippets + SOAP draft generator, treatment outcome with initial-vs-follow-up table, auto recommendations, live urgent/review/routine alerts
- MIS dashboard: 8 KPIs, 4 charts (monthly trend, IACS mix, village hotspots, age bands), 3 alert panels, 5 filters
- Sync page: local queue, sync-now, device storage counters, offline state
- PWA manifest + service worker + install guidance; responsive at 390px, 820px and desktop

## Iteration 2 — 2026-06 (client-requested prototype changes, verified 100%)
- Encounter record redesigned: 9 sections stacked vertically as collapsible cards (no side-by-side split, no step wizard / Next-Back)
- Constant sticky **Save** + **Save & close** available at any time and from any section, with a "Last saved" indicator; saving an existing encounter upserts instead of duplicating
- "New encounter" now opens a **disease chooser** (all 5 diseases; existing vs new disease record)
- Patient record shows **only the diseases added for that patient** (encounter counts + sync state)
- New **consolidated per-disease view** (`/patients/:id/disease/:diseaseId`): every feature (screening, history, body assessment, lab, diagnosis, drugs, household, notes, outcome) compounded across all encounters for that disease, with per-encounter grouping and edit links
- Non-scabies diseases use a generic flow (lab, diagnosis, drugs, notes, outcome) until their programme-specific forms are configured

## Iteration 3 — 2026-06 (client-requested changes, verified 44/44)
- Login screen: self-registration removed; accounts are created only in Admin
- Admin: "Register new user" dialog, per-user **password reset** (temp password toast), **inactivate/activate** (deactivated users cannot sign in), data-access scope management
- Admin: **presenting complaints/symptoms library** (30 seeded patient-voice complaints, add/remove) that drives the Suspect feature
- Admin: **programme rule** for "lost to follow-up after N days from drug end date", applied to patient tags
- **Suspect screening as its own feature** (`/patients/:id/suspect`): complaint checklist, photo capture, choose one of the 5 NTDs or None, then start the chosen disease flow. Screening history shown on the patient record; the encounter shows a read-only linked-suspect panel and no longer contains the old screening section (8 sections for scabies)
- Patient list: **Treatment Outcome filter** + outcome badge (incl. auto "Lost to follow-up") and **patient photo** on each card; photos also captured in the encounter assessment and shown in the consolidated view
- Registration: scabies history flags removed; **email, blood group, patient photo and fingerprint template** (mock scanner) added

## Iteration 4 — 2026-06 (client-requested changes, verified 39/39)
- **Admin restructured into tabs**: Users · Facilities · Masters (Masters sub-tabs: Drugs, Symptoms, Visit type, Programme rules, Client & branding)
- **Users**: photo upload added, facility removed (workers are mobile), data access changed to Own / **All records in Province** / All programme — province scoping enforced in patient lists and MIS
- **Facilities master**: list + create (Name, Country, Province, District, Village) with cascade; feeds the encounter picker
- **New encounter popup** now asks for **Facility + Visit type** before the disease flow; opening an encounter URL without them shows a blocking picker
- **Programme rules**: lost-to-follow-up days set **separately per disease** (Scabies 30, Yaws 60, Buruli 90, LF 180, Leprosy 180)
- **Patient card**: phone + WhatsApp quick-contact icons (card converted from link to click handler to keep HTML valid)
- **Patient page UX**: actions on their own line, full-width **Demographic** panel with photo (Facility, Health worker, Pregnancy, Lactating, Household, Treatment end date and Outcome removed)
- **Registration**: Date of birth added with two-way DOB↔Age auto-calculation (age→DOB uses the registration date)

## Iteration 5 — 2026-06 (density pass)
- Patients list compacted: title + search + filter icon + Register on one line, filters collapse behind an icon (with active-count badge and Clear), ~6 patient cards visible above the fold
- Patient cards now show **DOB and blood group**
- New shared `PatientHeader` component: photo, name, status, IDs and all demographics inline on one strip — used on both the patient record page (actions moved inside it) and the encounter page, freeing vertical space for clinical detail

## Iteration 6 — 2026-06 (final spec document implemented, verified 40+ assertions, zero issues)
Source: client's "TRIAS Skin and NTD App - Final.docx".
- **All 5 NTD flows are now spec-driven** from `/app/frontend/src/mock/specs.js` (DISEASE_SPECS). Each disease has its own case details, clinical history questions, lesion-code body chart, laboratory panel, diagnosis list, drug catalogue, household block, outcomes and recommendations. One engine (`FormRenderer`) renders every field type, so new diseases/fields are config-only.
- **Body charting** rebuilt as code-then-region tagging: Scabies (B/P/V/PU/C/E/NO), Yaws (T/U/P/J/BC), LF stages S1–S7 with per-lesion secondary-infection, Buruli PA/PN/PPl/O/NU with per-lesion Category 1–3, Leprosy PT/N/CL/BL/UL.
- **Clinical intelligence**: Leprosy EHF + WHO G2D auto-scoring with Grade-2 urgent alert; Leprosy PB/MB auto-classification from patches/nerves/slit-skin; Yaws primary/secondary/tertiary auto-staging; weight-based dosing per drug (verified: ivermectin 4.2mg, DEC 126mg, rifampicin 210mg, clarithromycin 157.5mg, azithromycin 630mg at 21kg); "No <disease>" diagnosis auto-sets the matching outcome.
- **Adherence schedules**: Buruli 8 weekly dated cells, Leprosy 12 monthly cells, cycle taken/not-taken/blank, Extend schedule, and Leprosy Restart regimen (recommended after >3 missed).
- **Household contact tracing** per disease: age/sex group counts (male/female × child/adult), preventive-prophylaxis counts per drug, and an editable contact register (name, age, gender, relationship, status, consent, prophylaxis, date).
- **Suspect feature**: new 31-symptom library and 7 suspect options including "Suspected Other NTDs" and "Suspect Non-NTDs Skin Condition".
- **Patient record redesigned**: tabs (All visits / Suspect / one per condition), collapsible left demographic + clinical-summary panel, per-visit expandable feature summaries, and an Add-encounter popup capturing location, date, clinician, visit type, referral and target flow.
- **Patient cards**: DOB as dd-MMM-yyyy, patient ID, diagnosis, last encounter date, encounter status (New/Draft/Complete).
- **Registration**: first/middle/last name, consent (No / By paper / By verbal), address by origin or residency.
- **Admin**: new **Regiment** master (regimen builder with condition, diagnosis, age and weight criteria — criteria stored, auto-population into the drugs section is still on the backlog).
- **MIS**: filters behind an icon, Clinician filter, Custom date range, and a graph/table toggle.

## Iteration 7 — 2026-06 (patient/encounter view toggle, verified 12/12)
- Patients page now has a **Patient view / Encounter view** toggle. Encounter view lists encounters for the selected period with patient photo, name, disease, status, visit type, clinician, facility, date/time, encounter ID and diagnosis; clicking a row opens that encounter for editing.
- **Duration navigator**: Day (default, anchored on today) · Week · Month · Quarter · Year · All · Custom. The selected range is displayed (dd-MMM-yyyy) with back/forward arrows that step by the chosen unit; All shows "All time" and Custom exposes from/to date pickers (both hide the arrows).
- **Today button** is unhighlighted while on today and becomes highlighted once the user navigates away; clicking it returns to today.
- Encounter view respects the signed-in user's data-access scope (admin 5, Madang supervisor 5, own-records worker 3 encounters).

## Backlog
### P0 (after design sign-off)
- FastAPI + MongoDB backend; real JWT auth with bcrypt (via integration_expert playbook)
- Server-side enforcement of access control scopes
- Real offline layer: IndexedDB (Dexie) + delta sync queue with conflict resolution
- Persist full encounter payloads (all 9 sections) and household/contact entities
### P1 (from the final spec, not yet built)
- Auto-populate the drugs section from matching Regiment criteria (age/weight/diagnosis)
- Per-finger/lesion measurement capture, LF limb-volume measurements and MMDP self-care scheduling
- Full MIS indicator set per disease (cohort treatment-outcome tables, G2D rate, contact-tracing coverage)
- Referral workflow with referral-out/referral-in tracking between facilities

### P1
- Logo upload to object storage; configurable drug catalogue / dose-rounding per country protocol
- Household member CRUD; contact follow-up scheduling and reminders
- MIS export (CSV/PDF) and real date-range aggregation pipelines
### P2
- Remaining 4 diseases (Yaws, Buruli Ulcer, LF, Leprosy) with configurable form engine
- AI SOAP note via LLM; photo capture of lesions; map-based hotspot view; audit trail

## Next tasks
1. Client review of this prototype and design sign-off
2. On go-ahead: backend + auth integration, then wire the wizard to persisted encounters
3. Replace localStorage with IndexedDB sync engine
