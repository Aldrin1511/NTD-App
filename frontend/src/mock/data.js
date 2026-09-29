/** Shared reference lists used by the NTD UI (not fake patient/user seed data). */

export const DISEASES = [
  { id: "scabies", name: "Scabies", icd: "B86", flow: "full" },
  { id: "yaws", name: "Yaws", icd: "A66", flow: "generic" },
  { id: "buruli", name: "Buruli Ulcer", icd: "A31.1", flow: "generic" },
  { id: "lf", name: "Lymphatic Filariasis", icd: "B74", flow: "generic" },
  { id: "leprosy", name: "Leprosy", icd: "A30", flow: "generic" },
];

/** Fallback facility names until HMIS locations load. */
export const FACILITIES_LIST = [
  { id: "F-001", name: "Bilbil Health Centre", country: "Papua New Guinea", province: "Madang", district: "Madang District", village: "Bilbil" },
  { id: "F-002", name: "Yabob Aid Post", country: "Papua New Guinea", province: "Madang", district: "Madang District", village: "Yabob" },
  { id: "F-003", name: "Karkar Rural Hospital", country: "Papua New Guinea", province: "Madang", district: "Sumkar District", village: "Karkar" },
  { id: "F-004", name: "Lae Urban Clinic", country: "Papua New Guinea", province: "Morobe", district: "Lae District", village: "Bumbu" },
  { id: "F-005", name: "Wewak General Hospital", country: "Papua New Guinea", province: "East Sepik", district: "Wewak District", village: "Boram" },
];

export const VISIT_TYPES = [
  "Initial encounter",
  "Follow-up",
  "Treatment review",
  "Home visit",
  "Outreach / community screening",
  "Referral visit",
];

/** Drug frequency options from the webapp drugs table (tri-hmis DRUG.js). */
export const DRUG_FREQUENCIES = [
  "Every hour",
  "Every two hours",
  "Every three hours",
  "Every four hours",
  "Every six hours",
  "Every eight hours",
  "Every 12 hours",
  "Every 24 hours",
  "STAT",
  "As needed",
  "Once",
  "Every day",
  "Twice a day",
  "Every evening",
  "Every afternoon",
  "Every night at bedtime",
  "Four times a day",
  "Every other day",
  "Three times a day",
  "As directed",
  "Every morning",
  "Once a week",
  "Once a month",
  "Call to OT",
  "1-0-1",
  "0-1-1",
  "1-1-0",
];

/** Duration unit options used by Admin drug / regimen forms. */
export const DRUG_DURATION_UNITS = [
  "Year(s)",
  "Month(s)",
  "Week(s)",
  "Day(s)",
  "Hour(s)",
  "Min(s)",
  "As needed",
  "Ongoing",
  "BOLUS",
  "l/hr",
  "ml/hr",
  "mU/min",
];

export const DRUGS = [
  { name: "Permethrin 5% Cream/Lotion", form: "Topical", strength: "5%", diseases: ["scabies"] },
  { name: "Benzyl Benzoate 25%", form: "Topical", strength: "25%", diseases: ["scabies"] },
  { name: "Sulphur 5% / 10% Ointment or Lotion", form: "Topical", strength: "5–10%", diseases: ["scabies"] },
  { name: "Tab Ivermectin (0.2 mg/kg)", form: "Oral", strength: "3 / 6 / 12 mg tablet", diseases: ["scabies", "lf"] },
  { name: "Topical antibiotic", form: "Topical", strength: "as prescribed", diseases: ["scabies"] },
  { name: "Oral antibiotic", form: "Oral", strength: "as prescribed", diseases: ["scabies"] },
  { name: "Tab Azithromycin 500mg (30mg per Kg)", form: "Oral", strength: "500 mg", diseases: ["yaws"] },
  { name: "Inj Benzathine penicillin", form: "Injectable", strength: "2.4 MU / 5 ml", diseases: ["yaws"] },
  { name: "Tab Rifampicin 300mg (10mg per Kg)", form: "Oral", strength: "150 / 300 mg", diseases: ["buruli"] },
  { name: "Tab Clarithromycin 500mg (7.5mg per kg)", form: "Oral", strength: "250 / 500 mg", diseases: ["buruli"] },
  { name: "Multi-Drug Therapy (MDT) Blister pack", form: "Oral", strength: "age/weight band", diseases: ["leprosy"] },
  { name: "Tab Prednisolone 5mg", form: "Oral", strength: "5 mg taper", diseases: ["leprosy"] },
  { name: "Tab DEC 100mg (6 mg/kg)", form: "Oral", strength: "100 mg", diseases: ["lf"] },
  { name: "Tab Albendazole 200mg", form: "Oral", strength: "200 / 400 mg", diseases: ["lf"] },
  { name: "Doxycycline 100mg tablet", form: "Oral", strength: "100 mg", diseases: ["lf"] },
  { name: "Dressing Material (Compression Bandage / Wound Care)", form: "Supportive", strength: "—", diseases: ["lf"] },
  { name: "Self care kit", form: "Supportive", strength: "—", diseases: ["lf"] },
  { name: "Folic Acid 5mg", form: "Oral", type: "Drug", strength: "5 mg", diseases: ["antenatal"] },
  { name: "Ferrous Sulphate / FeFol", form: "Oral", type: "Drug", strength: "200 mg", diseases: ["antenatal"] },
  { name: "Calcium 500mg", form: "Oral", type: "Drug", strength: "500 mg", diseases: ["antenatal"] },
  { name: "Tab Albendazole 400mg", form: "Oral", type: "Drug", strength: "400 mg", diseases: ["antenatal", "lf"] },
  { name: "Sulfadoxine-Pyrimethamine (IPTp)", form: "Oral", type: "Drug", strength: "500/25 mg", diseases: ["antenatal"] },
  { name: "Tetanus Toxoid Vaccine", form: "Injectable", type: "Vaccine", strength: "0.5 ml", diseases: ["antenatal"] },
  { name: "Tdap Vaccine", form: "Injectable", type: "Vaccine", strength: "0.5 ml", diseases: ["antenatal"] },
  { name: "Influenza Vaccine", form: "Injectable", type: "Vaccine", strength: "0.5 ml", diseases: ["antenatal"] },
];

export const DEFAULT_LTFU = { scabies: 30, yaws: 60, buruli: 90, lf: 180, leprosy: 180 };

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

/** Offline / referral geo fallback (online registration uses HMIS geo APIs). */
export const GEO = {
  Madang: {
    "Madang District": ["Bilbil", "Yabob", "Riwo", "Siar"],
    "Sumkar District": ["Karkar", "Megiar", "Malala"],
  },
  Morobe: {
    "Lae District": ["Bumbu", "Butibam", "Wagang"],
    "Finschhafen District": ["Gagidu", "Sattelberg"],
  },
  "East Sepik": {
    "Wewak District": ["Kreer", "Kaindi", "Boram"],
    "Ambunti District": ["Ambunti", "Pagwi"],
  },
};

/** Registered-at facility picker options (labels only). */
export const REGISTERED_ATS = [
  { id: "REG-0041", name: "Bilbil Health Centre" },
  { id: "REG-0042", name: "Karkar Rural Hospital" },
  { id: "REG-0043", name: "Wewak General Hospital" },
];
