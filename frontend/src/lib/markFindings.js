/** Patch findings that ask for a count when placed on the body. */
export const PATCH_COUNT_CODES = new Set(["A", "B", "C", "D"]);

export const findingPatchCount = (f) => {
  const n = Number(f?.count);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** Normalize a body-chart mark to a list of findings. Legacy marks used a single `code`. */
export const markFindings = (m) => {
  if (!m) return [];
  if (Array.isArray(m.findings) && m.findings.length) {
    return m.findings.filter((f) => f && (f.code || f.label || f.type));
  }
  if (m.code || m.label || m.type) {
    return [{ code: m.code, label: m.label, extra: m.extra, type: m.type }];
  }
  return [];
};

export const markCodes = (m) => markFindings(m).map((f) => f.code).filter(Boolean);

export const flattenMarks = (marks = {}) =>
  Object.values(marks || {}).flatMap((m) =>
    markFindings(m).map((f) => ({
      region: m.region,
      view: m.view,
      extra: f.extra ?? m.extra,
      code: f.code,
      label: f.label || f.type || m.label,
      type: f.type || m.type,
      ...(f.count != null ? { count: f.count } : {}),
    }))
  );

export const isExclusiveFinding = (code) => code === "NO";

export const packMark = ({ view, region, findings, extra }) => {
  const list = (findings || []).filter((f) => f && (f.code || f.label || f.type));
  if (!list.length) return null;
  return {
    region,
    view,
    findings: list,
    code: list[0].code,
    label: list[0].label,
    ...(extra != null && extra !== "" ? { extra } : {}),
  };
};
