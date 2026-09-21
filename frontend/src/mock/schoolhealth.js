import { compute } from "@/mock/growth";

export const SCHOOL_STATUSES = ["Planned", "In progress", "Completed"];

export const PHYSICAL_EXAM_ITEMS = [
  "Eyes", "Ears", "Nasal", "Pallor in lower limb", "Dental Caries", "Throat", "Neck glands", "Goitre",
  "Spleen", "Abdominal mass", "Chest infection", "Heart Murmur", "Limb deformation",
  "Sore / skin condition", "Tropical Ulcers", "Leprosy",
];

export const SCHOOL_IMMUNIZATION = [
  { k: "tt", label: "Tetanus Toxoid", doses: [1, 2] },
  { k: "pigbel", label: "Pig Bel", doses: [1, 2, 3] },
  { k: "bcg", label: "BCG", doses: [0, 1, 2, 3, 4] },
];

export const childAgeMonths = (child) => {
  if (child.dob) {
    const a = new Date(child.dob); const b = new Date();
    if (!Number.isNaN(a.getTime())) return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  }
  if (child.age) return Math.round(Number(child.age) * 12);
  return null;
};

const worst = (a, b) => { const rank = { red: 3, amber: 2, green: 1, "": 0 }; return rank[a] >= rank[b] ? a : b; };

/** Overall red/amber/green status from a child's vitals. */
export const childStatus = (child) => {
  const ageMonths = childAgeMonths(child);
  const sex = child.gender;
  let st = "";
  if (child.weight) st = worst(st, compute({ metric: "weight", value: child.weight, ageMonths, sex, direction: "low" }).status);
  if (child.height) st = worst(st, compute({ metric: "height", value: child.height, ageMonths, sex, direction: "low" }).status);
  if (child.muac) st = worst(st, compute({ metric: "muac", value: child.muac, ageMonths, sex, direction: "low" }).status);
  return st || "green";
};

export const emptyChild = () => ({ firstName: "", lastName: "", gender: "", age: "", dob: "", weight: "", height: "", muac: "", exam: {}, immun: {}, referred: "", referNote: "" });
