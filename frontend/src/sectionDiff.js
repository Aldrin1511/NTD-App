const isRecordedOutcome = (v) => {
  const s = String(v || "").trim();
  return s !== "" && s !== "—" && s !== "Open" && s !== "Active";
};

const DRUG_ALIASES = {
  "Permethrin 5% cream (first-line)": "Permethrin 5% Cream/Lotion",
  "Permethrin 5% cream": "Permethrin 5% Cream/Lotion",
  "Permethrin 5% Cream": "Permethrin 5% Cream/Lotion",
};

const DIAGNOSIS_ALIASES = {
  "Clinical scabies": "Confirmed Scabies",
};

export const compactValue = (v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "—" || t === "Open") return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return compactValue(Number(t));
    return DIAGNOSIS_ALIASES[t] || DRUG_ALIASES[t] || t;
  }
  if (typeof v === "number") return v === 0 ? null : v;
  if (typeof v === "boolean") return v ? true : null;
  if (Array.isArray(v)) {
    const next = v.map(compactValue).filter((x) => x != null);
    return next.length ? next : null;
  }
  if (typeof v === "object") {
    const out = {};
    Object.keys(v).sort().forEach((k) => {
      const c = compactValue(v[k]);
      if (c != null) out[k] = c;
    });
    return Object.keys(out).length ? out : null;
  }
  return null;
};

export const sectionPayload = (key, e) => {
  const x = e.data || {};
  if (key === "caseDetails") return x.caseDetails;
  if (key === "history") return x.history;
  if (key === "marks") {
    const rounds = Array.isArray(x.examRounds) && x.examRounds.length
      ? x.examRounds
      : [{ marks: x.marks || {}, assessment: x.assessment || {}, secondaryInfection: x.assessment?.secondaryInfection }];
    return { examRounds: rounds, photos: x.photos };
  }
  if (key === "lab") return x.lab;
  if (key === "diagnosis") return x.diagnosis || e.diagnosis;
  if (key === "drugs") {
    const courses = {};
    Object.entries(x.medCourses || {}).forEach(([name, rows]) => {
      const dated = (Array.isArray(rows) ? rows : [])
        .map((row) => compactValue({ date: row?.date }))
        .filter(Boolean);
      if (dated.length) courses[name] = dated;
    });
    const hasOral = (re) => (x.oral || []).some((n) => re.test(String(n)));
    const hasTopical = (re) => (x.topical || []).some((n) => re.test(String(n)));
    const canon = (n) => DRUG_ALIASES[n] || n;
    return {
      topical: [...(x.topical || [])].map((n) => canon(String(n))).sort(),
      oral: [...(x.oral || [])].map((n) => canon(String(n))).sort(),
      topicalAntibiotics: [...(x.topicalAntibiotics || [])].map(String).sort(),
      oralAntibiotics: [...(x.oralAntibiotics || [])].map(String).sort(),
      medCourses: Object.keys(courses).length ? courses : null,
      posology: x.posology && typeof x.posology === "object" && Object.keys(x.posology).length
        ? compactValue(x.posology)
        : null,
      ivermectinTabletMg: hasOral(/ivermectin/i) ? x.ivermectinTabletMg : null,
      sulphurStrength: hasTopical(/sulphur/i) ? x.sulphurStrength : null,
      rifampicinTabletMg: hasOral(/rifampicin/i) ? x.rifampicinTabletMg : null,
      clarithromycinTabletMg: hasOral(/clarithromycin/i) ? x.clarithromycinTabletMg : null,
      mdtBandId: hasOral(/mdt blister/i) ? x.mdtBandId : null,
      treatmentDate: x.treatmentDate,
    };
  }
  if (key === "adherence") return x.adherence;
  if (key === "household") return x.household;
  if (key === "reactions") return x.reactions;
  if (key === "notes") {
    if (Array.isArray(x.notes)) return x.notes;
    if (typeof x.notes === "string" && x.notes.trim()) return [x.notes];
    return [];
  }
  if (key === "outcome") {
    const raw = x.outcome || e.outcome || "";
    return {
      outcome: isRecordedOutcome(raw) ? raw : "",
      recommendations: x.recommendations,
    };
  }
  return null;
};

export const sectionFingerprint = (key, e) => {
  const compact = compactValue(sectionPayload(key, e));
  return compact == null ? "" : JSON.stringify(compact);
};

export const SECTION_KEYS = [
  "caseDetails", "history", "marks", "lab", "diagnosis", "drugs",
  "adherence", "household", "reactions", "notes", "outcome",
];

export const changedSectionKeys = (prev, next) =>
  SECTION_KEYS.filter((k) => sectionFingerprint(k, next) !== sectionFingerprint(k, prev));
