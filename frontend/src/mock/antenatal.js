import { parseDate, localISODate } from "@/mock/specs";

/** ---------------------------------------------------------------------------
 * Ante Natal (ANC) configuration + helpers.
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
  // Only default "to" when omitted — empty/invalid dates must not become "today"
  // (that made blank follow-ups look like GA 40w / 3rd trimester).
  const b = to === undefined || to === null ? new Date() : parseDate(to);
  if (!a || !b) return null;
  return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / DAY);
};

export const gaFromDays = (days) => {
  if (days == null || Number.isNaN(days) || days < 0) return null;
  const w = Math.floor(days / 7);
  const d = days % 7;
  return { weeks: w, days: d, totalDays: days, text: `${w}w ${d}d` };
};

export const eddFromLmp = (lmp) => {
  const e = addDays(lmp, 280);
  return e ? localISODate(e) : "";
};

export const gaFromLmp = (lmp, ref = new Date()) => {
  const days = daysBetween(lmp, ref);
  return gaFromDays(days);
};

export const eddFromScan = (scanDate, weeks, days) => {
  const gaDays = Number(weeks || 0) * 7 + Number(days || 0);
  if (!scanDate || !gaDays) return "";
  const e = addDays(scanDate, 280 - gaDays);
  return e ? localISODate(e) : "";
};

/** Build EDD from early-pregnancy scan EDD (absolute date). */
export const gaFromEdd = (edd, ref = new Date()) => {
  if (!edd) return null;
  const toEdd = daysBetween(ref, edd);
  if (toEdd == null) return null;
  return gaFromDays(280 - toEdd);
};

export const trimesterOf = (gaWeeks) => {
  const w = Number(gaWeeks);
  if (!Number.isFinite(w) || w < 0) return null;
  // Same bands as Apex maternity visit chart (phi.helper / maternity-visit-chart).
  if (w <= 14) return 1;
  if (w <= 28) return 2;
  return 3;
};

export const trimesterLabel = (t) =>
  t === 1 ? "First trimester" : t === 2 ? "Second trimester" : t === 3 ? "Third trimester" : "—";
/** Short labels matching Apex maternity visit chart column headers. */
export const trimesterChartLabel = (t) =>
  t === 1 ? "Trimester 1" : t === 2 ? "Trimester 2" : t === 3 ? "Trimester 3" : "—";
export const trimesterLabelLong = trimesterLabel;
/** Resolve final GA/EDD. Scan EDD may come from caseDetails.scanEdd or computed from scan GA. */
export const resolveDating = (caseDetails = {}, ref = new Date()) => {
  const lmpEdd = caseDetails.lmp ? eddFromLmp(caseDetails.lmp) : "";
  const lmpGa = caseDetails.lmp ? gaFromLmp(caseDetails.lmp, ref) : null;
  let scanEdd = caseDetails.scanEdd || "";
  if (!scanEdd && caseDetails.scanDate) {
    scanEdd = eddFromScan(caseDetails.scanDate, caseDetails.scanWeeks, caseDetails.scanDays);
  }
  const scanGa = scanEdd ? gaFromEdd(scanEdd, ref) : null;

  // Clinician final dating is always manual EDD (falls back to scan/LMP when empty)
  const source = "Manual";
  const finalEdd = caseDetails.finalEdd || scanEdd || lmpEdd || "";
  const finalGa = finalEdd ? gaFromEdd(finalEdd, ref) : null;

  return {
    lmpEdd, lmpGa, scanEdd, scanGa,
    source, finalEdd, finalGa,
    trimester: finalGa ? trimesterOf(finalGa.weeks) : null,
  };
};

/** GA at a given visit date from case dating. */
export const gaAtVisit = (caseDetails = {}, visitDate) => {
  const dating = resolveDating(caseDetails, visitDate || new Date());
  return dating.finalGa;
};

/**
 * Apex maternity chart GA: always from episode LMP → visit date
 * (recordMeta.lastMenstrualPeriod), never from a per-visit blank/bogus EDD.
 * Returns { weeks, days, totalDays, text, lmpWeek, lmpDay } like Apex TrimesterDetails.
 */
export const apexGaAtVisit = (lmp, visitDate) => {
  if (!lmp || !visitDate) return null;
  const totalDays = daysBetween(lmp, visitDate);
  if (totalDays == null || totalDays < 0) return null;
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return {
    weeks,
    days,
    totalDays,
    text: `${weeks}w ${days}d`,
    lmpWeek: `Week ${weeks}`,
    lmpDay: `Day ${totalDays}`,
    trimester: trimesterOf(weeks),
  };
};

export const MEDICAL_HISTORY_OPTIONS = [
  "Diabetes", "Hearing impairment", "Visual impairment", "High LDL Cholesterol/Hyperlipidemia",
  "Overweight/Obesity", "Thyroid Disorders", "Heart Attack (Myocardial Infarction)", "Stroke/Paralysis",
  "Urinary Incontinence", "Neurological Problems", "Parkinson's", "Traumatic Brain Injury",
  "Psychiatric Problem", "Disability (if any)",
];

export const RISK_FACTOR_OPTIONS = [
  "High Blood Pressure", "Diabetes", "Epilepsy", "Pre-existing health conditions", "Lifestyle factors",
  "Pre-pregnancy weight", "Infections", "Substance use", "Intimate partner violence",
  "Being 17 or younger", "Being 35 or older", "Underweight", "Twins", "Triplets", "Depression",
  "STIs", "PPH", "Still Birth", "Labour > 24hrs", "Neonatal death", "Instrumental delivery",
];

export const PRESENT_ABSENT = ["Present", "Absent"];
export const DYSMENORRHEA = ["Absent", "Mild", "Moderate", "Severe"];
export const MENSTRUAL_FLOW = ["Normal", "Scanty", "Moderate", "Heavy"];
export const CYCLE_REGULARITY = ["Regular", "Irregular"];
export const YES_NO = ["Yes", "No"];
export const COUNT_0_10 = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Format obstetric G/P/L/A as 1/2/3/4 (empty slots omitted only when all blank). */
export const formatGpla = (cd = {}) => {
  if (typeof cd.gpla === "string" && cd.gpla.length) return cd.gpla;
  const parts = [cd.g ?? cd.gravida, cd.p ?? cd.para, cd.l ?? cd.living, cd.a ?? cd.abortions]
    .map((x) => (x === undefined || x === null || x === "" ? "" : String(x)));
  if (parts.every((p) => p === "")) return "";
  return parts.join("/");
};

/** Parse 1/2/3/4 (digits and slashes) into case-detail fields; keeps draft in `gpla`. */
export const parseGpla = (raw) => {
  const gpla = String(raw || "").replace(/[^\d/]/g, "");
  if (!gpla) return { g: "", p: "", l: "", a: "", gravida: "", para: "", living: "", abortions: "", gpla: "" };
  const parts = gpla.split("/");
  while (parts.length < 4) parts.push("");
  const [g, p, l, a] = parts.slice(0, 4).map((x) => String(x || "").replace(/\D/g, "").slice(0, 2));
  return { g, p, l, a, gravida: g, para: p, living: l, abortions: a, gpla };
};

/** Normalize Yes/No or numeric count for 0–10 selects. */
export const obstetricCountValue = (v) => {
  if (v === "Yes" || v === true) return "1";
  if (v === "No" || v === false) return "0";
  if (v === 0 || v === "0") return "0";
  if (v == null || v === "") return "";
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0 && n <= 10) return String(Math.round(n));
  return "";
};

/** Clinical risk suggestions from history, case, vitals, delivery, and patient age. */
export const autoRiskFactors = (data = {}, patient = {}) => {
  const out = new Set();
  const cd = data.caseDetails || {};
  const mother = data.vitals?.mother || {};
  const medical = data.history?.medical || [];
  const hasMedical = (name) => medical.includes(name);
  const num = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Obstetric history (case details)
  if (cd.neonatalDeath === "Yes" || Number(cd.neonatalDeath) > 0) out.add("Neonatal death");
  if (cd.stillBirth === "Yes" || Number(cd.stillBirth) > 0) out.add("Still Birth");

  // Mother vitals
  const sys = num(mother.systolic);
  const dia = num(mother.diastolic);
  const wt = num(mother.weight);
  if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) out.add("High Blood Pressure");
  if (wt != null && wt < 45) out.add("Underweight");
  if (wt != null && wt >= 90) out.add("Pre-pregnancy weight");
  if (["+", "++", "+++"].includes(mother.oedema) && ["+", "++", "+++"].includes(mother.urineProtein)) {
    out.add("High Blood Pressure");
  }

  // Delivery
  const fetuses = num(data.delivery?.fetuses);
  if (fetuses === 3) out.add("Triplets");
  else if (fetuses != null && fetuses >= 2) out.add("Twins");
  if (data.delivery?.complication === "PPH") out.add("PPH");
  if (data.delivery?.complication === "Vacuum" || data.delivery?.type === "Vacuum" || data.delivery?.mode === "Vacuum") {
    out.add("Instrumental delivery");
  }
  if (data.delivery?.type === "Assisted (Vacuum/Forceps)" || data.delivery?.mode === "Assisted (Vacuum/Forceps)") {
    out.add("Instrumental delivery");
  }

  // Medical history → risk factors
  if (hasMedical("Diabetes")) out.add("Diabetes");
  if (hasMedical("Psychiatric Problem")) out.add("Depression");
  if (hasMedical("Overweight/Obesity")) out.add("Pre-pregnancy weight");
  if (
    medical.some((m) =>
      [
        "Thyroid Disorders",
        "Heart Attack (Myocardial Infarction)",
        "Stroke/Paralysis",
        "Neurological Problems",
        "Parkinson's",
        "Traumatic Brain Injury",
        "Hearing impairment",
        "Visual impairment",
        "Urinary Incontinence",
        "Disability (if any)",
        "High LDL Cholesterol/Hyperlipidemia",
      ].includes(m),
    )
  ) {
    out.add("Pre-existing health conditions");
  }

  // Patient age
  const age = Number(patient.ageYears ?? patient.age);
  if (Number.isFinite(age) && age >= 10) {
    if (age <= 17) out.add("Being 17 or younger");
    if (age >= 35) out.add("Being 35 or older");
  }

  return [...out].filter((x) => RISK_FACTOR_OPTIONS.includes(x));
};

export const MOTHER_VITALS = [
  { k: "weight", label: "Weight", unit: "kg", min: 35, max: 130, step: 0.1 },
  { k: "systolic", label: "BP Systolic", unit: "mmHg", min: 70, max: 200, step: 0.1, normal: [90, 139] },
  { k: "diastolic", label: "BP Diastolic", unit: "mmHg", min: 40, max: 130, step: 0.1, normal: [60, 89] },
  { k: "pulse", label: "Pulse", unit: "/min", min: 40, max: 160, step: 0.1, normal: [60, 100] },
  { k: "temp", label: "Temperature", unit: "°C", min: 34, max: 42, step: 0.1, normal: [36, 37.5] },
  { k: "rr", label: "Respiratory rate", unit: "/min", min: 8, max: 40, step: 0.1, normal: [12, 20] },
  { k: "spo2", label: "SpO₂", unit: "%", min: 70, max: 100, step: 0.1, normal: [95, 100] },
  { k: "fundalHeight", label: "Fundal Height", unit: "cm", min: 10, max: 45, step: 0.1 },
];
export const MOTHER_VITAL_CHOICES = [
  { k: "oedema", label: "Oedema", options: ["None", "+", "++", "+++"] },
  { k: "pallor", label: "Pallor", options: ["None", "Mild", "Moderate", "Severe"] },
  { k: "urineProtein", label: "Urine protein", options: ["Nil", "Trace", "+", "++", "+++"] },
  { k: "urineSugar", label: "Urine sugar", options: ["Nil", "Trace", "+", "++", "+++"] },
];
export const FETAL_VITALS = [
  { k: "fhr", label: "Fetal heart rate", unit: "bpm", min: 90, max: 200, step: 0.1, normal: [110, 160] },
];
export const FETAL_VITAL_CHOICES = [
  { k: "presentation", label: "Fundal Presentation", options: ["Cephalic", "Breech", "Transverse", "Not palpable"] },
  { k: "movements", label: "Fetal movement", options: ["Present", "Reduced", "Absent"] },
  { k: "lie", label: "Lie", options: ["Longitudinal", "Transverse", "Oblique"] },
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

export const ANC_LAB_TESTS = [
  { name: "Hemoglobin", results: ["Normal", "Mild anaemia", "Moderate anaemia", "Severe anaemia"] },
  { name: "Glucose", results: ["Normal", "Raised", "Low"] },
  { name: "Duotest (HIV/VDRL)", results: ["Reactive", "Non-reactive", "Indeterminate"] },
  { name: "HIV EID (Early Infant Detection)", results: ["Detected", "Not detected", "Indeterminate"] },
  { name: "Urine Pregnancy Test", results: ["Positive", "Negative"] },
  { name: "Routine Urinalysis", results: ["Normal", "Abnormal"] },
  { name: "HIV Viral Load", results: ["Undetectable", "Detectable", "Pending"] },
];

export const RADIOLOGY_SCANS = [
  "Early Pregnancy scan",
  "Dating scan",
  "NT scan (11–13 wk)",
  "Anomaly scan (18–22 wk)",
  "Growth scan",
  "Doppler study",
  "Biophysical profile",
];

export const ANC_DRUGS = [
  "Folic Acid 5mg",
  "Ferrous Sulphate / FeFol",
  "Calcium 500mg",
  "Tab Albendazole 400mg",
  "Sulfadoxine-Pyrimethamine (IPTp)",
  "Vitamin D",
];

/** Default posology + advice shown after a drug is selected on the ANC visit. */
export const ANC_DRUG_META = {
  "Folic Acid 5mg": {
    dosage: "5 mg orally",
    frequency: "Once daily",
    duration: "Throughout pregnancy",
    advice: [
      "Start as early as possible in pregnancy (ideally preconception).",
      "Continue daily to reduce neural-tube defect risk.",
    ],
    note: "Give with food if GI upset.",
  },
  "Ferrous Sulphate / FeFol": {
    dosage: "1 tablet orally",
    frequency: "Once daily",
    duration: "Throughout pregnancy",
    advice: [
      "Take on an empty stomach when possible; vitamin C may improve absorption.",
      "Warn about dark stools and constipation.",
    ],
    note: "Avoid taking with tea/coffee or calcium at the same time.",
  },
  "Calcium 500mg": {
    dosage: "500 mg orally",
    frequency: "Twice daily",
    duration: "Throughout pregnancy",
    advice: [
      "Space calcium away from iron supplements by at least 2 hours.",
      "Useful for women with low dietary calcium intake.",
    ],
  },
  "Tab Albendazole 400mg": {
    dosage: "400 mg orally",
    frequency: "Single dose",
    duration: "Once",
    advice: [
      "Deworming dose after the first trimester when indicated.",
      "Do not give in the first trimester.",
    ],
    note: "Single dose only unless protocol says otherwise.",
  },
  "Sulfadoxine-Pyrimethamine (IPTp)": {
    dosage: "3 tablets (SP) orally",
    frequency: "Per IPTp schedule",
    duration: "Each scheduled ANC contact from 13 weeks",
    advice: [
      "Give as directly observed therapy (DOT) at ANC visits.",
      "Start from second trimester; doses ≥1 month apart.",
    ],
    note: "Follow national malaria IPTp schedule.",
  },
  "Vitamin D": {
    dosage: "As per local protocol",
    frequency: "Once daily",
    duration: "As prescribed",
    advice: [
      "Supplement when deficiency is suspected or confirmed.",
      "Counsel on sun exposure and diet as appropriate.",
    ],
  },
};

export const ANC_IMMUNIZATION = [
  { id: "tt1", name: "TT 1", offsetDays: 0, note: "At first ANC contact" },
  { id: "tt2", name: "TT 2", offsetDays: 28, note: "≥ 4 weeks after TT1" },
  { id: "tt3", name: "TT 3 (Booster)", offsetDays: 180, note: "≥ 6 months after TT2" },
  { id: "tdap", name: "Tdap", offsetWeeksGa: 27, note: "Given 27–36 weeks GA" },
];

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

/**
 * Same as Well Baby: first-contact dose (TT1) always; later doses from `leadDays`
 * before due (default 1 week), or if already given / manually revealed.
 */
export const isAncEntryDoseVisible = (
  item,
  rec,
  firstContact,
  lmp,
  revealedIds = [],
  leadDays = 7,
  asOf = new Date(),
) => {
  if (!item) return false;
  const isFirstContactDose = (item.offsetDays || 0) === 0 && item.offsetWeeksGa == null;
  if (isFirstContactDose) return true;
  if (rec?.given) return true;
  if ((revealedIds || []).includes(item.id)) return true;
  const due = immunizationDueDate(item, firstContact, lmp);
  if (!due) return false;
  const openAt = addDays(due, -leadDays);
  if (!openAt) return false;
  const today = parseDate(asOf) || new Date();
  today.setHours(0, 0, 0, 0);
  openAt.setHours(0, 0, 0, 0);
  return today.getTime() >= openAt.getTime();
};

export const ancEntryVisibleVaccines = (vaccines, records, firstContact, lmp, revealedIds, asOf) =>
  (vaccines || []).filter((item) =>
    isAncEntryDoseVisible(item, records?.[item.id], firstContact, lmp, revealedIds, 7, asOf),
  );

export const ancEntryDropdownVaccines = (vaccines, records, firstContact, lmp, revealedIds, asOf) =>
  (vaccines || []).filter(
    (item) => !isAncEntryDoseVisible(item, records?.[item.id], firstContact, lmp, revealedIds, 7, asOf),
  );

export const DELIVERY_TYPES = ["SVD (Normal)", "Assisted (Vacuum/Forceps)", "Caesarean section", "Breech delivery", "Vacuum"];
export const DELIVERY_COMPLICATIONS = ["None", "PPH", "3/4 perineal laceration", "Vacuum"];
export const FETUS_COUNTS = ["1", "2", "3", "4", "5"];
/** Full Apex / Family Planning services (+ None / Planned for delivery context). */
export const FAMILY_PLANNING = [
  "None",
  "Condom",
  "Emergency contraceptive",
  "Oral Contraceptive pill",
  "Injectable",
  "Implant",
  "IUD Insertion - 10 years",
  "Tubal Ligation",
  "Implant removal",
  "IUD removal",
  "Planned",
];
/** Map legacy ANC chip values → current Family Planning services. */
export const normalizeFamilyPlanningService = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  const legacy = {
    Pill: "Oral Contraceptive pill",
    Injection: "Injectable",
    Implant: "Implant",  };
  return legacy[s] || s;
};
export const POSTPARTUM_COMPLICATIONS = [
  "Fever", "Hypertension", "Anaemia", "Poor Milk Supply", "Urinary Infection", "Respiratory Infection",
  "Seizure", "Patient Death", "Teenage (<20Y)", "Maternal Death", "BBA", "Village Birth",
];
export const DELIVERY_OUTCOMES = [
  "Delivered (Health Centre)", "Delivered (Hospital)", "Delivered (Bush)", "Abortion", "Preterm",
];

export const BABY_SEX = ["Male", "Female", "Ambiguous"];
export const BABY_COMPLICATIONS = [
  "NNS", "PROM exposure", "Intrapartum Event / Born flat", "Anemia", "CHD", "Meconium Aspiration",
  "RDS", "Neonatal Jaundice", "Preterm", "LBW", "MSAF", "Pneumonia", "Meningitis", "Others",
];
export const BABY_OUTCOMES = [
  "Health Delivery - Discharged",
  "Hospitalized in Nursery",
  "Neonatal Death",
  "Still Birth - Fresh",
  "Still Birth - Macerated Fetus",
];

export const PHYSICAL_EXAM_FIELDS = [
  { k: "generalCondition", label: "General Condition", options: ["Good", "Poor"], alert: ["Poor"] },
  { k: "color", label: "Color", options: ["Pink", "Cyanosed"], alert: ["Cyanosed"] },
  { k: "size", label: "Size", options: ["Average", "Big", "Small"], alert: ["Small", "Big"] },
  { k: "ears", label: "Ears", options: ["Normal", "Abnormal"], alert: ["Abnormal"] },
  { k: "moulding", label: "Moulding", options: ["None", "Moderate", "Severe"], alert: ["Moderate", "Severe"] },
  { k: "lips", label: "Lips", options: ["Normal", "Cleft lip"], alert: ["Cleft lip"] },
  { k: "caput", label: "Caput", options: ["None", "Present"], alert: ["Present"] },
  { k: "palate", label: "Palate", options: ["Normal", "Cleft Palate"], alert: ["Cleft Palate"] },
  { k: "fontanelles", label: "Fontanelles", options: ["Normal", "Bulging"], alert: ["Bulging"] },
  { k: "eyes", label: "Eyes", options: ["Clear", "Discharge"], alert: ["Discharge"] },
  { k: "breastTissue", label: "Breast Tissue", options: ["Present", "Absent"], alert: ["Absent"] },
  { k: "threeVesselCord", label: "3 Vessel Cord", options: ["Present", "Absent"], alert: ["Absent"] },
  { k: "testes", label: "Testes", options: ["Descended (In Scrotum)", "Undescended (not In Scrotum)"], sex: "Male", alert: ["Undescended (not In Scrotum)"] },
  { k: "penis", label: "Penis", options: ["Normal", "Abnormal"], sex: "Male", alert: ["Abnormal"] },
  { k: "vaginalDischarge", label: "Vaginal Discharge", options: ["Present", "Absent"], sex: "Female", alert: ["Present"] },
  { k: "meconiumPassed", label: "Meconium Passed", options: ["Yes", "No"], alert: ["No"] },
  { k: "urinePassed", label: "Urine Passed", options: ["Yes", "No"], alert: ["No"] },
  { k: "armsHands", label: "Arms/Hands", options: ["Normal", "Abnormal", "Extra Fingers"], alert: ["Abnormal", "Extra Fingers"] },
  { k: "legsToes", label: "Legs/Toes", options: ["Normal", "Abnormal", "Talipses"], alert: ["Abnormal", "Talipses"] },
  { k: "spine", label: "Spine", options: ["Normal", "Abnormal", "Spina Bifida"], alert: ["Abnormal", "Spina Bifida"] },
];

/** Baby outcomes that should show as red/alert when selected. */
export const BABY_OUTCOME_ALERTS = [
  "Neonatal Death",
  "Still Birth - Fresh",
  "Still Birth - Macerated Fetus",
];

export const ANC_OUTCOMES = ["Active", "Discharged", "Maternal Death", "Lost to Follow up"];

export const isAncEpisodeClosed = (outcome) => {
  const raw =
    outcome && typeof outcome === "object"
      ? outcome.status ?? outcome.outcome ?? ""
      : outcome;
  return /discharged|maternal death|lost to follow/i.test(String(raw || "").trim());
};

export const ancStatusColor = (status) => {
  const s = String(status || "Active").toLowerCase();
  if (s.includes("maternal death")) return "red";
  if (s.includes("lost to follow")) return "amber";
  if (s.includes("discharged")) return "primary";
  return "green";
};

export const ancRiskLevel = (riskFactors = []) => {
  if (!riskFactors?.length) return "none";
  const high = ["Maternal Death", "Still Birth", "Neonatal death", "PPH", "Intimate partner violence", "Labour > 24hrs"];
  if (riskFactors.some((r) => high.some((h) => String(r).toLowerCase().includes(h.toLowerCase())))) return "high";
  return "elevated";
};

export const newAncEpisodeId = () =>
  `ANC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

export const ordinal = (n) => ["First", "Second", "Third", "Fourth", "Fifth"][n] || `${n + 1}th`;

export const babyName = (motherName, index, total) => {
  const clean = String(motherName || "mother").replace(/^baby of\s+/i, "").trim();
  if (total > 1) return `Baby ${index + 1} of ${clean}`;
  return `Baby of ${clean}`;
};

/** Legacy aliases used by older code paths */
export const DELIVERY_MODES = DELIVERY_TYPES;
export const DELIVERY_PLACES = ["Facility", "Home", "In transit", "Other"];
export const ANC_HISTORY_FIELDS = [];
