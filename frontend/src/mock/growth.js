/** Representative growth-reference engine (WHO / CDC / IAP).
 * Uses approximate median + SD anchor tables (birth → 18y) so percentile/SD,
 * colour bands and graphs behave correctly for the prototype. Not official tables.
 */

export const STANDARDS = ["WHO", "CDC", "IAP"];
export const GROWTH_MODES = ["Percentile", "SD"];

// Small representative multipliers so switching standard visibly shifts the curve.
const STD_FACTOR = { WHO: 1.0, CDC: 1.02, IAP: 0.985 };

const lerp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

// [ageMonths, median] anchors
const WEIGHT_M = [[0, 3.3], [3, 6.4], [6, 7.9], [12, 9.6], [24, 12.2], [60, 18.3], [120, 31], [156, 46], [180, 61], [216, 68]];
const WEIGHT_F = [[0, 3.2], [3, 5.8], [6, 7.3], [12, 8.9], [24, 11.5], [60, 17.7], [120, 32], [156, 47], [180, 54], [216, 57]];
const HEIGHT_M = [[0, 49.9], [3, 61.4], [6, 67.6], [12, 75.7], [24, 87.8], [60, 110], [120, 138], [156, 157], [180, 171], [216, 176]];
const HEIGHT_F = [[0, 49.1], [3, 59.8], [6, 65.7], [12, 74], [24, 86.4], [60, 109], [120, 138], [156, 157], [180, 162], [216, 163]];
const HC_M = [[0, 34.5], [3, 40.5], [6, 43.3], [12, 46], [24, 48], [36, 49], [60, 50.5]];
const HC_F = [[0, 33.9], [3, 39.5], [6, 42.2], [12, 45], [24, 47], [36, 48], [60, 49.5]];
const BMI = [[24, 16], [60, 15.5], [96, 15.8], [120, 16.5], [156, 18.5], [180, 20.5], [216, 21.5]];
const MUAC = [[3, 13], [6, 14], [12, 15], [24, 15.5], [36, 16], [60, 16.5]];

const CV = { weight: 0.12, height: 0.038, hc: 0.028, bmi: 0.13, muac: 0.08 };

export const GROWTH_METRICS = [
  { k: "weight", label: "Weight", unit: "kg", min: 1, max: 90, step: 0.1, minAgeMo: 0, maxAgeMo: 216 },
  { k: "height", label: "Height / Length", unit: "cm", min: 40, max: 190, step: 0.5, minAgeMo: 0, maxAgeMo: 216 },
  { k: "hc", label: "Head circumference", unit: "cm", min: 30, max: 55, step: 0.2, minAgeMo: 0, maxAgeMo: 60 },
  { k: "muac", label: "MUAC", unit: "cm", min: 7, max: 25, step: 0.1, minAgeMo: 3, maxAgeMo: 60 },
  { k: "bmi", label: "BMI", unit: "kg/m²", min: 10, max: 35, step: 0.1, minAgeMo: 24, maxAgeMo: 216, derived: true },
];

export const metricApplies = (metric, ageMonths) => {
  const m = GROWTH_METRICS.find((x) => x.k === metric);
  if (!m || ageMonths == null) return true;
  return ageMonths >= m.minAgeMo && ageMonths <= m.maxAgeMo;
};

export const medianFor = (metric, ageMonths, sex, standard = "WHO") => {
  const f = STD_FACTOR[standard] || 1;
  const male = String(sex).toLowerCase().startsWith("m");
  let base;
  if (metric === "weight") base = lerp(male ? WEIGHT_M : WEIGHT_F, ageMonths);
  else if (metric === "height") base = lerp(male ? HEIGHT_M : HEIGHT_F, ageMonths);
  else if (metric === "hc") base = lerp(male ? HC_M : HC_F, ageMonths);
  else if (metric === "bmi") base = lerp(BMI, ageMonths);
  else if (metric === "muac") base = lerp(MUAC, ageMonths);
  else base = 0;
  const wf = metric === "weight" || metric === "bmi" ? f : 1 + (f - 1) * 0.3;
  return base * wf;
};

export const sdFor = (metric, ageMonths, sex, standard = "WHO") => medianFor(metric, ageMonths, sex, standard) * (CV[metric] || 0.1);

const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export const bmiFrom = (weightKg, heightCm) => {
  const w = Number(weightKg); const h = Number(heightCm) / 100;
  if (!w || !h) return null;
  return Math.round((w / (h * h)) * 10) / 10;
};

/** direction: "both" (symmetric), "low" (low value is bad, e.g. weight-for-height). */
export const statusForZ = (z, direction = "both") => {
  if (z == null || Number.isNaN(z)) return "";
  if (direction === "low") {
    if (z < -3) return "red";
    if (z < -2) return "amber";
    return "green";
  }
  const a = Math.abs(z);
  if (a > 3) return "red";
  if (a > 2) return "amber";
  return "green";
};

export const percentileLabel = (p) => {
  if (p == null) return "—";
  if (p < 1) return "<1st";
  if (p > 99) return ">99th";
  const n = Math.round(p);
  const s = ["th", "st", "nd", "rd"][(n % 100 - n % 10 === 10 ? 0 : n % 10 > 3 ? 0 : n % 10)] || "th";
  return `${n}${s}`;
};

export const compute = ({ metric, value, ageMonths, sex, standard = "WHO", direction = "both" }) => {
  const v = Number(value);
  if (!v || ageMonths == null) return { z: null, percentile: null, status: "" };
  const med = medianFor(metric, ageMonths, sex, standard);
  const sd = sdFor(metric, ageMonths, sex, standard);
  if (!sd) return { z: null, percentile: null, status: "" };
  const z = Math.round(((v - med) / sd) * 100) / 100;
  const percentile = Math.round(normalCdf(z) * 1000) / 10;
  return { z, percentile, status: statusForZ(z, direction), median: Math.round(med * 10) / 10, sd: Math.round(sd * 100) / 100 };
};

/** Reference series for a graph: median, ±2SD across an age range. */
export const referenceSeries = (metric, sex, standard, fromMo, toMo, stepMo = 6) => {
  const out = [];
  for (let a = fromMo; a <= toMo; a += stepMo) {
    const med = medianFor(metric, a, sex, standard);
    const sd = sdFor(metric, a, sex, standard);
    out.push({ age: Math.round((a / 12) * 10) / 10, median: Math.round(med * 10) / 10, p2: Math.round((med + 2 * sd) * 10) / 10, m2: Math.round((med - 2 * sd) * 10) / 10 });
  }
  return out;
};

export const monthsBetween = (dob, ref) => {
  if (!dob) return null;
  const a = new Date(dob); const b = ref ? new Date(ref) : new Date();
  if (Number.isNaN(a.getTime())) return null;
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
};

export const ageMonthsToLabel = (mo) => {
  if (mo == null) return "—";
  const y = Math.floor(mo / 12); const m = mo % 12;
  if (y === 0) return `${m} mo`;
  return `${y}y ${m}m`;
};
