/**
 * HMIS-style Visit Summary print/preview (DemClinic template):
 * clinic header → patient|clinician grid → "Visit Summary" → Q&A body → End of Report.
 * Responsive: two columns on laptop, stacked on mobile (and narrow preview).
 */

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const BRAND = "#376EEA";

const ICON_PHONE = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="${BRAND}" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>`;
const ICON_MAIL = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="${BRAND}" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/></svg>`;
const ICON_PIN = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="${BRAND}" d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>`;

const PRINT_STYLES = `
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.45;
    -webkit-text-size-adjust: 100%;
  }
  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: 16px 18px 28px;
  }

  /* ── Clinic header ── */
  .clinic-header { text-align: center; margin-bottom: 10px; }
  .clinic-name {
    margin: 0 0 8px;
    font-size: clamp(18px, 4.2vw, 22px);
    font-weight: 700;
    color: #111;
  }
  .clinic-contacts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px 16px;
    color: #444;
    font-size: clamp(10px, 2.6vw, 12px);
  }
  .clinic-contact {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .clinic-address {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 6px;
    margin-top: 6px;
    color: #444;
    font-size: clamp(10px, 2.6vw, 12px);
    text-align: left;
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
  }
  .icon { width: 12px; height: 12px; flex-shrink: 0; margin-top: 2px; }

  /* ── Thick blue rules (HMIS #376EEA) ── */
  .rule-thick {
    border: 0;
    height: 8px;
    background: ${BRAND};
    margin: 10px 0 0;
  }
  .rule-mid {
    border: 0;
    height: 4px;
    background: ${BRAND};
    margin: 10px 0 0;
  }

  /* ── Patient | Clinician grid ── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    padding: 12px 4px 4px;
  }
  .meta-col { min-width: 0; }
  .meta-row {
    display: grid;
    grid-template-columns: minmax(96px, 38%) 1fr;
    gap: 6px 10px;
    padding: 3px 0;
    align-items: start;
  }
  .meta-key {
    font-size: clamp(10px, 2.5vw, 11px);
    font-weight: 700;
    color: #111;
  }
  .meta-val {
    font-size: clamp(11px, 2.7vw, 12px);
    color: #222;
    word-break: break-word;
  }

  /* ── Report title ── */
  .report-title {
    text-align: center;
    font-size: clamp(14px, 3.4vw, 16px);
    font-weight: 700;
    margin: 16px 0 12px;
    color: #111;
  }

  /* ── Body Q&A (visit content) ── */
  .section {
    margin: 0 0 14px;
    break-inside: avoid;
  }
  .section-title {
    font-size: clamp(12px, 3vw, 13px);
    font-weight: 700;
    color: ${BRAND};
    margin: 0 0 4px;
  }
  .visit-meta {
    font-size: 10px;
    font-style: italic;
    color: #64748b;
    margin: 8px 0 2px;
  }
  .qa-label {
    font-size: clamp(10px, 2.5vw, 11px);
    font-weight: 700;
    color: #111;
    margin: 8px 0 1px;
  }
  .qa-value {
    font-size: clamp(11px, 2.7vw, 12px);
    color: #222;
    margin: 0 0 2px;
    white-space: pre-wrap;
  }
  .qa-value-muted {
    font-size: 10px;
    font-style: italic;
    color: #64748b;
    margin: 0 0 2px;
  }
  .qa-sub { margin-left: 8px; }
  .empty-body {
    text-align: center;
    color: #64748b;
    font-size: 12px;
    margin: 24px 0;
  }

  /* ── End of Report ── */
  .end-report {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 28px;
    color: #111;
    font-size: 12px;
    font-weight: 700;
  }
  .end-report::before,
  .end-report::after {
    content: "";
    flex: 1;
    max-width: 120px;
    border-top: 1px dashed #333;
  }
  .encounter-block {
    margin: 18px 0 8px;
    padding-top: 4px;
    break-inside: avoid;
  }
  .encounter-block + .encounter-block {
    border-top: 2px solid #bfdbfe;
    padding-top: 16px;
  }
  .encounter-heading {
    font-size: clamp(13px, 3.2vw, 15px);
    font-weight: 700;
    color: #111;
    margin: 0 0 6px;
  }
  .encounter-sub {
    font-size: 11px;
    color: #64748b;
    margin: 0 0 10px;
  }

  /* Mobile / narrow preview: stack columns */
  @media (max-width: 640px) {
    .page { padding: 12px 12px 24px; }
    .meta-grid {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .meta-row {
      grid-template-columns: minmax(110px, 42%) 1fr;
    }
    .clinic-contacts {
      flex-direction: column;
      gap: 4px;
    }
    .clinic-address {
      max-width: 100%;
    }
    .end-report::before,
    .end-report::after {
      max-width: 48px;
    }
  }

  /* Print: keep laptop two-column layout on paper */
  @media print {
    .page { max-width: none; padding: 0; }
    .meta-grid { grid-template-columns: 1fr 1fr; }
    .clinic-contacts { flex-direction: row; }
    a { color: inherit; text-decoration: none; }
  }
`;

function qaBlock(label, value, { muted = false } = {}) {
  if (value == null || value === "") return "";
  const cls = muted ? "qa-value-muted" : "qa-value";
  return `<div class="qa-label">${escapeHtml(label)}</div><div class="${cls}">${escapeHtml(value)}</div>`;
}

/** Flatten a feature summary object into label/value rows for print. */
export function flattenSummaryToQa(summary) {
  const rows = [];
  if (summary == null || summary === "") return rows;
  if (typeof summary === "string" || typeof summary === "number") {
    rows.push({ label: "Value", value: String(summary) });
    return rows;
  }
  const kind = summary.kind;
  if (kind === "history") {
    (summary.sections || []).forEach((sec) => {
      if (sec.label) rows.push({ label: sec.label, value: "", heading: true });
      (sec.items || []).forEach((item) => {
        if (item.value) rows.push({ label: item.label, value: item.value });
        else if (item.label) rows.push({ label: item.label, value: "", heading: true });
        (item.children || []).forEach((child) => {
          rows.push({ label: child.label, value: child.value, nested: true });
        });
      });
    });
    return rows;
  }
  if (kind === "lab") {
    (summary.lines || []).forEach((line) => rows.push({ label: line.label, value: line.value }));
    return rows;
  }
  if (kind === "meds") {
    (summary.rows || []).forEach((row) => {
      if (!row.name) return;
      const parts = [row.dosage, row.frequency, row.duration, row.date].filter((x) => x && x !== "—");
      rows.push({ label: row.name, value: parts.join(" · ") });
      if (row.advice) rows.push({ label: "Advice", value: row.advice, nested: true, muted: true });
    });
    return rows;
  }
  if (kind === "outcome") {
    if (summary.outcome) rows.push({ label: "Outcome", value: summary.outcome });
    if (summary.recommendations?.length) {
      rows.push({ label: "Recommendation", value: summary.recommendations.join(" · ") });
    }
    return rows;
  }
  if (kind === "notes") {
    (summary.lines || []).forEach((line, i) => {
      rows.push({ label: summary.lines.length > 1 ? `Note ${i + 1}` : "Note", value: line });
    });
    return rows;
  }
  if (kind === "exam") {
    (summary.exams || []).forEach((exam, idx) => {
      const head = [
        exam.occasion,
        exam.roundCount > 1 ? `Assessment ${exam.roundIndex + 1}` : "",
        exam.worker,
        exam.type,
      ]
        .filter(Boolean)
        .join(" · ");
      if (head) {
        rows.push({
          label: `Examination${(summary.exams || []).length > 1 ? ` ${idx + 1}` : ""}`,
          value: head,
          heading: true,
        });
      }
      (exam.findings || []).forEach((f) => rows.push({ label: "Finding", value: f }));
      if (exam.secondaryInfection) rows.push({ label: "Secondary infection", value: exam.secondaryInfection });
      (exam.extras || []).forEach((ex) => rows.push({ label: ex.label, value: ex.value }));
      if (exam.leprosy) {
        const lep = exam.leprosy;
        rows.push({ label: "Patches", value: String(lep.patches ?? "—") });
        rows.push({ label: "Nerves affected", value: String(lep.nerves ?? "—") });
        rows.push({
          label: "EHF",
          value: `Eyes L${lep.leftEye}/R${lep.rightEye} · Hands L${lep.leftHand}/R${lep.rightHand} · Feet L${lep.leftFoot}/R${lep.rightFoot}`,
        });
        rows.push({ label: "Total EHF / G2D", value: `${lep.ehf} / 12 · Grade ${lep.g2d}` });
      }
      if (exam.photos?.length) rows.push({ label: "Photographs", value: `${exam.photos.length} attached` });
    });
    return rows;
  }
  if (kind === "adherence") {
    rows.push({ label: "Adherence", value: "Recorded (see encounter for grid details)" });
    if (summary.diagnosis) rows.push({ label: "Diagnosis", value: summary.diagnosis });
    if (summary.startDate) rows.push({ label: "Start date", value: String(summary.startDate) });
    return rows;
  }
  if (kind === "hh-counts") {
    (summary.questions || []).forEach((q) => {
      const block = summary.data?.[q.k] || {};
      const parts = Object.entries(block)
        .filter(([, n]) => n !== "" && n != null)
        .map(([k, n]) => `${k}: ${n}`);
      if (parts.length) rows.push({ label: q.label || q.k, value: parts.join(" · ") });
    });
    return rows;
  }
  if (kind === "hh-leprosy") {
    rows.push({ label: "Household contacts", value: `${(summary.contacts || []).length} contact(s) recorded` });
    (summary.contacts || []).slice(0, 12).forEach((c, i) => {
      const name = c.name || c.contactName || `Contact ${i + 1}`;
      const detail = [c.relationship, c.outcome, c.examDate || c.administrationDate].filter(Boolean).join(" · ");
      rows.push({ label: name, value: detail || "—" });
    });
    return rows;
  }
  if (kind === "reactions") {
    (summary.assessments || []).forEach((a, i) => {
      rows.push({ label: `Reaction ${i + 1}`, value: a.type || "—" });
      (a.sections || []).forEach((sec) => {
        (sec.items || []).forEach((item) => {
          if (item.value) rows.push({ label: item.label, value: item.value, nested: true });
        });
      });
    });
    return rows;
  }
  return rows;
}

function renderQaRows(qaRows) {
  return qaRows
    .map((row) => {
      if (row.heading && !row.value) {
        return `<div class="section-title" style="margin-top:10px;font-size:12px">${escapeHtml(row.label)}</div>`;
      }
      if (row.heading && row.value) {
        return `<div class="qa-label">${escapeHtml(row.label)}</div><div class="qa-value-muted">${escapeHtml(row.value)}</div>`;
      }
      const wrapOpen = row.nested ? `<div class="qa-sub">` : "";
      const wrapClose = row.nested ? `</div>` : "";
      return `${wrapOpen}${qaBlock(row.label, row.value, { muted: row.muted })}${wrapClose}`;
    })
    .join("");
}

function metaRow(key, value) {
  if (value == null || value === "") return "";
  return `<div class="meta-row"><div class="meta-key">${escapeHtml(key)}</div><div class="meta-val">${escapeHtml(value)}</div></div>`;
}

/** HMIS-style age: 52Y0M5D */
export function formatAgeHmis(ageLabel) {
  if (!ageLabel || ageLabel === "—") return "";
  const m = String(ageLabel).match(/(\d+)\s*y\s*(\d+)\s*m\s*(\d+)\s*d/i);
  if (m) return `${m[1]}Y${m[2]}M${m[3]}D`;
  const yOnly = String(ageLabel).match(/^(\d+)\s*y/i);
  if (yOnly) return `${yOnly[1]}Y0M0D`;
  return String(ageLabel);
}

const FEATURE_SECTION_LABELS = [
  ["caseDetails", "Case details"],
  ["history", "Clinical history"],
  ["marks", "Examination"],
  ["lab", "Laboratory"],
  ["diagnosis", "Diagnosis"],
  ["drugs", "Medications"],
  ["adherence", "Medication Adherence"],
  ["household", "Household Contact Tracing"],
  ["reactions", "Lepra reactions"],
  ["notes", "Visit notes"],
  ["outcome", "Final case outcome"],
];

const labelize = (key) =>
  String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const valueToText = (v) => {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => (x != null && typeof x === "object" ? valueToText(x) : String(x ?? "").trim()))
      .filter(Boolean);
    return parts.join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([k, val]) => {
        const t = valueToText(val);
        return t ? `${labelize(k)}: ${t}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(v).trim();
};

/** Turn plain PHI form blobs into history-style summaries for print. */
function summaryFromSection(key, raw, encounter) {
  if (key === "diagnosis") {
    const dx = raw || encounter?.diagnosis;
    return dx ? String(dx) : "";
  }
  if (key === "outcome") {
    const outcome = (raw && typeof raw === "object" ? raw.outcome || raw.status : raw) || encounter?.outcome;
    if (!outcome || outcome === "Open" || outcome === "Active") return "";
    return { kind: "outcome", outcome: String(outcome), recommendations: [] };
  }
  if (key === "notes") {
    const lines = Array.isArray(raw)
      ? raw.map((n) => String(n || "").trim()).filter(Boolean)
      : String(raw || "").trim()
        ? [String(raw).trim()]
        : [];
    return lines.length ? { kind: "notes", lines } : "";
  }
  if (raw == null || raw === "") return "";
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (typeof raw !== "object") return "";

  const items = Object.entries(raw)
    .map(([k, v]) => {
      const text = valueToText(v);
      return text ? { label: labelize(k), value: text } : null;
    })
    .filter(Boolean);
  if (!items.length) return "";
  return { kind: "history", sections: [{ label: "", items }] };
}

/**
 * Build featureRows for visit summary from one or more encounters (appointments print).
 * @param {object[]} visits
 */
export function featureRowsFromVisits(visits = []) {
  const list = (visits || []).filter(Boolean);
  if (!list.length) return [];
  return FEATURE_SECTION_LABELS.map(([k, label]) => {
    const rows = list
      .map((e) => {
        const raw = e?.data?.[k];
        const s = summaryFromSection(k, raw, e);
        return s ? { e, s } : null;
      })
      .filter(Boolean);
    return rows.length ? { k, label, rows } : null;
  }).filter(Boolean);
}

/**
 * @param {object} args
 * @param {object} args.patient
 * @param {object} [args.clinic]  { name, phone, email, address }
 * @param {object} [args.clinician] { name, specialty, appointmentDate }
 * @param {string} args.diseaseName
 * @param {object} args.episode
 * @param {string} args.episodeCaption
 * @param {string} args.episodeDates
 * @param {Array} args.featureRows
 * @param {string} [args.worker]
 */
export function buildVisitSummaryPrintHtml({
  patient,
  clinic = {},
  clinician = {},
  diseaseName,
  episode,
  episodeCaption,
  episodeDates,
  featureRows = [],
  worker = "",
}) {
  const clinicName = clinic.name || "Clinic";
  const ageHmis = formatAgeHmis(patient?.ageLabel);
  const genderAge = [patient?.sex, ageHmis].filter(Boolean).join(" / ");
  const phoneEmail = [patient?.phone, patient?.email].filter(Boolean).join(" / ");

  const leftMeta =
    metaRow("Patient Name", patient?.name || "—") +
    metaRow("Patient ID", patient?.patientCode || patient?.id || "—") +
    metaRow("Gender / Age", genderAge || "—") +
    metaRow("Phone / Email", phoneEmail || "—");

  const rightMeta =
    metaRow("Clinician Name", clinician.name || worker || "—") +
    metaRow("Speciality", clinician.specialty || "—") +
    metaRow("Appointment Date", clinician.appointmentDate || "—");

  let contacts = "";
  if (clinic.phone) {
    contacts += `<span class="clinic-contact">${ICON_PHONE}<span>${escapeHtml(clinic.phone)}</span></span>`;
  }
  if (clinic.email) {
    contacts += `<span class="clinic-contact">${ICON_MAIL}<span>${escapeHtml(clinic.email)}</span></span>`;
  }

  let addressHtml = "";
  if (clinic.address) {
    addressHtml = `<div class="clinic-address">${ICON_PIN}<span>${escapeHtml(clinic.address)}</span></div>`;
  }

  let body = "";
  let included = 0;

  if (episodeCaption || episodeDates || episode?.diagnosis || episode?.outcome) {
    included += 1;
    body += `<div class="section"><div class="section-title">${escapeHtml(diseaseName || "Condition")} episode</div>`;
    if (episodeCaption) body += qaBlock("Episode", episodeCaption);
    if (episodeDates) body += qaBlock("Dates", episodeDates);
    if (episode?.diagnosis) body += qaBlock("Diagnosis", episode.diagnosis);
    if (episode?.outcome) body += qaBlock("Outcome", episode.outcome);
    body += `</div>`;
  }

  for (const feature of featureRows) {
    const rows = feature.rows || [];
    if (!rows.length) continue;
    included += 1;
    body += `<div class="section"><div class="section-title">${escapeHtml(feature.label)}</div>`;
    rows.forEach(({ e, s }, idx) => {
      const when = e?.date || e?.editedAt || "";
      const meta = [when, e?.worker, e?.type, e?.facility].filter(Boolean).join(" · ");
      if (meta) {
        body += `<p class="visit-meta">${escapeHtml(meta)}${rows.length > 1 ? ` · Entry ${idx + 1}` : ""}</p>`;
      }
      body += renderQaRows(flattenSummaryToQa(s));
    });
    body += `</div>`;
  }

  if (!included) {
    body = `<p class="empty-body">No completed visit data for this episode yet.</p>`;
  }

  const title = `${patient?.name || "Patient"} — Visit Summary`;

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_STYLES}</style></head><body>
    <div class="page">
      <header class="clinic-header">
        <h1 class="clinic-name">${escapeHtml(clinicName)}</h1>
        ${contacts ? `<div class="clinic-contacts">${contacts}</div>` : ""}
        ${addressHtml}
      </header>

      <hr class="rule-thick" />
      <div class="meta-grid">
        <div class="meta-col">${leftMeta}</div>
        <div class="meta-col">${rightMeta}</div>
      </div>
      <hr class="rule-mid" />

      <h2 class="report-title">Visit Summary</h2>
      ${body}

      <div class="end-report">End of Report</div>
    </div>
    </body></html>`;
}

function renderFeatureBody(featureRows = []) {
  let body = "";
  let included = 0;
  for (const feature of featureRows) {
    const rows = feature.rows || [];
    if (!rows.length) continue;
    included += 1;
    body += `<div class="section"><div class="section-title">${escapeHtml(feature.label)}</div>`;
    rows.forEach(({ e, s }, idx) => {
      const when = e?.date || e?.editedAt || "";
      const meta = [when, e?.worker, e?.type, e?.facility].filter(Boolean).join(" · ");
      if (meta) {
        body += `<p class="visit-meta">${escapeHtml(meta)}${rows.length > 1 ? ` · Entry ${idx + 1}` : ""}</p>`;
      }
      body += renderQaRows(flattenSummaryToQa(s));
    });
    body += `</div>`;
  }
  return { body, included };
}

/**
 * One DemClinic header + all patient encounters stacked (Patients list print).
 * @param {object} args
 * @param {object} args.patient
 * @param {object} [args.clinic]
 * @param {object} [args.clinician]
 * @param {Array<{ diseaseName: string, encounter: object, featureRows?: Array, caption?: string }>} args.encounters
 */
export function buildPatientEncountersPrintHtml({
  patient,
  clinic = {},
  clinician = {},
  encounters = [],
  worker = "",
}) {
  const clinicName = clinic.name || "Clinic";
  const ageHmis = formatAgeHmis(patient?.ageLabel);
  const genderAge = [patient?.sex, ageHmis].filter(Boolean).join(" / ");
  const phoneEmail = [patient?.phone, patient?.email].filter(Boolean).join(" / ");

  const leftMeta =
    metaRow("Patient Name", patient?.name || "—") +
    metaRow("Patient ID", patient?.patientCode || patient?.id || "—") +
    metaRow("Gender / Age", genderAge || "—") +
    metaRow("Phone / Email", phoneEmail || "—");

  const rightMeta =
    metaRow("Clinician Name", clinician.name || worker || "—") +
    metaRow("Speciality", clinician.specialty || "—") +
    metaRow("Encounters", String(encounters.length || 0));

  let contacts = "";
  if (clinic.phone) {
    contacts += `<span class="clinic-contact">${ICON_PHONE}<span>${escapeHtml(clinic.phone)}</span></span>`;
  }
  if (clinic.email) {
    contacts += `<span class="clinic-contact">${ICON_MAIL}<span>${escapeHtml(clinic.email)}</span></span>`;
  }

  let addressHtml = "";
  if (clinic.address) {
    addressHtml = `<div class="clinic-address">${ICON_PIN}<span>${escapeHtml(clinic.address)}</span></div>`;
  }

  let body = "";
  if (!encounters.length) {
    body = `<p class="empty-body">No encounters recorded for this patient.</p>`;
  } else {
    encounters.forEach((block, i) => {
      const e = block.encounter || {};
      const diseaseName = block.diseaseName || e.disease || `Encounter ${i + 1}`;
      const heading = `Encounter ${i + 1} — ${diseaseName}`;
      const sub = [
        e.date || "",
        e.type || "",
        e.facility || "",
        e.worker || "",
        e.diagnosis || "",
        e.outcome && e.outcome !== "Open" ? e.outcome : "",
      ]
        .filter(Boolean)
        .join(" · ");

      body += `<div class="encounter-block">`;
      body += `<h3 class="encounter-heading">${escapeHtml(heading)}</h3>`;
      if (sub) body += `<p class="encounter-sub">${escapeHtml(sub)}</p>`;
      if (block.caption) body += qaBlock("Visit", block.caption);

      const featureRows = block.featureRows || featureRowsFromVisits([e]);
      const { body: featureBody, included } = renderFeatureBody(featureRows);
      if (included) {
        body += featureBody;
      } else if (e.diagnosis || (e.outcome && e.outcome !== "Open")) {
        if (e.diagnosis) body += qaBlock("Diagnosis", e.diagnosis);
        if (e.outcome && e.outcome !== "Open") body += qaBlock("Outcome", e.outcome);
      } else {
        body += `<p class="qa-value-muted">No clinical details recorded for this encounter.</p>`;
      }
      body += `</div>`;
    });
  }

  const title = `${patient?.name || "Patient"} — Encounter summary`;

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_STYLES}</style></head><body>
    <div class="page">
      <header class="clinic-header">
        <h1 class="clinic-name">${escapeHtml(clinicName)}</h1>
        ${contacts ? `<div class="clinic-contacts">${contacts}</div>` : ""}
        ${addressHtml}
      </header>

      <hr class="rule-thick" />
      <div class="meta-grid">
        <div class="meta-col">${leftMeta}</div>
        <div class="meta-col">${rightMeta}</div>
      </div>
      <hr class="rule-mid" />

      <h2 class="report-title">Visit Summary</h2>
      ${body}

      <div class="end-report">End of Report</div>
    </div>
    </body></html>`;
}

/** Print via hidden iframe (no blank about:blank popup). */
export function printHtmlDocument(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Print");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => window.setTimeout(() => iframe.remove(), 1500);
  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  };

  if (doc.readyState === "complete") {
    window.setTimeout(triggerPrint, 200);
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 200);
    window.setTimeout(triggerPrint, 500);
  }
  return true;
}
