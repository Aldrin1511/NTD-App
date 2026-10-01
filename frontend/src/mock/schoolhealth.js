import { compute } from "@/mock/growth";

export const SCHOOL_HEALTH_ID = "schoolhealth";
export const SCHOOL_HEALTH_NAME = "School Health";
export const SCHOOL_FORM_TYPES = ["School entry", "School leaving"];

export const PHYSICAL_EXAM_ITEMS = [
  "Eyes", "Ears", "Nasal", "Pallor in lower limb", "Dental Caries", "Throat", "Neck glands", "Goitre",
  "Spleen", "Abdominal mass", "Chest infection", "Heart Murmur", "Limb deformation",
  "Sore / skin condition", "Tropical Ulcers", "Leprosy",
];

export const NTD_SCREEN_ITEMS = PHYSICAL_EXAM_ITEMS.slice(-4);

/** Yes/No immunization options for School Health child entry. */
export const SCHOOL_IMMUNIZATION = [
  { k: "mr", label: "Measles Rubella" },
  { k: "vita", label: "Vitamin A" },
  { k: "tt", label: "Tetanus Toxoid (TT)" },
  { k: "deworm", label: "Deworming" },
];

export const DEFAULT_SCHOOLS = [
  { id: "SCHL-001", name: "Wewak Primary School", province: "East Sepik", district: "Wewak District", village: "Boram" },
  { id: "SCHL-002", name: "Kreer Community School", province: "East Sepik", district: "Wewak District", village: "Kreer" },
  { id: "SCHL-003", name: "Bilbil Primary School", province: "Madang", district: "Madang District", village: "Bilbil" },
];

export const DEFAULT_DONORS = [
  { id: "DON-001", name: "WHO Papua New Guinea" },
  { id: "DON-002", name: "UNICEF PNG" },
  { id: "DON-003", name: "DFAT Australia" },
];

export const emptyChild = () => ({
  firstName: "",
  lastName: "",
  gender: "",
  ageY: "",
  ageM: "",
  ageD: "",
  age: "",
  dob: "",
  weight: "",
  height: "",
  muac: "",
  exam: {},
  immun: {},
  referred: "",
  referNote: "",
  offlineEntered: false,
  offlineAt: "",
});

export const emptyVisitReport = () => ({
  summary: "",
  conductedBy: [],
  photos: [],
  completed: false,
  totals: { mr: 0, vita: 0, tt: 0, deworm: 0, ntd: 0 },
});

/** Auto status: New → In Progress → Completed (after report completed). */
export const deriveVisitStatus = (visit) => {
  if (visit?.report?.completed) return "Completed";
  const children = visit?.children || [];
  if (children.length > 0) return "In Progress";
  return "New";
};

export const visitStatusBadgeCls = (status) => {
  const s = String(status || "");
  if (/completed/i.test(s)) return "border-green-400 bg-green-50 text-green-800";
  if (/in progress/i.test(s)) return "border-amber-400 bg-amber-50 text-amber-900";
  if (/new/i.test(s)) return "border-primary/40 bg-secondary text-primary";
  return "border-border bg-muted/40 text-muted-foreground";
};

export const childAgeMonths = (child) => {
  if (child.dob) {
    const a = new Date(child.dob); const b = new Date();
    if (!Number.isNaN(a.getTime())) return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  }
  const y = Number(child.ageY ?? child.age) || 0;
  const m = Number(child.ageM) || 0;
  if (y || m) return y * 12 + m;
  if (child.age) return Math.round(Number(child.age) * 12);
  return null;
};

export const formatChildAge = (child) => {
  const y = child.ageY !== undefined && child.ageY !== "" ? child.ageY : child.age;
  const m = child.ageM;
  const d = child.ageD;
  const parts = [];
  if (y !== undefined && y !== "" && y !== null) parts.push(`${y}y`);
  if (m !== undefined && m !== "" && m !== null && Number(m) !== 0) parts.push(`${m}m`);
  if (d !== undefined && d !== "" && d !== null && Number(d) !== 0) parts.push(`${d}d`);
  if (parts.length) return parts.join(" ");
  if (child.age) return `${child.age}y`;
  return "—";
};

const worst = (a, b) => { const rank = { red: 3, amber: 2, green: 1, "": 0 }; return rank[a] >= rank[b] ? a : b; };

export const childStatus = (child) => {
  const ageMonths = childAgeMonths(child);
  const sex = child.gender;
  let st = "";
  if (child.weight) st = worst(st, compute({ metric: "weight", value: child.weight, ageMonths, sex, direction: "low" }).status);
  if (child.height) st = worst(st, compute({ metric: "height", value: child.height, ageMonths, sex, direction: "low" }).status);
  if (child.muac) st = worst(st, compute({ metric: "muac", value: child.muac, ageMonths, sex, direction: "low" }).status);
  return st || "green";
};

export const negativeExamItems = (child) =>
  PHYSICAL_EXAM_ITEMS.filter((item) => child.exam?.[item]?.result === "Normal");

/** Suspected NTD when any of the last 4 physical-exam items is Abnormal. */
export const isSuspectedNtd = (child) =>
  NTD_SCREEN_ITEMS.some((item) => child.exam?.[item]?.result === "Abnormal");

export const immunSummary = (child) => {
  const immun = child.immun || {};
  return SCHOOL_IMMUNIZATION.filter((v) => immun[v.k] === "Yes").map((v) => v.label).join(", ") || "—";
};

export const visitImmunTotals = (visit) => {
  const children = visit?.children || [];
  return children.reduce(
    (acc, c) => {
      if (c.immun?.mr === "Yes") acc.mr += 1;
      if (c.immun?.vita === "Yes") acc.vita += 1;
      if (c.immun?.tt === "Yes") acc.tt += 1;
      if (c.immun?.deworm === "Yes") acc.deworm += 1;
      if (isSuspectedNtd(c)) acc.ntd += 1;
      return acc;
    },
    { mr: 0, vita: 0, tt: 0, deworm: 0, ntd: 0 }
  );
};
