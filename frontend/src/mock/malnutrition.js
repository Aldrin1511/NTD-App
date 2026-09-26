import { localISODate } from "@/mock/specs";
import { compute } from "@/mock/growth";

export const MAL_ID = "malnutrition";
export const MAL_NAME = "Malnutrition";

export const CASE_TYPES = ["New", "Restart", "Transfer in"];
export const ADMISSION_TYPES = ["MAM", "SAM", "Others"];
export const VISIT_TYPES = ["Admission", "Follow-up"];
export const APPETITE = ["Pass", "Fail", "Not done"];
export const OEDEMA = ["None", "+", "++", "+++"];
export const RR_BANDS = ["<30", "30–39", "40–49", "50+"];
export const TEMP_OPTS = ["Febrile", "Normal"];

export const DANGER_SIGNS = [
  { k: "seizure", label: "Seizure" },
  { k: "lethargic", label: "Lethargic / unconscious" },
  { k: "vomitEverything", label: "Vomiting everything" },
  { k: "unableToFeed", label: "Unable to feed" },
];

export const HISTORY = [
  { k: "diarrhoea", label: "Diarrhoea", type: "yesno" },
  { k: "vomiting", label: "Vomiting", type: "yesno" },
  { k: "cough", label: "Cough", type: "yesno" },
  { k: "bloodStool", label: "Blood in stool", type: "yesno" },
  { k: "breastfeeding", label: "Breast feeding", type: "yesno" },
];

export const ROUTINE_MEDS = ["Amoxicillin", "Measles vaccine", "Folic Acid / FEFOL", "Anti Malaria", "Vitamin A", "Deworming"];

export const MAL_DRUG_META = {
  Amoxicillin: { dosage: "Age-based", frequency: "Twice daily", duration: "5–7 days" },
  "Measles vaccine": { dosage: "0.5 ml", frequency: "Once", duration: "Single dose" },
  "Folic Acid / FEFOL": { dosage: "1 tablet", frequency: "Once daily", duration: "As prescribed" },
  "Anti Malaria": { dosage: "Per protocol", frequency: "As prescribed", duration: "As prescribed" },
  "Vitamin A": { dosage: "Age-based", frequency: "Once", duration: "Single dose" },
  Deworming: { dosage: "Age-based", frequency: "Once", duration: "Single dose" },
};

/** Active is default and keeps the episode open. Any other status closes. */
export const OUTCOMES = [
  "Active",
  "Recovered / Discharged",
  "Transferred",
  "Lost to follow up",
  "Died",
  "Refused treatment",
  "Other",
];

export const isMalEpisodeClosed = (o) => {
  const s = String(o || "").trim();
  return !!s && !/^active$/i.test(s);
};

export const malStatusColor = (status) => {
  const s = String(status || "");
  if (/died|death/i.test(s)) return "red";
  if (/lost to follow/i.test(s)) return "amber";
  if (/recovered|discharged|transferred/i.test(s)) return "primary";
  if (/active/i.test(s) || !s) return "green";
  return "primary";
};

/** Color grading from admission type (MAM / SAM / Other). */
export const malColorGrade = (admissionType) => {
  if (admissionType === "SAM") return { level: "red", label: "Red", type: "SAM" };
  if (admissionType === "MAM") return { level: "amber", label: "Amber", type: "MAM" };
  if (admissionType === "Others") return { level: "primary", label: "Other", type: "Others" };
  return { level: "", label: "", type: "" };
};

export const newMalEpisodeId = () =>
  `MAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

/** Anthropometric indices (representative z-scores). */
export const malIndices = ({ weight, height, ageMonths, sex }) => ({
  wfa: compute({ metric: "weight", value: weight, ageMonths, sex, direction: "low" }),
  wfh: compute({ metric: "weight", value: weight, ageMonths, sex, direction: "low" }),
  hfa: compute({ metric: "height", value: height, ageMonths, sex, direction: "low" }),
});

/** Missed ≥1 scheduled week ( >7 days since last visit ) while episode still Active. */
export const isMalLostToFollowUp = (visits = [], ref = new Date()) => {
  if (!visits.length) return false;
  const sorted = [...visits].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  const status = last?.outcome || last?.data?.outcome?.status || "Active";
  if (isMalEpisodeClosed(status)) return false;
  const lastDate = new Date(last.date);
  if (Number.isNaN(lastDate.getTime())) return false;
  const days = (ref.getTime() - lastDate.getTime()) / 86400000;
  return days > 7;
};

/** Display status: Active, Lost to follow up (auto), or recorded closing outcome. */
export const malDisplayStatus = (visits = [], ref = new Date()) => {
  const sorted = [...visits].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  const recorded = last?.outcome || last?.data?.outcome?.status || "";
  if (isMalEpisodeClosed(recorded)) return recorded;
  if (isMalLostToFollowUp(visits, ref)) return "Lost to follow up";
  return "Active";
};

/** Week number for a visit (from data.week or type label). */
export const visitWeekNumber = (v) => {
  if (!v) return null;
  const raw = v.data?.week;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return n;
  const m = String(v.type || v.data?.visitType || "").match(/week\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};

export const malWeeksVisited = (visits = []) => {
  const followUps = visits.filter((v) => {
    const t = v.data?.visitType || v.type || "";
    return /follow|monitor/i.test(t) || visitWeekNumber(v) != null;
  });
  if (followUps.length) return followUps.length;
  return Math.max(0, visits.length - 1);
};

/** Latest follow-up week number in the episode (null if none). */
export const malLatestWeek = (visits = []) => {
  let max = null;
  visits.forEach((v) => {
    const w = visitWeekNumber(v);
    if (w != null && (max == null || w > max)) max = w;
  });
  return max;
};

/** Format last visit date with week in brackets, e.g. "23-Sep-2026 (Week 2)". */
export const malLastVisitLabel = (visits = [], fmt) => {
  if (!visits.length) return "";
  const sorted = [...visits].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = sorted[sorted.length - 1];
  const date = typeof fmt === "function" ? fmt(last.date) : last.date;
  const week = visitWeekNumber(last);
  if (week != null) return `${date} (Week ${week})`;
  if (/admission/i.test(last.data?.visitType || last.type || "")) return `${date} (Admission)`;
  const total = malWeeksVisited(visits);
  return total > 0 ? `${date} (${total} week${total === 1 ? "" : "s"})` : date;
};

/** Normalize legacy "Monitoring" → Follow-up. Pass forceAdmission true/false when creating a visit. */
export const normalizeVisitType = (data = {}, force) => {
  if (force === true) return "Admission";
  if (force === false) return "Follow-up";
  const t = data.visitType || data.type || "";
  if (/admission/i.test(t)) return "Admission";
  if (/monitor|follow/i.test(t)) return "Follow-up";
  return "Admission";
};

/** Rows for progress matrix (field label → extractor). */
export const PROGRESS_MATRIX_ROWS = [
  { section: "Alert", k: "alert", label: "Alert", get: (d) => d?.alert?.level || "" },
  { section: "Anthropometry", k: "weight", label: "Weight (kg)", get: (d) => d?.weight ?? "" },
  { section: "Anthropometry", k: "height", label: "Height / length (cm)", get: (d) => d?.height ?? "" },
  { section: "Anthropometry", k: "muac", label: "MUAC (cm)", get: (d) => d?.muac ?? "" },
  { section: "Anthropometry", k: "oedema", label: "Oedema", get: (d) => d?.oedema ?? "" },
  { section: "Anthropometry", k: "appetite", label: "Appetite test", get: (d) => d?.appetite ?? "" },
  ...DANGER_SIGNS.map((s) => ({
    section: "Danger signs",
    k: `ds-${s.k}`,
    label: s.label,
    get: (d) => d?.dangerSigns?.[s.k] ?? "",
  })),
  ...HISTORY.map((h) => ({
    section: "History",
    k: `hist-${h.k}`,
    label: h.label,
    get: (d) => d?.history?.[h.k] ?? "",
  })),
  { section: "Physical examination", k: "rr", label: "Respiratory rate", get: (d) => d?.rr ?? "" },
  { section: "Physical examination", k: "temp", label: "Temperature", get: (d) => d?.temp ?? "" },
  ...ROUTINE_MEDS.map((name) => ({
    section: "Medication",
    k: `med-${name}`,
    label: name,
    get: (d) => {
      if (!(d?.meds || []).includes(name)) return "";
      const duration = d?.posology?.[name]?.duration;
      return duration ? `Yes (${duration})` : "Yes";
    },
  })),
  { section: "Medication", k: "rutf", label: "RUTF packets", get: (d) => d?.rutf ?? "" },
  { section: "Medication", k: "medOther", label: "Other medicine", get: (d) => d?.medOther ?? "" },
];

/** Display label + color class for monitoring alert levels. */
export const ALERT_GRADE = {
  red: { label: "Critical", short: "Critical", cls: "border-red-300 bg-red-50 text-red-800" },
  amber: { label: "Needs review", short: "Review", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  green: { label: "Stable", short: "Stable", cls: "border-green-300 bg-green-50 text-green-800" },
};

export const alertGrade = (level) => ALERT_GRADE[level] || null;

/** Clinical alert for a monitoring entry vs the previous entry. */
export const monitoringAlert = (cur = {}, prev = null) => {
  const reasons = [];
  const ds = cur.dangerSigns || {};
  DANGER_SIGNS.forEach((s) => {
    if (ds[s.k] === "Yes") reasons.push(`${s.label} present`);
  });
  const oedemaRank = (v) => OEDEMA.indexOf(v || "None");
  if (prev && oedemaRank(cur.oedema) > oedemaRank(prev.oedema)) reasons.push("New/worsening oedema");
  else if (!prev && oedemaRank(cur.oedema) > 0) reasons.push("Oedema present");
  if (reasons.length) return { level: "red", reasons, action: "URGENT CLINICAL REVIEW REQUIRED" };

  const amber = [];
  const w = Number(cur.weight);
  const pw = prev ? Number(prev.weight) : null;
  if (pw != null && w <= pw) amber.push(w < pw ? "Weight decreasing" : "Weight not increasing");
  const mu = Number(cur.muac);
  const pmu = prev ? Number(prev.muac) : null;
  if (pmu != null && mu <= pmu) amber.push("MUAC not improving");
  if (cur.history?.diarrhoea === "Yes" && prev?.history?.diarrhoea === "Yes") amber.push("Persistent diarrhoea");
  if (cur.temp === "Febrile" && prev?.temp === "Febrile") amber.push("Persistent fever");
  if (cur.appetite === "Fail") amber.push("Appetite test failure");
  if (cur.missedFollowUp) amber.push("Missed scheduled follow-up");
  if (amber.length) return { level: "amber", reasons: amber, action: "FOLLOW-UP / CLINICAL REVIEW REQUIRED" };

  return { level: "green", reasons: ["Progressing well"], action: "Continue treatment" };
};

export { localISODate };
