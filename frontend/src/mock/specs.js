import { markFindings, markCodes, flattenMarks } from "@/lib/markFindings";

export const SUSPECT_SYMPTOMS = [
  "Red or white skin patch",
  "Skin patch with loss of feeling",
  "Numbness or tingling of hands and feet",
  "Weakness of eyes, hands and feet",
  "Swelling or lumps on the face/earlobes and skin",
  "Painless ulcers/burns on hands and feet",
  "Painless nodules/swelling/plaques",
  "Painless ulcer",
  "Painful swelling of leg/breast/scrotum/arm/vulva",
  "Gradual painless swelling of leg/breast/scrotum/arm/vulva",
  "Fever, chills, muscle pains",
  "Itchiness of the skin",
  "Itchy vesicles and pustules",
  "Itchy thick skin on hands/feet and body",
  "Yellow growth/lump on the skin",
  "Single or multiple ulcers",
  "Abnormal bone or cartilage shape",
  "Cracked skin under the feet",
  "Swollen painful joints",
];

export const SUSPECT_OPTIONS = [
  { id: "scabies", label: "Suspected Scabies" },
  { id: "yaws", label: "Suspected Yaws" },
  { id: "buruli", label: "Suspected Buruli Ulcer" },
  { id: "lf", label: "Suspected Lymphatic Filariasis" },
  { id: "leprosy", label: "Suspected Leprosy" },
  { id: "other", label: "Suspected Other NTDs" },
  { id: "none", label: "Suspect Non-NTDs Skin Condition" },
];

export const MODE_OF_DETECTION = ["Voluntary", "Referral", "Household contact", "MDA", "Special project", "Others"];
export const REFERRED_BY = ["Family member", "Village health worker", "Former patient", "Volunteer"];
export const CASE_TYPES = ["New", "Relapse", "Transfer in"];
export const CONSENT = ["No", "In writing", "By verbal"];
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
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: REFERRED_BY, when: ["mode", "Referral"] },
  { k: "caseType", label: "Case type", type: "choice", options: CASE_TYPES },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const SCABIES_REFERRED_BY = [...REFERRED_BY, "Others"];
const SCABIES_CASE_TYPES = [...CASE_TYPES, "Chronic/Persistent"];

const scabiesCaseDetails = [
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: SCABIES_REFERRED_BY, when: ["mode", "Referral"] },
  { k: "referredByOther", label: "Referred by (specify)", type: "text", whenAll: [["mode", "Referral"], ["referredBy", "Others"]] },
  { k: "caseType", label: "Case type", type: "choice", options: SCABIES_CASE_TYPES },
  { k: "pregnant", label: "Are you pregnant?", type: "yesno", whenGender: "Female" },
  { k: "breastfeeding", label: "Are you breastfeeding?", type: "yesno", whenGender: "Female" },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const yawsCaseDetails = [
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: SCABIES_REFERRED_BY, when: ["mode", "Referral"] },
  { k: "referredByOther", label: "Referred by (specify)", type: "text", whenAll: [["mode", "Referral"], ["referredBy", "Others"]] },
  { k: "caseType", label: "Case type", type: "choice", options: SCABIES_CASE_TYPES },
  { k: "pregnant", label: "Are you pregnant?", type: "yesno", whenGender: "Female" },
  { k: "breastfeeding", label: "Are you breastfeeding?", type: "yesno", whenGender: "Female" },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const lfCaseDetails = [
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: SCABIES_REFERRED_BY, when: ["mode", "Referral"] },
  { k: "referredByOther", label: "Referred by (specify)", type: "text", whenAll: [["mode", "Referral"], ["referredBy", "Others"]] },
  { k: "caseType", label: "Case type", type: "choice", options: SCABIES_CASE_TYPES },
  { k: "pregnant", label: "Are you pregnant?", type: "yesno", whenGender: "Female" },
  { k: "breastfeeding", label: "Are you breastfeeding?", type: "yesno", whenGender: "Female" },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const buruliCaseDetails = [
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: SCABIES_REFERRED_BY, when: ["mode", "Referral"] },
  { k: "referredByOther", label: "Referred by (specify)", type: "text", whenAll: [["mode", "Referral"], ["referredBy", "Others"]] },
  { k: "caseType", label: "Case type", type: "choice", options: SCABIES_CASE_TYPES },
  { k: "pregnant", label: "Are you pregnant?", type: "yesno", whenGender: "Female" },
  { k: "breastfeeding", label: "Are you breastfeeding?", type: "yesno", whenGender: "Female" },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const LEPROSY_CASE_TYPES = ["New", "Relapse", "Transfer in", "Chronic", "Old", "Return after default"];

const leprosyCaseDetails = [
  { k: "mode", label: "Mode of detection", type: "choice", options: MODE_OF_DETECTION },
  { k: "referredBy", label: "Referred by", type: "choice", options: SCABIES_REFERRED_BY, when: ["mode", "Referral"] },
  { k: "referredByOther", label: "Referred by (specify)", type: "text", whenAll: [["mode", "Referral"], ["referredBy", "Others"]] },
  { k: "caseType", label: "Case type", type: "choice", options: LEPROSY_CASE_TYPES },
  { k: "pregnant", label: "Are you pregnant?", type: "yesno", whenGender: "Female" },
  { k: "breastfeeding", label: "Are you breastfeeding?", type: "yesno", whenGender: "Female" },
  { k: "height", label: "Height (cms)", type: "number" },
  { k: "weight", label: "Weight (kgs)", type: "number" },
];

const SCABIES_HH_GROUPS = [
  "Male Child (Below 15 Years)",
  "Male Adult (15 Years and Above)",
  "Female Child (Below 15 Years)",
  "Female Adult (15 Years and Above)",
];

const scabiesHousehold = [
  { k: "hhTotal", label: "Total household contacts", type: "groupCount", options: SCABIES_HH_GROUPS },
  {
    k: "hhSymptomatic",
    label: "Total household contacts with similar symptoms",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
    note: "Total household contacts suspected / diagnosed with Scabies, please register a suspect / new patients and create a Scabies record",
  },
  {
    k: "hhIvermectin",
    label: "Total asymptomatic household contact provided with preventive Tab Ivermectin",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
  {
    k: "hhPermethrin",
    label: "Total asymptomatic household contact provided with preventive Permethrin 5% Cream/Lotion",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
];

const yawsHousehold = [
  { k: "hhTotal", label: "Total household contacts", type: "groupCount", options: SCABIES_HH_GROUPS },
  {
    k: "hhSymptomatic",
    label: "Total household contacts with similar symptoms",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
    note: "Total household contacts suspected / diagnosed with Yaws, please register a suspect / new patients and create a Yaws record",
  },
  {
    k: "hhAzithromycin",
    label: "Total asymptomatic household contact provided with preventive Tab Azithromycin",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
  {
    k: "hhBenzathine",
    label: "Total asymptomatic household contact provided with preventive Inj Benzathine penicillin",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
];

const lfHousehold = [
  { k: "hhTotal", label: "Total household contacts", type: "groupCount", options: SCABIES_HH_GROUPS },
  {
    k: "hhSymptomatic",
    label: "Total household contacts with similar symptoms",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
    note: "Total household contacts suspected / diagnosed with LF, please register a suspect / new patients and create a LF record",
  },
  {
    k: "hhIvermectin",
    label: "Total asymptomatic household contact provided with preventive Tab Ivermectin",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
  {
    k: "hhAlbendazole",
    label: "Total asymptomatic household contact provided with preventive Tab Albendazole",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
  },
];

const buruliHousehold = [
  { k: "hhTotal", label: "Total household contacts", type: "groupCount", options: SCABIES_HH_GROUPS },
  {
    k: "hhSymptomatic",
    label: "Total household contacts with similar symptoms",
    type: "groupCount",
    options: SCABIES_HH_GROUPS,
    note: "Total household contacts suspected / diagnosed with Buruli Ulcer, please register a suspect / new patients and create a Buruli Ulcer record",
  },
];

export const DISEASE_SPECS = {
  scabies: {
    id: "scabies", name: "Scabies", icd: "B86",
    bodyChart: { views: ["front", "back"], codes: [
      ["B", "Burrows"], ["P", "Red or skin colored Papules"], ["V", "Vesicles"], ["PU", "Pustules"],
      ["C", "Crusted Skin"], ["E", "Excoriations / scratch marks"], ["NO", "No Lesions"]] },
    caseDetails: scabiesCaseDetails,
    history: [
      { k: "hpc_section", type: "section", label: "History of Presenting Complaints" },
      { k: "itching", label: "Does the patient have itching?", type: "yesno" },
      { k: "itchNight", label: "Is the itching worse at night?", type: "yesno" },
      { k: "familySimilar", label: "Are there other family members with similar complaints / symptoms?", type: "yesno" },
      { k: "familyScabies", label: "Has anyone of your family/close contacts been diagnosed with Scabies recently?", type: "yesno" },
      {
        k: "familyScabiesNote",
        type: "note",
        label: "Please check these when doing household contact tracing, and register as patients if they also have Scabies",
        when: ["familyScabies", "Yes"],
      },
      { k: "priorScabies", label: "Have you been diagnosed with scabies before?", type: "yesno" },
      { k: "priorWhen", label: "When were you diagnosed previously?", type: "duration", when: ["priorScabies", "Yes"] },
      {
        k: "priorTreatment",
        label: "What treatment did you take/use last time?",
        type: "checks",
        options: ["Permethrin 5% Lotion / Cream", "Tab Ivermectin", "Others"],
        when: ["priorScabies", "Yes"],
      },
      { k: "priorTreatmentOther", label: "Other treatment (specify)", type: "text", when: ["priorScabies", "Yes"], whenIncludes: ["priorTreatment", "Others"] },

      { k: "si_section", type: "section", label: "Specific Interrogation" },
      { k: "feverQ", label: "Do you have any fever?", type: "yesno" },
      { k: "chestPain", label: "Do you have any chest pain or shortness of breath?", type: "yesno" },
      { k: "urine", label: "Is your urine output low or urine tea-colored?", type: "yesno" },
      { k: "swelling", label: "Do you have any swelling in your face, arms or legs?", type: "yesno" },

      { k: "pmh_section", type: "section", label: "Past Medical History" },
      { k: "otherProblems", label: "Do you have any other medical problems?", type: "yesno" },
      {
        k: "conditions",
        label: "Medical problems",
        type: "checks",
        options: ["TB", "HIV", "Diabetes", "Cancer", "Kidney Disease", "Liver Disease", "Don't know"],
        when: ["otherProblems", "Yes"],
      },
      { k: "medications", label: "What medications are you taking now?", type: "lines", placeholder: "Medication name" },
      { k: "allergy", label: "Are you allergic to any drugs/medication?", type: "yesno" },
      { k: "allergyDetail", label: "Allergy details", type: "text", when: ["allergy", "Yes"] },
    ],
    assessmentExtra: [
      { k: "secondaryInfection", label: "Secondary infection?", type: "yesno" },
      {
        k: "dermoscopy",
        label: "Dermoscopy",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add Dermoscopy",
      },
    ],
    repeatExam: true,
    repeatExamIncludesAssessment: true,
    lab: [
      {
        k: "skinScrapings",
        label: "Skin scraping",
        type: "repeatChoice",
        options: ["Mite identified", "Eggs identified", "Faecal pellets identified", "Negative", "Not done"],
        dateLabel: "Specimen Collection Date",
        addLabel: "Add skin scraping",
      },
    ],
    diagnosis: ["Confirmed Scabies", "Crusted Scabies", "Suspected Scabies", "No Scabies"],
    diagnosisHelp: true,
    drugs: {
      topical: [
        "Permethrin 5% Cream/Lotion",
        "Benzyl Benzoate 25%",
        "Sulphur 5% / 10% Ointment or Lotion",
      ],
      oral: [{ name: "Tab Ivermectin (0.2 mg/kg)", mgPerKg: 0.2, tablet: 3 }],
      scabiesProtocol: true,
    },
    household: scabiesHousehold,
    outcomes: ["Active", "Cured", "No Change", "Worse", "No Scabies", "Lost to Follow-up"],
    recommendations: [
      "Referred for further review",
      "Morbidity Management and Disability Prevention (MMDP)",
    ],
  },

  yaws: {
    id: "yaws", name: "Yaws", icd: "A66",
    bodyChart: { views: ["front", "back"], codes: [
      ["T", "Thick Skin Patch"],
      ["U", "Ulcer"],
      ["P", "Papilloma (raised yellow lesion)"],
      ["J", "Joint Swelling"],
      ["TS", "Thickened/Cracked skin on palms and soles of feet"],
      ["BC", "Bone and cartilage deformity"],
      ["NO", "No Lesions"],
    ] },
    caseDetails: yawsCaseDetails,
    history: [
      { k: "hpc_section", type: "section", label: "History of Presenting Complaints" },
      {
        k: "complaintDetails",
        type: "perComplaint",
        label: "Key presenting complaints",
        options: ["Ulcer", "Joint swelling", "Bone pain", "Raised yellow lesion"],
        fields: [
          { k: "onsetHow", label: "How did it start?", type: "textarea" },
          { k: "onsetWhen", label: "When did it start?", type: "duration" },
          { k: "tookMeds", label: "Did you take any medication for this complaint?", type: "yesno" },
          { k: "medsTaken", label: "Medication taken", type: "lines", when: ["tookMeds", "Yes"], placeholder: "Medication name" },
          { k: "firstTime", label: "Is this the first time you have this complaint?", type: "yesno" },
          { k: "familySimilar", label: "Are there any other family members with similar symptoms?", type: "yesno" },
          { k: "familyYaws", label: "Has anyone of your family/close contacts been diagnosed with Yaws recently?", type: "yesno" },
          {
            k: "familyYawsNote",
            type: "note",
            label: "Please check these when doing household contact tracing, and register as patients if they also have Yaws",
            when: ["familyYaws", "Yes"],
          },
        ],
      },

      { k: "si_section", type: "section", label: "Specific Interrogation" },
      {
        k: "si_note",
        type: "note",
        label: "Questions shown depend on the presenting complaints selected above.",
        whenHasAny: "complaintDetails",
      },
      {
        k: "jointPain",
        label: "Do you have any pain in your joints / bone?",
        type: "yesno",
        whenIncludesAny: ["complaintDetails", ["Joint swelling", "Bone pain"]],
      },
      {
        k: "feverQ",
        label: "Do you have any fever?",
        type: "yesno",
        whenHasAny: "complaintDetails",
      },
      {
        k: "jointSwellingQ",
        label: "Do you have any swelling in any of your joints or bones?",
        type: "yesno",
        whenIncludesAny: ["complaintDetails", ["Joint swelling"]],
      },
      {
        k: "soresUlcers",
        label: "Do you have any sores or ulcers?",
        type: "yesno",
        whenIncludesAny: ["complaintDetails", ["Ulcer"]],
      },
      {
        k: "footCracks",
        label: "Do you have any thick patches on your skin or cracks under your foot?",
        type: "yesno",
        whenIncludesAny: ["complaintDetails", ["Raised yellow lesion"]],
      },

      { k: "pmh_section", type: "section", label: "Past Medical History" },
      { k: "otherProblems", label: "Do you have any other medical problems?", type: "yesno" },
      {
        k: "conditions",
        label: "Medical problems",
        type: "checks",
        options: ["TB", "HIV", "Diabetes", "Cancer", "Kidney Disease", "Liver Disease", "Don't know"],
        when: ["otherProblems", "Yes"],
      },
      { k: "medications", label: "What medications are you taking now?", type: "lines", placeholder: "Medication name" },
      {
        k: "allergy",
        label: "Are you allergic to any drugs/medication e.g. Penicillin and/or Erythromycin?",
        type: "yesno",
      },
      { k: "allergyDetail", label: "Allergy details", type: "text", when: ["allergy", "Yes"] },
    ],
    assessmentExtra: [],
    repeatExam: true,
    lab: [
      {
        k: "rdt",
        label: "RDT",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add RDT",
      },
      {
        k: "dfaPcr",
        label: "DFA / PCR",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add DFA / PCR",
      },
      {
        k: "darkfield",
        label: "Darkfield Microscopy Test",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Date",
        addLabel: "Add Darkfield Microscopy",
      },
      {
        k: "dpp",
        label: "DPP",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add DPP",
      },
    ],
    diagnosis: [
      "Primary Yaws (Clinical / confirmed)",
      "Secondary Yaws (Clinical / confirmed)",
      "Tertiary Yaws (Clinical / confirmed)",
      "No Yaws",
    ],
    drugs: {
      topical: [],
      oral: [
        { name: "Tab Azithromycin 500mg (30mg per Kg)", tablet: 500 },
        { name: "Inj Benzathine penicillin" },
      ],
      otherOralAntibiotic: true,
      otherTopicalAntibiotic: true,
    },
    household: yawsHousehold,
    outcomes: ["Active", "Cured", "Improved", "No Change", "No Yaws", "New Lesions", "Lost to Follow-up"],
    recommendations: [
      "Referred for further review",
      "Morbidity Management and Disability Prevention (MMDP)",
    ],
  },

  lf: {
    id: "lf", name: "Lymphatic Filariasis", icd: "B74",
    bodyChart: {
      views: ["front"],
      codes: [
        ["S1", "Stage 1 (Swelling is reversible overnight)"],
        ["S2", "Stage 2 (Swelling is not reversible)"],
        ["S3", "Stage 3 (Shallow skin folds)"],
        ["S4", "Stage 4 (Knobs)"],
        ["S5", "Stage 5 (Deep skin folds)"],
        ["S6", "Stage 6 (Mossy lesions)"],
        ["S7", "Stage 7 (Unable to care for self)"],
      ],
      perLesion: {
        k: "secondary",
        label: "Secondary infection?",
        options: ["None", "Acute", "Mild", "Chronic"],
        default: "None",
      },
      stageHelp: true,
    },
    caseDetails: lfCaseDetails,
    history: [
      { k: "hpc_section", type: "section", label: "History of Presenting Complaints" },
      { k: "onsetHow", label: "How did it start?", type: "textarea" },
      { k: "onsetWhen", label: "When did it start?", type: "duration" },
      { k: "tookMeds", label: "Did you take any medication for this complaint?", type: "yesno" },
      { k: "medsTaken", label: "Medication taken", type: "lines", when: ["tookMeds", "Yes"], placeholder: "Medication name" },
      { k: "firstTime", label: "Is this the first time you have this complaint/symptom?", type: "yesno" },
      { k: "communitySimilar", label: "Are there any other people in the community with similar symptom?", type: "yesno" },
      {
        k: "communitySimilarNote",
        type: "note",
        label: "Please check these when doing household contact tracing, and register as patients if they also have LF",
        when: ["communitySimilar", "Yes"],
      },

      { k: "si_section", type: "section", label: "Specific Interrogation" },
      { k: "fever", label: "Do you have any fever?", type: "choice", options: ["High", "Moderate", "Low", "No"] },
      { k: "chills", label: "Do you have Chills and Rigors?", type: "yesno" },
      { k: "trauma", label: "Do you have any history of trauma?", type: "yesno" },
      { k: "lymphadenopathy", label: "Do you have any Swollen/Painful lymph nodes?", type: "yesno" },

      { k: "pmh_section", type: "section", label: "Past Medical History" },
      { k: "otherProblems", label: "Do you have any other medical problems?", type: "yesno" },
      {
        k: "conditions",
        label: "Medical problems",
        type: "checks",
        options: ["TB", "HIV", "Diabetes", "Cancer", "Don't know", "Kidney Disease", "Liver Disease", "None"],
        when: ["otherProblems", "Yes"],
      },
      { k: "medications", label: "What medications are you taking now?", type: "lines", placeholder: "Medication name" },
      { k: "allergy", label: "Are you allergic to any drugs/medication?", type: "yesno" },
      { k: "allergyDetail", label: "Allergy details", type: "text", when: ["allergy", "Yes"] },
    ],
    assessmentExtra: [],
    repeatExam: true,
    lab: [
      {
        k: "thickSmear",
        label: "Thick Smear",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add Thick Smear",
      },
      {
        k: "pcr",
        label: "PCR",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add PCR",
      },
      {
        k: "rdt",
        label: "RDT",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add RDT",
      },
    ],
    diagnosis: [
      "Confirmed Lymphatic Filariasis",
      "Acute Adenolymphangitis (ADL)",
      "Clinical LF (when tests are Negative)",
      "No Lymphatic Filariasis",
    ],
    drugs: {
      topical: [
        "Dressing Material (Compression Bandage / Wound Care)",
        "Self care kit",
      ],
      oral: [
        { name: "Tab Ivermectin (0.2 mg/kg)", mgPerKg: 0.2, tablet: 3 },
        { name: "Tab Albendazole 200mg", fixed: "200mg (<10y) / 400mg (10y+)" },
        { name: "Tab DEC 100mg (6 mg/kg)", mgPerKg: 6, tablet: 100 },
        { name: "Doxycycline 100mg tablet" },
      ],
      ida: true,
    },
    household: lfHousehold,
    outcomes: ["Active", "No Change", "No Lymphatic Filariasis", "MMDP", "Lost to Follow-up"],
    recommendations: [
      "Surgery for Hydrocele",
      "Rest during Acute Attacks",
      "Referred for further review and further management of Acute Attacks especially in a pregnant woman",
      "Self care",
      "Morbidity Management and Disability Prevention (MMDP)",
    ],
  },

  buruli: {
    id: "buruli", name: "Buruli Ulcer", icd: "A31.1",
    bodyChart: {
      views: ["front", "back"],
      codes: [
        ["PA", "Painless Papule"],
        ["PN", "Painless Nodule"],
        ["PPl", "Painless Plaque"],
        ["O", "Oedema"],
        ["NU", "Necrotic Ulcer with undermining edges"],
        ["D", "Deformed limb"],
        ["S", "Scar of healed ulcer"],
      ],
      perLesion: {
        k: "category",
        label: "Category?",
        options: ["Category 1", "Category 2", "Category 3"],
        default: "Category 1",
      },
    },
    caseDetails: buruliCaseDetails,
    history: [
      { k: "hpc_section", type: "section", label: "History of Presenting Complaints" },
      { k: "onsetHow", label: "How did it start?", type: "textarea" },
      { k: "onsetWhen", label: "When did it start?", type: "duration" },
      { k: "tookMeds", label: "Did you take any medication?", type: "yesno" },
      { k: "medsTaken", label: "Medication taken", type: "lines", when: ["tookMeds", "Yes"], placeholder: "Medication name" },
      { k: "firstTime", label: "Is this the first time you have this complaint/symptom?", type: "yesno" },
      { k: "communitySimilar", label: "Are there any other people in the community with similar symptom?", type: "yesno" },
      {
        k: "communitySimilarNote",
        type: "note",
        label: "Please check these when doing household contact tracing, and register as patients if they also have Buruli Ulcer",
        when: ["communitySimilar", "Yes"],
      },

      { k: "si_section", type: "section", label: "Specific Interrogation" },
      { k: "lesionPain", label: "Do you feel pain in the nodule/swelling or ulcer?", type: "yesno" },
      { k: "fever", label: "Do you have any fever?", type: "choice", options: ["High", "Moderate", "Low", "No"] },
      { k: "chills", label: "Do you have Chills and Rigors?", type: "yesno" },
      { k: "trauma", label: "Do you have history of trauma?", type: "yesno" },
      { k: "lymphadenopathy", label: "Do you have any Swollen/Painful lymph nodes?", type: "yesno" },

      { k: "pmh_section", type: "section", label: "Past Medical History" },
      { k: "otherProblems", label: "Do you have any other medical problems?", type: "yesno" },
      {
        k: "conditions",
        label: "Medical problems",
        type: "checks",
        options: ["TB", "HIV", "Diabetes", "Cancer", "Don't know", "Kidney Disease", "Liver Disease", "None"],
        when: ["otherProblems", "Yes"],
      },
      { k: "medications", label: "What medications are you taking now?", type: "lines", placeholder: "Medication name" },
      { k: "allergy", label: "Are you allergic to any drugs?", type: "yesno" },
      { k: "allergyDetail", label: "Allergy details", type: "text", when: ["allergy", "Yes"] },
    ],
    assessmentExtra: [],
    repeatExam: true,
    lab: [
      {
        k: "zn",
        label: "ZN",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add ZN",
      },
      {
        k: "pcr",
        label: "PCR",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Collection Date",
        addLabel: "Add PCR",
      },
    ],
    diagnosis: ["Clinical Buruli Ulcer", "Confirmed Buruli Ulcer", "No Buruli Ulcer"],
    drugs: {
      oral: [
        { name: "Tab Rifampicin 300mg (10mg per Kg)", mgPerKg: 10, tablet: 300, schedule: "OD × 8 weeks" },
        { name: "Tab Clarithromycin 500mg (7.5mg per kg)", mgPerKg: 7.5, tablet: 500, schedule: "BID × 8 weeks" },
      ],
    },
    adherence: { unit: "week", count: 8, label: "8-week treatment schedule" },
    household: buruliHousehold,
    outcomes: ["Active", "Healed", "No Change/Improvement", "No Buruli Ulcer", "Lost to Follow-up"],
    recommendations: [
      "Referred for further review",
      "Referred for Surgery",
      "Self care",
      "Physiotherapy",
      "Morbidity Management and Disability Prevention (MMDP)",
    ],
  },

  leprosy: {
    id: "leprosy", name: "Leprosy", icd: "A30",
    bodyChart: {
      views: ["front", "back"],
      codes: [
        ["A", "Well defined patch / plaque without sensation"],
        ["B", "Well defined patch / plaque with sensation"],
        ["C", "Ill defined patch / plaque without sensation"],
        ["D", "Ill defined patch / plaque with sensation"],
        ["E", "Painless Nodule"],
        ["F", "Painful Nodule"],
        ["G", "Enlarged nerve"],
        ["H", "Tender nerve"],
        ["I", "Nerve abscess"],
        ["J", "Clawed"],
        ["K", "Swollen"],
        ["N", "Bone loss"],
        ["P", "Ulcer/burn/wound"],
        ["R", "Blind eye"],
        ["S", "Unable to close eyelid/weakness of the eyelid (Lagophthalmos)"],
        ["T", "Loss of eyebrows/eyelashes"],
        ["U", "Collapsed or widened bridge of the nose"],
        ["V", "Foot drop / Wrist drop"],
      ],
      showNerves: true,
      patchCountCodes: ["A", "B", "C", "D"],
    },
    caseDetails: leprosyCaseDetails,
    history: [
      { k: "hpc_section", type: "section", label: "History of Presenting Complaints" },
      { k: "onsetHow", label: "How did it start?", type: "textarea" },
      { k: "onsetWhen", label: "When did it start?", type: "duration" },
      { k: "tookMeds", label: "Did you take any medication for this complaint?", type: "yesno" },
      { k: "medsTaken", label: "Medication taken", type: "lines", when: ["tookMeds", "Yes"], placeholder: "Medication name" },
      { k: "firstTime", label: "Is this the first time you have this complaint/symptom?", type: "yesno" },
      { k: "communitySimilar", label: "Are there any other people in your family or community with similar symptom?", type: "yesno" },
      {
        k: "communitySimilarNote",
        type: "note",
        label: "Please check these when doing household contact tracing, and register as patients if they also have Leprosy",
        when: ["communitySimilar", "Yes"],
      },

      { k: "si_section", type: "section", label: "Specific Interrogation" },
      { k: "skinPatches", label: "Do you have any red or white skin patches?", type: "yesno" },
      { k: "lesionPain", label: "Do you feel pain in the nodule/swelling or ulcer?", type: "yesno" },
      { k: "feverQ", label: "Do you have any fever?", type: "yesno" },
      { k: "chills", label: "Do you have Chills?", type: "yesno" },
      { k: "blockedNose", label: "Do you have a blocked nose?", type: "yesno" },
      { k: "numbness", label: "Do you have any pins and needles/numbness in your hands and feet?", type: "yesno" },
      { k: "weakness", label: "Is there weakness of your eyelids/hands and feet?", type: "yesno" },
      { k: "noseBleed", label: "Do you have any bleeding from your nose?", type: "yesno" },
      { k: "lymphadenopathy", label: "Do you have any lymphadenopathy/enlarged lymph nodes?", type: "yesno" },
      { k: "limbSwelling", label: "Is there any swelling and pain of your arms or legs?", type: "yesno" },
      { k: "faceThickening", label: "Have you noticed thickening or redness of the skin on your face and earlobes and nose?", type: "yesno" },

      { k: "pmh_section", type: "section", label: "Past Medical History" },
      { k: "otherProblems", label: "Do you have any other medical problems?", type: "yesno" },
      {
        k: "conditions",
        label: "Medical problems",
        type: "checks",
        options: ["TB", "HIV", "Diabetes", "Cancer", "Don't know", "Kidney Disease", "Liver Disease", "None"],
        when: ["otherProblems", "Yes"],
      },
      { k: "medications", label: "What medications are you taking now?", type: "lines", placeholder: "Medication name" },
      {
        k: "allergy",
        label: "Are you allergic to any drugs, especially Dapsone, Septrin/Panadol and Fansidar?",
        type: "yesno",
      },
      { k: "allergyDetail", label: "Allergy details", type: "text", when: ["allergy", "Yes"] },
    ],
    assessmentExtra: [
      { k: "vmtChart", type: "leprosyVmtChart" },
      { k: "sensoryChart", type: "leprosySensoryChart" },
      { k: "visionChart", type: "leprosyVisionChart" },
    ],
    repeatExam: true,
    repeatExamIncludesAssessment: true,
    diagnosis: ["Paucibacillary (PB)", "Multibacillary (MB)", "No Leprosy"],
    lab: [
      {
        k: "slitSkinZn",
        label: "Slit Skin Smear: ZN",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Date",
        addLabel: "Add Slit Skin Smear",
      },
      {
        k: "biopsy",
        label: "Biopsy",
        type: "repeatChoice",
        options: DETECT_RESULT,
        dateLabel: "Specimen Date",
        addLabel: "Add Biopsy",
      },
      {
        k: "rdt",
        label: "RDT",
        type: "repeatChoice",
        options: TEST_RESULT,
        dateLabel: "Specimen Date",
        addLabel: "Add RDT",
      },
    ],
    drugs: {
      oral: [
        { name: "Multi-Drug Therapy (MDT) Blister pack" },
        { name: "Tab Prednisolone 5mg" },
      ],
      mdt: true,
    },
    adherence: {
      unit: "month",
      mdt: true,
      label: "MDT month-wise drug adherence",
      restart: true,
    },
    household: [
      { k: "contacts", label: "Household Monitoring", type: "leprosyHousehold" },
    ],
    outcomes: ["Active", "Cured", "No Change", "No Leprosy", "Lost to Follow-up"],
    recommendations: [
      "Referred for further review (NOPS/Physiotherapy/Medical Clinic & or Admission/Eye Clinic (Opthamology))",
      "Referred for Surgery",
      "Self care",
      "Morbidity Management and Disability Prevention (MMDP)",
    ],
  },
};

export const SPEC_LIST = Object.values(DISEASE_SPECS);

/** Disease assessment tabs come from a started encounter, never from registration or suspect screening alone. */
export const assessmentSpecs = (patientId, { encounters = [] } = {}) => {
  const ids = new Set();
  for (const e of encounters) {
    if (patientId && e.patientId && e.patientId !== patientId) continue;
    if (e.disease && DISEASE_SPECS[e.disease]) ids.add(e.disease);
  }
  return SPEC_LIST.filter((d) => ids.has(d.id));
};

/** Suspected NTDs from screening — used to start an assessment, not to show disease chips. */
export const suspectedSpecs = (patientId, { suspects = [] } = {}) => {
  const ids = new Set();
  for (const s of suspects) {
    if (patientId && s.patientId && s.patientId !== patientId) continue;
    if (s.suspect && DISEASE_SPECS[s.suspect]) ids.add(s.suspect);
  }
  return SPEC_LIST.filter((d) => ids.has(d.id));
};

/** Parse app dates; legacy datetimes without TZ were UTC from toISOString().slice */
export const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    return new Date(s.length === 16 ? `${s}:00Z` : `${s}Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (v) => {
  if (!v) return "—";
  const d = parseDate(v);
  if (!d) return String(v);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")}-${m}-${d.getFullYear()}`;
};

export const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = parseDate(v);
  if (!d) return String(v);
  return `${fmtDate(v)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** Local calendar date YYYY-MM-DD (not UTC) */
export const localISODate = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const visitLabel = (n) => `${n} visit${n === 1 ? "" : "s"}`;

/** Closing outcomes end the episode so the next encounter starts episode 2+. */
export const isEpisodeClosed = (outcome) => {
  const s = String(outcome || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
  if (!s || s === "active" || s === "open") return false;
  // Intermediate statuses — episode stays open
  if (/^(no change|improved|worse|mmdp|new lesions)/.test(s)) return false;
  if (/cured|healed/.test(s)) return true;
  // "Lost to Follow-up", "Lost to Follow up", "Lost to FollowUp"
  if (/lost to follow/.test(s)) return true;
  // Ruled-out disease: "No Leprosy", "No Scabies", "No Yaws", "No Buruli Ulcer", "No Lymphatic Filariasis"
  if (/^no\s+(scabies|yaws|leprosy|buruli|lymphatic)/.test(s)) return true;
  return false;
};

/** Prefer a closing / recorded outcome if top-level and data diverge after an edit. */
export const encounterOutcome = (e) => {
  const top = String(e?.outcome || "").trim();
  const data = String(e?.data?.outcome || "").trim();
  if (isEpisodeClosed(top)) return top;
  if (isEpisodeClosed(data)) return data;
  if (top && top !== "Open" && top !== "Active") return top;
  if (data && data !== "Open" && data !== "Active") return data;
  return top || data;
};

const EPISODE_PREFIX = { scabies: "SCAB", yaws: "YAWS", lf: "LF", buruli: "BURU", leprosy: "LEP" };

export const newEpisodeId = (disease) =>
  `${EPISODE_PREFIX[disease] || "NTD"}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

const byVisitDesc = (a, b) =>
  String(b.date).localeCompare(String(a.date)) || String(b.id || "").localeCompare(String(a.id || ""));

const visitTouchedAt = (e) => e?.editedAt || e?.date || "";

const byTouchDesc = (a, b) =>
  String(visitTouchedAt(b)).localeCompare(String(visitTouchedAt(a))) || byVisitDesc(a, b);

/** Episode status: prefer a closing outcome from the most recently saved/edited visit. */
export const episodeOutcomeFromVisits = (visits) => {
  const list = visits || [];
  if (!list.length) return "";
  const byTouch = [...list].sort(byTouchDesc);
  for (const v of byTouch) {
    const o = encounterOutcome(v);
    if (isEpisodeClosed(o)) return o;
  }
  return encounterOutcome([...list].sort(byVisitDesc)[0]);
};

export const groupDiseaseEpisodes = (encounters, diseaseId, fallbackEpisodeId) => {
  const list = (encounters || []).filter((e) => e.disease === diseaseId);
  const by = {};
  for (const e of list) {
    const eid = e.episodeId || fallbackEpisodeId || "_none";
    (by[eid] ||= []).push(e);
  }
  return Object.entries(by)
    .map(([eid, visits]) => {
      const sorted = [...visits].sort(byVisitDesc);
      const outcome = episodeOutcomeFromVisits(visits);
      const closedVisit = isEpisodeClosed(outcome)
        ? [...visits].sort(byTouchDesc).find((v) => isEpisodeClosed(encounterOutcome(v)))
        : null;
      return {
        id: eid,
        visits: sorted,
        visitCount: sorted.length,
        start: sorted[sorted.length - 1].date,
        last: (closedVisit || sorted[0]).date,
        outcome,
        diagnosis: sorted[0].diagnosis || sorted[0].data?.diagnosis || "",
      };
    })
    .sort((a, b) => String(b.last).localeCompare(String(a.last)));
};

export const resolveEpisodeId = ({ existingId, disease, patientEpisodeId, diseaseEncounters }) => {
  if (existingId) return existingId;
  const episodes = groupDiseaseEpisodes(diseaseEncounters, disease, patientEpisodeId);
  const current = episodes[0];
  if (current && current.id !== "_none" && !isEpisodeClosed(current.outcome)) {
    return current.id;
  }
  if (!current || current.id === "_none") {
    const prefix = EPISODE_PREFIX[disease];
    if (prefix && String(patientEpisodeId || "").startsWith(`${prefix}-`)) return patientEpisodeId;
    return newEpisodeId(disease);
  }
  // Current episode completed (Cured / Lost to Follow-up / No Leprosy / …) → new episode
  return newEpisodeId(disease);
};

/** Diagnosis patches: A/B/C/D, summing the count entered for each body part. */
const DIAGNOSIS_PATCH_CODES = new Set(["A", "B", "C", "D"]);
/** Body-chart nerve findings: enlarged / tender / abscess — each nerve site = 1 pt max. */
const BODY_NERVE_CODES = new Set(["G", "H", "I"]);

const HAND_NERVE_GROUPS = {
  R: [
    ["Right Lower Palm below thumb", "Right Index Finger"],
    ["Right Lower Palm below pinky", "Right Little Finger"],
  ],
  L: [
    ["Left Lower Palm below thumb", "Left Index Finger"],
    ["Left Lower Palm below pinky", "Left Little Finger"],
  ],
};
const FOOT_POINTS = {
  R: ["Right Foot Thumb", "Right Foot Medial", "Right Foot Lateral", "Right Foot Mid"],
  L: ["Left Foot Thumb", "Left Foot Medial", "Left Foot Lateral", "Left Foot Mid"],
};
const VMT_IDS = {
  eye: { R: "right-tight-eye", L: "left-tight-eye" },
  wrist: { R: "right-wrist", L: "left-wrist" },
  finger: { R: "right-little-finger", L: "left-little-finger" },
  thumb: { R: "right-thumb", L: "left-thumb" },
  foot: { R: "right-foot", L: "left-foot" },
};

const regionSide = (region = "") => {
  const r = String(region).toLowerCase();
  if (/\bright\b/.test(r) || r.startsWith("r ")) return "R";
  if (/\bleft\b/.test(r) || r.startsWith("l ")) return "L";
  return null;
};
const isEyeRegion = (region = "") => /\beye\b/.test(String(region).toLowerCase());
const isHandRegion = (region = "") => /\b(hand|palm|finger|wrist)\b/.test(String(region).toLowerCase());
const isFootRegion = (region = "") => /\b(foot|toe)\b/.test(String(region).toLowerCase());
const isNerveRegion = (region = "") =>
  /\b(nerve|auricular|median|tibial|ulnar|radial|peroneal)\b/i.test(String(region || ""));

const vmtPointScore = (code) => {
  if (code === "PARALYZED") return 2;
  if (code === "WEAK") return 1;
  return 0;
};
const vmtAffected = (code) => code === "WEAK" || code === "PARALYZED";

/** Patches (A–D counts) and body-chart nerves (unique G/H/I nerve sites, max 12). */
export const countLeprosyFindings = (marks = {}) => {
  const entries = Object.values(marks || {});
  const patches = entries.reduce((n, m) => {
    markFindings(m).forEach((f) => {
      if (!DIAGNOSIS_PATCH_CODES.has(f.code)) return;
      const c = Number(f.count);
      n += Number.isFinite(c) && c > 0 ? c : 1;
    });
    return n;
  }, 0);
  const nerveSites = new Set();
  entries.forEach((m) => {
    if (!markCodes(m).some((code) => BODY_NERVE_CODES.has(code))) return;
    if (!isNerveRegion(m.region)) return;
    nerveSites.add(`${m.view || ""}:${m.region}`);
  });
  return { patches, nerves: Math.min(12, nerveSites.size) };
};

/** NFA affected nerves: ST (max 8) + VMT (max 10) = max 18. */
export const countNfaNerves = (d = {}) => {
  const st = d.sensoryChart?.points || {};
  const vmt = d.vmtChart?.points || {};

  let sensory = 0;
  if (st["Right Eye"] === "BLINKNOTNORM") sensory += 1;
  if (st["Left Eye"] === "BLINKNOTNORM") sensory += 1;

  ["R", "L"].forEach((side) => {
    HAND_NERVE_GROUPS[side].forEach((ids) => {
      if (ids.some((id) => st[id] === "WITHOUTSENS")) sensory += 1;
    });
    if (FOOT_POINTS[side].some((id) => st[id] === "WITHOUTSENS")) sensory += 1;
  });

  let voluntary = 0;
  Object.values(VMT_IDS).forEach((pair) => {
    if (vmtAffected(vmt[pair.R])) voluntary += 1;
    if (vmtAffected(vmt[pair.L])) voluntary += 1;
  });

  return {
    sensory: Math.min(8, sensory),
    voluntary: Math.min(10, voluntary),
    total: Math.min(18, sensory + voluntary),
  };
};

/**
 * EHF: per-side max of body-chart disability + ST + VMT (each site 0–2).
 * Total = sum of 6 sites (max 12). WHO G2D = max of the 6.
 */
export const leprosyScores = (d = {}) => {
  const marks = Object.values(d.marks || {});
  const st = d.sensoryChart?.points || {};
  const vmt = d.vmtChart?.points || {};

  const body = { eye: { R: 0, L: 0 }, hand: { R: 0, L: 0 }, foot: { R: 0, L: 0 } };
  marks.forEach((m) => {
    const side = regionSide(m.region);
    if (!side) return;
    markCodes(m).forEach((code) => {
      // Blind eye → 2
      if (code === "R" && isEyeRegion(m.region)) body.eye[side] = Math.max(body.eye[side], 2);
      // Claw / bone loss / ulcer on hand or foot → 2
      if (["J", "N", "P"].includes(code) && isHandRegion(m.region)) body.hand[side] = Math.max(body.hand[side], 2);
      if (["J", "N", "P"].includes(code) && isFootRegion(m.region)) body.foot[side] = Math.max(body.foot[side], 2);
    });
  });

  const sensoryEye = (id) => (st[id] === "BLINKNOTNORM" ? 1 : 0);
  const sensoryLimb = (ids) => (ids.some((id) => st[id] === "WITHOUTSENS") ? 1 : 0);

  const rightEye = Math.max(body.eye.R, sensoryEye("Right Eye"), vmtPointScore(vmt[VMT_IDS.eye.R]));
  const leftEye = Math.max(body.eye.L, sensoryEye("Left Eye"), vmtPointScore(vmt[VMT_IDS.eye.L]));
  const rightHand = Math.max(
    body.hand.R,
    sensoryLimb(HAND_NERVE_GROUPS.R.flat()),
    vmtPointScore(vmt[VMT_IDS.wrist.R]),
    vmtPointScore(vmt[VMT_IDS.finger.R]),
    vmtPointScore(vmt[VMT_IDS.thumb.R]),
  );
  const leftHand = Math.max(
    body.hand.L,
    sensoryLimb(HAND_NERVE_GROUPS.L.flat()),
    vmtPointScore(vmt[VMT_IDS.wrist.L]),
    vmtPointScore(vmt[VMT_IDS.finger.L]),
    vmtPointScore(vmt[VMT_IDS.thumb.L]),
  );
  const rightFoot = Math.max(body.foot.R, sensoryLimb(FOOT_POINTS.R), vmtPointScore(vmt[VMT_IDS.foot.R]));
  const leftFoot = Math.max(body.foot.L, sensoryLimb(FOOT_POINTS.L), vmtPointScore(vmt[VMT_IDS.foot.L]));

  const sites = [rightEye, leftEye, rightHand, leftHand, rightFoot, leftFoot].map((n) => Math.min(2, n));
  const ehf = Math.min(12, sites.reduce((a, b) => a + b, 0));
  const g2d = Math.max(0, ...sites);
  const eyes = rightEye + leftEye;
  const hands = rightHand + leftHand;
  const feet = rightFoot + leftFoot;

  return {
    rightEye: sites[0],
    leftEye: sites[1],
    rightHand: sites[2],
    leftHand: sites[3],
    rightFoot: sites[4],
    leftFoot: sites[5],
    eyes: Math.min(4, eyes),
    hands: Math.min(4, hands),
    feet: Math.min(4, feet),
    ehf,
    g2d,
    eyeGrade: Math.max(sites[0], sites[1]),
    handGrade: Math.max(sites[2], sites[3]),
    footGrade: Math.max(sites[4], sites[5]),
  };
};

/**
 * Classification: patches (1–5 PB, ≥6 MB) and max(body-chart nerves, NFA nerves)
 * (1 PB, ≥2 MB). No patches and no nerves → No Leprosy.
 */
export const leprosyClass = (d = {}) => {
  const counted = countLeprosyFindings(d.marks || {});
  const nfa = countNfaNerves(d);
  const patches = Number(d.patches != null && d.patches !== "" ? d.patches : counted.patches);
  const bodyNerves = counted.nerves;
  const computedNerves = Math.max(bodyNerves, nfa.total);
  const nerves = Number(d.nerves != null && d.nerves !== "" ? d.nerves : computedNerves);
  const smearPositive = Array.isArray(d.slitSkinZn)
    ? d.slitSkinZn.some((x) => (typeof x === "string" ? x : x?.result) === "Positive")
    : d.slitSkin === "Positive";

  if (!patches && !nerves && !smearPositive) {
    return { classification: "No Leprosy", patches: 0, nerves: 0, bodyNerves, nfaNerves: nfa.total };
  }
  if (smearPositive || patches >= 6 || nerves >= 2) {
    return { classification: "Multibacillary (MB)", patches, nerves, bodyNerves, nfaNerves: nfa.total };
  }
  return { classification: "Paucibacillary (PB)", patches, nerves, bodyNerves, nfaNerves: nfa.total };
};

export const yawsClass = (marks = {}) => {
  const codes = flattenMarks(marks).map((m) => m.code);
  if (codes.includes("BC")) return "Tertiary Yaws (Clinical / confirmed)";
  const p = codes.filter((c) => c === "P").length;
  const u = codes.filter((c) => c === "U").length;
  if (p + u === 0) return "";
  if (p <= 1 && u <= 1 && p + u <= 2) return "Primary Yaws (Clinical / confirmed)";
  return "Secondary Yaws (Clinical / confirmed)";
};
