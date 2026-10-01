/**
 * Family Planning (FPAS) — NTD extra condition.
 * Case details / history / risk factors mirror Ante Natal.
 * Services section mirrors Apex FAPL SimpleViewTable + popup.
 */
import {
  MEDICAL_HISTORY_OPTIONS,
  RISK_FACTOR_OPTIONS,
  PRESENT_ABSENT,
  DYSMENORRHEA,
  MENSTRUAL_FLOW,
  CYCLE_REGULARITY,
  YES_NO,
  COUNT_0_10,
  obstetricCountValue,
  autoRiskFactors as ancAutoRiskFactors,
  resolveDating,
  trimesterLabel,
  normalizeFamilyPlanningService,
  FAMILY_PLANNING,
} from "@/mock/antenatal";
import { localISODate } from "@/mock/specs";

export const FP_ID = "familyplanning";
export const FP_NAME = "Family Planning";

export {
  MEDICAL_HISTORY_OPTIONS,
  RISK_FACTOR_OPTIONS,
  PRESENT_ABSENT,
  DYSMENORRHEA,
  MENSTRUAL_FLOW,
  CYCLE_REGULARITY,
  YES_NO,
  COUNT_0_10,
  obstetricCountValue,
  resolveDating,
  trimesterLabel,
  FAMILY_PLANNING,
};

export const newFpEpisodeId = () =>
  `FP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000000) + 10000000)}`;

/** Same auto-suggestions as ANC (case / medical / age); vitals & delivery optional. */
export const autoRiskFactors = (data = {}, patient = {}) => ancAutoRiskFactors(data, patient);

export const REMOVAL_REASONS = [
  "Desire for Pregnancy",
  "Device expired",
  "Side effects",
  "Partner disapproved",
  "Method failure",
  "Other",
];

export const INJECTION_SITES = ["Left arm", "Right arm", "Left buttock", "Right buttock"];

/** Apex FAPL — male services. */
export const MALE_SERVICES = [
  "Condom",
  "Emergency contraceptive",
  "Oral Contraceptive pill",
  "Injectable",
  "Implant",
  "Vasectomy",
  "Implant removal",
];

/** Apex FAPL — female services. */
export const FEMALE_SERVICES = [
  "Condom",
  "Emergency contraceptive",
  "Oral Contraceptive pill",
  "Injectable",
  "Implant",
  "IUD Insertion - 10 years",
  "Tubal Ligation",
  "Implant removal",
  "IUD removal",
];

export const servicesForGender = (sex) => {
  const g = String(sex || "").toLowerCase();
  if (g === "male" || g === "m") return MALE_SERVICES;
  return FEMALE_SERVICES;
};

/** Full chip list for FP encounter — same as ANC delivery Family Planning. */
export const FP_SERVICE_OPTIONS = FAMILY_PLANNING;

export const FP_EXCLUSIVE_OPTIONS = ["None", "Planned"];

/** Child fields per service — same shape as Apex FAPL.js childItemConfig. */
export const SERVICE_CHILD_FIELDS = {
  Condom: [
    { key: "pieces", label: "Pieces", inputType: "input" },
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "Emergency contraceptive": [
    { key: "NoOfTablets", label: "No. of Tablets", inputType: "input" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "Oral Contraceptive pill": [
    { key: "NoOfTablets", label: "No. of Tablets", inputType: "input" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  Injectable: [
    { key: "dose", label: "Dose", inputType: "input" },
    { key: "site", label: "Site", inputType: "radios", options: INJECTION_SITES },
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  Implant: [
    { key: "dose", label: "Dose", inputType: "input" },
    { key: "site", label: "Site", inputType: "radios", options: INJECTION_SITES },
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  Vasectomy: [
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "Implant removal": [
    { key: "removalReason", label: "Removal reason", inputType: "checkboxs", options: REMOVAL_REASONS },
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "IUD Insertion - 10 years": [
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "Tubal Ligation": [
    { key: "notes", label: "Notes", inputType: "text" },
  ],
  "IUD removal": [
    { key: "removalReason", label: "Removal reason", inputType: "checkboxs", options: REMOVAL_REASONS },
    { key: "nextVisit", label: "Next visit", inputType: "datePicker" },
    { key: "notes", label: "Notes", inputType: "text" },
  ],
};

const fmtDisplayDate = (iso) => {
  if (!iso) return "";
  const d = new Date(/T/.test(iso) ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")} ${m} ${d.getFullYear()}`;
};

/** Apex valueFormatConfig — Service details column text. */
export const formatServiceDetails = (service, child = {}) => {
  const reasons = Array.isArray(child.removalReason)
    ? child.removalReason.filter(Boolean).join(", ")
    : child.removalReason || "";
  const map = {
    Condom: `Pieces - ${child.pieces || ""}`,
    "Emergency contraceptive": `No. of Tablets - ${child.NoOfTablets || ""}`,
    "Oral Contraceptive pill": `No. of Tablets - ${child.NoOfTablets || ""}`,
    Injectable: `Dose - ${child.dose || ""}ML(${child.site || ""})`,
    Implant: `Dose - ${child.dose || ""}ML(${child.site || ""})`,
    Vasectomy: "-",
    "Implant removal": `Removal reason - ${reasons}`,
    "IUD Insertion - 10 years": "-",
    "Tubal Ligation": "-",
    "IUD removal": `Removal reason - ${reasons}`,
  };
  return map[service] || child.notes || "—";
};

export const buildServiceRow = (parent = {}, child = {}) => {
  const service = parent.familyPlanningService || "";
  const dateIso = parent.date || localISODate();
  return {
    id: parent.id || `fp-svc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    service,
    dateOfService: fmtDisplayDate(dateIso),
    dateOfServiceIso: dateIso,
    serviceDetails: formatServiceDetails(service, child),
    familyPlanningService: service,
    nextVisit: child.nextVisit ? fmtDisplayDate(child.nextVisit) : "",
    nextVisitIso: child.nextVisit || "",
    notes: child.notes || "",
    rawData: { parentData: { ...parent, date: dateIso }, childData: { ...child } },
  };
};

export const emptyFpForm = () => ({
  caseDetails: {},
  history: { medical: [], riskFactors: [], riskFactorsDismissed: [], menstrual: {} },
  services: [],
  familyPlanningExclusive: "",
  familyPlanningPlannedDate: "",
  notes: [""],
});

/**
 * Seed Family Planning visit data from an Ante Natal encounter
 * (case details, history / risk factors, delivery FP service + details).
 */
export const fpFormFromAntenatal = (ancData = {}) => {
  const caseDetails = { ...(ancData.caseDetails || {}) };
  const history = {
    medical: [...(ancData.history?.medical || [])],
    riskFactors: [...(ancData.history?.riskFactors || [])],
    riskFactorsDismissed: [...(ancData.history?.riskFactorsDismissed || [])],
    menstrual: { ...(ancData.history?.menstrual || {}) },
  };
  const services = [];
  const fromMulti = Array.isArray(ancData.delivery?.familyPlanningServices)
    ? ancData.delivery.familyPlanningServices.filter((r) => {
        const name = r?.service || r?.familyPlanningService;
        return name && name !== "None" && name !== "Planned";
      })
    : [];
  if (fromMulti.length) {
    services.push(...fromMulti);
  } else {
    const service = normalizeFamilyPlanningService(ancData.delivery?.familyPlanning);
    if (service && service !== "None" && service !== "Planned" && !service.includes(",")) {
      services.push(
        buildServiceRow(
          {
            familyPlanningService: service,
            date: ancData.delivery?.date || ancData.delivery?.deliveryDate || localISODate(),
          },
          ancData.delivery?.familyPlanningDetails || {},
        ),
      );
    } else if (service && service.includes(",")) {
      service.split(",").map((s) => s.trim()).filter(Boolean).forEach((name) => {
        if (name === "None" || name === "Planned") return;
        services.push(
          buildServiceRow(
            {
              familyPlanningService: name,
              date: ancData.delivery?.date || ancData.delivery?.deliveryDate || localISODate(),
            },
            {},
          ),
        );
      });
    }
  }
  return {
    ...emptyFpForm(),
    caseDetails,
    history,
    services,
    familyPlanningExclusive:
      !services.length && (ancData.delivery?.familyPlanning === "None" || ancData.delivery?.familyPlanning === "Planned")
        ? ancData.delivery.familyPlanning
        : "",
    familyPlanningPlannedDate:
      ancData.delivery?.familyPlanning === "Planned"
        ? (ancData.delivery?.familyPlanningPlannedDate || ancData.delivery?.date || ancData.delivery?.deliveryDate || "")
        : "",
    notes: Array.isArray(ancData.notes) && ancData.notes.length ? [...ancData.notes] : [""],
    _seededFromAntenatal: true,
  };
};

export const normalizeFpForm = (partial = {}, { seedPrior = false, patientEncs = [] } = {}) => {
  const prior = seedPrior
    ? [...patientEncs.filter((e) => e.disease === FP_ID)].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    : null;
  const priorHist = prior?.data?.history || {};
  const base = { ...emptyFpForm(), ...partial };
  base.history = {
    medical: [...new Set([...(priorHist.medical || []), ...(base.history?.medical || [])])],
    riskFactors: [...new Set([...(priorHist.riskFactors || []), ...(base.history?.riskFactors || [])])],
    riskFactorsDismissed: [
      ...new Set([...(priorHist.riskFactorsDismissed || []), ...(base.history?.riskFactorsDismissed || [])]),
    ],
    menstrual: { ...(priorHist.menstrual || {}), ...(base.history?.menstrual || {}) },
  };
  if (seedPrior && prior?.data?.caseDetails && !Object.keys(partial.caseDetails || {}).length) {
    base.caseDetails = { ...prior.data.caseDetails };
  }
  if (!Array.isArray(base.services)) base.services = [];
  if (!FP_EXCLUSIVE_OPTIONS.includes(base.familyPlanningExclusive)) {
    base.familyPlanningExclusive = "";
  }
  if (base.familyPlanningExclusive !== "Planned") {
    base.familyPlanningPlannedDate = "";
  } else if (!base.familyPlanningPlannedDate) {
    base.familyPlanningPlannedDate = localISODate();
  }
  if (!Array.isArray(base.notes) || !base.notes.length) base.notes = [""];
  return base;
};
