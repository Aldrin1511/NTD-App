import { DISEASE_SPECS } from "@/mock/specs";

/** Disease id → HMIS featureCode (same as portal-be NTD_DISEASE_MAP). */
export const FEATURE_CODES = {
  scabies: "SCAS",
  yaws: "YWAS",
  lf: "LFAS",
  buruli: "BUAS",
  leprosy: "LPRSYA",
};

export function featureCodeForDisease(disease) {
  return FEATURE_CODES[String(disease || "").toLowerCase()] || "";
}

function isEmpty(v) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
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

/**
 * Flatten encounter form state into one-PHI-per-question rows (Surgery PRFM pattern).
 * Simple spec fields use question label; complex blocks use a labelled blob + fieldKey.
 */
export function flattenEncounterToPhiItems({ disease, data = {}, diagnosis, outcome }) {
  const items = [];
  const diseaseId = String(disease || "").toLowerCase();
  const spec = DISEASE_SPECS[diseaseId];
  if (!spec) return items;

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
    const fieldKey = String(info.fieldKey || "").trim();
    if (!fieldKey) return;
    const value = info.value;
    if (fieldKey.includes(".")) setByPath(form, fieldKey, value);
    else form[fieldKey] = value;
  });
  return form;
}
