import { DISEASE_SPECS } from "@/mock/specs";

/** Disease id → HMIS featureCode (same as portal-be NTD_DISEASE_MAP). */
export const FEATURE_CODES = {
  scabies: "SCAS",
  yaws: "YWAS",
  lf: "LFAS",
  buruli: "BUAS",
  leprosy: "LPRSYA",
  antenatal: "ANAS",
  malnutrition: "MLAS",
  wellbaby: "WBAS",
  familyplanning: "FPAS",
};

export function featureCodeForDisease(disease) {
  return FEATURE_CODES[String(disease || "").toLowerCase()] || "";
}

/** ANC / malnutrition / well-baby — dedicated forms; ignore stub DISEASE_SPECS from Access configs. */
export const EXTRA_DISEASE_IDS = new Set(["antenatal", "malnutrition", "wellbaby", "familyplanning"]);

export function isExtraDisease(disease) {
  return EXTRA_DISEASE_IDS.has(String(disease || "").toLowerCase());
}

/** Top-level form section → PHI subFeatureCode (mirrors skin-NTD section naming). */
export const EXTRA_PHI_SECTIONS = {
  antenatal: {
    caseDetails: "Case details",
    history: "Ante Natal Clinical history",
    vitals: "Ante Natal Assessment",
    lab: "Laboratory",
    radiology: "Radiology",
    drugs: "Medications",
    posology: "Medications",
    medCourses: "Medications",
    immunization: "Immunization",
    notes: "Visit notes",
    delivery: "Delivery",
    physicalExam: "Physical exam",
    outcome: "Final case outcome",
  },
  malnutrition: {
    caseDetails: "Case details",
    visitType: "Case details",
    week: "Case details",
    weight: "Malnutrition Assessment",
    height: "Malnutrition Assessment",
    length: "Malnutrition Assessment",
    muac: "Malnutrition Assessment",
    oedema: "Malnutrition Assessment",
    zScore: "Malnutrition Assessment",
    dangerSigns: "Danger signs",
    history: "Malnutrition Clinical history",
    meds: "Medications",
    posology: "Medications",
    medCourses: "Medications",
    notes: "Visit notes",
    outcome: "Final case outcome",
  },
  wellbaby: {
    delivery: "Delivery / birth history",
    growth: "Growth",
    immunization: "Immunization",
    milestones: "Milestones",
    allergy: "Allergy",
    lab: "Laboratory",
    drugs: "Medications",
    posology: "Medications",
    medCourses: "Medications",
    notes: "Visit notes",
    outcome: "Final case outcome",
  },
  familyplanning: {
    caseDetails: "Case details",
    history: "Family Planning Clinical history",
    services: "Family Planning",
    notes: "Visit notes",
  },
};

function isEmpty(v) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

export function humanizePhiKey(key) {
  return (
    String(key || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]+/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim() || String(key || "")
  );
}

function setByPath(obj, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function emitField(items, field, data, subFeatureCode, pathPrefix) {
  if (!field || field.type === "section" || field.type === "note") return;
  const key = field.k;
  if (!key) return;
  const value = data?.[key];
  if (isEmpty(value)) return;
  items.push({
    item: field.label || key,
    subFeatureCode,
    value,
    fieldKey: `${pathPrefix}.${key}`,
  });
}

function emitFields(items, fields, data, subFeatureCode, pathPrefix) {
  (fields || []).forEach((f) => emitField(items, f, data, subFeatureCode, pathPrefix));
}

export function examSectionTitle(diseaseId) {
  if (diseaseId === "scabies") return "Scabies Examination";
  if (diseaseId === "yaws") return "Yaws Examination";
  if (diseaseId === "lf") return "Lymphatic Filariasis Examination";
  if (diseaseId === "buruli") return "Buruli Ulcer Examination";
  if (diseaseId === "leprosy") return "Leprosy Examination";
  if (diseaseId === "antenatal") return "Ante Natal Assessment";
  if (diseaseId === "malnutrition") return "Malnutrition Assessment";
  if (diseaseId === "wellbaby") return "Well Baby Assessment";
  return "Assessment / body charting";
}

/** Build one PHI upsert payload for a single form field change. */
export function phiItemForFieldChange({
  disease,
  pathPrefix,
  fieldKey,
  value,
  fields,
  subFeatureCode,
  itemLabel,
}) {
  const diseaseId = String(disease || "").toLowerCase();
  const spec = DISEASE_SPECS[diseaseId];
  const key = String(fieldKey || "").includes(".")
    ? String(fieldKey).split(".").pop()
    : String(fieldKey || "");
  const field = (fields || []).find((f) => f.k === key);
  const fullKey = String(fieldKey || "").includes(".")
    ? String(fieldKey)
    : pathPrefix
      ? `${pathPrefix}.${key}`
      : key;
  return {
    item: itemLabel || field?.label || key,
    subFeatureCode:
      subFeatureCode ||
      (pathPrefix === "caseDetails"
        ? "Case details"
        : pathPrefix === "history"
          ? `${spec?.name || "NTD"} Clinical history`
          : pathPrefix === "lab"
            ? "Laboratory"
            : pathPrefix === "household"
              ? "Household Contact Tracing"
              : pathPrefix === "assessment"
                ? examSectionTitle(diseaseId)
                : "Case details"),
    value,
    fieldKey: fullKey,
  };
}

/**
 * Diff two section objects and return PHI items for changed keys.
 */
export function phiItemsForSectionDiff({
  disease,
  pathPrefix,
  subFeatureCode,
  fields,
  prev = {},
  next = {},
}) {
  const items = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  keys.forEach((k) => {
    const field = (fields || []).find((f) => f.k === k);
    if (field && (field.type === "section" || field.type === "note")) return;
    const a = prev?.[k];
    const b = next?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (b === undefined) return;
    items.push(
      phiItemForFieldChange({
        disease,
        pathPrefix,
        fieldKey: k,
        value: b,
        fields,
        subFeatureCode,
      })
    );
  });
  return items;
}

function pushBlob(items, item, subFeatureCode, value, fieldKey) {
  if (isEmpty(value)) return;
  items.push({ item, subFeatureCode, value, fieldKey });
}

/** Flatten nested form objects into leaf fieldKey → value (arrays stay as one leaf). */
export function collectPhiLeaves(obj, prefix = "", out = {}) {
  if (obj === undefined) return out;
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  const keys = Object.keys(obj);
  if (!keys.length) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  keys.forEach((k) => {
    if (String(k).startsWith("_")) return;
    collectPhiLeaves(obj[k], prefix ? `${prefix}.${k}` : k, out);
  });
  return out;
}

/**
 * Diff two section objects into one-PHI-per-leaf rows (for live autosave on ANC/Mal/WB).
 */
export function phiItemsForExtraSectionDiff({
  pathPrefix,
  subFeatureCode,
  prev = {},
  next = {},
}) {
  const items = [];
  const prevLeaves = collectPhiLeaves(prev, pathPrefix);
  const nextLeaves = collectPhiLeaves(next, pathPrefix);
  const keys = new Set([...Object.keys(prevLeaves), ...Object.keys(nextLeaves)]);
  keys.forEach((fk) => {
    if (JSON.stringify(prevLeaves[fk]) === JSON.stringify(nextLeaves[fk])) return;
    if (nextLeaves[fk] === undefined) return;
    const leaf = fk.includes(".") ? fk.split(".").pop() : fk;
    items.push({
      item: humanizePhiKey(leaf),
      subFeatureCode: subFeatureCode || "Case details",
      value: nextLeaves[fk],
      fieldKey: fk,
    });
  });
  return items;
}

/** One PHI row for a single top-level or nested field change on an extra disease form. */
export function phiItemForExtraFieldChange({
  fieldKey,
  value,
  subFeatureCode,
  itemLabel,
}) {
  const leaf = String(fieldKey || "").includes(".")
    ? String(fieldKey).split(".").pop()
    : String(fieldKey || "");
  return {
    item: itemLabel || humanizePhiKey(leaf),
    subFeatureCode: subFeatureCode || "Case details",
    value,
    fieldKey,
  };
}

function flattenExtraEncounterToPhiItems({ disease, data = {}, diagnosis, outcome }) {
  const items = [];
  const diseaseId = String(disease || "").toLowerCase();
  const sections = EXTRA_PHI_SECTIONS[diseaseId] || {};
  const fallbackSection = examSectionTitle(diseaseId);

  Object.entries(data || {}).forEach(([key, value]) => {
    if (key === "diagnosis" || key === "outcome") return;
    if (String(key).startsWith("_")) return;
    const sub = sections[key] || fallbackSection;
    const leaves = collectPhiLeaves(value, key);
    Object.entries(leaves).forEach(([fk, v]) => {
      if (isEmpty(v)) return;
      const leaf = fk.includes(".") ? fk.split(".").pop() : fk;
      items.push({
        item: humanizePhiKey(leaf),
        subFeatureCode: sub,
        value: v,
        fieldKey: fk,
      });
    });
  });

  if (!isEmpty(diagnosis || data.diagnosis)) {
    items.push({
      item: "Diagnosis",
      subFeatureCode: "Diagnosis",
      value: diagnosis || data.diagnosis,
      fieldKey: "diagnosis",
    });
  }

  const out =
    outcome ||
    (typeof data.outcome === "object" && data.outcome != null
      ? data.outcome.status || data.outcome
      : data.outcome);
  if (!isEmpty(out)) {
    items.push({
      item: "Outcome",
      subFeatureCode: "Final case outcome",
      value: out,
      fieldKey: "outcome",
    });
  }

  return items.filter((q) => q.item && q.subFeatureCode);
}

/**
 * Flatten encounter form state into one-PHI-per-question rows (Surgery PRFM pattern).
 * Simple spec fields use question label; complex blocks use a labelled blob + fieldKey.
 * ANC / malnutrition / wellbaby always use dedicated flatten (Access stub specs are empty).
 */
export function flattenEncounterToPhiItems({ disease, data = {}, diagnosis, outcome }) {
  const diseaseId = String(disease || "").toLowerCase();
  if (isExtraDisease(diseaseId)) {
    return flattenExtraEncounterToPhiItems({ disease: diseaseId, data, diagnosis, outcome });
  }

  const items = [];
  const spec = DISEASE_SPECS[diseaseId];
  if (!spec) {
    return flattenExtraEncounterToPhiItems({ disease: diseaseId, data, diagnosis, outcome });
  }

  emitFields(items, spec.caseDetails, data.caseDetails, "Case details", "caseDetails");
  emitFields(
    items,
    spec.history,
    data.history,
    `${spec.name} Clinical history`,
    "history"
  );

  const examTitle = examSectionTitle(diseaseId);
  pushBlob(items, "Body chart marks", examTitle, data.marks, "marks");
  pushBlob(items, "Exam rounds", examTitle, data.examRounds, "examRounds");
  pushBlob(items, "Assessment", examTitle, data.assessment, "assessment");
  pushBlob(items, "Assessment photographs", examTitle, data.photos, "photos");
  if (spec.assessmentExtra?.length && data.assessment) {
    emitFields(items, spec.assessmentExtra, data.assessment, examTitle, "assessment");
  }

  emitFields(items, spec.lab, data.lab, "Laboratory", "lab");

  if (!isEmpty(diagnosis || data.diagnosis)) {
    items.push({
      item: "Diagnosis",
      subFeatureCode: "Diagnosis",
      value: diagnosis || data.diagnosis,
      fieldKey: "diagnosis",
    });
  }

  const medTitle = "Medications";
  pushBlob(items, "Topical medications", medTitle, data.topical, "topical");
  pushBlob(items, "Oral medications", medTitle, data.oral, "oral");
  pushBlob(items, "Topical antibiotics", medTitle, data.topicalAntibiotics, "topicalAntibiotics");
  pushBlob(items, "Oral antibiotics", medTitle, data.oralAntibiotics, "oralAntibiotics");
  pushBlob(items, "Medication courses", medTitle, data.medCourses, "medCourses");
  pushBlob(items, "Posology", medTitle, data.posology, "posology");
  pushBlob(items, "Recommendations", medTitle, data.recommendations, "recommendations");
  pushBlob(items, "Adherence", medTitle, data.adherence, "adherence");
  pushBlob(items, "Treatment date", medTitle, data.treatmentDate, "treatmentDate");

  emitFields(
    items,
    spec.household,
    data.household,
    "Household Contact Tracing",
    "household"
  );

  if (diseaseId === "leprosy") {
    pushBlob(items, "Leprosy reactions", "Leprosy reaction", data.reactions, "reactions");
  }

  pushBlob(items, "Visit notes", "Visit notes", data.notes, "notes");

  const out = outcome || data.outcome;
  if (!isEmpty(out)) {
    items.push({
      item: "Outcome",
      subFeatureCode: "Final case outcome",
      value: out,
      fieldKey: "outcome",
    });
  }

  pushBlob(items, "Scores", "Final case outcome", data.scores, "scores");
  pushBlob(items, "Classification", "Final case outcome", data.classification, "classification");

  return items.filter((q) => q.item && q.subFeatureCode);
}

/** Rebuild form state from HMIS PHI rows (fieldKey + value). */
export function rehydrateFormFromPhi(rows) {
  const form = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const info = (row && row.information) || {};
    let fieldKey = String(info.fieldKey || "").trim();
    // Older PHI rows may lack fieldKey — recover diagnosis/outcome from item / subFeature labels.
    if (!fieldKey) {
      const item = String(row?.item || info.item || "").trim().toLowerCase();
      const sub = String(info.subFeatureCode || "").trim().toLowerCase();
      if (item === "diagnosis" || sub === "diagnosis") fieldKey = "diagnosis";
      else if (
        item === "outcome" ||
        sub === "final case outcome" ||
        sub === "outcome" ||
        /final case outcome/i.test(String(row?.item || ""))
      ) {
        // Prefer the outcome scalar, not scores/classification blobs.
        if (typeof info.value === "string" || typeof info.value === "number") {
          fieldKey = "outcome";
        }
      }
    }
    if (!fieldKey) return;
    const value = info.value;
    if (fieldKey.includes(".")) setByPath(form, fieldKey, value);
    else form[fieldKey] = value;
  });
  return form;
}

const NESTED_FORM_KEYS = [
  "caseDetails",
  "history",
  "vitals",
  "delivery",
  "immunization",
  "outcome",
  "posology",
  "medCourses",
  "growth",
  "milestones",
  "assessment",
  "household",
  "adherence",
];

function preferRicherBabies(a = [], b = []) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (!left.length) return right;
  if (!right.length) return left;
  const score = (babies) =>
    babies.reduce((n, baby) => {
      if (!baby || typeof baby !== "object") return n;
      let s = Object.keys(baby).filter((k) => baby[k] !== "" && baby[k] != null).length;
      const exam = baby.physicalExam || {};
      s += Object.keys(exam).filter((k) => exam[k] !== "" && exam[k] != null).length;
      return n + s;
    }, 0);
  return score(right) >= score(left) ? right : left;
}

/**
 * Merge PHI-rehydrated form into existing encounter.data.
 * Shallow `{...existing, ...form}` replaces nested objects (e.g. delivery) and
 * drops babies / newborn exam when PHI only returned a subset of delivery fields.
 */
export function mergeEncounterFormData(existing = {}, form = {}) {
  const base = existing && typeof existing === "object" ? existing : {};
  const incoming = form && typeof form === "object" ? form : {};
  const out = { ...base, ...incoming };
  NESTED_FORM_KEYS.forEach((key) => {
    const prev = base[key];
    const next = incoming[key];
    if (
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      next &&
      typeof next === "object" &&
      !Array.isArray(next)
    ) {
      out[key] = { ...prev, ...next };
      if (key === "delivery") {
        out.delivery.babies = preferRicherBabies(prev.babies, next.babies);
        if (!out.delivery.date && out.delivery.deliveryDate) out.delivery.date = out.delivery.deliveryDate;
        if (!out.delivery.deliveryDate && out.delivery.date) out.delivery.deliveryDate = out.delivery.date;
      }
      if (key === "history") {
        out.history.menstrual = { ...(prev.menstrual || {}), ...(next.menstrual || {}) };
        if (Array.isArray(prev.medical) || Array.isArray(next.medical)) {
          out.history.medical = [...new Set([...(prev.medical || []), ...(next.medical || [])])];
        }
        if (Array.isArray(prev.riskFactors) || Array.isArray(next.riskFactors)) {
          out.history.riskFactors = [...new Set([...(prev.riskFactors || []), ...(next.riskFactors || [])])];
        }
      }
      if (key === "vitals") {
        out.vitals = {
          mother: { ...(prev.mother || {}), ...(next.mother || {}) },
          fetal: { ...(prev.fetal || {}), ...(next.fetal || {}) },
        };
      }
    }
  });
  return out;
}
