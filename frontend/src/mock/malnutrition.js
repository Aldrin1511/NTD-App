import { localISODate } from "@/mock/specs";
import { compute } from "@/mock/growth";

export const MAL_ID = "malnutrition";
export const MAL_NAME = "Malnutrition";

export const CASE_TYPES = ["New", "Restart", "Transfer in"];
export const ADMISSION_TYPES = ["MAM", "SAM", "Others"];
export const VISIT_TYPES = ["Admission", "Monitoring"];
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
  { k: "other", label: "Other details", type: "textarea" },
];

export const ROUTINE_MEDS = ["Amoxicillin", "Measles vaccine", "Folic Acid / FEFOL", "Anti Malaria", "Vitamin A", "Deworming"];

export const OUTCOMES = [
  "Recovered / Discharged",
  "Transferred",
  "Defaulter / Lost to follow up",
  "Died",
  "Refused treatment",
  "Other",
];

export const isMalEpisodeClosed = (o) => !!o && o !== "" ;

export const newMalEpisodeId = () => `MAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

/** Anthropometric indices (representative z-scores). */
export const malIndices = ({ weight, height, ageMonths, sex }) => ({
  wfa: compute({ metric: "weight", value: weight, ageMonths, sex, direction: "low" }),
  wfh: compute({ metric: "weight", value: weight, ageMonths, sex, direction: "low" }), // representative weight-for-height
  hfa: compute({ metric: "height", value: height, ageMonths, sex, direction: "low" }),
});

/** Clinical alert for a monitoring entry vs the previous entry. */
export const monitoringAlert = (cur = {}, prev = null) => {
  const reasons = [];
  const ds = cur.dangerSigns || {};
  DANGER_SIGNS.forEach((s) => { if (ds[s.k] === "Yes") reasons.push(`${s.label} present`); });
  const oedemaRank = (v) => OEDEMA.indexOf(v || "None");
  if (prev && oedemaRank(cur.oedema) > oedemaRank(prev.oedema)) reasons.push("New/worsening oedema");
  else if (!prev && oedemaRank(cur.oedema) > 0) reasons.push("Oedema present");
  if (reasons.length) return { level: "red", reasons, action: "URGENT CLINICAL REVIEW REQUIRED" };

  const amber = [];
  const w = Number(cur.weight); const pw = prev ? Number(prev.weight) : null;
  if (pw != null && w <= pw) amber.push(w < pw ? "Weight decreasing" : "Weight not increasing");
  const mu = Number(cur.muac); const pmu = prev ? Number(prev.muac) : null;
  if (pmu != null && mu <= pmu) amber.push("MUAC not improving");
  if (cur.history?.diarrhoea === "Yes" && prev?.history?.diarrhoea === "Yes") amber.push("Persistent diarrhoea");
  if (cur.temp === "Febrile" && prev?.temp === "Febrile") amber.push("Persistent fever");
  if (cur.appetite === "Fail") amber.push("Appetite test failure");
  if (cur.missedFollowUp) amber.push("Missed scheduled follow-up");
  if (amber.length) return { level: "amber", reasons: amber, action: "FOLLOW-UP / CLINICAL REVIEW REQUIRED" };

  return { level: "green", reasons: ["Progressing well"], action: "Continue treatment" };
};
