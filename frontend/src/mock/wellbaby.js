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

/** Default posology + advice for Well Baby drug cards (ANC-style). */
export const WELLBABY_DRUG_META = {
  "Vitamin D drops": {
    dosage: "400 IU orally",
    frequency: "Once daily",
    duration: "As per protocol",
    advice: [
      "Start from birth for exclusively breastfed infants when indicated.",
      "Continue through infancy per national guidance.",
    ],
  },
  "Iron drops": {
    dosage: "As per age / weight",
    frequency: "Once daily",
    duration: "As prescribed",
    advice: [
      "Usually from 6 months in exclusively breastfed infants if diet is low in iron.",
      "Warn about dark stools; give between meals when possible.",
    ],
  },
  "Paracetamol syrup": {
    dosage: "10–15 mg/kg orally",
    frequency: "Every 6–8 hours PRN",
    duration: "As needed for fever/pain",
    advice: [
      "Do not exceed maximum daily dose.",
      "Use for fever ≥38°C or significant pain.",
    ],
    note: "Confirm concentration on the bottle before dosing.",
  },
  ORS: {
    dosage: "As per dehydration plan",
    frequency: "After each loose stool / as needed",
    duration: "Until diarrhoea settles",
    advice: [
      "Give small frequent sips.",
      "Continue breastfeeding / age-appropriate feeding.",
    ],
  },
  Zinc: {
    dosage: "10–20 mg orally",
    frequency: "Once daily",
    duration: "10–14 days",
    advice: [
      "Give during acute diarrhoea episodes.",
      "May cause vomiting — give with food if needed.",
    ],
  },
  "Vitamin A": {
    dosage: "Age-appropriate mega-dose",
    frequency: "As per schedule",
    duration: "Single / periodic dose",
    advice: [
      "Follow national vitamin A supplementation schedule.",
      "Do not give within 1 month of a previous mega-dose unless protocol allows.",
    ],
  },
  "Albendazole (deworming)": {
    dosage: "400 mg orally (or age-adjusted)",
    frequency: "Single dose",
    duration: "Once",
    advice: [
      "Usually from 12–24 months per national deworming schedule.",
      "Repeat as per campaign / protocol.",
    ],
    note: "Avoid in infants under the age indicated by local guidance.",
  },
};

export const WELLBABY_LAB_TESTS = [
  { name: "HIV test", results: ["Reactive", "Non-reactive", "Indeterminate"] },
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

/**
 * Entry view only: show at-birth always; later doses only from `leadDays` before due
 * (or if already given / manually revealed). Else use the add dropdown.
 */
export const isEntryDoseVisible = (item, rec, dob, revealedIds = [], leadDays = 7, asOf = new Date()) => {
  if (!item) return false;
  if ((item.offsetDays || 0) === 0) return true;
  if (rec?.given) return true;
  if ((revealedIds || []).includes(item.id)) return true;
  const due = immunizationDueFromDob(item, dob);
  if (!due) return false;
  const dueStart = new Date(due);
  dueStart.setHours(0, 0, 0, 0);
  const openAt = dueStart.getTime() - leadDays * DAY;
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return today.getTime() >= openAt;
};

export const entryVisibleVaccines = (vaccines = [], records = {}, dob, revealedIds = [], asOf) =>
  (vaccines || []).filter((item) => isEntryDoseVisible(item, records?.[item.id], dob, revealedIds, 7, asOf));

export const entryDropdownVaccines = (vaccines = [], records = {}, dob, revealedIds = [], asOf) =>
  (vaccines || []).filter((item) => !isEntryDoseVisible(item, records?.[item.id], dob, revealedIds, 7, asOf));

/** Preferred family display order for childhood EPI (and similar schedules). */
export const VACCINE_FAMILY_ORDER = [
  "BCG",
  "Hepatitis B (birth dose)",
  "Hepatitis B",
  "Hepatitis",
  "OPV",
  "Pentavalent",
  "PCV",
  "Vitamin A",
  "Vitamin",
  "Measles-Rubella",
  "Measles",
];

const familyOrderIndex = (family) => {
  const f = String(family || "");
  const exact = VACCINE_FAMILY_ORDER.findIndex((k) => k.toLowerCase() === f.toLowerCase());
  if (exact >= 0) return exact;
  const partial = VACCINE_FAMILY_ORDER.findIndex((k) => f.toLowerCase().startsWith(k.toLowerCase()) || k.toLowerCase().startsWith(f.toLowerCase()));
  return partial >= 0 ? partial : 999;
};

/** Family key so OPV-0 / OPV-1 / OPV-2 share one row (also TT 1/TT 2, Measles-Rubella-1/2). */
export const vaccineFamilyKey = (name = "") => {
  const n = String(name).trim();
  if (/^hepatitis\b/i.test(n)) return "Hepatitis";
  if (/^vitamin\b/i.test(n)) return "Vitamin";
  if (/^measles\b/i.test(n)) return "Measles";
  const ttDash = n.match(/^(.*?)\s*[—–-]\s*TT\d+/i);
  if (ttDash) return ttDash[1].trim() || "TT";
  const ttSpaced = n.match(/^TT\s*\d+/i);
  if (ttSpaced) return "TT";
  const dose = n.match(/^(.*)-\d+$/);
  if (dose) return dose[1].trim() || n;
  return n;
};

/** Group schedule vaccines by family; families follow EPI sequence, doses by offsetDays. */
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
  return order
    .sort((a, b) => {
      const ia = familyOrderIndex(a);
      const ib = familyOrderIndex(b);
      if (ia !== ib) return ia - ib;
      // Keep schedule insertion order (e.g. TT row before Tdap)
      return order.indexOf(a) - order.indexOf(b);
    })
    .map((family) => ({
      family,
      doses: [...map.get(family)].sort((a, b) => (a.offsetDays || 0) - (b.offsetDays || 0)),
    }));
};

/** Bar color only after selection: green (early/fine) → amber (late in window) → red (past window). Default = amber. */
/** Timing flag for a milestone achievement vs WHO window.
 * green = on/before window end (within bar or earlier)
 * amber = up to 2 weeks after window end
 * red = later than 2 weeks past window end
 * "" = not yet recorded (neutral bar)
 */
export const milestoneFlag = (m, rec, ageMonths, achievedAgeMonths = null) => {
  if (!rec?.achieved) return "";
  const at = achievedAgeMonths != null ? achievedAgeMonths : ageMonths;
  if (at == null) return "green";
  if (at <= m.max) return "green";
  const lateByMonths = at - m.max;
  const twoWeeksMo = 14 / 30.437;
  if (lateByMonths <= twoWeeksMo) return "amber";
  return "red";
};

export const newWbEpisodeId = () => `WB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
