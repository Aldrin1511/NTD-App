export const PROTOCOL_DRUG_NAMES = {
  scabies: [
    "Permethrin 5% Cream/Lotion",
    "Benzyl Benzoate 25%",
    "Sulphur 5% / 10% Ointment or Lotion",
    "Tab Ivermectin (0.2 mg/kg)",
  ],
  yaws: ["Tab Azithromycin 500mg (30mg per Kg)", "Inj Benzathine penicillin"],
  lf: [
    "Tab Ivermectin (0.2 mg/kg)",
    "Tab Albendazole 200mg",
    "Tab DEC 100mg (6 mg/kg)",
    "Doxycycline 100mg tablet",
    "Dressing Material (Compression Bandage / Wound Care)",
    "Self care kit",
  ],
  buruli: ["Tab Rifampicin 300mg (10mg per Kg)", "Tab Clarithromycin 500mg (7.5mg per kg)"],
  leprosy: ["Multi-Drug Therapy (MDT) Blister pack", "Tab Prednisolone 5mg"],
};

const numOr = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function formatMg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  const s = Number.isInteger(x) ? String(x) : String(Number(x.toFixed(1)));
  return `${s}mg`;
}

/** Dose unit + physical unit, e.g. "500mg / 5 tablets". */
export function formatDosePhysical(mg, tabs, unit = "tablet") {
  const dose = formatMg(mg);
  const n = Number(tabs);
  if (!Number.isFinite(n)) return dose || "";
  const label = Math.abs(n) === 1 ? unit : `${unit}s`;
  return [dose, `${n} ${label}`].filter(Boolean).join(" / ");
}

export function physicalUnits(mg, tabletMg) {
  if (!mg || !tabletMg) return null;
  return Math.round((mg / tabletMg) * 2) / 2;
}

export function parseTabletOptions(strength) {
  const text = String(strength || "");
  const mgHits = [...text.matchAll(/(\d+(?:\.\d+)?)\s*mg/gi)].map((m) => Number(m[1])).filter((n) => n > 0);
  if (mgHits.length) return [...new Set(mgHits)];
  const slash = text.match(/(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/);
  if (slash) return [slash[1], slash[2], slash[3]].filter(Boolean).map(Number);
  return [];
}

export function regimenDrugList(regimen, catalogue = []) {
  if (Array.isArray(regimen?.drugs) && regimen.drugs.length) {
    return regimen.drugs.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const text = String(regimen?.drugs || "");
  if (!text) return [];
  const hits = catalogue.filter((d) => text.includes(d.name)).map((d) => d.name);
  if (hits.length) return hits;
  return text
    .split(/\s*\+\s*|;\s*/)
    .map((s) => s.replace(/\s*\(.*\)\s*$/, "").trim())
    .filter(Boolean);
}

export function matchingRegimens({ regimens = [], disease, diagnosis, ageYears, weight } = {}) {
  const dx = String(diagnosis || "").trim();
  if (!dx || /^no\s/i.test(dx)) return [];
  const age = Number(ageYears);
  const wt = Number(weight);
  return (regimens || []).filter((r) => {
    if (r.disease && r.disease !== disease) return false;
    const rDx = String(r.diagnosis || "").trim();
    if (rDx && rDx !== dx) return false;
    const minA = numOr(r.ageMin, 0);
    const maxA = numOr(r.ageMax, 120);
    if (Number.isFinite(age) && (age < minA || age > maxA)) return false;
    const minW = numOr(r.weightMin, 0);
    const maxW = numOr(r.weightMax, 200);
    if (Number.isFinite(wt) && wt > 0 && (wt < minW || wt > maxW)) return false;
    return true;
  });
}

export function isTopicalForm(form) {
  const f = String(form || "").toLowerCase();
  return f === "topical" || f === "supportive";
}

export function applyMatchingRegimens({
  regimens,
  catalogue = [],
  disease,
  diagnosis,
  ageYears,
  weight,
  topical = [],
  oral = [],
  appliedKey = "",
} = {}) {
  const matched = matchingRegimens({ regimens, disease, diagnosis, ageYears, weight });
  const key = matched.map((r) => r.id).sort().join("|");
  if (key === (appliedKey || "")) return null;
  const nextTopical = [...topical];
  const nextOral = [...oral];
  const added = [];
  matched.forEach((r) => {
    regimenDrugList(r, catalogue).forEach((name) => {
      const drug = catalogue.find((d) => d.name === name);
      if (isTopicalForm(drug?.form)) {
        if (!nextTopical.includes(name)) {
          nextTopical.push(name);
          added.push(name);
        }
      } else if (!nextOral.includes(name)) {
        nextOral.push(name);
        added.push(name);
      }
    });
  });
  return {
    topical: nextTopical,
    oral: nextOral,
    added,
    regimenIds: matched.map((r) => r.id),
    regimenNames: matched.map((r) => r.name),
    regimenAppliedKey: key,
  };
}

export function extraDrugNames(diseaseId, topical = [], oral = []) {
  const protocol = new Set(PROTOCOL_DRUG_NAMES[diseaseId] || []);
  return [...topical, ...oral].filter((n) => n && !protocol.has(n));
}

export function catalogueForDisease(catalogue = [], diseaseId) {
  return catalogue.filter((d) => !(d.diseases || []).length || (d.diseases || []).includes(diseaseId));
}
