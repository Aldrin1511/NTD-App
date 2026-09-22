/** Admin-editable Masters: immunization schedules, lab master, per-condition feature config. */

export const DEFAULT_IMMUNIZATION_SCHEDULES = [
  {
    id: "epi-child",
    name: "Childhood EPI schedule",
    condition: "wellbaby",
    vaccines: [
      { id: "bcg", name: "BCG", offsetDays: 0, note: "At birth" },
      { id: "opv0", name: "OPV-0", offsetDays: 0, note: "At birth" },
      { id: "hepb0", name: "Hepatitis B (birth dose)", offsetDays: 0, note: "Within 24h" },
      { id: "penta1", name: "Pentavalent-1", offsetDays: 42, note: "6 weeks" },
      { id: "opv1", name: "OPV-1", offsetDays: 42, note: "6 weeks" },
      { id: "pcv1", name: "PCV-1", offsetDays: 42, note: "6 weeks" },
      { id: "penta2", name: "Pentavalent-2", offsetDays: 70, note: "10 weeks" },
      { id: "opv2", name: "OPV-2", offsetDays: 70, note: "10 weeks" },
      { id: "pcv2", name: "PCV-2", offsetDays: 70, note: "10 weeks" },
      { id: "penta3", name: "Pentavalent-3", offsetDays: 98, note: "14 weeks" },
      { id: "opv3", name: "OPV-3", offsetDays: 98, note: "14 weeks" },
      { id: "pcv3", name: "PCV-3", offsetDays: 98, note: "14 weeks" },
      { id: "vita6", name: "Vitamin A", offsetDays: 182, note: "6 months" },
      { id: "mr1", name: "Measles-Rubella-1", offsetDays: 273, note: "9 months" },
      { id: "mr2", name: "Measles-Rubella-2", offsetDays: 548, note: "18 months" },
    ],
  },
  {
    id: "anc-tt",
    name: "Antenatal Tetanus schedule",
    condition: "antenatal",
    vaccines: [
      { id: "tt1", name: "Tetanus Toxoid — TT1", offsetDays: 0, note: "At first ANC contact" },
      { id: "tt2", name: "Tetanus Toxoid — TT2", offsetDays: 28, note: "≥4 weeks after TT1" },
      { id: "tdap", name: "Tdap", offsetDays: 189, note: "27–36 weeks GA" },
    ],
  },
];

export const DEFAULT_LAB_MASTER = [
  { id: "hb", name: "Haemoglobin (Hb)", results: ["Normal", "Mild anaemia", "Moderate anaemia", "Severe anaemia"], location: "Bedside" },
  { id: "bg", name: "ABO Blood Group", results: ["A", "B", "AB", "O"], location: "Lab" },
  { id: "rh", name: "Rh Typing", results: ["Positive", "Negative"], location: "Lab" },
  { id: "hiv", name: "HIV", results: ["Reactive", "Non-reactive", "Indeterminate"], location: "Bedside" },
  { id: "vdrl", name: "Syphilis (VDRL/RPR)", results: ["Reactive", "Non-reactive"], location: "Bedside" },
  { id: "hbsag", name: "Hepatitis B (HBsAg)", results: ["Positive", "Negative"], location: "Bedside" },
  { id: "rbs", name: "Random Blood Sugar", results: ["Normal", "Raised"], location: "Bedside" },
  { id: "mrdt", name: "Malaria RDT", results: ["Positive", "Negative"], location: "Bedside" },
  { id: "urine", name: "Urine Albumin", results: ["Nil", "Trace", "+", "++", "+++"], location: "Bedside" },
  { id: "stool", name: "Stool R/E", results: ["No ova/cyst", "Ova seen", "Cyst seen"], location: "Lab" },
];

/** Per-condition feature list; Admin can reorder + toggle "print in summary". */
export const CONDITION_FEATURE_DEFS = {
  wellbaby: [
    ["delivery", "Delivery & new born details"],
    ["complaints", "Chief complaints"],
    ["allergy", "Allergy"],
    ["growth", "Growth chart"],
    ["immunization", "Immunization"],
    ["milestones", "Gross motor milestones"],
    ["notes", "Visit notes"],
    ["drugs", "Drugs"],
    ["lab", "Laboratory"],
  ],
  malnutrition: [
    ["caseDetails", "Case details"],
    ["initial", "Initial assessment"],
    ["monitoring", "Monitoring"],
    ["outcome", "Case outcome"],
  ],
  antenatal: [
    ["caseDetails", "Case details"],
    ["history", "History"],
    ["vitals", "Vitals"],
    ["lab", "Laboratory"],
    ["radiology", "Radiology"],
    ["drugs", "Drugs"],
    ["immunization", "Immunization"],
    ["delivery", "Delivery & new born"],
    ["outcome", "Outcome"],
  ],
};

export const CONDITION_LABELS = { wellbaby: "Well Baby", malnutrition: "Malnutrition", antenatal: "Ante Natal" };

export const DEFAULT_FEATURE_CONFIG = Object.fromEntries(
  Object.entries(CONDITION_FEATURE_DEFS).map(([cond, feats]) => [
    cond,
    feats.map(([key, label], i) => ({ key, label, order: i, print: true, enabled: true })),
  ])
);
