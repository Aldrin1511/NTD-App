import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Field, TextField, AreaField, SelectField, AlertPanel, ItemActions, CheckGrid } from "@/components/Fields";
import { ConditionEntryShell, ChoiceChips } from "@/components/EntryKit";
import { GrowthEntry } from "@/components/GrowthChart";
import MilestoneChart from "@/components/MilestoneChart";
import { dobFromAge, formatAgeYMD } from "@/components/Capture";
import { monthsBetween } from "@/mock/growth";
import { localISODate } from "@/mock/specs";
import {
  WELLBABY_ID, WELLBABY_NAME, CHIEF_COMPLAINTS, ALLERGIES, WELLBABY_DRUGS, WELLBABY_DRUG_META,
  WELLBABY_LAB_TESTS, immunizationDueFromDob, isVaccineOverdue, newWbEpisodeId,
  entryVisibleVaccines, entryDropdownVaccines,
} from "@/mock/wellbaby";
import {
  ANTENATAL_ID,
  DELIVERY_TYPES, DELIVERY_COMPLICATIONS, FETUS_COUNTS, FAMILY_PLANNING, POSTPARTUM_COMPLICATIONS,
  DELIVERY_OUTCOMES, BABY_SEX, BABY_COMPLICATIONS, BABY_OUTCOMES, BABY_OUTCOME_ALERTS, YES_NO,
  PHYSICAL_EXAM_FIELDS, babyName, normalizeFamilyPlanningService,
} from "@/mock/antenatal";
import { ImmunizationEntryCards } from "@/components/ImmunizationCards";
import AntenatalMedications from "@/components/AntenatalMedications";
import FamilyPlanningServicesPicker, {
  exclusiveFamilyPlanningValue,
  legacyFamilyPlanningToRows,
} from "@/components/FamilyPlanningServicesPicker";
import { toast } from "sonner";
import { persistIntegratedEncounter, useExtraPhiAutosave, useLoadEncounterPhi } from "@/lib/extraEncounterSync";

const emptyLabRow = (name) => ({
  test: name || WELLBABY_LAB_TESTS[0]?.name || "HIV test",
  result: "",
  analyte: "",
  location: "Bedside",
  date: "",
  sentToLab: false,
  completed: false,
});

const emptyBaby = (deliveryType = "") => ({
  sex: "", weightKg: "", lengthCm: "", headCm: "", apgar1: "", apgar5: "", apgar10: "",
  resuscitation: "", complications: [], outcome: "", deliveryType, registered: false,
  physicalExam: {},
});

const syncBabiesToFetuses = (babies, count, deliveryType = "") => {
  const n = Math.max(0, Number(count) || 0);
  const next = [...(babies || [])];
  while (next.length < n) next.push(emptyBaby(deliveryType));
  return next.slice(0, n);
};

const babyFromFlat = (src = {}, deliveryType = "") => ({
  ...emptyBaby(deliveryType),
  sex: src.sex || "",
  weightKg: src.weightKg || "",
  lengthCm: src.lengthCm || "",
  headCm: src.headCm || "",
  apgar1: src.apgar1 || "",
  apgar5: src.apgar5 || "",
  apgar10: src.apgar10 || "",
  resuscitation: src.resuscitation || "",
  complications: src.complications || [],
  outcome: DELIVERY_OUTCOMES.includes(src.outcome) ? "" : (src.outcome || ""),
  deliveryType: src.deliveryType || src.type || src.mode || deliveryType || "",
  physicalExam: src.physicalExam || {},
  patientId: src.patientId || "",
  registered: !!src.registered || !!src.patientId,
});

const empty = () => ({
  delivery: { babies: [], postpartum: [], fetusLengths: {} },
  complaints: [], allergy: [], growth: { standard: "WHO", mode: "Percentile", measures: {} },
  immunization: {}, milestones: {}, notes: [""], drugs: [], posology: {}, medCourses: {},
  lab: WELLBABY_LAB_TESTS.map((t) => emptyLabRow(t.name)),
});

const babyHasContent = (b = {}) =>
  !!(b.sex || b.weightKg || b.lengthCm || b.headCm || b.apgar1 || b.apgar5 || b.apgar10
    || b.resuscitation || (b.complications || []).length || b.outcome || b.deliveryType
    || Object.values(b.physicalExam || {}).some(Boolean));

const deliveryHasContent = (del = {}) =>
  !!(
    del.deliveryDate || del.date || del.mode || del.type || del.place || del.complication
    || del.fetuses || del.familyPlanning || (del.postpartum || []).length
    || (del.outcome && DELIVERY_OUTCOMES.includes(del.outcome))
    || (del.babies || []).some(babyHasContent)
    || del.weightKg || del.lengthCm || del.headCm || del.apgar1 || del.apgar5 || del.apgar10
    || del.sex || del.resuscitation || (del.complications || []).length || del.deliveryType
    || Object.values(del.physicalExam || {}).some(Boolean)
  );

const isBlankVal = (v) =>
  v == null
  || v === ""
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/** Overlay only non-blank values so empty WB fields do not wipe ANC/newborn seed. */
const overlayFilled = (base = {}, overlay = {}) => {
  const out = { ...base };
  Object.entries(overlay || {}).forEach(([k, v]) => {
    if (k === "babies") {
      const baseBabies = Array.isArray(base.babies) ? base.babies : [];
      const overBabies = Array.isArray(v) ? v : [];
      if (!overBabies.length) return;
      if (!baseBabies.length) {
        out.babies = overBabies;
        return;
      }
      const n = Math.max(baseBabies.length, overBabies.length);
      out.babies = Array.from({ length: n }, (_, i) => {
        const b = baseBabies[i] || {};
        const o = overBabies[i] || {};
        const merged = { ...b };
        Object.entries(o).forEach(([bk, bv]) => {
          if (bk === "physicalExam") {
            merged.physicalExam = { ...(b.physicalExam || {}) };
            Object.entries(bv || {}).forEach(([ek, ev]) => {
              if (!isBlankVal(ev)) merged.physicalExam[ek] = ev;
            });
            return;
          }
          if (!isBlankVal(bv)) merged[bk] = bv;
        });
        return merged;
      });
      return;
    }
    if (k === "fetusLengths") {
      if (isBlankVal(v)) return;
      out.fetusLengths = { ...(base.fetusLengths || {}) };
      Object.entries(v || {}).forEach(([fk, fv]) => {
        if (!isBlankVal(fv)) out.fetusLengths[fk] = fv;
      });
      return;
    }
    if (k === "postpartum") {
      if (Array.isArray(v) && v.length) out.postpartum = v;
      return;
    }
    if (!isBlankVal(v)) out[k] = v;
  });
  return out;
};

/** Latest prior Well Baby visit for this patient (excluding the encounter being edited). */
const latestPriorWb = (encounters, patientId, excludeId) =>
  [...encounters]
    .filter((e) => e.patientId === patientId && e.disease === WELLBABY_ID && e.id !== excludeId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

/** Normalize any legacy flat delivery + ANC mother delivery into ANC-shaped delivery. */
const normalizeDelivery = (raw = {}, patient = {}) => {
  const details = patient?.deliveryDetails || {};
  const type = raw.type || raw.mode || details.type || details.mode || "";
  const deliveryOutcome =
    (DELIVERY_OUTCOMES.includes(raw.place) ? raw.place : "")
    || (DELIVERY_OUTCOMES.includes(raw.outcome) ? raw.outcome : "")
    || (DELIVERY_OUTCOMES.includes(details.place) ? details.place : "")
    || "";
  let babies = Array.isArray(raw.babies) ? raw.babies.map((b) => ({ ...emptyBaby(type), ...b })) : [];
  if (!babies.length && (babyHasContent(raw) || babyHasContent(details))) {
    babies = [babyFromFlat({ ...details, ...raw }, type)];
  }
  const explicitFetuses =
    (raw.fetuses != null && raw.fetuses !== "" ? String(raw.fetuses) : "")
    || (details.fetuses != null && details.fetuses !== "" ? String(details.fetuses) : "")
    || (babies.some(babyHasContent) ? String(Math.max(babies.length, 1)) : "");
  const fetuses = explicitFetuses;
  if (fetuses) {
    babies = syncBabiesToFetuses(
      babies.length ? babies : [emptyBaby(type)],
      fetuses,
      type
    );
  }
  // Ensure this patient's row is filled when matched by patientId / sex
  if (babies.length && patient?.id) {
    let idx = babies.findIndex((b) => b.patientId === patient.id);
    if (idx < 0) {
      idx = babies.findIndex((b) => !babyHasContent(b));
      if (idx < 0) idx = 0;
    }
    const flat = babyFromFlat({ ...details, ...raw }, type);
    const cur = babies[idx] || emptyBaby(type);
    const filled = { ...cur };
    Object.entries(flat).forEach(([k, v]) => {
      if (k === "physicalExam") {
        const pe = { ...(cur.physicalExam || {}) };
        Object.entries(v || {}).forEach(([ek, ev]) => {
          if (!isBlankVal(ev) && isBlankVal(pe[ek])) pe[ek] = ev;
        });
        if (Object.keys(pe).length) filled.physicalExam = pe;
        return;
      }
      if (isBlankVal(cur[k]) && !isBlankVal(v)) filled[k] = v;
    });
    babies[idx] = {
      ...filled,
      patientId: cur.patientId || patient.id,
      sex: cur.sex || flat.sex || patient.sex || patient.gender || "",
      registered: !!(cur.registered || cur.patientId || patient.id),
      patientCode: cur.patientCode || "",
    };
  }
  return {
    deliveryDate: raw.deliveryDate || raw.date || details.deliveryDate || details.date || "",
    date: raw.date || raw.deliveryDate || details.date || details.deliveryDate || "",
    mode: type,
    type,
    place: deliveryOutcome,
    outcome: deliveryOutcome,
    complication: raw.complication || details.complication || "",
    fetuses,
    fetusLengths: raw.fetusLengths || details.fetusLengths || {},
    familyPlanning: normalizeFamilyPlanningService(raw.familyPlanning || details.familyPlanning || ""),
    familyPlanningDetails: raw.familyPlanningDetails || details.familyPlanningDetails || {},
    familyPlanningPlannedDate:
      normalizeFamilyPlanningService(raw.familyPlanning || details.familyPlanning || "") === "Planned"
        ? (raw.familyPlanningPlannedDate || details.familyPlanningPlannedDate || "")
        : "",
    familyPlanningServices: (() => {
      const merged = {
        familyPlanning: normalizeFamilyPlanningService(raw.familyPlanning || details.familyPlanning || ""),
        familyPlanningDetails: raw.familyPlanningDetails || details.familyPlanningDetails || {},
        familyPlanningServices: raw.familyPlanningServices || details.familyPlanningServices,
        date: raw.date || raw.deliveryDate || details.date || details.deliveryDate || "",
      };
      return legacyFamilyPlanningToRows(merged);
    })(),
    postpartum: raw.postpartum || details.postpartum || [],
    babies,
    motherId: raw.motherId || details.motherId || patient?.bornFrom || "",
    motherName: raw.motherName || details.motherName || "",
  };
};

/** Latest ANC delivery for a patient id (mother or self). */
const latestAncDelivery = (encounters, patientId) => {
  if (!patientId) return {};
  const enc = [...encounters]
    .filter((e) => e.patientId === patientId && e.disease === ANTENATAL_ID && e.data?.delivery)
    .filter((e) => deliveryHasContent(e.data.delivery))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return enc?.data?.delivery || {};
};

/** Pull ANC delivery + newborn: registered baby's mother ANC, else this patient's own ANC. */
const antenatalDeliverySeed = (encounters, patient) => {
  const details = patient?.deliveryDetails || {};
  const motherId = details.motherId || patient?.bornFrom || "";
  const motherDel = motherId ? latestAncDelivery(encounters, motherId) : {};
  const ownDel = latestAncDelivery(encounters, patient?.id);
  // Registered baby → mother ANC is primary; mother opening Well Baby → own ANC.
  // Prefer filled values only so empty mother/own rows do not wipe the other.
  const sourceDel = motherId
    ? overlayFilled(ownDel, motherDel)
    : overlayFilled(motherDel, ownDel);

  const detailOverlay = {
    date: details.deliveryDate || details.date || "",
    deliveryDate: details.deliveryDate || details.date || "",
    type: details.type || details.mode || "",
    mode: details.mode || details.type || "",
    place: details.place || "",
    outcome: details.place || "",
    complication: details.complication || "",
    fetuses: details.fetuses || "",
    fetusLengths: details.fetusLengths || {},
    familyPlanning: details.familyPlanning || "",
    postpartum: details.postpartum || [],
    babies: (Array.isArray(details.babies) && details.babies.length) ? details.babies : undefined,
    motherId: details.motherId || motherId || "",
    motherName: details.motherName || "",
  };
  return normalizeDelivery(overlayFilled(sourceDel, detailOverlay), patient);
};

/** Seed Delivery + Newborn: prior WB / existing filled fields win; ANC fills the gaps. */
const seedDelivery = (encounters, patient, existing) => {
  const prior = latestPriorWb(encounters, patient?.id, existing?.id);
  const fromAnc = antenatalDeliverySeed(encounters, patient);
  const fromPrior = prior?.data?.delivery ? normalizeDelivery(prior.data.delivery, patient) : {};
  const fromExisting = existing?.data?.delivery ? normalizeDelivery(existing.data.delivery, patient) : {};
  return normalizeDelivery(
    overlayFilled(overlayFilled(fromAnc, fromPrior), fromExisting),
    patient,
  );
};

const NO_KNOWN_ALLERGY = "No known allergy";

/** Seed allergy chips from prior WB visit when this visit has none yet. */
const seedAllergy = (encounters, patientId, existing) => {
  const fromExisting = Array.isArray(existing?.data?.allergy) ? existing.data.allergy.filter(Boolean) : [];
  if (fromExisting.length) return fromExisting;
  const prior = latestPriorWb(encounters, patientId, existing?.id);
  return Array.isArray(prior?.data?.allergy) ? prior.data.allergy.filter(Boolean) : [];
};

/** Keep "No known allergy" mutually exclusive with specific allergies. */
const nextAllergySelection = (next = []) => {
  const list = [...new Set((next || []).filter(Boolean))];
  if (!list.includes(NO_KNOWN_ALLERGY)) return list;
  if (list[list.length - 1] === NO_KNOWN_ALLERGY) return [NO_KNOWN_ALLERGY];
  return list.filter((a) => a !== NO_KNOWN_ALLERGY);
};

/** Normalize WB form shape (init + PHI hydrate). */
const normalizeWbForm = (partial = {}, { encounters = [], patient = null, patientId = "", existing = null, seedDeliveryAllergy = true } = {}) => {
  const base = { ...empty(), ...partial };
  // Always seed from ANC/prior, then overlay any filled values from this visit / PHI
  const seeded = seedDelivery(encounters, patient, existing);
  if (deliveryHasContent(partial.delivery || {})) {
    base.delivery = normalizeDelivery(overlayFilled(seeded, partial.delivery), patient || {});
  } else {
    base.delivery = seeded;
  }
  if (seedDeliveryAllergy) {
    base.allergy = Array.isArray(partial.allergy) && partial.allergy.length
      ? nextAllergySelection(partial.allergy)
      : seedAllergy(encounters, patientId, existing);
  } else if (Array.isArray(partial.allergy) && partial.allergy.length) {
    base.allergy = nextAllergySelection(partial.allergy);
  } else {
    base.allergy = seedAllergy(encounters, patientId, existing);
  }
  if (!Array.isArray(base.lab)) base.lab = [];
  if (!base.lab.length) {
    base.lab = WELLBABY_LAB_TESTS.map((t) => emptyLabRow(t.name));
  } else {
    const missing = WELLBABY_LAB_TESTS.filter((t) => !base.lab.some((r) => r.test === t.name));
    if (missing.length) {
      base.lab = [...base.lab, ...missing.map((t) => emptyLabRow(t.name))];
    }
  }
  base.posology = { ...(base.posology || {}) };
  base.medCourses = { ...(base.medCourses || {}) };
  if (!Array.isArray(base.drugs)) base.drugs = [];
  if (!Array.isArray(base.notes) || !base.notes.length) base.notes = [""];
  return base;
};

export default function WellBabyEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, loadEncounterPhi, upsertEncounterPhiField, finalizeEncounterPhi, user, settings, facilities, online, ensureCatalogueDrug, syncPatientVisitPhi } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.disease === WELLBABY_ID && (e.id === params.get("enc") || e.visitId === params.get("enc")));
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const priorWb = useMemo(() => latestPriorWb(encounters, id, existing?.id), [encounters, id, existing?.id]);
  const priorGrowthMeasures = useMemo(() => {
    const withGrowth = [...encounters]
      .filter((e) => e.patientId === id && e.disease === WELLBABY_ID && e.id !== existing?.id)
      .filter((e) => Object.values(e.data?.growth?.measures || {}).some((v) => v !== "" && v != null))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return withGrowth?.data?.growth?.measures || {};
  }, [encounters, id, existing?.id]);
  const [d, setD] = useState(() =>
    normalizeWbForm(existing?.data || {}, {
      encounters,
      patient: p,
      patientId: id,
      existing,
      seedDeliveryAllergy: true,
    }),
  );
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [revealedVacIds, setRevealedVacIds] = useState([]);
  const [ancSeedApplied, setAncSeedApplied] = useState(false);
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Well baby visit";

  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt);
  const visitDate = existing?.date || localISODate();
  const ageLabel = formatAgeYMD(dob, visitDate) || "—";
  const ageMonths = monthsBetween(dob, visitDate);
  const schedule = (settings.immunizationSchedules || []).find((s) => s.condition === WELLBABY_ID) || { vaccines: [] };
  const vaccineDrugs = (settings.drugs || []).filter((x) => x.type === "Vaccine" || x.form === "Vaccine");
  const facilityHasLab = useMemo(() => (facilities || []).some((f) => f.name === facility && f.hasLab), [facilities, facility]);

  const { queueSectionDiff, queueField, flushPendingPhi } = useExtraPhiAutosave({
    online,
    upsertEncounterPhiField,
    patientId: p?.id || id,
    existing,
    diseaseId: WELLBABY_ID,
  });

  const { phiLoading } = useLoadEncounterPhi({
    existing,
    online,
    loadEncounterPhi,
    applyForm: (form) =>
      normalizeWbForm(
        { ...(existing?.data || {}), ...form },
        { encounters, patient: p, patientId: id, existing, seedDeliveryAllergy: false },
      ),
    setD,
    setSavedAt,
  });

  const motherLinkId = p?.deliveryDetails?.motherId || p?.bornFrom || "";

  // Load mother's ANC PHI so delivery/newborn can seed when opening WB on a registered baby
  useEffect(() => {
    if (!online || !motherLinkId || typeof syncPatientVisitPhi !== "function") return;
    const motherHasAnc = encounters.some(
      (e) => e.patientId === motherLinkId && e.disease === ANTENATAL_ID && deliveryHasContent(e.data?.delivery),
    );
    if (motherHasAnc) return;
    syncPatientVisitPhi(motherLinkId).catch(() => {});
  }, [online, motherLinkId, syncPatientVisitPhi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also hydrate this patient's own ANC when opening WB on the mother
  useEffect(() => {
    if (!online || !p?.id || typeof syncPatientVisitPhi !== "function") return;
    if (motherLinkId) return;
    const ownHasAnc = encounters.some(
      (e) => e.patientId === p.id && e.disease === ANTENATAL_ID && deliveryHasContent(e.data?.delivery),
    );
    if (ownHasAnc) return;
    const hasAncVisit = encounters.some((e) => e.patientId === p.id && e.disease === ANTENATAL_ID);
    if (!hasAncVisit) return;
    syncPatientVisitPhi(p.id).catch(() => {});
  }, [online, p?.id, motherLinkId, syncPatientVisitPhi]); // eslint-disable-line react-hooks/exhaustive-deps

  const seededFromAnc = useMemo(
    () => deliveryHasContent(antenatalDeliverySeed(encounters, p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [encounters, p?.id, p?.bornFrom, p?.deliveryDetails]
  );

  // Fill empty delivery/newborn fields from ANC (do not wipe values already entered on WB)
  useEffect(() => {
    if (!p) return;
    const fromAnc = antenatalDeliverySeed(encounters, p);
    if (!deliveryHasContent(fromAnc)) return;
    const priorDel = latestPriorWb(encounters, p.id, existing?.id)?.data?.delivery || {};
    setD((s) => {
      const next = normalizeDelivery(
        overlayFilled(overlayFilled(fromAnc, priorDel), s.delivery || {}),
        p,
      );
      if (JSON.stringify(s.delivery || {}) === JSON.stringify(next)) return s;
      setAncSeedApplied(true);
      return { ...s, delivery: next };
    });
  }, [encounters, p?.id, p?.bornFrom, p?.deliveryDetails, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <div className="p-8">Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button></div>;

  const set = (k, v) => {
    setD((s) => ({ ...s, [k]: v }));
    queueField(k, v);
  };
  const setDelivery = (patch) => {
    const prev = d.delivery || {};
    const next = { ...prev, ...patch };
    setD((s) => ({ ...s, delivery: next }));
    queueSectionDiff("delivery", prev, next);
  };
  const delivery = d.delivery || {};
  const babies = delivery.babies || [];
  const fetusCount = Number(delivery.fetuses || 0);
  const motherFromId = delivery.motherId ? patients.find((x) => x.id === delivery.motherId) : null;
  const motherLabel = delivery.motherName || motherFromId?.name || "mother";
  const setFetuses = (v) => {
    const prev = d.delivery || {};
    const next = {
      ...prev,
      fetuses: v,
      babies: syncBabiesToFetuses(prev.babies, v, prev.type || prev.mode || ""),
    };
    setD((s) => ({ ...s, delivery: next }));
    queueSectionDiff("delivery", prev, next);
  };
  const updBaby = (i, patch) => {
    const prev = d.delivery || {};
    const next = {
      ...prev,
      babies: (prev.babies || []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    };
    setD((s) => ({ ...s, delivery: next }));
    queueSectionDiff("delivery", prev, next);
  };
  const updBabyExam = (i, k, v) => {
    const prev = d.delivery || {};
    const next = {
      ...prev,
      babies: (prev.babies || []).map((b, j) =>
        (j === i ? { ...b, physicalExam: { ...(b.physicalExam || {}), [k]: v } } : b)),
    };
    setD((s) => ({ ...s, delivery: next }));
    queueSectionDiff("delivery", prev, next);
  };
  const carriedFromPrior = !existing && !!(priorWb && deliveryHasContent(priorWb.data?.delivery));
  const carriedFromMother =
    !carriedFromPrior
    && seededFromAnc
    && deliveryHasContent(delivery)
    && (ancSeedApplied || !existing);

  const toggleVaccine = (item) => {
    const prev = d.immunization || {};
    const cur = prev[item.id];
    const next = { ...prev, [item.id]: cur?.given ? { given: false } : { given: true, date: localISODate() } };
    setD((s) => ({ ...s, immunization: next }));
    queueSectionDiff("immunization", prev, next);
  };
  const setVaccineDate = (k, date) => {
    const prev = d.immunization || {};
    const next = { ...prev, [k]: { given: true, date } };
    setD((s) => ({ ...s, immunization: next }));
    queueSectionDiff("immunization", prev, next);
  };
  const scheduleVaccines = schedule.vaccines || [];
  const asOf = visitDate ? new Date(visitDate) : new Date();
  const visibleVaccines = entryVisibleVaccines(scheduleVaccines, d.immunization, dob, revealedVacIds, asOf);
  const dropdownScheduleDoses = entryDropdownVaccines(scheduleVaccines, d.immunization, dob, revealedVacIds, asOf);
  const addVacOptions = [
    ...dropdownScheduleDoses.map((v) => ({ value: `sch:${v.id}`, label: v.name })),
    ...vaccineDrugs
      .filter((v) => !d.immunization[v.name] && !scheduleVaccines.some((s) => s.name === v.name || s.id === v.name))
      .map((v) => ({ value: `drug:${v.name}`, label: v.name })),
  ];
  const onAddVaccine = (raw) => {
    if (!raw) return;
    if (raw.startsWith("sch:")) {
      const id = raw.slice(4);
      setRevealedVacIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }
    if (raw.startsWith("drug:")) setVaccineDate(raw.slice(5), localISODate());
  };
  const toggleMilestone = (m) => {
    const prev = d.milestones || {};
    const cur = prev[m.id];
    const next = { ...prev, [m.id]: cur?.achieved ? { achieved: false } : { achieved: true, date: localISODate() } };
    setD((s) => ({ ...s, milestones: next }));
    queueSectionDiff("milestones", prev, next);
  };
  const setMilestoneDate = (mid, date) => {
    const prev = d.milestones || {};
    const next = { ...prev, [mid]: { achieved: true, date } };
    setD((s) => ({ ...s, milestones: next }));
    queueSectionDiff("milestones", prev, next);
  };
  const clearMilestone = (mid) => {
    const prev = d.milestones || {};
    const next = { ...prev, [mid]: { achieved: false } };
    setD((s) => ({ ...s, milestones: next }));
    queueSectionDiff("milestones", prev, next);
  };

  const labTestNames = WELLBABY_LAB_TESTS.map((t) => t.name);

  const addLabForTest = (testName, afterIndex) => {
    const row = emptyLabRow(testName);
    setD((s) => {
      let next;
      if (afterIndex == null) {
        const lastIdx = s.lab.reduce((acc, r, i) => (r.test === testName ? i : acc), -1);
        if (lastIdx < 0) next = [row, ...s.lab];
        else {
          next = [...s.lab];
          next.splice(lastIdx + 1, 0, row);
        }
      } else {
        next = [...s.lab];
        next.splice(afterIndex + 1, 0, row);
      }
      queueField("lab", next, "Laboratory", "Lab");
      return { ...s, lab: next };
    });
  };
  const updLab = (i, patch) => {
    setD((s) => {
      const next = s.lab.map((x, j) => (j === i ? { ...x, ...patch } : x));
      queueField("lab", next, "Laboratory", "Lab");
      return { ...s, lab: next };
    });
  };
  const rmLab = (i) => setD((s) => {
    const removed = s.lab[i];
    let next = s.lab.filter((_, j) => j !== i);
    if (removed && labTestNames.includes(removed.test) && !next.some((r) => r.test === removed.test)) {
      next = [...next, emptyLabRow(removed.test)];
    }
    queueField("lab", next, "Laboratory", "Lab");
    return { ...s, lab: next };
  });

  const setNote = (i, v) => {
    const next = d.notes.map((n, j) => (j === i ? v : n));
    setD((s) => ({ ...s, notes: next }));
    queueField("notes", next, "Visit notes", "Visit notes");
  };
  const addNote = () => {
    const next = ["", ...d.notes];
    setD((s) => ({ ...s, notes: next }));
    queueField("notes", next, "Visit notes", "Visit notes");
  };
  const rmNote = (i) => {
    const next = d.notes.length <= 1 ? [""] : d.notes.filter((_, j) => j !== i);
    setD((s) => ({ ...s, notes: next }));
    queueField("notes", next, "Visit notes", "Visit notes");
  };
  const catalogueDrugs = (settings.drugs || []).filter((x) => x.type !== "Vaccine" && x.form !== "Vaccine").map((x) => x.name);

  const persist = async (close) => {
    const episodeId =
      existing?.episodeId
      || existing?.recordId
      || patientEncs.filter((e) => e.disease === WELLBABY_ID)[0]?.episodeId
      || patientEncs.filter((e) => e.disease === WELLBABY_ID)[0]?.recordId
      || newWbEpisodeId();
    const { canWritePhi } = await persistIntegratedEncounter({
      online,
      saveEncounter,
      upsertEncounterPhiField,
      finalizeEncounterPhi,
      flushPendingPhi,
      existing,
      payload: {
        id: existing?.id,
        patientId: p.id,
        episodeId,
        disease: WELLBABY_ID,
        facility,
        worker: user?.name,
        type: visitType,
        diagnosis: ageLabel !== "—" ? `Age ${ageLabel}` : "",
        treatment: (d.drugs || []).join(" + "),
        outcome: "",
        data: { ...d, delivery, ageMonths, growthAge: ageMonths },
      },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=wellbaby`);
    if (canWritePhi) toast.success(close ? "Well baby visit saved" : "Saved");
    else if (online) toast.success(close ? "Well baby visit queued for sync" : "Saved · queued for sync");
    else toast.success("Saved · queued until online");
  };

  const sections = [
    {
      title: "Delivery details",
      done: !!(delivery.deliveryDate || delivery.date || delivery.mode || delivery.type || delivery.place || delivery.outcome || delivery.complication || delivery.fetuses || delivery.familyPlanning || (delivery.familyPlanningServices || []).length || (delivery.postpartum || []).length),
      body: (
        <div className="space-y-5">
          {(carriedFromPrior || carriedFromMother) && (
            <AlertPanel
              level="info"
              title={carriedFromPrior ? "Carried forward from previous visit" : "Auto-populated from Ante Natal"}
              testid="wb-delivery-auto"
            >
              {carriedFromPrior
                ? "Delivery and new born details were copied from the last Well Baby visit. Edit if needed."
                : "Imported from Ante Natal delivery / new born details. Edit if needed."}
            </AlertPanel>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Delivery date"
              type="date"
              allowEmpty
              value={delivery.deliveryDate || delivery.date || ""}
              onChange={(e) => setDelivery({ deliveryDate: e.target.value, date: e.target.value })}
              testid="wb-del-date"
            />
            <SelectField
              label="Delivery type"
              options={DELIVERY_TYPES}
              value={delivery.type || delivery.mode || ""}
              onChange={(v) => setDelivery({ type: v, mode: v })}
              testid="wb-del-type"
            />
          </div>
          <ChoiceChips
            label="Delivery complication(s)"
            options={DELIVERY_COMPLICATIONS}
            value={delivery.complication || ""}
            onChange={(v) => setDelivery({ complication: v })}
            testid="wb-del-complication"
          />
          <ChoiceChips
            label="No of Fetuses"
            options={FETUS_COUNTS}
            value={String(delivery.fetuses || "")}
            onChange={setFetuses}
            testid="wb-del-fetuses"
          />
          {fetusCount > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: fetusCount }, (_, i) => (
                <TextField
                  key={i}
                  label={`Total length of delivery — fetus ${i + 1}`}
                  value={delivery.fetusLengths?.[i] || ""}
                  onChange={(e) => setDelivery({ fetusLengths: { ...(delivery.fetusLengths || {}), [i]: e.target.value } })}
                  testid={`wb-del-length-${i}`}
                  placeholder="e.g. 8 hrs"
                />
              ))}
            </div>
          )}
          <FamilyPlanningServicesPicker
            options={FAMILY_PLANNING}
            value={delivery.familyPlanningServices || []}
            onChange={(rows) =>
              setDelivery({
                familyPlanningServices: rows,
                familyPlanning: rows.map((r) => r.service || r.familyPlanningService).filter(Boolean).join(", "),
                familyPlanningDetails: rows[0]?.rawData?.childData || {},
                familyPlanningPlannedDate: "",
              })
            }
            exclusiveOptions={["None", "Planned"]}
            exclusiveValue={exclusiveFamilyPlanningValue(delivery)}
            onExclusiveChange={(v) =>
              setDelivery({
                familyPlanning: v,
                familyPlanningServices: [],
                familyPlanningDetails: {},
                familyPlanningPlannedDate: v === "Planned" ? (delivery.familyPlanningPlannedDate || localISODate()) : "",
              })
            }
            plannedDate={delivery.familyPlanningPlannedDate || ""}
            onPlannedDateChange={(date) => setDelivery({ familyPlanningPlannedDate: date || "" })}
            label="Family planning (multi-select)"
            testid="wb-del-fp"
          />
          <CheckGrid
            label="Postpartum complication(s)"
            options={POSTPARTUM_COMPLICATIONS}
            value={delivery.postpartum || []}
            onChange={(v) => setDelivery({ postpartum: v })}
            testid="wb-del-postpartum"
          />
          <ChoiceChips
            label="Delivery Outcome"
            options={DELIVERY_OUTCOMES}
            value={delivery.outcome || delivery.place || ""}
            onChange={(v) => setDelivery({ outcome: v, place: v })}
            testid="wb-del-outcome"
          />
        </div>
      ),
    },
    {
      title: "New born details",
      done: babies.length > 0 && babies.some(babyHasContent),
      body: (
        <div className="space-y-4">
          <p className="font-head text-sm font-semibold text-primary">
            New born(s){babies.length > 0 ? ` · ${babies.length}` : ""}
          </p>
          {fetusCount === 0 && (
            <p className="text-sm text-muted-foreground">
              Set <span className="font-medium text-foreground">No of Fetuses</span> in Delivery details to show newborn forms.
            </p>
          )}
          {babies.map((b, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3 space-y-3" data-testid={`wb-baby-${i}`}>
              <p className="text-sm font-semibold">{babyName(motherLabel, i, babies.length)}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Delivery type"
                  options={DELIVERY_TYPES}
                  value={b.deliveryType || delivery.type || delivery.mode || ""}
                  onChange={(v) => updBaby(i, { deliveryType: v })}
                  testid={`wb-baby-deltype-${i}`}
                />
                <SelectField
                  label="Sex"
                  options={BABY_SEX}
                  value={b.sex || ""}
                  onChange={(v) => updBaby(i, { sex: v })}
                  testid={`wb-baby-sex-${i}`}
                />
                <TextField label="Birth Weight (kgs)" type="number" step="0.1" value={b.weightKg || ""} onChange={(e) => updBaby(i, { weightKg: e.target.value })} testid={`wb-baby-weight-${i}`} />
                <TextField label="Birth Length (cms)" type="number" step="0.1" value={b.lengthCm || ""} onChange={(e) => updBaby(i, { lengthCm: e.target.value })} testid={`wb-baby-length-${i}`} />
                <TextField label="Head Circumference (cms)" type="number" step="0.1" value={b.headCm || ""} onChange={(e) => updBaby(i, { headCm: e.target.value })} testid={`wb-baby-hc-${i}`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="APGAR 1 min" type="number" value={b.apgar1 || ""} onChange={(e) => updBaby(i, { apgar1: e.target.value })} testid={`wb-baby-apgar1-${i}`} />
                <TextField label="APGAR 5 min" type="number" value={b.apgar5 || ""} onChange={(e) => updBaby(i, { apgar5: e.target.value })} testid={`wb-baby-apgar5-${i}`} />
                <TextField label="APGAR 10 min" type="number" value={b.apgar10 || ""} onChange={(e) => updBaby(i, { apgar10: e.target.value })} testid={`wb-baby-apgar10-${i}`} />
              </div>
              <ChoiceChips
                label="Resuscitation"
                options={YES_NO}
                value={b.resuscitation || ""}
                onChange={(v) => updBaby(i, { resuscitation: v })}
                negativeOptions={["Yes"]}
                testid={`wb-baby-resusc-${i}`}
              />
              <CheckGrid
                label="Baby complications"
                options={BABY_COMPLICATIONS}
                value={b.complications || []}
                onChange={(v) => updBaby(i, { complications: v })}
                alertWhenSelected
                testid={`wb-baby-comp-${i}`}
              />
              <ChoiceChips
                label="Baby Outcome"
                options={BABY_OUTCOMES}
                value={b.outcome || ""}
                onChange={(v) => updBaby(i, { outcome: v })}
                negativeOptions={BABY_OUTCOME_ALERTS}
                testid={`wb-baby-outcome-${i}`}
              />
              <div className="border-t border-border/60 pt-3" data-testid={`wb-baby-exam-${i}`}>
                <p className="mb-3 font-head text-sm font-semibold text-primary">Physical examination</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PHYSICAL_EXAM_FIELDS.filter((f) => !f.sex || f.sex === (b.sex || "")).map((f) => (
                    <ChoiceChips
                      key={f.k}
                      label={f.label}
                      options={f.options}
                      value={(b.physicalExam || {})[f.k] || ""}
                      onChange={(v) => updBabyExam(i, f.k, v)}
                      negativeOptions={f.alert || []}
                      testid={`wb-baby-${i}-pe-${f.k}`}
                    />
                  ))}
                  {!b.sex && (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Select sex above to show male/female-specific exam fields.
                    </p>
                  )}
                </div>
                {PHYSICAL_EXAM_FIELDS.some((f) => (!f.sex || f.sex === b.sex) && (f.alert || []).includes((b.physicalExam || {})[f.k])) && (
                  <AlertPanel level="urgent" title="Concerning findings" testid={`wb-baby-exam-alert-${i}`}>
                    Negative / abnormal answers are highlighted in red. Review and manage as needed.
                  </AlertPanel>
                )}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Chief complaints",
      done: d.complaints.length > 0,
      body: (
        <CheckGrid
          label="Select complaints"
          options={[...CHIEF_COMPLAINTS, ...d.complaints.filter((c) => !CHIEF_COMPLAINTS.includes(c))]}
          value={d.complaints}
          onChange={(v) => set("complaints", v)}
          testid="wb-complaints"
        />
      ),
    },
    {
      title: "Allergy",
      done: d.allergy.length > 0,
      body: (
        <CheckGrid
          label="Known allergies"
          options={[...ALLERGIES, ...d.allergy.filter((a) => !ALLERGIES.includes(a))]}
          value={d.allergy}
          onChange={(v) => set("allergy", nextAllergySelection(v))}
          testid="wb-allergy"
        />
      ),
    },
    { title: "Growth chart", done: Object.values(d.growth.measures || {}).some(Boolean), body: <GrowthEntry sex={p.sex || p.gender} ageMonths={ageMonths} ageLabel={ageLabel} value={d.growth} previousMeasures={priorGrowthMeasures} onChange={(v) => set("growth", v)} testid="wb-growth" /> },
    {
      title: "Immunization", done: Object.values(d.immunization).some((x) => x?.given),
      body: (
        <div className="space-y-2" data-testid="wb-immunization">
          <p className="text-xs text-muted-foreground">Schedule: <b>{schedule.name || "—"}</b> (edit in Admin → Masters). At-birth always; other doses from 1 week before due — else add below.</p>
          <ImmunizationEntryCards
            vaccines={visibleVaccines}
            records={d.immunization}
            getDue={(item) => immunizationDueFromDob(item, dob)}
            getOverdue={(item, rec) => isVaccineOverdue(item, rec, dob)}
            onToggle={toggleVaccine}
            onSetDate={setVaccineDate}
            testidPrefix="wb-vac"
          />
          {addVacOptions.length > 0 && (
            <Field label="Add additional vaccine from drug list">
              <SelectField
                label=""
                options={addVacOptions.map((o) => o.label)}
                value=""
                onChange={(label) => {
                  const hit = addVacOptions.find((o) => o.label === label);
                  if (hit) onAddVaccine(hit.value);
                }}
                testid="wb-vac-add"
                placeholder="Choose a vaccine…"
              />
            </Field>
          )}
        </div>
      ),
    },
    {
      title: "Gross motor milestones", done: Object.values(d.milestones).some((x) => x?.achieved),
      body: (
        <MilestoneChart
          records={d.milestones}
          dob={dob}
          ageMonths={ageMonths}
          onToggle={toggleMilestone}
          onSetDate={setMilestoneDate}
          onClear={clearMilestone}
        />
      ),
    },
    {
      title: "Visit notes", done: d.notes.some((n) => String(n).trim()),
      body: <div className="space-y-3" data-testid="wb-notes">{d.notes.map((note, i) => (
        <div key={i} className="rounded-md border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">Note {d.notes.length - i}</p><ItemActions onAdd={addNote} addTestid={`wb-note-add-${i}`} canRemove={d.notes.length > 1} onRemove={() => rmNote(i)} removeTestid={`wb-note-remove-${i}`} /></div>
          <AreaField label="" rows={4} value={note} onChange={(e) => setNote(i, e.target.value)} testid={`wb-note-${i}`} />
        </div>
      ))}</div>,
    },
    {
      title: "Drugs", done: (d.drugs || []).length > 0,
      body: (
        <AntenatalMedications
          drugs={d.drugs || []}
          posology={d.posology || {}}
          medCourses={d.medCourses || {}}
          catalogue={catalogueDrugs}
          presetDrugs={WELLBABY_DRUGS}
          drugMeta={WELLBABY_DRUG_META}
          diseaseId={WELLBABY_ID}
          testid="wb-medications"
          onChange={(patch) => {
            setD((s) => {
              const next = { ...s, ...patch };
              if (patch.drugs != null) queueField("drugs", next.drugs, "Medications", "Drugs");
              if (patch.posology != null) queueField("posology", next.posology, "Medications", "Posology");
              if (patch.medCourses != null) queueField("medCourses", next.medCourses, "Medications", "Medication courses");
              return next;
            });
          }}
        />
      ),
    },
    {
      title: "Laboratory",
      done: (d.lab || []).some((x) => x.result || x.analyte || x.sentToLab),
      body: (
        <div className="space-y-4">
          <AlertPanel level="info" title="Bedside by default" testid="wb-lab-bedside-note">
            Orders are completed at the bedside by default.
            {facilityHasLab
              ? " This facility has a Lab — choose Lab location to send an order, then enter results when completed."
              : " This facility has no Lab location configured."}
          </AlertPanel>

          <div className="space-y-4" data-testid="wb-lab-list">
            {labTestNames.map((testName) => {
              const def = WELLBABY_LAB_TESTS.find((t) => t.name === testName);
              const entries = (d.lab || [])
                .map((row, i) => ({ row, i }))
                .filter(({ row }) => row.test === testName);
              const slug = testName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              return (
                <div key={testName} className="rounded-md border border-border bg-white p-4" data-testid={`wb-lab-group-${slug}`}>
                  <p className="mb-3 font-semibold text-foreground">{testName}</p>
                  <div className="space-y-3">
                    {entries.map(({ row, i }, localIdx) => {
                      const isLabOrder = facilityHasLab && row.location === "Lab";
                      return (
                        <div key={i} className="rounded-md border border-border/70 bg-muted/10 p-3" data-testid={`wb-lab-row-${i}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">Result {entries.length - localIdx}</p>
                            <ItemActions
                              onAdd={() => addLabForTest(testName, i)}
                              addTestid={`wb-lab-add-${slug}-${localIdx}`}
                              canRemove={entries.length > 1}
                              onRemove={() => rmLab(i)}
                              removeTestid={`wb-lab-remove-${i}`}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <SelectField
                              label="Result"
                              options={def?.results || ["Reactive", "Non-reactive", "Indeterminate"]}
                              value={row.result}
                              onChange={(v) => updLab(i, { result: v, completed: !!v, ...(v && !row.date ? { date: localISODate() } : {}) })}
                              testid={`wb-lab-result-${i}`}
                            />
                            <TextField
                              label="Analyte / value"
                              value={row.analyte || ""}
                              onChange={(e) => updLab(i, { analyte: e.target.value })}
                              testid={`wb-lab-analyte-${i}`}
                              placeholder="Optional note"
                            />
                            <SelectField
                              label="Location"
                              options={facilityHasLab ? ["Bedside", "Lab"] : ["Bedside"]}
                              value={row.location || "Bedside"}
                              onChange={(v) => updLab(i, { location: v, sentToLab: v === "Lab" ? row.sentToLab : false })}
                              testid={`wb-lab-location-${i}`}
                            />
                            <TextField
                              label="Completed date"
                              type="date"
                              value={row.date}
                              onChange={(e) => updLab(i, { date: e.target.value })}
                              testid={`wb-lab-date-${i}`}
                            />
                          </div>
                          {isLabOrder && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-9"
                                data-testid={`wb-lab-send-${i}`}
                                onClick={() => { updLab(i, { sentToLab: true }); toast.success("Order sent to Lab"); }}
                                disabled={row.sentToLab}
                              >
                                {row.sentToLab ? "Order sent to Lab ✓" : "Send order to Lab"}
                              </Button>
                              {row.sentToLab && !row.result && (
                                <p className="text-xs text-muted-foreground">Add results when the test is completed.</p>
                              )}
                            </div>
                          )}
                          {localIdx === entries.length - 1 && (
                            <p className="mt-2 text-xs text-muted-foreground">Add another result to repeat this test</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
  ];

  const focusSection = params.get("section");

  return (
    <ConditionEntryShell
      patient={p} patientEncs={patientEncs} sidebarDiseases={[{ id: WELLBABY_ID, name: WELLBABY_NAME }]}
      title={`${WELLBABY_NAME} visit`} context={`${facility} · ${visitType} · ${ageLabel}`}
      sections={sections} onSave={persist} savedAt={savedAt} focusSection={focusSection}
      saveDisabled={phiLoading}
      backTo={() => navigate(`/patients/${p.id}?tab=wellbaby`)}
    />
  );
}
