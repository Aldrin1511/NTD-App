export const SUSPECT_SYMPTOMS = [
  "Itching", "Severe itching", "Itching worse at night", "Rash", "Skin problem", "Skin lesion",
  "Multiple skin lesions", "Skin swelling", "Skin thickening", "Skin cracking", "Skin scaling",
  "Crusting", "Skin pain", "Skin tenderness", "Burning skin", "Skin discoloration",
  "Pale/white skin patch", "Red skin patch", "Dark skin patch", "Numb skin", "Loss of sensation",
  "Tingling", "Pins and needles", "Weakness", "General fatigue", "Fever", "Chills",
  "Sleep disturbance", "Difficulty working", "Difficulty attending school", "Reduced mobility",
];

export const SUSPECT_OPTIONS = [
  { id: "scabies", label: "Suspected Scabies" },
  { id: "yaws", label: "Suspected Yaws" },
  { id: "buruli", label: "Suspected Buruli Ulcer" },
  { id: "lf", label: "Suspected Lymphatic Filariasis" },
  { id: "leprosy", label: "Suspected Leprosy" },
  { id: "other", label: "Suspected Other NTDs" },
  { id: "none", label: "No NTD suspected" },
];

export const MODE_OF_DETECTION = ["Voluntary", "Referral", "Household contact", "MDA", "Special project", "Others"];
export const REFERRED_BY = ["Family member", "Village health worker", "Former patient", "Volunteer"];
export const CASE_TYPES = ["New", "Relapse", "Transfer in"];
export const CONSENT = ["No", "By paper", "By verbal"];
export const AGE_SEX_GROUPS = ["Male child (<15y)", "Male adult (15y+)", "Female child (<15y)", "Female adult (15y+)"];
export const CONTACT_STATUS = ["Symptomatic", "Asymptomatic"];
export const RELATIONSHIPS = ["Spouse", "Parent", "Child", "Sibling", "Grandparent", "Grandchild", "Other relative", "Household member", "Neighbour"];
export const TEST_RESULT = ["Positive", "Negative", "Pending", "Not done"];
export const DETECT_RESULT = ["Detected", "Not detected", "Pending", "Not done"];
export const VISIT_TYPES_DEFAULT = ["Initial encounter", "Follow-up", "Treatment review", "Home visit", "Outreach / community screening", "Referral visit"];

const pastMedical = [
  { k: "conditions", label: "Do you have any other medical problems?", type: "checks", options: ["TB", "HIV", "Diabetes", "Cancer", "Don't know", "None"] },
  { k: "medications", label: "What medications are you on?", type: "lines", placeholder: "Medication name" },
  { k: "allergy", label: "Are you allergic to any drugs?", type: "yesno" },
  { k: "allergyDetail", label: "Allergy details", type: "textarea", when: ["allergy", "Yes"] },
];

const commonHpc = [
  { k: "onsetHow", label: "How did it start?", type: "textarea" },
  { k: "onsetWhen", label: "When did it start?", type: "duration" },
  { k: "tookMeds", label: "Did you take any medication?", type: "yesno" },
  { k: "medsTaken", label: "Medication taken", type: "lines", when: ["tookMeds", "Yes"], placeholder: "Medication name" },
  { k: "firstTime", label: "Is this the first time?", type: "yesno" },
  { k: "communitySimilar", label: "Anyone in the community with similar symptoms?", type: "yesno" },
];

const commonInterrogation = [
  { k: "jointPain", label: "Do you have pain in your joints / bone?", type: "yesno" },
  { k: "fever", label: "Do you have any fever?", type: "choice", options: ["High", "Moderate", "Low", "No"] },
  { k: "chills", label: "Do you have chills?", type: "yesno" },
  { k: "trauma", label: "Do you have history of trauma?", type: "yesno" },
  { k: "lymphadenopathy", label: "Do you have lymphadenopathy?", type: "yesno" },
];

const caseDetails = [
  { k: "mode", label: "Mode of detection", type: "select", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "select", options: REFERRED_BY, when: ["mode", "Referral"] },
  { k: "caseType", label: "Case type", type: "select", options: CASE_TYPES },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const household = (drugs) => [
  { k: "hhTotal", label: "Total household contacts", type: "groupCount", options: AGE_SEX_GROUPS },
  { k: "hhSymptomatic", label: "Household contacts with similar symptoms", type: "groupCount", options: AGE_SEX_GROUPS,
    note: "For these contacts, please register a new patient and create a disease record." },
  ...drugs.map((d, i) => ({ k: `hhProphylaxis${i}`, label: `Asymptomatic contacts given preventive ${d}`, type: "groupCount", options: AGE_SEX_GROUPS })),
  { k: "contacts", label: "Contact register", type: "contactTable", prophylaxis: ["None", ...drugs] },
];

export const DISEASE_SPECS = {
  scabies: {
    id: "scabies", name: "Scabies", icd: "B86",
    bodyChart: { views: ["front", "back"], codes: [
      ["B", "Burrows / tunnels"], ["P", "Papules"], ["V", "Vesicles"], ["PU", "Pustules"],
      ["C", "Crusted skin"], ["E", "Excoriations / scratches"], ["NO", "No lesions"]] },
    caseDetails,
    history: [
      { k: "itching", label: "Does the patient have itching?", type: "yesno" },
      { k: "itchNight", label: "Is the itching worse at night?", type: "yesno" },
      { k: "familySimilar", label: "Other family members with similar symptoms?", type: "yesno" },
      { k: "priorScabies", label: "Diagnosed with scabies before?", type: "yesno" },
      { k: "priorWhen", label: "When were you diagnosed?", type: "duration", when: ["priorScabies", "Yes"] },
      { k: "priorTreatment", label: "What treatment did you take?", type: "checks", options: ["Permethrin cream", "Tab Ivermectin"], when: ["priorScabies", "Yes"] },
      { k: "feverQ", label: "Do you have any fever?", type: "yesno" },
      { k: "chestPain", label: "Any chest pain or shortness of breath?", type: "yesno" },
      { k: "urine", label: "Is urine output low or tea-coloured?", type: "yesno" },
      { k: "swelling", label: "Any swelling of face, arms or legs?", type: "yesno" },
      ...pastMedical,
    ],
    assessmentExtra: [
      { k: "secondaryInfection", label: "Secondary infection?", type: "yesno" },
      { k: "skinScraping", label: "Skin scraping", type: "choice", options: ["Mite identified", "Eggs / faecal pellets identified", "Negative", "Not done"] },
    ],
    lab: [
      { k: "dermoscope", label: "Dermoscope", type: "choice", options: TEST_RESULT },
      { k: "specimenDate", label: "Specimen date", type: "date" },
    ],
    diagnosis: ["Confirmed Scabies", "Crusted Scabies", "Suspected Scabies", "No Scabies"],
    drugs: {
      topical: ["Permethrin cream 5%", "Permethrin cream 2%", "Benzyl benzoate 25%", "Benzyl benzoate 10%", "Topical antibiotic"],
      oral: [{ name: "Tab Ivermectin", mgPerKg: 0.2, tablet: 3 }, { name: "Oral antibiotic" }],
    },
    household: household(["Tab Ivermectin", "Permethrin cream"]),
    outcomes: ["Open", "Healed", "No change", "Worse", "No Scabies", "Lost to follow-up"],
    recommendations: ["Referred for further review"],
  },

  yaws: {
    id: "yaws", name: "Yaws", icd: "A66",
    bodyChart: { views: ["front", "back"], codes: [
      ["T", "Thick skin patch"], ["U", "Ulcer"], ["P", "Papilloma"], ["J", "Joint swelling"],
      ["BC", "Bone / cartilage deformity"], ["NO", "No lesions"]] },
    caseDetails,
    history: [
      { k: "keyComplaints", label: "Key presenting complaints", type: "checks", options: ["Ulcer", "Joint swelling", "Bone pain", "Yellow papilloma"] },
      ...commonHpc,
      { k: "jointPain", label: "Pain in joints / bone?", type: "yesno" },
      { k: "feverQ", label: "Any fever?", type: "yesno" },
      { k: "swelling", label: "Any swelling?", type: "yesno" },
      { k: "heelSores", label: "Sores on your heel?", type: "yesno" },
      { k: "footCracks", label: "Thick skin patches or cracks under the foot?", type: "yesno" },
      { k: "familySimilar", label: "Anyone in the family with similar symptoms?", type: "yesno" },
      { k: "familyYaws", label: "Anyone in the family diagnosed / treated for Yaws?", type: "yesno" },
      ...pastMedical,
    ],
    assessmentExtra: [{ k: "secondaryInfection", label: "Secondary infection?", type: "yesno" }],
    lab: [
      { k: "rdt", label: "RDT", type: "choice", options: TEST_RESULT },
      { k: "dfaPcr", label: "DFA / PCR", type: "choice", options: DETECT_RESULT },
      { k: "darkfield", label: "Darkfield microscopy", type: "choice", options: DETECT_RESULT },
      { k: "rdtDpp", label: "RDT / DPP", type: "choice", options: DETECT_RESULT },
      { k: "specimenDate", label: "Specimen date", type: "date" },
    ],
    diagnosis: ["Primary Yaws", "Secondary Yaws", "Tertiary Yaws", "Suspected Yaws", "No Yaws"],
    drugs: {
      topical: ["Topical antibiotic"],
      oral: [{ name: "Tab Azithromycin 500mg", mgPerKg: 30, tablet: 500 }, { name: "Inj Benzathine penicillin", fixed: "0.6 MU (<10y) / 1.2 MU (10y+)" }, { name: "Oral antibiotic" }],
    },
    household: household(["Tab Azithromycin", "Inj Benzathine penicillin"]),
    outcomes: ["Open", "Healed", "Improved", "No change", "No Yaws", "New lesions", "Lost to follow-up"],
    recommendations: ["Referred for further review"],
  },

  lf: {
    id: "lf", name: "Lymphatic Filariasis", icd: "B74",
    bodyChart: { views: ["front"], codes: [
      ["S1", "Stage 1 (reversible) — mild"], ["S2", "Stage 2 (not reversible) — mild"],
      ["S3", "Stage 3 (shallow fold) — moderate"], ["S4", "Stage 4 (knobs) — severe"],
      ["S5", "Stage 5 (deep folds) — severe"], ["S6", "Stage 6 (mossy lesions) — severe"],
      ["S7", "Stage 7 (incapacitated) — severe"]],
      perLesion: { k: "secondary", label: "Secondary infection", options: ["None", "Acute", "Mild", "Chronic"] } },
    caseDetails,
    history: [...commonHpc, ...commonInterrogation, ...pastMedical],
    assessmentExtra: [],
    lab: [
      { k: "thickSmear", label: "Thick smear", type: "choice", options: TEST_RESULT },
      { k: "pcr", label: "PCR", type: "choice", options: DETECT_RESULT },
      { k: "rdt", label: "RDT", type: "choice", options: DETECT_RESULT },
      { k: "specimenDate", label: "Specimen date", type: "date" },
    ],
    diagnosis: ["Confirmed Lymphatic Filariasis", "Acute Adenolymphangitis", "No Lymphatic Filariasis"],
    drugs: {
      topical: ["Dressing material", "Self-care kit"],
      oral: [{ name: "Tab Ivermectin 3mg", mgPerKg: 0.2, tablet: 3 }, { name: "Tab Albendazole", fixed: "200mg (<10y) / 400mg (10y+)" }, { name: "Tab DEC 50mg", mgPerKg: 6, tablet: 50 }],
    },
    household: household(["Tab Ivermectin", "Tab Albendazole"]),
    outcomes: ["Open", "No change", "No Lymphatic Filariasis", "MMDP", "Lost to follow-up"],
    recommendations: ["Referred for further review", "Referred for surgery", "Self care"],
  },

  buruli: {
    id: "buruli", name: "Buruli Ulcer", icd: "A31.1",
    bodyChart: { views: ["front", "back"], codes: [
      ["PA", "Painless papule"], ["PN", "Painless nodule"], ["PPl", "Painless plaque"],
      ["O", "Oedema"], ["NU", "Necrotic ulcer with undermining edges"]],
      perLesion: { k: "category", label: "Category", options: ["Category 1", "Category 2", "Category 3"] } },
    caseDetails,
    history: [...commonHpc, ...commonInterrogation, ...pastMedical],
    assessmentExtra: [],
    lab: [
      { k: "zn", label: "ZN", type: "choice", options: TEST_RESULT },
      { k: "pcr", label: "PCR", type: "choice", options: DETECT_RESULT },
      { k: "specimenDate", label: "Specimen date", type: "date" },
    ],
    diagnosis: ["Suspected Buruli Ulcer", "Confirmed Buruli Ulcer", "No Buruli Ulcer"],
    drugs: {
      oral: [{ name: "Tab Rifampicin 300mg", mgPerKg: 10, tablet: 300 }, { name: "Tab Clarithromycin 500mg", mgPerKg: 7.5, tablet: 500 }],
    },
    adherence: { unit: "week", count: 8, label: "8-week treatment schedule" },
    household: household(["Tab Rifampicin", "Tab Clarithromycin"]),
    outcomes: ["Open", "Healed", "No change", "No Buruli Ulcer", "MMDP", "Lost to follow-up"],
    recommendations: ["Referred for further review", "Referred for surgery", "Self care"],
  },

  leprosy: {
    id: "leprosy", name: "Leprosy", icd: "A30",
    bodyChart: { views: ["front", "back"], codes: [
      ["PT", "Skin patch"], ["N", "Enlarged / tender nerve"], ["CL", "Claw finger / toe"],
      ["BL", "Bone loss"], ["UL", "Ulcer / wound / burn"], ["NO", "No lesions"]] },
    caseDetails,
    history: [...commonHpc, ...commonInterrogation, ...pastMedical],
    assessmentExtra: [
      { k: "patches", label: "Number of skin patches", type: "number" },
      { k: "nerves", label: "Number of nerves affected (max 12)", type: "number" },
      { k: "sensoryHands", label: "Sensation loss — hands", type: "choice", options: ["None", "Left", "Right", "Both"] },
      { k: "sensoryFeet", label: "Sensation loss — feet", type: "choice", options: ["None", "Left", "Right", "Both"] },
      { k: "sensoryEyes", label: "Eyes not blinking normally", type: "choice", options: ["None", "Left", "Right", "Both"] },
      { k: "vmtEye", label: "VMT — tight eye closure", type: "choice", options: ["Strong (0)", "Weak (1)", "Paralysed (2)"] },
      { k: "vmtWrist", label: "VMT — wrist up", type: "choice", options: ["Strong (0)", "Weak (1)", "Paralysed (2)"] },
      { k: "vmtFinger", label: "VMT — little finger out", type: "choice", options: ["Strong (0)", "Weak (1)", "Paralysed (2)"] },
      { k: "vmtFoot", label: "VMT — foot up", type: "choice", options: ["Strong (0)", "Weak (1)", "Paralysed (2)"] },
      { k: "vmtThumb", label: "VMT — thumb up", type: "choice", options: ["Strong (0)", "Weak (1)", "Paralysed (2)"] },
      { k: "visionAcuity", label: "Vision acuity", type: "text" },
    ],
    lab: [
      { k: "slitSkin", label: "Slit skin smear", type: "choice", options: TEST_RESULT },
      { k: "rdt", label: "RDT", type: "choice", options: TEST_RESULT },
      { k: "specimenDate", label: "Specimen date", type: "date" },
    ],
    diagnosis: ["Paucibacillary (PB)", "Multibacillary (MB)", "No Leprosy"],
    drugs: {
      oral: [
        { name: "Cap Rifampicin 300mg / 150mg" }, { name: "Cap Clofazimine 100mg / 50mg" },
        { name: "Tab Dapsone 100mg / 50mg" }, { name: "Tab Prednisolone 5mg (reaction)" },
        { name: "Cap Rifampicin — SDR-PEP" },
      ],
    },
    adherence: { unit: "month", count: 12, label: "MDT month-wise schedule (PB 6, MB 12+)", restart: true },
    household: household(["SDR-PEP"]),
    outcomes: ["Open", "Healed", "No change", "No Leprosy", "MMDP", "Lost to follow-up"],
    recommendations: ["Referred for further review", "Referred for surgery", "Self care"],
  },
};

export const SPEC_LIST = Object.values(DISEASE_SPECS);

export const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")}-${m}-${d.getFullYear()}`;
};

export const leprosyScores = (d = {}) => {
  const side = (v) => (v === "Both" ? 2 : v === "None" || !v ? 0 : 1);
  const vmt = (v) => (v?.includes("(2)") ? 2 : v?.includes("(1)") ? 1 : 0);
  const eyes = side(d.sensoryEyes) + vmt(d.vmtEye);
  const hands = side(d.sensoryHands) + vmt(d.vmtWrist) + vmt(d.vmtFinger) + vmt(d.vmtThumb);
  const feet = side(d.sensoryFeet) + vmt(d.vmtFoot);
  const cap = (n) => Math.min(n, 4);
  const ehf = cap(eyes) + cap(hands) + cap(feet);
  const g2d = Math.min(2, Math.max(eyes ? (eyes >= 2 ? 2 : 1) : 0, hands ? (hands >= 2 ? 2 : 1) : 0, feet ? (feet >= 2 ? 2 : 1) : 0));
  return { eyes, hands, feet, ehf: Math.min(ehf, 12), g2d };
};

export const leprosyClass = (d = {}) => {
  const patches = Number(d.patches || 0);
  const nerves = Number(d.nerves || 0);
  if (d.slitSkin === "Positive") return `Multibacillary (MB) (${patches} patches, ${nerves} nerves)`;
  if (!patches && !nerves) return "No Leprosy (0 patches, 0 nerves)";
  if (patches >= 6 && nerves > 1) return `Multibacillary (MB) (${patches} patches, ${nerves} nerves)`;
  return `Paucibacillary (PB) (${patches} patches, ${nerves} nerves)`;
};

export const yawsClass = (marks = {}) => {
  const codes = Object.values(marks).map((m) => m.code);
  if (codes.includes("BC")) return "Tertiary Yaws";
  const p = codes.filter((c) => c === "P").length;
  const u = codes.filter((c) => c === "U").length;
  if (p + u === 0) return "";
  if (p <= 1 && u <= 1 && p + u <= 2) return "Primary Yaws";
  return "Secondary Yaws";
};
