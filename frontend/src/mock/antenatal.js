import { parseDate, localISODate } from "@/mock/specs";

/** ---------------------------------------------------------------------------
 * Ante Natal (ANC) configuration + helpers.
 * Kept self-contained so it plugs into the existing encounter store
 * (encounters with disease: "antenatal") without touching the NTD pipeline.
 * ------------------------------------------------------------------------- */

export const ANTENATAL_ID = "antenatal";
export const ANTENATAL_NAME = "Ante Natal";
const DAY = 86400000;

export const addDays = (date, n) => {
  const d = parseDate(date);
  if (!d) return null;
  return new Date(d.getTime() + n * DAY);
};

export const daysBetween = (from, to) => {
  const a = parseDate(from);
  const b = parseDate(to) || new Date();
  if (!a || !b) return null;
  return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / DAY);
};

export const gaFromDays = (days) => {
  if (days == null || Number.isNaN(days) || days < 0) return null;
  const w = Math.floor(days / 7);
  const d = days % 7;
  return { weeks: w, days: d, totalDays: days, text: `${w}w ${d}d` };
};

/** EDD by Naegele's rule: LMP + 280 days */
export const eddFromLmp = (lmp) => {
  const e = addDays(lmp, 280);
  return e ? localISODate(e) : "";
};

export const gaFromLmp = (lmp, ref = new Date()) => {
  const days = daysBetween(lmp, ref);
  return gaFromDays(days);
};

/** EDD from a dating scan performed on scanDate at GA (weeks/days) */
export const eddFromScan = (scanDate, weeks, days) => {
  const gaDays = Number(weeks || 0) * 7 + Number(days || 0);
  if (!scanDate || !gaDays) return "";
  const e = addDays(scanDate, 280 - gaDays);
  return e ? localISODate(e) : "";
};

/** GA now, derived from an EDD */
export const gaFromEdd = (edd, ref = new Date()) => {
  const toEdd = daysBetween(ref, edd);
  if (toEdd == null) return null;
  return gaFromDays(280 - toEdd);
};

export const trimesterOf = (gaWeeks) => {
  const w = Number(gaWeeks);
  if (!Number.isFinite(w)) return null;
  if (w < 14) return 1;
  if (w < 28) return 2;
  return 3;
};

export const trimesterLabel = (t) => (t === 1 ? "First trimester" : t === 2 ? "Second trimester" : t === 3 ? "Third trimester" : "—");

/** Resolve the "final" GA/EDD used across the record (LMP / Scan / Manual). */
export const resolveDating = (caseDetails = {}, ref = new Date()) => {
  const lmpEdd = caseDetails.lmp ? eddFromLmp(caseDetails.lmp) : "";
  const lmpGa = caseDetails.lmp ? gaFromLmp(caseDetails.lmp, ref) : null;
  const scanEdd = caseDetails.scanDate ? eddFromScan(caseDetails.scanDate, caseDetails.scanWeeks, caseDetails.scanDays) : "";
  const scanGa = scanEdd ? gaFromEdd(scanEdd, ref) : null;

  const source = caseDetails.finalSource || (scanEdd ? "Scan" : lmpEdd ? "LMP" : "Manual");
  let finalEdd = "";
  if (source === "Manual") finalEdd = caseDetails.finalEdd || scanEdd || lmpEdd || "";
  else if (source === "Scan") finalEdd = scanEdd || lmpEdd || "";
  else finalEdd = lmpEdd || scanEdd || "";
  const finalGa = finalEdd ? gaFromEdd(finalEdd, ref) : null;

  return {
    lmpEdd, lmpGa, scanEdd, scanGa,
    source, finalEdd, finalGa,
    trimester: finalGa ? trimesterOf(finalGa.weeks) : null,
  };
};

/** Case details fields (LMP / last pregnancy). GA & EDD are computed, not typed. */
export const ANC_HISTORY_FIELDS = [
  { k: "gravida", label: "Gravida (G)", type: "number" },
  { k: "para", label: "Para (P)", type: "number" },
  { k: "abortions", label: "Abortions (A)", type: "number" },
  { k: "living", label: "Living children (L)", type: "number" },
  { k: "lastDelivery", label: "Last delivery date", type: "date" },
  { k: "lastMode", label: "Last delivery mode", type: "choice", options: ["SVD", "Assisted", "Caesarean", "N/A"] },
  { k: "bloodGroup", label: "Blood group / Rh", type: "text" },
  { k: "medical", label: "Medical / surgical history", type: "checks", options: ["Hypertension", "Diabetes", "Anaemia", "Cardiac", "Thyroid", "Previous C-section", "PPH", "None"] },
  { k: "allergy", label: "Known drug allergies", type: "text" },
  { k: "notes", label: "Other history notes", type: "textarea" },
];

/** Mother + fetal vitals — captured with sliders / steppers (no typing). */
export const MOTHER_VITALS = [
  { k: "weight", label: "Weight", unit: "kg", min: 35, max: 130, step: 0.5 },
  { k: "systolic", label: "BP Systolic", unit: "mmHg", min: 70, max: 200, step: 1, normal: [90, 139] },
  { k: "diastolic", label: "BP Diastolic", unit: "mmHg", min: 40, max: 130, step: 1, normal: [60, 89] },
  { k: "pulse", label: "Pulse", unit: "/min", min: 40, max: 160, step: 1, normal: [60, 100] },
  { k: "temp", label: "Temperature", unit: "°C", min: 34, max: 42, step: 0.1, normal: [36, 37.5] },
  { k: "rr", label: "Respiratory rate", unit: "/min", min: 8, max: 40, step: 1, normal: [12, 20] },
  { k: "spo2", label: "SpO₂", unit: "%", min: 70, max: 100, step: 1, normal: [95, 100] },
  { k: "fundalHeight", label: "Fundal height", unit: "cm", min: 10, max: 45, step: 1 },
];
export const MOTHER_VITAL_CHOICES = [
  { k: "pallor", label: "Pallor", options: ["None", "Mild", "Moderate", "Severe"] },
  { k: "oedema", label: "Oedema", options: ["None", "+", "++", "+++"] },
  { k: "urineProtein", label: "Urine protein", options: ["Nil", "Trace", "+", "++", "+++"] },
  { k: "urineSugar", label: "Urine sugar", options: ["Nil", "Trace", "+", "++", "+++"] },
];
export const FETAL_VITALS = [
  { k: "fhr", label: "Fetal heart rate", unit: "bpm", min: 90, max: 200, step: 1, normal: [110, 160] },
];
export const FETAL_VITAL_CHOICES = [
  { k: "presentation", label: "Presentation", options: ["Cephalic", "Breech", "Transverse", "Not palpable"] },
  { k: "lie", label: "Lie", options: ["Longitudinal", "Transverse", "Oblique"] },
  { k: "movements", label: "Fetal movements", options: ["Present", "Reduced", "Absent"] },
  { k: "liquor", label: "Liquor", options: ["Adequate", "Reduced", "Increased"] },
];

export const vitalStatus = (field, value) => {
  const v = Number(value);
  if (!field?.normal || !Number.isFinite(v)) return "";
  const [lo, hi] = field.normal;
  if (v < lo * 0.85 || v > hi * 1.15) return "red";
  if (v < lo || v > hi) return "amber";
  return "green";
};

/** Standard ANC laboratory test catalogue. */
export const ANC_LAB_TESTS = [
  { name: "Haemoglobin (Hb)", results: ["Normal", "Mild anaemia", "Moderate anaemia", "Severe anaemia"] },
  { name: "ABO Blood Group", results: ["A", "B", "AB", "O"] },
  { name: "Rh Typing", results: ["Positive", "Negative"] },
  { name: "HIV", results: ["Reactive", "Non-reactive", "Indeterminate"] },
  { name: "Syphilis (VDRL/RPR)", results: ["Reactive", "Non-reactive"] },
  { name: "Hepatitis B (HBsAg)", results: ["Positive", "Negative"] },
  { name: "Random Blood Sugar", results: ["Normal", "Raised"] },
  { name: "Oral GTT", results: ["Normal", "GDM"] },
  { name: "Urine Albumin", results: ["Nil", "Trace", "+", "++", "+++"] },
  { name: "Urine Sugar", results: ["Nil", "Trace", "+", "++", "+++"] },
  { name: "Malaria RDT", results: ["Positive", "Negative"] },
  { name: "Urine Culture", results: ["No growth", "Growth"] },
  { name: "TSH", results: ["Normal", "Low", "High"] },
  { name: "Rubella IgG", results: ["Immune", "Non-immune"] },
];

export const RADIOLOGY_SCANS = [
  "Dating scan",
  "NT scan (11–13 wk)",
  "Anomaly scan (18–22 wk)",
  "Growth scan",
  "Doppler study",
  "Biophysical profile",
];

/** Standard maternal drugs (age-relevant defaults for ANC). */
export const ANC_DRUGS = [
  "Folic Acid 5mg",
  "Ferrous Sulphate / FeFol",
  "Calcium 500mg",
  "Tab Albendazole 400mg",
  "Sulfadoxine-Pyrimethamine (IPTp)",
  "Vitamin D",
];

/** Standard antenatal immunization schedule (representative). Admin-editable later. */
export const ANC_IMMUNIZATION = [
  { id: "tt1", name: "Tetanus Toxoid — TT1", offsetDays: 0, note: "At first ANC contact" },
  { id: "tt2", name: "Tetanus Toxoid — TT2", offsetDays: 28, note: "≥ 4 weeks after TT1" },
  { id: "tt3", name: "Tetanus Toxoid — TT3 (booster)", offsetDays: 180, note: "≥ 6 months after TT2" },
  { id: "tdap", name: "Tdap (27–36 wk)", offsetWeeksGa: 27, note: "Given 27–36 weeks GA" },
  { id: "flu", name: "Influenza", offsetDays: 0, note: "Any trimester in season" },
];

/** Due date for a schedule item, from the first contact date / GA. */
export const immunizationDueDate = (item, firstContact, lmp) => {
  if (item.offsetWeeksGa != null && lmp) {
    return eddFromLmp(lmp) ? localISODate(addDays(lmp, item.offsetWeeksGa * 7)) : "";
  }
  const base = firstContact || localISODate();
  const d = addDays(base, item.offsetDays || 0);
  return d ? localISODate(d) : "";
};

export const isImmunizationOverdue = (item, record, firstContact, lmp) => {
  if (record?.given) return false;
  const due = immunizationDueDate(item, firstContact, lmp);
  if (!due) return false;
  return daysBetween(due, new Date()) > 0;
};

export const DELIVERY_MODES = ["SVD (Normal)", "Assisted (Vacuum/Forceps)", "Caesarean section", "Breech delivery"];
export const DELIVERY_PLACES = ["Facility", "Home", "In transit", "Other"];
export const BABY_OUTCOMES = ["Live birth", "Fresh still birth", "Macerated still birth"];
export const BABY_SEX = ["Male", "Female", "Ambiguous"];

export const ANC_OUTCOMES = [
  "Delivered",
  "Referred out",
  "Miscarriage / Abortion",
  "Ectopic pregnancy",
  "Maternal death",
  "Transferred out",
  "Lost to follow-up",
];

export const isAncEpisodeClosed = (outcome) =>
  /delivered|referred out|miscarriage|abortion|ectopic|death|transferred|lost to follow-up/i.test(String(outcome || "").trim());

export const newAncEpisodeId = () =>
  `ANC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

/** Ordinal words for twins/triplets baby naming. */
export const ordinal = (n) => ["First", "Second", "Third", "Fourth", "Fifth"][n] || `${n + 1}th`;

export const babyName = (motherName, index, total) => {
  const clean = String(motherName || "mother").replace(/^baby of\s+/i, "").trim();
  if (total > 1) return `Baby ${index + 1} of ${clean}`;
  return `Baby of ${clean}`;
};
