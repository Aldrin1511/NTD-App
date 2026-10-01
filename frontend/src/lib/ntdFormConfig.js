/**
 * Apply ApplicationConfig payloads from portal-be onto the in-memory DISEASE_SPECS /
 * suspect constants used by the NTD React forms.
 *
 * Mutates shared object references so existing `import { DISEASE_SPECS }` keep working.
 */
export function applyNtdFormConfigs(payload, {
  DISEASE_SPECS,
  SUSPECT_SYMPTOMS,
  SUSPECT_OPTIONS,
  sharedTargets = {},
} = {}) {
  if (!payload || typeof payload !== "object") return false;
  let applied = false;

  const diseases = payload.diseases || {};
  if (DISEASE_SPECS && typeof DISEASE_SPECS === "object") {
    Object.entries(diseases).forEach(([id, spec]) => {
      if (!spec || typeof spec !== "object") return;
      if (DISEASE_SPECS[id] && typeof DISEASE_SPECS[id] === "object") {
        Object.keys(DISEASE_SPECS[id]).forEach((k) => {
          delete DISEASE_SPECS[id][k];
        });
        Object.assign(DISEASE_SPECS[id], spec, { id: spec.id || id });
      } else {
        DISEASE_SPECS[id] = { ...spec, id: spec.id || id };
      }
      applied = true;
    });
  }

  const suspect = payload.suspect;
  if (suspect) {
    if (Array.isArray(suspect.symptoms) && Array.isArray(SUSPECT_SYMPTOMS)) {
      SUSPECT_SYMPTOMS.splice(0, SUSPECT_SYMPTOMS.length, ...suspect.symptoms);
      applied = true;
    }
    if (Array.isArray(suspect.options) && Array.isArray(SUSPECT_OPTIONS)) {
      SUSPECT_OPTIONS.splice(0, SUSPECT_OPTIONS.length, ...suspect.options);
      applied = true;
    }
    const shared = suspect.shared || {};
    Object.entries(sharedTargets).forEach(([key, target]) => {
      if (!Array.isArray(target) || !Array.isArray(shared[key])) return;
      target.splice(0, target.length, ...shared[key]);
      applied = true;
    });
  }

  return applied;
}
