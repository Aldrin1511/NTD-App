import { localISODate } from "@/mock/specs";

export const WELLBABY_ID = "wellbaby";
export const WELLBABY_NAME = "Well Baby";
const DAY = 86400000;

export const CHIEF_COMPLAINTS = [
  "Fever", "Cough", "Cold / runny nose", "Poor feeding", "Vomiting", "Diarrhoea", "Rash",
  "Excessive crying", "Not gaining weight", "Difficulty breathing", "Ear discharge", "Constipation", "Routine check-up",
];

export const ALLERGIES = [
  "Penicillin", "Sulpha drugs", "Egg", "Cow's milk protein", "Peanut", "Aspirin", "Latex", "No known allergy",
];

/** WHO gross motor milestones with achievement windows (months). */
export const MILESTONES = [
  { id: "sit", name: "Sitting without support", min: 3.8, max: 9.2 },
  { id: "stand_assist", name: "Standing with assistance", min: 4.8, max: 11.4 },
  { id: "crawl", name: "Hands-and-knees crawling", min: 5.2, max: 13.5 },
  { id: "walk_assist", name: "Walking with assistance", min: 5.9, max: 13.7 },
  { id: "stand_alone", name: "Standing alone", min: 6.9, max: 16.9 },
  { id: "walk_alone", name: "Walking alone", min: 8.2, max: 17.6 },
];

export const WELLBABY_DRUGS = [
  "Vitamin D drops", "Iron drops", "Paracetamol syrup", "ORS", "Zinc", "Vitamin A", "Albendazole (deworming)",
];

export const immunizationDueFromDob = (item, dob) => {
  if (!dob) return "";
  const d = new Date(new Date(dob).getTime() + (item.offsetDays || 0) * DAY);
  return Number.isNaN(d.getTime()) ? "" : localISODate(d);
};

export const isVaccineOverdue = (item, rec, dob) => {
  if (rec?.given) return false;
  const due = immunizationDueFromDob(item, dob);
  if (!due) return false;
  return new Date(due).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
};

/** Family key so OPV-0 / OPV-1 / OPV-2 share one row (also TT 1/TT 2, Measles-Rubella-1/2). */
export const vaccineFamilyKey = (name = "") => {
  const n = String(name).trim();
  const ttDash = n.match(/^(.*?)\s*[—–-]\s*TT\d+/i);
  if (ttDash) return ttDash[1].trim() || "TT";
  const ttSpaced = n.match(/^TT\s*\d+/i);
  if (ttSpaced) return "TT";
  const dose = n.match(/^(.*)-\d+$/);
  if (dose) return dose[1].trim() || n;
  return n;
};

/** Group schedule vaccines by family; doses ordered by offsetDays (sequence). */
export const groupVaccinesByFamily = (vaccines = []) => {
  const order = [];
  const map = new Map();
  for (const v of vaccines) {
    const key = vaccineFamilyKey(v.name);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(v);
  }
  return order.map((family) => ({
    family,
    doses: [...map.get(family)].sort((a, b) => (a.offsetDays || 0) - (b.offsetDays || 0)),
  }));
};

export const milestoneFlag = (m, rec, ageMonths) => {
  if (rec?.achieved) return "green";
  if (ageMonths == null) return "";
  if (ageMonths > m.max) return "red";
  if (ageMonths >= m.min) return "amber";
  return "";
};

export const newWbEpisodeId = () => `WB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
